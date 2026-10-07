// --- Navigation ---
document.querySelectorAll(".navBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    target?.scrollIntoView({ behavior: "smooth" });
  });
});

// --- Chat Window Toggle ---
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

// --- Najm AI Chat & Streaming ---
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
        if (remaining && bubble) {
          bubble.textContent += remaining;
          messages.scrollTop = messages.scrollHeight;
        }
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        if (!bubble) {
          typing.hidden = true;
          bubble = addMessage("najm", "");
        }
        bubble.textContent += chunk;
        messages.scrollTop = messages.scrollHeight;
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
      bubble.textContent += "\n[Connexion interrompue]";
    }
  } finally {
    submit.disabled = false;
    typing.hidden = true;
  }
}

submit.addEventListener("click", askNajm);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    askNajm();
  }
});
