(async function() {
  // Inject CSS styles
  const styles = `
    #chat-toggle-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      background: #003366;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 28px;
      user-select: none;
    }
    #chat-toggle-btn:hover {
      background: #0055aa;
    }
    #chat-container {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 320px;
      height: 480px;
      background: #ffffff;
      border: 1px solid #ccc;
      border-radius: 10px;
      display: none;
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
      flex-shrink: 0;
    }
    #chat-messages {
      flex: 1 1 auto;
      padding: 10px;
      overflow-y: auto;
      font-size: 14px;
      background: #fafafa;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 100px;
      height: 100%; /* Ensure it fills space */
    }
    .message {
      padding: 8px 12px;
      border-radius: 16px;
      max-width: 80%;
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
      padding: 8px;
      flex-shrink: 0;
      background: white;
    }
    #query-input {
      flex: 1;
      padding: 10px;
      border: none;
      outline: none;
      font-size: 14px;
      border-radius: 4px;
      border: 1px solid #ccc;
    }
    #send-btn {
      background: #003366;
      color: white;
      padding: 10px 15px;
      border: none;
      cursor: pointer;
      margin-left: 8px;
      border-radius: 4px;
      font-weight: bold;
      transition: background 0.3s ease;
    }
    #send-btn:hover {
      background: #0055aa;
    }
    .spinner {
      margin: 10px auto;
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
        bottom: 90px;
        height: 400px;
      }
      #chat-header {
        font-size: 15px;
      }
      #query-input {
        font-size: 13px;
      }
    }
  `;

  // Append styles to head
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);

  // Inject chatbot HTML
  const chatbotHTML = `
    <button id="chat-toggle-btn" aria-label="Open chat">💬</button>
    <div id="chat-container" aria-hidden="true" role="region" aria-label="Chatbot window">
      <div id="chat-header">CaseBot</div>
      <div id="chat-messages"></div>
      <div id="chat-input">
        <input id="query-input" type="text" placeholder="Type your message..." autocomplete="off" />
        <button id="send-btn">Send</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', chatbotHTML);

  const toggleBtn = document.getElementById('chat-toggle-btn');
  const chatContainer = document.getElementById('chat-container');
  const messagesEl = document.getElementById("chat-messages");
  const inputEl = document.getElementById("query-input");
  const sendBtn = document.getElementById("send-btn");

  // Append message helper
  function appendMessage(text, className, isMarkdown = false) {
    const msg = document.createElement("div");
    msg.className = `message ${className}`;
    try {
      if (isMarkdown && window.marked) {
        msg.innerHTML = marked.parse(text);
      } else {
        msg.textContent = text;
      }
    } catch {
      msg.textContent = text;
    }
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Load markdown parser
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initChatbot() {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
      console.log("Marked.js loaded");
    } catch {
      console.warn("Marked.js not loaded; plain text only");
    }

    let thread_id = null;

    function showSpinner() {
      if (!document.getElementById("loading-spinner")) {
        const spinner = document.createElement("div");
        spinner.className = "spinner";
        spinner.id = "loading-spinner";
        messagesEl.appendChild(spinner);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    function hideSpinner() {
      const spinner = document.getElementById("loading-spinner");
      if (spinner) spinner.remove();
    }

    function extractThreadId(raw) {
      if (!raw) return null;
      if (typeof raw === "string" && raw.startsWith("thread_")) return raw.trim();
      if (typeof raw === "object") {
        if (raw.id?.startsWith("thread_")) return raw.id.trim();
        if (raw.thread_id?.startsWith("thread_")) return raw.thread_id.trim();
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
        const payload = { query, thread_id: thread_id ? String(thread_id).trim() : null };

        const response = await fetch("/.netlify/functions/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Server responded with ${response.status}`);

        const result = await response.json();
        hideSpinner();

        if (result.response) {
          appendMessage(result.response, "bot", true);
        } else if (result.error) {
          appendMessage("⚠️ " + result.error, "bot");
        }

        const newId = extractThreadId(result.thread_id);
        if (newId) thread_id = newId;

      } catch (err) {
        hideSpinner();
        appendMessage("⚠️ Failed to connect to CaseBot server.", "bot");
        console.error(err);
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    // Append welcome message here once at init, hidden container doesn't matter
    appendMessage("Hello! I am CaseBot 🤖. Ask me your legal questions.", "bot");
  }

  let welcomed = false;
  toggleBtn.addEventListener('click', () => {
    const isVisible = getComputedStyle(chatContainer).display !== 'none';
    if (isVisible) {
      chatContainer.style.display = 'none';
      chatContainer.setAttribute('aria-hidden', 'true');
      toggleBtn.title = 'Open chat';
      console.log("Chat closed");
    } else {
      chatContainer.style.display = 'flex';
      chatContainer.setAttribute('aria-hidden', 'false');
      toggleBtn.title = 'Close chat';
      inputEl.focus();
      console.log("Chat opened");
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }

})();
