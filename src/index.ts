import type { ExportedHandler } from '@cloudflare/workers-types';

import { handleAuth } from './handle-auth';
import { handleCallback } from './handle-callback';

export interface Env {
  ALLOWED_DOMAINS?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_HOSTNAME?: string;
}

const worker: ExportedHandler<Env> = {
  /** Route OAuth authorization requests. */
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === 'GET' && ['/auth', '/oauth/authorize'].includes(pathname)) {
      return handleAuth(request, env);
    }

    if (request.method === 'GET' && ['/callback', '/oauth/redirect'].includes(pathname)) {
      return handleCallback(request, env);
    }

    return new Response('', { status: 404 });
  },
};

export default worker;
