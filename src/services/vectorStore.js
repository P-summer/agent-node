const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { doubaoEmbeddings } = require("../utils/doubaoEmbedding");

// const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/huggingface_transformers");
// const {
//   HuggingFaceTransformersEmbeddings,
// } = require("@langchain/community/embeddings/huggingface_transformers");

// const embeddings = new HuggingFaceTransformersEmbeddings({
//   model: "Xenova/all-MiniLM-L6-v2",
// });
let vectorStore;

async function getVectorStore() {
  if (vectorStore) return vectorStore;
  const url = `http://${process.env.CHROMA_HOST || "localhost"}:${process.env.CHROMA_PORT || "8000"}`;
  const collectionName = "user_memories";
  // console.log(`连接 Chroma: ${url}`);

  try {
    // 尝试获取已有集合
    vectorStore = await Chroma.fromExistingCollection(doubaoEmbeddings, {
      collectionName,
      url,
    });
    // console.log("成功连接到已有集合 user_memories");
  } catch (err) {
    // console.log("集合不存在，创建新集合 user_memories");
    // 创建一个空集合（通过 fromDocuments 传入空数组）
    vectorStore = await Chroma.fromDocuments([], doubaoEmbeddings, {
      collectionName,
      url,
    });
  }
  return vectorStore;
}
// 代码向量存储
let codeVectorStore = null;
async function getCodeVectorStore() {
  if (codeVectorStore) return codeVectorStore;
  const url = `http://${process.env.CHROMA_HOST || "localhost"}:${process.env.CHROMA_PORT || "8000"}`;
  const collectionName = "codebase";
  try {
    codeVectorStore = await Chroma.fromExistingCollection(doubaoEmbeddings, {
      collectionName,
      url,
    });
    console.log("成功连接到已有集合 codebase");
  } catch (err) {
    codeVectorStore = await Chroma.fromDocuments([], doubaoEmbeddings, {
      collectionName,
      url,
    });
  }
  return codeVectorStore;
}
module.exports = { getVectorStore, getCodeVectorStore };

// async function testEmbedding() {
//   const res = await doubaoEmbeddings.embedQuery("测试一下");
//   console.log("embedding length:", res.length);
// }

// testEmbedding();
