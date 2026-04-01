const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../db/models");
const { successResponse, errorResponse } = require("../utils/responseHandler");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

const router = express.Router();

// 注册
router.post("/register", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        message: "请求体不能为空，请检查Content-Type是否为application/json",
      });
    }
    const { username, password } = req.body;

    const exists = await User.findOne({ where: { username } });
    if (exists) {
      return errorResponse(res, "用户名已存在", 400, 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashPwd = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      password: hashPwd,
    });

    return successResponse(
      res,
      { id: user.id, username: user.username },
      "注册成功",
    );
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "服务器错误" });
  }
});

// 登录
router.post("/login", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: "请求体不能为空，请检查Content-Type是否为application/json",
    });
  }
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return errorResponse(res, "用户名或密码错误", 401, 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse(res, "用户名或密码错误", 401, 401);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return successResponse(
      res,
      {
        token,
        user: { id: user.id, username: user.username },
      },
      "登录成功",
    );
  } catch (err) {
    console.log(err);
    return errorResponse(res, "服务器错误");
  }
});
// 获取当前用户信息（需携带 JWT Token）
router.get("/currentUser", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "未提供认证令牌", 401, 401);
    }
    const token = authHeader.split(" ")[1];

    // 2. 验证 token 并解析用户 ID
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // 3. 查询数据库，排除密码字段
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password"] }, // 不返回密码
    });

    if (!user) {
      return errorResponse(res, "用户不存在", 404, 404);
    }

    // 4. 返回用户信息
    return successResponse(res, { userInfo: user }, "获取用户信息成功");
  } catch (err) {
    // 区分 token 错误和服务器错误
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return errorResponse(res, "无效或过期的令牌", 401, 401);
    }
    console.error(err);
    return errorResponse(res, "服务器错误", 500, 500);
  }
});
// 退出登录
router.post("/logout", async (req, res) => {
  try {
    // 1. 从请求头获取 Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "未提供认证令牌", 401, 401);
    }
    const token = authHeader.split(" ")[1];

    // 2. 验证 Token 有效性（确保是合法用户发起的退出）
    jwt.verify(token, JWT_SECRET);

    // 3. JWT 无状态，无法使 token 失效，只需告知前端退出成功
    return successResponse(res, null, "退出成功");
  } catch (err) {
    // Token 无效或过期，仍然可以认为是“退出”了（但为了安全，统一返回错误）
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return errorResponse(res, "无效或过期的令牌", 401, 401);
    }
    console.error(err);
    return errorResponse(res, "服务器错误", 500, 500);
  }
});
module.exports = router;
