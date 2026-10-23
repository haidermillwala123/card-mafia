#!/usr/bin/env node
// Card Mafia for Claude Desktop. Claude talks to extensions over stdio; the tools live on the website, so this is a thin bridge:
// each JSON-RPC line from Claude is posted to the Card Mafia MCP endpoint and the answer is written back. No dependencies, no stored data.
const readline = require('node:readline');

const ENDPOINT = process.env.CARD_MAFIA_URL || 'https://cards-mafia.vercel.app/mcp';
const TIMEOUT_MS = 90_000; // a seat that was not looked up recently can take about a minute

const send = msg => process.stdout.write(`${JSON.stringify(msg)}\n`);
const fail = (id, message) => send({ jsonrpc: '2.0', id, error: { code: -32603, message } });

let protocol = null; // the version agreed at initialize, sent back on every later call
let pending = 0;
let closed = false;

// The endpoint answers JSON, but a server may also answer a request as an event stream; handle both.
function messagesFrom(contentType, body) {
  if (contentType.includes('text/event-stream')) {
    return body.split('\n').filter(l => l.startsWith('data:')).map(l => JSON.parse(l.slice(5).trim()));
  }
  const parsed = JSON.parse(body);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function forward(msg) {
  const expectsAnswer = msg && msg.id !== undefined && typeof msg.method === 'string';
  try {
    const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (protocol) headers['mcp-protocol-version'] = protocol;
    const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(msg), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!expectsAnswer) return; // a notification: nothing to send back
    const body = await res.text();
    let out;
    try {
      out = messagesFrom(res.headers.get('content-type') || '', body);
    } catch {
      return fail(msg.id, `Card Mafia answered ${res.status} with something unreadable.`);
    }
    for (const m of out) {
      if (msg.method === 'initialize' && m.result && m.result.protocolVersion) protocol = m.result.protocolVersion;
      send(m);
    }
  } catch (e) {
    if (expectsAnswer) fail(msg.id, `Card Mafia could not be reached (${e.message}). Check your connection and try again.`);
  }
}

const lines = readline.createInterface({ input: process.stdin, terminal: false });
lines.on('line', line => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  pending += 1;
  forward(msg).finally(() => {
    pending -= 1;
    if (closed && pending === 0) process.exit(0);
  });
});
lines.on('close', () => {
  closed = true;
  if (pending === 0) process.exit(0);
});
