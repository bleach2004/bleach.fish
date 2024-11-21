import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="skin">
      <div className="meat">
        <p className='text-red'>BLEACH'S CORNER</p>
        <br />
        <Link to="/audio">AUDIO</Link>
        {/* <Link to="/visual">VISUAL</Link>
        <Link to="/scrapyard">SCRAPYARD</Link> */}
        <Link to="/blog">BLOG</Link>
        {/* <Link to="/cavern">CAVERN</Link> */}
      </div>
      {/* Uncomment the image below if needed */}
      {/* <img src='page1/1.png' className='chess' alt='Chess'></img> */}
    </div>
  );
};

export default Home;