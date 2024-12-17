import React from 'react';
import { useParams } from 'react-router-dom';
import tracks from './music/tracks.json'; // Adjust path if needed

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
        className='cover'
          src={currentSong.coverArt}
          alt={currentSong.title}
          style={{
            width: '100px',
            marginRight: '20px',  // Add space between the image and the text
          }}
        />
        
        <div>
          <p className='typewriter h2 text-white'>{currentSong.title}</p>
          <p className='typewriter h2 text-purple'>{currentSong.artist}</p><br />
        </div>
      </div>
  
      <br /><br /><p className='arial p text-white'>{currentSong.lyrics || '[no lyrics]'}</p><br />
      <a className='arial p text-white' href={currentSong.spotify} target="_blank" rel="noopener noreferrer">spotify</a><br />
      <a className='arial p text-white' href={currentSong.bandcamp} target="_blank" rel="noopener noreferrer">bandcamp</a><br />
      <a className='arial p text-white' href={currentSong.soundcloud} target="_blank" rel="noopener noreferrer">soundcloud</a><br /><br />
      <p className='arial p text-white'>{currentSong.releaseDate}</p><br />
    </div>
  );
};

export default Track;