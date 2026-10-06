const navButtons = document.querySelectorAll(".navBtn");
navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: "smooth" });
    }
  });
});

const chatBox = document.getElementById("chatBox");
const collapseBtn = document.getElementById("collapseBtn");

function openChat() {
  chatBox.classList.add("open");
}

function closeChat() {
  chatBox.classList.remove("open");
}

chatBox.addEventListener("focusin", openChat);

chatBox.addEventListener("click", (e) => {
  if (!collapseBtn.contains(e.target)) openChat();
});

collapseBtn.addEventListener("click", closeChat);

document.addEventListener("click", (e) => {
  if (!chatBox.contains(e.target)) closeChat();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeChat();
});

// Najm AI
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
}

async function askNajm() {
  const text = input.value.trim();
  if (!text || submit.disabled) return;
  addMessage("user", text);
  input.value = "";
  submit.disabled = true;
  typing.hidden = false;
  try {
    const response = await fetch("/api/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    });
    const data = await response.json();
    if (data.answer) {
      addMessage("najm", data.answer);
    } else {
      addMessage("najm", data.error || "Une erreur est survenue. Réessaie.");
    }
  } catch (err) {
    console.error("askNajm failed:", err);
    addMessage(
      "najm",
      "Impossible de joindre le serveur. Vérifie ta connexion.",
    );
  } finally {
    submit.disabled = false;
    typing.hidden = true;
  }
}

submit.addEventListener("click", askNajm);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askNajm();
  }
});
