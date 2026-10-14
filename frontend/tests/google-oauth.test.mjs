// Lightweight tests: run the real server flow with mocked Google/backend boundaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
import { NextResponse } from 'next/server.js';
const source = ts.transpileModule(readFileSync('lib/google-oauth.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
class BackendError extends Error { constructor(status) { super('Backend error'); this.status = status; } }
function fixture(options = {}) {
  const jar = new Map();
  const calls = [];
  const env = { NODE_ENV: 'development', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback', ...options.env };
  const exports = {};
  const context = { exports, Buffer, URL, URLSearchParams, AbortSignal, process: { env },
    fetch: async (url, init) => { calls.push({ kind: 'google', url, init });
      if (options.exchangeError) throw new Error('private provider detail');
      return { ok: !options.exchangeFailure, json: async () => options.exchangeResult ?? { id_token: 'private-id-token', access_token: 'discarded' } }; },
    require: name => {
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return crypto;
      if (name === 'next/headers') return { cookies: async () => ({ get: name => jar.has(name) ? { value: jar.get(name) } : undefined }) };
      if (name === 'next/server') return { NextResponse };
      if (name === './session') return { cookieOptions: { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/' } };
      if (name === './backend') return { BackendError, backend: async (path, token, body) => {
        calls.push({ kind: 'backend', path, token, body });
        if (options.backendStatus && path !== '/api/auth/me') throw new BackendError(options.backendStatus);
        return path === '/api/auth/me' ? { id: 1 } : path.endsWith('/link') ? { linked: true } : { access_token: 'private-app-token', expires_in: 1800 };
      } };
      throw new Error('Unexpected dependency');
    },
  };
  vm.runInNewContext(source, context);
  async function start(mode = '') {
    const response = await exports.startGoogle(new Request('http://localhost:3000/api/auth/google/start' + mode));
    for (const cookie of response.cookies.getAll()) if (cookie.maxAge > 0) jar.set(cookie.name, cookie.value);
    return response;
  }
  async function callback(query) {
    const state = jar.get('google_oauth_state') ?? jar.get('__Host-google_oauth_state');
    return exports.callbackGoogle(new Request('http://localhost:3000/api/auth/google/callback?' + (query ?? new URLSearchParams({ code: 'private-code', state }))));
  }
  return { jar, calls, start, callback };
}
function cleared(response, prefix = '') {
  for (const key of ['state', 'verifier', 'nonce', 'mode', 'session']) {
    const cookie = response.cookies.get(`${prefix}google_oauth_${key}`);
    assert.equal(cookie.maxAge, 0);
    assert.equal(cookie.httpOnly, true);
  }
}

test('start generates unique state/nonce, S256 PKCE, short HttpOnly cookies', async () => {
  const f = fixture(); const response = await f.start();
  const url = new URL(response.headers.get('location'));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'), 'openid email');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), crypto.createHash('sha256').update(f.jar.get('google_oauth_verifier')).digest('base64url'));
  assert.equal(url.searchParams.get('nonce'), f.jar.get('google_oauth_nonce'));
  assert.notEqual(url.searchParams.get('nonce'), url.searchParams.get('state'));
  assert.equal(url.searchParams.has('client_secret'), false);
  for (const cookie of response.cookies.getAll()) {
    assert.equal(cookie.httpOnly, true); assert.equal(cookie.sameSite, 'lax');
    assert.equal(cookie.maxAge, 600); assert.equal(cookie.path, '/');
  }
  const second = await f.start();
  assert.notEqual(new URL(second.headers.get('location')).searchParams.get('state'), url.searchParams.get('state'));
});
test('login exchanges code privately, sets existing app cookie and clears OAuth cookies', async () => {
  const f = fixture(); await f.start(); const nonce = f.jar.get('google_oauth_nonce');
  const response = await f.callback();
  assert.equal(new URL(response.headers.get('location')).pathname, '/generate');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const exchange = f.calls.find(c => c.kind === 'google');
  assert.equal(exchange.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(exchange.init.body.get('client_secret'), 'test-secret');
  assert.equal(exchange.init.body.get('code_verifier'), f.jar.get('google_oauth_verifier'));
  assert.equal(f.calls.at(-1).body.nonce, nonce);
  assert.equal(f.calls.at(-1).body.id_token, 'private-id-token');
  assert.equal(response.cookies.get('access_token').httpOnly, true);
  assert.equal(response.cookies.get('access_token').value, 'private-app-token');
  assert.equal(await response.text(), ''); cleared(response);
});
test('state mismatch, missing cookies, denial and duplicate parameters never exchange', async () => {
  for (const query of ['code=private-code&state=wrong', 'error=access_denied', 'state=x', 'code=x&code=y&state=x']) {
    const f = fixture(); await f.start(); const response = await f.callback(query);
    assert.equal(f.calls.length, 0); cleared(response);
    assert.equal(new URL(response.headers.get('location')).searchParams.get('error'), 'google_failed');
  }
  const f = fixture(); const response = await f.callback('code=x&state=x');
  assert.equal(f.calls.length, 0); cleared(response);
});
test('link requires session and remains bound to the starting session', async () => {
  const f = fixture(); const denied = await f.start('?mode=link');
  assert.equal(new URL(denied.headers.get('location')).pathname, '/login');
  f.jar.set('access_token', 'original-session'); await f.start('?mode=link');
  f.jar.set('access_token', 'changed-session'); const response = await f.callback();
  assert.equal(f.calls.filter(c => c.kind === 'google').length, 0); cleared(response);
});
test('link sends current authorization and does not replace JWT', async () => {
  const f = fixture(); f.jar.set('access_token', 'original-session'); await f.start('?mode=link');
  const response = await f.callback();
  assert.equal(f.calls.at(-1).path, '/api/auth/google/link');
  assert.equal(f.calls.at(-1).token, 'original-session');
  assert.equal(response.cookies.get('access_token'), undefined);
  assert.equal(new URL(response.headers.get('location')).search, '?google=linked'); cleared(response);
});
test('backend conflicts and failures use safe fixed redirects', async () => {
  for (const status of [401, 403, 409, 503]) {
    const f = fixture({ backendStatus: status }); await f.start(); const response = await f.callback();
    const error = new URL(response.headers.get('location')).searchParams.get('error');
    assert.equal(error, status === 409 ? 'google_link_required' : status === 503 ? 'google_unavailable' : 'google_failed');
    assert.equal(response.cookies.get('access_token'), undefined); cleared(response);
  }
  const f = fixture({ backendStatus: 409 }); f.jar.set('access_token', 'session'); await f.start('?mode=link');
  const response = await f.callback(); assert.equal(new URL(response.headers.get('location')).pathname, '/account'); cleared(response);
});
test('provider errors and missing ID tokens fail safely and clear cookies', async () => {
  for (const options of [{ exchangeError: true }, { exchangeFailure: true }, { exchangeResult: {} }]) {
    const f = fixture(options); await f.start(); const response = await f.callback();
    assert.equal(f.calls.some(c => c.kind === 'backend'), false); cleared(response);
    assert.equal(response.cookies.get('access_token'), undefined);
  }
});
test('missing configuration and unknown modes fail without network requests', async () => {
  const f = fixture({ env: { GOOGLE_CLIENT_SECRET: '' } });
  const response = await f.start(); assert.equal(new URL(response.headers.get('location')).search, '?error=google_unavailable');
  cleared(await f.callback()); assert.equal(f.calls.length, 0);
  const unknown = fixture(); cleared(await unknown.start('?mode=unknown')); assert.equal(unknown.calls.length, 0);
});
test('production uses Secure host-only OAuth cookies', async () => {
  const f = fixture({ env: { NODE_ENV: 'production', GOOGLE_REDIRECT_URI: 'https://app.example/api/auth/google/callback' } });
  const response = await f.start();
  for (const cookie of response.cookies.getAll()) {
    assert.equal(cookie.secure, true); assert.ok(cookie.name.startsWith('__Host-')); assert.equal(cookie.domain, undefined);
  }
  const callback = await f.callback(); assert.equal(callback.cookies.get('access_token').secure, true); cleared(callback, '__Host-');
});
