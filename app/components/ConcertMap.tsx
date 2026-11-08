'use client'

import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

export type MapPoint = {
  city: string
  lat: number
  lng: number
  count: number
}

const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

export function ConcertMap({ points }: { points: MapPoint[] }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff' }}>
      <ComposableMap
        width={960}
        height={500}
        projectionConfig={{ scale: 155 }}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <Geographies geography={WORLD_ATLAS_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{ fill: '#c7c2b5', stroke: '#ffffff', strokeWidth: 0.75, outline: 'none' }}
              />
            ))
          }
        </Geographies>
        {points.map((point) => (
          <Marker key={point.city} coordinates={[point.lng, point.lat]}>
            <circle
              r={Math.min(7, 3.5 + point.count * 0.7)}
              style={{ fill: 'var(--text)', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </Marker>
        ))}
      </ComposableMap>
    </div>
  )
}
