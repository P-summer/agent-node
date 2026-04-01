/**
 * 成功响应
 * @param {Object} res - Express响应对象
 * @param {any} data - 响应数据
 * @param {string} message - 提示信息
 * @param {number} code - 自定义业务状态码（默认200）
 */
const successResponse = (
  res,
  data = null,
  message = "操作成功",
  code = 200,
) => {
  return res.status(200).json({
    code, // 业务状态码（200=成功）
    message, // 提示信息
    data, // 业务数据（null/对象/数组）
    success: true, // 布尔标识（方便前端快速判断）
  });
};

/**
 * 错误响应
 * @param {Object} res - Express响应对象
 * @param {string} message - 错误提示
 * @param {number} code - 自定义业务状态码（默认500）
 * @param {number} httpStatus - HTTP状态码（默认500）
 */
const errorResponse = (
  res,
  message = "服务器内部错误",
  code = 500,
  httpStatus = 500,
) => {
  return res.status(httpStatus).json({
    code,
    message,
    data: null,
    success: false,
  });
};

module.exports = { successResponse, errorResponse };
