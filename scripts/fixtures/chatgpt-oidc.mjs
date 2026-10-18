// Local signing fixture only. Never contacts OpenAI or reads existing credentials.
import { generateKeyPairSync, sign } from 'node:crypto';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
const now = Math.floor(Date.now() / 1000);
const claims = { iss: 'https://auth.openai.com', sub: 'fixture-subject', aud: 'oaiapp_fixture', nonce: 'fixture-nonce', email: 'fixture@example.test', iat: now, exp: now + 3600 };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = (changes = {}, header = {}) => {
  const input = `${encode({ alg: 'RS256', kid: 'fixture-key', ...header })}.${encode({ ...claims, ...changes })}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
};
process.stdout.write(JSON.stringify({ keys: { keys: [key] }, valid: token(),
  issuer: token({ iss: 'https://evil.example' }), audience: token({ aud: 'oaiapp_other' }),
  nonce: token({ nonce: 'other' }), expired: token({ exp: now - 3600 }), future: token({ nbf: now + 3600 }),
  future_iat: token({ iat: now + 3600 }), missing_audience: token({ aud: undefined }),
  multiple_audience: token({ aud: ['oaiapp_fixture', 'oaiapp_other'] }),
  unknown_key: token({}, { kid: 'unknown' }), hs256: token({}, { alg: 'HS256' }),
}));
