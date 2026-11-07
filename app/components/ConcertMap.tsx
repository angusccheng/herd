'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

export type MapPoint = {
  city: string
  lat: number
  lng: number
  count: number
}

export function ConcertMap({ points }: { points: MapPoint[] }) {
  return (
    <div style={{ width: '100%', borderRadius: 16, overflow: 'hidden', height: 300 }}>
      <style>{`.leaflet-control-attribution { display: none !important; }`}</style>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={10}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        maxBounds={[[-85, -Infinity], [85, Infinity]]}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {points.map(point => (
          <CircleMarker
            key={point.city}
            center={[point.lat, point.lng]}
            radius={Math.min(12, 4 + point.count * 1.5)}
            pathOptions={{ color: '#1e4a4a', fillColor: '#2d6a6a', fillOpacity: 0.9, weight: 1.5 }}
          >
            <Popup>{point.city} — {point.count} show{point.count !== 1 ? 's' : ''}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
