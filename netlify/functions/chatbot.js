import { OpenAI } from "openai";

const FIXED_THREAD_ID = "thread_81nIg7Kt2kgrkK1jwV6glOWr";

export async function handler(event, context) {
  console.log("[Handler] Invoked");

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

    console.log("[Handler] Received query:", query);

    if (!query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Query is required" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = process.env.ASSISTANT_ID;

    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing environment variables" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Add user message to the fixed thread
    console.log(`[Handler] Adding user message to thread: ${FIXED_THREAD_ID}`);
    await client.beta.threads.messages.create(FIXED_THREAD_ID, {
      role: "user",
      content: query,
    });

    // Create and poll run using the official helper method
    console.log("[Handler] Creating and polling run");
    const run = await client.beta.threads.runs.createAndPoll(FIXED_THREAD_ID, {
      assistant_id: ASSISTANT_ID,
      // optionally pass instructions or other run params here
      // instructions: "Some extra instructions"
    });

    console.log("[Handler] Run result:", JSON.stringify(run));

    if (run.status !== "succeeded" && run.status !== "completed") {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Run failed with status: ${run.status}` }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Fetch assistant messages from the thread
    console.log("[Handler] Fetching messages from thread");
    const messagesResponse = await client.beta.threads.messages.list(FIXED_THREAD_ID);

    const assistantMessages = messagesResponse.data.filter((m) => m.role === "assistant");

    if (assistantMessages.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No response from assistant" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Extract assistant response text from the latest assistant message
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
