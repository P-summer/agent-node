// routes/deepseek-agent.js
const express = require("express");
const router = express.Router();
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { deepSeekModel } = require("../llmModel/deepSeekModel");
const getWeather = require("../tools/weatherTool");
const { createAgent } = require("langchain");
const sessionStore = require("../services/sessionStore");

// 创建 Agent（只创建一次，避免每次请求重复创建）
const deepSeekAgent = createAgent({
  model: deepSeekModel,
  tools: [getWeather],
  systemPrompt: `
你是一个智能助手。请遵守以下规则：
- 如果用户明确询问天气（例如“今天天气怎么样？”“北京气温”），必须调用 get_weather 工具获取真实天气信息，不要编造。
- 如果用户没有问天气（如“你好”“你是谁”“讲个笑话”），**绝对不要调用任何工具**，直接友好回答用户的问题。
- 所有回答请用中文，简洁自然。
`,
});

router.post("/", async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "消息不能为空且必须是字符串" });
    }

    const history = sessionStore.getHistory(sessionId);
    const messages = [...history, new HumanMessage(message)];

    const response = await deepSeekAgent.invoke({ messages });
    const reply = response.messages[response.messages.length - 1].content;

    // 更新历史
    sessionStore.addMessage(sessionId, new HumanMessage(message));
    sessionStore.addMessage(sessionId, new AIMessage(reply));

    res.json({ reply, sessionId });
  } catch (error) {
    next(error); // 传递给错误处理中间件
  }
});

module.exports = router;
