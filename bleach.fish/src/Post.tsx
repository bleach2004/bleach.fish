import React from 'react';
import { useParams } from 'react-router-dom';
import posts from './blog/posts.json'; // Adjust path if needed

const Post: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Get the dynamic parameter from the URL

  // Find the currentPost in the JSON data
  const currentPost = posts.find((post) => post.id === id);

  if (!currentPost) {
    return <h1>Song not found</h1>;
  }

  return (
    <div className='wrapper'>
      <div>
        <div>
          {currentPost.text && (
            <p className="blog-text">{currentPost.text}</p>
          )}
          {/* Conditionally render the image if imageLink exists */}
          {currentPost.imageLink && (
            <img 
              src={"/img/" + currentPost.imageLink} 
              style={{ maxWidth: '100%', height: 'auto' }} 
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Post;