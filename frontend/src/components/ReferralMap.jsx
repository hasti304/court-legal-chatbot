import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchZipCentroidOnce, haversineMiles } from "../utils/geoZip";

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
    return (
      <div className="referral-map-fallback">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="referral-map-link"
        >
          {t("chat.referralMapDirectionsOnly")}
        </a>
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
