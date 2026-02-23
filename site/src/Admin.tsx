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

interface ExistingSong {
  id: string
  title: string
  artist: string
  coverArt: string
  releaseDate: string
  spotify: string
  bandcamp: string
  soundcloud: string
  lyrics: string
  fileName: string
}

function parseAllowedUsers(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function parseBooleanFlag(value: string | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return null
}

const postModules = import.meta.glob('./posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const songModules = import.meta.glob('./music/*.md', {
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


function getPostSequence(postId: string, dateValue: string) {
  const baseId = formatPostId(dateValue)
  if (!baseId || !postId.startsWith(baseId)) {
    return 0
  }

  const match = postId.match(/\[(\d+)\]$/)
  if (!match) {
    return 1
  }

  const sequence = Number.parseInt(match[1], 10)
  return Number.isNaN(sequence) ? 1 : sequence
}

function comparePostsByDateAndSequence(a: ExistingPost, b: ExistingPost) {
  if (a.date !== b.date) {
    return a.date < b.date ? 1 : -1
  }

  const aSequence = getPostSequence(a.id, a.date)
  const bSequence = getPostSequence(b.id, b.date)

  return bSequence - aSequence
}

function compareSongsById(a: ExistingSong, b: ExistingSong) {
  if (a.id === b.id) {
    return 0
  }

  return a.id < b.id ? 1 : -1
}

function toSongId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type SongFrontMatter = {
  id?: string
  title?: string
  artist?: string
  coverArt?: string
  releaseDate?: string
  spotify?: string
  bandcamp?: string
  soundcloud?: string
  lyrics?: string
}

const normalizeSongField = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

function parseArtFileName(value: string | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('data:')) {
    return null
  }

  let pathname = trimmed
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname
    } catch {
      pathname = trimmed
    }
  }

  const withoutQuery = pathname.split(/[?#]/)[0]
  if (withoutQuery.startsWith('art/')) {
    const fileName = withoutQuery.slice(4)
    return fileName && !fileName.includes('/') ? fileName : null
  }

  const markerIndex = withoutQuery.lastIndexOf('/art/')
  if (markerIndex === -1) {
    return null
  }

  const fileName = withoutQuery.slice(markerIndex + 5)
  if (!fileName || fileName.includes('/')) {
    return null
  }

  return fileName
}

function parsePostImageFileName(raw: string) {
  const parsed = fm<{ image?: string }>(raw)
  return parseArtFileName(parsed.attributes.image)
}

function parseSongFromRaw(fileName: string, raw: string): ExistingSong {
  const parsed = fm<SongFrontMatter>(raw)
  const fallbackId = fileName.replace('.md', '')
  const body = typeof parsed.body === 'string' ? parsed.body : ''

  return {
    id: normalizeSongField(parsed.attributes.id) || fallbackId,
    title: normalizeSongField(parsed.attributes.title),
    artist: normalizeSongField(parsed.attributes.artist),
    coverArt: normalizeSongField(parsed.attributes.coverArt),
    releaseDate: normalizeSongField(parsed.attributes.releaseDate),
    spotify: normalizeSongField(parsed.attributes.spotify),
    bandcamp: normalizeSongField(parsed.attributes.bandcamp),
    soundcloud: normalizeSongField(parsed.attributes.soundcloud),
    lyrics: normalizeSongField(parsed.attributes.lyrics) || body.trim(),
    fileName,
  }
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

function dataUrlToBase64(dataUrl: string) {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid file encoding.')
  }

  return match[1]
}

function getFileExtension(name: string) {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/)
  return match ? match[1] : ''
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
  const [activeTab, setActiveTab] = useState<'publish' | 'manage' | 'songs'>('publish')
  const [editFileName, setEditFileName] = useState('')
  const [editContent, setEditContent] = useState('')
  const [manageMessage, setManageMessage] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [songIdValue, setSongIdValue] = useState('')
  const [songTitleValue, setSongTitleValue] = useState('')
  const [songArtistValue, setSongArtistValue] = useState('')
  const [songCoverArtDataUrl, setSongCoverArtDataUrl] = useState('')
  const [songCoverArtFileName, setSongCoverArtFileName] = useState('')
  const [songCoverArtValue, setSongCoverArtValue] = useState('')
  const [songReleaseDateValue, setSongReleaseDateValue] = useState('')
  const [songSpotifyValue, setSongSpotifyValue] = useState('')
  const [songBandcampValue, setSongBandcampValue] = useState('')
  const [songSoundcloudValue, setSongSoundcloudValue] = useState('')
  const [songLyricsValue, setSongLyricsValue] = useState('')
  const [songSaveMessage, setSongSaveMessage] = useState('')
  const [isSongSaving, setIsSongSaving] = useState(false)
  const [songEditFileName, setSongEditFileName] = useState('')
  const [songManageMessage, setSongManageMessage] = useState('')
  const [isSongDeleting, setIsSongDeleting] = useState(false)

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
      .sort(comparePostsByDateAndSequence)
  }, [])
  const [existingPosts, setExistingPosts] = useState<ExistingPost[]>(initialPosts)
  const postId = useMemo(() => getPostIdForDate(publishDate, existingPosts), [existingPosts, publishDate])
  const initialSongs = useMemo<ExistingSong[]>(() => {
    return Object.entries(songModules)
      .map(([path, raw]) => {
        const fileId = path.split('/').pop()?.replace('.md', '') ?? ''
        return parseSongFromRaw(`${fileId}.md`, raw)
      })
      .sort(compareSongsById)
  }, [])
  const [existingSongs, setExistingSongs] = useState<ExistingSong[]>(initialSongs)
  const generatedSongId = useMemo(() => toSongId(songIdValue || songTitleValue), [songIdValue, songTitleValue])
  const isSongEditing = Boolean(songEditFileName)

  const rawClientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined
  const clientId = rawClientId?.trim()
  const rawExchangeUrl = import.meta.env.VITE_GITHUB_OAUTH_EXCHANGE_URL as string | undefined
  const exchangeUrl = rawExchangeUrl?.trim()
  const rawCommitUrl = import.meta.env.VITE_CMS_COMMIT_URL as string | undefined
  const rawPostsBasePath = import.meta.env.VITE_CMS_POSTS_BASE_PATH as string | undefined
  const rawSongsBasePath = import.meta.env.VITE_CMS_SONGS_BASE_PATH as string | undefined
  const rawArtBasePath = import.meta.env.VITE_CMS_ART_BASE_PATH as string | undefined
  const rawAllowedUsers = import.meta.env.VITE_CMS_ALLOWED_GITHUB_USERS as string | undefined
  const rawPreviewMode = import.meta.env.VITE_ADMIN_PREVIEW as string | undefined
  const isPreviewMode = useMemo(() => {
    const parsed = parseBooleanFlag(rawPreviewMode)
    return parsed ?? import.meta.env.DEV
  }, [rawPreviewMode])
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
    const preferredPath = 'site/src/posts'
    const configuredPath = rawPostsBasePath?.trim().replace(/\/+$/, '')

    if (configuredPath) {
      if (configuredPath === preferredPath) {
        return [preferredPath, 'src/posts']
      }

      return [configuredPath, preferredPath, 'src/posts']
    }

    return [preferredPath, 'src/posts']
  }, [rawPostsBasePath])
  const songBasePaths = useMemo(() => {
    const preferredPath = 'site/src/music'
    const configuredPath = rawSongsBasePath?.trim().replace(/\/+$/, '')

    if (configuredPath) {
      if (configuredPath === preferredPath) {
        return [preferredPath, 'src/music']
      }

      return [configuredPath, preferredPath, 'src/music']
    }

    return [preferredPath, 'src/music']
  }, [rawSongsBasePath])
  const artBasePaths = useMemo(() => {
    const preferredPath = 'site/public/art'
    const configuredPath = rawArtBasePath?.trim().replace(/\/+$/, '')

    if (configuredPath) {
      if (configuredPath === preferredPath) {
        return [preferredPath, 'public/art']
      }

      return [configuredPath, preferredPath, 'public/art']
    }

    return [preferredPath, 'public/art']
  }, [rawArtBasePath])
  const allowedGitHubUsers = useMemo(() => parseAllowedUsers(rawAllowedUsers), [rawAllowedUsers])
  const isEditorAllowed = useMemo(() => {
    if (isPreviewMode) {
      return true
    }

    if (!user) {
      return false
    }

    if (allowedGitHubUsers.length === 0) {
      return true
    }

    return allowedGitHubUsers.includes(user.login.toLowerCase())
  }, [allowedGitHubUsers, isPreviewMode, user])
  const redirectUri = useMemo(() => `${window.location.origin}/admin`, [])

  useEffect(() => {
    if (isPreviewMode) {
      setAuthError('')
      setToken('preview')
      setUser({
        login: 'local-preview',
        avatar_url:
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="%23262626"/><text x="50%" y="54%" font-size="28" text-anchor="middle" fill="%23ffffff" font-family="Arial">LP</text></svg>',
        html_url: 'https://github.com',
        name: 'Local Preview',
      })
      return
    }

    const persisted = localStorage.getItem(SESSION_KEY)
    if (persisted) {
      setToken(persisted)
    }
  }, [isPreviewMode])

  useEffect(() => {
    if (isPreviewMode) {
      return
    }

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
  }, [allowedGitHubUsers, exchangeUrl, isPreviewMode, redirectUri])

  useEffect(() => {
    if (isPreviewMode) {
      return
    }

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
  }, [isPreviewMode, token])

  const handleLogin = () => {
    if (isPreviewMode) {
      setAuthError('Preview mode is enabled. Disable it to use GitHub login.')
      return
    }

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
    if (isPreviewMode) {
      return
    }

    localStorage.removeItem(SESSION_KEY)
    setToken(null)
    setUser(null)
  }

  const requireAuthorizedEditor = () => {
    if (isPreviewMode) {
      return true
    }

    if (!token) {
      const message = 'Missing GitHub session token. Please log out and sign in again.'
      setSaveMessage(message)
      setManageMessage(message)
      setSongSaveMessage(message)
      setSongManageMessage(message)
      return false
    }

    if (!isEditorAllowed) {
      const message = 'This GitHub account is not allowed to publish changes from this CMS.'
      setSaveMessage(message)
      setManageMessage(message)
      setSongSaveMessage(message)
      setSongManageMessage(message)
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

  const handlePreviewOnlyMessage = (setMessage: (message: string) => void) => {
    if (!isPreviewMode) {
      return false
    }

    setMessage('Preview mode: changes are not saved to GitHub.')
    return true
  }

  const deleteArtAsset = async (fileName: string) => {
    if (!commitUrl) {
      return { ok: false, error: 'Missing commit endpoint.' }
    }

    let deletedPath = ''
    let lastError = ''

    for (const basePath of artBasePaths) {
      const repoPath = `${basePath}/${fileName}`
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
          message: `Delete asset ${fileName}`,
        }),
      })

      if (response.ok) {
        deletedPath = repoPath
        break
      }

      if (response.status === 404) {
        return { ok: false, error: 'Commit endpoint not found.' }
      }

      const errorText = await response.text()
      lastError = errorText || `Delete failed (${response.status})`
    }

    if (!deletedPath) {
      return { ok: false, error: lastError || 'Delete failed for all asset path options.' }
    }

    return { ok: true, path: deletedPath }
  }

  const handlePublish = async (event: FormEvent) => {
    event.preventDefault()
    setSaveMessage('')

    if (handlePreviewOnlyMessage(setSaveMessage)) {
      return
    }

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
        ].sort(comparePostsByDateAndSequence),
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

    if (handlePreviewOnlyMessage(setManageMessage)) {
      return
    }

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

    const previousPost = existingPosts.find((post) => post.fileName === editFileName)
    const previousImageFile = previousPost ? parsePostImageFileName(previousPost.raw) : null

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
          .sort(comparePostsByDateAndSequence),
      )

      let updatedMessage = `Updated ${updatedPath} in the repo.`
      const nextImageFile = parsePostImageFileName(editContent)
      if (previousImageFile && previousImageFile !== nextImageFile) {
        const deleteResult = await deleteArtAsset(previousImageFile)
        if (deleteResult.ok) {
          updatedMessage += ` Removed old image ${previousImageFile}.`
        } else if (deleteResult.error) {
          updatedMessage += ` (Old image not removed: ${deleteResult.error})`
        }
      }

      setManageMessage(updatedMessage)
    } catch (err) {
      setManageMessage((err as Error).message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeletePost = async (post: ExistingPost) => {
    if (handlePreviewOnlyMessage(setManageMessage)) {
      return
    }

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

  const handleSongCoverArtUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const dataUrl = await fileToDataUrl(file)
      setSongCoverArtDataUrl(dataUrl)
      setSongCoverArtFileName(file.name)
      setSongSaveMessage(`Attached cover art: ${file.name}`)
    } catch (err) {
      setSongSaveMessage((err as Error).message)
    }
  }

  const resetSongDraft = () => {
    setSongIdValue('')
    setSongTitleValue('')
    setSongArtistValue('')
    setSongCoverArtDataUrl('')
    setSongCoverArtFileName('')
    setSongCoverArtValue('')
    setSongReleaseDateValue('')
    setSongSpotifyValue('')
    setSongBandcampValue('')
    setSongSoundcloudValue('')
    setSongLyricsValue('')
  }

  const handleStartSongEdit = (song: ExistingSong) => {
    setActiveTab('songs')
    setSongEditFileName(song.fileName)
    setSongIdValue(song.id)
    setSongTitleValue(song.title)
    setSongArtistValue(song.artist)
    setSongCoverArtValue(song.coverArt)
    setSongCoverArtDataUrl('')
    setSongCoverArtFileName('')
    setSongReleaseDateValue(song.releaseDate)
    setSongSpotifyValue(song.spotify)
    setSongBandcampValue(song.bandcamp)
    setSongSoundcloudValue(song.soundcloud)
    setSongLyricsValue(song.lyrics)
    setSongSaveMessage('')
    setSongManageMessage('')
  }

  const handleCancelSongEdit = () => {
    setSongEditFileName('')
    resetSongDraft()
    setSongSaveMessage('')
    setSongManageMessage('')
  }

  const handlePublishSong = async (event: FormEvent) => {
    event.preventDefault()
    setSongSaveMessage('')

    if (handlePreviewOnlyMessage(setSongSaveMessage)) {
      return
    }

    if (!commitUrl) {
      setSongSaveMessage('Missing commit endpoint. Set VITE_CMS_COMMIT_URL or provide /api/cms/commit on your worker.')
      return
    }

    if (!requireAuthorizedEditor()) {
      return
    }

    const generatedId = toSongId(songIdValue || songTitleValue)
    if (!generatedId) {
      setSongSaveMessage('Song ID or title is required.')
      return
    }

    setIsSongSaving(true)
    try {
      const previousCoverArtFile = isSongEditing ? parseArtFileName(songCoverArtValue) : null
      if (!isSongEditing && existingSongs.some((song) => song.id === generatedId)) {
        setSongSaveMessage(`A song with id "${generatedId}" already exists.`)
        return
      }

      if (isSongEditing && existingSongs.some((song) => song.fileName !== songEditFileName && song.id === generatedId)) {
        setSongSaveMessage(`A different song already uses id "${generatedId}".`)
        return
      }

      const hasNewCoverArt = Boolean(songCoverArtDataUrl && songCoverArtFileName)
      let resolvedCoverArt = songCoverArtValue.trim()

      if (hasNewCoverArt) {
        const extension = getFileExtension(songCoverArtFileName) || '.jpg'
        const artFileName = `${generatedId}${extension}`
        const artPublicUrl = `/art/${artFileName}`
        const contentBase64 = dataUrlToBase64(songCoverArtDataUrl)
        let uploadedPath = ''
        let uploadError = ''

        for (const basePath of artBasePaths) {
          const path = `${basePath}/${artFileName}`
          const response = await fetch(commitUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              path,
              contentBase64,
              message: `Add cover art ${artFileName}`,
              id: generatedId,
            }),
          })

          if (response.ok) {
            uploadedPath = path
            break
          }

          if (response.status === 404) {
            throw new Error(
              'Commit endpoint not found. Deploy /api/cms/commit on your Worker or set VITE_CMS_COMMIT_URL to the correct endpoint.',
            )
          }

          const errorText = await response.text()
          uploadError = errorText || `Cover art upload failed (${response.status})`
        }

        if (!uploadedPath) {
          throw new Error(uploadError || 'Cover art upload failed for all art path options.')
        }

        resolvedCoverArt = artPublicUrl
      }

      if (!resolvedCoverArt) {
        setSongSaveMessage('Cover art upload is required.')
        return
      }

      const markdown = `---\nid: "${generatedId}"\ntitle: ${JSON.stringify(songTitleValue.trim())}\nartist: ${JSON.stringify(songArtistValue.trim())}\ncoverArt: ${JSON.stringify(resolvedCoverArt)}\nreleaseDate: ${JSON.stringify(songReleaseDateValue.trim())}\nspotify: ${JSON.stringify(songSpotifyValue.trim())}\nbandcamp: ${JSON.stringify(songBandcampValue.trim())}\nsoundcloud: ${JSON.stringify(songSoundcloudValue.trim())}\n---\n\n${songLyricsValue.trim()}\n`

      let publishedPath = ''
      let lastError = ''
      const targetFileName = isSongEditing ? songEditFileName : `${generatedId}.md`

      for (const basePath of songBasePaths) {
        const path = `${basePath}/${targetFileName}`
        const response = await fetch(commitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            path,
            content: markdown,
            message: isSongEditing ? `Edit song ${targetFileName}` : `Add song ${generatedId}`,
            id: generatedId,
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
        throw new Error(lastError || 'Publish failed for all song path options.')
      }

      const parsedSong = parseSongFromRaw(targetFileName, markdown)
      setExistingSongs((prev) => {
        if (isSongEditing) {
          return prev.map((song) => (song.fileName === targetFileName ? parsedSong : song)).sort(compareSongsById)
        }
        return [...prev, parsedSong].sort(compareSongsById)
      })
      let successMessage = `${isSongEditing ? 'Updated' : 'Published'} ${publishedPath} to the repo.`
      const nextCoverArtFile = parseArtFileName(resolvedCoverArt)
      if (isSongEditing && hasNewCoverArt && previousCoverArtFile && previousCoverArtFile !== nextCoverArtFile) {
        const deleteResult = await deleteArtAsset(previousCoverArtFile)
        if (deleteResult.ok) {
          successMessage += ` Removed old cover art ${previousCoverArtFile}.`
        } else if (deleteResult.error) {
          successMessage += ` (Old cover art not removed: ${deleteResult.error})`
        }
      }

      setSongSaveMessage(successMessage)
      resetSongDraft()
      if (isSongEditing) {
        setSongEditFileName('')
      }
    } catch (err) {
      setSongSaveMessage((err as Error).message)
    } finally {
      setIsSongSaving(false)
    }
  }

  const handleDeleteSong = async (song: ExistingSong) => {
    if (handlePreviewOnlyMessage(setSongManageMessage)) {
      return
    }

    if (!window.confirm(`Delete ${song.fileName}?`)) {
      return
    }

    if (!commitUrl) {
      setSongManageMessage('Missing commit endpoint. Set VITE_CMS_COMMIT_URL or provide /api/cms/commit on your worker.')
      return
    }

    if (!requireAuthorizedEditor()) {
      return
    }

    setSongManageMessage('')
    setIsSongDeleting(true)
    try {
      let deletedPath = ''
      let lastError = ''

      for (const basePath of songBasePaths) {
        const repoPath = `${basePath}/${song.fileName}`
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
            message: `Delete song ${song.fileName.replace('.md', '')}`,
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
        throw new Error(lastError || 'Delete failed for all song path options.')
      }

      setExistingSongs((prev) => prev.filter((item) => item.fileName !== song.fileName))
      setSongManageMessage(`Deleted ${deletedPath} in the repo.`)
      if (songEditFileName === song.fileName) {
        setSongEditFileName('')
        resetSongDraft()
      }
    } catch (err) {
      setSongManageMessage((err as Error).message)
    } finally {
      setIsSongDeleting(false)
    }
  }

  return (
    <main className="admin-90s mx-auto min-h-screen max-w-4xl px-4 py-10 text-white">
      <header className="admin-header mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wider text-neutral-400">bleach.fish</p>
          <h1 className="text-3xl font-bold">Admin CMS</h1>
        </div>
        {user ? (
          <button className="admin-button admin-secondary rounded border border-neutral-500 px-4 py-2" onClick={handleLogout}>
            Log out
          </button>
        ) : null}
      </header>

      {authError ? (
        <p className="admin-alert admin-alert-danger mb-6 rounded border border-red-500 px-4 py-3 text-red-300">{authError}</p>
      ) : null}

      {!user ? (
        <button
          type="button"
          onClick={handleLogin}
          disabled={isAuthorizing}
          className="admin-link cursor-pointer bg-transparent p-0 text-white underline disabled:opacity-50"
          style={{ fontFamily: 'Times New Roman, Times, serif' }}
        >
          log in
        </button>
      ) : (
        <section className="admin-shell space-y-5 rounded border border-neutral-700 bg-neutral-900 p-6">
          {isPreviewMode ? (
            <p className="admin-alert admin-alert-warning rounded border border-yellow-500 px-3 py-2 text-sm text-yellow-200">
              Preview mode is enabled. Admin changes are not written to GitHub.
            </p>
          ) : null}
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
            <p className="admin-alert admin-alert-danger rounded border border-red-500 px-3 py-2 text-sm text-red-300">
              This account is signed in but not allowed to publish. Ask the site owner to add your username to{' '}
              <code>VITE_CMS_ALLOWED_GITHUB_USERS</code> (frontend) and <code>ALLOWED_GITHUB_USERS</code> (Worker).
            </p>
          ) : null}

          <div className="admin-tabs flex gap-2">
            <button
              className={`admin-tab rounded px-3 py-2 text-sm ${activeTab === 'publish' ? 'bg-white text-black' : 'border border-neutral-600 text-neutral-300'}`}
              onClick={() => setActiveTab('publish')}
              type="button"
            >
              Publish
            </button>
            <button
              className={`admin-tab rounded px-3 py-2 text-sm ${activeTab === 'manage' ? 'bg-white text-black' : 'border border-neutral-600 text-neutral-300'}`}
              onClick={() => setActiveTab('manage')}
              type="button"
            >
              Manage posts
            </button>
            <button
              className={`admin-tab rounded px-3 py-2 text-sm ${activeTab === 'songs' ? 'bg-white text-black' : 'border border-neutral-600 text-neutral-300'}`}
              onClick={() => setActiveTab('songs')}
              type="button"
            >
              Songs
            </button>
          </div>

          {activeTab === 'publish' ? (
            <form onSubmit={handlePublish} className="admin-panel space-y-4">
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
                  className="admin-file w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
                />
                {imageValue ? <span className="mt-1 block text-xs text-neutral-400">Image attached.</span> : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-neutral-300">Audio upload (optional)</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="admin-file w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
                />
                {audioValue ? <span className="mt-1 block text-xs text-neutral-400">Audio attached.</span> : null}
              </label>

              <button
                className="admin-button admin-primary rounded bg-emerald-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
                type="submit"
                disabled={isSaving || !isEditorAllowed}
              >
                {isSaving ? 'Publishing…' : 'Publish to repo'}
              </button>

              {saveMessage ? <p className="text-sm text-neutral-300">{saveMessage}</p> : null}
            </form>
          ) : activeTab === 'manage' ? (
            <div className="space-y-4">
              <ul className="admin-list space-y-2">
                {existingPosts.map((post) => (
                  <li
                    key={post.fileName}
                    className="admin-list-item flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-700 px-3 py-2"
                  >
                    <div>
                      <p className="font-mono text-sm">{post.fileName}</p>
                      {post.date ? <p className="text-xs text-neutral-400">{post.date}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(post)}
                        className="admin-button admin-secondary rounded border border-neutral-600 px-3 py-1 text-sm disabled:opacity-50"
                        disabled={!isEditorAllowed}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeletePost(post)}
                        disabled={isDeleting || !isEditorAllowed}
                        className="admin-button admin-danger rounded border border-red-500 px-3 py-1 text-sm text-red-300 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleUpdatePost} className="admin-panel space-y-3">
                <p className="text-sm text-neutral-400">{editFileName ? `Editing ${editFileName}` : 'Select a post to edit.'}</p>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={14}
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm"
                  placeholder="Choose a post above to edit its raw markdown."
                />

                <button
                  className="admin-button admin-primary rounded bg-blue-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
                  type="submit"
                  disabled={isUpdating || !editFileName || !isEditorAllowed}
                >
                  {isUpdating ? 'Saving…' : 'Save .md changes'}
                </button>

                {manageMessage ? <p className="text-sm text-neutral-300">{manageMessage}</p> : null}
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handlePublishSong} className="admin-panel space-y-4 rounded border border-neutral-700 bg-neutral-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{isSongEditing ? 'Edit song' : 'Publish song'}</h2>
                  {isSongEditing ? (
                    <button
                      type="button"
                      onClick={handleCancelSongEdit}
                      className="admin-link text-sm text-neutral-300 underline underline-offset-4"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
                <p className="text-sm text-neutral-400">
                  <code>{isSongEditing ? songEditFileName : `${generatedSongId || 'song-id'}.md`}</code>
                </p>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Song ID (optional, auto from title)</span>
                  <input
                    value={songIdValue}
                    onChange={(e) => setSongIdValue(e.target.value)}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                    placeholder="recluse1989"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Title</span>
                  <input
                    value={songTitleValue}
                    onChange={(e) => setSongTitleValue(e.target.value)}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                    placeholder="recluse 1989"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Artist</span>
                  <input
                    value={songArtistValue}
                    onChange={(e) => setSongArtistValue(e.target.value)}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                    placeholder="crawler"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Cover art upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSongCoverArtUpload}
                    className="admin-file w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                  />
                  {songCoverArtFileName ? (
                    <span className="mt-1 block text-xs text-neutral-400">
                      Will publish to /art/{generatedSongId || '[song-id]'}
                      {getFileExtension(songCoverArtFileName) || '.jpg'}
                    </span>
                  ) : songCoverArtValue ? (
                    <span className="mt-1 block text-xs text-neutral-400">Current cover art: {songCoverArtValue}</span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Release date</span>
                  <input
                    value={songReleaseDateValue}
                    onChange={(e) => setSongReleaseDateValue(e.target.value)}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                    placeholder="5/26/24"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Spotify URL</span>
                  <input
                    value={songSpotifyValue}
                    onChange={(e) => setSongSpotifyValue(e.target.value)}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                    placeholder="https://open.spotify.com/..."
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Bandcamp URL</span>
                  <input
                    value={songBandcampValue}
                    onChange={(e) => setSongBandcampValue(e.target.value)}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                    placeholder="https://...bandcamp.com/..."
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Soundcloud URL</span>
                  <input
                    value={songSoundcloudValue}
                    onChange={(e) => setSongSoundcloudValue(e.target.value)}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                    placeholder="https://soundcloud.com/..."
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-neutral-300">Lyrics (Markdown)</span>
                  <textarea
                    value={songLyricsValue}
                    onChange={(e) => setSongLyricsValue(e.target.value)}
                    rows={10}
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
                    placeholder="Put lyrics here..."
                  />
                </label>

                <button
                  className="admin-button admin-primary rounded bg-emerald-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
                  type="submit"
                  disabled={isSongSaving || !isEditorAllowed}
                >
                  {isSongSaving ? 'Saving…' : isSongEditing ? 'Update song' : 'Publish song'}
                </button>

                {songSaveMessage ? <p className="text-sm text-neutral-300">{songSaveMessage}</p> : null}
              </form>

              <div className="space-y-4">
                <ul className="admin-list space-y-2">
                  {existingSongs.map((song) => (
                    <li
                      key={song.fileName}
                      className="admin-list-item flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-700 px-3 py-2"
                    >
                      <div>
                        <p className="font-mono text-sm">{song.fileName}</p>
                        <p className="text-xs text-neutral-400">
                          {song.title || '[untitled]'} {song.artist ? `- ${song.artist}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartSongEdit(song)}
                          className="admin-button admin-secondary rounded border border-neutral-600 px-3 py-1 text-sm disabled:opacity-50"
                          disabled={!isEditorAllowed}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSong(song)}
                          disabled={isSongDeleting || !isEditorAllowed}
                          className="admin-button admin-danger rounded border border-red-500 px-3 py-1 text-sm text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {songManageMessage ? <p className="text-sm text-neutral-300">{songManageMessage}</p> : null}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default Admin
