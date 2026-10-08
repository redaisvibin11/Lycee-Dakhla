document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chat-form");
  const userInput = document.getElementById("user-input");
  const chatMessages = document.getElementById("chat-messages");
  const announcementsContainer = document.getElementById("announcements-list");
  const projectsContainer = document.getElementById("projects-list");

  // Prevent SPA/interceptor scripts from blocking admin route navigation
  document.querySelectorAll('a[href^="/admin"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  // Fetch announcements
  if (announcementsContainer) {
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.length === 0) {
          announcementsContainer.innerHTML =
            "<p>Aucune annonce pour le moment.</p>";
          return;
        }
        announcementsContainer.innerHTML = data
          .map(
            (item) => `
          <div class="card">
            ${
              item.image_url
                ? `<img src="${item.image_url}" alt="${item.title}" class="card-img" />`
                : ""
            }
            <h3>${item.title}</h3>
            <p>${item.content}</p>
            <small>Par ${item.signature || "Le Proviseur"} - ${
              item.created_at
            }</small>
          </div>
        `,
          )
          .join("");
      })
      .catch((err) => {
        console.error("Error loading announcements:", err);
      });
  }

  // Fetch projects
  if (projectsContainer) {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.length === 0) {
          projectsContainer.innerHTML =
            "<p>Aucun projet d'élève disponible.</p>";
          return;
        }
        projectsContainer.innerHTML = data
          .map(
            (item) => `
          <div class="card">
            ${
              item.image_url
                ? `<img src="${item.image_url}" alt="${item.title}" class="card-img" />`
                : ""
            }
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <small>Réalisé par : ${item.student_name}</small>
          </div>
        `,
          )
          .join("");
      })
      .catch((err) => {
        console.error("Error loading projects:", err);
      });
  }

  // Chat interface handling
  if (chatForm && userInput && chatMessages) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const message = userInput.value.trim();
      if (!message) return;

      appendMessage("user", message);
      userInput.value = "";

      const botMessageElement = appendMessage("assistant", "...");

      try {
        const response = await fetch("/api/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message }),
        });

        if (!response.ok) {
          botMessageElement.textContent =
            "Erreur lors de la communication avec Najm.";
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        botMessageElement.textContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          botMessageElement.textContent += decoder.decode(value, {
            stream: true,
          });
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      } catch (err) {
        console.error("Chat error:", err);
        botMessageElement.textContent = "Impossible de contacter le serveur.";
      }
    });
  }

  function appendMessage(role, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", role);
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
  }
});
