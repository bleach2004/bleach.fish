/**
 * Cloudflare Worker: GitHub OAuth + CMS commit endpoint
 *
 * Required env vars:
 * - GITHUB_CLIENT_ID
 * - GITHUB_CLIENT_SECRET
 * - FRONTEND_ORIGIN              (exact origin, e.g. https://bleach.fish)
 * - GITHUB_REPO_OWNER            (e.g. bleach2004)
 * - GITHUB_REPO_NAME             (e.g. bleach.fish)
 * - GITHUB_REPO_BRANCH           (e.g. main)
 * - GITHUB_REPO_TOKEN            (PAT with Contents: Read & Write)
 *
 * Optional env vars:
 * - ALLOWED_GITHUB_USERS         (CSV allowlist; defaults to bleach2004)
 * - ALLOWED_POSTS_BASE_PATH      (defaults to site/src/posts)
 * - ALLOWED_SONGS_BASE_PATH      (defaults to site/src/music)
 * - ALLOWED_ART_BASE_PATH        (defaults to site/public/art)
 * - MAX_CONTENT_BYTES            (defaults to 200000)
 */

const DEFAULT_ALLOWED_USER = 'bleach2004'
const DEFAULT_POSTS_BASE_PATH = 'site/src/posts'
const DEFAULT_SONGS_BASE_PATH = 'site/src/music'
const DEFAULT_ART_BASE_PATH = 'site/public/art'
const DEFAULT_MAX_CONTENT_BYTES = 200000

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  }
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  }
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...securityHeaders(), ...headers },
  })
}

async function githubRequest(url, init = {}, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'bleach-fish-worker',
    ...(init.headers || {}),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(url, { ...init, headers })
}

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

function normalizeAllowedUsers(envValue) {
  const fromEnv = (envValue || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (fromEnv.length > 0) return new Set(fromEnv)
  return new Set([DEFAULT_ALLOWED_USER])
}

function normalizePath(path) {
  if (typeof path !== 'string') return null
  const trimmed = path.trim().replace(/^\/+/, '')
  if (!trimmed) return null
  if (trimmed.includes('..')) return null
  return trimmed
}

function isAllowedMarkdownPath(path, allowedBasePath) {
  const normalizedBase = allowedBasePath.replace(/^\/+/, '').replace(/\/+$/, '')
  return path.startsWith(`${normalizedBase}/`) && path.endsWith('.md')
}

function isAllowedArtPath(path, allowedBasePath) {
  const normalizedBase = allowedBasePath.replace(/^\/+/, '').replace(/\/+$/, '')
  return (
    path.startsWith(`${normalizedBase}/`) &&
    /\.(png|jpe?g|webp|gif|avif)$/i.test(path)
  )
}

async function getUserFromAccessToken(accessToken) {
  const resp = await githubRequest('https://api.github.com/user', {}, accessToken)
  if (!resp.ok) return null
  return resp.json()
}

function contentApiUrl(owner, repo, path, branch) {
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
}

function contentApiWriteUrl(owner, repo, path) {
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = env.FRONTEND_ORIGIN || 'https://bleach.fish'
    const c = corsHeaders(origin)

    // Strict origin check for browser traffic.
    const reqOrigin = request.headers.get('Origin')
    if (request.method !== 'GET' && reqOrigin && reqOrigin !== origin) {
      return json({ error: 'Origin not allowed' }, 403, c)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...c, ...securityHeaders() } })
    }

    if (url.pathname === '/api/github/exchange' && request.method === 'POST') {
      try {
        const body = await request.json()
        const code = body?.code
        const redirectUri = body?.redirectUri

        if (!code || !redirectUri) {
          return json({ error: 'Missing code or redirectUri' }, 400, c)
        }

        const redirectOrigin = new URL(redirectUri).origin
        if (redirectOrigin !== origin) {
          return json({ error: 'Invalid redirectUri origin' }, 403, c)
        }

        const ghResp = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'bleach-fish-worker',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
          }),
        })

        const ghData = await ghResp.json()

        if (!ghResp.ok || ghData.error || !ghData.access_token) {
          return json({ error: 'OAuth exchange failed' }, 401, c)
        }

        // Critical backend allowlist enforcement: reject unauthorized users
        // before returning any access token to the frontend.
        const oauthUser = await getUserFromAccessToken(ghData.access_token)
        const oauthLogin = String(oauthUser?.login || '').toLowerCase()
        if (!oauthLogin) {
          return json({ error: 'Invalid GitHub access token' }, 401, c)
        }

        const allowedUsers = normalizeAllowedUsers(env.ALLOWED_GITHUB_USERS)
        if (!allowedUsers.has(oauthLogin)) {
          return json({ error: 'User not allowed' }, 403, c)
        }

        return json({ access_token: ghData.access_token }, 200, c)
      } catch {
        return json({ error: 'Bad request' }, 400, c)
      }
    }

    if (url.pathname === '/api/cms/commit' && request.method === 'POST') {
      try {
        const body = await request.json()
        const normalizedPath = normalizePath(body?.path)
        const isDelete = body?.delete === true || body?.delete === 'true'
        const content = body?.content
        const contentBase64 = body?.contentBase64
        const rawMessage = typeof body?.message === 'string' ? body.message : isDelete ? 'Delete post' : 'Add post'
        const message = rawMessage.trim().slice(0, 120)

        if (!normalizedPath) {
          return json({ error: 'Invalid path' }, 400, c)
        }

        const allowedPostsBasePath = (env.ALLOWED_POSTS_BASE_PATH || DEFAULT_POSTS_BASE_PATH).trim()
        const allowedSongsBasePath = (env.ALLOWED_SONGS_BASE_PATH || DEFAULT_SONGS_BASE_PATH).trim()
        const allowedArtBasePath = (env.ALLOWED_ART_BASE_PATH || DEFAULT_ART_BASE_PATH).trim()

        const pathAllowed =
          isAllowedMarkdownPath(normalizedPath, allowedPostsBasePath) ||
          isAllowedMarkdownPath(normalizedPath, allowedSongsBasePath) ||
          isAllowedArtPath(normalizedPath, allowedArtBasePath)

        if (!pathAllowed) {
          return json(
            {
              error: `Path not allowed. Only ${allowedPostsBasePath}/*.md, ${allowedSongsBasePath}/*.md, or ${allowedArtBasePath}/*.{png,jpg,jpeg,webp,gif,avif} is permitted.`,
            },
            403,
            c,
          )
        }

        if (!isDelete && typeof content !== 'string' && typeof contentBase64 !== 'string') {
          return json({ error: 'Missing content or contentBase64' }, 400, c)
        }

        if (!isDelete) {
          const maxBytes = Number(env.MAX_CONTENT_BYTES || DEFAULT_MAX_CONTENT_BYTES)
          let contentBytes = 0

          if (typeof contentBase64 === 'string') {
            const compactBase64 = contentBase64.replace(/\s+/g, '')
            try {
              contentBytes = atob(compactBase64).length
            } catch {
              return json({ error: 'Invalid contentBase64' }, 400, c)
            }
          } else {
            contentBytes = new TextEncoder().encode(content).length
          }

          if (contentBytes > maxBytes) {
            return json({ error: `Content too large (>${maxBytes} bytes)` }, 413, c)
          }
        }

        const auth = request.headers.get('Authorization') || ''
        const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : null

        if (!accessToken) {
          return json({ error: 'Missing Authorization Bearer token' }, 401, c)
        }

        const user = await getUserFromAccessToken(accessToken)
        const login = String(user?.login || '').toLowerCase()
        if (!login) {
          return json({ error: 'Invalid GitHub access token' }, 401, c)
        }

        const allowedUsers = normalizeAllowedUsers(env.ALLOWED_GITHUB_USERS)
        if (!allowedUsers.has(login)) {
          return json({ error: 'User not allowed' }, 403, c)
        }

        const owner = env.GITHUB_REPO_OWNER
        const repo = env.GITHUB_REPO_NAME
        const branch = env.GITHUB_REPO_BRANCH || 'main'
        const repoToken = env.GITHUB_REPO_TOKEN

        if (!owner || !repo || !repoToken) {
          return json({ error: 'Worker repo env vars are missing' }, 500, c)
        }

        const getUrl = contentApiUrl(owner, repo, normalizedPath, branch)
        const currentResp = await githubRequest(getUrl, {}, repoToken)

        let existingSha = null
        if (currentResp.status === 200) {
          const current = await currentResp.json()
          existingSha = current.sha
        } else if (currentResp.status !== 404) {
          return json({ error: 'Failed to check existing file' }, 502, c)
        }

        if (isDelete) {
          if (!existingSha) {
            return json({ ok: true, path: normalizedPath, alreadyMissing: true, commitSha: null }, 200, c)
          }

          const deleteUrl = contentApiWriteUrl(owner, repo, normalizedPath)
          const deleteResp = await githubRequest(
            deleteUrl,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message,
                sha: existingSha,
                branch,
              }),
            },
            repoToken,
          )

          const deleteData = await deleteResp.json().catch(() => ({}))
          if (!deleteResp.ok) {
            return json({ error: 'GitHub delete failed' }, 502, c)
          }

          return json({ ok: true, deletedBy: user.login, path: normalizedPath, commitSha: deleteData?.commit?.sha || null }, 200, c)
        }

        const putUrl = contentApiWriteUrl(owner, repo, normalizedPath)
        const encodedContent = typeof contentBase64 === 'string' ? contentBase64.replace(/\s+/g, '') : toBase64(content)
        const putBody = {
          message,
          content: encodedContent,
          branch,
          ...(existingSha ? { sha: existingSha } : {}),
        }

        const putResp = await githubRequest(
          putUrl,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(putBody),
          },
          repoToken,
        )

        const putData = await putResp.json().catch(() => ({}))
        if (!putResp.ok) {
          return json({ error: 'GitHub commit failed' }, 502, c)
        }

        return json({ ok: true, committedBy: user.login, path: normalizedPath, commitSha: putData?.commit?.sha || null }, 200, c)
      } catch {
        return json({ error: 'Bad request' }, 400, c)
      }
    }

    return new Response('Not found', { status: 404, headers: { ...c, ...securityHeaders() } })
  },
}
