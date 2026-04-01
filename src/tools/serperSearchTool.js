const { tool } = require("langchain");
const { z } = require("zod");
const axios = require("axios");

const serperSearchTool = tool(
  async (query) => {
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.SERPER_API_URL,
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      data: { q: query.query },
    };

    try {
      const response = await axios.request(config);
      const topResults = response.data.organic?.slice(0, 5) || [];
      if (topResults.length === 0) return "未找到相关搜索结果。";

      // 只返回原始标题和摘要，每对之间用空行分隔，不添加任何额外格式
      let resultsText = "";
      topResults.forEach((item) => {
        const title = item.title || "无标题";
        const snippet = item.snippet?.replace(/\n+/g, " ").trim() || "无摘要";
        resultsText += `${title}\n${snippet}\n\n`;
      });
      return resultsText.trim();
    } catch (error) {
      console.error("Serper 搜索工具调用失败：", error.message);
      return "搜索工具调用失败，暂时无法获取相关信息。";
    }
  },
  {
    name: "web_search",
    description:
      "使用 Serper API 查询实时 Google 搜索结果。输入查询关键词，返回原始搜索结果列表（包含标题和摘要）。请基于这些信息进行总结，并严格按照系统提示中的格式输出结构化信息。",
    schema: z.object({
      query: z.string().describe("搜索查询关键词"),
    }),
  },
);

module.exports = { serperSearchTool };
