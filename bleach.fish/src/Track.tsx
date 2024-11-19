import React from 'react';
import { useParams } from 'react-router-dom';
import tracks from './music/tracks.json'; // Adjust path if needed

interface Song {
  id: string;
  title: string;
  artist: string;
  coverArt: string;
  spotify: string;
  bandcamp: string;
  soundcloud: string;
  releaseDate: string;
  lyrics: string;
}
const Track: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Get the dynamic parameter from the URL

  // Find the currentSong in the JSON data
  const currentSong = tracks.find((track) => track.id === id);

  if (!currentSong) {
    return <h1>Song not found</h1>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}> {/* Flex container */}
        <img
          src={currentSong.coverArt}
          alt={currentSong.title}
          style={{
            width: '100px',
            marginRight: '20px',  // Add space between the image and the text
          }}
        />
        
        <div>
          <p className='text-white'>{currentSong.title}</p>
          <p className='text-white'>{currentSong.artist}</p><br />
        </div>
      </div>
  
      <br /><p className='text-white'>{currentSong.lyrics || '[NO LYRICS]'}</p><br />
      <a href={currentSong.spotify} target="_blank" rel="noopener noreferrer">SPOTIFY</a><br />
      <a href={currentSong.bandcamp} target="_blank" rel="noopener noreferrer">BANDCAMP</a><br />
      <a href={currentSong.soundcloud} target="_blank" rel="noopener noreferrer">SOUNDCLOUD</a><br /><br />
      <p className='text-white'>{currentSong.releaseDate}</p><br />
    </div>
  );
};

export default Track;