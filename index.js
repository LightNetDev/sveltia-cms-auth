import { handleAuth, handleCallback } from "@lightnet/sveltia-github-auth";

const worker = {
  /** Route OAuth authorization requests. */
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

    return new Response("", { status: 404 });
  },
};

export default worker;
