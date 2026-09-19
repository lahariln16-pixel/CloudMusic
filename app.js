const API = "https://cloud-music-proxy.cloudmusiclahari.workers.dev";

let songs = [];
let visibleSongs = [];
let currentSong = 0;
let repeatEnabled = false;
let shuffleEnabled = false;

const audio = new Audio();

const playButton = document.querySelector(".play");
const progressBar = document.querySelector(".progress div");
const currentTimeElement =
    document.querySelector(".progress-container span");
const durationElement =
    document.querySelector(".progress-container span:last-child");

const searchInput = document.querySelector("#searchInput");
const shuffleButton = document.querySelector("#shuffleButton");
const repeatButton = document.querySelector("#repeatButton");

const controls = document.querySelector(".controls");
const controlButtons = controls?.querySelectorAll("button");

const previousButton = controlButtons?.[1];
const nextButton = controlButtons?.[3];

const volumeContainer = document.querySelector(".volume");
const volumeBar = document.querySelector(".volume div");


function driveURL(id) {
    return `${API}/?id=${encodeURIComponent(id)}`;
}


function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, "0")}`;
}


async function loadSongs() {
    try {
        const response = await fetch(`${API}/list`);

        if (!response.ok) {
            throw new Error("Failed to load songs");
        }

        songs = await response.json();
        visibleSongs = songs;

        console.log(`Loaded ${songs.length} songs from Google Drive`);

        if (songs.length > 0) {
            loadSong(0);
        }

        renderSongs();

    } catch (error) {
        console.error("Could not load Google Drive songs:", error);
    }
}


function loadSong(index) {
    if (!songs.length) return;

    currentSong = index;

    const song = songs[index];

    audio.src = driveURL(song.id);

    document.querySelector(".now-playing h3").textContent =
        song.title;

    document.querySelector(".now-playing p").textContent =
        song.artist;

    document.querySelector(".player-art").className =
        "player-art album-art art-1";

    document.querySelector(".player-art").textContent = "♫";

    progressBar.style.width = "0%";
    currentTimeElement.textContent = "0:00";
    durationElement.textContent = "0:00";
}


function renderSongs(list = visibleSongs) {
    const trackList = document.querySelector(".track-list");

    if (!trackList) return;

    trackList.innerHTML = "";

    if (!list.length) {
        trackList.innerHTML = `
            <div class="track">
                <div class="track-info">
                    <strong>No songs found</strong>
                    <span>Try another search</span>
                </div>
            </div>
        `;
        return;
    }

    list.forEach((song, index) => {
        const row = document.createElement("div");

        row.className = "track";

        row.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info">
                <strong>${escapeHTML(song.title)}</strong>
                <span>${escapeHTML(song.artist)}</span>
            </div>
            <div class="track-duration">—</div>
        `;

        row.addEventListener("click", () => {
            const originalIndex = songs.indexOf(song);

            loadSong(originalIndex);
            audio.play().catch(console.error);
        });

        trackList.appendChild(row);
    });
}


function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


function togglePlay() {
    if (!songs.length) return;

    if (audio.paused) {
        audio.play()
            .catch(error => {
                console.error("Playback failed:", error);
            });
    } else {
        audio.pause();
    }
}


function playPrevious() {
    if (!songs.length) return;

    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    if (currentSong > 0) {
        loadSong(currentSong - 1);
    } else {
        loadSong(songs.length - 1);
    }

    audio.play().catch(console.error);
}


function playNext() {
    if (!songs.length) return;

    if (shuffleEnabled && songs.length > 1) {

        let next;

        do {
            next = Math.floor(Math.random() * songs.length);
        } while (next === currentSong);

        loadSong(next);

    } else if (currentSong < songs.length - 1) {

        loadSong(currentSong + 1);

    } else {

        loadSong(0);
    }

    audio.play().catch(console.error);
}


function playNextSong() {

    if (repeatEnabled) {

        audio.currentTime = 0;
        audio.play().catch(console.error);
        return;

    }

    playNext();
}


/* SEARCH */

searchInput?.addEventListener("input", () => {

    const query =
        searchInput.value.trim().toLowerCase();

    visibleSongs = songs.filter(song =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query)
    );

    renderSongs(visibleSongs);
});


/* SHUFFLE */

shuffleButton?.addEventListener("click", () => {

    shuffleEnabled = !shuffleEnabled;

    shuffleButton.classList.toggle(
        "active",
        shuffleEnabled
    );

});


/* REPEAT */

repeatButton?.addEventListener("click", () => {

    repeatEnabled = !repeatEnabled;

    repeatButton.classList.toggle(
        "active",
        repeatEnabled
    );

});


/* PREVIOUS */

previousButton?.addEventListener(
    "click",
    playPrevious
);


/* NEXT */

nextButton?.addEventListener(
    "click",
    playNext
);


/* PLAYER EVENTS */

audio.addEventListener("play", () => {
    playButton.textContent = "Ⅱ";
});


audio.addEventListener("pause", () => {
    playButton.textContent = "▶";
});


audio.addEventListener("timeupdate", () => {

    if (!audio.duration) return;

    progressBar.style.width =
        `${(audio.currentTime / audio.duration) * 100}%`;

    currentTimeElement.textContent =
        formatTime(audio.currentTime);

    durationElement.textContent =
        formatTime(audio.duration);
});


audio.addEventListener(
    "ended",
    playNextSong
);


/* VOLUME */

audio.volume = 1;

volumeContainer?.addEventListener(
    "click",
    (event) => {

        const rect =
            volumeContainer.getBoundingClientRect();

        const percent =
            (event.clientX - rect.left) /
            rect.width;

        const volume =
            Math.max(0, Math.min(1, percent));

        audio.volume = volume;

        if (volumeBar) {
            volumeBar.style.width =
                `${volume * 100}%`;
        }

    }
);


/* PLAY BUTTON */

playButton.addEventListener(
    "click",
    togglePlay
);


loadSongs();
