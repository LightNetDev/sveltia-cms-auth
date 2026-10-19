# Sveltia CMS Authenticator

This simple [Cloudflare Workers](https://workers.cloudflare.com/) script allows [Sveltia CMS](https://sveltiacms.app/en/) users to authenticate with [GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

OAuth handlers are provided by [`@lightnet/sveltia-github-auth`](https://www.npmjs.com/package/@lightnet/sveltia-github-auth). This project supplies the Worker routing and deployment configuration.

## How to use it

### Step 1. Deploy this project to Cloudflare Workers

Sign up with Cloudflare, and click the button below to start deploying.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lightnetdev/sveltia-cms-auth)

Alternatively, you can clone the project and run [`wrangler deploy`](https://developers.cloudflare.com/workers/wrangler/commands/#deploy) locally.

Once deployed, open your Cloudflare Workers dashboard, select the `sveltia-cms-auth` service, then the worker URL (`https://sveltia-cms-auth.<SUBDOMAIN>.workers.dev`) will be displayed. Copy it for Steps 2–4.

### Step 2. Register the Worker as an OAuth app

[Register a new OAuth application](https://github.com/settings/applications/new) on GitHub ([details](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)) with the following properties, including your Worker URL from Step 1:

- Application name: `LightNet Authenticator` (or whatever)
- Homepage URL: `https://github.com/lightnetdev/sveltia-cms-auth` (or whatever)
- Application description: (can be left empty)
- Authorization callback URL: `<YOUR_WORKER_URL>/callback`

Once registered, click on the **Generate a new client secret** button. The app’s **Client ID** and **Client Secret** will be displayed. We’ll use them in Step 3 below.

### Step 3. Configure the Worker

Replace the placeholder values in `wrangler.jsonc` with your configuration:

- `GITHUB_CLIENT_ID`: **Client ID** from Step 2
- `WORKER_ORIGIN`: **Required.** The canonical HTTPS origin of this Worker, e.g. `https://sveltia-cms-auth.<SUBDOMAIN>.workers.dev`. It must not contain a path, query string, fragment, or credentials. The Worker derives its fixed GitHub callback URL as `${WORKER_ORIGIN}/callback` and sends it during both OAuth requests.
- `ALLOWED_ORIGINS`: **Required.** Explicit HTTPS origins permitted to receive authentication responses, e.g. `https://www.example.com`. Replace the example value in `wrangler.jsonc`
  - Multiple origins can be defined as a comma-separated list, e.g. `https://www.example.com, https://admin.example.org`
  - Origins must be canonical HTTPS origins without a path, query string, fragment, credentials, or wildcard. Include non-default ports explicitly, e.g. `https://admin.example.com:8443`.
  - Each allowed subdomain must be listed explicitly. Wildcards are not supported.
  - The list stops other sites from using your Worker and ensures the authenticator releases authorization results only to an exactly matched origin.

In the Cloudflare Worker Dashboard under **Settings** > **Variables and Secrets** set.

- `GITHUB_CLIENT_SECRET`: Client Secret from Step 2; click the Encrypt button to hide it

### Step 4. Update your CMS configuration

Open `astro.config.mjs` locally or remotely, and add your Worker URL from Step 1 as the new `base_url` property in lightnet-sveltia-cms under `backend`:

```diff
backend: {
  name: "github",
  repo: "username/repo",
+  baseUrl: <YOUR_WORKER_URL>,
}
```

Commit the change. Once deployed, you can sign into Sveltia CMS remotely with GitHub!

## Acknowledgements

This project was inspired by [`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth).
