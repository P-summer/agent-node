const express = require("express");
const router = express.Router();
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { deepSeekModel } = require("../llmModel/deepSeekModel");
const sessionStore = require("../services/sessionStore");

router.post("/", async (req, res) => {
  const { message, sessionId } = req.body;
  if (!sessionId)
    return res.status(400).json({ error: "sessionId is required" });
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "消息不能为空且必须是字符串" });
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 获取历史消息
  let history = sessionStore.getHistory(sessionId);
  const messages = [...history, new HumanMessage(message)];

  // 直接使用模型流式输出（不绑定工具，保持简单；如果需要工具，需额外处理）
  const stream = await deepSeekModel.stream(messages);
  let fullContent = "";
  try {
    for await (const chunk of stream) {
      const content = chunk.content;
      if (content) {
        fullContent += content;
        // 发送 SSE 数据块，格式为 "data: {内容}\n\n"
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    // 流结束，发送一条特殊消息表示完成，并附带完整内容供历史存储
    res.write(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`);
  } catch (error) {
    console.error("Stream error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    // 更新历史
    sessionStore.addMessage(sessionId, new HumanMessage(message));
    sessionStore.addMessage(sessionId, new AIMessage(fullContent));
    res.end(); //res.write() 用于分段发送响应体，最后需要 res.end() 结束响应（否则客户端会一直等待）。
  }
});

module.exports = router;
