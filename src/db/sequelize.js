// db/sequelize.js
const { Sequelize } = require("sequelize");
const { database: dbConfig } = require("./config");

// 单独初始化sequelize实例，不依赖任何模型
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.user,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    timezone: dbConfig.timezone,
    define: dbConfig.define,
    logging: process.env.NODE_ENV === "production" ? false : console.log,
    pool: { max: 5, min: 0 },
  },
);

module.exports = sequelize;
