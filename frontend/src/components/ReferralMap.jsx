import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchZipCentroidOnce, haversineMiles } from "../utils/geoZip";
import { MapPin } from "lucide-react";

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds || bounds.length < 2) return;
    const id = window.requestAnimationFrame(() => {
      try {
        map.invalidateSize();
        map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 12 });
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [map, bounds]);
  return null;
}

export default function ReferralMap({ referral, userZip, t }) {
  const [userPt, setUserPt] = useState(null);
  const [geoFail, setGeoFail] = useState(false);
  const zipOk = useMemo(() => /^\d{5}$/.test(String(userZip || "").trim()), [userZip]);
  const officeLat = referral?.latitude;
  const officeLng = referral?.longitude;

  useEffect(() => {
    let cancelled = false;
    if (!zipOk || officeLat == null || officeLng == null) return undefined;
    setGeoFail(false);
    setUserPt(null);
    (async () => {
      const p = await fetchZipCentroidOnce(String(userZip).trim());
      if (cancelled) return;
      if (!p) {
        setGeoFail(true);
        return;
      }
      setUserPt(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [zipOk, userZip, officeLat, officeLng]);

  const miles = useMemo(() => {
    if (!userPt || officeLat == null || officeLng == null) return null;
    return haversineMiles(userPt.lat, userPt.lng, officeLat, officeLng);
  }, [userPt, officeLat, officeLng]);

  const directionsUrl = useMemo(() => {
    const dest = encodeURIComponent(`${referral?.name || "legal aid"} Illinois`);
    if (zipOk) {
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        String(userZip).trim()
      )}&destination=${dest}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${dest}`;
  }, [referral?.name, userZip, zipOk]);

  if (officeLat == null || officeLng == null) {
    const refUrl = referral?.url || "";
    const refPhone = referral?.phone || "";
    return (
      <div style={{
        background: "#F4F5F7", borderRadius: 8, padding: 16,
        textAlign: "center", marginTop: 4,
      }}>
        <MapPin style={{ color: "#C9A84C", width: 22, height: 22, margin: "0 auto 8px", display: "block" }} />
        <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 10px", lineHeight: 1.5 }}>
          This organization serves Illinois statewide. No specific office location available.
        </p>
        {refPhone && (
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>
            <span style={{ marginRight: 6 }}>📞</span>{refPhone}
          </p>
        )}
        {refUrl && (
          <a
            href={refUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              border: "1px solid #C9A84C", color: "#C9A84C",
              borderRadius: 8, padding: "6px 16px",
              fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            Visit Website
          </a>
        )}
      </div>
    );
  }

  if (!zipOk) {
    return (
      <div className="referral-map-fallback">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="referral-map-link"
        >
          {t("chat.referralMapOpenInMaps")}
        </a>
      </div>
    );
  }

  if (!userPt) {
    return (
      <div className="referral-map-fallback">
        <p className="referral-map-note">
          {geoFail ? t("chat.referralMapZipGeoFail") : t("chat.referralMapLoading")}
        </p>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="referral-map-link"
        >
          {t("chat.referralMapDrivingDirections")}
        </a>
      </div>
    );
  }

  const bounds = [
    [userPt.lat, userPt.lng],
    [officeLat, officeLng],
  ];

  return (
    <div className="referral-map-section">
      {miles != null ? (
        <p className="referral-map-distance">{t("chat.referralMapApproxMi", { miles })}</p>
      ) : null}
      <p className="referral-map-disclaimer">{t("chat.referralMapDisclaimer")}</p>
      <div className="referral-map-frame">
        <MapContainer
          center={[userPt.lat, userPt.lng]}
          zoom={10}
          scrollWheelZoom={false}
          style={{ height: 200, width: "100%", borderRadius: 8 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />
          <FitBounds bounds={bounds} />
          <CircleMarker
            center={[userPt.lat, userPt.lng]}
            radius={9}
            pathOptions={{
              color: "#2f81f7",
              fillColor: "#2f81f7",
              fillOpacity: 0.88,
            }}
          >
            <Popup>{t("chat.referralMapYouZip")}</Popup>
          </CircleMarker>
          <CircleMarker
            center={[officeLat, officeLng]}
            radius={9}
            pathOptions={{
              color: "#3fb950",
              fillColor: "#3fb950",
              fillOpacity: 0.88,
            }}
          >
            <Popup>{referral.name}</Popup>
          </CircleMarker>
        </MapContainer>
      </div>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="referral-map-link"
      >
        {t("chat.referralMapDrivingDirections")}
      </a>
    </div>
  );
}
