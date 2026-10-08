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

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  const activeBtn = document.getElementById(`btn-${lang}`);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }
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
});

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("selected_lang") || "ar";
  setLanguage(savedLang);
});
document.querySelectorAll(".navBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    target?.scrollIntoView({ behavior: "smooth" });
  });
});

const sectionIds = [
  "overview-section",
  "announcements-section",
  "gallery-section",
  "chatbot-section",
];

const observerOptions = {
  root: null,
  rootMargin: "-20% 0px -60% 0px",
  threshold: 0,
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const activeId = entry.target.id;
      document.querySelectorAll(".navBtn").forEach((btn) => {
        if (btn.dataset.target === activeId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }
  });
}, observerOptions);

sectionIds.forEach((id) => {
  const sec = document.getElementById(id);
  if (sec) observer.observe(sec);
});

async function loadAnnouncements() {
  const container = document.getElementById("announcementsContainer");
  if (!container) return;

  try {
    const res = await fetch("/api/announcements");
    const data = await res.json();

    if (!data.length) {
      container.innerHTML =
        "<p class='empty-text'>Aucune annonce publique pour le moment.</p>";
      return;
    }

    container.innerHTML = data
      .map(
        (item) => `
      <div class="overview-card">
        ${item.image_url ? `<div class="card-media"><img src="${item.image_url}" alt="Cover" /></div>` : ""}
        <div class="card-content">
          <span class="card-date">${item.created_at}</span>
          <h3>${item.title}</h3>
          <p>${item.content}</p>
          <span class="card-sig">— ${item.signature}</span>
        </div>
      </div>
    `,
      )
      .join("");
  } catch (e) {
    container.innerHTML =
      "<p class='error-text'>Erreur de chargement des annonces.</p>";
  }
}

async function loadProjects() {
  const container = document.getElementById("projectsContainer");
  if (!container) return;

  try {
    const res = await fetch("/api/projects");
    const data = await res.json();

    if (!data.length) {
      container.innerHTML =
        "<p class='empty-text'>Aucun projet publié pour le moment.</p>";
      return;
    }

    container.innerHTML = data
      .map(
        (item) => `
      <div class="overview-card">
        ${item.image_url ? `<div class="card-media"><img src="${item.image_url}" alt="Project Image" /></div>` : ""}
        <div class="card-content">
          <h3>${item.title}</h3>
          <p class="student-tag">Par : <strong>${item.student_name}</strong></p>
          <p>${item.description}</p>
        </div>
      </div>
    `,
      )
      .join("");
  } catch (e) {
    container.innerHTML =
      "<p class='error-text'>Erreur de chargement des projets.</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadAnnouncements();
  loadProjects();
});

const chatBox = document.getElementById("chatBox");
const collapseBtn = document.getElementById("collapseBtn");

const openChat = () => chatBox?.classList.add("open");
const closeChat = () => chatBox?.classList.remove("open");

if (chatBox) {
  chatBox.addEventListener("focusin", openChat);
  chatBox.addEventListener("click", (e) => {
    if (collapseBtn && !collapseBtn.contains(e.target)) openChat();
  });
}

if (collapseBtn) {
  collapseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeChat();
  });
}

document.addEventListener("click", (e) => {
  if (chatBox && !chatBox.contains(e.target)) closeChat();
});

const input = document.getElementById("inputBox");
const submit = document.getElementById("submBtn");
const messages = document.getElementById("messages");
const typing = document.getElementById("typing");

function addMessage(role, text) {
  if (!messages) return null;
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  bubble.textContent = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

async function askNajm() {
  if (!input || !submit) return;
  const text = input.value.trim();
  if (!text || submit.disabled) return;

  addMessage("user", text);
  input.value = "";
  submit.disabled = true;
  if (typing) typing.hidden = false;

  let bubble = null;
  let charQueue = [];
  let isTyping = false;
  let streamFinished = false;

  function typeNextChar() {
    if (charQueue.length > 0) {
      if (!bubble) {
        if (typing) typing.hidden = true;
        bubble = addMessage("najm", "");
      }
      const char = charQueue.shift();
      if (bubble) bubble.textContent += char;
      if (messages) messages.scrollTop = messages.scrollHeight;
      setTimeout(typeNextChar, Math.max(40, 40 - charQueue.length * 2));
    } else if (streamFinished) {
      isTyping = false;
      submit.disabled = false;
      if (typing) typing.hidden = true;
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

    if (!response.ok) throw new Error(`Server status ${response.status}`);

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
      if (chunk) enqueueText(chunk);
    }
  } catch (err) {
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
      if (typing) typing.hidden = true;
    }
  }
}

if (submit) submit.addEventListener("click", askNajm);
if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askNajm();
    }
  });
}
