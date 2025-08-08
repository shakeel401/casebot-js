import { OpenAI } from "openai";
import { tavily } from "@tavily/core";
import isQuestionValid from "./filter.js";

function getThreadId(threadResponse) {
  if (typeof threadResponse === "string") return threadResponse;
  if (threadResponse == null) return null;
  if (typeof threadResponse.id === "string") return threadResponse.id;
  if (threadResponse.data && typeof threadResponse.data.id === "string") return threadResponse.data.id;
  throw new Error("Cannot find thread ID in threadResponse");
}

export async function handler(event, context) {
  console.log("Handler invoked");

  if (event.httpMethod !== "POST") {
    console.log("Invalid HTTP method:", event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    console.log("Parsing event body");
    const body = JSON.parse(event.body || "{}");
    const query = (body.query || "").trim();
    let thread_id = body.thread_id;

    console.log("Received query:", query);
    console.log("Received thread_id:", thread_id);

    if (!query || !isQuestionValid(query)) {
      console.log("Invalid or empty query");
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

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;
    const ASSISTANT_ID = process.env.ASSISTANT_ID;

    console.log("Env variables - OPENAI_API_KEY:", !!OPENAI_API_KEY,
                "TAVILY_API_KEY:", !!TAVILY_API_KEY,
                "VECTOR_STORE_ID:", !!VECTOR_STORE_ID,
                "ASSISTANT_ID:", !!ASSISTANT_ID);

    if (!OPENAI_API_KEY || !TAVILY_API_KEY || !VECTOR_STORE_ID || !ASSISTANT_ID) {
      console.error("Missing required environment variables");
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
        console.log("Calling tavily search for query:", q);
        const response = await tavilyClient.search(q);
        console.log("Tavily response:", response);

        if (response.answer) return response.answer;

        const results = response.results || [];
        if (results.length > 0) {
          return results.map((r) => `${r.title}: ${r.url}`).join("\n");
        }

        return "No relevant results found on the web.";
      } catch (error) {
        console.error("Error performing Tavily search:", error);
        return `Error performing Tavily search: ${error.message}`;
      }
    }

    if (!thread_id) {
      console.log("Creating new thread");
      const threadResponse = await client.beta.threads.create();
      console.log("New thread response:", JSON.stringify(threadResponse, null, 2));
      thread_id = getThreadId(threadResponse);
      console.log("Extracted thread_id:", thread_id);
    }

    console.log("Adding user message to thread");
    await client.beta.threads.messages.create({
      thread_id,
      role: "user",
      content: query,
    });

    console.log("Creating and polling run");
    let run = await client.beta.threads.runs.create_and_poll({
      thread_id,
      assistant_id: ASSISTANT_ID,
    });
    console.log("Run result:", run);

    if (run.required_action?.type === "submit_tool_outputs") {
      console.log("Run requires tool outputs submission");
      const tool_outputs = [];

      for (const action of run.required_action.submit_tool_outputs.tool_calls) {
        const functionName = action.function.name;
        const args = JSON.parse(action.function.arguments);
        console.log("Tool call function:", functionName, "args:", args);

        let result;
        if (functionName === "tavily_search") {
          result = await tavilySearch(args.query || "");
        } else {
          result = "Unknown tool requested.";
        }

        tool_outputs.push({
          tool_call_id: action.id,
          output: result,
        });
      }

      console.log("Submitting tool outputs:", tool_outputs);
      run = await client.beta.threads.runs.submit_tool_outputs_and_poll({
        thread_id,
        run_id: run.id,
        tool_outputs,
      });
      console.log("Run after submitting tool outputs:", run);
    }

    console.log("Fetching messages from thread");
    const messagesResponse = await client.beta.threads.messages.list({
      thread_id,
    });

    console.log("Messages fetched:", messagesResponse.data.length);
    const assistantMessages = messagesResponse.data.filter(
      (m) => m.role === "assistant"
    );

    console.log("Assistant messages found:", assistantMessages.length);

    if (assistantMessages.length === 0) {
      console.error("No response from assistant");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No response from assistant" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Extract assistant response
    const assistantResponse = assistantMessages[0].content[0].text.value;
    console.log("Assistant response:", assistantResponse);

    return {
      statusCode: 200,
      body: JSON.stringify({ thread_id, response: assistantResponse }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    console.error("Unhandled error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { "Content-Type": "application/json" },
    };
  }
}
