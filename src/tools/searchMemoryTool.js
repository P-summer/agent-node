const { tool } = require("langchain");
const { z } = require("zod");
const { getVectorStore } = require("../services/vectorStore");

const SearchMemorySchema = z.object({
  query: z.string().min(1).describe("需要检索的文本"),
  k: z.number().optional().describe("返回命中数"),
});

const searchMemory = tool(
  async (args, runtime) => {
    const parsed = SearchMemorySchema.safeParse(args);
    if (!parsed.success) {
      return `search_memory 参数无效: ${parsed.error.message}`;
    }
    const { query, k = 5 } = parsed.data;
    const userId = runtime?.context?.userId;
    const store = await getVectorStore();
    const results = await store.similaritySearch(query, k, { userId });
    // console.log("search_memory results:", results);
    if (!results || results.length === 0) return "没有找到相关信息。";
    return results
      .map((d, i) => `相关信息 ${i + 1}: ${d.pageContent}`)
      .join("\n\n");
  },
  {
    name: "search_memory",
    description:
      "【必须使用】当用户询问关于他们自己的任何个人信息（如名字、喜好、经历、背景、偏好）时，必须先调用此工具检索长期记忆。此工具返回与查询相关的历史记忆。",
    schema: SearchMemorySchema,
  },
);

module.exports = { searchMemory };
