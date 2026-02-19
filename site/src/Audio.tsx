import { Link } from 'react-router-dom';
import tracks from './music/tracks.json'; // Adjust the relative path as needed

interface Song {
  id: string;
  title: string;
  coverArt: string;
}

const Audio: React.FC = () => {
  // Ensure the data matches the Song interface
  const songs: Song[] = tracks;

  return (
    <div className='wrapper'>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '16px',
        }}
      >
        {songs.map((song) => (
          <Link
            key={song.id}
            to={`/audio/${song.id}`}
            style={{ textDecoration: 'none' }}
          >
            <img 
              className='cover'
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
  );
};

export default Audio;