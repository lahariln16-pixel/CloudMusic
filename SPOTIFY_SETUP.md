# Spotify integration setup

CloudMusic uses Spotify's Web API Client Credentials flow for catalog search and Spotify's official embedded player for playback. It does not download or proxy Spotify audio.

## 1. Create a Spotify app

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create an app and enable the Web API.
3. Copy the Client ID and Client Secret.

## 2. Create and configure the Worker

From the repository root, run:

```bash
npx wrangler deploy --config wrangler.spotify.jsonc
npx wrangler secret put SPOTIFY_CLIENT_ID --config wrangler.spotify.jsonc
npx wrangler secret put SPOTIFY_CLIENT_SECRET --config wrangler.spotify.jsonc
```

Paste each value only into the Wrangler prompt. Do not commit credentials or share the Client Secret in chat.

The Worker will be available at:
`https://cloudmusic-spotify.mylahari.workers.dev`

## 3. Publish the website

Merge the Spotify integration pull request after reviewing it. Cloudflare Pages should publish the updated frontend from the configured Git branch.

## Playback notes

Search results and metadata are supplied by Spotify. Playback uses Spotify's official embed, so availability, account prompts, ads, and playback controls are determined by Spotify and the track. Full unrestricted playback is not guaranteed inside an embed. This integration does not use Spotify preview clips as a standalone audio service.
