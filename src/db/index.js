// db/index.js
const sequelize = require("./sequelize"); // 引入抽离后的实例
const { Sequelize } = require("sequelize");
const { database: dbConfig } = require("./config");
const models = require("./models");

// 测试连接
// const testConnection = async () => {
//   try {
//     await sequelize.authenticate();
//     console.log("✅ MySQL 连接成功"); // 尝试连接数据库
//   } catch (err) {
//     console.error("❌ MySQL 连接失败:", err);
//     process.exit(1); // 连接失败则终止进程
//   }
// };
// testConnection();

// 同步模型
if (dbConfig.sync) {
  sequelize
    .sync({ force: false })
    .then(() => {
      console.log("✅ 模型同步完成");
    })
    .catch((err) => console.error("❌ 模型同步失败:", err));
}

module.exports = { sequelize, Sequelize, models };
