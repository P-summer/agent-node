const express = require("express");
const router = express.Router();
const { Message } = require("../db/models");
const { successResponse, errorResponse } = require("../utils/responseHandler");
const sessionStore = require("../services/sessionStore");

// 获取会话的历史消息（分页）
router.get("/list", async (req, res) => {
  try {
    const { ext_session_id, page = 1, size = 50 } = req.query;
    const userId = req.userId;

    if (!ext_session_id) {
      return errorResponse(res, "会话ID不能为空", 400, 400);
    }

    // 获取数据库会话ID
    const conversationId = await sessionStore.initConversation(
      ext_session_id,
      userId,
    );
    const offset = (page - 1) * size;

    const { count, rows } = await Message.findAndCountAll({
      where: { conversation_id: conversationId, user_id: userId },
      order: [["created_at", "ASC"]],
      limit: size,
      offset,
    });

    return successResponse(
      res,
      {
        total: count,
        list: rows,
        page,
        size,
      },
      "获取历史消息成功",
    );
  } catch (error) {
    console.error("获取历史消息失败:", error);
    return errorResponse(res, "获取历史消息失败");
  }
});

module.exports = router;
