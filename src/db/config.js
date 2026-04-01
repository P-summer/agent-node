// 强制校验核心环境变量，未配置则报错
const requiredEnv = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME"];
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`环境变量 ${key} 未配置`);
  }
});

module.exports = {
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT || "mysql",
    sync: process.env.DB_SYNC === "true", // 是否自动同步表结构
    timezone: "+08:00", // 设置时区为东八区
    define: {
      timestamps: true, // 自动添加 createdAt 和 updatedAt 字段
      underscored: true, // 驼峰转下划线
      charset: "utf8mb4", // 支持表情符号
      collate: "utf8mb4_unicode_ci",
    },
  },
};
