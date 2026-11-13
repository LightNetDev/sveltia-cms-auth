import {
  handleAuth,
  handleCallback,
  handleRefresh,
} from "@lightnet/sveltia-github-auth";

const worker = {
  /** Route OAuth authorization, callback, and token refresh requests. */
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (
      request.method === "GET" &&
      ["/auth", "/oauth/authorize"].includes(pathname)
    ) {
      return handleAuth(request, env);
    }

    if (
      request.method === "GET" &&
      ["/callback", "/oauth/redirect"].includes(pathname)
    ) {
      return handleCallback(request, env);
    }

    // Sveltia CMS refreshes expiring GitHub App tokens through the worker.
    if (
      ["POST", "OPTIONS"].includes(request.method) &&
      ["/auth", "/oauth/access_token"].includes(pathname)
    ) {
      return handleRefresh(request, env);
    }

    return new Response("", { status: 404 });
  },
};

export default worker;
