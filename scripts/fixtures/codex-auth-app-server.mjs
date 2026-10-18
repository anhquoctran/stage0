// Test-only auth RPC fixture. Never contacts OpenAI or reads credential files.
import readline from 'node:readline';

const scenario = process.argv[2] || 'success';
let signedIn = scenario === 'saved';
const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  const result = (value) => send({ id: request.id, result: value });
  switch (request.method) {
    case 'initialize': result({ userAgent: 'fixture' }); break;
    case 'initialized': break;
    case 'account/read': result({ account: scenario === 'api-key' ? { type: 'apiKey' } : signedIn ? { type: 'chatgpt', email: 'fixture@example.test', planType: 'plus', access_token: 'fixture-not-for-ui' } : null }); break;
    case 'account/login/start':
      if (scenario === 'unsupported') { send({ id: request.id, error: { code: -32602, message: 'fixture-secret-error-body' } }); break; }
      if (scenario === 'oversized') { process.stdout.write('x'.repeat(33 * 1024) + '\n'); break; }
      if (scenario === 'wrong-id') { send({ id: 777, result: {} }); break; }
      result({ type: 'chatgptDeviceCode', loginId: 'fixture-login', verificationUrl: scenario === 'spoofed' ? 'https://evil.example/device' : 'https://auth.openai.com/codex/device', userCode: 'ABCD-1234', access_token: 'fixture-not-for-ui' });
      if (scenario === 'success' || scenario === 'denied') {
        send({ method: 'account/login/completed', params: { loginId: 'other-login', success: false } });
        signedIn = scenario === 'success';
        send({ method: 'account/login/completed', params: { loginId: 'fixture-login', success: signedIn, error: signedIn ? null : 'fixture-secret-error-body' } });
      }
      break;
    case 'account/login/cancel': result({}); break;
    case 'account/logout': signedIn = false; result({}); break;
    default: send({ id: request.id, error: { code: -32601, message: 'Unexpected non-auth request' } });
  }
});
