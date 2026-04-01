const { StateGraph, START, END } = require("@langchain/langgraph");
const { generatePlan, executeStep, summarizeStream } = require("./planner");

const { deepSeekModel } = require("../llmModel/deepSeekModel");
const fs = require("fs");
const path = require("path");

/**
 * 构建 plan-and-execute 的 LangGraph
 * @returns {CompiledStateGraph} 编译后的图
 */
function buildPlanExecuteGraph() {
  // 定义节点函数
  const nodes = {
    // 节点1：生成计划
    generatePlanNode: async (state, config) => {
      const writer = config.writer; // LangGraph 提供的函数 用于发送自定义事件到前端
      const { messages } = state;
      const lastMsg = messages[messages.length - 1];
      const userMessage = lastMsg.content;
      const historyMessages = messages.slice(0, -1); //传递历史（不包括最后一条）
      const plan = await generatePlan(userMessage, historyMessages);
      // 通过 writer 发送计划事件（SSE 会用）
      writer({ type: "plan", plan });
      return { plan, currentStepIndex: 0, stepResults: [] };
    },

    // 节点2：执行一个步骤
    executeStepNode: async (state, config) => {
      const writer = config.writer;
      const { plan, currentStepIndex, stepResults, userId, messages } = state;
      if (currentStepIndex >= plan.length) {
        return {}; // 无步骤可执行，图会通过条件边进入汇总
      }
      const step = plan[currentStepIndex];
      const context = {
        originalUserMessage: messages[messages.length - 1].content,
        results: stepResults,
        historyMessages: messages.slice(0, -1), // 传递历史（不包括最后一条）
      };
      const result = await executeStep(step, context, userId);
      const newStepResult = { description: step.description, result };
      // 发送步骤结果事件
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

    // 节点3：汇总并流式输出最终答案
    summarizeNode: async (state, config) => {
      const writer = config.writer;
      const { stepResults, messages } = state;
      const userMessage = messages[messages.length - 1].content;
      const historyMessages = messages.slice(0, -1);

      if (stepResults.length === 0) {
        // 无步骤结果，直接调用模型生成回答（可使用系统提示词）
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
