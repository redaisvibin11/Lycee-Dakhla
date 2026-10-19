function save() {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

function loadTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}
loadTheme();

function t(key) {
  const lang = localStorage.getItem("selected_lang") || "ar";
  return (translations && translations[lang] && translations[lang][key]) || key;
}

function setLanguage(lang) {
  if (typeof translations === "undefined" || !translations[lang]) return;

  localStorage.setItem("selected_lang", lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const newText = translations[lang][key];
    if (newText) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = newText;
      } else {
        el.textContent = newText;
      }
    }
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (translations[lang][key]) {
      el.setAttribute("aria-label", translations[lang][key]);
    }
  });

  document
    .querySelectorAll(".lang-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`btn-${lang}`);
  if (activeBtn) activeBtn.classList.add("active");
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedLang = btn.id.replace("btn-", "");
    localStorage.setItem("selected_lang", selectedLang);
    location.reload();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("selected_lang") || "ar";
  setLanguage(savedLang);

  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      save();
    });
  }

  const submitBtn = document.getElementById("submBtn");
  const inputBox = document.getElementById("inputBox");
  if (submitBtn && inputBox) {
    submitBtn.addEventListener("click", () => sendChatMessage());
    inputBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }
});

function appendChatMessage(sender, text) {
  const messagesContainer = document.getElementById("messages");
  if (!messagesContainer) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;
  msgDiv.textContent = text;
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return msgDiv;
}

function parseAndExecuteNajmActions(fullText) {
  // Look for action tags like [ACTION:THEME:DARK], [ACTION:LANG:FR], etc.
  const actionRegex = /\[ACTION:([A-Z_]+)(?::([A-Z_]+))?\]/g;
  let match;
  let cleanText = fullText;

  while ((match = actionRegex.exec(fullText)) !== null) {
    const actionType = match[1];
    const actionParam = match[2];

    if (actionType === "THEME") {
      if (actionParam === "DARK" && !document.body.classList.contains("dark")) {
        save();
      } else if (
        actionParam === "LIGHT" &&
        document.body.classList.contains("dark")
      ) {
        save();
      }
    } else if (actionType === "LANG") {
      if (actionParam && ["AR", "FR", "EN"].includes(actionParam)) {
        setLanguage(actionParam.toLowerCase());
      }
    }

    // Strip the action command from the displayed message
    cleanText = cleanText.replace(match[0], "").trim();
  }

  return cleanText;
}

function sendChatMessage() {
  const inputBox = document.getElementById("inputBox");
  if (!inputBox) return;

  const message = inputBox.value.trim();
  if (!message) return;

  appendChatMessage("user", message);
  inputBox.value = "";

  const typingEl = document.getElementById("typing");
  if (typingEl) {
    typingEl.removeAttribute("hidden");
  }

  fetch("/api/index", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || t("err_generic"));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rawResponseText = "";
      let botMsgDiv = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        rawResponseText += chunk;

        const processedText = parseAndExecuteNajmActions(rawResponseText);

        if (!botMsgDiv) {
          botMsgDiv = appendChatMessage("najm", processedText);
        } else {
          botMsgDiv.textContent = processedText;
          const container = document.getElementById("messages");
          if (container) container.scrollTop = container.scrollHeight;
        }
      }
    })
    .catch((err) => {
      appendChatMessage("najm", err.message || t("err_network"));
    })
    .finally(() => {
      if (typingEl) typingEl.setAttribute("hidden", "true");
    });
}
