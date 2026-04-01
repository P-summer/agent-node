// app.js
const express = require("express");
const cors = require("cors");
const errorHandler = require("./middlewares/errorHandler");
const authMiddleware = require("./middlewares/authMiddleware"); // 登录态校验中间件
const {
  generalLimiter,
  strictLimiter,
  chatLimiter,
} = require("./middlewares/rateLimiter");

const app = express();

require("./db");

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 可选：解析表单格式的请求体
// 中间件
app.use(cors());

app.use(generalLimiter);

app.use("/api/auth", strictLimiter, require("./routes/auth"));

// 挂载路由
app.use(
  "/api/douBaoChat",
  chatLimiter,
  authMiddleware,
  require("./routes/douBaoChat"),
); // 豆包聊天
app.use(
  "/api/douBaoAgent",
  chatLimiter,
  authMiddleware,
  require("./routes/douBaoAgent"),
); // 豆包+tool

app.use(
  "/api/chatDeepSeek",
  chatLimiter,
  authMiddleware,
  require("./routes/deepseek"), // planner + executor
);
app.use(
  "/api/deepSeekAgent",
  chatLimiter,
  authMiddleware,
  require("./routes/deepseek-agent"),
);
app.use(
  "/api/chatDeepSeekStream",
  chatLimiter,
  authMiddleware,
  require("./routes/deepseek-stream"),
);
app.use(
  "/api/deepSeekAgentStream",
  chatLimiter,
  authMiddleware,
  require("./routes/deepseek-agent-stream"), // ReAct 流式聊天
);
app.use("/api/conversation", authMiddleware, require("./routes/conversation"));
app.use("/api/message", authMiddleware, require("./routes/message"));

app.use(errorHandler);
module.exports = app;
