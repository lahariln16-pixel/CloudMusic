# Enable YouTube search in CloudMusic

CloudMusic uses the official YouTube Data API v3 for search and YouTube's official embedded player for playback.

## Create the API key

1. Open the Google Cloud Console: https://console.cloud.google.com/
2. Create or select a Google Cloud project.
3. Open **APIs & Services → Library**, find **YouTube Data API v3**, and enable it.
4. Open **APIs & Services → Credentials → Create credentials → API key**.
5. Under API restrictions, restrict the key to **YouTube Data API v3**.
6. Do not add the key to website JavaScript, commit it to Git, or send it in chat.

## Add the key to Cloudflare

1. Open Cloudflare Dashboard → **Workers & Pages** → **cloudmusic-youtube**.
2. Open **Settings → Variables and Secrets**.
3. Add a secret named `YOUTUBE_API_KEY` and paste the API key as its value.
4. Save. The Worker should pick up the secret without changing the existing Drive or Audius Workers.

The endpoint is `https://cloudmusic-youtube.<your-workers-subdomain>.workers.dev/search?q=SONG`.

## Notes

- Search uses YouTube Data API v3 and only returns embeddable video results.
- Playback uses YouTube's official privacy-enhanced embed host.
- This plays the YouTube video, not an extracted audio-only stream.
- Official artist/label uploads are not guaranteed to rank first; check the channel name and verification badge in YouTube when choosing a result.
- Google Cloud may enforce API quota limits.
