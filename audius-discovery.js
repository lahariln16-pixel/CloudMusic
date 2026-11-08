(() => {
  "use strict";
  const API = "https://cloud-music-proxy.mylahari.workers.dev";
  const $ = id => document.getElementById(id);
  const form = $("audius-search-form");
  const input = $("audius-search-input");
  const results = $("audius-results");
  const status = $("audius-status");
  const trendingButton = $("audius-trending-button");

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function artwork(track) {
    const image = track?.artwork || {};
    return image["480x480"] || image["150x150"] || image["1000x1000"] || "";
  }
  function artistName(track) {
    return track?.user?.name || track?.user?.handle || track?.artist || "Unknown artist";
  }
  function render(tracks) {
    results.innerHTML = "";
    const playable = (tracks || []).filter(track => track && track.id && !track.is_stream_gated);
    if (!playable.length) {
      results.innerHTML = '<p class="col-span-full py-6 text-on-surface-variant">No playable tracks found. Try another search.</p>';
      return;
    }
    playable.forEach(track => {
      const cover = artwork(track);
      const card = document.createElement("article");
      card.className = "group min-w-0 rounded-xl bg-surface-container p-3 hover:bg-surface-container-high transition-colors";
      card.innerHTML = `
        <button type="button" class="audius-play w-full text-left" aria-label="Play ${escapeHTML(track.title)}">
          <div class="relative aspect-square rounded-lg overflow-hidden bg-surface-container-high mb-3">
            ${cover ? '<img src="' + escapeHTML(cover) + '" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform">' : '<div class="w-full h-full flex items-center justify-center text-primary"><span class="material-symbols-outlined text-4xl">music_note</span></div>'}
            <span class="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center shadow-lg"><span class="material-symbols-outlined">play_arrow</span></span>
          </div>
          <span class="block truncate font-label-lg text-label-lg text-on-surface">${escapeHTML(track.title || "Untitled")}</span>
          <span class="block truncate text-xs text-on-surface-variant mt-1">${escapeHTML(artistName(track))}</span>
        </button>`;
      card.querySelector(".audius-play").addEventListener("click", () => {
        if (!window.CloudMusicPlayer?.playExternal) {
          status.textContent = "The music player is not ready. Refresh the page and try again.";
          return;
        }
        window.CloudMusicPlayer.playExternal({
          id: track.id,
          title: track.title || "Untitled",
          artist: artistName(track),
          artwork: cover
        });
      });
      results.appendChild(card);
    });
    status.textContent = playable.length + " playable track" + (playable.length === 1 ? "" : "s") + " · Audius";
  }
  async function load(path, label) {
    status.textContent = label;
    results.innerHTML = "";
    try {
      const response = await fetch(API + path, { cache: "no-store" });
      if (!response.ok) throw new Error("Music service returned HTTP " + response.status);
      const payload = await response.json();
      render(payload.data || []);
    } catch (error) {
      status.textContent = "Could not load Audius music: " + (error?.message || "Unknown error");
      console.error("CloudMusic Audius discovery:", error);
    }
  }
  form?.addEventListener("submit", event => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return load("/audius/trending", "Loading trending music…");
    load("/audius/search?q=" + encodeURIComponent(query), "Searching Audius…");
  });
  trendingButton?.addEventListener("click", () => load("/audius/trending", "Loading trending music…"));
  load("/audius/trending", "Loading trending music…");
})();
