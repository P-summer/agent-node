// middlewares/errorHandler.js
const { errorResponse } = require("../utils/responseHandler");

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  return errorResponse(res, err.message || "服务器内部错误", 500, 500);
};

module.exports = errorHandler;
