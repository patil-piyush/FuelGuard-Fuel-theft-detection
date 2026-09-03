import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatFuel, formatSpeed } from '../lib/format'
import { hasValidGps } from '../services/telemetryService'
import EmptyState from './EmptyState'
import { MapPin } from 'lucide-react'

// Leaflet's default marker icons reference image files that bundlers
// don't resolve automatically — build markers as inline SVG instead so
// the color can also communicate online/offline status.
function buildIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${color};border:2px solid #0A0F1A;
      box-shadow:0 0 0 1px ${color};
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  })
}

const ONLINE_ICON = buildIcon('#3DDC84')
const OFFLINE_ICON = buildIcon('#5C6680')

/**
 * @param {object} props
 * @param {Array<{vehicle: object, telemetry: object|null, online: boolean}>} props.rows
 */
export default function MapView({ rows }) {
  const withGps = rows.filter((r) => hasValidGps(r.telemetry))
  const withoutGps = rows.filter((r) => !hasValidGps(r.telemetry))

  const center = withGps.length
    ? [withGps[0].telemetry.latitude, withGps[0].telemetry.longitude]
    : [20.5937, 78.9629] // India centroid — neutral default when no fix exists yet

  return (
    <div className="flex flex-col gap-3">
      <div className="panel overflow-hidden">
        <MapContainer
          center={center}
          zoom={withGps.length ? 12 : 4}
          style={{ height: '440px', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {withGps.map(({ vehicle, telemetry, online }) => (
            <Marker
              key={vehicle.vehicle_id}
              position={[telemetry.latitude, telemetry.longitude]}
              icon={online ? ONLINE_ICON : OFFLINE_ICON}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold text-text">{vehicle.vehicle_name}</p>
                  <p className="text-text-faint">{vehicle.vehicle_id}</p>
                  <p className="mt-1 text-text">Fuel: {formatFuel(telemetry.fuel_level) ?? 'Pending'}</p>
                  <p className="text-text">Speed: {formatSpeed(telemetry.speed_kmph)}</p>
                  <p className="text-text">{online ? 'Online' : 'Offline'}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {withGps.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="GPS location unavailable"
          detail="No vehicles currently have a valid GPS fix."
        />
      )}

      {withoutGps.length > 0 && withGps.length > 0 && (
        <div className="panel p-3 text-xs text-text-dim">
          <p className="mb-1.5 text-text-faint">Not shown (GPS unavailable):</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {withoutGps.map(({ vehicle }) => (
              <span key={vehicle.vehicle_id}>{vehicle.vehicle_name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
