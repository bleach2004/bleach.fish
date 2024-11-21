import React from 'react';
import { useParams } from 'react-router-dom';
import posts from './blog/posts.json'; // Adjust path if needed

const Post: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Get the dynamic parameter from the URL

  // Find the currentSong in the JSON data
  const currentSong = posts.find((post) => post.id === id);

  if (!currentSong) {
    return <h1>Song not found</h1>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}> {/* Flex container */}
        
        <div>
          <p className='text-white'>{currentSong.text}</p>
        </div>
      </div>
  

    </div>
  );
};

export default Post;