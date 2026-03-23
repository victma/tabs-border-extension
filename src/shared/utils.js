// Shared utilities — loaded by background, content, and popup contexts.

function matchesPattern(pattern, host) {
  if (!pattern.includes("*")) return pattern === host;
  const regex = new RegExp(
    "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]*") + "$"
  );
  return regex.test(host);
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
