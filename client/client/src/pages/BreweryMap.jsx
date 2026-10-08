import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { api, websiteUrl } from '../api.js';

const NC_CENTER = [35.5, -79.5];

const pinIcon = L.divIcon({
  className: 'brew-pin-wrap',
  html: '<span class="brew-pin" aria-hidden="true">🍺</span>',
  iconSize: [36, 36],
  iconAnchor: [18, 32],
  popupAnchor: [0, -30],
  tooltipAnchor: [0, -30],
});

function featureId(f, i) {
  return f.properties.brewery_id || f.properties.name || `f-${i}`;
}

function FitView({ features, target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      const [lng, lat] = target.geometry.coordinates;
      map.setView([lat, lng], 13, { animate: true });
    } else if (features.length > 0) {
      const bounds = L.latLngBounds(
        features.map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]]),
      );
      map.fitBounds(bounds.pad(0.12));
    }
  }, [map, features, target]);
  return null;
}

export default function BreweryMap() {
  const [params] = useSearchParams();
  const targetBreweryId = params.get('brewery');
  const [features, setFeatures] = useState(null);
  const [error, setError] = useState('');
  const markerRefs = useRef({});

  useEffect(() => {
    let cancelled = false;
    api
      .geo()
      .then((fc) => {
        if (!cancelled) setFeatures(fc.features || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the map data. Try again in a bit.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const target = useMemo(() => {
    if (!features || !targetBreweryId) return null;
    return features.find((f, i) => featureId(f, i) === targetBreweryId) || null;
  }, [features, targetBreweryId]);

  useEffect(() => {
    if (target) {
      const id = featureId(target, features.indexOf(target));
      const marker = markerRefs.current[id];
      if (marker) setTimeout(() => marker.openPopup(), 400);
    }
  }, [target, features]);

  return (
    <div className="page">
      <div className="narrow">
        <h1>Breweries on the map</h1>
        <p className="muted">
          Hover a pin for the quick facts — tap or click one for the full card. Clicking a
          pin's website opens the brewery's own site.
        </p>
      </div>
      {error && (
        <div className="narrow">
          <p className="alert alert-error">{error}</p>
        </div>
      )}
      <div className="map-wrap">
        <MapContainer
          center={NC_CENTER}
          zoom={7}
          scrollWheelZoom
          className="brew-map"
          attributionControl
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <FitView features={features || []} target={target} />
          {(features || []).map((f, i) => {
            const id = featureId(f, i);
            const p = f.properties;
            const [lng, lat] = f.geometry.coordinates;
            const site = websiteUrl(p.website);
            return (
              <Marker
                key={id}
                position={[lat, lng]}
                icon={pinIcon}
                ref={(m) => {
                  if (m) markerRefs.current[id] = m;
                }}
              >
                <Tooltip direction="top" offset={[0, -30]} opacity={1} sticky className="brew-tip">
                  <strong>{p.name}</strong>
                  <br />
                  {[p.city, p.brewery_type].filter(Boolean).join(' · ')}
                  <br />
                  <em className="tip-hint">👆 Click the pin for more info</em>
                </Tooltip>
                <Popup className="brew-pop">
                  <div className="brew-pop-card">
                    <strong className="brew-pop-name">{p.name}</strong>
                    <div className="muted">
                      {[p.city, p.brewery_type].filter(Boolean).join(' · ')}
                    </div>
                    <div className="brew-pop-actions">
                      {site && (
                        <a href={site} target="_blank" rel="noreferrer noopener">
                          🌐 Website
                        </a>
                      )}
                      {p.brewery_id && (
                        <Link to={`/breweries?brewery=${encodeURIComponent(p.brewery_id)}`}>
                          🍻 Tap list
                        </Link>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
      <div className="narrow">
        <p className="muted map-count">
          {features ? `${features.length} breweries pinned` : 'Loading pins…'}
        </p>
      </div>
    </div>
  );
}
