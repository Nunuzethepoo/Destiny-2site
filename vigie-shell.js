(() => {
  const links = [
    ["index.html", "Accueil"],
    ["generateur.html", "Builds"],
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
    if (href === current) link.setAttribute("aria-current", "page");
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
