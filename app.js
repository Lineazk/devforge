/**
 * DevForge - Main Application Controller
 * Manages tab navigation, state persistence, preset loading, clipboard actions, and live updates.
 */

import { parseCurl, generateCode } from './modules/curlConverter.js';
import { generateTypes } from './modules/jsonTypeGen.js';
import { inspectJwt, STANDARD_CLAIMS_INFO } from './modules/jwtInspector.js';
import {
  computeHashes,
  computeHmacSha256,
  generateUuidV4,
  generateUuidV7,
  extractTimestampFromUuidV7,
  generateBatchUuids,
  encodeBase64,
  decodeBase64,
  encodeUrl,
  decodeUrl,
  encodeHtml,
  decodeHtml,
} from './modules/cryptoUtils.js';
import {
  computeLineDiff,
  testRegex,
  REGEX_PRESETS,
  convertCases,
  explainCron,
  convertTimestamp,
} from './modules/textTools.js';

// ---------------- Toast Notifications ----------------
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white';
  toast.className = `flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium transition-all transform duration-300 opacity-0 translate-y-2 ${bg}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ---------------- Copy Helper ----------------
export async function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg, 'success');
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast(successMsg, 'success');
  }
}

// ---------------- Tab Routing ----------------
const TABS = ['curl', 'json', 'jwt', 'crypto', 'uuid', 'text', 'cron'];
let activeTab = 'curl';

function switchTab(tabId) {
  if (!TABS.includes(tabId)) return;
  activeTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isTarget = btn.dataset.tab === tabId;
    btn.classList.toggle('active-tab', isTarget);
    btn.classList.toggle('text-indigo-400', isTarget);
    btn.classList.toggle('border-indigo-500', isTarget);
  });

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `tab-${tabId}`);
  });

  localStorage.setItem('devforge_active_tab', tabId);
}

// ---------------- Samples & Presets ----------------
const SAMPLE_CURL = `curl -X POST https://api.github.com/repos/octocat/hello-world/dispatches \\
  -H "Accept: application/vnd.github+json" \\
  -H "Authorization: Bearer ghp_999999999999999999999999999999999999" \\
  -H "X-GitHub-Api-Version: 2022-11-28" \\
  -d '{"event_type":"deploy_production","client_payload":{"unit":true,"integration":true,"environment":"prod"}}'`;

const SAMPLE_JSON = `{
  "id": "usr_99812",
  "username": "octo_developer",
  "profile": {
    "displayName": "Alex Turner",
    "avatarUrl": "https://avatars.example.com/u/99812",
    "verified": true,
    "reputationScore": 4580.5
  },
  "roles": ["admin", "maintainer", "contributor"],
  "settings": {
    "theme": "dark",
    "notificationsEnabled": true,
    "maxTokens": 4096
  },
  "metadata": {
    "lastLoginAt": "2026-08-26T11:20:00Z",
    "retryCount": 0
  }
}`;

const SAMPLE_JWT = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InByb2QtYXV0aC1rZXktMDIifQ.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20vIiwic3ViIjoiZGlkOmtleTp6Nk1rZ1ZKNk5EY1RxZzV6cllhaERZcEJzcnNrdzQ4QXh2dk01TnFzdHFyb0xvdWQiLCJhdWQiOlsiYXBpLnNlcnZpY2UuaW8iXSwiaWF0IjoxNzg3NzQwODAwLCJleHAiOjE4NzA5NTAwMDAsImVtYWlsIjoiZGV2QGV4YW1wbGUub3JnIiwicm9sZXMiOlsiZGV2ZWxvcGVyIiwiYWRtaW4iXSwiY29udHJpYnV0aW9uIjoiQGZsb3BfbGFicyJ9.j2S3mF8wI3m3F6kZ4K3P2A1B0N9M8L7K6J5H4G3F2E1`;

// ---------------- App Initialization ----------------
document.addEventListener('DOMContentLoaded', () => {
  // Theme Setup
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('devforge_theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }

  themeToggle?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('devforge_theme', isDark ? 'dark' : 'light');
    showToast(isDark ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  });

  // Modal Setup
  const aboutModal = document.getElementById('about-modal');
  const openAboutBtn = document.getElementById('open-about-btn');
  const openAboutFooter = document.getElementById('open-about-footer');
  const closeAboutBtn = document.getElementById('close-about-btn');

  function openAbout() {
    aboutModal?.classList.remove('hidden');
  }
  function closeAbout() {
    aboutModal?.classList.add('hidden');
  }

  openAboutBtn?.addEventListener('click', openAbout);
  openAboutFooter?.addEventListener('click', openAbout);
  closeAboutBtn?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e) => {
    if (e.target === aboutModal) closeAbout();
  });

  // Tab Listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const savedTab = localStorage.getItem('devforge_active_tab') || 'curl';
  switchTab(savedTab);

  // Initialize Modules
  initCurlModule();
  initJsonModule();
  initJwtModule();
  initCryptoModule();
  initUuidModule();
  initTextModule();
  initCronModule();

  // DID Quick Copy Buttons
  document.querySelectorAll('.copy-did-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard('did:key:z6MkgVJ4NDcTqg5zrYahDYpBsrskw48AxbvM5NqstqroLoud', 'Public DID copied!');
    });
  });
});

// ---------------- 1. cURL Module ----------------
function initCurlModule() {
  const curlInput = document.getElementById('curl-input');
  const langSelect = document.getElementById('curl-lang-select');
  const curlOutput = document.getElementById('curl-output');
  const loadSampleBtn = document.getElementById('curl-sample-btn');
  const clearBtn = document.getElementById('curl-clear-btn');
  const copyBtn = document.getElementById('curl-copy-btn');
  const methodBadge = document.getElementById('curl-method-badge');
  const urlBadge = document.getElementById('curl-url-badge');

  function update() {
    const input = curlInput.value.trim();
    if (!input) {
      curlOutput.value = '// Paste a cURL command above to generate code';
      if (methodBadge) methodBadge.textContent = 'GET';
      if (urlBadge) urlBadge.textContent = 'https://...';
      return;
    }

    try {
      const parsed = parseCurl(input);
      if (methodBadge) methodBadge.textContent = parsed.method;
      if (urlBadge) urlBadge.textContent = parsed.url || 'No URL specified';
      const code = generateCode(parsed, langSelect.value);
      curlOutput.value = code;
    } catch (err) {
      curlOutput.value = `// Error parsing cURL: ${err.message}`;
    }
  }

  curlInput.addEventListener('input', update);
  langSelect.addEventListener('change', update);

  loadSampleBtn.addEventListener('click', () => {
    curlInput.value = SAMPLE_CURL;
    update();
    showToast('Loaded sample GitHub API cURL command');
  });

  clearBtn.addEventListener('click', () => {
    curlInput.value = '';
    update();
  });

  copyBtn.addEventListener('click', () => {
    copyToClipboard(curlOutput.value, 'Generated code copied!');
  });

  // Initial update
  if (!curlInput.value) {
    curlInput.value = SAMPLE_CURL;
  }
  update();
}

// ---------------- 2. JSON Module ----------------
function initJsonModule() {
  const jsonInput = document.getElementById('json-input');
  const targetSelect = document.getElementById('json-target-select');
  const rootNameInput = document.getElementById('json-root-name');
  const jsonOutput = document.getElementById('json-output');
  const sampleBtn = document.getElementById('json-sample-btn');
  const formatBtn = document.getElementById('json-format-btn');
  const minifyBtn = document.getElementById('json-minify-btn');
  const copyBtn = document.getElementById('json-copy-btn');
  const statusBadge = document.getElementById('json-status-badge');

  function update() {
    const input = jsonInput.value.trim();
    if (!input) {
      jsonOutput.value = '// Paste JSON to generate types';
      if (statusBadge) statusBadge.textContent = 'Ready';
      return;
    }

    try {
      const root = rootNameInput.value.trim() || 'RootObject';
      const types = generateTypes(input, root, targetSelect.value);
      jsonOutput.value = types;
      if (statusBadge) {
        statusBadge.textContent = 'Valid JSON';
        statusBadge.className = 'px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      }
    } catch (err) {
      jsonOutput.value = `// Error: ${err.message}`;
      if (statusBadge) {
        statusBadge.textContent = 'Invalid JSON';
        statusBadge.className = 'px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30';
      }
    }
  }

  jsonInput.addEventListener('input', update);
  targetSelect.addEventListener('change', update);
  rootNameInput.addEventListener('input', update);

  sampleBtn.addEventListener('click', () => {
    jsonInput.value = SAMPLE_JSON;
    update();
    showToast('Loaded sample JSON payload');
  });

  formatBtn.addEventListener('click', () => {
    try {
      const obj = JSON.parse(jsonInput.value);
      jsonInput.value = JSON.stringify(obj, null, 2);
      update();
      showToast('Formatted JSON');
    } catch (err) {
      showToast('Cannot format invalid JSON', 'error');
    }
  });

  minifyBtn.addEventListener('click', () => {
    try {
      const obj = JSON.parse(jsonInput.value);
      jsonInput.value = JSON.stringify(obj);
      update();
      showToast('Minified JSON');
    } catch (err) {
      showToast('Cannot minify invalid JSON', 'error');
    }
  });

  copyBtn.addEventListener('click', () => {
    copyToClipboard(jsonOutput.value, 'Generated types copied!');
  });

  if (!jsonInput.value) {
    jsonInput.value = SAMPLE_JSON;
  }
  update();
}

// ---------------- 3. JWT Module ----------------
function initJwtModule() {
  const jwtInput = document.getElementById('jwt-input');
  const headerOutput = document.getElementById('jwt-header-output');
  const payloadOutput = document.getElementById('jwt-payload-output');
  const signatureOutput = document.getElementById('jwt-signature-output');
  const expiryBadge = document.getElementById('jwt-expiry-badge');
  const claimsTable = document.getElementById('jwt-claims-table');
  const sampleBtn = document.getElementById('jwt-sample-btn');
  const clearBtn = document.getElementById('jwt-clear-btn');
  const copyPayloadBtn = document.getElementById('jwt-copy-payload-btn');

  let expiryTimer = null;

  function update() {
    const token = jwtInput.value.trim();
    if (!token) {
      headerOutput.textContent = '// Header will appear here';
      payloadOutput.textContent = '// Payload will appear here';
      signatureOutput.textContent = '// Signature will appear here';
      if (expiryBadge) expiryBadge.textContent = 'Awaiting token';
      if (claimsTable) claimsTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-slate-500 text-xs">No token loaded</td></tr>';
      return;
    }

    try {
      const data = inspectJwt(token);
      headerOutput.textContent = JSON.stringify(data.header, null, 2);
      payloadOutput.textContent = JSON.stringify(data.payload, null, 2);
      signatureOutput.textContent = data.signature;

      // Expiry status
      if (data.expiryStatus) {
        expiryBadge.textContent = data.expiryStatus.text;
        if (data.expiryStatus.isExpired) {
          expiryBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30';
        } else {
          expiryBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        }
      } else {
        expiryBadge.textContent = 'No Expiration Claim (exp)';
        expiryBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';
      }

      // Claims table
      if (claimsTable) {
        const rows = Object.entries(data.payload).map(([k, v]) => {
          const desc = STANDARD_CLAIMS_INFO[k] || 'Custom claim';
          let displayVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
          if (k === 'exp' || k === 'iat' || k === 'nbf') {
            const date = new Date(Number(v) * 1000);
            displayVal += ` (${date.toLocaleString()})`;
          }
          return `<tr class="border-b border-slate-800 hover:bg-slate-800/40">
            <td class="px-4 py-2 font-mono text-indigo-400 font-medium text-xs">${k}</td>
            <td class="px-4 py-2 text-slate-300 text-xs break-all">${displayVal}</td>
            <td class="px-4 py-2 text-slate-400 text-xs">${desc}</td>
          </tr>`;
        }).join('');
        claimsTable.innerHTML = rows;
      }
    } catch (err) {
      headerOutput.textContent = `// Error: ${err.message}`;
      payloadOutput.textContent = '';
      signatureOutput.textContent = '';
      if (expiryBadge) {
        expiryBadge.textContent = 'Invalid JWT';
        expiryBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30';
      }
    }
  }

  jwtInput.addEventListener('input', () => {
    update();
    if (expiryTimer) clearInterval(expiryTimer);
    expiryTimer = setInterval(update, 1000); // Live countdown tick
  });

  sampleBtn.addEventListener('click', () => {
    jwtInput.value = SAMPLE_JWT;
    update();
    showToast('Loaded sample JWT token');
  });

  clearBtn.addEventListener('click', () => {
    jwtInput.value = '';
    update();
  });

  copyPayloadBtn.addEventListener('click', () => {
    copyToClipboard(payloadOutput.textContent, 'JWT Payload JSON copied!');
  });

  if (!jwtInput.value) {
    jwtInput.value = SAMPLE_JWT;
  }
  update();
  expiryTimer = setInterval(update, 1000);
}

// ---------------- 4. Crypto & Hashes Module ----------------
function initCryptoModule() {
  const textInput = document.getElementById('crypto-input');
  const sha256Out = document.getElementById('hash-sha256');
  const sha512Out = document.getElementById('hash-sha512');
  const sha1Out = document.getElementById('hash-sha1');
  const md5Out = document.getElementById('hash-md5');

  const hmacKey = document.getElementById('hmac-key');
  const hmacMsg = document.getElementById('hmac-msg');
  const hmacOut = document.getElementById('hmac-out');

  const b64Raw = document.getElementById('b64-raw');
  const b64Encoded = document.getElementById('b64-encoded');
  const b64EncodeBtn = document.getElementById('b64-encode-btn');
  const b64DecodeBtn = document.getElementById('b64-decode-btn');

  const urlRaw = document.getElementById('url-raw');
  const urlEncoded = document.getElementById('url-encoded');
  const urlEncodeBtn = document.getElementById('url-encode-btn');
  const urlDecodeBtn = document.getElementById('url-decode-btn');

  async function updateHashes() {
    const text = textInput.value;
    if (!text) {
      sha256Out.value = '';
      sha512Out.value = '';
      sha1Out.value = '';
      md5Out.value = '';
      return;
    }
    const hashes = await computeHashes(text);
    sha256Out.value = hashes.sha256;
    sha512Out.value = hashes.sha512;
    sha1Out.value = hashes.sha1;
    md5Out.value = hashes.md5;
  }

  async function updateHmac() {
    const key = hmacKey.value;
    const msg = hmacMsg.value;
    if (!key || !msg) {
      hmacOut.value = '';
      return;
    }
    hmacOut.value = await computeHmacSha256(key, msg);
  }

  textInput.addEventListener('input', updateHashes);
  hmacKey.addEventListener('input', updateHmac);
  hmacMsg.addEventListener('input', updateHmac);

  b64EncodeBtn.addEventListener('click', () => {
    try {
      b64Encoded.value = encodeBase64(b64Raw.value);
      showToast('Encoded to Base64');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  b64DecodeBtn.addEventListener('click', () => {
    try {
      b64Raw.value = decodeBase64(b64Encoded.value);
      showToast('Decoded from Base64');
    } catch (err) {
      showToast('Invalid Base64 string', 'error');
    }
  });

  urlEncodeBtn.addEventListener('click', () => {
    urlEncoded.value = encodeUrl(urlRaw.value);
    showToast('URL Encoded');
  });

  urlDecodeBtn.addEventListener('click', () => {
    try {
      urlRaw.value = decodeUrl(urlEncoded.value);
      showToast('URL Decoded');
    } catch (err) {
      showToast('Invalid URL encoding', 'error');
    }
  });

  // Copy buttons for all hash inputs
  document.querySelectorAll('.copy-hash-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input && input.value) {
        copyToClipboard(input.value, 'Hash copied!');
      }
    });
  });

  textInput.value = 'DevForge Zero-Telemetry Security';
  updateHashes();
  hmacKey.value = 'secret_signature_key';
  hmacMsg.value = 'did:key:z6MkgVJ4NDcTqg5zrYahDYpBsrskw48AxbvM5NqstqroLoud';
  updateHmac();
}

// ---------------- 5. UUID Module ----------------
function initUuidModule() {
  const v4Single = document.getElementById('uuid-v4-single');
  const v7Single = document.getElementById('uuid-v7-single');
  const v7TimePreview = document.getElementById('uuid-v7-time');
  const genV4Btn = document.getElementById('gen-v4-btn');
  const genV7Btn = document.getElementById('gen-v7-btn');

  const batchCount = document.getElementById('uuid-batch-count');
  const batchVer = document.getElementById('uuid-batch-version');
  const batchFormat = document.getElementById('uuid-batch-format');
  const batchOutput = document.getElementById('uuid-batch-output');
  const genBatchBtn = document.getElementById('gen-batch-btn');
  const copyBatchBtn = document.getElementById('copy-batch-btn');

  function newV4() {
    const id = generateUuidV4();
    v4Single.value = id;
  }

  function newV7() {
    const id = generateUuidV7();
    v7Single.value = id;
    const date = extractTimestampFromUuidV7(id);
    if (v7TimePreview && date) {
      v7TimePreview.textContent = `Embedded Time: ${date.toLocaleString()} (${date.toISOString()})`;
    }
  }

  function updateBatch() {
    const count = Math.min(100, Math.max(1, parseInt(batchCount.value) || 5));
    const items = generateBatchUuids(batchVer.value, count, batchFormat.value);
    batchOutput.value = items.join('\n');
  }

  genV4Btn.addEventListener('click', () => {
    newV4();
    showToast('Generated new UUID v4');
  });

  genV7Btn.addEventListener('click', () => {
    newV7();
    showToast('Generated new UUID v7');
  });

  genBatchBtn.addEventListener('click', () => {
    updateBatch();
    showToast('Batch UUIDs generated');
  });

  copyBatchBtn.addEventListener('click', () => {
    copyToClipboard(batchOutput.value, 'Batch UUIDs copied!');
  });

  newV4();
  newV7();
  updateBatch();
}

// ---------------- 6. Text, Diff & Regex Module ----------------
function initTextModule() {
  // Diff
  const diffOrig = document.getElementById('diff-original');
  const diffMod = document.getElementById('diff-modified');
  const diffOutput = document.getElementById('diff-output');
  const diffAddBadge = document.getElementById('diff-add-badge');
  const diffDelBadge = document.getElementById('diff-del-badge');
  const diffSampleBtn = document.getElementById('diff-sample-btn');

  function updateDiff() {
    const res = computeLineDiff(diffOrig.value, diffMod.value);
    if (diffAddBadge) diffAddBadge.textContent = `+${res.stats.additions}`;
    if (diffDelBadge) diffDelBadge.textContent = `-${res.stats.deletions}`;

    const html = res.diff.map(line => {
      if (line.type === 'added') {
        return `<div class="bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500 px-3 py-0.5 font-mono text-xs"><span class="select-none text-emerald-600 font-bold mr-2">+</span>${escapeHtml(line.text)}</div>`;
      } else if (line.type === 'removed') {
        return `<div class="bg-rose-950/40 text-rose-300 border-l-2 border-rose-500 px-3 py-0.5 font-mono text-xs"><span class="select-none text-rose-600 font-bold mr-2">-</span>${escapeHtml(line.text)}</div>`;
      }
      return `<div class="text-slate-400 px-3 py-0.5 font-mono text-xs"><span class="select-none text-slate-600 mr-3">&nbsp;</span>${escapeHtml(line.text)}</div>`;
    }).join('');

    diffOutput.innerHTML = html || '<div class="text-slate-600 text-xs p-4">No content to compare</div>';
  }

  diffOrig.addEventListener('input', updateDiff);
  diffMod.addEventListener('input', updateDiff);

  diffSampleBtn.addEventListener('click', () => {
    diffOrig.value = `function calculateTotal(items) {\n  let total = 0;\n  for (let i = 0; i < items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}`;
    diffMod.value = `function calculateTotal(items, discount = 0) {\n  const subtotal = items.reduce((sum, item) => sum + item.price, 0);\n  const discountAmount = subtotal * (discount / 100);\n  return Math.max(0, subtotal - discountAmount);\n}`;
    updateDiff();
    showToast('Loaded sample diff comparison');
  });

  // Regex
  const regexPattern = document.getElementById('regex-pattern');
  const regexFlags = document.getElementById('regex-flags');
  const regexTestStr = document.getElementById('regex-test-str');
  const regexHighlight = document.getElementById('regex-highlight');
  const regexMatchesTable = document.getElementById('regex-matches-table');
  const regexMatchCount = document.getElementById('regex-match-count');
  const regexPresetSelect = document.getElementById('regex-preset-select');

  // Populate presets
  if (regexPresetSelect) {
    regexPresetSelect.innerHTML = '<option value="">-- Choose Regex Pattern Preset --</option>' +
      REGEX_PRESETS.map((p, idx) => `<option value="${idx}">${p.name}</option>`).join('');

    regexPresetSelect.addEventListener('change', () => {
      const idx = regexPresetSelect.value;
      if (idx !== '') {
        const p = REGEX_PRESETS[Number(idx)];
        regexPattern.value = p.pattern;
        regexFlags.value = p.flags;
        regexTestStr.value = p.sample;
        updateRegex();
        showToast(`Loaded ${p.name} pattern`);
      }
    });
  }

  function updateRegex() {
    const res = testRegex(regexPattern.value, regexFlags.value, regexTestStr.value);
    regexHighlight.innerHTML = res.highlightedHtml;
    if (regexMatchCount) regexMatchCount.textContent = `${res.matches.length} matches`;

    if (regexMatchesTable) {
      if (res.matches.length === 0) {
        regexMatchesTable.innerHTML = '<tr><td colspan="4" class="px-4 py-2 text-center text-slate-500 text-xs">No matches found</td></tr>';
      } else {
        regexMatchesTable.innerHTML = res.matches.map((m, i) => `
          <tr class="border-b border-slate-800 hover:bg-slate-800/40">
            <td class="px-3 py-1.5 font-mono text-indigo-400 text-xs">#${i + 1}</td>
            <td class="px-3 py-1.5 font-mono text-slate-200 text-xs break-all">${escapeHtml(m.value)}</td>
            <td class="px-3 py-1.5 text-slate-400 text-xs font-mono">${m.index}..${m.index + m.length}</td>
            <td class="px-3 py-1.5 text-slate-400 text-xs">${m.groups.length > 0 ? escapeHtml(JSON.stringify(m.groups)) : '-'}</td>
          </tr>
        `).join('');
      }
    }
  }

  regexPattern.addEventListener('input', updateRegex);
  regexFlags.addEventListener('input', updateRegex);
  regexTestStr.addEventListener('input', updateRegex);

  // Case Converter
  const caseInput = document.getElementById('case-input');
  function updateCases() {
    const res = convertCases(caseInput.value);
    ['camelCase', 'pascalCase', 'snakeCase', 'constantCase', 'kebabCase', 'titleCase'].forEach(k => {
      const el = document.getElementById(`case-${k}`);
      if (el) el.value = res[k] || '';
    });
  }
  caseInput.addEventListener('input', updateCases);

  // Initial run
  diffOrig.value = `const API_KEY = "dev_sandbox";\nconsole.log("Starting server");`;
  diffMod.value = `const API_KEY = process.env.API_KEY || "dev_sandbox";\nconsole.log("Starting secure server v2");\nconsole.log("DID: did:key:z6MkgVJ4NDcTqg5zrYahDYpBsrskw48AxbvM5NqstqroLoud");`;
  updateDiff();

  regexPattern.value = REGEX_PRESETS[0].pattern;
  regexFlags.value = REGEX_PRESETS[0].flags;
  regexTestStr.value = REGEX_PRESETS[0].sample;
  updateRegex();

  caseInput.value = 'devforge developer workbench';
  updateCases();
}

// ---------------- 7. Cron & Epoch Module ----------------
function initCronModule() {
  const cronInput = document.getElementById('cron-input');
  const cronExpl = document.getElementById('cron-explanation');
  const cronDates = document.getElementById('cron-next-dates');

  function updateCron() {
    const res = explainCron(cronInput.value);
    if (cronExpl) cronExpl.textContent = res.explanation;
    if (cronDates) {
      if (res.nextDates.length === 0) {
        cronDates.innerHTML = '<li class="text-slate-500 text-xs">No upcoming dates calculated</li>';
      } else {
        cronDates.innerHTML = res.nextDates.map(d => `
          <li class="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-800/40 border border-slate-800">
            <span class="text-slate-300 font-mono">${d.formatted}</span>
            <span class="text-indigo-400 font-mono">${d.iso}</span>
          </li>
        `).join('');
      }
    }
  }

  cronInput.addEventListener('input', updateCron);
  document.querySelectorAll('.cron-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cronInput.value = btn.dataset.cron;
      updateCron();
      showToast(`Applied preset: ${btn.dataset.cron}`);
    });
  });

  // Epoch
  const epochInput = document.getElementById('epoch-input');
  const epochSec = document.getElementById('epoch-sec');
  const epochMs = document.getElementById('epoch-ms');
  const epochIso = document.getElementById('epoch-iso');
  const epochUtc = document.getElementById('epoch-utc');
  const epochLocal = document.getElementById('epoch-local');
  const epochRelative = document.getElementById('epoch-relative');
  const epochNowBtn = document.getElementById('epoch-now-btn');
  const liveClockSec = document.getElementById('live-epoch-clock');

  function updateEpoch() {
    try {
      const res = convertTimestamp(epochInput.value);
      epochSec.value = res.epochSeconds;
      epochMs.value = res.epochMilliseconds;
      epochIso.value = res.iso8601;
      epochUtc.value = res.utcString;
      epochLocal.value = res.localString;
      epochRelative.textContent = res.relative;
    } catch {
      epochRelative.textContent = 'Invalid timestamp';
    }
  }

  epochInput.addEventListener('input', updateEpoch);
  epochNowBtn.addEventListener('click', () => {
    epochInput.value = Math.floor(Date.now() / 1000);
    updateEpoch();
    showToast('Reset to current timestamp');
  });

  setInterval(() => {
    if (liveClockSec) {
      liveClockSec.textContent = Math.floor(Date.now() / 1000);
    }
  }, 1000);

  cronInput.value = '*/15 * * * *';
  updateCron();
  epochInput.value = Math.floor(Date.now() / 1000);
  updateEpoch();
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
