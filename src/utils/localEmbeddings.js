const {
  HuggingFaceTransformersEmbeddings,
} = require("@langchain/community/embeddings/huggingface_transformers");

const localEmbeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

module.exports = { localEmbeddings };
