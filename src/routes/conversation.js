const express = require("express");
const router = express.Router();
const { Conversation, Message } = require("../db/models");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// 1. 创建会话（前端新建对话时调用）
router.post("/create", async (req, res) => {
  try {
    const { ext_session_id, title = "新对话" } = req.body;
    const userId = req.userId;

    if (!ext_session_id) {
      return errorResponse(res, "会话ID不能为空", 400, 400);
    }

    // 检查是否已存在相同ext_session_id的会话
    const exists = await Conversation.findOne({
      where: { ext_session_id, user_id: userId },
    });
    if (exists) {
      return successResponse(res, exists, "会话已存在");
    }

    const conversation = await Conversation.create({
      user_id: userId,
      ext_session_id,
      title,
      status: 1,
    });

    return successResponse(res, conversation, "会话创建成功");
  } catch (error) {
    console.error("创建会话失败:", error);
    return errorResponse(res, "创建会话失败");
  }
});

// 2. 获取用户会话列表（分页）
router.get("/list", async (req, res) => {
  try {
    const { page = 1, size = 20 } = req.query;
    const userId = req.userId;

    const offset = (page - 1) * size;
    const { count, rows } = await Conversation.findAndCountAll({
      where: { user_id: userId, status: 1 }, // 只查活跃会话
      order: [["last_active_at", "DESC"]],
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
      "获取会话列表成功",
    );
  } catch (error) {
    console.error("获取会话列表失败:", error);
    return errorResponse(res, "获取会话列表失败");
  }
});

// 3. 获取会话详情（含基础信息，不含消息）
router.get("/info/ext_session_id", async (req, res) => {
  try {
    const { ext_session_id } = req.params;
    const userId = req.userId;

    const conversation = await Conversation.findOne({
      where: { ext_session_id, user_id: userId },
    });
    if (!conversation) {
      return errorResponse(res, "会话不存在", 404, 404);
    }

    return successResponse(res, conversation, "获取会话详情成功");
  } catch (error) {
    console.error("获取会话详情失败:", error);
    return errorResponse(res, "获取会话详情失败");
  }
});

// 4. 重命名会话
router.post("/rename", async (req, res) => {
  try {
    const { ext_session_id, title } = req.body;
    const userId = req.userId;

    if (!ext_session_id || !title) {
      return errorResponse(res, "会话ID和标题不能为空", 400, 400);
    }

    const conversation = await Conversation.findOne({
      where: { ext_session_id, user_id: userId },
    });
    if (!conversation) {
      return errorResponse(res, "会话不存在", 404, 404);
    }

    await conversation.update({ title });
    return successResponse(res, conversation, "会话重命名成功");
  } catch (error) {
    console.error("重命名会话失败:", error);
    return errorResponse(res, "重命名会话失败");
  }
});

// 5. 删除会话（逻辑删除/物理删除，这里用逻辑删除）
router.post("/delete", async (req, res) => {
  try {
    const { ext_session_id } = req.body;
    const userId = req.userId;

    const conversation = await Conversation.findOne({
      where: { ext_session_id, user_id: userId },
    });
    if (!conversation) {
      return errorResponse(res, "会话不存在", 404, 404);
    }

    // 逻辑删除：修改status为0，或新增deleted字段
    // await conversation.update({ status: 0 });
    // 物理删除 同时删除消息
    await conversation.destroy();
    await Message.destroy({ where: { conversation_id: conversation.id } });

    return successResponse(res, null, "会话删除成功");
  } catch (error) {
    console.error("删除会话失败:", error);
    return errorResponse(res, "删除会话失败");
  }
});

module.exports = router;
