class LocalEmbeddings {
  constructor() {
    this.dimension = 384; // 对应 all-MiniLM-L6-v2 的维度 mock 实现，生成固定维度的伪向量
  }

  // 生成伪向量的私有方法
  _generateFakeVector(text) {
    // 计算简单的字符哈希总和
    const charCodeSum = text
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(this.dimension)
      .fill(0)
      .map((_, i) => Math.sin(i + charCodeSum + text.length));
  }

  // 模拟批量生成
  async embedDocuments(texts) {
    // console.log(`[Mock] 正在为 ${texts.length} 条文本生成伪向量...`);
    return texts.map((text) => this._generateFakeVector(text));
  }

  // 模拟查询生成
  async embedQuery(text) {
    // console.log(`[Mock] 正在为查询生成伪向量...`);
    return this._generateFakeVector(text);
  }
}

module.exports = LocalEmbeddings;
