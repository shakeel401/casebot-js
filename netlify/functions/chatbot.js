import { OpenAI } from "openai";
import { tavily } from "@tavily/core";
import isQuestionValid from "./filter.js"; // Your local filter function

export async function handler(event, context) {
  console.log("[Handler] Invoked");

  if (event.httpMethod !== "POST") {
    console.log("[Handler] Invalid HTTP method:", event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    console.log("[Handler] Parsing event body");
    const body = JSON.parse(event.body || "{}");
    const query = (body.query || "").trim();
    let thread_id = body.thread_id;

    console.log("[Handler] Received query:", query);
    console.log("[Handler] Received thread_id:", thread_id);

    if (!query || !isQuestionValid(query)) {
      console.log("[Handler] Invalid or empty query");
      return {
        statusCode: 200,
        body: JSON.stringify({
          thread_id,
          response:
            "This question is not appropriate or relevant. Please ask something based on your role or documents.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;
    const ASSISTANT_ID = process.env.ASSISTANT_ID;

    console.log(
      "[Handler] Env vars - OPENAI_API_KEY:",
      !!OPENAI_API_KEY,
      "TAVILY_API_KEY:",
      !!TAVILY_API_KEY,
      "VECTOR_STORE_ID:",
      !!VECTOR_STORE_ID,
      "ASSISTANT_ID:",
      !!ASSISTANT_ID
    );

    if (!OPENAI_API_KEY || !TAVILY_API_KEY || !VECTOR_STORE_ID || !ASSISTANT_ID) {
      console.error("[Handler] Missing required environment variables");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing required environment variables" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Initialize clients
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const tavilyClient = tavily({ apiKey: TAVILY_API_KEY });

    async function tavilySearch(q) {
      try {
        console.log("[Handler] Calling tavily search for query:", q);
        const response = await tavilyClient.search(q);
        console.log("[Handler] Tavily response:", response);

        if (response.answer) return response.answer;

        const results = response.results || [];
        if (results.length > 0) {
          return results.map((r) => `${r.title}: ${r.url}`).join("\n");
        }

        return "No relevant results found on the web.";
      } catch (error) {
        console.error("[Handler] Error performing Tavily search:", error);
        return `Error performing Tavily search: ${error.message}`;
      }
    }

    // Create thread if missing
    if (!thread_id) {
      console.log("[Handler] Creating new thread");
      const thread = await client.beta.threads.create();
      thread_id = thread.id;
      console.log("[Handler] New thread created with id:", thread_id);
    }

    // Add user message to thread
    console.log("[Handler] Adding user message to thread");
    await client.beta.threads.messages.create(thread_id, {
      role: "user",
      content: query,
    });

    // Create and poll run
    console.log("[Handler] Creating and polling run");
    let run = await client.beta.threads.runs.createAndPoll(thread_id, {
      assistant_id: ASSISTANT_ID,
    });
    console.log("[Handler] Run result:", run);

    // Handle tool calls if needed
    if (run.required_action?.type === "submit_tool_outputs") {
      console.log("[Handler] Run requires tool outputs submission");

      const tool_outputs = await Promise.all(
        run.required_action.submit_tool_outputs.tool_calls.map(async (action) => {
          const functionName = action.function.name;
          const args = JSON.parse(action.function.arguments);
          console.log("[Handler] Tool call function:", functionName, "args:", args);

          let result;
          if (functionName === "tavily_search") {
            result = await tavilySearch(args.query || "");
          } else {
            result = "Unknown tool requested.";
          }

          return {
            tool_call_id: action.id,
            output: result,
          };
        })
      );

      console.log("[Handler] Submitting tool outputs:", tool_outputs);

      // **Important: Correct method and argument order here**
      run = await client.beta.threads.runs.submitToolOutputsAndPoll(
        thread_id,
        run.id,
        { tool_outputs }
      );

      console.log("[Handler] Run after submitting tool outputs:", run);
    }

    // Fetch assistant messages from thread
    console.log("[Handler] Fetching messages from thread");
    const messagesResponse = await client.beta.threads.messages.list(thread_id);
    console.log("[Handler] Messages fetched:", messagesResponse.data.length);

    const assistantMessages = messagesResponse.data.filter(
      (m) => m.role === "assistant"
    );

    console.log("[Handler] Assistant messages found:", assistantMessages.length);

    if (assistantMessages.length === 0) {
      console.error("[Handler] No response from assistant");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No response from assistant" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Extract assistant response text
    const assistantResponse = assistantMessages[0].content[0].text.value;
    console.log("[Handler] Assistant response:", assistantResponse);

    return {
      statusCode: 200,
      body: JSON.stringify({ thread_id, response: assistantResponse }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    console.error("[Handler] Unhandled error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { "Content-Type": "application/json" },
    };
  }
}
