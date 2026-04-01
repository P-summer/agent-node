const chokidar = require("chokidar");
const { getCodeVectorStore } = require("./vectorStore");
const { chunkFile } = require("./codeChunker");
const { Document } = require("@langchain/core/documents");

let store = null;
// 初始化文件监听器
async function initWatcher() {
  store = await getCodeVectorStore();
  const watcher = chokidar.watch(
    ["D:/AAA-summer/code/node-server", "D:/AAA-summer/code/vue3-AI-agent"], // 根据实际情况添加其他项目目录
    {
      ignored: /node_modules|chroma_data|scripts|dist|\.git/,
      persistent: true,
    },
  );

  watcher.on("change", async (filePath) => {
    console.log(`文件变更: ${filePath}`);
    await updateFile(filePath);
  });

  watcher.on("add", async (filePath) => {
    console.log(`文件新增: ${filePath}`);
    await updateFile(filePath);
  });

  watcher.on("unlink", async (filePath) => {
    console.log(`文件删除: ${filePath}`);
    await deleteFile(filePath);
  });
}

async function updateFile(filePath) {
  // 1. 删除该文件的所有旧块
  await store.delete({ where: { filePath } }); // 注意：Chroma 的 delete 方法需要精确过滤，这里需确保元数据中有 filePath 字段
  // 2. 重新解析并插入新块
  const chunks = chunkFile(filePath);
  const docs = chunks.map(
    (chunk) =>
      new Document({
        pageContent: chunk.content,
        metadata: { ...chunk.metadata, filePath },
      }),
  );
  if (docs.length) {
    await store.addDocuments(docs);
    console.log(`已更新 ${filePath}，共 ${docs.length} 个块`);
  }
}

async function deleteFile(filePath) {
  await store.delete({ where: { filePath } });
  console.log(`已删除 ${filePath} 的相关块`);
}

initWatcher().catch(console.error);
