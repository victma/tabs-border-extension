// Shared utilities — loaded by background, content, and popup contexts.

const DEFAULT_COLOR = "#a21c1c";

const _patternCache = new Map();
function matchesPattern(pattern, host) {
  if (!pattern.includes("*")) return pattern === host;
  let regex = _patternCache.get(pattern);
  if (!regex) {
    regex = new RegExp(
      "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]*") + "$"
    );
    _patternCache.set(pattern, regex);
  }
  return regex.test(host);
}

function isWhitelisted(whitelist, hostname) {
  return whitelist.some((p) => matchesPattern(p, hostname));
}

function findMatchingPattern(whitelist, hostname) {
  return whitelist.find((p) => p.includes("*") && matchesPattern(p, hostname));
}

function resolveDomainDefaults(domainDefaults, hostname, whitelist) {
  const exact = domainDefaults[hostname];
  if (exact?.color && exact?.title) return exact;
  const pattern = findMatchingPattern(whitelist, hostname);
  const byPattern = pattern ? domainDefaults[pattern] : undefined;
  if (!exact && !byPattern) return undefined;
  return {
    color: exact?.color || byPattern?.color || "",
    title: exact?.title || byPattern?.title || "",
  };
}
