const SPOTIFY_API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const ALLOWED_ORIGIN = "https://cloudmusic-75y.pages.dev";
let cachedToken = null;
let tokenExpiresAt = 0;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}

async function getAccessToken(env) {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify is not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to the cloudmusic-spotify Worker.");
  }
  const credentials = btoa(env.SPOTIFY_CLIENT_ID + ":" + env.SPOTIFY_CLIENT_SECRET);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error("Spotify authentication failed. Check the Worker credentials and Spotify app settings.");
  }
  cachedToken = payload.access_token;
  tokenExpiresAt = Date.now() + (Number(payload.expires_in) || 3600) * 1000;
  return cachedToken;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": ALLOWED_ORIGIN,
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Content-Type"
      }});
    }
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
    if (url.pathname !== "/search") return json({ error: "Not found. Use /search?q=SONG." }, 404);
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return json({ data: [] }, 200);
    if (q.length > 160) return json({ error: "Search query is too long." }, 400);
    try {
      const token = await getAccessToken(env);
      const params = new URLSearchParams({ q, type: "track", limit: "24", market: "IN" });
      const response = await fetch(SPOTIFY_API + "/search?" + params, {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 429) return json({ error: "Spotify is receiving too many requests. Please wait a moment and try again." }, 429);
        return json({ error: "Spotify search returned HTTP " + response.status + "." }, response.status);
      }
      const data = (payload.tracks?.items || []).filter(track => track && track.id).map(track => ({
        id: track.id,
        uri: track.uri,
        title: track.name,
        artist: (track.artists || []).map(artist => artist.name).join(", "),
        album: track.album?.name || "",
        artwork: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || "",
        durationMs: track.duration_ms || 0,
        explicit: Boolean(track.explicit),
        url: track.external_urls?.spotify || "https://open.spotify.com/track/" + track.id
      }));
      return json({ data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Spotify search failed.";
      return json({ error: message }, message.startsWith("Spotify is not configured") ? 503 : 502);
    }
  }
};
