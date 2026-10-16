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
        const img = el.querySelector("img");
        if (img) {
          el.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              node.textContent =
                (lang === "ar" ? " " : "") +
                newText +
                (lang !== "ar" ? " " : "");
            }
          });
        } else {
          el.textContent = newText;
        }
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

  document.querySelectorAll(".show-more-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.closest("section");
      const grid = section ? section.querySelector(".feed-grid") : null;
      if (grid) {
        const expanded = grid.classList.toggle("expanded");
        const key = expanded ? "show_less" : "show_more";
        btn.dataset.i18n = key;
        btn.textContent = t(key);
      }
    });
  });

  const navBtns = document.querySelectorAll(".navBtn");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetId = btn.getAttribute("data-target");
      if (!targetId) return;

      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        e.preventDefault();
        targetSection.scrollIntoView({ behavior: "smooth" });

        navBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });

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

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

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

function sendChatMessage() {
  const inputBox = document.getElementById("inputBox");
  if (!inputBox) return;

  const message = inputBox.value.trim();
  if (!message) {
    alert(t("err_empty_input"));
    return;
  }

  appendChatMessage("user", message);
  inputBox.value = "";

  const typingEl = document.getElementById("typing");
  if (typingEl) {
    typingEl.setAttribute("aria-label", t("najm_thinking"));
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
      let botMsgDiv = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!botMsgDiv) {
          botMsgDiv = appendChatMessage("najm", chunk);
        } else {
          botMsgDiv.textContent += chunk;
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
