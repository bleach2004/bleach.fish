import { Link } from 'react-router-dom'
import { songs } from './music/tracks'

const Audio: React.FC = () => {
  return (
    <div className="wrapper">
      <div
        style={{
          display: 'grid',
          width: 'min(var(--content-lane-width), calc(100vw - 2rem))',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '16px',
        }}
      >
        {songs.map((song) => (
          <Link key={song.id} to={`/audio/${song.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <img
              className="cover"
              src={song.coverArt}
              alt={song.title}
              style={{
                width: '100%',
                maxWidth: '150px',
                cursor: 'pointer',
              }}
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Audio
