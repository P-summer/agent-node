// db/models/user.model.js
const sequelize = require("../sequelize"); // 改为引入单独的sequelize实例
const { Sequelize } = require("sequelize"); // 直接从sequelize包引入构造函数

const User = sequelize.define("user", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: Sequelize.STRING(50),
    unique: true,
    allowNull: false,
  },
  password: {
    type: Sequelize.STRING(100),
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING(100),
    unique: true,
    allowNull: true,
  },
  status: {
    type: Sequelize.TINYINT,
    defaultValue: 1,
  },
});

module.exports = User;
