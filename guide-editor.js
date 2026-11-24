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
  function normalizeData(parsed) {
    return {
      version: 1,
      raids: parsed && parsed.raids && typeof parsed.raids === "object" ? parsed.raids : {},
      dungeons: parsed && parsed.dungeons && typeof parsed.dungeons === "object" ? parsed.dungeons : {},
      dungeonMeta: parsed && parsed.dungeonMeta && typeof parsed.dungeonMeta === "object" ? parsed.dungeonMeta : {}
    };
  }
  function hasGuideEdits(value) {
    return ["raids", "dungeons", "dungeonMeta"].some((key) => Object.keys(value[key] || {}).length > 0);
  }
  function readData() {
    try {
      return normalizeData(JSON.parse(localStorage.getItem(KEY) || "{}"));
    } catch (_) {
      return normalizeData({});
    }
  }
  let data = readData();
  let editing = false;
  let mutating = false;
  let sharedLoaded = false;
  const completedUploads = new Map();

  const panel = el("section", "guide-editor");
  panel.setAttribute("aria-labelledby", "guide-editor-title");
  const heading = el("div", "guide-editor-heading");
  heading.append(el("span", "guide-editor-kicker", "Guide partagé"), el("h2", "", "Adapter ce guide"));
  panel.appendChild(heading);
  panel.appendChild(el("p", "guide-editor-note", "Active le mode édition puis modifie les textes ou les images. Clique sur « Publier pour tout le monde » pour enregistrer les changements dans le guide commun. La publication est réservée au compte Bungie propriétaire ; les visiteurs peuvent consulter la version partagée."));
  const actions = el("div", "guide-editor-actions");
  const toggleButton = el("button", "guide-editor-toggle", "Activer le mode édition");
  toggleButton.type = "button";
  const saveButton = el("button", "guide-editor-save", "Publier pour tout le monde");
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
  const mapLabel = el("label", "guide-editor-map-label", "Images personnalisées de la salle (une URL par ligne, six maximum)");
  const mapInput = document.createElement("textarea");
  mapInput.rows = 4;
  mapInput.placeholder = "https://exemple.com/capture-1.png\nhttps://exemple.com/capture-2.png";
  mapInput.spellcheck = false;
  mapInput.setAttribute("aria-describedby", "guide-editor-status");
  mapLabel.appendChild(mapInput);
  panel.appendChild(mapLabel);
  const imageFileLabel = el("label", "guide-editor-map-label", "Importer des images depuis cet appareil");
  const imageFileInput = document.createElement("input");
  imageFileInput.type = "file";
  imageFileInput.accept = "image/png,image/jpeg,image/webp,image/gif";
  imageFileInput.multiple = true;
  imageFileInput.setAttribute("aria-describedby", "guide-editor-file-hint");
  const imageFileHint = el("span", "guide-editor-file-hint", "PNG, JPEG, WebP ou GIF · 5 Mo maximum par image, six images maximum par rencontre. Elles seront visibles par tous après publication.");
  imageFileHint.id = "guide-editor-file-hint";
  imageFileLabel.append(imageFileInput, imageFileHint);
  panel.appendChild(imageFileLabel);
  const status = el("p", "guide-editor-status", "Chargement du guide commun…");
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
  function persist(message) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      status.textContent = message || "Brouillon enregistré sur cet appareil. Clique sur « Publier pour tout le monde » pour le partager.";
      return true;
    } catch (_) {
      status.textContent = "Le navigateur n’a pas pu enregistrer le brouillon. Essaie d’exporter une sauvegarde.";
      return false;
    }
  }
  function guideEndpoint() {
    const api = window.VIGIE_BUNGIE;
    if (!api || typeof api.getWorkerUrl !== "function") throw new Error("Le relais VIGIE n’est pas disponible. Recharge la page.");
    return api.getWorkerUrl().replace(/\/$/, "") + "/guides";
  }
  function guideImageUploadEndpoint() {
    return guideEndpoint().replace(/\/guides$/, "/guides/images");
  }
  const fileTypes = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "image/gif": "GIF"
  };
  const defaultFileHint = "PNG, JPEG, WebP ou GIF · 5 Mo maximum par image, six images maximum par rencontre. Elles seront visibles par tous après publication.";
  imageFileInput.addEventListener("change", () => {
    const files = Array.from(imageFileInput.files || []);
    if (!files.length) {
      imageFileHint.textContent = defaultFileHint;
      return;
    }
    const urls = parseMapInput();
    if (urls.error) {
      imageFileHint.textContent = urls.error;
      return;
    }
    if (urls.urls.length + files.length > 6) {
      imageFileHint.textContent = "Six images maximum par rencontre : retire des URL ou sélectionne moins de fichiers.";
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      imageFileHint.textContent = "Chaque image doit faire au maximum 5 Mo.";
      return;
    }
    if (files.some((file) => !fileTypes[file.type])) {
      imageFileHint.textContent = "Formats acceptés : PNG, JPEG, WebP et GIF.";
      return;
    }
    imageFileHint.textContent = files.length + " image(s) prête(s) à importer. Elles seront partagées lorsque tu publieras le guide.";
  });
  async function uploadSelectedImages() {
    const files = Array.from(imageFileInput.files || []);
    if (!files.length) return true;
    if (!sessionStorage.getItem("jeton")) {
      status.textContent = "Connecte-toi avec le compte Bungie propriétaire via « Connexion » avant d’importer les images.";
      return false;
    }
    const parsedMap = parseMapInput();
    if (parsedMap.error) {
      status.textContent = parsedMap.error;
      return false;
    }
    if (parsedMap.urls.length + files.length > 6) {
      status.textContent = "Six images maximum par rencontre : retire des URL ou sélectionne moins de fichiers.";
      return false;
    }
    if (files.some((file) => file.size < 1 || file.size > 5 * 1024 * 1024)) {
      status.textContent = "Chaque image doit faire entre 1 octet et 5 Mo.";
      return false;
    }
    if (files.some((file) => !fileTypes[file.type])) {
      status.textContent = "Formats acceptés : PNG, JPEG, WebP et GIF.";
      return false;
    }
    imageFileInput.disabled = true;
    saveButton.disabled = true;
    const urls = parsedMap.urls.slice();
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const fingerprint = [file.name, file.size, file.lastModified].join("|");
        let imageUrl = completedUploads.get(fingerprint);
        if (!imageUrl) {
          imageFileHint.textContent = "Import de l’image " + (index + 1) + " sur " + files.length + "…";
          const form = new FormData();
          form.append("image", file, file.name);
          const response = await fetch(guideImageUploadEndpoint(), {
            method: "POST",
            headers: { "Authorization": "Bearer " + sessionStorage.getItem("jeton") },
            body: form
          });
          let result = {};
          try { result = await response.json(); } catch (_) {}
          if (!response.ok || !result.url) throw new Error(result.error || "Impossible d’importer l’image.");
          imageUrl = result.url;
          completedUploads.set(fingerprint, imageUrl);
        }
        urls.push(imageUrl);
      }
      const rec = record("main", true);
      rec.mapUrls = urls;
      delete rec.mapUrl;
      persist("Images importées dans le brouillon. Clique sur « Publier pour tout le monde » pour les partager.");
      mapInput.value = urls.join("\n");
      applyMaps(urls);
      imageFileInput.value = "";
      imageFileHint.textContent = defaultFileHint;
      completedUploads.clear();
      return true;
    } catch (error) {
      imageFileHint.textContent = "Import interrompu. Tu peux réessayer sans perdre les images déjà reçues.";
      status.textContent = error.message || "Impossible d’importer les images. Vérifie ta connexion puis réessaie.";
      return false;
    } finally {
      imageFileInput.disabled = !sharedLoaded;
      saveButton.disabled = !sharedLoaded;
    }
  }
  async function publishData() {
    if (!sharedLoaded) {
      status.textContent = "Attends la fin du chargement du guide commun avant de publier.";
      return false;
    }
    const token = sessionStorage.getItem("jeton");
    if (!token) {
      status.textContent = "Connecte-toi avec le compte Bungie propriétaire via « Connexion », puis publie à nouveau.";
      return false;
    }
    saveButton.disabled = true;
    imageFileInput.disabled = true;
    try {
      const response = await fetch(guideEndpoint(), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(data)
      });
      let result = {};
      try { result = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(result.error || "La publication du guide a échoué.");
      persist();
      status.textContent = "Publié pour tout le monde. Les visiteurs verront cette version du guide.";
      return true;
    } catch (error) {
      status.textContent = error.message || "Impossible de publier le guide. Vérifie ta connexion Internet.";
      return false;
    } finally {
      saveButton.disabled = !sharedLoaded;
      imageFileInput.disabled = !sharedLoaded;
    }
  }
  async function loadSharedGuides() {
    toggleButton.disabled = true;
    saveButton.disabled = true;
    resetButton.disabled = true;
    importButton.disabled = true;
    mapInput.disabled = true;
    imageFileInput.disabled = true;
    try {
      const response = await fetch(guideEndpoint(), { headers: { "Accept": "application/json" }, cache: "no-store" });
      let result = {};
      try { result = await response.json(); } catch (_) {}
      if (!response.ok || !result.edits) throw new Error(result.error || "Le guide partagé est momentanément indisponible.");
      const shared = normalizeData(result.edits);
      const localDraft = readData();
      if (hasGuideEdits(shared)) {
        data = shared;
        try { localStorage.setItem(KEY, JSON.stringify(shared)); } catch (_) {}
        status.textContent = "Version commune chargée pour tous les visiteurs.";
      } else if (hasGuideEdits(localDraft)) {
        data = localDraft;
        status.textContent = "Anciennes modifications locales détectées. Publie-les pour les rendre visibles à tout le monde.";
      } else {
        data = shared;
        status.textContent = "Guide commun chargé. Active le mode édition pour préparer des changements.";
      }
    } catch (error) {
      status.textContent = (error.message || "Le guide commun est momentanément indisponible.") + " Les brouillons locaux restent disponibles.";
    } finally {
      sharedLoaded = true;
      toggleButton.disabled = false;
      saveButton.disabled = false;
      resetButton.disabled = false;
      importButton.disabled = false;
      mapInput.disabled = false;
      imageFileInput.disabled = false;
      mapFields();
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
    const urls = storedMapUrls(rec);
    mapInput.value = urls.join("\n");
    applyMaps(urls);
  }
  function validImageUrl(value) {
    try {
      const parsed = new URL(value);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
    } catch (_) {
      return false;
    }
  }
  function storedMapUrls(rec) {
    const values = rec && Array.isArray(rec.mapUrls) ? rec.mapUrls :
      (rec && typeof rec.mapUrl === "string" && rec.mapUrl ? [rec.mapUrl] : []);
    return values.filter(function (url) { return typeof url === "string" && validImageUrl(url); }).slice(0, 6);
  }
  function parseMapInput() {
    const urls = String(mapInput.value || "").split(/\r?\n/).map(function (url) { return url.trim(); }).filter(Boolean);
    if (urls.length > 6) return { error: "Tu peux ajouter jusqu’à six images par rencontre." };
    if (urls.some(function (url) { return !validImageUrl(url); })) return { error: "Chaque ligne doit contenir une adresse d’image valide en http:// ou https://." };
    return { urls: urls };
  }
  function applyMaps(values) {
    const urls = (Array.isArray(values) ? values : []).filter(validImageUrl).slice(0, 6);
    let gallery = mapCard.querySelector("[data-guide-custom-gallery]");
    const existing = gallery ? Array.from(gallery.querySelectorAll("img")).map(function (img) { return img.getAttribute("src"); }) : [];
    if (!urls.length) {
      if (gallery) gallery.remove();
      return;
    }
    if (gallery && urls.length === existing.length && urls.every(function (url, i) { return url === existing[i]; })) return;
    if (!gallery) {
      gallery = el("div", "guide-custom-gallery");
      gallery.dataset.guideCustomGallery = "true";
      mapCard.appendChild(gallery);
    }
    const figures = urls.map(function (url, index) {
      const figure = el("figure", "guide-custom-map");
      const link = el("a", "");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Image personnalisée " + (index + 1) + " de la salle";
      img.loading = "lazy";
      img.decoding = "async";
      link.appendChild(img);
      figure.append(link, el("figcaption", "guide-custom-map-caption", "Image personnalisée " + (index + 1) + " · ouvrir en grand"));
      return figure;
    });
    gallery.replaceChildren.apply(gallery, figures);
  }
  function collectFields() {
    const parsedMap = parseMapInput();
    if (parsedMap.error) {
      status.textContent = parsedMap.error;
      return false;
    }
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
    rec.mapUrls = parsedMap.urls;
    delete rec.mapUrl;
    persist("Brouillon prêt. Clique sur « Publier pour tout le monde » pour le partager.");
    applyMaps(parsedMap.urls);
    return true;
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
      status.textContent = "Mode édition désactivé. Publie ton brouillon pour le rendre visible à tous.";
    }
  });
  saveButton.addEventListener("click", async () => {
    if (!await uploadSelectedImages()) return;
    if (collectFields()) await publishData();
  });
  resetButton.addEventListener("click", async () => {
    const previous = JSON.stringify(data);
    if (page === "raids") delete data.raids[selection().main];
    else {
      delete data.dungeons[selection().main];
      delete data.dungeonMeta[selection().meta];
    }
    persist("Cette activité est réinitialisée dans le brouillon. Publication en cours…");
    if (await publishData()) location.reload();
    else {
      data = normalizeData(JSON.parse(previous));
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
      mapFields();
    }
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
      data = normalizeData(incoming);
      mapFields();
      persist("Sauvegarde importée en brouillon. Publication en cours…");
      if (await publishData()) location.reload();
    } catch (_) {
      status.textContent = "Ce fichier n’est pas une sauvegarde VIGIE valide.";
      importFile.value = "";
    }
  });
  mapInput.addEventListener("change", () => {
    const parsedMap = parseMapInput();
    if (parsedMap.error) {
      status.textContent = parsedMap.error;
      return;
    }
    const rec = record("main", true);
    rec.mapUrls = parsedMap.urls;
    delete rec.mapUrl;
    persist();
    applyMaps(parsedMap.urls);
  });
  [raidSelect, dungeonSelect, encounterSelect].filter(Boolean).forEach((select) => select.addEventListener("change", () => {
    mapFields();
    status.textContent = "Activité chargée. Les modifications sauvegardées pour cette rencontre sont appliquées.";
  }));
  const lightbox = document.createElement("dialog");
  lightbox.className = "guide-lightbox";
  lightbox.setAttribute("aria-label", "Aperçu agrandi de l’image du guide");
  const lightboxHeader = el("div", "guide-lightbox-header");
  lightboxHeader.appendChild(el("span", "guide-lightbox-title", "Image du guide"));
  const lightboxClose = el("button", "guide-lightbox-close", "Fermer");
  lightboxClose.type = "button";
  lightboxClose.addEventListener("click", () => {
    if (typeof lightbox.close === "function") lightbox.close();
    else lightbox.removeAttribute("open");
  });
  lightboxHeader.appendChild(lightboxClose);
  const lightboxImage = document.createElement("img");
  lightboxImage.className = "guide-lightbox-image";
  lightboxImage.alt = "";
  const lightboxCaption = el("p", "guide-lightbox-caption", "");
  lightbox.append(lightboxHeader, lightboxImage, lightboxCaption);
  document.body.appendChild(lightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      if (typeof lightbox.close === "function") lightbox.close();
      else lightbox.removeAttribute("open");
    }
  });
  mapCard.addEventListener("click", (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a");
    const sourceImage = link && link.querySelector("img");
    if (!sourceImage) return;
    event.preventDefault();
    lightboxImage.src = sourceImage.currentSrc || sourceImage.src;
    lightboxImage.alt = sourceImage.alt || "Image agrandie du guide";
    const figure = sourceImage.closest("figure");
    const caption = figure && figure.querySelector("figcaption");
    lightboxCaption.textContent = caption ? String(caption.innerText || caption.textContent || "").trim() : (sourceImage.alt || "");
    try {
      if (typeof lightbox.showModal === "function") lightbox.showModal();
      else lightbox.setAttribute("open", "");
    } catch (_) {
      lightbox.setAttribute("open", "");
    }
    lightboxClose.focus();
  });
  const observer = new MutationObserver(() => {
    if (mutating) return;
    mutating = true;
    mapFields();
    mutating = false;
  });
  [encounterCard, mapCard, summaryNode, routeContent].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true }));
  mapFields();
  loadSharedGuides();
})();