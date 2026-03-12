import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate, useLocation, matchPath } from 'react-router-dom';

const BackLink: React.FC = () => {
  const [showBackLink, setShowBackLink] = useState(false);
  const [trackBackStyle, setTrackBackStyle] = useState<React.CSSProperties>({});
  const [trackBackAbsolute, setTrackBackAbsolute] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setShowBackLink(location.pathname !== '/' && location.pathname !== '/scenery');
  }, [location.pathname]);

  useLayoutEffect(() => {
    const isTrackPage = Boolean(matchPath('/audio/:id', location.pathname));

    if (!isTrackPage) {
      setTrackBackAbsolute(false);
      setTrackBackStyle({});
      return;
    }

    const updateTrackBackPosition = () => {
      if (window.innerWidth <= 668) {
        setTrackBackAbsolute(false);
        setTrackBackStyle({});
        return;
      }

      const wrapper = document.querySelector('.track-wrapper') as HTMLElement | null;
      if (!wrapper) {
        setTrackBackAbsolute(false);
        setTrackBackStyle({});
        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const wrapperTop = window.scrollY + wrapperRect.top;
      const wrapperBottom = wrapperTop + wrapperRect.height;
      const fixedButtonTop = window.scrollY + window.innerHeight - 44;
      const needsAbsolutePosition = wrapperBottom + 12 >= fixedButtonTop;

      setTrackBackAbsolute(needsAbsolutePosition);
      setTrackBackStyle(needsAbsolutePosition ? { top: `${wrapperBottom + 12}px` } : {});
    };

    updateTrackBackPosition();
    window.addEventListener('resize', updateTrackBackPosition);
    window.addEventListener('scroll', updateTrackBackPosition, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateTrackBackPosition();
    });

    const wrapper = document.querySelector('.track-wrapper') as HTMLElement | null;
    if (wrapper) {
      resizeObserver.observe(wrapper);
    }

    return () => {
      window.removeEventListener('resize', updateTrackBackPosition);
      window.removeEventListener('scroll', updateTrackBackPosition);
      resizeObserver.disconnect();
    };
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
      className={`back-button p${trackBackAbsolute ? ' track-back-button-absolute' : ''}`}
      onClick={handleBackClick}
      style={trackBackStyle}
    >
      back
    </button>
  );
};

export default BackLink;


