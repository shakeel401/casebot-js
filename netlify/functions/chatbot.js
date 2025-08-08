// netlify/functions/chatbot.js
import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;

function isQuestionValid(query) {
  const blockedWords = ["hack", "illegal", "kill"];
  return !blockedWords.some(word => query.toLowerCase().includes(word));
}

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

export async function handler(event) {
  console.log("📩 Function triggered:", event.httpMethod, event.body);

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    let bodyData;
    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    if (contentType.includes("application/json")) {
      bodyData = JSON.parse(event.body);
    } else {
      const params = new URLSearchParams(event.body);
      bodyData = Object.fromEntries(params);
    }

    const query = bodyData.query?.trim();
    let thread_id = bodyData.thread_id?.trim() || null;

    console.log("🔥 Received query:", query);
    console.log("🧵 Received thread_id:", thread_id);

    if (!query || !isQuestionValid(query)) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          thread_id,
          response: "This question is not appropriate or relevant. Please ask something based on your role or documents."
        })
      };
    }

    if (!ASSISTANT_ID || !VECTOR_STORE_ID) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing VECTOR_STORE_ID or ASSISTANT_ID" }) };
    }

    if (!thread_id) {
      const thread = await openai.beta.threads.create();
      thread_id = thread.id;
      console.log("✨ Created new thread:", thread_id);
    }

    await openai.beta.threads.messages.create({
      thread_id,
      role: "user",
      content: query
    });

    let run = await openai.beta.threads.runs.createAndPoll({
      thread_id,
      assistant_id: ASSISTANT_ID
    });

    if (run.required_action?.type === "submit_tool_outputs") {
      const tool_outputs = [];
      for (const action of run.required_action.submit_tool_outputs.tool_calls) {
        const { name: function_name, arguments: argsStr } = action.function;
        const args = JSON.parse(argsStr);
        let output = "Unknown tool";
        if (function_name === "tavily_search") {
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

    const messages = await openai.beta.threads.messages.list({ thread_id });
    const assistantMessages = messages.data.filter(m => m.role === "assistant");

    console.log("📨 Assistant messages:", JSON.stringify(assistantMessages, null, 2));

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
