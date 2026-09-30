const API =
    "https://cloud-music-proxy.cloudmusiclahari.workers.dev";

const videoPlayer = document.querySelector("#videoPlayer");
const videoTitle = document.querySelector("#videoTitle");
const videoFilename = document.querySelector("#videoFilename");
const videoList = document.querySelector("#videoList");
const videoSearch = document.querySelector("#videoSearch");

const VIDEO_TOKEN_KEY = "cloud_music_video_token";

let videos = [];
let visibleVideos = [];


/* =========================
   PASSWORD SCREEN
   ========================= */

function showPasswordScreen() {
    if (document.querySelector("#videoPasswordScreen")) {
        return;
    }

    const screen = document.createElement("div");

    screen.id = "videoPasswordScreen";

    screen.innerHTML = `
        <div style="
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0,0,0,0.94);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        ">
            <form id="videoPasswordForm" style="
                width: min(420px, 100%);
                background: #111;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 18px;
                padding: 32px;
                box-sizing: border-box;
                text-align: center;
                box-shadow: 0 20px 70px rgba(0,0,0,0.5);
            ">

                <div style="
                    font-size: 48px;
                    margin-bottom: 14px;
                ">
                    🔐
                </div>

                <h2 style="
                    color: white;
                    margin: 0 0 8px;
                    font-size: 25px;
                ">
                    Private Videos
                </h2>

                <p style="
                    color: #999;
                    margin: 0 0 24px;
                    font-size: 14px;
                ">
                    Enter the password to access Cloud Video.
                </p>

                <input
                    id="videoPasswordInput"
                    type="password"
                    placeholder="Enter password"
                    autocomplete="current-password"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 14px 16px;
                        border-radius: 10px;
                        border: 1px solid #333;
                        background: #1c1c1c;
                        color: white;
                        font-size: 16px;
                        outline: none;
                        margin-bottom: 12px;
                    "
                >

                <button
                    type="submit"
                    style="
                        width: 100%;
                        padding: 14px;
                        border: 0;
                        border-radius: 10px;
                        background: #fff;
                        color: #000;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                    "
                >
                    Unlock Videos
                </button>

                <p
                    id="videoPasswordError"
                    style="
                        display: none;
                        color: #ff5c5c;
                        margin: 14px 0 0;
                        font-size: 14px;
                    "
                ></p>
            </form>
        </div>
    `;

    document.body.appendChild(screen);

    const form =
        document.querySelector("#videoPasswordForm");

    const input =
        document.querySelector("#videoPasswordInput");

    const error =
        document.querySelector("#videoPasswordError");

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const password =
            input.value.trim();

        if (!password) {
            error.textContent =
                "Please enter the password.";

            error.style.display = "block";

            return;
        }

        error.style.display = "none";

        const button =
            form.querySelector("button");

        button.disabled = true;
        button.textContent = "Checking...";

        try {
            const response =
                await fetch(`${API}/auth/video`, {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        password
                    })
                });

            const data =
                await response.json();

            if (!response.ok || !data.token) {
                throw new Error(
                    data.error ||
                    "Incorrect password"
                );
            }

            sessionStorage.setItem(
                VIDEO_TOKEN_KEY,
                data.token
            );

            screen.remove();

            await loadVideos();

        } catch (err) {
            error.textContent =
                err.message ||
                "Incorrect password.";

            error.style.display =
                "block";

            input.value = "";
            input.focus();

            button.disabled = false;
            button.textContent =
                "Unlock Videos";
        }
    });

    setTimeout(() => {
        input.focus();
    }, 50);
}


/* =========================
   TOKEN
   ========================= */

function getVideoToken() {
    return sessionStorage.getItem(
        VIDEO_TOKEN_KEY
    );
}


/* =========================
   VIDEO URL
   ========================= */

function videoURL(id) {
    const token =
        getVideoToken();

    return (
        `${API}/?id=${encodeURIComponent(id)}` +
        `&access_token=${encodeURIComponent(token)}`
    );
}


/* =========================
   LOAD VIDEOS
   ========================= */

async function loadVideos() {
    const token =
        getVideoToken();

    if (!token) {
        showPasswordScreen();
        return;
    }

    try {
        const response =
            await fetch(`${API}/videos`, {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                },
                cache: "no-store"
            });

        if (response.status === 401) {
            sessionStorage.removeItem(
                VIDEO_TOKEN_KEY
            );

            showPasswordScreen();

            return;
        }

        if (!response.ok) {
            throw new Error(
                "Failed to load videos"
            );
        }

        videos =
            await response.json();

        visibleVideos =
            videos;

        console.log(
            `Loaded ${videos.length} videos`
        );

        renderVideos();

    } catch (error) {
        console.error(
            "Could not load videos:",
            error
        );

        videoList.innerHTML = `
            <div class="video-loading">
                Could not load videos.
            </div>
        `;
    }
}


/* =========================
   RENDER VIDEOS
   ========================= */

function renderVideos(
    list = visibleVideos
) {
    videoList.innerHTML = "";

    if (!list.length) {
        videoList.innerHTML = `
            <div class="video-loading">
                No videos found.
            </div>
        `;

        return;
    }

    list.forEach(
        (video, index) => {
            const item =
                document.createElement(
                    "button"
                );

            item.className =
                "video-item";

            item.innerHTML = `
                <span class="video-number">
                    ${index + 1}
                </span>

                <span class="video-item-info">
                    <strong>
                        ${escapeHTML(
                            video.title
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            video.filename
                        )}
                    </small>
                </span>

                <span class="video-play-icon">
                    ▶
                </span>
            `;

            item.addEventListener(
                "click",
                () => {
                    playVideo(video);
                }
            );

            videoList.appendChild(
                item
            );
        }
    );
}


/* =========================
   PLAY VIDEO
   ========================= */

function playVideo(video) {
    videoPlayer.src =
        videoURL(video.id);

    videoTitle.textContent =
        video.title;

    videoFilename.textContent =
        video.filename;

    videoPlayer.play()
        .catch(error => {
            console.log(
                "Autoplay prevented:",
                error
            );
        });

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================
   ESCAPE HTML
   ========================= */

function escapeHTML(text) {
    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;
}


/* =========================
   SEARCH
   ========================= */

videoSearch.addEventListener(
    "input",
    () => {
        const query =
            videoSearch.value
                .trim()
                .toLowerCase();

        visibleVideos =
            videos.filter(video =>
                video.title
                    .toLowerCase()
                    .includes(query) ||
                video.filename
                    .toLowerCase()
                    .includes(query)
            );

        renderVideos(
            visibleVideos
        );
    }
);


/* =========================
   START
   ========================= */

loadVideos();