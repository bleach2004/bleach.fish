import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import fm from 'front-matter'

interface GithubUser {
  login: string
  avatar_url: string
  html_url: string
  name?: string
}

interface ExistingPost {
  id: string
  date: string
  fileName: string
  raw: string
}

function parseAllowedUsers(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

const postModules = import.meta.glob('./posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const SESSION_KEY = 'bleachfish_admin_session'

function formatPostId(dateValue: string) {
  const [year, month, day] = dateValue.split('-')
  if (!year || !month || !day) {
    return ''
  }

  return `${year.slice(-2)}${month}${day}`
}

function getPostIdForDate(dateValue: string, posts: ExistingPost[]) {
  const baseId = formatPostId(dateValue)
  if (!baseId) {
    return ''
  }

  const sameDayCount = posts.reduce((count, post) => {
    if (post.date !== dateValue) {
      return count
    }

    return post.id.startsWith(baseId) ? count + 1 : count
  }, 0)

  if (sameDayCount === 0) {
    return baseId
  }

  return `${baseId}[${sameDayCount + 1}]`
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
        return
      }

      reject(new Error('Unable to read file.'))
    }
    reader.onerror = () => reject(new Error('Unable to read file.'))
    reader.readAsDataURL(file)
  })
}

function Admin() {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<GithubUser | null>(null)
  const [authError, setAuthError] = useState<string>('')
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false)

  const [publishDate] = useState(new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState('Start writing your one-pager content here...')
  const [imageValue, setImageValue] = useState('')
  const [audioValue, setAudioValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'publish' | 'manage'>('publish')
  const [editFileName, setEditFileName] = useState('')
  const [editContent, setEditContent] = useState('')
  const [manageMessage, setManageMessage] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const initialPosts = useMemo<ExistingPost[]>(() => {
    return Object.entries(postModules)
      .map(([path, raw]) => {
        const parsed = fm<{ id?: string; date?: string }>(raw)
        const fileId = path.split('/').pop()?.replace('.md', '') ?? ''
        return {
          id: parsed.attributes.id || fileId,
          date: parsed.attributes.date || '',
          fileName: `${fileId}.md`,
          raw,
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [])
  const [existingPosts, setExistingPosts] = useState<ExistingPost[]>(initialPosts)
  const postId = useMemo(() => getPostIdForDate(publishDate, existingPosts), [existingPosts, publishDate])

  const rawClientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined
  const clientId = rawClientId?.trim()
  const rawExchangeUrl = import.meta.env.VITE_GITHUB_OAUTH_EXCHANGE_URL as string | undefined
  const exchangeUrl = rawExchangeUrl?.trim()
  const rawCommitUrl = import.meta.env.VITE_CMS_COMMIT_URL as string | undefined
  const rawPostsBasePath = import.meta.env.VITE_CMS_POSTS_BASE_PATH as string | undefined
  const rawAllowedUsers = import.meta.env.VITE_CMS_ALLOWED_GITHUB_USERS as string | undefined
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
  const postBasePaths = useMemo(() => {
    const preferredPath = 'src/posts'
    const configuredPath = rawPostsBasePath?.trim().replace(/\/+$/, '')

    if (configuredPath) {
      if (configuredPath === preferredPath) {
        return [preferredPath]
      }

      return [configuredPath, preferredPath]
    }

    return [preferredPath]
  }, [rawPostsBasePath])
  const allowedGitHubUsers = useMemo(() => parseAllowedUsers(rawAllowedUsers), [rawAllowedUsers])
  const isEditorAllowed = useMemo(() => {
    if (!user) {
      return false
    }

    if (allowedGitHubUsers.length === 0) {
      return true
    }

    return allowedGitHubUsers.includes(user.login.toLowerCase())
  }, [allowedGitHubUsers, user])
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

        if (allowedGitHubUsers.length > 0) {
          const userResponse = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${data.access_token}`,
              Accept: 'application/vnd.github+json',
            },
          })

          if (!userResponse.ok) {
            throw new Error('Unable to validate GitHub profile. Please sign in again.')
          }

          const signedInUser = (await userResponse.json()) as GithubUser
          if (!allowedGitHubUsers.includes(signedInUser.login.toLowerCase())) {
            throw new Error('This GitHub account is not allowed for admin access.')
          }
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
  }, [allowedGitHubUsers, exchangeUrl, redirectUri])

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

  const requireAuthorizedEditor = () => {
    if (!token) {
      const message = 'Missing GitHub session token. Please log out and sign in again.'
      setSaveMessage(message)
      setManageMessage(message)
      return false
    }

    if (!isEditorAllowed) {
      const message = 'This GitHub account is not allowed to publish changes from this CMS.'
      setSaveMessage(message)
      setManageMessage(message)
      return false
    }

    return true
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const dataUrl = await fileToDataUrl(file)
      setImageValue(dataUrl)
      setSaveMessage(`Attached image: ${file.name}`)
    } catch (err) {
      setSaveMessage((err as Error).message)
    }
  }

  const handleAudioUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const dataUrl = await fileToDataUrl(file)
      setAudioValue(dataUrl)
      setSaveMessage(`Attached audio: ${file.name}`)
    } catch (err) {
      setSaveMessage((err as Error).message)
    }
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

    if (!requireAuthorizedEditor()) {
      return
    }

    const markdown = `---\nid: "${postId}"\ndate: "${publishDate}"\nimage: ${JSON.stringify(imageValue)}\naudio: ${JSON.stringify(audioValue)}\n---\n\n${content.trim()}\n`

    setIsSaving(true)
    try {
      let publishedPath = ''
      let lastError = ''

      for (const basePath of postBasePaths) {
        const path = `${basePath}/${postId}.md`
        const response = await fetch(commitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            path,
            content: markdown,
            message: `Add post ${postId}`,
            id: postId,
            date: publishDate,
          }),
        })

        if (response.ok) {
          publishedPath = path
          break
        }

        if (response.status === 404) {
          throw new Error(
            'Commit endpoint not found. Deploy /api/cms/commit on your Worker or set VITE_CMS_COMMIT_URL to the correct endpoint.',
          )
        }

        const errorText = await response.text()
        lastError = errorText || `Commit failed (${response.status})`
      }

      if (!publishedPath) {
        throw new Error(lastError || 'Publish failed for all post path options.')
      }

      setExistingPosts((prev) =>
        [
          {
            id: postId,
            date: publishDate,
            fileName: `${postId}.md`,
            raw: markdown,
          },
          ...prev,
        ].sort((a, b) => (a.date < b.date ? 1 : -1)),
      )

      setSaveMessage(`Published ${publishedPath} to the repo.`)
    } catch (err) {
      setSaveMessage((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartEdit = (post: ExistingPost) => {
    setActiveTab('manage')
    setEditFileName(post.fileName)
    setEditContent(post.raw)
    setManageMessage('')
  }

  const handleUpdatePost = async (event: FormEvent) => {
    event.preventDefault()
    setManageMessage('')

    if (!editFileName) {
      setManageMessage('Select a post to edit first.')
      return
    }

    if (!commitUrl) {
      setManageMessage('Missing commit endpoint. Set VITE_CMS_COMMIT_URL or provide /api/cms/commit on your worker.')
      return
    }

    if (!requireAuthorizedEditor()) {
      return
    }

    setIsUpdating(true)
    try {
      let updatedPath = ''
      let lastError = ''

      for (const basePath of postBasePaths) {
        const repoPath = `${basePath}/${editFileName}`
        const response = await fetch(commitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            path: repoPath,
            content: editContent,
            message: `Edit post ${editFileName}`,
          }),
        })

        if (response.ok) {
          updatedPath = repoPath
          break
        }

        if (response.status === 404) {
          throw new Error(
            'Commit endpoint not found. Deploy /api/cms/commit on your Worker or set VITE_CMS_COMMIT_URL to the correct endpoint.',
          )
        }
        const errorText = await response.text()
        lastError = errorText || `Update failed (${response.status})`
      }

      if (!updatedPath) {
        throw new Error(lastError || 'Update failed for all post path options.')
      }

      const parsed = fm<{ id?: string; date?: string }>(editContent)
      const fallbackId = editFileName.replace('.md', '')
      setExistingPosts((prev) =>
        prev
          .map((post) =>
            post.fileName === editFileName
              ? {
                  ...post,
                  raw: editContent,
                  id: parsed.attributes.id || fallbackId,
                  date: parsed.attributes.date || post.date,
                }
              : post,
          )
          .sort((a, b) => (a.date < b.date ? 1 : -1)),
      )

      setManageMessage(`Updated ${updatedPath} in the repo.`)
    } catch (err) {
      setManageMessage((err as Error).message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeletePost = async (post: ExistingPost) => {
    if (!window.confirm(`Delete ${post.fileName}?`)) {
      return
    }

    if (!commitUrl) {
      setManageMessage('Missing commit endpoint. Set VITE_CMS_COMMIT_URL or provide /api/cms/commit on your worker.')
      return
    }

    if (!requireAuthorizedEditor()) {
      return
    }

    setManageMessage('')
    setIsDeleting(true)
    try {
      let deletedPath = ''
      let lastError = ''

      for (const basePath of postBasePaths) {
        const repoPath = `${basePath}/${post.fileName}`
        const response = await fetch(commitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            path: repoPath,
            content: '',
            delete: true,
            message: `Delete post ${post.fileName.replace('.md', '')}`,
          }),
        })

        if (response.ok) {
          deletedPath = repoPath
          break
        }

        if (response.status === 404) {
          throw new Error(
            'Commit endpoint not found. Deploy /api/cms/commit on your Worker or set VITE_CMS_COMMIT_URL to the correct endpoint.',
          )
        }
        const errorText = await response.text()
        lastError = errorText || `Delete failed (${response.status})`
      }

      if (!deletedPath) {
        throw new Error(lastError || 'Delete failed for all post path options.')
      }

      setExistingPosts((prev) => prev.filter((item) => item.fileName !== post.fileName))
      setManageMessage(`Deleted ${deletedPath} in the repo.`)
      if (editFileName === post.fileName) {
        setEditFileName('')
        setEditContent('')
      }
    } catch (err) {
      setManageMessage((err as Error).message)
    } finally {
      setIsDeleting(false)
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
        <button
          type="button"
          onClick={handleLogin}
          disabled={isAuthorizing}
          className="cursor-pointer bg-transparent p-0 text-white underline disabled:opacity-50"
          style={{ fontFamily: 'Times New Roman, Times, serif' }}
        >
          log in
        </button>
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

          {!isEditorAllowed ? (
            <p className="rounded border border-red-500 px-3 py-2 text-sm text-red-300">
              This account is signed in but not allowed to publish. Ask the site owner to add your username to{' '}
              <code>VITE_CMS_ALLOWED_GITHUB_USERS</code> (frontend) and <code>ALLOWED_GITHUB_USERS</code> (Worker).
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              className={`rounded px-3 py-2 text-sm ${activeTab === 'publish' ? 'bg-white text-black' : 'border border-neutral-600 text-neutral-300'}`}
              onClick={() => setActiveTab('publish')}
              type="button"
            >
              Publish
            </button>
            <button
              className={`rounded px-3 py-2 text-sm ${activeTab === 'manage' ? 'bg-white text-black' : 'border border-neutral-600 text-neutral-300'}`}
              onClick={() => setActiveTab('manage')}
              type="button"
            >
              Manage posts
            </button>
          </div>

          {activeTab === 'publish' ? (
            <form onSubmit={handlePublish} className="space-y-4">
              <p className="text-sm text-neutral-400">
                <code>{postId || 'YYMMDD'}.md</code>
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

              <label className="block">
                <span className="mb-1 block text-sm text-neutral-300">Image upload (optional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
                />
                {imageValue ? <span className="mt-1 block text-xs text-neutral-400">Image attached.</span> : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-neutral-300">Audio upload (optional)</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
                />
                {audioValue ? <span className="mt-1 block text-xs text-neutral-400">Audio attached.</span> : null}
              </label>

              <button
                className="rounded bg-emerald-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
                type="submit"
                disabled={isSaving || !isEditorAllowed}
              >
                {isSaving ? 'Publishing…' : 'Publish to repo'}
              </button>

              {saveMessage ? <p className="text-sm text-neutral-300">{saveMessage}</p> : null}
            </form>
          ) : (
            <div className="space-y-4">
              <ul className="space-y-2">
                {existingPosts.map((post) => (
                  <li key={post.fileName} className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-700 px-3 py-2">
                    <div>
                      <p className="font-mono text-sm">{post.fileName}</p>
                      {post.date ? <p className="text-xs text-neutral-400">{post.date}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(post)}
                        className="rounded border border-neutral-600 px-3 py-1 text-sm disabled:opacity-50"
                        disabled={!isEditorAllowed}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeletePost(post)}
                        disabled={isDeleting || !isEditorAllowed}
                        className="rounded border border-red-500 px-3 py-1 text-sm text-red-300 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleUpdatePost} className="space-y-3">
                <p className="text-sm text-neutral-400">{editFileName ? `Editing ${editFileName}` : 'Select a post to edit.'}</p>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={14}
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm"
                  placeholder="Choose a post above to edit its raw markdown."
                />

                <button
                  className="rounded bg-blue-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
                  type="submit"
                  disabled={isUpdating || !editFileName || !isEditorAllowed}
                >
                  {isUpdating ? 'Saving…' : 'Save .md changes'}
                </button>

                {manageMessage ? <p className="text-sm text-neutral-300">{manageMessage}</p> : null}
              </form>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default Admin
