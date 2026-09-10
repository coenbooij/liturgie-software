// Gedeelde renderlogica voor het letterbord.
// Gebruikt door /liturgie (weergave) en /dashboard (editor).
(function (global) {
  "use strict";

  // Tekens die een smal blokje krijgen.
  const NARROW = new Set([":", ";", ",", "."]);
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

  function esc(ch) {
    return ESCAPES[ch] || ch;
  }

  // Zet een regel tekst om in blokjes-HTML.
  function styleLineContent(text) {
    return Array.from(text)
      .map((ch) => {
        if (ch === " " || ch === " ") return '<span class="space">&nbsp;</span>';
        if (NARROW.has(ch)) return `<span class="semicolon">${esc(ch)}</span>`;
        return `<span class="letter-block">${esc(ch)}</span>`;
      })
      .join("");
  }

  function lineHtml(line, editable) {
    const attr = editable ? ' contenteditable="true"' : "";
    if (line.trim() === "") {
      return `<div class="liturgie-line empty-line"${attr}>&nbsp;</div>`;
    }
    return `<div class="liturgie-line"${attr}>${styleLineContent(line)}</div>`;
  }

  // Vult een bestaand regelelement opnieuw met opgemaakte tekst.
  function styleLine(lineEl, text) {
    const empty = text === "";
    lineEl.classList.toggle("empty-line", empty);
    lineEl.innerHTML = empty ? "&nbsp;" : styleLineContent(text);
  }

  // Leest de platte tekst van een regelelement terug.
  function lineText(lineEl) {
    let text = lineEl.textContent;
    if (lineEl.classList.contains("empty-line")) {
      // Placeholder-nbsp van een lege regel telt niet mee.
      text = text.replace(/ /g, "");
    }
    return text.replace(/ /g, " ");
  }

  // Markeert regels die buiten het scherm vallen. Geeft het aantal terug.
  function markOverflow(el, container) {
    const available = container.clientHeight;
    let count = 0;
    for (const lineEl of el.children) {
      const outside =
        !lineEl.classList.contains("empty-line") &&
        lineEl.offsetTop + lineEl.offsetHeight > available + 1;
      lineEl.classList.toggle("buiten-scherm", outside);
      if (outside) count++;
    }
    return count;
  }

  // Rendert de volledige tekst in el en vult de rest van de container met lege regels.
  function render(el, tekst, options) {
    const editable = Boolean(options && options.editable);
    const container = (options && options.container) || el.parentElement;
    const lines = String(tekst || "").split("\n");

    el.innerHTML = lines.map((line) => lineHtml(line, editable)).join("");

    const overflow = markOverflow(el, container);

    // Opvullen met lege regels tot de container vol is (gemeten, niet berekend).
    const available = container.clientHeight;
    let guard = 0;
    while (el.offsetHeight < available && guard < 200) {
      el.insertAdjacentHTML("beforeend", lineHtml("", editable));
      guard++;
    }

    // De laatste opvulregel precies afknippen, zodat de inhoud nooit groter is dan
    // de container en er dus niets te scrollen valt (ook niet via de caret).
    const excess = el.offsetHeight - available;
    const last = el.lastElementChild;
    if (excess > 0 && last && last.classList.contains("empty-line")) {
      last.style.height = `${Math.max(0, last.offsetHeight - excess)}px`;
    }

    return { overflow, lineCount: lines.length };
  }

  global.LiturgieRender = { styleLineContent, styleLine, lineText, markOverflow, render };
})(window);
