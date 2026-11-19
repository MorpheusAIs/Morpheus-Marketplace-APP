#!/usr/bin/env node
/* Convert 12 locale MD tables to nested JSON aligned with en.json leaves. */
const fs = require('fs');
const path = require('path');

const EN_PATH = '/tmp/mor-app-i18n/src/i18n/locales/en.json';
const MD_DIR = '/Users/bernardo/.openclaw/workspace/memory/projects/morpheus/appmor-i18n';
const OUT_DIR = '/tmp/mor-app-i18n/src/i18n/locales';
const LOCALES = ['ja','pt-BR','de-DE','fr-FR','es','ko','hi','tr','it','pl','ru','zh-Hans'];

const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const enLeaves = [];
(function walk(o, p) {
  for (const k of Object.keys(o)) {
    const p2 = p ? p + '.' + k : k;
    if (o[k] && typeof o[k] === 'object') walk(o[k], p2); else enLeaves.push(p2);
  }
})(en, '');

function parseMd(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const map = new Map();
  for (const line of lines) {
    const m = line.match(/^\s*\|([^|]+)\|([^|]*)\|/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    if (!key || /^[|:-]+$/.test(key) || key === 'Key') continue;
    if (!/^[a-z]/i.test(key)) continue;
    map.set(key, val);
  }
  return map;
}

// Lowercase dotted candidates for a leaf, e.g. keys.deleteWarning -> keys.deletewarning,
// keys.deleteWarning -> keys.delete.warning, signup.emailPlaceholder -> signup.email.placeholder
function dottedCandidates(leaf) {
  const dot = leaf.indexOf('.');
  if (dot === -1) return [leaf.toLowerCase()];
  const head = leaf.slice(0, dot);
  const rest = leaf.slice(dot + 1);
  // split camel into words
  const words = [];
  let start = 0;
  for (let i = 1; i < rest.length; i++) {
    if (rest[i] >= 'A' && rest[i] <= 'Z') { words.push(rest.slice(start, i)); start = i; }
  }
  words.push(rest.slice(start));
  const out = new Set();
  const n = words.length;
  for (let mask = 0; mask < (1 << (n - 1)); mask++) {
    const parts = [];
    let cur = words[0];
    for (let i = 0; i < n - 1; i++) {
      if (mask & (1 << i)) { parts.push(cur); cur = words[i + 1]; }
      else cur += words[i + 1];
    }
    parts.push(cur);
    out.add(head + '.' + parts.map(s => s.toLowerCase()).join('.'));
  }
  return [...out];
}

// Build mapping leaf -> mdKey using per-locale rules
function buildMapping(mdKeys) {
  const has = (k) => mdKeys.has(k);
  const map = new Map(); // leaf -> mdKey or null (untranslated)
  const missing = [];
  for (const leaf of enLeaves) {
    const cands = dottedCandidates(leaf);
    let found = cands.find(c => has(c)) || null;
    if (found) { map.set(leaf, found); continue; }
    // rule-based fallbacks
    const rules = [];
    // keys.created/lastUsed/... <- keys.card.*
    rules.push([/^keys\.(created|lastUsed|requests30d|spend30d|default|delete)$/, m => 'keys.card.' + m.toLowerCase()]);
    // keys.keyName/keyNamePlaceholder <- keys.create.name(.placeholder)
    if (leaf === 'keys.keyName') rules.push([/.*/, () => 'keys.create.name']);
    if (leaf === 'keys.keyNamePlaceholder') rules.push([/.*/, () => 'keys.create.name.placeholder']);
    // keys.baseUrlLabel <- keys.baseurl
    if (leaf === 'keys.baseUrlLabel') rules.push([/.*/, () => 'keys.baseurl']);
    // usage.statAvg/... <- usage.stat.avg etc; usage.avg/min/max <- usage.stat.avg/min/max
    if (/^usage\.(avg|min|max)$/.test(leaf)) rules.push([/.*/, () => 'usage.stat.' + leaf.split('.')[1]]);
    if (/^usage\.statAvg(Cost)?$/.test(leaf) || /^usage\.stat(Spend|Tokens|Requests|AvgCost)(Sub)?$/.test(leaf)) {
      // e.g. usage.statSpendSub -> usage.stat.spend.sub already handled by dotted candidates
    }
    // pg.paramTopP <- pg.param.top_p; pg.paramFreqPenalty; pg.paramPresPenalty
    if (leaf === 'pg.paramTopP') rules.push([/.*/, () => 'pg.param.top_p']);
    if (leaf === 'pg.paramFreqPenalty') rules.push([/.*/, () => 'pg.param.freq_penalty']);
    if (leaf === 'pg.paramPresPenalty') rules.push([/.*/, () => 'pg.param.pres_penalty']);
    // signin.errorIncorrect etc already via dotted candidates
    // signup.emailPlaceholder -> signup.email.placeholder (dotted handles)
    for (const [re, fn] of rules) {
      if (re.test(leaf)) {
        const k = fn(leaf);
        if (has(k)) { found = k; break; }
      }
    }
    if (found) { map.set(leaf, found); continue; }
    map.set(leaf, null);
    missing.push(leaf);
  }
  return { map, missing };
}

// Convert MD value: single-brace {x} back to {{x}} when en uses {{x}}
function convertValue(mdVal, enVal) {
  if (mdVal == null) return enVal;
  const enPh = [...enVal.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
  let v = mdVal;
  for (const name of enPh) {
    // restore {{name}} from {name} if MD collapsed
    v = v.replace(new RegExp('\\{' + name + '\\}', 'g'), '{{' + name + '}}');
  }
  // Unescape markdown pipes if any leaked
  v = v.replace(/\\\|/g, '|');
  return v;
}

const results = {};
const perLocaleMissing = {};
const perLocaleUntranslatedRows = {};

for (const loc of LOCALES) {
  const md = parseMd(path.join(MD_DIR, loc + '.md'));
  const { map, missing } = buildMapping(md);
  const out = {};
  const untranslatedRows = [];
  for (const leaf of enLeaves) {
    const mdKey = map.get(leaf);
    let val;
    if (mdKey) {
      val = convertValue(md.get(mdKey), getEn(leaf));
      if (val === getEn(leaf)) untranslatedRows.push(leaf + ' (md:' + mdKey + ')');
    } else {
      val = getEn(leaf);
    }
    setLeaf(out, leaf, val);
  }
  results[loc] = out;
  perLocaleMissing[loc] = missing;
  perLocaleUntranslatedRows[loc] = untranslatedRows;
  const obj = buildNested(out);
  fs.writeFileSync(path.join(OUT_DIR, loc + '.json'), JSON.stringify(obj, null, 2) + '\n');
}

function getEn(leaf) {
  return leaf.split('.').reduce((o, k) => o[k], en);
}
function setLeaf(obj, leaf, val) {
  const parts = leaf.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}
function buildNested(flat) {
  const obj = {};
  for (const leaf of Object.keys(flat)) setLeaf(obj, leaf, flat[leaf]);
  return obj;
}

fs.writeFileSync('/tmp/i18n-report.json', JSON.stringify({ perLocaleMissing, perLocaleUntranslatedRows }, null, 2));
console.log('Wrote', LOCALES.length, 'files.');
for (const loc of LOCALES) {
  console.log(loc, 'fallbackToEn:', perLocaleMissing[loc].length, 'sameAsEn:', perLocaleUntranslatedRows[loc].length);
}
