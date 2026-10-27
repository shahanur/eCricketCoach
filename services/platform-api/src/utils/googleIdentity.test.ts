import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyGoogleIdentityToken } from './googleIdentity.js';

test('Google tokens require the correct signature, audience, issuer, expiry, and native nonce', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256' }] });
  async function token(overrides: Record<string, unknown> = {}, expires = '5m') {
    return new SignJWT({ email: 'coach@example.com', email_verified: true, nonce: 'challenge-nonce', ...overrides })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('google-user').setIssuer('https://accounts.google.com')
      .setAudience('web-client-id').setIssuedAt().setExpirationTime(expires).sign(privateKey);
  }
  const valid = await token();
  assert.equal((await verifyGoogleIdentityToken(valid, 'web-client-id', 'challenge-nonce', keys)).sub, 'google-user');
  assert.equal((await verifyGoogleIdentityToken(valid, 'web-client-id', undefined, keys)).email, 'coach@example.com');
  await assert.rejects(verifyGoogleIdentityToken(valid, 'wrong-client', 'challenge-nonce', keys));
  await assert.rejects(verifyGoogleIdentityToken(valid, 'web-client-id', 'wrong-nonce', keys));
  await assert.rejects(verifyGoogleIdentityToken(await token({ nonce: undefined }), 'web-client-id', 'challenge-nonce', keys));
  await assert.rejects(verifyGoogleIdentityToken(await token({}, '-1m'), 'web-client-id', 'challenge-nonce', keys));
  const badIssuer = await new SignJWT({ nonce: 'challenge-nonce' }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('user').setIssuer('https://attacker.example').setAudience('web-client-id')
    .setIssuedAt().setExpirationTime('5m').sign(privateKey);
  await assert.rejects(verifyGoogleIdentityToken(badIssuer, 'web-client-id', 'challenge-nonce', keys));
  const other = await generateKeyPair('RS256');
  const forged = await new SignJWT({ nonce: 'challenge-nonce' }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('user').setIssuer('https://accounts.google.com').setAudience('web-client-id')
    .setIssuedAt().setExpirationTime('5m').sign(other.privateKey);
  await assert.rejects(verifyGoogleIdentityToken(forged, 'web-client-id', 'challenge-nonce', keys));
});
