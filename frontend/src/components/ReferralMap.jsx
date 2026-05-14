import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchZipCentroidOnce, haversineMiles } from "../utils/geoZip";
import { MapPin, ArrowRight } from "lucide-react";

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
        background: "#ffffff", borderRadius: 12,
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
        borderLeft: "4px solid #C9A84C",
        padding: "16px 20px", marginTop: 4,
        textAlign: "center",
      }}>
        <MapPin style={{ color: "#C9A84C", width: 28, height: 28, margin: "0 auto 8px", display: "block" }} />
        <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 10px", lineHeight: 1.5 }}>
          Serves all of Illinois
        </p>
        {refPhone && (
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>
            <span style={{ marginRight: 6 }}>📞</span>{refPhone}
          </p>
        )}
        {refUrl && (
          <a
            href={refUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#ffffff", border: "1.5px solid #1B2A4A", color: "#1B2A4A",
              borderRadius: 8, padding: "8px 20px",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
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
          style={{ color: "#C9A84C", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {t("chat.referralMapOpenInMaps")}
          <ArrowRight style={{ width: 14, height: 14 }} />
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
          style={{ color: "#C9A84C", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {t("chat.referralMapDrivingDirections")}
          <ArrowRight style={{ width: 14, height: 14 }} />
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
      <div className="referral-map-frame" style={{ border: "2px solid #C9A84C", borderRadius: 8, overflow: "hidden" }}>
        <MapContainer
          center={[userPt.lat, userPt.lng]}
          zoom={10}
          scrollWheelZoom={false}
          style={{ height: 200, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
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
        style={{ color: "#C9A84C", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {t("chat.referralMapDrivingDirections")}
        <ArrowRight style={{ width: 14, height: 14 }} />
      </a>
    </div>
  );
}
