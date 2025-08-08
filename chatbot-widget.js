(function() {
  // CSS styles as a string
  const styles = `
    #chat-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      max-height: 500px;
      background: #ffffff;
      border: 1px solid #ccc;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      font-family: Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      overflow: hidden;
      z-index: 9999;
    }
    #chat-header {
      background: #003366;
      color: white;
      padding: 12px;
      font-size: 16px;
      font-weight: bold;
      text-align: center;
    }
    #chat-messages {
      flex: 1;
      padding: 10px;
      overflow-y: auto;
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
  `;

  // Inject styles into <head>
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);

  // Inject chatbot HTML container into body
  const chatHTML = `
    <div id="chat-container">
      <div id="chat-header">🧑‍⚖️ CaseBot</div>
      <div id="chat-messages"></div>
      <div id="chat-input">
        <input type="text" id="query-input" placeholder="Ask your legal question..." autocomplete="off" />
        <button id="send-btn">Send</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', chatHTML);

  // Load marked library dynamically
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  // Your chatbot logic here
  async function initChatbot() {
    await loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');

    const messagesEl = document.getElementById("chat-messages");
    const inputEl = document.getElementById("query-input");
    const sendBtn = document.getElementById("send-btn");

    let thread_id = null;

    function appendMessage(text, className, isMarkdown = false) {
      const msg = document.createElement("div");
      msg.className = `message ${className}`;
      msg.innerHTML = isMarkdown ? marked.parse(text) : text;
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
      if (spinner) spinner.remove();
    }

    function extractThreadId(raw) {
      if (!raw) return null;
      if (typeof raw === "string" && raw.startsWith("thread_")) return raw.trim();
      if (typeof raw === "object") {
        if (raw.id && typeof raw.id === "string" && raw.id.startsWith("thread_")) return raw.id.trim();
        if (raw.thread_id && typeof raw.thread_id === "string" && raw.thread_id.startsWith("thread_")) return raw.thread_id.trim();
      }
      return null;
    }

    async function sendMessage() {
      const query = inputEl.value.trim();
      if (!query) return;

      appendMessage(query, "user");
      inputEl.value = "";
      sendBtn.disabled = true;
      showSpinner();

      try {
        const payload = {
          query,
          thread_id: thread_id ? String(thread_id).trim() : null
        };

        const response = await fetch("/.netlify/functions/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const result = await response.json();
        hideSpinner();

        if (result.response) {
          appendMessage(result.response, "bot", true);
        } else if (result.error) {
          appendMessage("⚠️ " + result.error, "bot");
          console.error("Backend error:", result.error);
        }

        const newId = extractThreadId(result.thread_id);
        if (newId) {
          thread_id = newId;
          console.log("✅ Stored thread_id:", thread_id);
        }

      } catch (err) {
        hideSpinner();
        appendMessage("⚠️ Failed to connect to CaseBot server.", "bot");
        console.error("Fetch error:", err);
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  // Initialize chatbot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
