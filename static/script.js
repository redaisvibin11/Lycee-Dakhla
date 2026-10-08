function setLanguage(lang) {
  if (typeof translations === "undefined" || !translations[lang]) return;

  // Reload only when the user actually switches language
  const previous = localStorage.getItem("selected_lang") || "ar";
  if (previous !== lang) {
    localStorage.setItem("selected_lang", lang);
    location.reload();
    return;
  }

  // ...the rest of your function stays exactly the same
  // (document.documentElement.lang = lang; and everything below it)
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

    loadAnnouncements();
    loadProjects();

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
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  const VISIBLE_CARDS = 3;

  function renderCards(container, items, cardHtml) {
    container.classList.remove("expanded");
    container.innerHTML = items
      .map((item, i) => cardHtml(item, i >= VISIBLE_CARDS ? "extra" : ""))
      .join("");

    if (items.length > VISIBLE_CARDS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "show-more-btn";
      btn.dataset.i18n = "show_more";
      btn.textContent = t("show_more");
      btn.addEventListener("click", () => {
        const expanded = container.classList.toggle("expanded");
        const key = expanded ? "show_less" : "show_more";
        btn.dataset.i18n = key;
        btn.textContent = t(key);
      });
      container.appendChild(btn);
    }
  }

  function loadAnnouncements() {
    const container = document.getElementById("announcementsContainer");
    if (!container) return;

    fetch("/api/announcements")
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.length === 0) {
          container.innerHTML = `<p class="loading-text">${t("no_announcements")}</p>`;
          return;
        }
        renderCards(
          container,
          data,
          (item, cls) => `
        <div class="overview-card ${cls}">
          ${item.image_url ? `<div class="card-media"><img src="${esc(item.image_url)}" alt="${esc(item.title)}" /></div>` : ""}
          <div class="card-content">
            <h3>${esc(item.title)}</h3>
            <p>${esc(item.content)}</p>
            <small style="color: var(--text-muted); display: block; margin-top: 0.5rem;">${esc(item.signature)} &bull; ${new Date(item.created_at).toLocaleDateString()}</small>
          </div>
        </div>`,
        );
      })
      .catch(() => {
        container.innerHTML = `<p class="loading-text">${t("err_network")}</p>`;
      });
  }

  function loadProjects() {
    const container = document.getElementById("projectsContainer");
    if (!container) return;

    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.length === 0) {
          container.innerHTML = `<p class="loading-text">${t("no_projects")}</p>`;
          return;
        }
        renderCards(
          container,
          data,
          (item, cls) => `
        <div class="overview-card ${cls}">
          ${item.image_url ? `<div class="card-media"><img src="${esc(item.image_url)}" alt="${esc(item.title)}" /></div>` : ""}
          <div class="card-content">
            <h3>${esc(item.title)}</h3>
            <p><strong>${esc(item.student_name)}</strong></p>
            <p>${esc(item.description)}</p>
          </div>
        </div>`,
        );
      })
      .catch(() => {
        container.innerHTML = `<p class="loading-text">${t("err_network")}</p>`;
      });
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
}
