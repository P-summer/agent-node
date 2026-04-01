// ChatOpenAI 是 LangChain 官方 @langchain/openai 包中提供的聊天模型类。
const { ChatOpenAI } = require("@langchain/openai");

const doubaoModel = new ChatOpenAI({
  model: process.env.DOUBAO_MODEL,
  temperature: 0.1,
  apiKey: process.env.DOUBAO_API_KEY,
  streaming: true,
  configuration: {
    baseURL: process.env.DOUBAO_API_URL,
  },
});

module.exports = { doubaoModel };
