import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Breweries from './pages/Breweries.jsx';
import BreweryMap from './pages/BreweryMap.jsx';
import Itinerary from './pages/Itinerary.jsx';

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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function NotFound() {
  return (
    <div className="narrow">
      <h1>Page not found</h1>
      <p>Sorry — that page doesn't exist. Let's head back home.</p>
    </div>
  );
}
