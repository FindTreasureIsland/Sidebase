const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MODEL_NAME, API_KEY, LLM_RESPONSE_MODE } = require("./config");

// --- Configuration ---
const PORT = 3000;


// --- Path to Prompts ---
const EXTRACT_KEYWORDS_PROMPT_PATH = path.join(__dirname, '../extension/prompts/extract_keywords_prompt.txt');
const SIDEBAR_SEARCH_PROMPT_PATH = path.join(__dirname, '../extension/prompts/sidebar_search_prompt.txt');
const SIDEBAR_SUMMARIZE_PROMPT_PATH = path.join(__dirname, '../extension/prompts/sidebar_summarize_prompt.txt');


// --- Initialization ---
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Increase limit for page content


// --- Caching ---
const cache = new Map();


// --- Helper Functions ---
async function runPrompt(promptTemplatePath, replacements) {
  try {
    let promptTemplate = await fs.readFile(promptTemplatePath, "utf-8");
    let prompt = promptTemplate;
    for (const key in replacements) {
      prompt = prompt.replace(`{${key}}`, replacements[key]);
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response to extract the JSON part
    const jsonMatch = text.match(/```json([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    // Fallback for when the model doesn't use markdown
    return JSON.parse(text.trim());

  } catch (error) {
    console.error("Error running prompt:", error);
    // Re-throw with more specific error information
    if (error.status === 429) {
      const newError = new Error("You have exceeded your API quota. Please check your plan and billing details.");
      newError.type = 'quota_exceeded';
      throw newError;
    }
    throw new Error("Failed to process request with the generative model.");
  }
}

// --- API Endpoints ---

/**
 * Endpoint to extract keywords from a given block of text.
 * Expects a POST request with a JSON body: { "text": "..." }
 */
app.post("/api/extract-keywords", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text content is required." });
  }

  const cacheKey = `extract-keywords:${crypto.createHash('md5').update(text).digest('hex')}`;
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  try {
    const keywords = await runPrompt(EXTRACT_KEYWORDS_PROMPT_PATH, { page_content: text });
    cache.set(cacheKey, keywords);
    res.json(keywords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint to search for information about a keyword.
 * Expects a POST request with a JSON body: { "q": "..." }
 */
app.get("/api/search", async (req, res) => {
  const q = req.query.q || "";
  if (!q) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  const cacheKey = `search-stream:${LLM_RESPONSE_MODE}:${q}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Helper to simulate streaming from a cached text
  const streamFromCache = (text) => {
    const chunks = text.match(/.{1,5}/g) || []; // Split text into small chunks
    let i = 0;
    const interval = setInterval(() => {
      if (i < chunks.length) {
        res.write(`data: ${JSON.stringify({ token: chunks[i] })}\n\n`);
        i++;
      } else {
        clearInterval(interval);
        res.write(`event: end\ndata: Stream ended from cache.\n\n`);
        res.end();
      }
    }, 20); // 20ms delay between chunks to simulate streaming
  };

  if (cache.has(cacheKey)) {
    streamFromCache(cache.get(cacheKey));
    return;
  }

  try {
    let promptPath;
    if (LLM_RESPONSE_MODE === "summarize") {
      promptPath = SIDEBAR_SUMMARIZE_PROMPT_PATH;
    } else {
      promptPath = SIDEBAR_SEARCH_PROMPT_PATH;
    }
    
    const promptTemplate = await fs.readFile(promptPath, "utf-8");
    const prompt = promptTemplate.replace(`{keyword}`, q);

    const result = await model.generateContentStream(prompt);

    let fullText = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      res.write(`data: ${JSON.stringify({ token: chunkText })}\n\n`);
    }

    // Validate the stream's finish reason
    const finalResponse = await result.response;
    const finishReason = finalResponse.candidates[0].finishReason;
    if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
      throw new Error(`The stream ended unexpectedly due to: ${finishReason}`);
    }

    cache.set(cacheKey, fullText); // Save the full response to cache

    res.write(`event: end\ndata: Stream ended successfully.\n\n`);

  } catch (error) {
    console.error("Error in search stream:", error);
    const errorMessage = error.message || "An unknown error occurred.";
    res.write(`event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`);
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});


// --- Server Start ---
app.listen(PORT, () =>
  console.log(`Sidebase Gemini server running at http://localhost:${PORT}`)
);