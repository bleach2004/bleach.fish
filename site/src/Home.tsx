import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="skin">
      <div className="meat text-center">
        <p className='h1'>bleach's corner</p>
        <Link to="/audio" className='p text-white'>audio</Link>
        <Link to="/diary" className='p  text-white'>diary</Link>
      </div>
    </div>
  );
};

export default Home;