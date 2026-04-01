import { ChromaClient } from "chromadb";

// 1. 连接Chroma数据库
const chromaClient = new ChromaClient({
  path: "http://localhost:8000",
});

// 2. 查询所有集合（库）的数量 + 列出所有集合名称
const getAllCollectionsInfo = async () => {
  try {
    const collections = await chromaClient.listCollections();
    const collectionCount = collections.length;
    const collectionNames = collections.map((col) => col.name);
    console.log(`✅ 当前Chroma中存在的集合（库）数量：${collectionCount}`);
    if (collectionCount > 0) {
      console.log(`📋 所有集合名称：${collectionNames.join(", ")}`);
    }
    return { count: collectionCount, names: collectionNames };
  } catch (err) {
    console.error("❌ 查询集合列表失败：", err.message);
    return { count: 0, names: [] };
  }
};

// 3. 查询指定集合内的数据量（向量条数）
const getCollectionDataCount = async (collectionName) => {
  if (!collectionName) {
    console.error("❌ 集合名称不能为空！");
    return 0;
  }

  try {
    // 获取指定集合
    const collection = await chromaClient.getCollection({
      name: collectionName,
    });
    // 查询集合内数据量
    const dataCount = await collection.count();
    console.log(`✅ 集合「${collectionName}」内的向量数据量：${dataCount}`);
    return dataCount;
  } catch (err) {
    if (err.message.includes("not found")) {
      console.log(`ℹ️ 集合「${collectionName}」不存在，无需查询数据量`);
    } else {
      console.error(
        `❌ 查询集合「${collectionName}」数据量失败：`,
        err.message,
      );
    }
    return 0;
  }
};

// 4. 原有逻辑：删除指定集合  codebase  user_memories
const clearOldCodeData = async () => {
  const collectionName = "user_memories";
  try {
    await chromaClient.deleteCollection({
      name: collectionName,
    });
    console.log(`✅ 旧代码向量集合「${collectionName}」已彻底删除！`);
  } catch (err) {
    console.log(`ℹ️ 集合「${collectionName}」不存在，无需删除`);
  }
};

getCollectionDataCount("user_memories");
