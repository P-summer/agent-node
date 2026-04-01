const { getCodeVectorStore } = require("../src/services/vectorStore");
const { chunkFile } = require("../src/services/codeChunker");
const { Document } = require("@langchain/core/documents");
const glob = require("glob");

async function indexCodebase() {
  const store = await getCodeVectorStore();
  // 先运行一次快速测试（如只索引一个文件或一个小目录
  const codeDirs = [
    "D:/AAA-summer/code/node-server",
    // "D:/AAA-summer/code/vue3-AI-agent",
  ];

  // 收集所有待处理文件（使用 glob 模式）
  const filePatterns = codeDirs.map(
    (dir) => `${dir}/**/*.{js,ts,jsx,tsx,vue,json,md}`,
  );
  const allFiles = [];
  for (const pattern of filePatterns) {
    const files = glob.sync(pattern, {
      ignore: [
        "**/node_modules/**",
        "**/chroma_data/**",
        "**/scripts/**",
        "**/dist/**",
        "**/.vscode/**",
        "**/.git/**",
        "**/.env/**",
      ],
      absolute: true, // 返回绝对路径，便于 metadata
    });
    allFiles.push(...files);
  }

  console.log(`📁 共发现 ${allFiles.length} 个文件待处理`);
  let successCount = 0;
  let failCount = 0;
  // 4. 逐文件处理（流式插入，避免一次性加载所有文档）
  for (const filePath of allFiles) {
    try {
      // 调用优化后的 chunkFile（现在会返回带丰富 metadata 的切片）
      const chunks = chunkFile(filePath);

      if (!chunks.length) {
        // 无切片（可能解析失败或文件为空），跳过
        continue;
      }

      // 将每个切片转为 LangChain Document
      const docs = chunks.map(
        (chunk) =>
          new Document({
            pageContent: chunk.content,
            metadata: chunk.metadata, // metadata 已包含 layer, module, type, name 等
          }),
      );
      // 插入向量库（可批量，但这里单文件批次足够）
      await store.addDocuments(docs);
      successCount++;
      // 可选：打印详细日志（调试用）
      // console.log(`✅ 已索引 ${filePath}，生成 ${docs.length} 个切片`);
    } catch (err) {
      console.error(`❌ 处理文件失败 ${filePath}:`, err.message);
      failCount++;
    }
  }

  console.log(
    `\n🎉 索引完成！成功: ${successCount} 个文件，失败: ${failCount} 个文件`,
  );
}

indexCodebase().catch(console.error);
