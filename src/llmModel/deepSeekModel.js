// ChatOpenAI 是 LangChain 官方 @langchain/openai 包中提供的聊天模型类。
// 它内部封装了对 OpenAI 风格 API 的调用（包括请求格式、响应解析、错误处理、流式输出、工具绑定等）。
// 由于 DeepSeek 的 API 与 OpenAI 完全兼容，因此可以直接使用 ChatOpenAI 来调用 DeepSeek 模型
// 而不需要去继承 BaseChatModel 或者重写 _generate 方法来适配豆包的特殊格式。
const { ChatOpenAI } = require("@langchain/openai");

const deepSeekModel = new ChatOpenAI({
  model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  temperature: 0.2,
  apiKey: process.env.DEEPSEEK_API_KEY,
  streaming: true,
  configuration: {
    baseURL: process.env.DEEPSEEK_API_URL,
  },
});

module.exports = { deepSeekModel };
