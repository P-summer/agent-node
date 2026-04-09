/**
 * Chroma 向量数据库管理工具
 * 功能：
 *   - 列出所有集合
 *   - 查看集合内向量数量
 *   - 预览集合中的文档内容（ID、元数据、文档片段）
 *   - 删除整个集合（带二次确认）
 *   - 按元数据条件删除文档
 *
 * 使用方式：
 *   node scripts/operateChroma.js list
 *   node scripts/operateChroma.js count <集合名>
 *   node scripts/operateChroma.js peek <集合名> [limit]
 *   node scripts/operateChroma.js delete <集合名>
 *   node scripts/operateChroma.js delete-where <集合名> --where '{"source":"old.pdf"}'
 *
 * 环境变量：
 *   CHROMA_URL  - Chroma 服务地址（默认 http://localhost:8000）
 */

import { ChromaClient } from "chromadb";
import { parseArgs } from "node:util";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 配置：优先使用环境变量，否则默认本地地址
const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";

// 创建 Chroma 客户端
const chromaClient = new ChromaClient({ path: CHROMA_URL });

// 用于等待用户确认的 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * 询问用户是否继续
 * @param {string} question 问题
 * @returns {Promise<boolean>} true=确认，false=取消
 */
const askConfirm = (question) => {
  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close(); // 关闭 readline 接口，避免程序挂起
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
};

/**
 * 1. 列出所有集合
 */
const listCollections = async () => {
  try {
    const collections = await chromaClient.listCollections();
    const count = collections.length;
    console.log(`\n📚 当前共有 ${count} 个集合：`);
    if (count === 0) {
      console.log("   (空)");
    } else {
      collections.forEach((col, idx) => {
        console.log(`   ${idx + 1}. ${col.name}`);
      });
    }
    return collections;
  } catch (err) {
    console.error("❌ 列出集合失败：", err.message);
    process.exit(1);
  }
};

/**
 * 2. 获取指定集合的向量数量
 * @param {string} collectionName 集合名称
 */
const countCollection = async (collectionName) => {
  if (!collectionName) {
    console.error(
      "❌ 请提供集合名称，例如：node scripts/operateChroma.js count my_collection",
    );
    process.exit(1);
  }

  try {
    const collection = await chromaClient.getCollection({
      name: collectionName,
    });
    const count = await collection.count();
    console.log(`\n📊 集合「${collectionName}」中的向量数量：${count}`);
    return count;
  } catch (err) {
    if (
      err.message.includes("not found") ||
      err.message.includes("does not exist")
    ) {
      console.error(`❌ 集合「${collectionName}」不存在`);
    } else {
      console.error(`❌ 查询失败：`, err.message);
    }
    process.exit(1);
  }
};

/**
 * 3. 预览集合中的文档（ID、元数据、文档内容前 200 字符）
 * @param {string} collectionName 集合名称
 * @param {number} limit 显示条数（默认 10）
 */
const peekCollection = async (collectionName, limit = 10) => {
  if (!collectionName) {
    console.error(
      "❌ 请提供集合名称，例如：node scripts/operateChroma.js peek my_collection 5",
    );
    process.exit(1);
  }

  try {
    const collection = await chromaClient.getCollection({
      name: collectionName,
    });
    // 获取文档（不返回向量，节约输出）
    const result = await collection.get({ limit: limit });
    const { ids, metadatas, documents } = result;

    console.log(
      `\n🔍 预览集合「${collectionName}」前 ${ids.length} 条文档：\n`,
    );
    if (ids.length === 0) {
      console.log("   (集合为空)");
      return;
    }

    for (let i = 0; i < ids.length; i++) {
      console.log(`--- 文档 ${i + 1} ---`);
      console.log(`ID: ${ids[i]}`);
      if (metadatas && metadatas[i]) {
        console.log(`元数据: ${JSON.stringify(metadatas[i], null, 2)}`);
      } else {
        console.log(`元数据: (无)`);
      }
      if (documents && documents[i]) {
        const snippet =
          documents[i].length > 200
            ? documents[i].substring(0, 200) + "…"
            : documents[i];
        console.log(`文档内容: ${snippet}`);
      } else {
        console.log(`文档内容: (无)`);
      }
      console.log("");
    }
  } catch (err) {
    if (err.message.includes("not found")) {
      console.error(`❌ 集合「${collectionName}」不存在`);
    } else {
      console.error(`❌ 预览失败：`, err.message);
    }
    process.exit(1);
  }
};

/**
 * 4. 删除整个集合（带二次确认）
 * @param {string} collectionName 集合名称
 */
const deleteCollection = async (collectionName) => {
  if (!collectionName) {
    console.error("❌ 请提供要删除的集合名称");
    process.exit(1);
  }

  // 二次确认
  const confirmed = await askConfirm(
    `⚠️  确定要永久删除集合「${collectionName}」及其所有数据吗？此操作不可恢复！`,
  );
  if (!confirmed) {
    console.log("已取消删除操作。");
    process.exit(0);
  }

  try {
    await chromaClient.deleteCollection({ name: collectionName });
    console.log(`✅ 集合「${collectionName}」已成功删除。`);
  } catch (err) {
    if (err.message.includes("not found")) {
      console.error(`❌ 集合「${collectionName}」不存在，无需删除。`);
    } else {
      console.error(`❌ 删除失败：`, err.message);
    }
    process.exit(1);
  }
};

/**
 * 5. 按元数据条件删除文档（不删除集合）
 * @param {string} collectionName 集合名称
 * @param {object} whereCondition 元数据过滤条件，例如 { "source": "old.pdf" }
 */
const deleteDocumentsWhere = async (collectionName, whereCondition) => {
  if (!collectionName) {
    console.error("❌ 请提供集合名称");
    process.exit(1);
  }
  if (!whereCondition || typeof whereCondition !== "object") {
    console.error(
      '❌ 请提供有效的元数据条件，例如：--where \'{"source":"old.pdf"}\'',
    );
    process.exit(1);
  }

  // 预览将要删除的文档数量（可选）
  try {
    const collection = await chromaClient.getCollection({
      name: collectionName,
    });
    // 先查询符合条件的文档数量（仅用于提示）
    const preview = await collection.get({
      where: whereCondition,
      limit: 1000,
    });
    const count = preview.ids.length;
    if (count === 0) {
      console.log(
        `ℹ️ 没有找到满足条件 ${JSON.stringify(whereCondition)} 的文档，无需删除。`,
      );
      return;
    }

    console.log(`\n⚠️  找到 ${count} 条满足条件的文档：`);
    preview.ids
      .slice(0, 5)
      .forEach((id, idx) => console.log(`   ${idx + 1}. ${id}`));
    if (count > 5) console.log(`   ... 共 ${count} 条`);

    const confirmed = await askConfirm(
      `\n确定要删除这 ${count} 条文档吗？此操作不可恢复！`,
    );
    if (!confirmed) {
      console.log("已取消删除操作。");
      return;
    }

    // 执行删除
    await collection.delete({ where: whereCondition });
    console.log(
      `✅ 已删除满足条件 ${JSON.stringify(whereCondition)} 的 ${count} 条文档。`,
    );
  } catch (err) {
    if (err.message.includes("not found")) {
      console.error(`❌ 集合「${collectionName}」不存在`);
    } else {
      console.error(`❌ 删除失败：`, err.message);
    }
    process.exit(1);
  }
};

/**
 * 解析命令行参数并执行对应命令
 */
const main = async () => {
  // 获取不带 node 和脚本路径的参数列表
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    showHelp();
    return;
  }

  const command = rawArgs[0];

  // 处理需要额外参数的命令
  if (command === "list") {
    await listCollections();
  } else if (command === "count") {
    const collectionName = rawArgs[1];
    await countCollection(collectionName);
  } else if (command === "peek") {
    const collectionName = rawArgs[1];
    const limit = parseInt(rawArgs[2], 10);
    await peekCollection(collectionName, isNaN(limit) ? 10 : limit);
  } else if (command === "delete") {
    const collectionName = rawArgs[1];
    await deleteCollection(collectionName);
  } else if (command === "delete-where") {
    const collectionName = rawArgs[1];
    // 解析 --where JSON 参数
    let whereCondition = null;
    for (let i = 2; i < rawArgs.length; i++) {
      if (rawArgs[i] === "--where" && rawArgs[i + 1]) {
        try {
          whereCondition = JSON.parse(rawArgs[i + 1]);
        } catch (e) {
          console.error(
            '❌ --where 参数必须是合法的 JSON 对象，例如 \'{"source":"old.pdf"}\'',
          );
          process.exit(1);
        }
        break;
      }
    }
    if (!whereCondition) {
      console.error(
        '❌ 请提供 --where 参数，例如：--where \'{"source":"old.pdf"}\'',
      );
      process.exit(1);
    }
    await deleteDocumentsWhere(collectionName, whereCondition);
  } else {
    console.error(`❌ 未知命令: ${command}`);
    showHelp();
  }

  process.exit(0);
};

/**
 * 显示帮助信息
 */
const showHelp = () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║            Chroma 向量数据库管理工具                        ║
╚════════════════════════════════════════════════════════════╝

用法:
  node scripts/operateChroma.js <命令> [参数]

命令:
  list                                  列出所有集合
  count <集合名>                        查看集合中的向量数量
  peek <集合名> [limit]                 预览集合中的文档（默认 10 条）
  delete <集合名>                       删除整个集合（需要确认）
  delete-where <集合名> --where '{}'    按元数据条件删除文档

示例:
  node scripts/operateChroma.js list
  node scripts/operateChroma.js count codebase
  node scripts/operateChroma.js peek codebase 20
  node scripts/operateChroma.js delete old_collection
  node scripts/operateChroma.js delete-where user_memories --where '{"user_id":"123"}'

环境变量:
  CHROMA_URL    Chroma 服务地址，默认 http://localhost:8000

注意:
  - 删除操作前会要求二次确认，请谨慎操作。
  - delete-where 的 --where 参数必须是合法的 JSON 对象。
`);
};

// 执行主函数
main().catch((err) => {
  console.error("❌ 未捕获的错误：", err);
  process.exit(1);
});
