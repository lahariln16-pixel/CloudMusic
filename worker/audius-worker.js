const API = "https://api.audius.co/v1";
const APP_NAME = "CloudMusic";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  "Cross-Origin-Resource-Policy": "cross-origin"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      ...cors
    }
  });
}

async function audius(path) {
  const url = new URL(API + path);
  url.searchParams.set("app_name", APP_NAME);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Audius API returned HTTP " + response.status);
  return response.json();
}

function normalize(track) {
  return {
    id: track.id,
    title: track.title || "Untitled",
    artist: track.user?.name || track.user?.handle || "Unknown artist",
    user: track.user,
    artwork: {
      "480x480": track.artwork?._480x480 || "",
      "150x150": track.artwork?._150x150 || "",
      "1000x1000": track.artwork?._1000x1000 || ""
    },
    is_stream_gated: track.is_stream_gated === true
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === "/search" && request.method === "GET") {
        const query = (url.searchParams.get("q") || "").trim();
        if (!query) return json({ data: [] });
        const params = new URLSearchParams({ query, limit: "24" });
        const payload = await audius("/tracks/search?" + params);
        return json({ data: (payload.data || []).map(normalize) });
      }

      if (url.pathname === "/trending" && request.method === "GET") {
        const params = new URLSearchParams({ limit: "24", time: "week" });
        const payload = await audius("/tracks/trending?" + params);
        return json({ data: (payload.data || []).map(normalize) });
      }

      if (url.pathname === "/stream" && request.method === "GET") {
        const id = url.searchParams.get("id");
        if (!id) return new Response("Missing track ID", { status: 400, headers: cors });

        const streamUrl = new URL(API + "/tracks/" + encodeURIComponent(id) + "/stream");
        streamUrl.searchParams.set("app_name", APP_NAME);
        const headers = new Headers();
        const range = request.headers.get("Range");
        if (range) headers.set("Range", range);

        const upstream = await fetch(streamUrl, { headers, redirect: "follow" });
        const responseHeaders = new Headers(upstream.headers);
        for (const [key, value] of Object.entries(cors)) responseHeaders.set(key, value);
        responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "audio/mpeg");
        responseHeaders.set("Content-Disposition", "inline");
        return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Audius request failed" }, 502);
    }
  }
};