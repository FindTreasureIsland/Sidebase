const MODEL_NAME = process.env.GEMINI_API_KEY ? "gemini-2.5-pro" : ""; // Default to empty if no API key
const API_KEY = process.env.GEMINI_API_KEY;
const LLM_RESPONSE_MODE = "summarize"; // Can be "search" or "summarize"

module.exports = {
  MODEL_NAME,
  API_KEY,
  LLM_RESPONSE_MODE,
};
