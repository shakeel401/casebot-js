(function() {
  // CSS styles as a string, including styles for the chat icon and hidden chat container
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
      bottom: 90px; /* leave space above toggle button */
      right: 20px;
      width: 320px;
      height: 480px; /* fixed height to avoid collapse */
      background: #ffffff;
      border: 1px solid #ccc;
      border-radius: 10px;
      display: none; /* initially hidden */
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
      padding: 8px;
      flex-shrink: 0;
      background: white;
      gap: 8px;
      align-items: center;
    }
    #query-input {
      flex: 1;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      outline: none;
    }
    #send-btn {
      background: #003366;
      border: none;
      padding: 8px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.3s ease;
      width: 36px;
      height: 36px;
      color: white;
    }
    #send-btn:hover {
      background: #0055aa;
    }
    #send-btn svg {
      width: 20px;
      height: 20px;
      fill: white;
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

  // Inject styles into <head>
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);

  // Create chat toggle button (chat icon)
  const toggleBtn = document.createElement('div');
  toggleBtn.id = 'chat-toggle-btn';
  toggleBtn.title = 'Open chat';
  toggleBtn.innerHTML = '💬';  // Chat bubble emoji
  document.body.appendChild(toggleBtn);

  // Inject chatbot HTML container into body (initially hidden)
  const chatHTML = `
    <div id="chat-container" role="region" aria-label="Chatbot window" aria-hidden="true">
      <div id="chat-header">🧑‍⚖️ CaseBot</div>
      <div id="chat-messages" aria-live="polite"></div>
      <div id="chat-input">
        <input type="text" id="query-input" placeholder="Ask your legal question..." autocomplete="off" aria-label="Chat input" />
        <button id="send-btn" aria-label="Send message" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', chatHTML);

  // Grab references
  const chatContainer = document.getElementById('chat-container');
  const messagesEl = document.getElementById("chat-messages");
  const inputEl = document.getElementById("query-input");
  const sendBtn = document.getElementById("send-btn");

  // Function to append messages
  function appendMessage(text, className, isMarkdown = false) {
    const msg = document.createElement("div");
    msg.className = `message ${className}`;
    msg.innerHTML = isMarkdown ? marked.parse(text) : text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

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

  async function initChatbot() {
    await loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');

    let thread_id = null;

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

    // Add event listeners
    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    // Show a welcome message once on first init
    appendMessage("Hello! I am CaseBot 🤖. Ask me your legal questions.", "bot");
  }

  // Toggle chat visibility on button click and focus input if opened
  toggleBtn.addEventListener('click', () => {
    const isVisible = getComputedStyle(chatContainer).display !== 'none';
    if (isVisible) {
      chatContainer.style.display = 'none';
      chatContainer.setAttribute('aria-hidden', 'true');
      toggleBtn.title = 'Open chat';
    } else {
      chatContainer.style.display = 'flex';
      chatContainer.setAttribute('aria-hidden', 'false');
      toggleBtn.title = 'Close chat';
      inputEl.focus();
    }
  });

  // Initialize chatbot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
