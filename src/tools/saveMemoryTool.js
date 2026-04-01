const { tool } = require("langchain");
const { z } = require("zod");
const { getVectorStore } = require("../services/vectorStore");
const { Document } = require("@langchain/core/documents");

const SaveMemorySchema = z.object({
  content: z.string().min(1).describe("需要记住的文本"),
  metadata: z.record(z.string()).optional().describe("可选元数据"),
});

const saveMemory = tool(
  async (args, runtime) => {
    try {
      // 参数验证
      const parsed = SaveMemorySchema.safeParse(args);
      if (!parsed.success) {
        return `save_memory 参数无效: ${parsed.error.message}`;
      }
      const { content, metadata = {} } = parsed.data;
      const userId = runtime?.context?.userId ?? "unknown";
      const store = await getVectorStore();

      const doc = new Document({
        pageContent: content,
        metadata: { ...metadata, userId },
      });
      await store.addDocuments([doc]);
      // console.log(`[保存记忆] userId=${userId}, content=${content}`);
      return "好的我，我会记住这个。";
    } catch (error) {
      console.error("[保存记忆] 错误:", error);
      return `记忆保存失败: ${error.message}`;
    }
  },
  {
    name: "save_memory",
    description:
      "将用户提供的个人信息（如姓名、喜好、重要事件）保存到长期记忆库中。当用户明确告知值得记住的信息时使用。",
    schema: SaveMemorySchema,
  },
);

module.exports = { saveMemory };
