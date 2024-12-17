import './App.css'
import Home from  './Home.tsx'
import Audio from  './Audio.tsx'
import Track from  './Track.tsx'
import Blog from  './Blog.tsx'
import Post from  './Post.tsx'
import BackLink from  './BackLink.tsx'

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';


function App() {

  return (
    <>
    <div>
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/audio" element={<Audio />} />
        <Route path="/audio/:id" element={<Track />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<Post />} />
      </Routes>
      <BackLink />
    </Router>
    </div>
    </>
  )
}

export default App
