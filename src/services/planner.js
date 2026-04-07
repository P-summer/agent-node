const { deepSeekModel } = require("../llmModel/deepSeekModel");

const toolDescriptions = {
  // 保留工具参数描述（仅用于生成计划的Prompt）
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

/**
 * 仅生成步骤计划（无工具执行逻辑）
 * @param {string} userMessage - 用户问题
 * @param {Array} history - 对话历史
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

    **判断规则：**
    1. **必须调用 search_memory 的情况**：用户询问任何关于他们自己的个人信息，例如：
      - “我喜欢什么”、“我的爱好”、“我的名字”、“我的年龄”、“我的工作”
      - “我昨天做了什么”、“我之前说过什么”、“我的记忆中有哪些信息”
      - 任何包含“我”、“我的”且询问个人属性、喜好、经历的问题
      此时必须生成一个步骤：{ "description": "查询用户个人信息", "tool": "search_memory", "parameters": { "query": "用户问题中的关键词" } }

    2. **必须调用 save_memory 的情况**：用户要求记住信息，例如“记住我叫XXX”、“我喜欢篮球”

    3. **其他需要工具的情况**：实时信息（天气、新闻）→ web_search 或 get_current_time；代码查询 → search_code

    4. **无需调用工具的情况**（输出 []）：纯问候（你好）、通用知识问答（“什么是AI”且不需要搜索）、创意生成（写诗）

    对话历史：
    ${historyText || "（无历史）"}

    用户问题：${userMessage}

    输出格式：只输出一个合法的 JSON 数组，不要有任何其他文字。
    示例：
    [{"description": "查询用户喜欢的食物", "tool": "search_memory", "parameters": {"query": "喜欢 食物"}}]
    如果确实不需要任何工具，输出：[]
    `;
  const response = await deepSeekModel.invoke(planPrompt);
  let plan;
  try {
    const content = response.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      plan = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No JSON array found");
    }
  } catch (err) {
    console.error("解析计划失败:", err);
    plan = [{ description: userMessage, tool: null, parameters: {} }];
  }
  return plan;
}

module.exports = { generatePlan, toolDescriptions }; // 导出工具描述供LangGraph使用
