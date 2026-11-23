(() => {
  const groups = [
    { label: "Builds", links: [["generateur.html", "Générateur de builds"]] },
    { label: "Équipement", links: [["arsenal.html", "Personnages & arsenal"], ["collection.html", "Collection d’armes"], ["equiper.html", "Équiper"]] },
    { label: "Activités", links: [["testeur.html", "Testeur de limite"], ["raids.html", "Guides de raids"], ["donjons.html", "Guides de donjons"], ["rapports.html#raid", "Raid Report"], ["rapports.html#donjon", "Donjon Report"]] },
    { label: "Communauté", links: [["partager.html", "Partager un build"], ["clan.html", "Clan"]] }
  ];
  const current = location.pathname.split("/").pop() || "index.html";
  const header = document.createElement("header");
  header.className = "vigie-topbar";
  const brand = document.createElement("a");
  brand.className = "vigie-brand";
  brand.href = "index.html";
  brand.innerHTML = '<span class="vigie-mark"><span>✦</span></span> VIGIE <small>ARSENAL DU GARDIEN</small>';
  if (current === "index.html") brand.setAttribute("aria-current", "page");
  brand.setAttribute("aria-label", "VIGIE, accueil");
  header.appendChild(brand);
  const nav = document.createElement("nav");
  nav.className = "vigie-nav";
  nav.setAttribute("aria-label", "Navigation principale");
  groups.forEach((group, index) => {
    const menu = document.createElement("details");
    menu.className = "vigie-menu";
    menu.dataset.menu = String(index);
    const summary = document.createElement("summary");
    summary.textContent = group.label;
    summary.setAttribute("aria-label", group.label);
    const panel = document.createElement("div");
    panel.className = "vigie-menu-panel";
    panel.setAttribute("aria-label", group.label);
    let groupActive = false;
    group.links.forEach(([href, label]) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      const [file, hash = ""] = href.split("#");
      const activeHash = !hash || (location.hash ? location.hash === "#" + hash : hash === "raid");
      if (file === current && activeHash) {
        link.setAttribute("aria-current", "page");
        groupActive = true;
      }
      panel.appendChild(link);
    });
    if (groupActive) menu.dataset.active = "true";
    menu.append(summary, panel);
    nav.appendChild(menu);
  });
  const login = document.createElement("a");
  login.className = "vigie-login";
  login.href = "oauth.html";
  login.textContent = "Connexion";
  if (current === "oauth.html") login.setAttribute("aria-current", "page");
  nav.appendChild(login);
  header.appendChild(nav);
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) nav.querySelectorAll("details[open]").forEach((item) => { item.open = false; });
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) nav.querySelectorAll("details[open]").forEach((item) => { item.open = false; });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const opened = nav.querySelector("details[open]");
      if (opened) { opened.open = false; opened.querySelector("summary").focus(); }
    }
  });
  nav.querySelectorAll("details").forEach((item) => item.addEventListener("toggle", () => {
    if (item.open) nav.querySelectorAll("details[open]").forEach((other) => { if (other !== item) other.open = false; });
  }));
  const main = document.createElement("main");
  main.className = "page";
  const scripts = Array.from(document.body.children).filter((node) => node.tagName === "SCRIPT");
  Array.from(document.body.childNodes).forEach((node) => {
    if (!(node.nodeType === Node.ELEMENT_NODE && node.tagName === "SCRIPT")) main.appendChild(node);
  });
  document.body.replaceChildren(header, main, ...scripts);
})();