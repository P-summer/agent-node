const { deepSeekModel } = require("../llmModel/deepSeekModel");
const { serperSearchTool } = require("../tools/serperSearchTool");
const { searchMemory } = require("../tools/searchMemoryTool");
const { saveMemory } = require("../tools/saveMemoryTool");
const { timeTool } = require("../tools/timeTool");
const { searchCode } = require("../tools/searchCodeTool");

const toolDescriptions = {
  web_search: { params: { query: "string (搜索关键词)" } },
  search_memory: {
    params: {
      query: "string (要检索的信息描述)",
      k: "number (可选, 返回数量)",
    },
  },
  save_memory: {
    params: { content: "string (要保存的内容)", metadata: "object (可选)" },
  },
  get_current_time: {
    params: {
      type: "enum('current_time','current_date','current_weekday','all') (可选, 默认all)",
    },
  },
  search_code: {
    params: {
      query: "string (代码查询描述)",
      k: "number (可选)",
      layer: "enum('frontend','backend') (可选)",
      module: "string (可选)",
      type: "enum('function','class','method','vue-component') (可选)",
    },
  },
};
// 工具映射表
const toolMap = {
  web_search: serperSearchTool,
  search_memory: searchMemory,
  save_memory: saveMemory,
  get_current_time: timeTool,
  search_code: searchCode,
};

/**
 * 生成步骤计划
 * @param {string} userMessage - 用户问题
 * @param {Array} history - 对话历史（可选）
 * @returns {Promise<Array>} 步骤列表
 */
async function generatePlan(userMessage, history = []) {
  const historyText = history
    .map(
      (msg) =>
        `${msg._getType() === "human" ? "用户" : "助手"}: ${msg.content}`,
    )
    .join("\n");
  const planPrompt = `
你是一个任务规划助手。根据用户的问题，将任务分解为具体的执行步骤。
**重要：首先判断用户问题是否属于“无需调用工具”的场景。**
无需调用工具的场景包括：日常问候、纯闲聊、身份询问、创意生成以及任何不需要联网/记忆就能回答的通用知识。
如果属于上述场景，**不要**生成任何工具调用步骤，直接输出空数组 []。

对话历史：
${historyText || "（无历史）"}

用户问题：${userMessage}
如需调用工具，每个步骤应包含：
- description: 步骤描述（简短）
- tool: 要调用的工具名，可选值：${Object.keys(toolMap).join(", ")} 或 null（表示无需工具，仅推理）
- parameters: 调用工具时需要的参数（对象），必须符合工具要求的参数结构。


各工具的参数要求：
${Object.entries(toolDescriptions)
  .map(([name, desc]) => `- ${name}: ${JSON.stringify(desc.params)}`)
  .join("\n")}

用户问题：${userMessage}

请仅输出 JSON 数组，不要有其他文字。示例：
[
  { "description": "查询北京天气", "tool": "web_search", "parameters": { "query": "北京今天天气" } },
  { "description": "查询用户的名字", "tool": "search_memory", "parameters": { "query": "名字" } }
]
`;
  const response = await deepSeekModel.invoke(planPrompt);
  let plan;
  try {
    // 提取 JSON 部分
    const content = response.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      plan = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No JSON array found");
    }
  } catch (err) {
    console.error("解析计划失败:", err);
    // 降级：直接返回一个默认步骤，把整个问题交给工具调用（或原 Agent）
    plan = [{ description: userMessage, tool: null, parameters: {} }];
  }
  return plan;
}

/**
 * 执行单个步骤
 * @param {Object} step - 步骤对象
 * @param {Object} context - 上下文（存储之前步骤的结果）
 * @param {string} userId - 用户 ID
 * @returns {Promise<string>} 步骤结果
 */
async function executeStep(step, context, userId) {
  if (step.tool && toolMap[step.tool]) {
    const toolInstance = toolMap[step.tool];
    try {
      // 使用 invoke 方法，传递参数和 runtime.context
      const result = await toolInstance.invoke(step.parameters || {}, {
        context: { userId },
      });
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err) {
      console.error(`工具 ${step.tool} 调用失败:`, err);
      return `工具调用失败: ${err.message}`;
    }
  } else {
    // 无工具步骤，用 LLM 推理
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
 * 流式汇总步骤结果，生成最终回答
 * @param {Array} results - 步骤结果列表
 * @param {string} userMessage - 原始用户消息
 * @returns {AsyncIterable<string>} 生成 token 的异步迭代器
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

module.exports = { generatePlan, executeStep, summarizeStream };
