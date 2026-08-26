/**
 * DevForge - Text, Diff, Regex & Cron Module
 * Line diffs, regex tester with capture breakdown, case converters, cron predictor, and epoch time tools.
 */

// ---------------- Diff Engine (LCS Based) ----------------
export function computeLineDiff(originalText, modifiedText) {
  const origLines = originalText.split(/\r?\n/);
  const modLines = modifiedText.split(/\r?\n/);

  const n = origLines.length;
  const m = modLines.length;

  // LCS Matrix
  const matrix = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  // Backtrack diff
  let i = n, j = m;
  const rawDiff = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      rawDiff.unshift({ type: 'unchanged', text: origLines[i - 1], origLine: i, modLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      rawDiff.unshift({ type: 'added', text: modLines[j - 1], origLine: null, modLine: j });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      rawDiff.unshift({ type: 'removed', text: origLines[i - 1], origLine: i, modLine: null });
      i--;
    }
  }

  const additions = rawDiff.filter(d => d.type === 'added').length;
  const deletions = rawDiff.filter(d => d.type === 'removed').length;
  const unchanged = rawDiff.filter(d => d.type === 'unchanged').length;

  return {
    diff: rawDiff,
    stats: { additions, deletions, unchanged, total: rawDiff.length },
  };
}

// ---------------- Regex Tester & Presets ----------------
export const REGEX_PRESETS = [
  { name: 'Email Address', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', flags: 'gm', sample: 'test.user@example.com\ninvalid-email@\nadmin@sub.domain.org' },
  { name: 'URL (HTTP/HTTPS)', pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)', flags: 'gm', sample: 'Visit https://github.com/Lineazk or http://localhost:3000/api/v1?id=42' },
  { name: 'IPv4 Address', pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b', flags: 'g', sample: 'Server IP: 192.168.1.1, DNS: 8.8.8.8, Invalid: 999.12.34.56' },
  { name: 'ISO 8601 Date', pattern: '\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})?)?', flags: 'g', sample: 'Created at 2026-08-26T11:20:00Z and modified 2026-08-26' },
  { name: 'UUID (v4/v7)', pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}', flags: 'g', sample: 'User ID: 01918a56-7890-7abc-9def-1234567890ab\nToken ID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
  { name: 'Hex Color Code', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'g', sample: 'Primary: #3B82F6, Accent: #10B981, Dark: #1E293B, Short: #FFF' },
  { name: 'Semantic Versioning', pattern: 'v?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?', flags: 'g', sample: 'Current version: v2.1.0-beta.1+build.2026 and 1.0.0' },
  { name: 'JWT Token', pattern: 'eyJ[A-Za-z0-9-_]+\\.eyJ[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+', flags: 'g', sample: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' },
];

export function testRegex(patternStr, flagsStr, testString) {
  if (!patternStr) return { matches: [], highlightedHtml: testString, error: null };

  try {
    const flags = flagsStr.replace(/[^gimsuy]/g, '');
    const regex = new RegExp(patternStr, flags);

    const matches = [];
    let match;

    if (flags.includes('g')) {
      while ((match = regex.exec(testString)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          value: match[0],
          groups: match.slice(1),
        });
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
    } else {
      match = regex.exec(testString);
      if (match) {
        matches.push({
          index: match.index,
          length: match[0].length,
          value: match[0],
          groups: match.slice(1),
        });
      }
    }

    // Build highlighted string
    let html = '';
    let lastIdx = 0;
    matches.forEach((m, idx) => {
      html += escapeHtml(testString.slice(lastIdx, m.index));
      html += `<mark class="bg-indigo-500/30 text-indigo-300 px-1 py-0.5 rounded border border-indigo-500/50 font-mono font-medium" title="Match #${idx + 1}">${escapeHtml(m.value)}</mark>`;
      lastIdx = m.index + m.length;
    });
    html += escapeHtml(testString.slice(lastIdx));

    return { matches, highlightedHtml: html, error: null };
  } catch (err) {
    return { matches: [], highlightedHtml: escapeHtml(testString), error: err.message };
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------- Case Converters ----------------
export function convertCases(text) {
  if (!text) return {};

  const words = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ')
    .trim()
    .split(/\s+/);

  if (words.length === 0 || words[0] === '') return {};

  const lowerWords = words.map(w => w.toLowerCase());
  const upperWords = words.map(w => w.toUpperCase());
  const capitalizedWords = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return {
    camelCase: lowerWords[0] + capitalizedWords.slice(1).join(''),
    pascalCase: capitalizedWords.join(''),
    snakeCase: lowerWords.join('_'),
    constantCase: upperWords.join('_'),
    kebabCase: lowerWords.join('-'),
    titleCase: capitalizedWords.join(' '),
    sentenceCase: text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
    dotCase: lowerWords.join('.'),
    pathCase: lowerWords.join('/'),
  };
}

// ---------------- Cron Expression Explainer & Predictor ----------------
export function explainCron(cronStr) {
  if (!cronStr) return { explanation: 'Please enter a cron expression.', nextDates: [] };

  const parts = cronStr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { explanation: 'Standard cron requires exactly 5 fields: minute, hour, day-of-month, month, day-of-week.', nextDates: [] };
  }

  const [min, hour, dom, mon, dow] = parts;

  function describeField(val, name, map = null) {
    if (val === '*') return `every ${name}`;
    if (val.startsWith('*/')) return `every ${val.slice(2)} ${name}s`;
    if (val.includes(',')) {
      const items = val.split(',').map(v => (map && map[v] ? map[v] : v));
      return `at ${name}s ${items.join(', ')}`;
    }
    if (val.includes('-')) {
      const [start, end] = val.split('-');
      return `from ${map && map[start] ? map[start] : start} through ${map && map[end] ? map[end] : end}`;
    }
    return `at ${name} ${map && map[val] ? map[val] : val}`;
  }

  const daysOfWeek = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun' };
  const months = { '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr', '5': 'May', '6': 'Jun', '7': 'Jul', '8': 'Aug', '9': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' };

  let expl = `Runs `;
  if (min === '*' && hour === '*') expl += `every minute`;
  else if (min.startsWith('*/') && hour === '*') expl += `every ${min.slice(2)} minutes`;
  else expl += `${describeField(min, 'minute')}, ${describeField(hour, 'hour')}`;

  if (dom !== '*') expl += `, on ${describeField(dom, 'day-of-month')}`;
  if (mon !== '*') expl += `, in ${describeField(mon, 'month', months)}`;
  if (dow !== '*') expl += `, on ${describeField(dow, 'day-of-week', daysOfWeek)}`;

  // Calculate next 5 occurrences (search up to 60 days ahead)
  const nextDates = [];
  try {
    let current = new Date();
    current.setSeconds(0, 0);

    const maxAttempts = 60 * 24 * 60; // 60 days in minutes
    for (let attempts = 0; attempts < maxAttempts && nextDates.length < 5; attempts++) {
      current = new Date(current.getTime() + 60000); // add 1 minute

      const m = current.getMinutes();
      const h = current.getHours();
      const d = current.getDate();
      const mo = current.getMonth() + 1;
      const dw = current.getDay();

      if (!matchesCronField(min, m, 0, 59)) continue;
      if (!matchesCronField(hour, h, 0, 23)) continue;
      if (!matchesCronField(dom, d, 1, 31)) continue;
      if (!matchesCronField(mon, mo, 1, 12)) continue;
      if (!matchesCronField(dow, dw, 0, 7)) continue;

      nextDates.push({
        formatted: current.toLocaleString(),
        iso: current.toISOString(),
        timestamp: Math.floor(current.getTime() / 1000),
      });
    }
  } catch {
    // ignore
  }

  return {
    explanation: expl.charAt(0).toUpperCase() + expl.slice(1) + '.',
    nextDates,
  };
}

function matchesCronField(cronField, val, minVal, maxVal) {
  if (cronField === '*') return true;
  if (cronField.startsWith('*/')) {
    const step = parseInt(cronField.slice(2), 10);
    return step > 0 && val % step === 0;
  }
  if (cronField.includes(',')) {
    return cronField.split(',').some(v => matchesCronField(v.trim(), val, minVal, maxVal));
  }
  if (cronField.includes('-')) {
    const [start, end] = cronField.split('-').map(v => parseInt(v, 10));
    return val >= start && val <= end;
  }
  const target = parseInt(cronField, 10);
  if (cronField === '7' && minVal === 0 && maxVal === 7) return val === 0 || val === 7;
  return val === target;
}

// ---------------- Epoch Timestamp Converter ----------------
export function convertTimestamp(input) {
  let date;
  if (!input) {
    date = new Date();
  } else if (!isNaN(Number(input))) {
    const num = Number(input);
    date = num > 1e11 ? new Date(num) : new Date(num * 1000);
  } else {
    date = new Date(input);
  }

  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp or date format.');
  }

  const now = Date.now();
  const diffSec = Math.floor((date.getTime() - now) / 1000);
  let relative = '';
  if (Math.abs(diffSec) < 60) {
    relative = 'just now';
  } else if (diffSec > 0) {
    const mins = Math.floor(diffSec / 60);
    const hours = Math.floor(diffSec / 3600);
    const days = Math.floor(diffSec / 86400);
    if (days > 0) relative = `in ${days} day${days > 1 ? 's' : ''}`;
    else if (hours > 0) relative = `in ${hours} hour${hours > 1 ? 's' : ''}`;
    else relative = `in ${mins} minute${mins > 1 ? 's' : ''}`;
  } else {
    const absSec = Math.abs(diffSec);
    const mins = Math.floor(absSec / 60);
    const hours = Math.floor(absSec / 3600);
    const days = Math.floor(absSec / 86400);
    if (days > 0) relative = `${days} day${days > 1 ? 's' : ''} ago`;
    else if (hours > 0) relative = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    else relative = `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }

  return {
    epochSeconds: Math.floor(date.getTime() / 1000),
    epochMilliseconds: date.getTime(),
    utcString: date.toUTCString(),
    iso8601: date.toISOString(),
    localString: date.toLocaleString(),
    relative,
  };
}
