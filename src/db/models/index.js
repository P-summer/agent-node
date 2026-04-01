const User = require("./user.model"); // 你现有用户表，需确保存在
const Conversation = require("./conversation.model");
const Message = require("./message.model");

// 建立关联
Conversation.hasMany(Message, { foreignKey: "conversation_id" }); //一个对话包含多条消息（Message） → hasMany
Message.belongsTo(Conversation, { foreignKey: "conversation_id" }); //一条消息属于一个对话 → belongsTo

User.hasMany(Conversation, { foreignKey: "user_id" });
Conversation.belongsTo(User, { foreignKey: "user_id" });

User.hasMany(Message, { foreignKey: "user_id" });
Message.belongsTo(User, { foreignKey: "user_id" });

module.exports = {
  User,
  Conversation,
  Message,
};
