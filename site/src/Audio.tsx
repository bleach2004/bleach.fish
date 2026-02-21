import { Link } from 'react-router-dom'
import { songs } from './music/tracks'

const Audio: React.FC = () => {
  return (
    <div className="wrapper">
      <div className="audio-grid">
        {songs.map((song) => (
          <Link key={song.id} to={`/audio/${song.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <img
              className="cover"
              src={song.coverArt}
              alt={song.title}
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Audio
