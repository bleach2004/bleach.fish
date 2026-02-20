/// <reference types="vite/client" />
import fm from 'front-matter'

export interface Song {
  id: string
  title: string
  artist: string
  coverArt: string
  releaseDate: string
  spotify: string
  bandcamp: string
  soundcloud: string
  lyrics: string
}

type SongAttributes = Partial<Omit<Song, 'lyrics'>> & { lyrics?: string }

const modules = import.meta.glob('./*.md', {
  as: 'raw',
  eager: true,
})

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export const songs: Song[] = Object.entries(modules).map(([path, raw]) => {
  const { attributes, body } = fm<SongAttributes>(raw as string)
  const fileId = path.split('/').pop()?.replace('.md', '') ?? ''

  return {
    id: normalizeString(attributes.id) || fileId,
    title: normalizeString(attributes.title),
    artist: normalizeString(attributes.artist),
    coverArt: normalizeString(attributes.coverArt),
    releaseDate: normalizeString(attributes.releaseDate),
    spotify: normalizeString(attributes.spotify),
    bandcamp: normalizeString(attributes.bandcamp),
    soundcloud: normalizeString(attributes.soundcloud),
    lyrics: normalizeString(attributes.lyrics) || body.trim(),
  }
})

export const findSongById = (id: string | undefined) => songs.find((song) => song.id === id)
