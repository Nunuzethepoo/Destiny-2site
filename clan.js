(() => {
  const status = document.getElementById("clanStatus");
  const clanSelect = document.getElementById("clanSelect");
  const search = document.getElementById("memberSearch");
  const membersEl = document.getElementById("clanMembers");
  const reportEl = document.getElementById("memberReports");
  const loadButton = document.getElementById("loadClan");
  let groups = [];
  let allMembers = [];
  let currentGroup = null;
  let page = 1;
  let currentTotalPages = 1;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  async function request(path) {
    const response = await VIGIE_BUNGIE.fetchApi(path);
    let data;
    try { data = await response.json(); } catch (_) { throw new Error("Bungie a renvoyé une réponse illisible."); }
    if (!response.ok || (data.ErrorCode !== undefined && data.ErrorCode !== 1)) throw new Error(data.Message || data.ErrorStatus || `Erreur Bungie HTTP ${response.status}.`);
    return data.Response;
  }
  function memberInfo(item) { return item.destinyUserInfo || item.member || item; }
  function memberName(item) {
    const member = memberInfo(item);
    const name = member.bungieGlobalDisplayName || member.displayName || "Gardien";
    const code = member.bungieGlobalDisplayNameCode;
    return code ? `${name}#${String(code).padStart(4, "0")}` : name;
  }
  function groupInfo(item) { return item.group || item; }
  function friendlyError(error) {
    const message = String(error && error.message || "");
    if (/403|permission|scope|InsufficientPrivileges/i.test(message)) return "Bungie refuse la lecture du clan. Active ‘Read Group/Clan Forums, Wall and Members’ sur ton application Bungie, puis déconnecte-toi et reconnecte-toi à VIGIE.";
    return message || "Impossible de charger le clan Bungie.";
  }
  async function findGroups() {
    if (!sessionStorage.getItem("jeton")) throw new Error("Connecte-toi à Bungie pour consulter ton clan.");
    const account = await VIGIE_ACTIVITY_REPORTS.getPrimaryAccount();
    const response = await request(`/GroupV2/User/${account.membershipType}/${account.membershipId}/0/1/`);
    groups = (response.results || []).map(groupInfo).filter(group => group.groupId);
    if (!groups.length) {
      status.textContent = "Aucun clan Bungie n’est associé au profil principal de ce compte.";
      clanSelect.innerHTML = '<option value="">Aucun clan trouvé</option>';
      clanSelect.disabled = true;
      search.disabled = true;
      membersEl.innerHTML = '<div class="report-empty">Connecte-toi avec le compte Destiny membre du clan. Les clans liés à un autre profil Bungie ne s’afficheront pas ici.</div>';
      return;
    }
    clanSelect.innerHTML = groups.map((group, index) => `<option value="${index}">${escapeHtml(group.name || "Clan sans nom")} · ${Number(group.memberCount) || "?"} membres</option>`).join("");
    clanSelect.disabled = groups.length < 2;
    search.disabled = false;
    await loadMembers(0);
  }
  async function loadMembers(groupIndex) {
    currentGroup = groups[Number(groupIndex) || 0];
    if (!currentGroup) return;
    page = 1;
    allMembers = [];
    status.textContent = `Chargement des membres de ${currentGroup.name || "ton clan"}…`;
    await fetchPage();
  }
  async function fetchPage() {
    if (!currentGroup) return;
    status.textContent = `Chargement de la page ${page}…`;
    const data = await request(`/GroupV2/${currentGroup.groupId}/Members/?currentpage=${page}&memberType=0`);
    allMembers = (data.results || []).map(item => item.member || item).filter(item => memberInfo(item).membershipId);
    currentTotalPages = Math.max(1, Number(data.totalPages) || Math.ceil((Number(data.totalResults) || Number(currentGroup.memberCount) || 0) / 50));
    status.textContent = `${currentGroup.name || "Clan"} · ${data.totalResults ?? currentGroup.memberCount ?? allMembers.length} membres · page ${page}/${currentTotalPages}`;
    renderMembers();
  }
  function renderMembers() {
    const query = search.value.trim().toLocaleLowerCase("fr");
    const filtered = allMembers.filter(item => memberName(item).toLocaleLowerCase("fr").includes(query));
    membersEl.innerHTML = `<div class="member-list">${filtered.map((item, index) => {
      const member = memberInfo(item);
      return `<button class="member-card" type="button" data-index="${index}"><span class="member-glyph">✦</span><span class="member-name">${escapeHtml(memberName(item))}</span><span class="member-role">${escapeHtml(item.memberTypeName || (item.isOnline ? "En ligne" : "Membre"))}</span></button>`;
    }).join("") || '<div class="report-empty">Aucun membre correspondant sur cette page.</div>'}</div><div class="clan-pagination"><button type="button" data-page="prev" ${page <= 1 ? "disabled" : ""}>← Précédents</button><span>Page ${page} / ${currentTotalPages}</span><button type="button" data-page="next" ${page >= currentTotalPages ? "disabled" : ""}>Suivants →</button></div>`;
    membersEl.querySelectorAll(".member-card").forEach(button => button.addEventListener("click", () => selectMember(filtered[Number(button.dataset.index)])));
    membersEl.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", async () => {
      page += button.dataset.page === "next" ? 1 : -1;
      try { await fetchPage(); } catch (error) { status.textContent = friendlyError(error); }
    }));
  }
  function selectMember(item) {
    const member = memberInfo(item);
    const membershipType = Number(member.membershipType);
    const membershipId = String(member.membershipId || "");
    if (!membershipType || !membershipId) {
      reportEl.innerHTML = '<div class="report-empty">Le profil Destiny de ce membre n’est pas disponible.</div>';
      return;
    }
    reportEl.innerHTML = `<div class="member-report-heading"><p class="activity-kicker">RAPPORTS PUBLICS DU CLAN</p><h2>${escapeHtml(memberName(item))}</h2><p>Les rapports apparaissent selon la visibilité des activités du membre sur Bungie.</p></div><div class="report-tabs member-report-tabs"><button type="button" data-mode="raid" aria-selected="true">Raid Report</button><button type="button" data-mode="dungeon" aria-selected="false">Donjon Report</button></div><div class="member-report-status" role="status">Chargement des activités…</div><div class="member-report-results"></div>`;
    const tabs = reportEl.querySelectorAll("[data-mode]");
    const results = reportEl.querySelector(".member-report-results");
    const reportStatus = reportEl.querySelector(".member-report-status");
    const account = { membershipType, membershipId };
    let busy = false;
    async function show(mode) {
      tabs.forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.mode === mode)));
      if (busy) return;
      busy = true;
      reportStatus.textContent = "Chargement de l’historique Bungie…";
      try {
        await VIGIE_ACTIVITY_REPORTS.renderReports(results, { ...account, mode });
        reportStatus.textContent = "";
      } catch (error) {
        const message = String(error && error.message || "");
        reportStatus.textContent = /403|404|privacy|private|profil|character/i.test(message)
          ? "Profil ou historique privé sur Bungie, ou aucun personnage visible pour ce compte. Le membre peut modifier la visibilité de son profil Bungie."
          : message || "Ce rapport est indisponible.";
        results.innerHTML = "";
      }
      finally { busy = false; }
    }
    tabs.forEach(tab => tab.addEventListener("click", () => show(tab.dataset.mode)));
    show("raid");
  }
  clanSelect.addEventListener("change", () => loadMembers(clanSelect.value).catch(error => status.textContent = friendlyError(error)));
  search.addEventListener("input", () => renderMembers());
  loadButton.addEventListener("click", () => findGroups().catch(error => status.textContent = friendlyError(error)));
  findGroups().catch(error => {
    status.textContent = friendlyError(error);
    membersEl.innerHTML = '<div class="report-empty"><a href="oauth.html">Vérifier la connexion Bungie ↗</a></div>';
  });
})();

