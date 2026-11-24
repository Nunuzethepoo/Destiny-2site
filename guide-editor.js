(() => {
  "use strict";
  const isRaid = location.pathname.toLowerCase().endsWith("/raids.html") || location.pathname.toLowerCase().endsWith("raids.html");
  const page = isRaid ? "raids" : "donjons";
  const KEY = "vigieGuidesPersoV1";
  const raidSelect = document.getElementById("raidSelect");
  const dungeonSelect = document.getElementById("dungeonSelect");
  const encounterSelect = document.getElementById("encounterSelect");
  const encounterCard = document.getElementById("encounterCard");
  const mapCard = document.getElementById("mapCard");
  if (!encounterSelect || !encounterCard || !mapCard || (isRaid && !raidSelect) || (!isRaid && !dungeonSelect)) return;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function readData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
      return {
        version: 1,
        raids: parsed.raids && typeof parsed.raids === "object" ? parsed.raids : {},
        dungeons: parsed.dungeons && typeof parsed.dungeons === "object" ? parsed.dungeons : {},
        dungeonMeta: parsed.dungeonMeta && typeof parsed.dungeonMeta === "object" ? parsed.dungeonMeta : {}
      };
    } catch (_) {
      return { version: 1, raids: {}, dungeons: {}, dungeonMeta: {} };
    }
  }
  let data = readData();
  let editing = false;
  let mutating = false;

  const panel = el("section", "guide-editor");
  panel.setAttribute("aria-labelledby", "guide-editor-title");
  const heading = el("div", "guide-editor-heading");
  heading.append(el("span", "guide-editor-kicker", "Personnalisation locale"), el("h2", "", "Adapter ce guide"));
  panel.appendChild(heading);
  panel.appendChild(el("p", "guide-editor-note", "Active le mode édition, puis clique sur les textes encadrés pour les modifier. Les changements sont enregistrés sur cet appareil et ne changent pas la version vue par les autres visiteurs."));
  const actions = el("div", "guide-editor-actions");
  const toggleButton = el("button", "guide-editor-toggle", "Activer le mode édition");
  toggleButton.type = "button";
  const saveButton = el("button", "guide-editor-save", "Enregistrer sur cet appareil");
  saveButton.type = "button";
  const resetButton = el("button", "guide-editor-secondary", "Restaurer cette activité");
  resetButton.type = "button";
  const exportButton = el("button", "guide-editor-secondary", "Exporter mes modifications");
  exportButton.type = "button";
  const importButton = el("button", "guide-editor-secondary", "Importer une sauvegarde");
  importButton.type = "button";
  const importFile = document.createElement("input");
  importFile.type = "file";
  importFile.accept = "application/json,.json";
  importFile.hidden = true;
  actions.append(toggleButton, saveButton, resetButton, exportButton, importButton, importFile);
  panel.appendChild(actions);
  const mapLabel = el("label", "guide-editor-map-label", "Image personnalisée de la salle (URL publique)");
  const mapInput = document.createElement("input");
  mapInput.type = "url";
  mapInput.placeholder = "https://exemple.com/ma-capture.png";
  mapInput.autocomplete = "off";
  mapInput.setAttribute("aria-describedby", "guide-editor-status");
  mapLabel.appendChild(mapInput);
  panel.appendChild(mapLabel);
  const status = el("p", "guide-editor-status", "Guide standard affiché. Tes modifications resteront privées à ce navigateur.");
  status.id = "guide-editor-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  panel.appendChild(status);
  const anchor = document.querySelector(isRaid ? ".raid-toolbar" : ".dungeon-toolbar");
  if (anchor) anchor.parentNode.insertBefore(panel, anchor);

  function selection() {
    if (isRaid) return { main: String(raidSelect.value) + ":" + String(encounterSelect.value), meta: "" };
    return { main: String(dungeonSelect.value) + ":" + String(encounterSelect.value), meta: String(dungeonSelect.value) };
  }
  function record(scope, create) {
    const ids = selection();
    const bucket = page === "raids" ? data.raids : (scope === "meta" ? data.dungeonMeta : data.dungeons);
    const id = scope === "meta" ? ids.meta : ids.main;
    if (!bucket[id] && create) bucket[id] = { fields: {}, mapUrl: "" };
    if (!bucket[id] || typeof bucket[id] !== "object") return null;
    if (!bucket[id].fields || typeof bucket[id].fields !== "object") bucket[id].fields = {};
    return bucket[id];
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      status.textContent = "Modifications enregistrées sur cet appareil. Exporte-les pour les transférer.";
    } catch (_) {
      status.textContent = "Le navigateur n’a pas pu enregistrer ces modifications. Essaie d’exporter une sauvegarde.";
    }
  }
  function bind(node, field, scope) {
    if (!node) return;
    node.dataset.guideField = field;
    node.dataset.guideScope = scope || "main";
    const rec = record(scope || "main", false);
    const stamp = (scope || "main") + ":" + selection().main + ":" + selection().meta;
    if (node.dataset.guideApplied !== stamp) {
      if (rec && Object.prototype.hasOwnProperty.call(rec.fields, field)) {
        const value = rec.fields[field];
        if (typeof value === "string") node.textContent = value;
      }
      node.dataset.guideApplied = stamp;
    }
    node.contentEditable = editing ? "true" : "false";
    node.classList.toggle("guide-editor-editable", editing);
    node.spellcheck = true;
    node.setAttribute("aria-label", "Texte modifiable : " + field.replace(/[_-]/g, " "));
  }
  function mapFields() {
    if (isRaid) {
      bind(encounterCard.querySelector("h2"), "titre");
      bind(encounterCard.querySelector(".encounter-lead"), "objectif");
      encounterCard.querySelectorAll(".roles .role span").forEach((node, i) => bind(node, "role_" + i));
      encounterCard.querySelectorAll(".step-card .step-copy > p").forEach((node, i) => bind(node, "etape_" + i));
      encounterCard.querySelectorAll(".beginner-help > p").forEach((node, i) => bind(node, "aide_" + i));
      bind(encounterCard.querySelector(".callout"), "repere");
    } else {
      bind(encounterCard.querySelector("h3"), "titre");
      bind(encounterCard.querySelector(".encounter-goal"), "objectif");
      bind(encounterCard.querySelector(".guide-team-copy"), "organisation");
      encounterCard.querySelectorAll(".step-card p").forEach((node, i) => bind(node, "etape_" + i));
      bind(encounterCard.querySelector(".recovery-box h4"), "depannage_titre");
      bind(encounterCard.querySelector(".recovery-box p"), "depannage");
      const summary = document.querySelector("#dungeonSummary p");
      bind(summary, "description", "meta");
      document.querySelectorAll("#routeContent li").forEach((node, i) => bind(node, "route_" + i, "meta"));
    }
    const rec = record("main", false);
    mapInput.value = rec && typeof rec.mapUrl === "string" ? rec.mapUrl : "";
    applyMap(mapInput.value);
  }
  function validImageUrl(value) {
    try {
      const parsed = new URL(value);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
    } catch (_) {
      return false;
    }
  }
  function applyMap(value) {
    const custom = mapCard.querySelector("[data-guide-custom-map]");
    let img = mapCard.querySelector(".room-photo, .real-map-figure img, figure img");
    if (value && validImageUrl(value)) {
      if (!img) {
        const figure = el("figure", "guide-custom-map");
        const link = el("a", "");
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        img = document.createElement("img");
        img.alt = "Image de salle ajoutée par l’utilisateur";
        img.loading = "lazy";
        img.decoding = "async";
        figure.dataset.guideCustomMap = "true";
        link.appendChild(img);
        figure.appendChild(link);
        mapCard.appendChild(figure);
        img.dataset.guideCustomCreated = "true";
      }
      img.src = value;
      const link = img.closest("a");
      if (link) link.href = value;
    } else if (custom) {
      custom.remove();
    }
  }
  function collectFields() {
    [encounterCard, document.getElementById("dungeonSummary"), document.getElementById("routeContent")]
      .filter(Boolean)
      .forEach((root) => {
        root.querySelectorAll("[data-guide-field]").forEach((node) => {
          const scope = node.dataset.guideScope || "main";
          const rec = record(scope, true);
          rec.fields[node.dataset.guideField] = String(node.innerText || node.textContent || "").trim();
        });
      });
    const rec = record("main", true);
    rec.mapUrl = mapInput.value.trim();
    persist();
  }
  function onInput(event) {
    const node = event.target.closest("[data-guide-field]");
    if (!node) return;
    const scope = node.dataset.guideScope || "main";
    const rec = record(scope, true);
    rec.fields[node.dataset.guideField] = String(node.innerText || node.textContent || "").trim();
    persist();
  }
  encounterCard.addEventListener("input", onInput);
  const routeContent = document.getElementById("routeContent");
  const summaryNode = document.getElementById("dungeonSummary");
  if (routeContent) routeContent.addEventListener("input", onInput);
  if (summaryNode) summaryNode.addEventListener("input", onInput);

  toggleButton.addEventListener("click", () => {
    editing = !editing;
    toggleButton.textContent = editing ? "Terminer le mode édition" : "Activer le mode édition";
    panel.classList.toggle("is-editing", editing);
    mapFields();
    if (editing) {
      const first = document.querySelector(".guide-editor-editable");
      if (first) first.focus();
      status.textContent = "Mode édition actif : clique sur un texte encadré et modifie-le.";
    } else {
      status.textContent = "Mode édition désactivé. Les dernières saisies restent enregistrées sur cet appareil.";
    }
  });
  saveButton.addEventListener("click", collectFields);
  resetButton.addEventListener("click", () => {
    if (page === "raids") delete data.raids[selection().main];
    else {
      delete data.dungeons[selection().main];
      delete data.dungeonMeta[selection().meta];
    }
    persist();
    location.reload();
  });
  exportButton.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "VIGIE-guides-personnalises.json";
    link.click();
    URL.revokeObjectURL(href);
    status.textContent = "Sauvegarde JSON exportée. Tu peux la conserver ou l’importer sur un autre navigateur.";
  });
  importButton.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    if (file.size > 2000000) {
      status.textContent = "Le fichier dépasse la taille autorisée de 2 Mo.";
      importFile.value = "";
      return;
    }
    try {
      const incoming = JSON.parse(await file.text());
      if (!incoming || incoming.version !== 1 || !incoming.raids || !incoming.dungeons || !incoming.dungeonMeta) throw new Error("format");
      data = { version: 1, raids: incoming.raids, dungeons: incoming.dungeons, dungeonMeta: incoming.dungeonMeta };
      persist();
      location.reload();
    } catch (_) {
      status.textContent = "Ce fichier n’est pas une sauvegarde VIGIE valide.";
      importFile.value = "";
    }
  });
  mapInput.addEventListener("change", () => {
    const value = mapInput.value.trim();
    if (value && !validImageUrl(value)) {
      status.textContent = "Entre une adresse d’image valide commençant par http:// ou https://.";
      return;
    }
    const rec = record("main", true);
    rec.mapUrl = value;
    persist();
    applyMap(value);
  });
  [raidSelect, dungeonSelect, encounterSelect].filter(Boolean).forEach((select) => select.addEventListener("change", () => {
    mapFields();
    status.textContent = "Activité chargée. Les modifications sauvegardées pour cette rencontre sont appliquées.";
  }));
  const observer = new MutationObserver(() => {
    if (mutating) return;
    mutating = true;
    mapFields();
    mutating = false;
  });
  [encounterCard, mapCard, summaryNode, routeContent].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true }));
  mapFields();
})();