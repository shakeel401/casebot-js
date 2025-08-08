import { OpenAI } from "openai";

const FIXED_THREAD_ID = "thread_81nIg7Kt2kgrkK1jwV6glOWr";

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
    const body = JSON.parse(event.body || "{}");
    const query = (body.query || "").trim();
    console.log("[Handler] Received query:", query);

    if (!query) {
      console.log("[Handler] Query is missing or empty");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Query is required" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = process.env.ASSISTANT_ID;

    console.log("[Handler] OPENAI_API_KEY present:", !!OPENAI_API_KEY);
    console.log("[Handler] ASSISTANT_ID present:", !!ASSISTANT_ID);

    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      console.log("[Handler] Missing required environment variables");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing environment variables" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });

    console.log(`[Handler] Sending user message to thread: ${FIXED_THREAD_ID}`);
    const userMessageResponse = await client.beta.threads.messages.create(FIXED_THREAD_ID, {
      role: "user",
      content: query,
    });
    console.log("[Handler] User message response:", JSON.stringify(userMessageResponse));

    console.log("[Handler] Creating and polling run");
    const run = await client.beta.threads.runs.create_and_poll({
      thread_id: FIXED_THREAD_ID,
      assistant_id: ASSISTANT_ID,
    });
    console.log("[Handler] Run result:", JSON.stringify(run));

    console.log("[Handler] Fetching messages from thread");
    const messagesResponse = await client.beta.threads.messages.list(FIXED_THREAD_ID);
    console.log("[Handler] Messages response:", JSON.stringify(messagesResponse));

    const assistantMessages = messagesResponse.data.filter(
      (m) => m.role === "assistant"
    );
    console.log("[Handler] Found assistant messages count:", assistantMessages.length);

    if (assistantMessages.length === 0) {
      console.error("[Handler] No assistant response found");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No response from assistant" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const assistantResponse = assistantMessages[0].content[0].text.value;
    console.log("[Handler] Assistant response:", assistantResponse);

    return {
      statusCode: 200,
      body: JSON.stringify({ thread_id: FIXED_THREAD_ID, response: assistantResponse }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    console.error("[Handler] Error caught:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { "Content-Type": "application/json" },
    };
  }
}
