const express = require("express");
const router = express.Router();
const { createAgent } = require("langchain");
const getWeather = require("../tools/weatherTool");
const { ChatDoubao } = require("../llmModel/ChatDoubao"); // 确保路径正确

// createAgent 是 LangChain 提供的高级函数，它会创建一个 ReAct 风格的 Agent
const agent = createAgent({
  model: new ChatDoubao({ temperature: 0 }),
  tools: [getWeather],
  systemPrompt: `
    你是一个智能助手。
    你有以下工具可用：
    1. get_weather - 查询城市天气
    规则：
    - 用户问天气时，必须调用 get_weather 工具，不要编造数据
    - 其他问题直接回答
    - 回答简洁，用中文回复
    - 注意：当工具返回结果时，会以用户消息的形式呈现，并带有“[工具 工具名 返回]: ”的前缀，请据此生成最终回答。
  `,
});

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    const result = await agent.invoke({
      messages: [{ role: "user", content: message }],
    });
    const reply = result.messages[result.messages.length - 1].content || "完成";
    res.json({ reply });
  } catch (error) {
    console.error("Agent 执行失败:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
