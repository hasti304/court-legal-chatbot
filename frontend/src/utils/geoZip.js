const resolvedZipCentroids = new Map();
const pendingZipCentroids = new Map();

/**
 * US ZIP → approximate centroid (Zippopotam.us). Cached in-memory for the session.
 */
export async function fetchZipCentroidOnce(zip) {
  const z = String(zip || "").trim();
  if (!/^\d{5}$/.test(z)) return null;
  if (resolvedZipCentroids.has(z)) return resolvedZipCentroids.get(z);
  if (pendingZipCentroids.has(z)) return pendingZipCentroids.get(z);

  const promise = (async () => {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${z}`);
      if (!res.ok) return null;
      const data = await res.json();
      const place = data.places?.[0];
      if (!place) return null;
      const out = {
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
        placeName: place["place name"] || "",
      };
      if (Number.isNaN(out.lat) || Number.isNaN(out.lng)) return null;
      resolvedZipCentroids.set(z, out);
      return out;
    } catch {
      return null;
    } finally {
      pendingZipCentroids.delete(z);
    }
  })();

  pendingZipCentroids.set(z, promise);
  return promise;
}

/** Straight-line distance in miles (great-circle). */
export function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.7613;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const mi = R * c;
  return Math.round(mi * 10) / 10;
}
