import React from 'react'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router-dom'
import { findSongById } from './music/tracks'

const externalLink = (value: string, label: string) =>
  value ? (
    <a className="p" href={value} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  ) : null

const Track: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const currentSong = findSongById(id)

  if (!currentSong) {
    return <h1>Song not found</h1>
  }

  return (
    <div className="wrapper track-wrapper">
      <div className="track-container">
        <img className="cover-static" src={currentSong.coverArt} alt={currentSong.title} />
        <div className="track-title">
          <p className="h2">{currentSong.title}</p>
          <p className="h3">{currentSong.artist}</p>
        </div>
      </div>
      <div className="track-info">
        <br />
        {currentSong.lyrics ? (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="p">{children}</p>,
            }}
          >
            {currentSong.lyrics}
          </ReactMarkdown>
        ) : (
          <p className="p">[no lyrics]</p>
        )}
        {currentSong.spotify ? <>{externalLink(currentSong.spotify, 'spotify')}<br /></> : null}
        {currentSong.bandcamp ? <>{externalLink(currentSong.bandcamp, 'bandcamp')}<br /></> : null}
        {currentSong.soundcloud ? <>{externalLink(currentSong.soundcloud, 'soundcloud')}<br /></> : null}
        <br />
        <p className="p">{currentSong.releaseDate}</p>
        <br />
      </div>
    </div>
  )
}

export default Track
