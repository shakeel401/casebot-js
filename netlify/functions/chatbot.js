import { OpenAI } from "openai";
import { tavily } from "@tavily/core";
import isQuestionValid from "./filter.js";

const FIXED_THREAD_ID = "thread_81nIg7Kt2kgrkK1jwV6glOWr";

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const query = (body.query || "").trim();

    if (!query || !isQuestionValid(query)) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          thread_id: FIXED_THREAD_ID,
          response: "Invalid or inappropriate question.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    const ASSISTANT_ID = process.env.ASSISTANT_ID;

    if (!OPENAI_API_KEY || !TAVILY_API_KEY || !ASSISTANT_ID) {
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

    // Use the fixed thread id always
    const thread_id = FIXED_THREAD_ID;

    // Add user message
    await client.beta.threads.messages.create({
      thread_id,
      role: "user",
      content: query,
    });

    // Create and poll run
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

    // Fetch messages
    const messagesResponse = await client.beta.threads.messages.list({
      thread_id,
    });

    const assistantMessages = messagesResponse.data.filter(
      (m) => m.role === "assistant"
    );

    if (assistantMessages.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No response from assistant" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const assistantResponse = assistantMessages[0].content[0].text.value;

    return {
      statusCode: 200,
      body: JSON.stringify({ thread_id, response: assistantResponse }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { "Content-Type": "application/json" },
    };
  }
}
