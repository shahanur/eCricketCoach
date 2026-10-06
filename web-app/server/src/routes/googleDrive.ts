import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { fetchWithRetry } from '../utils/retry.js';
import { isAllowedAppOrigin, resolveAppOrigin } from '../utils/appOrigin.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
// drive.readonly lets us list/browse all existing video files in the account;
// drive.file additionally lets this app create/write new files (needed to back up device uploads).
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file openid email';

const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
// The OAuth redirect_uri must be publicly reachable and match an Authorized Redirect URI
// configured on the Google Cloud OAuth Client. Requests are proxied through the client's
// nginx (/api/ -> server:5001/api/) so we use the browser-facing origin from APP_ORIGIN here,
// matching the pattern already used by the main social sign-in flow in routes/auth.ts.
const driveRedirectUri = (origin: string) => `${origin}/api/google-drive/callback`;

interface StatePayload {
  userId: string;
  origin?: string;
}

function callbackHtml(message: Record<string, string>): string {
  return `<!DOCTYPE html>
<html>
  <head><title>Google Drive Connection</title></head>
  <body style="font-family: sans-serif; background:#0f172a; color:#e2e8f0; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
    <p>Finishing Google Drive connection… you can close this window.</p>
    <script>
      (function () {
        var payload = ${JSON.stringify(message)};
        if (window.opener) {
          window.opener.postMessage(payload, '*');
        }
        window.close();
      })();
    </script>
  </body>
</html>`;
}

// Step 1: Client navigates a popup window here (token passed as query param since this is a top-level navigation)
router.get('/connect', (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).send(callbackHtml({ type: 'GOOGLE_DRIVE_ERROR', error: 'Google Drive integration is not configured on this server.' }));
    return;
  }

  const token = String(req.query.token || '');
  let userId: string;
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    userId = decoded.userId;
  } catch {
    res.status(401).send(callbackHtml({ type: 'GOOGLE_DRIVE_ERROR', error: 'Your session has expired. Please sign in again and retry.' }));
    return;
  }

  const origin = resolveAppOrigin(req);
  const state = jwt.sign({ userId, origin } as StatePayload, jwtSecret, { expiresIn: '10m' });

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', driveRedirectUri(origin));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', DRIVE_SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent select_account');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// Step 2: Google redirects back here with an authorization code
router.get('/callback', async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const errorParam = String(req.query.error || '');

  if (errorParam) {
    res.send(callbackHtml({ type: 'GOOGLE_DRIVE_ERROR', error: 'Google Drive access was not granted.' }));
    return;
  }

  if (!code || !state) {
    res.send(callbackHtml({ type: 'GOOGLE_DRIVE_ERROR', error: 'Google did not return the expected authorization code.' }));
    return;
  }

  let userId: string;
  let origin: string;
  try {
    const decoded = jwt.verify(state, jwtSecret) as StatePayload;
    userId = decoded.userId;
    origin = isAllowedAppOrigin(decoded.origin) ? decoded.origin : resolveAppOrigin(req);
  } catch {
    res.send(callbackHtml({ type: 'GOOGLE_DRIVE_ERROR', error: 'Your Google Drive connection request expired. Please try again.' }));
    return;
  }

  try {
    const tokenRes = await fetchWithRetry(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: driveRedirectUri(origin),
        grant_type: 'authorization_code'
      })
    }, { label: 'Google OAuth token exchange' });
    const tokenData = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      res.send(callbackHtml({ type: 'GOOGLE_DRIVE_ERROR', error: tokenData.error_description || 'Unable to exchange the Google authorization code.' }));
      return;
    }

    const userInfoRes = await fetchWithRetry(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    }, { label: 'Google userinfo' });
    const userInfo = await userInfoRes.json() as { email?: string };
    const email = userInfo.email || 'unknown@gmail.com';
    const expiryDate = Date.now() + (tokenData.expires_in || 3600) * 1000;

    const existing = await prisma.googleDriveConnection.findUnique({ where: { userId } });

    await prisma.googleDriveConnection.upsert({
      where: { userId },
      update: {
        email,
        accessToken: tokenData.access_token,
        // Google only returns refresh_token on first consent; keep the existing one if Google omits it this time
        refreshToken: tokenData.refresh_token || existing?.refreshToken,
        expiryDate: BigInt(expiryDate),
        scope: tokenData.scope
      },
      create: {
        userId,
        email,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiryDate: BigInt(expiryDate),
        scope: tokenData.scope
      }
    });

    res.send(callbackHtml({ type: 'GOOGLE_DRIVE_CONNECTED', email }));
  } catch (err) {
    console.error('Google Drive callback error:', err);
    res.send(callbackHtml({ type: 'GOOGLE_DRIVE_ERROR', error: 'Something went wrong while connecting to Google Drive.' }));
  }
});

// Reusable helper (also used by the video analysis route to download Drive-sourced clips)
export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; email: string } | null> {
  const connection = await prisma.googleDriveConnection.findUnique({ where: { userId } });
  if (!connection) return null;

  const expiryMs = connection.expiryDate ? Number(connection.expiryDate) : 0;
  if (expiryMs - 60_000 > Date.now()) {
    return { accessToken: connection.accessToken, email: connection.email };
  }

  if (!connection.refreshToken) {
    return { accessToken: connection.accessToken, email: connection.email };
  }

  const refreshRes = await fetchWithRetry(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token'
    })
  }, { label: 'Google OAuth token refresh' });
  const refreshData = await refreshRes.json() as { access_token?: string; expires_in?: number };
  if (!refreshRes.ok || !refreshData.access_token) {
    return { accessToken: connection.accessToken, email: connection.email };
  }

  const newExpiry = Date.now() + (refreshData.expires_in || 3600) * 1000;
  await prisma.googleDriveConnection.update({
    where: { userId },
    data: { accessToken: refreshData.access_token, expiryDate: BigInt(newExpiry) }
  });

  return { accessToken: refreshData.access_token, email: connection.email };
}

// Finds a folder by name under the given parent (or Drive root if parentId is undefined),
// creating it if it does not already exist. Used to build the eCricketCoach/{Player}/{Discipline}
// folder structure so every uploaded clip lands in a predictable, organized location in Drive.
async function findOrCreateFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const q = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${safeName}'`,
    `trashed = false`,
    parentId ? `'${parentId}' in parents` : `'root' in parents`
  ].join(' and ');

  const searchUrl = new URL(GOOGLE_DRIVE_FILES_URL);
  searchUrl.searchParams.set('q', q);
  searchUrl.searchParams.set('fields', 'files(id,name)');
  searchUrl.searchParams.set('spaces', 'drive');

  const searchRes = await fetchWithRetry(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  }, { label: 'Google Drive folder search' });
  const searchData = await searchRes.json() as { files?: { id: string; name: string }[] };
  if (searchRes.ok && searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetchWithRetry(`${GOOGLE_DRIVE_FILES_URL}?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    })
  }, { label: 'Google Drive folder create' });
  const createData = await createRes.json() as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !createData.id) {
    throw new Error(createData.error?.message || `Failed to create Google Drive folder "${name}".`);
  }
  return createData.id;
}

// Resolves (creating as needed) the eCricketCoach/{playerName}/{discipline} folder path
// and returns the id of the deepest (discipline) folder, where the video should be uploaded.
async function resolvePlayerDisciplineFolder(accessToken: string, playerName: string, discipline: string): Promise<string> {
  const rootFolderId = await findOrCreateFolder(accessToken, 'eCricketCoach');
  const playerFolderId = await findOrCreateFolder(accessToken, playerName, rootFolderId);
  const disciplineFolderId = await findOrCreateFolder(accessToken, discipline, playerFolderId);
  return disciplineFolderId;
}

// Connection status for the current authenticated user
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const connection = await prisma.googleDriveConnection.findUnique({ where: { userId } });
  res.json({ connected: Boolean(connection), email: connection?.email || null });
});

// List real video files from the user's connected Google Drive
router.get('/videos', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  try {
    const tokenInfo = await getValidAccessToken(userId);
    if (!tokenInfo) {
      res.status(404).json({ error: 'Google Drive is not connected for this account.' });
      return;
    }

    const filesUrl = new URL(GOOGLE_DRIVE_FILES_URL);
    filesUrl.searchParams.set('q', "mimeType contains 'video/' and trashed = false");
    filesUrl.searchParams.set('fields', 'files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,videoMediaMetadata)');
    filesUrl.searchParams.set('pageSize', '50');
    filesUrl.searchParams.set('orderBy', 'modifiedTime desc');
    filesUrl.searchParams.set('spaces', 'drive');

    const driveRes = await fetchWithRetry(filesUrl.toString(), {
      headers: { Authorization: `Bearer ${tokenInfo.accessToken}` }
    }, { label: 'Google Drive list videos' });
    const driveData = await driveRes.json() as { files?: any[]; error?: { message?: string } };

    if (!driveRes.ok) {
      res.status(driveRes.status).json({ error: driveData.error?.message || 'Failed to list Google Drive videos.' });
      return;
    }

    const files = (driveData.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      sizeBytes: f.size ? Number(f.size) : null,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
      thumbnailLink: f.thumbnailLink,
      durationMillis: f.videoMediaMetadata?.durationMillis ? Number(f.videoMediaMetadata.durationMillis) : null,
      width: f.videoMediaMetadata?.width,
      height: f.videoMediaMetadata?.height
    }));

    res.json({ files, email: tokenInfo.email });
  } catch (err) {
    console.error('Google Drive list videos error:', err);
    res.status(500).json({ error: 'Failed to fetch videos from Google Drive.' });
  }
});

// Upload a device video into the user's connected Google Drive (creates a new file via drive.file scope).
// The video is organized into eCricketCoach/{playerName}/{discipline}/ so every player's clips are
// neatly structured by discipline inside the user's own Google Drive.
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const file = (req as Request & { file?: Express.Multer.File }).file;
  const playerName = String(req.body?.playerName || 'Unassigned Player').trim() || 'Unassigned Player';
  const discipline = String(req.body?.discipline || 'General').trim() || 'General';

  if (!file) {
    res.status(400).json({ error: 'No video file was provided.' });
    return;
  }
  if (!file.mimetype.startsWith('video/')) {
    res.status(400).json({ error: 'Only video files can be backed up to Google Drive.' });
    return;
  }

  try {
    const tokenInfo = await getValidAccessToken(userId);
    if (!tokenInfo) {
      res.status(404).json({ error: 'Google Drive is not connected for this account.' });
      return;
    }

    const folderId = await resolvePlayerDisciplineFolder(tokenInfo.accessToken, playerName, discipline);

    const boundary = `ecc_${crypto.randomBytes(16).toString('hex')}`;
    const metadata = {
      name: file.originalname || `upload-${Date.now()}.mp4`,
      mimeType: file.mimetype,
      description: 'Uploaded from eCricketCoach (device upload)',
      parents: [folderId]
    };

    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`, 'utf-8'),
      Buffer.from(`--${boundary}\r\nContent-Type: ${file.mimetype}\r\n\r\n`, 'utf-8'),
      file.buffer,
      Buffer.from(`\r\n--${boundary}--`, 'utf-8')
    ]);

    const uploadUrl = new URL(GOOGLE_DRIVE_UPLOAD_URL);
    uploadUrl.searchParams.set('uploadType', 'multipart');
    uploadUrl.searchParams.set('fields', 'id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,videoMediaMetadata');

    const driveRes = await fetchWithRetry(uploadUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenInfo.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    }, { label: 'Google Drive video upload' });
    const driveData = await driveRes.json() as any;

    if (!driveRes.ok) {
      console.error('Google Drive upload rejected:', driveRes.status, JSON.stringify(driveData));
      const insufficientScope = driveRes.status === 403 && JSON.stringify(driveData).includes('insufficient');
      res.status(driveRes.status).json({
        error: insufficientScope
          ? 'Your Google Drive connection needs an updated permission to upload files. Please disconnect and reconnect Google Drive, then try again.'
          : (driveData?.error?.message || 'Failed to upload video to Google Drive.')
      });
      return;
    }

    res.json({
      file: {
        id: driveData.id,
        name: driveData.name,
        mimeType: driveData.mimeType,
        sizeBytes: driveData.size ? Number(driveData.size) : file.size,
        modifiedTime: driveData.modifiedTime || new Date().toISOString(),
        webViewLink: driveData.webViewLink,
        thumbnailLink: driveData.thumbnailLink,
        durationMillis: driveData.videoMediaMetadata?.durationMillis ? Number(driveData.videoMediaMetadata.durationMillis) : null,
        width: driveData.videoMediaMetadata?.width,
        height: driveData.videoMediaMetadata?.height
      }
    });
  } catch (err) {
    console.error('Google Drive upload error:', err);
    res.status(500).json({ error: 'Failed to upload video to Google Drive.' });
  }
});

// Disconnect / revoke access
router.post('/disconnect', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const connection = await prisma.googleDriveConnection.findUnique({ where: { userId } });
  if (connection) {
    try {
      await fetchWithRetry(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(connection.accessToken)}`, { method: 'POST' }, {
        label: 'Google OAuth revoke',
        maxRetries: 2
      });
    } catch {
      // Best-effort revoke; continue with local cleanup regardless
    }
    await prisma.googleDriveConnection.delete({ where: { userId } });
  }
  res.json({ success: true });
});

export const googleDriveRouter = router;
