const jwt = require("jsonwebtoken");
const { errorResponse } = require("../utils/responseHandler");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * 登录态校验中间件：解析Token，挂载userId到req
 */
const authMiddleware = (req, res, next) => {
  try {
    // 从请求头获取Token（格式：Bearer <token>）
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "未登录，请先登录", 401, 401);
    }

    const token = authHeader.split(" ")[1];
    // 验证Token并解析payload
    const decoded = jwt.verify(token, JWT_SECRET);
    // console.log("decoded:", decoded);
    if (!decoded.id) {
      return errorResponse(res, "Token无效", 401, 401);
    }

    // 将用户ID挂载到req，后续接口可直接用 req.userId
    req.userId = decoded.id;
    next();
  } catch (error) {
    console.error("Token校验失败:", error);
    if (error.name === "TokenExpiredError") {
      return errorResponse(res, "Token已过期，请重新登录", 401, 401);
    }
    return errorResponse(res, "Token无效", 401, 401);
  }
};

module.exports = authMiddleware;
