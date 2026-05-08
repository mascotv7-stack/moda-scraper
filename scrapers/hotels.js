const { filterByDistance } = require('./geo')
const { filterByPrice } = require('./postFilters')

const SERPAPI_BASE = 'https://serpapi.com/search.json'

async function scrapeHotels(_ctx, { destination, start_date, end_date, filters = {} }) {
  if (!process.env.SERPAPI_KEY) {
    console.warn('SERPAPI_KEY manquant — hôtels ignorés')
    return []
  }

  try {
    const checkOut = end_date || start_date

    const params = new URLSearchParams({
      engine: 'google_hotels',
      q: destination,
      check_in_date: start_date,
      check_out_date: checkOut,
      adults: '1',
      currency: 'EUR',
      hl: 'fr',
      gl: 'fr',
      api_key: process.env.SERPAPI_KEY,
    })

    if (filters.hotel_stars_min) {
      params.set('min_category', String(filters.hotel_stars_min))
    }

    if (filters.venue_lat && filters.venue_lon) {
      params.set('ll', `@${filters.venue_lat},${filters.venue_lon},14z`)
    }

    const res = await fetch(`${SERPAPI_BASE}?${params}`)

    if (!res.ok) {
      console.warn(`SerpAPI hotels ${res.status}`)
      return []
    }

    const data = await res.json()
    const properties = data.properties || []

    const results = properties.slice(0, 15).map((hotel) => ({
      type: 'hotel',
      provider: hotel.name,
      source: 'serpapi_google_hotels',
      details: {
        name: hotel.name,
        address: hotel.description || destination,
        stars: hotel.overall_rating ? Math.round(hotel.overall_rating) : null,
        rating: hotel.overall_rating || null,
        reviews: hotel.reviews || null,
        check_in: start_date,
        check_out: checkOut,
        amenities: hotel.amenities?.slice(0, 5) || [],
        lat: hotel.gps_coordinates?.latitude || null,
        lon: hotel.gps_coordinates?.longitude || null,
      },
      price: hotel.rate_per_night?.lowest
        ? parseFloat(hotel.rate_per_night.lowest.replace(/[^0-9.]/g, ''))
        : null,
      currency: 'EUR',
      url: hotel.link || `https://www.google.com/travel/hotels/entity/${hotel.property_token}`,
    }))

    const byDistance = await filterByDistance(results, filters, destination)
    return filterByPrice(byDistance, filters.min_hotel, filters.max_hotel)
  } catch (err) {
    console.error('SerpAPI hotels error:', err.message)
    return []
  }
}

module.exports = { scrapeHotels }
