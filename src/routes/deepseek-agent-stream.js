const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { deepSeekModel } = require("../llmModel/deepSeekModel");
const { createAgent } = require("langchain");
const sessionStore = require("../services/sessionStore");
const { z } = require("zod");
// 引入工具
const { serperSearchTool } = require("../tools/serperSearchTool");
const { searchCode } = require("../tools/searchCodeTool");
const { searchMemory } = require("../tools/searchMemoryTool");
const { saveMemory } = require("../tools/saveMemoryTool");
const { timeTool } = require("../tools/timeTool");
const { errorResponse } = require("../utils/responseHandler");
// 引入 token 计数器
const { trimHistoryByTokens } = require("../services/tokenCounter");
// 定义最大历史 token 数（预留 28K 给系统提示、工具调用、当前消息等）
const MAX_HISTORY_TOKENS = 100000; // 128K - 28K

async function generateSessionTitle(userMessage) {
  const titlePrompt = `请用不超过20个字总结以下用户问题，作为会话标题，仅返回标题内容，不要额外解释：${userMessage}`;
  try {
    // 调用模型生成标题（非流式，轻量调用）
    const response = await deepSeekModel.invoke(titlePrompt);
    let title = response.content?.trim() || "新对话";
    // 兜底：标题过长则截断
    if (title.length > 20) title = title.substring(0, 20) + "...";
    return title;
  } catch (err) {
    console.error("生成标题失败:", err);
    return "新对话"; // 兜底
  }
}

const systemPromptPath = path.resolve(__dirname, "../utils/system-prompt.md");
const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");

// 创建 Agent（只创建一次）
const agent = createAgent({
  model: deepSeekModel,
  tools: [serperSearchTool, searchMemory, saveMemory, timeTool, searchCode],
  // 添加 context_schema 支持 runtime.context.userId
  context_schema: z.object({ userId: z.string() }),
  systemPrompt: systemPrompt,
});

router.post("/", async (req, res) => {
  const userId = req.userId;
  const { message, sessionId } = req.body;
  if (!sessionId) return errorResponse(res, "sessionId is required", 400, 400);
  if (!message || typeof message !== "string") {
    return errorResponse(res, "消息不能为空且必须是字符串", 400, 400);
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const isFirst = await sessionStore.isFirstMessage(sessionId, userId);
  let conversationTitle = "";
  if (isFirst) {
    conversationTitle = await generateSessionTitle(message);
  }
  // 获取历史消息 到数据库查询
  let history = await sessionStore.getHistory(sessionId, userId);
  // 按 token 数量截断历史（保留最新的消息）
  history = trimHistoryByTokens(history, MAX_HISTORY_TOKENS);

  const messages = [...history, new HumanMessage(message)];

  let fullContent = "";

  try {
    // 调用 Agent 的流式方法
    // LLM tokens
    // To stream tokens as they are produced by the LLM, use streamMode: "messages":
    const stream = await agent.stream(
      { messages },
      {
        streamMode: "messages",
        context: { userId: userId },
      },
    );

    // 在消息流模式下，chunk 是一个数组：[AIMessageChunk, metadata]
    for await (const chunk of stream) {
      const messageChunk = chunk[0];
      const metadata = chunk[1];

      // 只保留模型最终生成阶段的内容，跳过工具调用、内部流程等
      if (metadata?.langgraph_node !== "model_request") {
        continue;
        // res.write(
        //   `data: ${JSON.stringify({ type: "tool_calling", tool: metadata.tool_name })}\n\n`,
        // );
      }

      if (messageChunk && messageChunk.content) {
        const token =
          typeof messageChunk.content === "string"
            ? messageChunk.content
            : String(messageChunk.content ?? "");
        if (token) {
          fullContent += token;
          res.write(
            `data: ${JSON.stringify({ code: 200, success: true, content: token })}\n\n`,
          );
        }
      }
    }

    // 保存历史（使用最终生成的完整内容）
    await sessionStore.addMessage(sessionId, userId, new HumanMessage(message));
    await sessionStore.addMessage(
      sessionId,
      userId,
      new AIMessage(fullContent),
    );
    // 判断是否是第一条消息，生成并更新标题
    if (isFirst && conversationTitle) {
      await sessionStore.updateConversationTitle(
        sessionId,
        userId,
        conversationTitle,
      );
      // 推送标题更新事件
      res.write(
        `data: ${JSON.stringify({ type: "title_updated", title: conversationTitle })}\n\n`,
      );
    }
    // 流结束，发送完成标记和完整内容
    res.write(
      `data: ${JSON.stringify({
        code: 200,
        success: true,
        done: true,
        fullContent,
      })}\n\n`,
    );
  } catch (error) {
    console.error("Agent stream error:", error);
    console.error("Agent stream stack:", error.stack);
    res.write(
      `data: ${JSON.stringify({
        code: 500,
        success: false,
        error: error.message,
      })}\n\n`,
    );
  } finally {
    res.end();
  }
});

module.exports = router;
