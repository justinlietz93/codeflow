// Exclude-pattern support for the card action. Ports the browser app's
// pattern helpers (index.html: normalizeExcludePath / parseExcludePatterns /
// globToRegex / matchesExcludePattern) so `exclude:` input patterns behave
// exactly like the web UI's custom excludes: `vendor/**`, `**/cache/**`,
// `*.min.js`, or a bare name that matches any path segment.
//
// Ported rather than extracted because these helpers live OUTSIDE the
// CODEFLOW_ANALYZER_START/END block that analyzer.js slices out of
// index.html. Keep semantics in sync with the app if they ever change.

'use strict';

function normalizeExcludePath(value) {
  return (value || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
}

function parseExcludePatterns(input) {
  const seen = new Set();
  return (input || '')
    .split(/\r?\n|,/)
    .map((item) => normalizeExcludePath(item.trim()).replace(/\/$/, ''))
    .filter((item) => {
      if (!item || seen.has(item.toLowerCase())) return false;
      seen.add(item.toLowerCase());
      return true;
    });
}

function escapeRegexChar(ch) {
  return /[|\\{}()[\]^$+?.]/.test(ch) ? '\\' + ch : ch;
}

function globToRegex(pattern) {
  const normalized = normalizeExcludePath(pattern).toLowerCase();
  let out = '^';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        if (normalized[i + 2] === '/') {
          out += '(?:[^/]+/)*';
          i += 2;
        } else {
          out += '.*';
          i++;
        }
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += escapeRegexChar(ch);
    }
  }
  out += '$';
  return new RegExp(out, 'i');
}

function compileExcludePatterns(input) {
  return parseExcludePatterns(input).map((pattern) => {
    const lower = pattern.toLowerCase();
    const hasGlob = pattern.includes('*') || pattern.includes('?');
    const hasPath = pattern.includes('/');
    return {
      raw: pattern,
      lower,
      regex: hasGlob || hasPath ? globToRegex(pattern) : null,
    };
  });
}

function matchesExcludePattern(compiledPatterns, path, name) {
  if (!compiledPatterns || !compiledPatterns.length) return false;
  const normalizedPath = normalizeExcludePath(path || name).replace(/\/$/, '');
  const lowerPath = normalizedPath.toLowerCase();
  const lowerName = (name || normalizedPath.split('/').pop() || '').toLowerCase();
  const lowerPathWithSlash = lowerPath ? lowerPath + '/' : '';
  const segments = lowerPath.split('/').filter(Boolean);
  return compiledPatterns.some((pattern) => {
    if (!pattern.regex) {
      return lowerName === pattern.lower || segments.includes(pattern.lower);
    }
    return (
      pattern.regex.test(lowerPath) ||
      pattern.regex.test(lowerPathWithSlash) ||
      pattern.regex.test(lowerName)
    );
  });
}

module.exports = { compileExcludePatterns, matchesExcludePattern, parseExcludePatterns };
