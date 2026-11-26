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

const navBrand = document.getElementById("navBrand");
if (navBrand) {
  navBrand.addEventListener("click", (e) => {
    const overview = document.getElementById("overview-section");
    if (overview) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      history.replaceState(null, "", "/");
    }
  });
}

function initScrollSpy() {
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  if (!navItems.length) return;

  const sectionMap = new Map();
  navItems.forEach((item) => {
    const href = item.getAttribute("href") || "";
    const hashIndex = href.indexOf("#");
    const id =
      hashIndex !== -1 ? href.slice(hashIndex + 1) : item.dataset.section;
    if (id) {
      const el = document.getElementById(id);
      if (el) sectionMap.set(el, item);
    }
  });

  if (!sectionMap.size) return;

  const setScrolledSection = (activeEl) => {
    sectionMap.forEach((link, el) => {
      link.classList.toggle("in-section", el === activeEl);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        setScrolledSection(visible[0].target);
      }
    },
    {
      rootMargin: "-18% 0px -65% 0px",
      threshold: 0,
    },
  );

  sectionMap.forEach((_, el) => observer.observe(el));

  window.addEventListener(
    "scroll",
    () => {
      if (window.scrollY < 80) {
        setScrolledSection(null);
      }
    },
    { passive: true },
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("selected_lang") || "ar";
  setLanguage(savedLang);

  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      save();
    });
  }

  initScrollSpy();

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

  const modalHTML = `
    <div id="imageModal" class="zoom-modal" onclick="closeImageModal()">
        <span class="zoom-close">&times;</span>
        <img class="zoom-modal-content" id="zoomedImg">
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("zoomedImg");
  const images = document.querySelectorAll(".card-media img");

  images.forEach((img) => {
    img.classList.add("zoomable");
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      modal.style.display = "flex";
      modal.style.justifyContent = "center";
      modal.style.alignItems = "center";
      modalImg.src = img.src;
    });
  });
});

function closeImageModal() {
  const modal = document.getElementById("imageModal");
  if (modal) modal.style.display = "none";
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

function parseAndExecuteNajmActions(fullText) {
  const actionRegex = /\[ACTION:([A-Z_]+)(?::([A-Z_]+))?\]/g;
  let match;
  const matches = [];

  while ((match = actionRegex.exec(fullText)) !== null) {
    matches.push({
      raw: match[0],
      actionType: match[1],
      actionParam: match[2],
    });
  }

  let cleanText = fullText;
  for (const item of matches) {
    if (item.actionType === "THEME") {
      if (
        item.actionParam === "DARK" &&
        !document.body.classList.contains("dark")
      ) {
        save();
      } else if (
        item.actionParam === "LIGHT" &&
        document.body.classList.contains("dark")
      ) {
        save();
      }
    } else if (item.actionType === "LANG") {
      if (item.actionParam && ["AR", "FR", "EN"].includes(item.actionParam)) {
        setLanguage(item.actionParam.toLowerCase());
      }
    }
    cleanText = cleanText.replace(item.raw, "");
  }

  return cleanText.trim();
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
