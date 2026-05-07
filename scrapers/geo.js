function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'MODA-OS/1.0 (scraper)' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    return null
  } catch {
    return null
  }
}

// Fallback : si tout est filtré, retourne les originaux avec too_far: true
async function filterByDistance(results, filters, fallbackDestination) {
  if (!filters.venue_lat || !filters.venue_lon || !filters.max_hotel_distance_km) return results
  const filtered = []
  for (const hotel of results) {
    const query = hotel.details.address || hotel.details.name
      ? `${hotel.details.address || hotel.details.name} ${fallbackDestination}`
      : fallbackDestination
    const coords = await geocodeAddress(query)
    if (coords) {
      const dist = haversineKm(filters.venue_lat, filters.venue_lon, coords.lat, coords.lon)
      if (dist <= filters.max_hotel_distance_km) {
        hotel.details.distance_venue_km = Math.round(dist * 10) / 10
        filtered.push(hotel)
      }
    } else {
      filtered.push(hotel)
    }
  }
  if (filtered.length === 0 && results.length > 0) {
    return results.map(r => ({ ...r, details: { ...(r.details || {}), too_far: true } }))
  }
  return filtered
}

module.exports = { haversineKm, geocodeAddress, filterByDistance }
