(() => {
  const links = [
    ["generateur.html", "Builds"],
    ["partager.html", "Partager"],
    ["collection.html", "Collection"],
    ["raids.html", "Raids"],
    ["rapports.html#raid", "Raid Report"],
    ["rapports.html#donjon", "Donjon Report"],
    ["clan.html", "Clan"],
    ["arsenal.html", "Arsenal"],
    ["equiper.html", "Équiper"]
  ];
  const current = location.pathname.split("/").pop() || "index.html";
  const header = document.createElement("header");
  header.className = "vigie-topbar";

  const brand = document.createElement("a");
  brand.className = "vigie-brand";
  brand.href = "index.html";
  brand.innerHTML = '<span class="vigie-mark"><span>✦</span></span> VIGIE <small>ARSENAL DU GARDIEN</small>';
  header.appendChild(brand);

  const nav = document.createElement("nav");
  nav.className = "vigie-nav";
  nav.setAttribute("aria-label", "Navigation principale");
  links.forEach(([href, label]) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    const linkHash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
    const activeHash = linkHash ? (linkHash === location.hash || (!location.hash && linkHash === "#raid")) : true;
    if (href.split("#")[0] === current && activeHash) link.setAttribute("aria-current", "page");
    nav.appendChild(link);
  });
  header.appendChild(nav);

  const main = document.createElement("main");
  main.className = "page";
  const scripts = Array.from(document.body.children).filter((node) => node.tagName === "SCRIPT");
  Array.from(document.body.childNodes).forEach((node) => {
    if (!(node.nodeType === Node.ELEMENT_NODE && node.tagName === "SCRIPT")) main.appendChild(node);
  });
  document.body.replaceChildren(header, main, ...scripts);
})();

