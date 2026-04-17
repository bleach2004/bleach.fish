import { useLayoutEffect } from 'react'
import './App.css'
import Home from  './Home.tsx'
import Audio from  './Audio.tsx'
import Track from  './Track.tsx'
import Diary from  './Diary.tsx'
import Post from  './Post.tsx'
import BackLink from  './BackLink.tsx'
import Admin from './Admin.tsx'
import Scenery from './Scenery.tsx'
import { shouldUseCompactLayout } from './layoutMode.ts'

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';


function App() {
  useLayoutEffect(() => {
    const updateLayoutMode = () => {
      document.body.classList.toggle('compact-layout', shouldUseCompactLayout(window.innerWidth))
    }

    updateLayoutMode()
    window.addEventListener('resize', updateLayoutMode)

    return () => {
      window.removeEventListener('resize', updateLayoutMode)
      document.body.classList.remove('compact-layout')
    }
  }, [])

  return (
    <>
    <div>
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/audio" element={<Audio />} />
        <Route path="/audio/:id" element={<Track />} />
        <Route path="/diary" element={<Diary />} />
        <Route path="/diary/:id" element={<Post />} />
        <Route path="/scenery" element={<Scenery />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <BackLink />
    </Router>
    </div>
    </>
  )
}

export default App
