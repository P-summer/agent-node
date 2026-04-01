const { tool } = require("langchain");
const { z } = require("zod");

// 定义时间工具
const timeTool = tool(
  async (params) => {
    const { type } = params;
    const now = new Date();
    const result = {
      date: `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, "0")}月${String(now.getDate()).padStart(2, "0")}日`,
      weekday: [
        "星期日",
        "星期一",
        "星期二",
        "星期三",
        "星期四",
        "星期五",
        "星期六",
      ][now.getDay()],
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
    };
    // 根据 type 返回部分字段
    if (type === "current_date") return { date: result.date };
    if (type === "current_weekday") return { weekday: result.weekday };
    if (type === "current_time") return { time: result.time };
    return result;
  },
  {
    name: "get_current_time",
    description: `获取本地当前时间信息（无需联网），返回结构化数据。`,
    schema: z.object({
      type: z
        .enum(["current_time", "current_date", "current_weekday", "all"])
        .default("all"),
    }),
  },
);

module.exports = { timeTool };
