// Shared utilities — loaded by background, content, and popup contexts.

const DEFAULT_COLOR = "#a21c1c";

const _patternCache = new Map();
function getPatternRegex(pattern) {
  let regex = _patternCache.get(pattern);
  if (!regex) {
    regex = new RegExp(
      "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "([^.]*)") + "$"
    );
    _patternCache.set(pattern, regex);
  }
  return regex;
}

function matchesPattern(pattern, host) {
  if (!pattern.includes("*")) return pattern === host;
  return getPatternRegex(pattern).test(host);
}

function isWhitelisted(whitelist, hostname) {
  return whitelist.some((p) => matchesPattern(p, hostname));
}

function findMatchingPattern(whitelist, hostname) {
  return whitelist.find((p) => p.includes("*") && matchesPattern(p, hostname));
}

function findDefaultsKey(whitelist, hostname) {
  if (whitelist.includes(hostname)) return hostname;
  return findMatchingPattern(whitelist, hostname) || hostname;
}

function applyTitleTemplate(title, whitelist, host) {
  if (!title || !title.includes("$")) return title;
  const pattern = findMatchingPattern(whitelist, host);
  if (!pattern) return title;
  const m = getPatternRegex(pattern).exec(host);
  if (!m) return title;
  return title.replace(/\$(\d+)/g, (_, n) => m[Number(n)] ?? "");
}

function resolveDomainDefaults(domainDefaults, hostname, whitelist) {
  const exact = domainDefaults[hostname];
  const pattern = findMatchingPattern(whitelist, hostname);
  const byPattern = pattern ? domainDefaults[pattern] : undefined;
  if (!exact && !byPattern) return undefined;
  return {
    color: exact?.color || byPattern?.color || "",
    title: exact?.title || byPattern?.title || "",
  };
}
