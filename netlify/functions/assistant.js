const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
require("dotenv").config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_FILE = "/tmp/assistant_id.txt"; // or use local fallback if running locally

// 📘 Instructions prompt
const instructions = `
You are CaseBot, a legal assistant trained to answer legal questions using uploaded legal documents, general knowledge, and real-time web data through the \`tavily_search\` tool.
🧠 Here is how you should respond:
1. First, try to answer using uploaded documents (via file_search).
2. If information is not available in the documents, use your general legal knowledge.
3. If the user asks about recent laws, amendments, or current events (especially with dates like 2024, 2025, etc.), call the \`tavily_search\` tool to fetch real-time data from the internet.
📏 Follow these rules:
- For greetings like 'hi', introduce yourself warmly.
- For off-topic or casual questions, respond with: “I'm here to assist with legal or document-related questions.”
- For inappropriate questions, respond with: “This question cannot be answered.”
- Be clear, concise, and professional in all legal answers.
`;

// ✅ Get or create assistant
async function getOrCreateAssistant(vectorStoreId) {
  const envAssistantId = process.env.ASSISTANT_ID;
  if (envAssistantId) return envAssistantId;

  if (fs.existsSync(ASSISTANT_FILE)) {
    const cachedId = fs.readFileSync(ASSISTANT_FILE, "utf-8").trim();
    if (cachedId) return cachedId;
  }

  const assistant = await openai.beta.assistants.create({
    name: "Case Bot",
    instructions,
    model: "gpt-4o-mini",
    tools: [
      { type: "file_search" },
      {
        type: "function",
        function: {
          name: "tavily_search",
          description: "Search the web using Tavily for recent legal updates or external knowledge.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The question or search query to run on Tavily."
              }
            },
            required: ["query"]
          }
        }
      }
    ],
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStoreId]
      }
    }
  });

  fs.writeFileSync(ASSISTANT_FILE, assistant.id);
  return assistant.id;
}

module.exports = { getOrCreateAssistant };
