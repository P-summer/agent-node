const { StateGraph, START, END } = require("@langchain/langgraph");
const { generatePlan, toolDescriptions } = require("./planner");
const { deepSeekModel } = require("../llmModel/deepSeekModel");
// 引入工具
const { serperSearchTool } = require("../tools/serperSearchTool");
const { searchMemory } = require("../tools/searchMemoryTool");
const { saveMemory } = require("../tools/saveMemoryTool");
const { timeTool } = require("../tools/timeTool");
const { searchCode } = require("../tools/searchCodeTool");
const fs = require("fs");
const path = require("path");

// 工具映射表收敛到LangGraph层
const toolMap = {
  web_search: serperSearchTool,
  search_memory: searchMemory,
  save_memory: saveMemory,
  get_current_time: timeTool,
  search_code: searchCode,
};

/**
 * 执行单个步骤
 * @param {Object} step - 步骤对象
 * @param {Object} context - 上下文
 * @param {string} userId - 用户ID
 * @returns {Promise<string>} 步骤结果
 */
async function executeStep(step, context, userId) {
  if (step.tool && toolMap[step.tool]) {
    const toolInstance = toolMap[step.tool];
    try {
      const result = await toolInstance.invoke(step.parameters || {}, {
        context: { userId },
      });
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err) {
      console.error(`工具 ${step.tool} 调用失败:`, err);
      return `工具调用失败: ${err.message}`;
    }
  } else {
    // 无工具步骤，用LLM推理
    const reasoningPrompt = `
      基于已有信息回答问题。
      对话历史：
      ${context.historyMessages.map((msg) => `${msg._getType() === "human" ? "用户" : "助手"}: ${msg.content}`).join("\n")}

      用户问题：${context.originalUserMessage}
      当前步骤：${step.description}
      之前步骤的结果：
      ${context.results.map((r, i) => `步骤${i + 1}: ${r.description}\n结果: ${r.result}`).join("\n")}

      请直接给出步骤结果，无需额外解释。
    `;
    const response = await deepSeekModel.invoke(reasoningPrompt);
    return response.content;
  }
}

/**
 * 流式汇总步骤结果
 * @param {Array} results - 步骤结果列表
 * @param {string} userMessage - 原始用户消息
 * @param {Array} historyMessages - 对话历史
 * @returns {AsyncIterable<string>} 生成token的异步迭代器
 */
async function* summarizeStream(results, userMessage, historyMessages = []) {
  const historyText = historyMessages
    .map(
      (msg) =>
        `${msg._getType() === "human" ? "用户" : "助手"}: ${msg.content}`,
    )
    .join("\n");

  const summaryPrompt = `
你是一个助手，根据以下步骤执行结果回答用户的问题。

对话历史：
${historyText || "（无历史）"}

用户问题：${userMessage}

执行步骤与结果：
${results.map((r, i) => `步骤${i + 1}: ${r.description}\n结果: ${r.result}`).join("\n")}

请基于上述信息，生成简洁、准确的最终回答。
  `;
  const stream = await deepSeekModel.stream(summaryPrompt);
  for await (const chunk of stream) {
    const content = chunk.content;
    if (content) yield content;
  }
}

/**
 * 构建plan-and-execute的LangGraph
 * @returns {CompiledStateGraph} 编译后的图
 */
function buildPlanExecuteGraph() {
  // 定义节点函数
  const nodes = {
    generatePlanNode: async (state, config) => {
      const writer = config.writer;
      const { messages } = state;
      const lastMsg = messages[messages.length - 1];
      const userMessage = lastMsg.content;
      const historyMessages = messages.slice(0, -1);
      const plan = await generatePlan(userMessage, historyMessages);
      console.log("[PLAN]", JSON.stringify(plan, null, 2));
      writer({ type: "plan", plan });
      return { plan, currentStepIndex: 0, stepResults: [] };
    },

    executeStepNode: async (state, config) => {
      const writer = config.writer;
      const { plan, currentStepIndex, stepResults, userId, messages } = state;
      if (currentStepIndex >= plan.length) {
        return {};
      }
      const step = plan[currentStepIndex];
      const context = {
        originalUserMessage: messages[messages.length - 1].content,
        results: stepResults,
        historyMessages: messages.slice(0, -1),
      };
      // 执行步骤
      console.log("[STEP]", step);
      const result = await executeStep(step, context, userId);
      console.log("[STEP_RESULT]", result);

      const newStepResult = { description: step.description, result };
      writer({
        type: "step_result",
        stepIndex: currentStepIndex,
        result,
      });
      return {
        stepResults: [...stepResults, newStepResult],
        currentStepIndex: currentStepIndex + 1,
      };
    },

    summarizeNode: async (state, config) => {
      const writer = config.writer;
      const { stepResults, messages } = state;
      const userMessage = messages[messages.length - 1].content;
      const historyMessages = messages.slice(0, -1);

      if (stepResults.length === 0) {
        const systemPrompt = fs.readFileSync(
          path.resolve(__dirname, "../utils/system-prompt.md"),
          "utf8",
        );
        const messagesForModel = [
          { role: "system", content: systemPrompt },
          ...historyMessages.map((msg) => ({
            role: msg._getType() === "human" ? "user" : "assistant",
            content: msg.content,
          })),
          { role: "user", content: userMessage },
        ];
        const response = await deepSeekModel.stream(messagesForModel);
        for await (const chunk of response) {
          const content = chunk.content;
          if (content) {
            writer({ type: "token", content });
          }
        }
        return { finalAnswer: "" };
      }

      let fullContent = "";
      try {
        // 直接调用当前文件的summarizeStream
        for await (const token of summarizeStream(
          stepResults,
          userMessage,
          historyMessages,
        )) {
          fullContent += token;
          writer({ type: "token", content: token });
        }
      } catch (err) {
        console.error("汇总失败:", err);
        const errorMsg = "抱歉，生成回答时出现错误。";
        writer({ type: "token", content: errorMsg });
        fullContent = errorMsg;
      }
      return { finalAnswer: fullContent };
    },
  };

  // 构建图
  const workflow = new StateGraph({
    channels: {
      messages: { value: (a, b) => b ?? a },
      userId: { value: (a, b) => b ?? a },
      plan: { value: (a, b) => b ?? a },
      currentStepIndex: { value: (a, b) => b ?? a, default: () => 0 }, // 当前执行到的步骤索引
      stepResults: { value: (a, b) => b ?? a, default: () => [] }, // 步骤执行结果
      finalAnswer: { value: (a, b) => b ?? a, default: () => "" }, // 最终答案（非流式时用）
      replanIteration: { value: (a, b) => b ?? a, default: () => 0 }, // 防止无限循环
    },
  });

  workflow.addNode("generatePlanNode", nodes.generatePlanNode);
  workflow.addNode("executeStepNode", nodes.executeStepNode);
  workflow.addNode("summarizeNode", nodes.summarizeNode);

  workflow.addEdge(START, "generatePlanNode");
  // 条件边：根据是否有计划决定下一步是执行步骤还是汇总答案
  workflow.addConditionalEdges("generatePlanNode", (state) => {
    if (state.plan.length === 0) return "summarizeNode";
    return "executeStepNode";
  });
  workflow.addConditionalEdges("executeStepNode", (state) => {
    if (state.currentStepIndex < state.plan.length) {
      return "executeStepNode";
    }
    return "summarizeNode";
  });
  workflow.addEdge("summarizeNode", END);

  return workflow.compile();
}

module.exports = { buildPlanExecuteGraph };
