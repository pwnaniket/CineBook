import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icons (Leaflet expects assets at fixed URLs).
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const userIcon = L.divIcon({
  className: "cb-user-marker",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export type Theater = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  distanceKm: number;
};

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
}

export default function TheatersMap({
  center,
  theaters,
  selectedId,
  onSelect,
}: {
  center: { lat: number; lon: number };
  theaters: Theater[];
  selectedId?: string | null;
  onSelect: (t: Theater) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const key = useMemo(() => `${center.lat.toFixed(3)}-${center.lon.toFixed(3)}`, [center]);
  if (!ready) return <div className="h-full w-full animate-pulse bg-secondary/30" />;
  return (
    <MapContainer
      key={key}
      center={[center.lat, center.lon]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={center.lat} lon={center.lon} />
      <Marker position={[center.lat, center.lon]} icon={userIcon}>
        <Popup>You are here</Popup>
      </Marker>
      {theaters.map((t) => (
        <Marker
          key={t.id}
          position={[t.lat, t.lon]}
          eventHandlers={{ click: () => onSelect(t) }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.name}</div>
              {t.address && <div style={{ fontSize: 12, color: "#555" }}>{t.address}</div>}
              <div style={{ fontSize: 12, marginTop: 4 }}>{t.distanceKm.toFixed(1)} km away</div>
              <button
                onClick={() => onSelect(t)}
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  background: selectedId === t.id ? "#16a34a" : "#eab308",
                  color: "#000",
                  border: 0,
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {selectedId === t.id ? "✓ Preferred" : "Set as preferred"}
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}