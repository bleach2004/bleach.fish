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
    <div className='track-wrapper' style={{ padding: '20px' }}>
      <div className="track-container">
        <img
          className="cover-static"
          src={currentSong.coverArt}
          alt={currentSong.title}
        />
        <div className="track-title">
          <p className="roboto h2 text-white">{currentSong.title}</p>
          <p className="roboto h3 text-yellow-500">{currentSong.artist}</p>
        </div>
      </div>
      <div className='track-info'>
        <br />
        <p className="roboto p text-white">{currentSong.lyrics || '[no lyrics]'}</p>
        <br />
        <a className="roboto p text-white" href={currentSong.spotify} target="_blank" rel="noopener noreferrer">
          spotify
        </a>
        <br />
        <a className="roboto p text-white" href={currentSong.bandcamp} target="_blank" rel="noopener noreferrer">
          bandcamp
        </a>
        <br />
        <a className="roboto p text-white" href={currentSong.soundcloud} target="_blank" rel="noopener noreferrer">
          soundcloud
        </a>
        <br />
        <br />
        <p className="roboto p text-white">{currentSong.releaseDate}</p>
        <br />
      </div>

    </div>
  );
};

export default Track;