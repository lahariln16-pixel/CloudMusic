(() => {
  "use strict";
  const API = "https://cloudmusic-spotify.mylahari.workers.dev";
  const $ = id => document.getElementById(id);
  const form = $("spotify-search-form");
  const input = $("spotify-search-input");
  const status = $("spotify-status");
  const results = $("spotify-results");
  const player = $("spotify-player");

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
  const duration = ms => {
    const seconds = Math.floor((Number(ms) || 0) / 1000);
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  };

  function play(track) {
    player.classList.remove("hidden");
    player.innerHTML = '<iframe title="Spotify player" src="https://open.spotify.com/embed/track/' +
      encodeURIComponent(track.id) +
      '?utm_source=generator&theme=0" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:12px"></iframe>';
    player.scrollIntoView({ behavior: "smooth", block: "center" });
    status.textContent = "Selected " + track.title + " — playback is handled by Spotify.";
  }

  function render(tracks) {
    results.replaceChildren();
    if (!tracks.length) {
      status.textContent = "No Spotify tracks found. Try another title or artist.";
      return;
    }
    status.textContent = tracks.length + " Spotify tracks found. Select one to open the Spotify player.";
    for (const track of tracks) {
      const card = document.createElement("article");
      card.className = "group min-w-0 rounded-xl bg-surface-container p-3 hover:bg-surface-container-high transition-colors";
      const art = track.artwork
        ? '<img src="' + escapeHTML(track.artwork) + '" alt="" loading="lazy" class="w-full h-full object-cover">'
        : '<div class="w-full h-full flex items-center justify-center text-on-surface-variant"><span class="material-symbols-outlined text-4xl">album</span></div>';
      card.innerHTML = '<button type="button" class="spotify-play w-full text-left">' +
        '<div class="relative aspect-square rounded-lg overflow-hidden bg-surface-container-high mb-3">' + art +
        '<span class="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center shadow-lg"><span class="material-symbols-outlined">play_arrow</span></span></div>' +
        '<span class="block text-sm font-semibold text-on-surface truncate">' + escapeHTML(track.title) + '</span>' +
        '<span class="block text-xs text-on-surface-variant truncate mt-1">' + escapeHTML(track.artist) + '</span>' +
        '<span class="block text-xs text-on-surface-variant mt-1">' + escapeHTML(track.album) + ' · ' + duration(track.durationMs) + '</span></button>' +
        '<a class="inline-flex mt-2 text-xs text-primary hover:underline" href="' + escapeHTML(track.url) + '" target="_blank" rel="noopener noreferrer">Open in Spotify ↗</a>';
      card.querySelector(".spotify-play").addEventListener("click", () => play(track));
      results.appendChild(card);
    }
  }

  async function search(query) {
    if (!query) {
      status.textContent = "Enter a song title or artist to search Spotify.";
      return;
    }
    status.textContent = "Searching Spotify…";
    results.replaceChildren();
    player.classList.add("hidden");
    player.replaceChildren();
    try {
      const response = await fetch(API + "/search?q=" + encodeURIComponent(query), { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Spotify search failed (HTTP " + response.status + ").");
      render(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      status.textContent = error.message || "Could not search Spotify.";
      console.error("CloudMusic Spotify search:", error);
    }
  }
  form?.addEventListener("submit", event => {
    event.preventDefault();
    search(input.value.trim());
  });
})();
