# CloudMusic Google Drive OAuth

This adds a personal Google Drive connection for saving song metadata and original source links. It does not download or copy audio from Utop or JioSaavn. Actual audio files can only be saved when a source provides an authorised downloadable file.

## What it adds

- A Google Drive connect button in the Drive library.
- OAuth using the limited `drive.file` scope.
- Automatic creation of `CloudMusic/Utop` and `CloudMusic/JioSaavn` folders.
- One JSON metadata file per saved song, including title, artist, source link, artwork URL, and save date.
- A reusable browser helper: `window.CloudMusicDriveSave.saveTrack({...})`. A future authorised JioSaavn search/player can call the same helper.

## 1. Create a Google OAuth client

In Google Cloud Console, open the CloudMusic project and configure the OAuth consent screen:

- User type: External (for a personal Google account).
- Add your Google account as a test user while the app is in Testing.
- Create an OAuth Client ID of type **Web application**.
- Add this authorised redirect URI exactly:

```text
https://cloud-music-proxy.mylahari.workers.dev/oauth/callback
```

- Add this authorised JavaScript origin:

```text
https://cloudmusic-75y.pages.dev
```

Copy the Client ID and Client Secret. Never commit either value or paste the secret into chat.

## 2. Create the Cloudflare KV namespace

From the Cloudflare dashboard:

1. Open Workers & Pages → KV.
2. Create a namespace named `cloudmusic-drive-oauth`.
3. Copy its namespace ID.
4. Replace `REPLACE_WITH_DRIVE_OAUTH_KV_NAMESPACE_ID` in the root `wrangler.jsonc` with that ID. Keep the binding name exactly `DRIVE_OAUTH`.

This KV namespace stores the refresh token, short-lived OAuth state, and revocable app session records.

## 3. Add Worker secrets

From the CloudMusic repository directory, run:

```sh
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc
```

Paste each value only at Wrangler's secure prompt. Do not add them to source files, GitHub Actions logs, or chat.

## 4. Deploy the existing Drive Worker

After the KV namespace ID has been added and both secrets are configured:

```sh
npx wrangler deploy --config wrangler.jsonc
```

This updates the existing `cloud-music-proxy` Worker; it does not replace the separate Utop or Audius Workers.

## 5. Connect from CloudMusic

Open the CloudMusic site, hard-refresh it, then choose **Connect Google Drive** in the Drive library. Approve the requested `drive.file` access. Search Utop and use **Save details to Drive** on a result.

## Security and limitations

- OAuth uses the narrow `drive.file` scope; CloudMusic creates and manages files it creates rather than receiving unrestricted access to all Drive contents.
- The browser stores a revocable app session token in local storage. Disconnecting removes that session from KV; revoking the app in your Google Account removes its Google access.
- The Worker only accepts the two supported source labels and saves metadata/link JSON. It does not extract, download, or upload protected audio.
- The same save helper accepts `source: "JioSaavn"`, ready for a future authorised JioSaavn integration. There is not yet a JioSaavn search/player in this branch.
- If Google OAuth is left in Testing mode, refresh-token lifetime may be limited by Google's testing-mode rules. Check the OAuth consent screen publishing status if reconnection is requested later.
