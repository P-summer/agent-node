const sequelize = require("../sequelize");
const { Sequelize } = require("sequelize");

const Message = sequelize.define("message", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  conversation_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: { model: "conversations", key: "id" }, // 关联会话表
    onDelete: "CASCADE", // 会话删除则消息同步删除
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: { model: "users", key: "id" },
    onDelete: "CASCADE",
  },
  role: {
    // user/assistant/tool
    type: Sequelize.ENUM("user", "assistant", "tool"),
    allowNull: false,
  },
  content: {
    type: Sequelize.TEXT, // 支持长文本
    allowNull: false,
  },
  // 自动生成 create_time/update_time（依赖config.define.timestamps=true）
});

// 关联会话表（可选，方便查询）
Message.associate = (models) => {
  Message.belongsTo(models.Conversation, { foreignKey: "conversation_id" });
};

module.exports = Message;
