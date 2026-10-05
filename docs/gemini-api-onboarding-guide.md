# Gemini API Onboarding Guide

eCricketCoach uses **Google's Gemini API** to power real AI video analysis — when a coach or player
uploads (or syncs from Google Drive) a batting/bowling/keeping/fielding clip, Gemini's multimodal
video understanding watches the footage and returns structured biomechanical feedback (overall
score, detected technique issues, head/foot/release-point metrics, and recommended corrective
drills).

This document walks you through getting a **free** Gemini API key and wiring it into the app.

---

## 1. Get a Free Gemini API Key

1. Go to **[Google AI Studio](https://aistudio.google.com/apikey)**.
2. Sign in with any Google account.
3. Click **Create API key**.
   - You can create it under a new Google Cloud project, or an existing one — either works.
4. Copy the generated key. Keep it secret — treat it like a password.

> **Note on key format:** Most AI Studio keys look like `AIzaSy...`, but Google has also issued
> keys in other formats (e.g. `AQ....`) depending on how/when the project was provisioned. Both
> formats are valid — if in doubt, verify a key works with a quick test call (see the `curl`
> example in step 4 below) rather than assuming it's invalid based on its prefix alone.

> **Free tier:** Google AI Studio API keys include a generous free quota for `gemini-1.5-flash`
> (the model this app uses by default), which is more than enough for development and small-scale
> production usage. No credit card is required to generate the key or use the free tier.
>
> If you later need higher throughput, you can enable billing on the underlying Google Cloud
> project from [Google Cloud Console](https://console.cloud.google.com/) — the app code requires
> no changes either way.

---

## 2. Add the Key to the App

The server reads the key from the `GEMINI_API_KEY` environment variable, set in the project's
root `.env` file (`web-app/.env`), which Docker Compose passes through to the `server` container.

1. Open `web-app/.env`.
2. Find the Gemini section (added automatically if missing):

   ```env
   # Gemini AI (video analysis) - get a free API key at https://aistudio.google.com/apikey
   GEMINI_API_KEY=
   GEMINI_MODEL=
   ```

3. Paste your key:

   ```env
   GEMINI_API_KEY=AIzaSy...your-real-key-here...
   GEMINI_MODEL=
   ```

4. **Never commit this file** — `web-app/.env` is already covered by `.gitignore`, so your key
   stays local and out of source control.

### Dynamic model selection (recommended: leave `GEMINI_MODEL` empty)

When `GEMINI_MODEL` is left empty, the server automatically calls Gemini's `ListModels` API,
ranks the currently available multimodal models (preferring fast "flash" models, "latest"
aliases, and higher version numbers), and caches the ranked list for an hour. If Google retires
a model alias (as happened with `gemini-1.5-flash` and `gemini-2.0-flash`), the app
automatically falls through to the next-best available model on its own — no manual env var
update required. If the chosen model returns a "not found"/unsupported error for a given
request, the app also automatically retries with the next-ranked candidate.

### Optional: Pinning a specific model

If you prefer to lock the app to one specific model instead of dynamic discovery, set
`GEMINI_MODEL` explicitly, for example:

```env
GEMINI_MODEL=gemini-flash-latest
```

Any model that supports video/multimodal input via the Gemini API will work without further code
changes — just confirm it's still active by calling `GET
https://generativelanguage.googleapis.com/v1beta/models` with your key, or testing a quick
`generateContent` call, before relying on it.

---

## 3. Restart the Server Container

Before restarting, it's worth confirming the key actually works with a direct test call:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent" \
  -H 'Content-Type: application/json' \
  -H "X-goog-api-key: $GEMINI_API_KEY" \
  -X POST \
  -d '{"contents":[{"parts":[{"text":"Reply with just the word OK"}]}]}'
```

A `200 OK` JSON response with a `candidates` array confirms the key and model are valid. A `403
PERMISSION_DENIED` means the key itself is invalid/wrong format; a `404 NOT_FOUND` on the model
means that specific model name has been retired — try `gemini-flash-latest` instead.

After saving `.env`, rebuild/restart just the `server` service so it picks up the new environment
variable:

```bash
cd web-app
docker compose up -d --force-recreate server
```

(No `--no-cache` rebuild is required just for an env var change — a normal recreate is enough. Use
`docker compose build --no-cache server` only if you've also changed server source code.)

---

## 4. Verify It's Working

1. Check the server logs for a quick sanity check:

   ```bash
   docker logs ecricket_api --tail 50
   ```

   If `GEMINI_API_KEY` is missing or empty, you'll see a warning in the logs the next time a video
   is analyzed:

   ```
   GEMINI_API_KEY is not configured; falling back to heuristic video analysis.
   ```

   This is a **safe fallback** — the app still works end-to-end using deterministic placeholder
   analysis, just without real AI video understanding, so you won't get blocked during setup.

2. Once the key is set, upload a short cricket training clip (device upload or Google Drive sync)
   in either the **Club Portal → Video Analysis** tab or the **Coaching Portal**, and click
   **Run AI Analysis**. You should see:
   - A real overall technique score
   - Specific, clip-derived technique issues (not generic placeholder text)
   - Biomechanical metrics and recommended drills generated from what Gemini actually observed in
     the footage

3. If something goes wrong (invalid key, quota exceeded, video too large/corrupt, etc.), the
   server automatically falls back to the heuristic analyzer and logs the real error, e.g.:

   ```
   Gemini video analysis failed, falling back to heuristic analysis: <error details>
   ```

   Check `docker logs ecricket_api` for the specific reason if analysis results look generic.

---

## 5. How It Works (Technical Summary)

- **Service:** `web-app/server/src/services/geminiVideoAnalysisService.ts`
- **Route:** `POST /api/videos/analyze` (`web-app/server/src/routes/ai.ts`)
- **Flow:**
  1. Client sends either a device-uploaded video file (`multipart/form-data`) or a
     `driveFileId` (for clips already synced from the user's Google Drive).
  2. For Drive-sourced clips, the server downloads the real video bytes using the user's stored
     OAuth access token before analysis (same Drive connection used for the folder-structured
     backups — see the Google Drive integration docs).
  3. The video bytes are sent to Gemini:
     - **Clips ≤ ~15MB:** sent inline as base64 in the `generateContent` request.
     - **Larger clips:** uploaded via the Gemini **Files API** first, then referenced by URI.
  4. Gemini is prompted to return a strict JSON object (score, issues, metrics, recommended
     drills) based only on what's visible in the footage.
  5. The server validates the JSON shape; if Gemini's response is malformed, missing, or the
     request fails for any reason, it transparently falls back to the heuristic analyzer in
     `aiAnalysisService.ts` so the user always gets a usable result.

---

## 6. Cost & Quota Notes

- Gemini API keys from AI Studio include a **free tier** sufficient for development and light
  production traffic.
- There is no mock/simulated analysis path in production code — if `GEMINI_API_KEY` is unset, the
  app explicitly logs that it's using the heuristic fallback rather than silently pretending it's
  AI-generated.
- Monitor usage and quota at [Google AI Studio](https://aistudio.google.com/) or
  [Google Cloud Console](https://console.cloud.google.com/) under the associated project.
