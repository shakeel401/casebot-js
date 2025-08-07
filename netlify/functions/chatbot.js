const { OpenAI } = require("openai");
const axios = require("axios");

require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

// ✅ Custom content filter (mocked — replace with real logic)
const isQuestionValid = (query) => {
  const bannedWords = [
        "joke", "funny", "lol", "haha", "laugh",
        "crush", "kiss", "hug", "flirt",
        "dating", "sex",
        "boyfriend", "girlfriend",
        "do you love me", "tell me a joke", "marry me", "i love you",
        "chat with me", "best friend", "are you single", "romantic", "cute"
    ];
  return !bannedWords.some(word => query.toLowerCase().includes(word));
};

// ✅ Tavily Search tool
async function tavilySearch(query) {
  try {
    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        query,
        search_depth: "advanced",
        max_results: 3
      },
      {
        headers: {
          Authorization: `Bearer ${TAVILY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = response.data;
    if (data.answer) return data.answer;

    if (data.results?.length) {
      return data.results.map(res => `${res.title}: ${res.url}`).join("\n");
    }

    return "No relevant results found on the web.";
  } catch (err) {
    return `Error performing Tavily search: ${err.message}`;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = new URLSearchParams(event.body);
    const query = body.get("query");
    let thread_id = body.get("thread_id");

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
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing VECTOR_STORE_ID or ASSISTANT_ID" })
      };
    }

    // 🧵 Create thread if not given
    if (!thread_id) {
      const thread = await openai.beta.threads.create();
      thread_id = thread.id;
    }

    // 💬 Post user message
    await openai.beta.threads.messages.create({
      thread_id,
      role: "user",
      content: query
    });

    // 🧠 Run assistant
    let run = await openai.beta.threads.runs.createAndPoll({
      thread_id,
      assistant_id: ASSISTANT_ID
    });

    // ⚙️ Handle tool call if needed
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

      // Submit tool results
      run = await openai.beta.threads.runs.submitToolOutputsAndPoll({
        thread_id,
        run_id: run.id,
        tool_outputs
      });
    }

    // 🧾 Get assistant reply
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
};
