function t(key) {
  const lang = localStorage.getItem("selected_lang") || "ar";
  return (translations[lang] && translations[lang][key]) || key;
}

function setLanguage(lang) {
  if (typeof translations === "undefined" || !translations[lang]) return;

  localStorage.setItem("selected_lang", lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang][key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = translations[lang][key];
      } else {
        el.textContent = translations[lang][key];
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

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("selected_lang") || "ar";
  setLanguage(savedLang);

  const navBtns = document.querySelectorAll(".navBtn");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const targetSection = document.getElementById(targetId);

      if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth" });
      }

      navBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
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

function appendChatMessage(sender, text) {
  const messagesContainer = document.getElementById("messages");
  if (!messagesContainer) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;
  msgDiv.textContent = text;
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data && data.response) {
        appendChatMessage("najm", data.response);
      } else {
        appendChatMessage("najm", t("err_generic"));
      }
    })
    .catch(() => {
      appendChatMessage("najm", t("err_network"));
    })
    .finally(() => {
      if (typingEl) typingEl.setAttribute("hidden", "true");
    });
}
