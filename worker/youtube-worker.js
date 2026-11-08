const API = "https://www.googleapis.com/youtube/v3";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "Content-Type" } });
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
    if (url.pathname !== "/search") return json({ error: "Not found. Use /search?q=SONG." }, 404);
    if (!env.YOUTUBE_API_KEY) {
      return json({
        error: "YouTube search is not configured yet. Add the YOUTUBE_API_KEY secret to the cloudmusic-youtube Worker."
      }, 503);
    }
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return json({ error: "Add a song title or artist with ?q=." }, 400);
    if (q.length > 160) return json({ error: "Search query is too long." }, 400);

    const apiUrl = new URL(API + "/search");
    apiUrl.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      videoEmbeddable: "true",
      safeSearch: "moderate",
      maxResults: "18",
      order: "relevance",
      q,
      key: env.YOUTUBE_API_KEY
    }).toString();

    try {
      const upstream = await fetch(apiUrl.toString(), {
        headers: { "accept": "application/json" }
      });
      const payload = await upstream.json();
      if (!upstream.ok) {
        const reason = payload?.error?.errors?.[0]?.reason;
        const message = reason === "quotaExceeded"
          ? "YouTube search quota has been used up for today."
          : "YouTube search API returned an error.";
        return json({ error: message, reason: reason || "apiError" }, upstream.status);
      }
      const data = (payload.items || [])
        .filter(item => item?.id?.videoId)
        .map(item => ({
          id: item.id.videoId,
          title: item.snippet?.title || "Untitled video",
          channelTitle: item.snippet?.channelTitle || "YouTube channel",
          thumbnail: item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.default?.url || "",
          publishedAt: item.snippet?.publishedAt || ""
        }));
      return json({ data });
    } catch (error) {
      return json({ error: "Could not reach YouTube search. Please try again." }, 502);
    }
  }
};
