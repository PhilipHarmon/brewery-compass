import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import BackToTop from './components/BackToTop.jsx';
import Home from './pages/Home.jsx';
import Breweries from './pages/Breweries.jsx';
import BreweryMap from './pages/BreweryMap.jsx';
import Itinerary from './pages/Itinerary.jsx';
import About from './pages/About.jsx';
import GetInvolved from './pages/GetInvolved.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/breweries" element={<Breweries />} />
          <Route path="/map" element={<BreweryMap />} />
          <Route path="/itinerary" element={<Itinerary />} />
          <Route path="/about" element={<About />} />
          <Route path="/get-involved" element={<GetInvolved />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}

function NotFound() {
  return (
    <div className="narrow">
      <p className="kicker">404</p>
      <h1>That trail went cold</h1>
      <p>
        Sorry — that page doesn't exist. It may have moved, or the link has a typo.
        The beer, fortunately, is exactly where it always was.
      </p>
      <div className="notfound-actions">
        <Link to="/" className="btn btn-primary">Back to Home</Link>
        <Link to="/breweries" className="btn btn-ghost">Browse Breweries</Link>
      </div>
    </div>
  );
}
