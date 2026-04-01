const { get_encoding } = require("@dqbd/tiktoken");

// 创建编码器（DeepSeek 使用 cl100k_base，与 gpt-4 相同）
let tokenizer = get_encoding("cl100k_base");

/**
 * 计算单个文本的 token 数量
 * @param {string} text
 * @returns {number}
 */
function countTextTokens(text) {
  return tokenizer.encode(text).length;
}

/**
 * 计算 LangChain 消息数组的总 token 数
 * @param {Array<BaseMessage>} messages
 * @returns {number}
 */
function countMessageTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += countTextTokens(msg.content);
    // 补充角色标识的 Token（human→"user"，assistant→"assistant"）
    const role = msg._getType() === "human" ? "user" : "assistant";
    total += countTextTokens(role);
  }
  return total;
}

/**
 * 按 token 数量修剪历史消息，保留最新的消息直到不超过 maxTokens
 * @param {Array<BaseMessage>} history - 原始历史消息（按时间升序，最早在前）
 * @param {number} maxTokens - 允许的最大 token 数
 * @param {Object} options
 * @param {boolean} options.allowPartial - 是否允许截断最后一条消息（此处暂不实现部分截断）
 * @returns {Array<BaseMessage>} 修剪后的历史消息
 */
function trimHistoryByTokens(
  history,
  maxTokens,
  options = { allowPartial: false },
) {
  // 从后往前累积 token，直到超过限制
  let total = 0;
  const trimmed = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTokens = countTextTokens(msg.content);
    if (total + msgTokens <= maxTokens) {
      total += msgTokens;
      trimmed.unshift(msg); // 从后往前加，保持原顺序
    } else {
      // 如果不允许部分截断，则停止添加
      if (options.allowPartial) {
        // 这里可扩展实现部分截断，但通常不截断单条消息
      }
      break;
    }
  }
  return trimmed;
}

/**
 * 使用 LangChain 内置的 trimMessages（更灵活，但需要传递 tokenCounter）
 * 这里作为可选导出
 */
const { trimMessages } = require("@langchain/core/messages");

async function trimWithLangChain(history, maxTokens) {
  return await trimMessages(history, {
    maxTokens,
    tokenCounter: countMessageTokens,
    strategy: "last", // 保留最后的消息
    allowPartial: false,
  });
}

module.exports = {
  countTextTokens,
  countMessageTokens,
  trimHistoryByTokens,
  trimWithLangChain,
};
