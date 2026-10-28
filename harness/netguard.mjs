// H-O2 network guard (SDD-operator §4). Preload with `node --import ./harness/netguard.mjs …` (or NODE_OPTIONS, so
// every child `node` inherits it). Wraps net, tls, dns, http, https and fetch: every attempted call is appended to
// the log BEFORE it is failed, so an attempt is recorded even though it can never succeed.
//   NETGUARD_LOG  log path (default: ./netguard.log in the working directory)
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire, syncBuiltinESMExports } from 'node:module';

const require = createRequire(import.meta.url);
const LOG = resolve(process.env.NETGUARD_LOG || 'netguard.log');
const blocked = (what, args) => {
  let detail = '';
  try { detail = JSON.stringify(args, (k, v) => (typeof v === 'function' ? '[fn]' : v)).slice(0, 300); } catch { detail = '[unserialisable]'; }
  appendFileSync(LOG, `${new Date().toISOString()} pid=${process.pid} ${what} ${detail}\n`);
  const e = new Error(`netguard: ${what} blocked (SDD-operator H-O2)`); e.code = 'ENETGUARD'; return e;
};
const guard = (mod, name, fns) => { for (const f of fns) if (typeof mod[f] === 'function') mod[f] = function (...a) { throw blocked(`${name}.${f}`, a); }; };

const net = require('node:net'), tls = require('node:tls'), dns = require('node:dns'), http = require('node:http'), https = require('node:https');
guard(net, 'net', ['connect', 'createConnection']);
net.Socket.prototype.connect = function (...a) { throw blocked('net.Socket.connect', a); };
guard(tls, 'tls', ['connect']);
guard(dns, 'dns', ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolveTxt', 'resolveSrv', 'reverse']);
if (dns.promises) guard(dns.promises, 'dns.promises', ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'reverse']);
guard(http, 'http', ['request', 'get']);
guard(https, 'https', ['request', 'get']);
globalThis.fetch = async (...a) => { throw blocked('fetch', a.map(String)); };
syncBuiltinESMExports();
