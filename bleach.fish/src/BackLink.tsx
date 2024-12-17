import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BackLink: React.FC = () => {
  const [showBackLink, setShowBackLink] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If we're on the homepage, hide the back button
    if (location.pathname === '/') {
      setShowBackLink(false);
    } else {
      // If we're not on the homepage, show the back button
      setShowBackLink(true);
    }
  }, [location.pathname]);  // Runs every time the location (URL) changes

  const handleBackClick = () => {
    navigate(-1); // Go back to the previous page in history
  };

  if (!showBackLink) {
    return null; // Don't render anything if the back link should be hidden
  }

  return (
    <button
        className='back-button'
      onClick={handleBackClick}
    >
      back
    </button>
  );
};

export default BackLink;