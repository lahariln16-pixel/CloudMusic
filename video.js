const API =
    "https://cloud-music-proxy.cloudmusiclahari.workers.dev";

const videoPlayer = document.querySelector("#videoPlayer");
const videoTitle = document.querySelector("#videoTitle");
const videoFilename = document.querySelector("#videoFilename");
const videoList = document.querySelector("#videoList");
const videoSearch = document.querySelector("#videoSearch");

let videos = [];
let visibleVideos = [];

function videoURL(id) {
    return `${API}/?id=${encodeURIComponent(id)}`;
}

async function loadVideos() {
    try {
        const response = await fetch(`${API}/videos`);

        if (!response.ok) {
            throw new Error("Failed to load videos");
        }

        videos = await response.json();
        visibleVideos = videos;

        console.log(`Loaded ${videos.length} videos`);

        renderVideos();

    } catch (error) {
        console.error("Could not load videos:", error);

        videoList.innerHTML = `
            <div class="video-loading">
                Could not load videos.
            </div>
        `;
    }
}

function renderVideos(list = visibleVideos) {
    videoList.innerHTML = "";

    if (!list.length) {
        videoList.innerHTML = `
            <div class="video-loading">
                No videos found.
            </div>
        `;
        return;
    }

    list.forEach((video, index) => {
        const item = document.createElement("button");

        item.className = "video-item";

        item.innerHTML = `
            <span class="video-number">
                ${index + 1}
            </span>

            <span class="video-item-info">
                <strong>
                    ${escapeHTML(video.title)}
                </strong>

                <small>
                    ${escapeHTML(video.filename)}
                </small>
            </span>

            <span class="video-play-icon">
                ▶
            </span>
        `;

        item.addEventListener("click", () => {
            playVideo(video);
        });

        videoList.appendChild(item);
    });
}

function playVideo(video) {
    videoPlayer.src = videoURL(video.id);

    videoTitle.textContent = video.title;
    videoFilename.textContent = video.filename;

    videoPlayer.play().catch(error => {
        console.log("Autoplay prevented:", error);
    });

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function escapeHTML(text) {
    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}

videoSearch.addEventListener("input", () => {
    const query =
        videoSearch.value.trim().toLowerCase();

    visibleVideos = videos.filter(video =>
        video.title.toLowerCase().includes(query) ||
        video.filename.toLowerCase().includes(query)
    );

    renderVideos(visibleVideos);
});

loadVideos();
