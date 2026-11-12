import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/lib/resend.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
function fixture({ provider = 'gmail', password = 'fixture password', result = { messageId: 'fixture', accepted: ['recipient@example.test'], rejected: [] }, failure } = {}) {
  const exports = {}, sent = [], connections = [];
  let closed = false;
  vm.runInNewContext(source, { exports, process: { env: { EMAIL_PROVIDER: provider, GMAIL_USER: 'ekru.team@gmail.com', GMAIL_APP_PASSWORD: password, RESEND_API_KEY: 'fixture', RESEND_FROM_EMAIL: 'E-KRU <sender@example.test>' } }, require(name) {
    if (name === 'server-only') return {};
    if (name === 'resend') return { Resend: class { emails = { send: async message => { sent.push(message); return { data: { id: 'fixture' } }; } }; } };
    if (name === 'nodemailer') return { createTransport(options) { connections.push(options); return { sendMail: async message => { sent.push(message); if (failure) throw failure; return result; }, close: () => { closed = true; } }; } };
    throw new Error(name);
  } });
  return { exports, sent, connections, closed: () => closed };
}
const message = { to: 'recipient@example.test', subject: 'fixture', html: '<p>fixture</p>' };
test('Gmail uses TLS, configured sender and matching reply-to', async () => {
  const f = fixture(); await f.exports.sendEmail(message);
  assert.equal(f.sent[0].from.address, 'ekru.team@gmail.com');
  assert.equal(f.sent[0].replyTo, 'ekru.team@gmail.com');
  assert.equal(f.connections[0].secure, true);
  assert.equal(f.connections[0].auth.pass, 'fixturepassword');
  assert.equal(f.closed(), true);
});
test('Gmail missing credentials, authentication failures and rejected recipient fail closed', async () => {
  for (const [options, code] of [[{ password: '' }, 'gmail_configuration_error'], [{ failure: { code: 'EAUTH' } }, 'gmail_auth_error'], [{ result: { messageId: 'fixture', accepted: [], rejected: ['recipient@example.test'] } }, 'gmail_send_error']]) {
    const f = fixture(options);
    await assert.rejects(f.exports.sendEmail(message), error => error.providerCode === code);
    assert.equal(f.closed(), code !== 'gmail_configuration_error');
  }
});
test('Resend mode keeps the existing provider and explicit reply-to', async () => {
  const f = fixture({ provider: 'resend' }); await f.exports.sendEmail({ ...message, replyTo: 'reply@example.test' });
  assert.equal(f.connections.length, 0);
  assert.equal(f.sent[0].replyTo, 'reply@example.test');
});
