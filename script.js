document.querySelectorAll(".navBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    target?.scrollIntoView({ behavior: "smooth" });
  });
});

const chatBox = document.getElementById("chatBox");
const collapseBtn = document.getElementById("collapseBtn");

const openChat = () => chatBox.classList.add("open");
const closeChat = () => chatBox.classList.remove("open");

chatBox.addEventListener("focusin", openChat);
chatBox.addEventListener("click", (e) => {
  if (!collapseBtn.contains(e.target)) openChat();
});

collapseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  closeChat();
});

document.addEventListener("click", (e) => {
  if (!chatBox.contains(e.target)) closeChat();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeChat();
});

const input = document.getElementById("inputBox");
const submit = document.getElementById("submBtn");
const messages = document.getElementById("messages");
const typing = document.getElementById("typing");

function addMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  bubble.textContent = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

async function askNajm() {
  const text = input.value.trim();
  if (!text || submit.disabled) return;

  addMessage("user", text);
  input.value = "";
  submit.disabled = true;
  typing.hidden = false;

  let bubble = null;
  let charQueue = [];
  let isTyping = false;
  let streamFinished = false;

  function typeNextChar() {
    if (charQueue.length > 0) {
      if (!bubble) {
        typing.hidden = true;
        bubble = addMessage("najm", "");
      }
      const char = charQueue.shift();
      bubble.textContent += char;
      messages.scrollTop = messages.scrollHeight;

      // Slower pace: 120ms per character (scales down to 60ms if queue backs up)
      const speed = Math.max(60, 60 - charQueue.length * 2);
      setTimeout(typeNextChar, speed);
    } else if (streamFinished) {
      isTyping = false;
      submit.disabled = false;
      typing.hidden = true;
    } else {
      isTyping = false;
    }
  }

  function enqueueText(str) {
    charQueue.push(...str.split(""));
    if (!isTyping) {
      isTyping = true;
      typeNextChar();
    }
  }

  try {
    const response = await fetch("/api/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Server status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        const remaining = decoder.decode();
        if (remaining) enqueueText(remaining);
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        enqueueText(chunk);
      }
    }
  } catch (err) {
    console.error("askNajm failed:", err);
    if (!bubble) {
      addMessage(
        "najm",
        "Impossible de joindre le serveur. Vérifie ta connexion.",
      );
    } else {
      enqueueText("\n[Connexion interrompue]");
    }
  } finally {
    streamFinished = true;
    if (!isTyping) {
      submit.disabled = false;
      typing.hidden = true;
    }
  }
}

submit.addEventListener("click", askNajm);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    askNajm();
  }
});
