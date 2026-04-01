const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { parse: parseVue } = require("@vue/compiler-sfc");

/**
 * 根据文件路径推断代码层（frontend / backend）
 */
function inferLayer(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (
    normalized.includes("/node-server/") ||
    normalized.includes("/backend/")
  ) {
    return "backend";
  }
  if (
    normalized.includes("/vue3-AI-agent/") ||
    normalized.includes("/frontend/")
  ) {
    return "frontend";
  }
  return "unknown";
}

/**
 * 推断模块名（如 services、routes、tools、components 等）
 */
function inferModule(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  // 常见的模块目录名
  const moduleKeywords = [
    "services",
    "routes",
    "tools",
    "controllers",
    "models",
    "views",
    "components",
    "stores",
    "utils",
  ];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (moduleKeywords.includes(parts[i])) {
      return parts[i];
    }
  }
  return "other";
}

/**
 * 解析 JS/TS 文件，按函数/类切分
 */
function parseJsFile(filePath, code, baseMetadata) {
  const chunks = [];
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      tokens: true,
      locations: true,
    });
  } catch (err) {
    console.error(`解析失败 ${filePath}:`, err.message);
    return []; // 返回空数组，让调用方继续处理其他文件
  }

  // 存储类节点信息（用于后续生成类整体块）
  const classNodes = new Map();

  traverse(ast, {
    ClassDeclaration(path) {
      const node = path.node;
      const { start, end } = node.loc;
      const className = node.id.name;
      classNodes.set(className, {
        startIdx: start.index,
        endIdx: end.index,
        startLine: start.line,
        endLine: end.line,
        body: node.body,
      });

      // 添加类整体块
      const classContent = code.slice(start.index, end.index);
      chunks.push({
        content: classContent,
        metadata: {
          ...baseMetadata,
          type: "class",
          name: className,
          startLine: start.line,
          endLine: end.line,
        },
      });
    },
    ClassMethod(path) {
      const node = path.node;
      const { start, end } = node.loc;
      const methodName = node.key.name;
      const className = path.parentPath.parent.id?.name; // 获取类名
      const methodContent = code.slice(start.index, end.index);
      chunks.push({
        content: methodContent,
        metadata: {
          ...baseMetadata,
          type: "method",
          name: methodName,
          className: className || "anonymous",
          startLine: start.line,
          endLine: end.line,
        },
      });
    },
    FunctionDeclaration(path) {
      const node = path.node;
      const { start, end } = node.loc;
      const funcName = node.id?.name || "anonymous";
      const content = code.slice(start.index, end.index);
      chunks.push({
        content,
        metadata: {
          ...baseMetadata,
          type: "function",
          name: funcName,
          startLine: start.line,
          endLine: end.line,
        },
      });
    },
    VariableDeclarator(path) {
      if (
        path.node.init &&
        (path.node.init.type === "ArrowFunctionExpression" ||
          path.node.init.type === "FunctionExpression")
      ) {
        const { start, end } = path.node.loc;
        const content = code.slice(start.index, end.index);
        chunks.push({
          content,
          metadata: {
            ...baseMetadata,
            type: "variable-function",
            name: path.node.id.name,
            startLine: start.line,
            endLine: end.line,
          },
        });
      }
    },
  });

  // 可选：添加文件整体块（包含整个文件的代码，便于全局检索）
  chunks.push({
    content: code,
    metadata: {
      ...baseMetadata,
      type: "file",
      name: path.basename(filePath),
    },
  });

  return chunks;
}

/**
 * 解析 Vue 文件
 */
function parseVueFile(filePath, code, baseMetadata) {
  const chunks = [];
  const { descriptor } = parseVue(code);

  // 组件整体块（如果需要）
  chunks.push({
    content: code,
    metadata: {
      ...baseMetadata,
      type: "vue-component",
      name: path.basename(filePath, ".vue"),
    },
  });

  if (descriptor.script || descriptor.scriptSetup) {
    const scriptContent =
      descriptor.script?.content || descriptor.scriptSetup?.content;
    if (scriptContent) {
      // 脚本整体块
      chunks.push({
        content: scriptContent,
        metadata: {
          ...baseMetadata,
          type: "vue-script",
        },
      });
      // 对脚本内容进行细粒度切分（复用 parseJsFile）
      const subChunks = parseJsFile(filePath, scriptContent, baseMetadata);
      subChunks.forEach((chunk) => {
        chunk.metadata.type = "vue-function"; // 区分类型
        chunk.metadata.isFromVue = true;
        chunks.push(chunk);
      });
    }
  }

  if (descriptor.template) {
    chunks.push({
      content: descriptor.template.content,
      metadata: {
        ...baseMetadata,
        type: "vue-template",
      },
    });
  }
  return chunks;
}

/**
 * 通用入口：根据文件扩展名调用对应解析器
 */
function chunkFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, "utf-8");
    const ext = path.extname(filePath).toLowerCase();
    const baseMetadata = {
      filePath,
      layer: inferLayer(filePath),
      module: inferModule(filePath),
      fullPath: filePath, // 用于精确定位
    };

    let chunks = [];
    if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
      chunks = parseJsFile(filePath, code, baseMetadata);
    } else if (ext === ".vue") {
      chunks = parseVueFile(filePath, code, baseMetadata);
    } else {
      chunks = chunkRaw(filePath, code, baseMetadata);
    }
    return chunks;
  } catch (err) {
    console.error(`读取或解析文件失败 ${filePath}:`, err.message);
    return [];
  }
}

function chunkRaw(filePath, code, baseMetadata) {
  const ext = path.extname(filePath).toLowerCase();
  const chunks = [];

  if (ext === ".json") {
    // JSON 文件整体存储，不切分
    chunks.push({
      content: code,
      metadata: { ...baseMetadata, type: "json" },
    });
  } else if (ext === ".md") {
    // Markdown 按标题切分（可选）
    const sections = splitMarkdownByHeadings(code);
    sections.forEach((section, idx) => {
      chunks.push({
        content: section.content,
        metadata: {
          ...baseMetadata,
          type: "markdown-section",
          heading: section.heading || `section-${idx}`,
        },
      });
    });
  } else {
    // 其他文本文件，按固定行数切分（但最好保留文件整体块）
    const lines = code.split("\n");
    const chunkSize = 200;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const startLine = i + 1;
      const endLine = Math.min(i + chunkSize, lines.length);
      const content = lines.slice(i, i + chunkSize).join("\n");
      chunks.push({
        content,
        metadata: {
          ...baseMetadata,
          type: "raw",
          startLine,
          endLine,
        },
      });
    }
  }
  return chunks;
}

function splitMarkdownByHeadings(content) {
  // 简单实现：按 # 标题分割
  const sections = [];
  const lines = content.split("\n");
  let currentHeading = "";
  let currentContent = [];
  for (const line of lines) {
    if (line.startsWith("#")) {
      if (currentContent.length) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
        currentContent = [];
      }
      currentHeading = line.replace(/^#+\s*/, "").trim();
      currentContent.push(line);
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n"),
    });
  }
  return sections;
}

module.exports = { chunkFile };
