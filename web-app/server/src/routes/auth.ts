import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { prisma } from '../config/prisma.js';
import { fetchWithRetry } from '../utils/retry.js';
import { isAllowedAppOrigin, resolveAppOrigin } from '../utils/appOrigin.js';

type Provider = 'google' | 'microsoft' | 'apple';

const providerConfig: Record<Provider, { clientId?: string; clientSecret?: string; authorizationUrl: string; tokenUrl: string; jwksUrl: string; issuer?: string }> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com'
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    jwksUrl: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
    authorizationUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    issuer: 'https://appleid.apple.com'
  }
};

const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

export async function resolveRosterIdentity(email: string) {
  const primaryTenant = await prisma.customerTenant.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });
  const activeMember = primaryTenant ? null : await prisma.clubMember.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      invitationStatus: 'ACTIVE',
      role: { in: ['COACH', 'PLAYER'] }
    }
  });
  const memberTenant = activeMember?.clubId
    ? await prisma.customerTenant.findUnique({ where: { id: activeMember.clubId } })
    : null;
  const tenant = primaryTenant || memberTenant;

  if (!tenant || !['ACTIVE', 'TRIAL'].includes(tenant.status)) return null;

  return {
    tenant,
    member: activeMember,
    role: activeMember
      ? activeMember.role as 'COACH' | 'PLAYER'
      : tenant.type === 'CLUB' ? 'CLUB_ADMIN' as const : tenant.type === 'COACH' ? 'COACH' as const : 'PLAYER' as const
  };
}

function getProvider(value: string): Provider | undefined {
  return value === 'google' || value === 'microsoft' || value === 'apple' ? value : undefined;
}

function safeReturnTo(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

async function verifyIdentityToken(provider: Provider, idToken: string): Promise<JWTPayload> {
  const config = providerConfig[provider];
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  const result = await jwtVerify(idToken, jwks, {
    audience: config.clientId,
    issuer: config.issuer
  });

  if (provider === 'microsoft' && !String(result.payload.iss || '').startsWith('https://login.microsoftonline.com/')) {
    throw new Error('Unexpected Microsoft token issuer.');
  }

  return result.payload;
}

export const authRouter = Router();

authRouter.get('/providers', (_req: Request, res: Response) => {
  res.json(Object.fromEntries(
    (Object.keys(providerConfig) as Provider[]).map(provider => [provider, Boolean(providerConfig[provider].clientId && providerConfig[provider].clientSecret)])
  ));
});

authRouter.get('/:provider', (req: Request, res: Response) => {
  const provider = getProvider(req.params.provider);
  if (!provider) {
    res.status(404).json({ error: 'Unknown identity provider.' });
    return;
  }

  const config = providerConfig[provider];
  if (!config.clientId || !config.clientSecret) {
    res.status(503).json({ error: `${provider} sign-in is not configured.` });
    return;
  }

  const returnTo = safeReturnTo(req.query.returnTo);
  const origin = resolveAppOrigin(req);
  const state = jwt.sign({ provider, returnTo, origin }, jwtSecret, { expiresIn: '10m' });
  const callbackUrl = `${origin}/api/auth/${provider}/callback`;
  const authorizationUrl = new URL(config.authorizationUrl);
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', callbackUrl);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', provider === 'microsoft' ? 'openid profile email' : 'openid email profile');
  authorizationUrl.searchParams.set('state', state);

  // Force Google / Microsoft to prompt account selection so logging in again lets users pick or switch accounts
  if (provider === 'google' || provider === 'microsoft') {
    authorizationUrl.searchParams.set('prompt', 'select_account');
  }

  if (provider === 'apple') authorizationUrl.searchParams.set('response_mode', 'form_post');
  res.redirect(authorizationUrl.toString());
});

async function handleCallback(req: Request, res: Response): Promise<void> {
  const provider = getProvider(req.params.provider);
  const code = String(req.method === 'POST' ? req.body.code : req.query.code || '');
  const state = String(req.method === 'POST' ? req.body.state : req.query.state || '');
  if (!provider || !code || !state) {
    res.status(400).json({ error: 'OAuth callback is missing required parameters.' });
    return;
  }

  let statePayload: { provider: Provider; returnTo: string; origin?: string };
  try {
    statePayload = jwt.verify(state, jwtSecret) as { provider: Provider; returnTo: string; origin?: string };
  } catch {
    res.status(400).json({ error: 'OAuth state is invalid or expired.' });
    return;
  }
  if (statePayload.provider !== provider) {
    res.status(400).json({ error: 'OAuth provider does not match request state.' });
    return;
  }

  const config = providerConfig[provider];
  const appOrigin = isAllowedAppOrigin(statePayload.origin) ? statePayload.origin : resolveAppOrigin(req);
  const callbackUrl = `${appOrigin}/api/auth/${provider}/callback`;
  const tokenResponse = await fetchWithRetry(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      code,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code'
    })
  }, { label: `${provider} OAuth token exchange` });
  const tokenData = await tokenResponse.json() as { id_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenData.id_token) {
    res.status(401).json({ error: tokenData.error_description || 'Unable to exchange the OAuth authorization code.' });
    return;
  }

  let identity: JWTPayload;
  try {
    identity = await verifyIdentityToken(provider, tokenData.id_token);
  } catch {
    res.status(401).json({ error: 'The identity provider returned an invalid token.' });
    return;
  }

  const email = typeof identity.email === 'string' ? identity.email.toLowerCase() : '';
  const name = (typeof identity.name === 'string' && identity.name.trim())
    ? identity.name.trim()
    : (typeof identity.given_name === 'string'
        ? `${identity.given_name} ${typeof identity.family_name === 'string' ? identity.family_name : ''}`.trim()
        : (email === 'shahanurreza@gmail.com' ? 'Shahanur Reza' : email.split('@')[0]));

  if (!email || (provider === 'google' && identity.email_verified !== true)) {
    res.status(401).json({ error: 'The identity provider did not supply a verified email address.' });
    return;
  }

  const redirectUrl = new URL(safeReturnTo(statePayload.returnTo), appOrigin);

  // Check if user is a designated system super admin
  const adminEmails = (process.env.ADMIN_EMAILS || 'shahanurreza@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.includes(email)) {
    const role = 'SUPER_ADMIN';
    const adminDisplayName = name && name !== email ? name : 'Shahanur Reza';
    const authToken = jwt.sign(
      { userId: `oauth-${provider}-${identity.sub}`, tenantId: 'system-admin', role, email, name: adminDisplayName },
      jwtSecret,
      { expiresIn: '8h' }
    );
    redirectUrl.hash = new URLSearchParams({
      auth_token: authToken,
      name: adminDisplayName,
      email,
      role
    }).toString();
    res.redirect(redirectUrl.toString());
    return;
  }

  const resolvedIdentity = await resolveRosterIdentity(email);

  if (!resolvedIdentity) {
    const registrationToken = jwt.sign({ type: 'registration', email, name, provider }, jwtSecret, { expiresIn: '30m' });
    redirectUrl.searchParams.set('registration_token', registrationToken);
    redirectUrl.searchParams.set('registration_name', name);
    redirectUrl.searchParams.set('registration_email', email);
    res.redirect(redirectUrl.toString());
    return;
  }

  const { tenant, member, role } = resolvedIdentity;
  const userId = member?.id || `oauth-${provider}-${identity.sub}`;
  const coachContext = role === 'COACH' ? (member ? 'CLUB' : 'STANDALONE') : undefined;
  const authToken = jwt.sign({ userId, tenantId: tenant.id, role, coachContext, email }, jwtSecret, { expiresIn: '8h' });
  redirectUrl.hash = new URLSearchParams({
    auth_token: authToken,
    userId,
    name,
    email,
    role,
    ...(coachContext ? { coachContext } : {}),
    tenantId: tenant.id,
    clubName: tenant.name
  }).toString();
  res.redirect(redirectUrl.toString());
}

authRouter.get('/:provider/callback', (req: Request, res: Response) => {
  handleCallback(req, res).catch(() => res.status(500).json({ error: 'Social sign-in could not be completed.' }));
});

authRouter.post('/:provider/callback', (req: Request, res: Response) => {
  handleCallback(req, res).catch(() => res.status(500).json({ error: 'Social sign-in could not be completed.' }));
});