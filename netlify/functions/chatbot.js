import { OpenAI } from "openai";
import { tavily } from "@tavily/core";

// Inline filter function
function isQuestionValid(userInput) {
  const bannedKeywords = [
    "joke", "funny", "lol", "haha", "laugh",
    "crush", "kiss", "hug", "flirt",
    "dating", "sex",
    "boyfriend", "girlfriend",
    "do you love me", "tell me a joke", "marry me", "i love you",
    "chat with me", "best friend", "are you single", "romantic", "cute"
  ];

  const userInputLower = userInput.toLowerCase();
  for (const word of bannedKeywords) {
    if (userInputLower.includes(word)) {
      return false;
    }
  }
  return true;
}

// Remove citations like   or [4:0†source]
function removeCitations(text) {
  return text
    .replace(/【\d+:\d+†[^】]+】/g, "") // match any characters until the closing 】
    .replace(/\[\d+:\d+†[^\]]+\]/g, ""); // match any characters until the closing ]
}

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
    let thread_id = body.thread_id;

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
      const thread = await client.beta.threads.create();
      thread_id = thread.id;
    }

    await client.beta.threads.messages.create(thread_id, {
      role: "user",
      content: query,
    });

    let run = await client.beta.threads.runs.createAndPoll(thread_id, {
      assistant_id: ASSISTANT_ID,
    });

    if (run.required_action?.type === "submit_tool_outputs") {
      const tool_outputs = await Promise.all(
        run.required_action.submit_tool_outputs.tool_calls.map(async (action) => {
          const functionName = action.function.name;
          const args = JSON.parse(action.function.arguments);

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

      run = await client.beta.threads.runs.submitToolOutputsAndPoll(
        thread_id,
        run.id,
        { tool_outputs }
      );
    }

    const messagesResponse = await client.beta.threads.messages.list(thread_id);

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

    let assistantResponse = assistantMessages[0].content[0].text.value;

    // Remove citation markers
    assistantResponse = removeCitations(assistantResponse);

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
