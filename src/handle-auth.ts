import { getDomainPatterns, hasConfiguredAllowedDomains } from './shared/allowed-domains';
import type { Env } from './shared/env';
import { outputHTML } from './shared/output-html';
import { z } from 'zod';

type Provider = 'github';

const providerScopes: Record<Provider, { default: string; separator: string; allowed: string[] }> = {
  github: {
    default: 'repo,user',
    separator: ',',
    allowed: ['repo', 'public_repo', 'user', 'read:user', 'user:email'],
  },
};

const authQuerySchema = z.object({
  provider: z.literal('github').optional(),
  siteId: z.string().trim().min(1).max(253).optional(),
  scope: z.string().max(256).optional(),
});

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

export const handleAuth = async (request: Request, env: Env): Promise<Response> => {
  const { searchParams } = new URL(request.url);
  const query = authQuerySchema.safeParse({
    provider: searchParams.get('provider') ?? undefined,
    siteId: searchParams.get('site_id') ?? undefined,
    scope: searchParams.get('scope') ?? undefined,
  });

  if (!query.success || !query.data.provider) {
    return outputHTML({
      env,
      error: 'Your Git backend is not supported by the authenticator.',
      errorCode: 'UNSUPPORTED_BACKEND',
    });
  }

  const githubProvider = query.data.provider;
  if (!hasConfiguredAllowedDomains(env.ALLOWED_DOMAINS)) {
    return outputHTML({
      env,
      provider: githubProvider,
      error: 'Allowed domains are not configured. Set ALLOWED_DOMAINS to your site hostname.',
      errorCode: 'MISCONFIGURED_DOMAINS',
    });
  }

  const domainPatterns = getDomainPatterns(env.ALLOWED_DOMAINS);
  if (!domainPatterns.some((pattern) => new RegExp(pattern).test(query.data.siteId ?? ''))) {
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
    scope: getScope(githubProvider, query.data.scope),
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
