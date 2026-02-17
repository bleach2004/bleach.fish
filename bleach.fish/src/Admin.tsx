import { FormEvent, useEffect, useMemo, useState } from 'react'

interface GithubUser {
  login: string
  avatar_url: string
  html_url: string
  name?: string
}

const SESSION_KEY = 'bleachfish_admin_session'

function formatPostId(dateValue: string) {
  const [year, month, day] = dateValue.split('-')
  if (!year || !month || !day) {
    return ''
  }

  return `${year.slice(-2)}${month}${day}`
}

function Admin() {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<GithubUser | null>(null)
  const [authError, setAuthError] = useState<string>('')
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false)

  const [title, setTitle] = useState('New page title')
  const [publishDate, setPublishDate] = useState(new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState('Start writing your one-pager content here...')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const postId = useMemo(() => formatPostId(publishDate), [publishDate])

  const rawClientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined
  const clientId = rawClientId?.trim()
  const rawExchangeUrl = import.meta.env.VITE_GITHUB_OAUTH_EXCHANGE_URL as string | undefined
  const exchangeUrl = rawExchangeUrl?.trim()
  const rawCommitUrl = import.meta.env.VITE_CMS_COMMIT_URL as string | undefined
  const commitUrl = useMemo(() => {
    if (rawCommitUrl?.trim()) {
      return rawCommitUrl.trim()
    }

    if (!exchangeUrl) {
      return undefined
    }

    try {
      return new URL('/api/cms/commit', exchangeUrl).toString()
    } catch {
      return undefined
    }
  }, [exchangeUrl, rawCommitUrl])
  const redirectUri = useMemo(() => `${window.location.origin}/admin`, [])

  useEffect(() => {
    const persisted = localStorage.getItem(SESSION_KEY)
    if (persisted) {
      setToken(persisted)
    }
  }, [])

  useEffect(() => {
    const initializeAuth = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const error = params.get('error')

      if (error) {
        setAuthError('GitHub denied access. Please try again.')
        return
      }

      if (!code) {
        return
      }

      if (!exchangeUrl) {
        setAuthError('Missing VITE_GITHUB_OAUTH_EXCHANGE_URL. Configure it to complete login.')
        return
      }

      setIsAuthorizing(true)
      try {
        const response = await fetch(exchangeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri }),
        })

        if (!response.ok) {
          throw new Error(`Token exchange failed (${response.status})`)
        }

        const data = await response.json()
        if (!data?.access_token) {
          throw new Error('No access token returned by exchange endpoint.')
        }

        localStorage.setItem(SESSION_KEY, data.access_token)
        setToken(data.access_token)

        window.history.replaceState({}, '', '/admin')
      } catch (err) {
        const message = (err as Error).message
        if (message.toLowerCase().includes('failed to fetch')) {
          setAuthError(
            'Could not reach OAuth exchange endpoint. This is usually a Worker CORS issue: ensure Access-Control-Allow-Origin includes your site origin.',
          )
        } else {
          setAuthError(message)
        }
      } finally {
        setIsAuthorizing(false)
      }
    }

    void initializeAuth()
  }, [exchangeUrl, redirectUri])

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setUser(null)
        return
      }

      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        })

        if (!response.ok) {
          throw new Error('Unable to fetch GitHub profile. Please sign in again.')
        }

        const data = await response.json()
        setUser(data)
      } catch (err) {
        localStorage.removeItem(SESSION_KEY)
        setToken(null)
        setAuthError((err as Error).message)
      }
    }

    void fetchUser()
  }, [token])

  const handleLogin = () => {
    if (!clientId) {
      setAuthError('Missing VITE_GITHUB_CLIENT_ID in your environment.')
      return
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
    })

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`
  }

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY)
    setToken(null)
    setUser(null)
  }

  const handlePublish = async (event: FormEvent) => {
    event.preventDefault()
    setSaveMessage('')

    if (!commitUrl) {
      setSaveMessage('Missing commit endpoint. Set VITE_CMS_COMMIT_URL or provide /api/cms/commit on your worker.')
      return
    }

    if (!postId) {
      setSaveMessage('Invalid post date. Please select a valid date.')
      return
    }

    const markdown = `---\nid: "${postId}"\ndate: "${publishDate}"\nimage: ""\n---\n\n${content.trim()}\n`

    setIsSaving(true)
    try {
      const response = await fetch(commitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `src/posts/${postId}.md`,
          content: markdown,
          message: `Add post ${postId}: ${title}`,
          id: postId,
          date: publishDate,
          title,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `Commit failed (${response.status})`)
      }

      setSaveMessage(`Published src/posts/${postId}.md to the repo.`)
    } catch (err) {
      setSaveMessage((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 text-white">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wider text-neutral-400">bleach.fish</p>
          <h1 className="text-3xl font-bold">Admin CMS</h1>
        </div>
        {user ? (
          <button className="rounded border border-neutral-500 px-4 py-2" onClick={handleLogout}>
            Log out
          </button>
        ) : null}
      </header>

      {authError ? <p className="mb-6 rounded border border-red-500 px-4 py-3 text-red-300">{authError}</p> : null}

      {!user ? (
        <section className="rounded border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="mb-2 text-xl font-semibold">Log in with GitHub</h2>
          <p className="mb-6 text-neutral-300">
            Use your GitHub account to unlock the one-page CMS editor at <code>/admin</code>.
          </p>
          <button
            onClick={handleLogin}
            disabled={isAuthorizing}
            className="rounded bg-white px-4 py-2 font-semibold text-black disabled:opacity-50"
          >
            {isAuthorizing ? 'Authorizing…' : 'Continue with GitHub'}
          </button>
          <p className="mt-4 text-sm text-neutral-400">
            Required env vars: <code>VITE_GITHUB_CLIENT_ID</code>, <code>VITE_GITHUB_OAUTH_EXCHANGE_URL</code>, and{' '}
            <code>VITE_CMS_COMMIT_URL</code> (or a worker <code>/api/cms/commit</code> endpoint).
          </p>
        </section>
      ) : (
        <section className="space-y-5 rounded border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex items-center gap-3">
            <img src={user.avatar_url} alt={user.login} className="h-10 w-10 rounded-full" />
            <div>
              <p className="font-semibold">{user.name ?? user.login}</p>
              <a className="text-sm text-blue-300" href={user.html_url} target="_blank" rel="noreferrer">
                @{user.login}
              </a>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-neutral-300">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-neutral-300">Date</span>
              <input
                type="date"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
              />
            </label>

            <p className="text-sm text-neutral-400">
              File name is automatic: <code>{postId || 'YYMMDD'}.md</code>
            </p>

            <label className="block">
              <span className="mb-1 block text-sm text-neutral-300">Content</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
              />
            </label>

            <button
              className="rounded bg-emerald-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Publishing…' : 'Publish to repo'}
            </button>

            {saveMessage ? <p className="text-sm text-neutral-300">{saveMessage}</p> : null}
          </form>
        </section>
      )}
    </main>
  )
}

export default Admin
