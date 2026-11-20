/**
 * VIGIE's Bungie API relay for Cloudflare Workers.
 * Secrets: BUNGIE_API_KEY, BUNGIE_CLIENT_ID. Variable: SITE_ORIGIN.
 */
const API = "https://www.bungie.net/Platform";

function reply(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type",
      "vary": "Origin"
    }
  });
}

function fail(message, status, origin) {
  return reply({ error: message }, status, origin);
}

function allowedPath(path, method) {
  if (path.startsWith("/common/destiny2_content/json/")) return method === "GET";
  if (!path.startsWith("/Platform/")) return false;
  if (method === "GET") {
    return path.startsWith("/Platform/Destiny2/") ||
      path.startsWith("/Platform/User/GetMembershipsForCurrentUser/") ||
      path.startsWith("/Platform/User/GetMembershipsById/");
  }
  return method === "POST" && /^\/Platform\/Destiny2\/Actions\/Items\/(TransferItem|EquipItem|EquipItems|InsertSocketPlugFree)\/$/.test(path);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const siteOrigin = env.SITE_ORIGIN || "";
    if (!siteOrigin || origin !== siteOrigin) return fail("Origin non autorisée", 403, siteOrigin || "null");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": siteOrigin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "86400", "vary": "Origin"
      }});
    }
    if (!env.BUNGIE_API_KEY || !env.BUNGIE_CLIENT_ID) return fail("Secrets Bungie non configurés", 503, siteOrigin);

    try {
      if (url.pathname === "/oauth/token" && request.method === "POST") {
        const { code, redirectUri } = await request.json();
        if (!code || !redirectUri) return fail("Code OAuth ou URL de retour manquant", 400, siteOrigin);
        const form = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: env.BUNGIE_CLIENT_ID,
          redirect_uri: redirectUri
        });
        const response = await fetch(`${API}/App/OAuth/Token/`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "X-API-Key": env.BUNGIE_API_KEY },
          body: form
        });
        const result = await response.json();
        if (!response.ok || !result.access_token) {
          return fail("Bungie a refusé la connexion. Vérifie la redirection et le client OAuth.", 401, siteOrigin);
        }
        return reply({ access_token: result.access_token, expires_in: result.expires_in, membership_id: result.membership_id }, 200, siteOrigin);
      }

      const path = url.searchParams.get("path") || "";
      if (!allowedPath(path, request.method)) return fail("Route API non autorisée", 404, siteOrigin);
      const upstreamUrl = path.startsWith("/Platform/")
        ? `${new URL(path, "https://www.bungie.net").origin}${path}${url.searchParams.get("query") || ""}`
        : `https://www.bungie.net${path}${url.searchParams.get("query") || ""}`;
      const headers = { "X-API-Key": env.BUNGIE_API_KEY, "Accept": "application/json" };
      const authorization = request.headers.get("Authorization");
      if (authorization) headers.Authorization = authorization;
      const init = { method: request.method, headers };
      if (request.method === "POST") {
        init.headers["content-type"] = "application/json";
        init.body = await request.text();
      }
      const upstream = await fetch(upstreamUrl, init);
      return new Response(upstream.body, { status: upstream.status, headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": siteOrigin,
        "vary": "Origin"
      }});
    } catch {
      return fail("Erreur de communication avec Bungie", 502, siteOrigin);
    }
  }
};
