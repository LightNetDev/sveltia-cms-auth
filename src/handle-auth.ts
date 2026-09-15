import type { Env } from './index';

export const supportedProviders = ['github'] as const;

type Provider = (typeof supportedProviders)[number];

const providerScopes: Record<Provider, { default: string; separator: string; allowed: string[] }> = {
  github: {
    default: 'repo,user',
    separator: ',',
    allowed: ['repo', 'public_repo', 'user', 'read:user', 'user:email'],
  },
};

const getScope = (provider: Provider, requested?: string) => {
  const { default: fallback, separator, allowed } = providerScopes[provider];
  const scopes = (requested ?? '').split(/[\s,]+/).filter(Boolean);

  if (!scopes.length) return fallback;
  if (scopes.every((scope) => allowed.includes(scope))) return scopes.join(separator);

  console.warn(
    `Ignoring the unsupported "${requested}" scope for ${provider}; requesting "${fallback}".`,
  );
  return fallback;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getDomainPatterns = (allowedDomains?: string) =>
  (allowedDomains ?? '')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean)
    .map((domain) => `^${escapeRegExp(domain).replaceAll('\\*', '.+')}$`);

const serialize = (value: string | boolean | string[] | null | undefined) =>
  JSON.stringify(value ?? null).replaceAll('<', '\\u003c');

interface HtmlOptions {
  provider?: string;
  token?: string;
  error?: string;
  errorCode?: string;
  env?: Env;
}

export const outputHTML = ({
  provider = 'unknown',
  token,
  error,
  errorCode,
  env = {},
}: HtmlOptions): Response => {
  const state = error ? 'error' : 'success';
  const content = error ? { provider, error, errorCode } : { provider, token };

  return new Response(
    `<!doctype html><html><body><script>
      (() => {
        const trustedPatterns = ${serialize(getDomainPatterns(env.ALLOWED_DOMAINS))};
        const hasToken = ${serialize(Boolean(token))};
        const isTrusted = (origin) => {
          try {
            const { hostname } = new URL(origin);
            return trustedPatterns.some((pattern) => new RegExp(pattern).test(hostname));
          } catch {
            return false;
          }
        };
        window.addEventListener('message', ({ data, origin }) => {
          if (data !== 'authorizing:${provider}') return;
          if (hasToken && trustedPatterns.length && !isTrusted(origin)) return;
          window.opener?.postMessage(
            'authorization:${provider}:${state}:${JSON.stringify(content)}', origin,
          );
        });
        window.opener?.postMessage('authorizing:${provider}', '*');
      })();
    </script></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Set-Cookie': 'csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure',
      },
    },
  );
};

export const handleAuth = async (request: Request, env: Env): Promise<Response> => {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const domain = searchParams.get('site_id');
  const requestedScope = searchParams.get('scope') ?? undefined;

  if (!provider || !supportedProviders.includes(provider as Provider)) {
    return outputHTML({
      env,
      error: 'Your Git backend is not supported by the authenticator.',
      errorCode: 'UNSUPPORTED_BACKEND',
    });
  }

  const githubProvider = provider as Provider;
  const domainPatterns = getDomainPatterns(env.ALLOWED_DOMAINS);
  if (domainPatterns.length && !domainPatterns.some((pattern) => new RegExp(pattern).test(domain ?? ''))) {
    return outputHTML({
      env,
      provider: githubProvider,
      error: 'Your domain is not allowed to use the authenticator.',
      errorCode: 'UNSUPPORTED_DOMAIN',
    });
  }

  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_HOSTNAME = 'github.com' } = env;
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return outputHTML({
      env,
      provider: githubProvider,
      error: 'OAuth app client ID or secret is not configured.',
      errorCode: 'MISCONFIGURED_CLIENT',
    });
  }

  const csrfToken = crypto.randomUUID().replaceAll('-', '');
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: getScope(githubProvider, requestedScope),
    state: csrfToken,
  });

  return new Response('', {
    status: 302,
    headers: {
      Location: `https://${GITHUB_HOSTNAME}/login/oauth/authorize?${params.toString()}`,
      'Set-Cookie': `csrf-token=${githubProvider}_${csrfToken}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
    },
  });
};
