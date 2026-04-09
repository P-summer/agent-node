# AI Agent Server
基于 Node.js 开发的 AI Agent 后端服务，核心依托 LangChain + LangGraph 构建，提供多大语言模型兼容、多执行模式、完善的记忆管理体系与丰富的工具调用能力，同时支持代码库 RAG（检索增强生成）、会话长度管控等企业级特性。

## 🌟 核心特性
### 1. 多LLM兼容适配
- 支持 DeepSeek、豆包 大语言模型，完全兼容 OpenAI API 格式（ChatOpenAI 规范），可无缝切换不同 LLM 提供商
- 底层基于 LangChain 封装，降低多模型接入与切换成本

### 2. 灵活的Agent执行模式
- 实现 ReAct（Reasoning + Acting）推理执行范式，通过「推理-行动-观察」循环处理动态任务
- 支持 Planner 规划式执行模式，先拆解任务步骤再执行，适配复杂场景

### 3. 完善的会话记忆体系
- 流式输出：实时返回 AI 响应结果，提升交互体验
- 短期记忆：维护会话上下文，保障多轮对话的连贯性
- 长期记忆：基于 Chroma 向量数据库实现，跨会话窗口可查询关联记忆

### 4. 丰富的工具集扩展
| 工具名称          | 功能说明                                                                 |
|-------------------|--------------------------------------------------------------------------|
| 时间工具          | 提供时间查询、格式转换等基础时间操作                                     |
| 长期记忆工具      | 封装 Chroma 操作，实现长期记忆的存储、查询、更新、删除                   |
| Google SERPER 工具 | 集成 Google SERPER 接口，获取全网实时信息，补充 Agent 实时数据能力        |
| searchCodeTool    | 代码库 RAG 工具，从 Chroma 向量库检索后端代码片段（检索增强生成）        |

### 5. 会话管控与资源限制
- 基于 Token 计数限制会话长度，避免无限制对话导致的资源消耗与性能问题

### 6. 代码库向量化管理
- 支持将后端代码拆分、切片后存储到 Chroma 向量库
- 提供专用脚本实现 Chroma 数据库的操作与维护

## 🛠️ 技术栈
| 分类         | 核心依赖/工具                                                                 |
|--------------|------------------------------------------------------------------------------|
| 运行环境     | Node.js（建议 v18+）、pnpm                                                   |
| Web 框架     | Express                                                                      |
| AI Agent 核心 | LangChain（@langchain/core / @langchain/community / langchain）、LangGraph    |
| 向量数据库   | ChromaDB（chromadb）                                                         |
| 工具类       | axios（HTTP 请求）、tiktoken（Token 计算）、glob（文件遍历）、zod（校验）     |
| 开发工具     | nodemon（热重载）、TypeScript（类型支持）、ts-node                            |

## 🚀 快速开始

### 1. 环境准备
- 安装 Node.js（v18+）与 pnpm：`npm install -g pnpm`
- 复制并配置环境变量文件 `.env`（根据实际场景补充）：

### 2. 安装依赖
```bash
# 安装依赖
pnpm install
```

### 3. 启动服务
```bash
# 开发环境（热重载）
pnpm dev

# 生产环境
pnpm start
```

## 📜 核心脚本说明
项目内置便捷脚本（对应 package.json），通过 pnpm 执行：

| 脚本名                | 执行文件                  | 功能说明                                                                 |
|-----------------------|---------------------------|--------------------------------------------------------------------------|
| `pnpm dev`            | index.js                  | 启动开发服务器（nodemon 热重载）                                         |
| `pnpm start`          | index.js                  | 启动生产服务器                                                           |
| `pnpm index-codebase` | scripts/indexCodebase.js  | 将后端代码按规则拆分、生成向量并存储到 Chroma（代码库 RAG 初始化）        |
| `pnpm clear-old-chroma` | scripts/operateChroma.js | 操作 Chroma 数据库（如清理旧记忆、删除无效集合、初始化集合等）            |

## 📌 核心模块详解
### 1. Agent 执行引擎
- **ReAct 模式**：面向动态决策场景，Agent 先推理下一步行动，执行后观察结果，循环直至完成任务
- **Planner 模式**：面向复杂任务，先拆解任务为多个子步骤，再按步骤调用工具/LLM 执行

### 2. 记忆管理
- **短期记忆**：基于内存缓存维护当前会话上下文，随会话生命周期销毁
- **长期记忆**：将会话关键信息转为向量存储到 Chroma，`searchCodeTool` 可跨会话检索相关记忆

### 3. 代码库 RAG 能力
- 执行 `pnpm index-codebase` 时，脚本会遍历后端代码文件，按语法/文件拆分片段，通过嵌入模型生成向量后写入 Chroma
- 业务侧调用 `searchCodeTool` 时，会检索向量库中与查询最相关的代码片段，拼接至 Prompt 实现「检索增强生成」

### 4. Chroma 数据库操作
- `scripts/operateChroma.js`：封装 Chroma 常用操作（创建集合、删除集合、清理过期数据、批量导入/导出）
- `scripts/indexCodebase.js`：定制化代码拆分逻辑（按文件、函数、类拆分），适配代码检索的精准性需求

## 📋 扩展与优化方向
- 支持更多 LLM 提供商（如智谱、讯飞、通义千问等）
- 优化代码拆分策略（基于 AST 语法分析），提升 RAG 检索精度
- 增加 Agent 多工具并行调用能力
- 完善会话鉴权、日志监控、异常兜底机制
- 支持 Chroma 向量库的分片与备份

## 📄 许可证
ISC（与项目 package.json 许可证一致）