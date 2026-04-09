const rateLimit = require("express-rate-limit");

// 通用限流：默认每15分钟最多100次请求
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制次数
  message: {
    code: 429,
    message: "请求过于频繁，请稍后再试",
  },
  standardHeaders: true, // 返回 `RateLimit-*` 头
  legacyHeaders: false, // 禁用 `X-RateLimit-*` 头
});

// 严格限流：用于登录、注册等敏感接口（每15分钟最多5次）
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    code: 429,
    message: "操作过于频繁，请稍后再试",
  },
});

// 宽松限流：用于AI聊天等可能持续请求的接口（如每分钟最多30次）
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 30,
  message: {
    code: 429,
    message: "请求频率过高，请稍后再试",
  },
});

module.exports = {
  generalLimiter,
  strictLimiter,
  chatLimiter,
};
