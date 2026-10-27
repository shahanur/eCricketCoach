import { createRemoteJWKSet, jwtVerify } from 'jose';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleIdentityToken(
  idToken: string,
  clientId: string,
  nonce?: string,
  keys: Parameters<typeof jwtVerify>[1] = googleKeys
) {
  const { payload } = await jwtVerify(idToken, keys, {
    audience: clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'exp', 'iat']
  });
  if (nonce !== undefined && payload.nonce !== nonce) {
    throw new Error('Google sign-in nonce does not match.');
  }
  return payload;
}
