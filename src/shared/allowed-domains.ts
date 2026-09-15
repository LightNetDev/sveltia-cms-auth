const exampleAllowedDomain = 'www.example.com';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getDomainPatterns = (allowedDomains?: string) =>
  (allowedDomains ?? '')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean)
    .map((domain) => `^${escapeRegExp(domain).replaceAll('\\*', '.+')}$`);

/**
 * The domain allow-list is required before this worker may start or complete
 * an OAuth flow. The value in wrangler.json is only a deployment example.
 */
export const hasConfiguredAllowedDomains = (allowedDomains?: string) => {
  const domains = (allowedDomains ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  return domains.length > 0 && !(domains.length === 1 && domains[0] === exampleAllowedDomain);
};
