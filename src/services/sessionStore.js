// src/services/sessionStore.js
const { Conversation, Message } = require("../db/models");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");

/**
 * 初始化会话（如果sessionId不存在，则创建新会话）
 * @param {string} sessionId 前端传的会话ID（可自定义，或用数据库ID）
 * @param {number} userId 用户ID
 * @returns {Promise<number>} 数据库会话ID
 */
async function initConversation(sessionId, userId) {
  // 尝试通过sessionId（前端标识）找会话，没有则创建
  let conversation = await Conversation.findOne({
    where: { user_id: userId, ext_session_id: sessionId }, // 需给conversation表加ext_session_id字段（存储前端sessionId）
  });
  if (!conversation) {
    conversation = await Conversation.create({
      user_id: userId,
      title: "新对话",
      ext_session_id: sessionId, // 新增字段：存储前端传的sessionId，关联前后端会话
      status: 1,
    });
  }
  return conversation.id;
}

/**
 * 获取会话历史消息
 * @param {string} sessionId 前端会话ID
 * @param {number} userId 用户ID
 * @returns {Promise<Array>} 历史消息数组（LangChain Message格式）
 */
async function getHistory(sessionId, userId) {
  const conversationId = await initConversation(sessionId, userId);
  // 查询该会话的所有消息，按创建时间排序
  const messages = await Message.findAll({
    where: { conversation_id: conversationId, user_id: userId },
    order: [["created_at", "ASC"]],
  });
  // 转换为LangChain的Message格式
  return messages.map((msg) => {
    return msg.role === "user"
      ? new HumanMessage(msg.content)
      : new AIMessage(msg.content);
  });
}

/**
 * 保存单条消息到数据库
 * @param {string} sessionId 前端会话ID
 * @param {number} userId 用户ID
 * @param {Object} message LangChain Message对象（HumanMessage/AIMessage）
 */
async function addMessage(sessionId, userId, message) {
  const conversationId = await initConversation(sessionId, userId);
  const role = message._getType() === "human" ? "user" : "assistant";
  await Message.create({
    conversation_id: conversationId,
    user_id: userId,
    role,
    content: message.content,
  });
  await Conversation.update(
    { last_active_at: new Date() },
    { where: { id: conversationId } },
  );
}

/**
 * 批量设置历史消息（兼容旧逻辑，可选）
 */
async function setHistory(sessionId, userId, history) {
  const conversationId = await initConversation(sessionId, userId);
  // 先清空旧消息
  await Message.destroy({ where: { conversation_id: conversationId } });
  // 批量插入新消息
  const messageData = history.map((msg) => ({
    conversation_id: conversationId,
    user_id: userId,
    role: msg._getType() === "human" ? "user" : "assistant",
    content: msg.content,
  }));
  await Message.bulkCreate(messageData);
}
// 新增：更新会话标题
async function updateConversationTitle(sessionId, userId, title) {
  const conversationId = await initConversation(sessionId, userId);
  await Conversation.update(
    { title },
    { where: { id: conversationId, user_id: userId } },
  );
}

// 新增：判断会话是否是第一条消息
async function isFirstMessage(sessionId, userId) {
  const conversationId = await initConversation(sessionId, userId);
  const messageCount = await Message.count({
    where: { conversation_id: conversationId, user_id: userId },
  });
  // 只有消息数为0时，才是真正的第一条消息（还未保存任何内容）
  return messageCount === 0;
}
module.exports = {
  getHistory,
  setHistory,
  addMessage,
  initConversation,
  updateConversationTitle,
  isFirstMessage,
};
