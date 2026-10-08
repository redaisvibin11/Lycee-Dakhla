document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(
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

  const annList = $("announcements-list");
  const projList = $("projects-list");
  const chatBox = $("chatBox");
  const messages = $("messages");
  const typing = $("typing");
  const form = $("chatForm");
  const input = $("inputBox");
  const sendBtn = $("sendBtn");
  const collapseBtn = $("collapseBtn");

  let lang = localStorage.getItem("lang") || "fr";
  if (!translations[lang]) lang = "fr";
  const t = (key) => translations[lang][key] || key;

  let announcements = null; // null = still loading
  let projects = null;
  let welcomeEl = null;
  let sending = false;

  // Dark mode follows the device setting
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark");
  }

  // ---------- rendering ----------
  function renderAnnouncements() {
    if (!annList) return;
    if (announcements === null) {
      annList.innerHTML = `<p class="empty-state">${esc(t("loading_announcements"))}</p>`;
    } else if (announcements.length === 0) {
      annList.innerHTML = `<p class="empty-state">${esc(t("no_announcements"))}</p>`;
    } else {
      annList.innerHTML = announcements
        .map(
          (a) => `
        <article class="overview-card">
          ${a.image_url ? `<div class="card-media"><img src="${esc(a.image_url)}" alt="${esc(a.title)}" loading="lazy" /></div>` : ""}
          <h3>${esc(a.title)}</h3>
          <div class="card-content">${esc(a.content)}</div>
          <small class="card-meta">${esc(a.signature || "Le Proviseur")} · ${esc(String(a.created_at || "").slice(0, 10))}</small>
        </article>`,
        )
        .join("");
    }
  }

  function renderProjects() {
    if (!projList) return;
    if (projects === null) {
      projList.innerHTML = `<p class="empty-state">${esc(t("loading_projects"))}</p>`;
    } else if (projects.length === 0) {
      projList.innerHTML = `<p class="empty-state">${esc(t("no_projects"))}</p>`;
    } else {
      projList.innerHTML = projects
        .map(
          (p) => `
        <article class="overview-card">
          ${p.image_url ? `<div class="card-media"><img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy" /></div>` : ""}
          <h3>${esc(p.title)}</h3>
          <div class="card-content">${esc(p.description)}</div>
          <small class="card-meta">${esc(p.student_name)}</small>
        </article>`,
        )
        .join("");
    }
  }

  // ---------- language ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    if (collapseBtn) {
      collapseBtn.title = t("chat_collapse");
      collapseBtn.setAttribute("aria-label", t("chat_collapse"));
    }
    if (welcomeEl) welcomeEl.textContent = t("najm_welcome");

    renderAnnouncements();
    renderProjects();
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang;
      localStorage.setItem("lang", lang);
      applyLang();
    });
  });

  // ---------- data ----------
  if (annList) {
    fetch("/api/announcements")
      .then((r) => r.json())
      .then((data) => {
        announcements = Array.isArray(data) ? data : [];
        renderAnnouncements();
      })
      .catch((err) => {
        console.error("Error loading announcements:", err);
        announcements = [];
        renderAnnouncements();
      });
  }

  if (projList) {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        projects = Array.isArray(data) ? data : [];
        renderProjects();
      })
      .catch((err) => {
        console.error("Error loading projects:", err);
        projects = [];
        renderProjects();
      });
  }

  // ---------- nav highlight ----------
  const navLinks = document.querySelectorAll('.nav-item[href^="#"]');
  const sections = [...navLinks]
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navLinks.forEach((a) =>
              a.classList.toggle(
                "active",
                a.getAttribute("href") === "#" + entry.target.id,
              ),
            );
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
  }

  // ---------- chat ----------
  if (form && input && messages && chatBox) {
    function addMessage(role, text) {
      const div = document.createElement("div");
      div.className = "message " + role;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      return div;
    }

    function openChat() {
      chatBox.classList.add("open");
      messages.scrollTop = messages.scrollHeight;
    }

    function resizeInput() {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 128) + "px";
    }

    welcomeEl = addMessage("najm welcome", "");

    input.addEventListener("focus", openChat);
    input.addEventListener("input", resizeInput);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    collapseBtn.addEventListener("click", () =>
      chatBox.classList.remove("open"),
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (sending) return;

      sending = true;
      sendBtn.disabled = true;
      openChat();
      addMessage("user", text);
      input.value = "";
      resizeInput();
      typing.hidden = false;

      let bot = null;
      try {
        const response = await fetch("/api/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          typing.hidden = true;
          addMessage("najm", t("err_generic"));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!bot) {
            typing.hidden = true;
            bot = addMessage("najm", "");
          }
          bot.textContent += decoder.decode(value, { stream: true });
          messages.scrollTop = messages.scrollHeight;
        }

        if (!bot) addMessage("najm", t("err_generic"));
      } catch (err) {
        console.error("Chat error:", err);
        addMessage("najm", t("err_network"));
      } finally {
        typing.hidden = true;
        sending = false;
        sendBtn.disabled = false;
      }
    });
  }

  applyLang();
});
