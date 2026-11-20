import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { JUNCTION, VALIDATED_CORRIDORS } from '../data/corridors';
import { congestionLevel, type CorridorState } from '../engine/congestion';

interface GeoFeature {
  properties: { id: string; name: string };
  geometry: { coordinates: number[][] };
}

const LEVEL_COLOR: Record<string, string> = {
  free: '#2DD4A7',
  moderate: '#F5B544',
  heavy: '#F07F2E',
  severe: '#E5484D',
};

function junctionIcon(): L.DivIcon {
  return L.divIcon({
    className: 'junction-marker',
    html: '<div class="junction-dot" title="WEH × SCLR junction"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function MapView({ states }: { states: Record<string, CorridorState> }) {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [geoError, setGeoError] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/real/corridors.geojson`)
      .then((r) => {
        if (!r.ok) throw new Error(`GeoJSON fetch failed: ${r.status}`);
        return r.json();
      })
      .then((d) => setFeatures(d.features as GeoFeature[]))
      .catch(() => setGeoError(true));
  }, []);

  const polylines = useMemo(
    () =>
      features.map((f) => {
        const corridor = VALIDATED_CORRIDORS.find((c) => c.id === f.properties.id);
        if (!corridor) return null;
        const state = states[corridor.id];
        const level = state ? congestionLevel(state.congestion) : 'moderate';
        const positions = f.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
        return (
          <Polyline
            key={corridor.id}
            positions={positions}
            pathOptions={{ color: LEVEL_COLOR[level], weight: 5, opacity: 0.9 }}
          >
            <Tooltip sticky>
              {corridor.name} — {state ? `congestion ${state.congestion.toFixed(0)}/100 (${level}, SIMULATED)` : 'loading…'} · geometry ESTIMATED (OSRM/OSM, 27 Oct 2026)
            </Tooltip>
            <Popup>
              <strong>{corridor.name}</strong>
              <br />
              {corridor.from} → {corridor.to}
              <br />
              {corridor.lengthKm} km · free-flow {(corridor.freeFlowDurationS / 60).toFixed(1)} min (ESTIMATED, OSRM)
              <br />
              {state && (
                <>
                  Congestion {state.congestion.toFixed(0)}/100 · {state.avgSpeedKmh.toFixed(0)} km/h · {state.travelMinutes.toFixed(0)} min now (all SIMULATED)
                </>
              )}
            </Popup>
          </Polyline>
        );
      }),
    [features, states],
  );

  return (
    <div className="map-wrap">
      <MapContainer center={[19.09, 72.87]} zoom={12} className="leaflet-map" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polylines}
        <Marker position={[JUNCTION.lat, JUNCTION.lon]} icon={junctionIcon()}>
          <Popup>
            <strong>{JUNCTION.name}</strong>
            <br />
            Hero junction — three Gemini agents negotiate the green split here.
            <br />
            Cycle {JUNCTION.cycleSeconds}s · congestion SIMULATED · geometry ESTIMATED.
          </Popup>
          <Tooltip direction="top" offset={[0, -12]} permanent>
            WEH × SCLR
          </Tooltip>
        </Marker>
        <CircleMarker center={[19.0596, 72.8295]} radius={5} pathOptions={{ color: '#2DD4A7', fillOpacity: 0.8 }}>
          <Tooltip>Bandra West</Tooltip>
        </CircleMarker>
        <CircleMarker center={[19.066, 72.8679]} radius={5} pathOptions={{ color: '#2DD4A7', fillOpacity: 0.8 }}>
          <Tooltip>BKC</Tooltip>
        </CircleMarker>
      </MapContainer>
      <div className="map-caption">
        {geoError
          ? 'Corridor geometry could not load from data/real/corridors.geojson — the junction marker still shows. Check the file is deployed.'
          : '6 validated corridors drawn from real GeoJSON (OSRM/OSM, 27 Oct 2026, ODbL). Colour = SIMULATED congestion. JVLR, Sea Link and Sion–Panvel are excluded — they failed validation.'}
      </div>
    </div>
  );
}
