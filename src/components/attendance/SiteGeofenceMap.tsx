import React from 'react';
import { LocateFixed, MapPin, Navigation, ShieldAlert } from 'lucide-react';
import type { LocationLog, ProjectSite } from '../../types/buildflow';
import type { GpsReading } from '../../services/capacitorBridge';
import { computeDistanceMeters } from '../../services/capacitorBridge';
import { formatTime } from '../ui/Primitives';

interface SiteGeofenceMapProps {
  site: ProjectSite;
  gps: GpsReading | null;
  gpsError: string | null;
  locationLogs: LocationLog[];
  trackingActive: boolean;
}

export const SiteGeofenceMap: React.FC<SiteGeofenceMapProps> = ({
  site,
  gps,
  gpsError,
  locationLogs,
  trackingActive,
}) => {
  const distanceMeters = gps
    ? computeDistanceMeters(gps.latitude, gps.longitude, site.latitude, site.longitude)
    : null;
  const within = distanceMeters !== null ? distanceMeters <= site.geofenceRadiusMeters : null;

  // Map projection centered at site.latitude / site.longitude inside 320x200 SVG canvas
  const width = 320;
  const height = 200;
  const cx = width / 2;
  const cy = height / 2;
  const radiusPx = 62;

  const projectPoint = (lat: number, lng: number) => {
    const metersPerLat = 111320;
    const metersPerLng = 111320 * Math.cos((site.latitude * Math.PI) / 180);
    const dxMeters = (lng - site.longitude) * metersPerLng;
    const dyMeters = (lat - site.latitude) * metersPerLat;
    const scale = radiusPx / Math.max(site.geofenceRadiusMeters, 100);
    const x = Math.max(16, Math.min(width - 16, cx + dxMeters * scale));
    const y = Math.max(16, Math.min(height - 16, cy - dyMeters * scale));
    return { x, y };
  };

  const workerPt = gps ? projectPoint(gps.latitude, gps.longitude) : null;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span className="text-sm font-semibold text-[#101F35] truncate">
            {site.siteName} Geofence Map
          </span>
        </div>
        <span className="text-xs font-mono tabular-nums text-[#64748B] shrink-0">
          Radius {site.geofenceRadiusMeters}m
        </span>
      </div>

      {gps ? (
        <div className="relative bg-[#F5F7FA]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-48 block"
            role="img"
            aria-label="Interactive site geofence and live worker GPS plot"
          >
            {/* Subtle survey grid */}
            <defs>
              <pattern id="siteGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E2E8F0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#siteGrid)" />

            {/* Geofence perimeter */}
            <circle
              cx={cx}
              cy={cy}
              r={radiusPx}
              fill={within ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)'}
              stroke={within ? '#16A34A' : '#DC2626'}
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />

            {/* Historical session location breadcrumbs */}
            {locationLogs.slice(0, 12).map((log, i) => {
              const pt = projectPoint(log.latitude, log.longitude);
              return (
                <circle
                  key={log.id}
                  cx={pt.x}
                  cy={pt.y}
                  r={3}
                  fill="#2563EB"
                  opacity={Math.max(0.25, 1 - i * 0.07)}
                />
              );
            })}

            {/* Assigned Site Center */}
            <circle cx={cx} cy={cy} r="6" fill="#101F35" />
            <text x={cx} y={cy + 18} textAnchor="middle" fontSize="10" fontWeight="600" fill="#101F35">
              {site.siteName}
            </text>

            {/* Current Worker Live GPS Pin */}
            {workerPt && (
              <g>
                <circle
                  cx={workerPt.x}
                  cy={workerPt.y}
                  r={Math.min(26, Math.max(10, (gps.accuracyMeters / site.geofenceRadiusMeters) * radiusPx))}
                  fill="rgba(37, 99, 235, 0.16)"
                />
                <circle cx={workerPt.x} cy={workerPt.y} r="6.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <text
                  x={workerPt.x}
                  y={workerPt.y - 11}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#2563EB"
                >
                  You
                </text>
              </g>
            )}
          </svg>

          <div className="px-4 py-3 bg-white border-t border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[#64748B] block">Distance to Site</span>
              <span className={`font-mono font-semibold tabular-nums ${within ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                {distanceMeters} m ({within ? 'Inside' : 'Outside'})
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">GPS Accuracy</span>
              <span className="font-mono font-semibold tabular-nums text-[#101F35]">
                ±{gps.accuracyMeters} m
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">Coordinates</span>
              <span className="font-mono tabular-nums text-[#172B4D]">
                {gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">Tracking State</span>
              <span className="font-medium text-[#101F35]">
                {trackingActive ? `Active · ${formatTime(gps.timestamp)}` : 'Off (Not checked in)'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 bg-[#F5F7FA] flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-[#101F35]">
              {gpsError ? 'Location Permission / GPS Unavailable' : 'Waiting for GPS Coordinates'}
            </p>
            <p className="text-[#64748B] leading-relaxed">
              {gpsError ||
                'Location access is only used to verify your site geofence during check-in/check-out and active work sessions. We never track you outside shift hours.'}
            </p>
            <div className="pt-1 flex items-center gap-3 text-[#172B4D] font-mono tabular-nums">
              <span className="inline-flex items-center gap-1">
                <LocateFixed className="w-3.5 h-3.5 text-[#2563EB]" />
                Site: {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-[#64748B]" />
                {site.city}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
