import { routeRequest } from "@lightnet/sveltia-github-auth";

const worker = {
  /** Route OAuth authorization, callback, and token refresh requests. */
  async fetch(request, env) {
    return (
      (await routeRequest(request, env)) ?? new Response("", { status: 404 })
    );
  },
};

export default worker;
