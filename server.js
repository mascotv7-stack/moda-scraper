const express = require('express')
const { scrapeFlights } = require('./scrapers/flights')
const { scrapeTrains } = require('./scrapers/trains')
const { scrapeHotels } = require('./scrapers/hotels')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3100

app.get('/health', (_, res) => res.json({ ok: true, apis: {
  flights: !!process.env.DUFFEL_API_KEY,
  trains: !!process.env.SNCF_API_KEY,
  hotels: !!process.env.LITEAPI_KEY,
}}))

async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'MODA-OS/1.0' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    return null
  } catch {
    return null
  }
}

app.post('/search', async (req, res) => {
  const {
    booking_id,
    origin,
    destination,
    venue_address,
    start_date,
    end_date,
    preferences,
    travel_constraints,
  } = req.body

  if (!origin || !destination || !start_date) {
    return res.status(400).json({ error: 'origin, destination et start_date sont requis' })
  }

  const maxHotelDistanceKm = travel_constraints?.max_hotel_distance_km || null
  let venueCoords = null
  if (venue_address && maxHotelDistanceKm) {
    venueCoords = await geocodeAddress(venue_address)
  }

  const filters = {
    cabin_class:           travel_constraints?.cabin_class || preferences?.cabin_class || null,
    excluded_airlines:     preferences?.excluded_airlines || [],
    preferred_airlines:    travel_constraints?.preferred_airlines || preferences?.preferred_airlines || [],
    hotel_stars_min:       preferences?.hotel_stars_min || null,
    direct_only:           travel_constraints?.direct_only || false,
    round_trip:            travel_constraints?.round_trip || false,
    arrival_before:        travel_constraints?.arrival_before || null,
    min_flight:            travel_constraints?.budget?.flight?.min || null,
    max_flight:            travel_constraints?.budget?.flight?.max || null,
    min_train:             travel_constraints?.budget?.train?.min || null,
    max_train:             travel_constraints?.budget?.train?.max || null,
    min_hotel:             travel_constraints?.budget?.hotel?.min || null,
    max_hotel:             travel_constraints?.budget?.hotel?.max || null,
    max_hotel_distance_km: maxHotelDistanceKm,
    venue_lat:             venueCoords?.lat || null,
    venue_lon:             venueCoords?.lon || null,
    hotel_amenities:       travel_constraints?.hotel_amenities || [],
    bed_type:              travel_constraints?.bed_type || null,
    non_smoking:           travel_constraints?.non_smoking || false,
    occupants_per_room:    travel_constraints?.occupants_per_room || null,
    rooms_needed:          travel_constraints?.rooms_needed || null,
    bathrooms_min:         travel_constraints?.bathrooms_min || null,
    kitchen_required:      travel_constraints?.kitchen_required || false,
  }

  try {
    const [flights, trains, hotels] = await Promise.allSettled([
      scrapeFlights(null, { origin, destination, start_date, end_date, filters }),
      scrapeTrains(null, { origin, destination, start_date, end_date, filters }),
      scrapeHotels(null, { destination, start_date, end_date, filters }),
    ])

    const options = [
      ...(flights.status === 'fulfilled' ? flights.value : []),
      ...(trains.status === 'fulfilled' ? trains.value : []),
      ...(hotels.status === 'fulfilled' ? hotels.value : []),
    ]

    res.json({ ok: true, booking_id, options })
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => console.log(`MODA Scraper running on port ${PORT}`))
