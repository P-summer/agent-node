const {
  BaseChatModel,
} = require("@langchain/core/language_models/chat_models");
const {
  AIMessage,
  HumanMessage,
  SystemMessage,
} = require("@langchain/core/messages");
const axios = require("axios");
const { z } = require("zod");

class ChatDoubao extends BaseChatModel {
  constructor(options = {}) {
    super(options);
    this.apiUrl = process.env.DOUBAO_API_URL;
    this.apiKey = process.env.DOUBAO_API_KEY;
    this.model = process.env.DOUBAO_MODEL;
    this.temperature = options.temperature ?? 0.7;
    this.boundTools = [];
  }

  _llmType() {
    return "chat-doubao";
  }

  bindTools(tools, kwargs = {}) {
    this.boundTools = tools;
    return this;
  }

  /**
   * 将 LangChain 工具转换为豆包 API 所需的 tools 格式
   */
  _convertToDoubaoTools(langchainTools) {
    return langchainTools.map((tool) => {
      let parameters = tool.schema;
      // 如果 schema 是 Zod 对象（有 _def 属性），则转换为 JSON Schema
      if (parameters && typeof parameters === "object" && parameters._def) {
        parameters = z.object(parameters).toJSON();
      }
      // 扁平结构：添加 type 字段（关键修复），值固定为 function
      return {
        type: "function", // 新增：豆包API要求的工具类型
        name: tool.name,
        description: tool.description,
        parameters: parameters,
      };
    });
  }

  /**
   * 辅助函数：将消息内容统一转为字符串
   * LangChain 消息的 content 可能是字符串或数组（多模态），这里简单提取文本
   */
  _extractContent(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      // 假设数组元素都是文本类型，提取 text 字段拼接
      return content.map((item) => item.text || "").join("");
    }
    return String(content);
  }

  async _generate(messages, options = {}) {
    try {
      // 1. 转换消息格式
      const doubaoMessages = messages.map((msg) => {
        let role = "user";
        let content = this._extractContent(msg.content);
        let name = undefined;

        if (msg instanceof SystemMessage) {
          role = "system";
        } else if (msg instanceof HumanMessage) {
          role = "user";
        } else if (msg instanceof AIMessage) {
          role = "assistant";
          // 如果 content 为空，提供一个默认内容（豆包 API 可能不允许空字符串）
          if (!content || content.trim() === "") {
            content = " "; // 使用空格作为占位符
          }
        } else if (msg._getType && msg._getType() === "tool") {
          role = "user"; // 豆包 API 不支持 tool/function，伪装成 user
          const toolName = msg.name || "unknown_tool";
          content = `[工具 ${toolName} 返回]: ${content}`;
          // 如果豆包API支持user消息带name字段，可以保留；否则注释掉
          // name = toolName;
        }

        const result = { role, content };
        if (name) {
          result.name = name;
        }
        return result;
      });

      // 2. 构建请求体
      const requestBody = {
        model: this.model,
        input: doubaoMessages,
        temperature: this.temperature,
      };

      // 如果有绑定的工具，添加到请求中
      if (this.boundTools && this.boundTools.length > 0) {
        requestBody.tools = this._convertToDoubaoTools(this.boundTools);
      }

      // 3. 调用豆包 API
      const response = await axios.post(this.apiUrl, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const data = response.data;

      // 4. 解析返回结果（兼容豆包实际返回格式）
      // 根据你之前的 DoubaoLLM，返回结构可能是 { output: [...] }
      let content = "";
      let toolCalls = [];

      if (data.output && Array.isArray(data.output)) {
        // 查找 type 为 "message" 的输出项
        const messageOutput = data.output.find(
          (item) => item.type === "message",
        );
        if (messageOutput && messageOutput.content) {
          content = messageOutput.content.map((c) => c.text).join("");
        }

        // 查找 type 为 "function_call" 的输出项（工具调用）
        const functionCallOutput = data.output.find(
          (item) => item.type === "function_call",
        );
        if (functionCallOutput) {
          toolCalls = [
            {
              id: functionCallOutput.call_id,
              name: functionCallOutput.name,
              args: JSON.parse(functionCallOutput.arguments), //"{\"location\": \"深圳\", \"unit\": \"摄氏度\"}"
            },
          ];
        }
      } else if (data.choices && data.choices[0]) {
        // 兼容 OpenAI 格式（部分豆包版本可能支持）
        const message = data.choices[0].message;
        content = message.content || "";
        toolCalls = (message.tool_calls || []).map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          args: tc.function.arguments,
        }));
      } else {
        throw new Error(`无法识别的返回格式: ${JSON.stringify(data)}`);
      }

      // 5. 构建 AIMessage，可能包含 tool_calls
      const aimessage = new AIMessage({
        content: content,
        tool_calls: toolCalls,
      });

      // 6. 返回 LangChain 标准格式
      return {
        generations: [
          {
            text: content,
            message: aimessage,
          },
        ],
      };
    } catch (error) {
      console.error(
        "豆包API调用详细错误:",
        error.response?.data || error.message,
      );
      throw new Error(`豆包API调用失败: ${error.message}`);
    }
  }
}

module.exports = { ChatDoubao };
