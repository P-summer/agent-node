// 向量模型
const { Embeddings } = require("@langchain/core/embeddings");
require("dotenv").config(); // 跑脚本要加载环境变量
// 自定义火山引擎多模态 Embedding 类
class VolcMultimodalEmbeddings extends Embeddings {
  constructor() {
    super({});
    // 直接从 .env 读取配置
    this.model = process.env.DOUBAO_EMBEDDING_MODEL;
    this.apiKey = process.env.DOUBAO_API_KEY;
    // 必填项校验
    if (!this.apiKey) {
      throw new Error("请在 .env 中配置 DOUBAO_API_KEY");
    }
  }

  // 批量生成文档向量
  async embedDocuments(documents) {
    const promises = documents.map((doc) => this.embedQuery(doc));
    return Promise.all(promises);
  }

  // 单条生成查询向量（核心：调用火山多模态接口）
  async embedQuery(query) {
    try {
      const response = await fetch(process.env.DOUBAO_EMBEDDING_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: [{ type: "text", text: query }],
          encoding_format: "float",
        }),
      });

      const data = await response.json();
      return data.data.embedding;
    } catch (error) {
      console.error("Embedding调用失败:", error);
      throw new Error(`Embedding failed: ${error.message}`);
    }
  }
}

// 导出实例，直接在你的项目中使用
module.exports = {
  VolcMultimodalEmbeddings,
  // 直接创建好实例，一键使用
  doubaoEmbeddings: new VolcMultimodalEmbeddings(),
};
