import { Link } from 'react-router-dom'
import { songs } from './music/tracks'

const Audio: React.FC = () => {

  return (
    <div className="wrapper">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '16px',
        }}
      >
        {songs.map((song) => (
          <Link key={song.id} to={`/audio/${song.id}`} style={{ textDecoration: 'none' }}>
            <img
              className="cover"
              src={song.coverArt}
              alt={song.title}
              style={{
                width: '100px',
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
