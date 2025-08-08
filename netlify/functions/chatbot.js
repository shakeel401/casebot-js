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
        }      overflow-y: auto;
      font-size: 14px;
    }

    .message {
      margin: 6px 0;
      padding: 8px 12px;
      border-radius: 16px;
      max-width: 80%;
      clear: both;
      word-wrap: break-word;
    }

    .user {
      background: #e1f5fe;
      align-self: flex-end;
      margin-left: auto;
    }

    .bot {
      background: #f1f1f1;
      align-self: flex-start;
      margin-right: auto;
    }

    #chat-input {
      display: flex;
      border-top: 1px solid #ccc;
    }

    #query-input {
      flex: 1;
      padding: 10px;
      border: none;
      outline: none;
      font-size: 14px;
    }

    #send-btn {
      background: #003366;
      color: white;
      padding: 10px 15px;
      border: none;
      cursor: pointer;
    }

    #send-btn:hover {
      background: #0055aa;
    }

    .spinner {
      margin: 10px;
      align-self: center;
      border: 4px solid #ccc;
      border-top: 4px solid #003366;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive */
    @media screen and (max-width: 480px) {
      #chat-container {
        width: 95%;
        right: 2.5%;
        bottom: 10px;
      }

      #chat-header {
        font-size: 15px;
      }

      #query-input {
        font-size: 13px;
      }
    }
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="chat-header">🧑‍⚖️ CaseBot</div>
    <div id="chat-messages"></div>
    <div id="chat-input">
      <input type="text" id="query-input" placeholder="Ask your legal question..." />
      <button id="send-btn">Send</button>
    </div>
  </div>

  <!-- marked.js for markdown rendering -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <script>
    const messagesEl = document.getElementById("chat-messages");
    const inputEl = document.getElementById("query-input");
    const sendBtn = document.getElementById("send-btn");

    let thread_id = null;

    function appendMessage(text, className, isMarkdown = false) {
      const msg = document.createElement("div");
      msg.className = `message ${className}`;
      if (isMarkdown) {
        msg.innerHTML = marked.parse(text);
      } else {
        msg.textContent = text;
      }
      messagesEl.appendChild(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showSpinner() {
      const spinner = document.createElement("div");
      spinner.className = "spinner";
      spinner.id = "loading-spinner";
      messagesEl.appendChild(spinner);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function hideSpinner() {
      const spinner = document.getElementById("loading-spinner");
      if (spinner) {
        spinner.remove();
      }
    }

    async function sendMessage() {
      const query = inputEl.value.trim();
      if (!query) return;

      appendMessage(query, "user");
      inputEl.value = "";
      sendBtn.disabled = true;
      showSpinner();

      try {
        const params = new URLSearchParams();
        params.append("query", query);
        if (thread_id) params.append("thread_id", thread_id);

        const response = await fetch("/.netlify/functions/chatbot", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params
        });

        const result = await response.json();
        hideSpinner();

        if (result.response) {
          appendMessage(result.response, "bot", true);
        } else if (result.error) {
          appendMessage("⚠️ " + result.error, "bot");
        }

        if (result.thread_id) {
          thread_id = typeof result.thread_id === "object"
            ? result.thread_id.id
            : String(result.thread_id);
          console.log("✅ Stored thread_id:", thread_id);
        }

      } catch (err) {
        hideSpinner();
        appendMessage("⚠️ Failed to connect to CaseBot server.", "bot");
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  </script>
</body>
</html>
