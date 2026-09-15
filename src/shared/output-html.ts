import { getDomainPatterns, hasConfiguredAllowedDomains } from './allowed-domains';
import type { Env } from './env';

const serialize = (value: unknown) =>
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
  const authorizationMessage = `authorization:${provider}:${state}:${JSON.stringify(content)}`;

  return new Response(
    `<!doctype html><html><body><script>
      (() => {
        const trustedPatterns = ${serialize(
          hasConfiguredAllowedDomains(env.ALLOWED_DOMAINS) ? getDomainPatterns(env.ALLOWED_DOMAINS) : [],
        )};
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
          if (hasToken && !isTrusted(origin)) return;
          window.opener?.postMessage(
            ${serialize(authorizationMessage)}, origin,
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
