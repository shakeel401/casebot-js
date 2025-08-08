import { OpenAI } from "openai";
import { tavily } from "@tavily/core";
import isQuestionValid from "./filter.js";

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
    const body = JSON.parse(event.body || "{}");
    const query = (body.query || "").trim();
    let thread_id = body.thread_id;

    console.log("Received query:", query);
    console.log("Received thread_id:", thread_id);
    console.log("Type of thread_id before creation:", typeof thread_id);

    if (!query || !isQuestionValid(query)) {
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

    if (!OPENAI_API_KEY || !TAVILY_API_KEY || !VECTOR_STORE_ID || !ASSISTANT_ID) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing required environment variables" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const tavilyClient = tavily({ apiKey: TAVILY_API_KEY });

    async function tavilySearch(q) {
      try {
        const response = await tavilyClient.search(q);
        if (response.answer) return response.answer;
        const results = response.results || [];
        if (results.length > 0) {
          return results.map((r) => `${r.title}: ${r.url}`).join("\n");
        }
        return "No relevant results found on the web.";
      } catch (error) {
        return `Error performing Tavily search: ${error.message}`;
      }
    }

    if (!thread_id) {
      console.log("Creating new thread");
      const threadResponse = await client.beta.threads.create();
      console.log("New thread response full:", JSON.stringify(threadResponse, null, 2));
      if (typeof threadResponse === "string") {
        thread_id = threadResponse;
      } else if (threadResponse && typeof threadResponse.id === "string") {
        thread_id = threadResponse.id;
      } else if (threadResponse && threadResponse.data && typeof threadResponse.data.id === "string") {
        thread_id = threadResponse.data.id;
      } else {
        throw new Error("Cannot find valid thread_id");
      }
      console.log("Extracted thread_id:", thread_id);
    }

    console.log("Type of thread_id before adding message:", typeof thread_id);
    console.log("Value of thread_id:", thread_id);

    await client.beta.threads.messages.create({
      thread_id,
      role: "user",
      content: query,
    });

    let run = await client.beta.threads.runs.create_and_poll({
      thread_id,
      assistant_id: ASSISTANT_ID,
    });

    if (run.required_action?.type === "submit_tool_outputs") {
      const tool_outputs = [];
      for (const action of run.required_action.submit_tool_outputs.tool_calls) {
        const functionName = action.function.name;
        const args = JSON.parse(action.function.arguments);
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

      run = await client.beta.threads.runs.submit_tool_outputs_and_poll({
        thread_id,
        run_id: run.id,
        tool_outputs,
      });
    }

    const messagesResponse = await client.beta.threads.messages.list({
      thread_id,
    });

    const assistantMessages = messagesResponse.data.filter((m) => m.role === "assistant");

    if (assistantMessages.length === 0) {
      throw new Error("No response from assistant");
    }

    const assistantResponse = assistantMessages[0].content[0].text.value;

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
