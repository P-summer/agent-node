const { tool } = require("langchain");
const { z } = require("zod");
const { getCodeVectorStore } = require("../services/vectorStore");

const SearchCodeSchema = z.object({
  query: z.string(),
  k: z.number().optional(),
  layer: z.enum(["frontend", "backend"]).optional(),
  module: z.string().optional(),
  type: z.enum(["function", "class", "method", "vue-component"]).optional(),
});

const searchCode = tool(
  async (args, runtime) => {
    const parsed = SearchCodeSchema.safeParse(args);
    if (!parsed.success) {
      return `search_code 参数无效: ${parsed.error.message}`;
    }
    const { query, k = 5 } = parsed.data;
    const store = await getCodeVectorStore();

    // 1. 构建过滤条件数组
    const filters = [];
    if (args.layer) filters.push({ layer: args.layer });
    if (args.module) filters.push({ module: args.module });
    if (args.type) filters.push({ type: args.type });

    // 2. 根据条件数量动态生成 filter 对象
    let filter = undefined; // 默认不传 filter
    if (filters.length === 1) {
      filter = filters[0];
    } else if (filters.length > 1) {
      filter = { $and: filters }; // 多个条件必须用 $and 包裹
    }

    const results = await store.similaritySearch(query, k, filter);
    if (!results || results.length === 0) {
      return "未找到相关代码片段。";
    }
    return results
      .map((doc, idx) => {
        const meta = doc.metadata;
        return `【结果 ${idx + 1}】\n文件：${meta.filePath}\n类型：${meta.type}${meta.name ? ` 名称：${meta.name}` : ""}\n代码：\n\`\`\`\n${doc.pageContent}\n\`\`\``;
      })
      .join("\n\n---\n\n");
  },
  {
    name: "search_code",
    description:
      "检索项目代码库，获取相关代码片段。当用户询问关于代码实现、模块联动、优化建议、实现原理、技术细节等问题时，必须使用此工具。",
    schema: SearchCodeSchema,
  },
);

module.exports = { searchCode };
