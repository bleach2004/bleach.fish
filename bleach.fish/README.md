# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```

## Admin login (GitHub OAuth)

`/admin` now includes a GitHub login gate and a one-page CMS editor shell.

Set these env vars in `.env`:

```bash
VITE_GITHUB_CLIENT_ID=your_github_oauth_app_client_id
VITE_GITHUB_OAUTH_EXCHANGE_URL=https://your-backend.example.com/api/github/exchange
```

Why an exchange URL is required: GitHub OAuth code exchange needs a client secret, so the browser app posts `code` + `redirectUri` to your backend endpoint, which then securely calls GitHub's token endpoint and returns `{ "access_token": "..." }`.

### Worker CORS requirement (common OAuth callback issue)

If GitHub login succeeds but `/api/github/exchange` fails in the browser with:

- `CORS header 'Access-Control-Allow-Origin' missing`
- `CORS request did not succeed`

then your Worker must return CORS headers on both `OPTIONS` and `POST` for the exchange endpoint.

Use your site origin (example: `https://bleach.fish`) and ensure these headers are set:

```txt
Access-Control-Allow-Origin: https://bleach.fish
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Vary: Origin
```

Your Worker should also respond to preflight:

```ts
if (request.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```


### CMS upload endpoint

The admin form now publishes directly to your repo (no draft step).

- Filename is generated from the selected date in `YYMMDD` format to match existing post IDs (example: `2025-10-15` -> `251015.md`).
- Frontend sends a `POST` to `VITE_CMS_COMMIT_URL` (or falls back to `/api/cms/commit` on the same Worker origin as `VITE_GITHUB_OAUTH_EXCHANGE_URL`).
- Publish requests include `Authorization: Bearer <github_access_token>` so the Worker can validate the signed-in GitHub user before writing to the repo.

Expected request payload:

```json
{
  "path": "src/posts/251015.md",
  "content": "---\nid: \"251015\"\ndate: \"2025-10-15\"\nimage: \"\"\n---\n\npost body\n",
  "message": "Add post 251015"
}
```


### Publish returns "Not Found"

A `Not Found` error on publish means your frontend reached the worker origin but there is no `POST /api/cms/commit` route there (or `VITE_CMS_COMMIT_URL` points to the wrong URL).

For Cloudflare, deploy a commit handler route at `/api/cms/commit` on the same worker used for OAuth exchange, or set `VITE_CMS_COMMIT_URL` to the exact commit endpoint URL.
