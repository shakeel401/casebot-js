// netlify/functions/chatbot.js
import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;

// ❌ Block invalid questions
function isQuestionValid(query) {
  const blockedWords = ["hack", "illegal", "kill"];
  return !blockedWords.some(word => query.toLowerCase().includes(word));
}

// 🔍 Tavily Search
async function tavilySearch(query) {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        include_answer: true,
        include_raw_content: false
      })
    });
    const data = await response.json();
    return data?.answer || "No relevant results found.";
  } catch (error) {
    console.error("Tavily search error:", error);
    return "Error fetching search results.";
  }
}

// 🛠 Normalize thread_id so it's always a string
function normalizeThreadId(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object") {
    if (raw.id && typeof raw.id === "string") return raw.id.trim();
    const firstVal = Object.values(raw)[0];
    if (typeof firstVal === "string") return firstVal.trim();
  }
  return String(raw).trim();
}

export async function handler(event) {
  console.log("📩 Function triggered:", event.httpMethod);

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    // 📦 Parse request
    let bodyData;
    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    if (contentType.includes("application/json")) {
      bodyData = JSON.parse(event.body);
    } else {
      const params = new URLSearchParams(event.body);
      bodyData = Object.fromEntries(params);
    }

    console.log("📥 Raw body:", bodyData);

    const query = (bodyData.query || "").trim();
    let thread_id = normalizeThreadId(bodyData.thread_id);

    console.log("🔥 Query:", query);
    console.log("🧵 thread_id after normalize:", thread_id, "type:", typeof thread_id);

    // ❌ Block invalid
    if (!query || !isQuestionValid(query)) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          thread_id,
          response: "This question is not appropriate or relevant. Please ask something based on your role or documents."
        })
      };
    }

    // 🛑 Check required env
    if (!ASSISTANT_ID || !VECTOR_STORE_ID) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing VECTOR_STORE_ID or ASSISTANT_ID" }) };
    }

    // ➕ Create thread if missing
    if (!thread_id) {
      const thread = await openai.beta.threads.create();
      thread_id = String(thread.id).trim();
      console.log("✨ New thread created:", thread_id);
    }

    // 💬 Send user message
    console.log("📌 Sending to OpenAI with thread_id =", thread_id);
    await openai.beta.threads.messages.create({
      thread_id,
      role: "user",
      content: query
    });

    // 🚀 Run assistant
    let run = await openai.beta.threads.runs.createAndPoll({
      thread_id,
      assistant_id: ASSISTANT_ID
    });

    // 🛠 Handle tools
    if (run.required_action?.type === "submit_tool_outputs") {
      const tool_outputs = [];
      for (const action of run.required_action.submit_tool_outputs.tool_calls) {
        const { name: fnName, arguments: argsStr } = action.function;
        const args = JSON.parse(argsStr);
        let output = "Unknown tool";

        if (fnName === "tavily_search") {
          output = await tavilySearch(args.query || "");
        }

        tool_outputs.push({ tool_call_id: action.id, output });
      }

      run = await openai.beta.threads.runs.submitToolOutputsAndPoll({
        thread_id,
        run_id: run.id,
        tool_outputs
      });
    }

    // 📩 Get assistant reply
    const messages = await openai.beta.threads.messages.list({ thread_id });
    const assistantMessages = messages.data.filter(m => m.role === "assistant");

    const finalResponse = assistantMessages
      .flatMap(m => m.content)
      .map(c => c?.text?.value || "")
      .join("\n")
      .trim();

    return {
      statusCode: 200,
      body: JSON.stringify({
        thread_id,
        response: finalResponse || "⚠️ Assistant did not return a message."
      })
    };

  } catch (error) {
    console.error("💥 Error in chatbot function:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
