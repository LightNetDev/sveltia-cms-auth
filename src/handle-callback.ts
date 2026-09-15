import type { Env } from './index';
import { outputHTML, supportedProviders } from './handle-auth';

interface TokenResponse {
  access_token?: string;
  error?: string;
}

export const handleCallback = async (request: Request, env: Env): Promise<Response> => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const [, provider, csrfToken] =
    request.headers.get('Cookie')?.match(/\bcsrf-token=([a-z-]+?)_([0-9a-f]{32})\b/) ?? [];

  if (!provider || !supportedProviders.includes(provider as (typeof supportedProviders)[number])) {
    return outputHTML({
      env,
      error: 'Your Git backend is not supported by the authenticator.',
      errorCode: 'UNSUPPORTED_BACKEND',
    });
  }

  if (!code || !state) {
    return outputHTML({
      env,
      provider,
      error: 'Failed to receive an authorization code. Please try again later.',
      errorCode: 'AUTH_CODE_REQUEST_FAILED',
    });
  }

  if (!csrfToken || state !== csrfToken) {
    return outputHTML({
      env,
      provider,
      error: 'Potential CSRF attack detected. Authentication flow aborted.',
      errorCode: 'CSRF_DETECTED',
    });
  }

  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_HOSTNAME = 'github.com' } = env;
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return outputHTML({
      env,
      provider,
      error: 'OAuth app client ID or secret is not configured.',
      errorCode: 'MISCONFIGURED_CLIENT',
    });
  }

  let response: Response | undefined;
  try {
    response = await fetch(`https://${GITHUB_HOSTNAME}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
      }),
    });
  } catch {
    // The authorization server was unreachable.
  }

  if (!response) {
    return outputHTML({
      env,
      provider,
      error: 'Failed to request an access token. Please try again later.',
      errorCode: 'TOKEN_REQUEST_FAILED',
    });
  }

  let token = '';
  let error = '';
  try {
    ({ access_token: token = '', error = '' } = (await response.json()) as TokenResponse);
  } catch {
    return outputHTML({
      env,
      provider,
      error: 'Server responded with malformed data. Please try again later.',
      errorCode: 'MALFORMED_RESPONSE',
    });
  }

  return outputHTML({ env, provider, token, error });
};
