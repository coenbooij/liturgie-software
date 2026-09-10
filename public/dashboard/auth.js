// Wachtwoordgate voor de beheerpagina's. Het wachtwoord wordt door de server gecontroleerd
// en in localStorage bewaard, zodat een PWA op de telefoon het niet elke keer opnieuw vraagt.
(function (global) {
  "use strict";

  const KEY = "liturgieWachtwoord";

  function getWachtwoord() {
    try {
      return localStorage.getItem(KEY) || "";
    } catch (err) {
      return "";
    }
  }

  function remember(wachtwoord) {
    try {
      localStorage.setItem(KEY, wachtwoord);
    } catch (err) {
      // Opslag niet beschikbaar (privémodus): dan vraagt de gate het de volgende keer opnieuw.
    }
  }

  function forget() {
    try {
      localStorage.removeItem(KEY);
    } catch (err) {
      // niets te doen
    }
  }

  function authHeaders() {
    return { "X-Wachtwoord": getWachtwoord() };
  }

  // Geeft true (goed), false (fout wachtwoord) of gooit bij een netwerkfout.
  async function verify(wachtwoord) {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wachtwoord }),
    });
    return res.ok;
  }

  function buildGate() {
    const gate = document.createElement("div");
    gate.className = "auth-gate";
    gate.innerHTML = `
      <div class="auth-card">
        <h2>Beveiligd</h2>
        <p>Voer het wachtwoord in om verder te gaan.</p>
        <input type="password" placeholder="Wachtwoord" autocomplete="current-password" />
        <button type="button">Ontgrendelen</button>
        <div class="auth-error"></div>
      </div>`;
    document.body.appendChild(gate);
    return gate;
  }

  // Toont de gate als er nog geen geldig wachtwoord is. Roept onReady aan zodra dat er is.
  async function ensureAuth(onReady) {
    const stored = getWachtwoord();
    if (stored) {
      try {
        if (await verify(stored)) {
          onReady();
          return;
        }
        // Wachtwoord is veranderd: opnieuw vragen.
        forget();
      } catch (err) {
        // Server even niet bereikbaar: bewaard wachtwoord houden, de pagina meldt de fout zelf.
        onReady();
        return;
      }
    }

    const gate = buildGate();
    const input = gate.querySelector("input");
    const button = gate.querySelector("button");
    const error = gate.querySelector(".auth-error");

    async function tryUnlock() {
      const value = input.value.trim();
      if (!value) return;
      button.disabled = true;
      error.textContent = "";
      try {
        if (await verify(value)) {
          remember(value);
          gate.remove();
          onReady();
        } else {
          error.textContent = "Onjuist wachtwoord.";
        }
      } catch (err) {
        error.textContent = "Server niet bereikbaar.";
      } finally {
        button.disabled = false;
      }
    }

    button.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryUnlock();
      }
    });
    input.focus();
  }

  global.LiturgieAuth = { ensureAuth, authHeaders, forget };
})(window);
