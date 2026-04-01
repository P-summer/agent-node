const sequelize = require("../sequelize");
const { Sequelize } = require("sequelize");

const Conversation = sequelize.define("conversation", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: { model: "users", key: "id" },
    onDelete: "CASCADE",
  },
  ext_session_id: {
    // 新增：存储前端传的sessionId（非数据库自增ID）
    type: Sequelize.STRING(100),
    allowNull: false,
    unique: true, // 确保前端sessionId唯一
  },
  title: {
    type: Sequelize.STRING(200),
    allowNull: false,
    defaultValue: "新对话",
  },
  status: {
    type: Sequelize.TINYINT,
    defaultValue: 1, // 1-活跃 0-归档
  },
  last_active_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
});

module.exports = Conversation;
