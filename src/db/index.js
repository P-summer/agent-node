// db/index.js
const sequelize = require("./sequelize"); // 引入抽离后的实例
const { Sequelize } = require("sequelize");
const { database: dbConfig } = require("./config");
const models = require("./models");

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
