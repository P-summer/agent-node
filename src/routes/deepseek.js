//  手动 planner + execute 路由
const express = require("express");
const router = express.Router();
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { deepSeekModel } = require("../llmModel/deepSeekModel");
const sessionStore = require("../services/sessionStore");

const { errorResponse } = require("../utils/responseHandler");
// 引入 token 计数器
const { trimHistoryByTokens } = require("../services/tokenCounter");
// 引入 planner
const { buildPlanExecuteGraph } = require("../services/langgraph_plan_execute");

// 定义最大历史 token 数（预留 28K 给系统提示、工具调用、当前消息等）
const MAX_HISTORY_TOKENS = 100000; // 128K - 28K

// 在模块顶部构建一次图（单例）
const planExecuteGraph = buildPlanExecuteGraph();

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
  const initialState = {
    messages,
    userId,
    plan: [],
    currentStepIndex: 0,
    stepResults: [],
    finalAnswer: "",
  };

  let finalAnswer = "";

  try {
    // 流式执行图，并监听自定义事件
    const stream = await planExecuteGraph.stream(initialState, {
      streamMode: "custom", // 只接收自定义事件
    });

    for await (const event of stream) {
      // event 就是节点中 writer 发送的数据
      if (event.type === "plan") {
        res.write(
          `data: ${JSON.stringify({ type: "plan", plan: event.plan })}\n\n`,
        );
      } else if (event.type === "step_result") {
        res.write(
          `data: ${JSON.stringify({
            type: "step_result",
            stepIndex: event.stepIndex,
            result: event.result,
          })}\n\n`,
        );
      } else if (event.type === "token") {
        finalAnswer += event.content;
        res.write(
          `data: ${JSON.stringify({ code: 200, success: true, content: event.content })}\n\n`,
        );
      }
    }

    // 保存历史（最终答案已经在 finalAnswer 中）
    await sessionStore.addMessage(sessionId, userId, new HumanMessage(message));
    await sessionStore.addMessage(
      sessionId,
      userId,
      new AIMessage(finalAnswer),
    );

    if (isFirst && conversationTitle) {
      await sessionStore.updateConversationTitle(
        sessionId,
        userId,
        conversationTitle,
      );
      res.write(
        `data: ${JSON.stringify({ type: "title_updated", title: conversationTitle })}\n\n`,
      );
    }

    res.write(
      `data: ${JSON.stringify({ code: 200, success: true, done: true, fullContent: finalAnswer })}\n\n`,
    );
  } catch (error) {
    console.error("Plan-and-Execute 执行失败:", error);
    res.write(
      `data: ${JSON.stringify({ code: 500, success: false, error: error.message })}\n\n`,
    );
  } finally {
    res.end();
  }
});

module.exports = router;
