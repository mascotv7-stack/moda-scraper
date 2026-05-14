const { filterByDistance } = require('./geo')
const { filterByPrice, filterByBedType, filterByAmenities } = require('./postFilters')

const LITEAPI_BASE = 'https://api.liteapi.travel/v3.0'

function liteHeaders() {
  return {
    'X-API-Key': process.env.LITEAPI_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function geocodeCity(city) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
    { headers: { 'User-Agent': 'MODA-OS/1.0' } }
  )
  const data = await res.json()
  if (!data[0]) return null
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
}

async function scrapeHotels(_ctx, { destination, start_date, end_date, filters = {} }) {
  if (!process.env.LITEAPI_KEY) {
    console.warn('LITEAPI_KEY manquant — hôtels ignorés')
    return []
  }

  try {
    const checkOut = end_date || start_date

    const coords = await geocodeCity(destination)
    if (!coords) {
      console.warn(`LiteAPI: coordonnées introuvables pour ${destination}`)
      return []
    }

    const hotelParams = new URLSearchParams({
      latitude: String(coords.lat),
      longitude: String(coords.lon),
      radius: '10000',
      language: 'fr',
      limit: '20',
    })
    if (filters.hotel_stars_min) {
      hotelParams.set('starRating', String(filters.hotel_stars_min))
    }

    const hotelRes = await fetch(
      `${LITEAPI_BASE}/data/hotels?${hotelParams}`,
      { headers: liteHeaders() }
    )

    if (!hotelRes.ok) {
      console.warn(`LiteAPI hotels list ${hotelRes.status}`)
      return []
    }

    const hotelData = await hotelRes.json()
    const hotels = hotelData.data || []

    if (hotels.length === 0) {
      console.warn(`LiteAPI: aucun hôtel trouvé pour ${destination}`)
      return []
    }

    const hotelMeta = {}
    hotels.forEach(h => { hotelMeta[h.id] = h })
    const hotelIds = hotels.slice(0, 15).map(h => h.id)

    const ratesRes = await fetch(`${LITEAPI_BASE}/hotels/rates`, {
      method: 'POST',
      headers: liteHeaders(),
      body: JSON.stringify({
        hotelIds,
        checkin: start_date,
        checkout: checkOut,
        occupancies: [{ adults: filters.occupants_per_room || 1 }],
        guestNationality: 'FR',
        currency: 'EUR',
      }),
    })

    if (!ratesRes.ok) {
      console.warn(`LiteAPI rates ${ratesRes.status}`)
      return []
    }

    const ratesData = await ratesRes.json()
    const ratedHotels = ratesData.data || []

    const nights = Math.max(
      1,
      (new Date(checkOut) - new Date(start_date)) / (1000 * 60 * 60 * 24)
    )

    const results = ratedHotels
      .filter(h => h.roomTypes?.length > 0)
      .map(h => {
        const meta = hotelMeta[h.hotelId] || {}
        const rate = h.roomTypes[0].rates[0]
        const totalPrice = rate?.retailRate?.total?.[0]?.amount || null
        const pricePerNight = totalPrice ? Math.round(totalPrice / nights) : null

        return {
          type: 'hotel',
          provider: meta.name || h.hotelId,
          source: 'liteapi',
          details: {
            name: meta.name || h.hotelId,
            address: meta.address ? `${meta.address}, ${meta.city}` : destination,
            stars: meta.stars || null,
            rating: meta.rating || null,
            reviews: meta.reviewCount || null,
            check_in: start_date,
            check_out: checkOut,
            amenities: (meta.amenities || []).map((a) => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean),
            lat: meta.latitude || null,
            lon: meta.longitude || null,
            room_type: h.roomTypes[0]?.roomName || null,
            cancellation: rate?.cancellationPolicies?.[0]?.cancelPolicyInfos?.[0]?.type || null,
          },
          price: pricePerNight,
          currency: 'EUR',
          url: `https://www.booking.com/searchresults.html?city=${encodeURIComponent(destination)}&checkin=${start_date}&checkout=${checkOut}`,
        }
      })

    const byDistance  = await filterByDistance(results, filters, destination)
    const byPrice     = filterByPrice(byDistance, filters.min_hotel, filters.max_hotel)
    const byBedType   = filterByBedType(byPrice, filters.bed_type)
    return filterByAmenities(byBedType, filters.hotel_amenities)
  } catch (err) {
    console.error('LiteAPI hotels error:', err.message)
    return []
  }
}

module.exports = { scrapeHotels }
