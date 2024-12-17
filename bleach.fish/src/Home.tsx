import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="skin vert-center-wrapper">
      <div className="meat text-center">
        <p className='text-violet-400	 roboto h1'>bleach's corner</p>
        <Link to="/audio" className='roboto p'>audio</Link>
        {/* <Link to="/visual">VISUAL</Link>
        <Link to="/scrapyard">SCRAPYARD</Link> */}
        <Link to="/blog" className='roboto p'>blog</Link>
        {/* <Link to="/cavern">CAVERN</Link> */}
      </div>
      {/* Uncomment the image below if needed */}
      {/* <img src='page1/1.png' className='chess' alt='Chess'></img> */}
    </div>
  );
};

export default Home;