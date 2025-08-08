// netlify/functions/chatbot.js
import OpenAI from "openai";
import fetch from "node-fetch";

// ✅ Load environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;

// ❓ Validate if question is allowed
function isQuestionValid(query) {
  const blockedWords = ["hack", "illegal", "kill"];
  return !blockedWords.some(word => query.toLowerCase().includes(word));
}

// 🌐 Tavily Search
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

// 🚀 Netlify Function
export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    let bodyData;

    // Handle both JSON and form data
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

    // Validate question
    if (!query || !isQuestionValid(query)) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          thread_id,
          response: "This question is not appropriate or relevant. Please ask something based on your role or documents."
        })
      };
    }

    // Check required env vars
    if (!ASSISTANT_ID || !VECTOR_STORE_ID) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing VECTOR_STORE_ID or ASSISTANT_ID" })
      };
    }

    // Create thread if needed
    if (!thread_id) {
      const thread = await openai.beta.threads.create();
      thread_id = thread.id;
      console.log("✨ Created new thread:", thread_id);
    }

    // Send user message
    await openai.beta.threads.messages.create({
      thread_id,
      role: "user",
      content: query
    });

    // Run assistant
    let run = await openai.beta.threads.runs.createAndPoll({
      thread_id,
      assistant_id: ASSISTANT_ID
    });

    // Handle tools
    if (run.required_action?.type === "submit_tool_outputs") {
      const tool_outputs = [];

      for (const action of run.required_action.submit_tool_outputs.tool_calls) {
        const { name: function_name, arguments: argsStr } = action.function;
        const args = JSON.parse(argsStr);
        let output = "Unknown tool";

        if (function_name === "tavily_search") {
          output = await tavilySearch(args.query || "");
        }

        tool_outputs.push({
          tool_call_id: action.id,
          output
        });
      }

      run = await openai.beta.threads.runs.submitToolOutputsAndPoll({
        thread_id,
        run_id: run.id,
        tool_outputs
      });
    }

    // Get assistant's response
    const messages = await openai.beta.threads.messages.list({ thread_id });
    const assistantMessages = messages.data.filter(msg => msg.role === "assistant");

    if (!assistantMessages.length) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No response from assistant" })
      };
    }

    const finalResponse = assistantMessages[0].content[0].text.value;

    return {
      statusCode: 200,
      body: JSON.stringify({ thread_id, response: finalResponse })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
