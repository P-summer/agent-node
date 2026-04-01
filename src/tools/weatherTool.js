const { tool } = require("langchain");
const { z } = require("zod");

const getWeather = tool(
  ({ location, unit = "摄氏度" }) =>
    `当前 ${location} 的天气是晴天，25${unit}，微风`,
  {
    name: "get_weather",
    description: "获取指定地点的天气信息，支持摄氏度和华氏度两种单位",
    schema: z.object({
      location: z.string().describe("要查询天气的城市名称"),
      unit: z.string().describe("温度单位，默认摄氏度"),
    }),
  },
);

module.exports = getWeather;
