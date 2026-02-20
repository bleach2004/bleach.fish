import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, matchPath } from 'react-router-dom';

const BackLink: React.FC = () => {
  const [showBackLink, setShowBackLink] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setShowBackLink(location.pathname !== '/');
  }, [location.pathname]);

  const handleBackClick = () => {
    const { pathname } = location;

    if (matchPath('/diary/:id', pathname)) {
      navigate('/diary');
      return;
    }

    if (pathname === '/diary') {
      navigate('/');
      return;
    }

    if (matchPath('/audio/:id', pathname)) {
      navigate('/audio');
      return;
    }

    if (pathname === '/audio') {
      navigate('/');
      return;
    }

    navigate(-1);
  };

  if (!showBackLink) {
    return null;
  }

  return (
    <button
      className="back-button p"
      onClick={handleBackClick}
    >
      back
    </button>
  );
};

export default BackLink;
