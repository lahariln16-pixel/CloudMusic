# Utop Worker deployment

This repository keeps Utop isolated from the main Google Drive Worker.

## Configuration

The dedicated Wrangler configuration is `wrangler.utop.jsonc`. It deploys:

- Worker: `cloudmusic-utop`
- Entry point: `worker/utop-worker.js`
- Compatibility date: `2026-11-08`
- Plain-text variables: none (`vars: {}`)

The API key is stored as a Cloudflare Worker secret and must never be committed to this repository.

## Set or update the secret

```sh
npx wrangler secret put UTOP_API_KEY --config wrangler.utop.jsonc
```

Paste the key only into the Wrangler prompt. Do not put it in a command argument, config file, or source file.

## Deploy Utop

```sh
npx wrangler deploy --config wrangler.utop.jsonc
```

The CloudMusic search UI calls `https://cloudmusic-utop.mylahari.workers.dev/search?q=SONG`.

This Worker only searches for embeddable results. Playback happens through the official embedded player; it does not extract or download media streams.
