const { applyTransportFilters, sortByPreferredAirlines } = require('./postFilters')

const DUFFEL_BASE = 'https://api.duffel.com'

const CABIN_MAP = {
  economy: 'economy',
  premium_economy: 'premium_economy',
  business: 'business',
  first: 'first',
}

function formatDuration(isoDuration) {
  // PT2H35M → "2h35m"
  const match = isoDuration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return isoDuration
  const h = match[1] ? `${match[1]}h` : ''
  const m = match[2] ? `${match[2]}m` : ''
  return h + m
}

async function cityToIata(city) {
  const res = await fetch(
    `${DUFFEL_BASE}/places/suggestions?query=${encodeURIComponent(city)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
        'Duffel-Version': 'v2',
        Accept: 'application/json',
      },
    }
  )
  if (!res.ok) return null
  const data = await res.json()
  const place = data.data?.find((p) => p.type === 'airport' || p.type === 'city')
  return place?.iata_code || null
}

async function scrapeFlights(_ctx, { origin, destination, start_date, end_date, filters = {} }) {
  if (!process.env.DUFFEL_API_KEY) {
    console.warn('DUFFEL_API_KEY manquant — vols ignorés')
    return []
  }

  try {
    const [originCode, destCode] = await Promise.all([
      cityToIata(origin),
      cityToIata(destination),
    ])

    if (!originCode || !destCode) {
      console.warn(`Codes IATA introuvables : ${origin} / ${destination}`)
      return []
    }

    const slices = [
      { origin: originCode, destination: destCode, departure_date: start_date },
    ]
    if (filters.round_trip && end_date) {
      slices.push({ origin: destCode, destination: originCode, departure_date: end_date })
    }

    const body = {
      data: {
        slices,
        passengers: [{ type: 'adult' }],
        cabin_class: CABIN_MAP[filters.cabin_class] || 'economy',
        ...(filters.direct_only && { max_connections: 0 }),
      },
    }

    const offerReqRes = await fetch(`${DUFFEL_BASE}/air/offer_requests?return_offers=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!offerReqRes.ok) {
      const err = await offerReqRes.text()
      console.warn(`Duffel offer request ${offerReqRes.status}: ${err.slice(0, 200)}`)
      return []
    }

    const offerData = await offerReqRes.json()
    const offers = (offerData.data?.offers || []).slice(0, 10)

    const results = offers.map((offer) => {
      const slice = offer.slices[0]
      const firstSeg = slice.segments[0]
      const lastSeg = slice.segments[slice.segments.length - 1]

      return {
        type: 'flight',
        provider: firstSeg.marketing_carrier?.name || firstSeg.operating_carrier?.name || 'Compagnie inconnue',
        source: 'duffel',
        details: {
          departure_city: origin,
          arrival_city: destination,
          departure_time: firstSeg.departing_at,
          arrival_time: lastSeg.arriving_at,
          duration: formatDuration(slice.duration),
          flight_number: `${firstSeg.marketing_carrier?.iata_code}${firstSeg.marketing_carrier_flight_number}`,
          stops: slice.segments.length - 1,
          cabin: CABIN_MAP[filters.cabin_class] || 'economy',
        },
        price: parseFloat(offer.total_amount),
        currency: offer.total_currency,
        url: `https://duffel.com`,
      }
    })

    const filtered = applyTransportFilters(results, filters, { minKey: 'min_flight', maxKey: 'max_flight' })
    return sortByPreferredAirlines(filtered, filters.preferred_airlines)
  } catch (err) {
    console.error('Duffel flights error:', err.message)
    return []
  }
}

module.exports = { scrapeFlights }
