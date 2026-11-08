(() => {
  "use strict";
  const API = "https://cloudmusic-youtube.mylahari.workers.dev";
  const $ = id => document.getElementById(id);
  const form = $("youtube-search-form");
  const input = $("youtube-search-input");
  const results = $("youtube-results");
  const status = $("youtube-status");
  const player = $("youtube-player");

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }
  function render(videos) {
    results.innerHTML = "";
    if (!videos.length) {
      status.textContent = "No videos found. Try the song title and artist name.";
      return;
    }
    status.textContent = videos.length + " YouTube results. Check the channel name for the official artist or label upload.";
    videos.forEach(video => {
      const card = document.createElement("article");
      card.className = "group min-w-0 rounded-xl bg-surface-container p-3 hover:bg-surface-container-high transition-colors";
      const thumb = video.thumbnail || "";
      card.innerHTML = `
        <button type="button" class="youtube-play w-full text-left" aria-label="Play ${escapeHTML(video.title)}">
          <div class="relative aspect-video rounded-lg overflow-hidden bg-surface-container-high mb-3">
            ${thumb ? '<img src="' + escapeHTML(thumb) + '" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform">' : ""}
            <span class="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center shadow-lg"><span class="material-symbols-outlined">play_arrow</span></span>
          </div>
          <span class="block text-sm font-semibold text-on-surface line-clamp-2">${escapeHTML(video.title || "Untitled video")}</span>
          <span class="block truncate text-xs text-on-surface-variant mt-1">${escapeHTML(video.channelTitle || "YouTube channel")}</span>
        </button>`;
      card.querySelector(".youtube-play").addEventListener("click", () => {
        player.classList.remove("hidden");
        player.innerHTML = '<iframe class="w-full h-full aspect-video" src="https://www.youtube-nocookie.com/embed/' +
          encodeURIComponent(video.id) +
          '?autoplay=1&rel=0" title="' + escapeHTML(video.title || "YouTube video") +
          '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
        player.scrollIntoView({behavior:"smooth", block:"center"});
        status.textContent = "Playing through YouTube: " + (video.title || "Selected video");
      });
      results.appendChild(card);
    });
  }
  async function search(query) {
    if (!query) {
      status.textContent = "Enter a song title or artist to search.";
      return;
    }
    status.textContent = "Searching YouTube…";
    results.innerHTML = "";
    player.classList.add("hidden");
    player.innerHTML = "";
    try {
      const response = await fetch(API + "/search?q=" + encodeURIComponent(query), {cache:"no-store"});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "YouTube search failed (HTTP " + response.status + ").");
      render(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      status.textContent = error.message || "Could not search YouTube.";
      console.error("CloudMusic YouTube search:", error);
    }
  }
  form?.addEventListener("submit", event => {
    event.preventDefault();
    search(input.value.trim());
  });
})();
