const { applyTransportFilters } = require('./postFilters')

const SNCF_BASE = 'https://api.sncf.com/v1/coverage/sncf'

function sncfHeaders() {
  const key = process.env.SNCF_API_KEY
  return {
    Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'),
    'Content-Type': 'application/json',
  }
}

async function cityToStationId(city) {
  const res = await fetch(
    `${SNCF_BASE}/places?q=${encodeURIComponent(city)}&type[]=stop_area&count=1`,
    { headers: sncfHeaders() }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.places?.[0]?.id || null
}

function formatSncfTime(dt) {
  // "20260510T083000" → "2026-05-10T08:30:00"
  if (!dt || dt.length < 15) return dt
  return `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(9, 11)}:${dt.slice(11, 13)}:${dt.slice(13, 15)}`
}

function formatDurationSec(seconds) {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h${String(m).padStart(2, '0')}m`
}

async function scrapeTrains(_ctx, { origin, destination, start_date, end_date, filters = {} }) {
  if (!process.env.SNCF_API_KEY) {
    console.warn('SNCF_API_KEY manquant — trains ignorés')
    return []
  }

  try {
    const [fromId, toId] = await Promise.all([
      cityToStationId(origin),
      cityToStationId(destination),
    ])

    if (!fromId || !toId) {
      console.warn(`Gares introuvables : ${origin} / ${destination}`)
      return []
    }

    const datetime = start_date.replace(/-/g, '') + 'T080000'
    const params = new URLSearchParams({
      from: fromId,
      to: toId,
      datetime,
      count: '8',
    })

    if (filters.direct_only) params.set('direct_path', 'only')
    if (filters.cabin_class === 'business') params.set('traveler_type', 'standard_holder')

    const res = await fetch(`${SNCF_BASE}/journeys?${params}`, {
      headers: sncfHeaders(),
    })

    if (!res.ok) {
      console.warn(`SNCF API ${res.status}`)
      return []
    }

    const data = await res.json()

    const results = (data.journeys || [])
      .filter((j) => j.status !== 'NO_SERVICE')
      .map((journey) => {
        const trainSection = journey.sections?.find(
          (s) => s.type === 'public_transport' && s.display_informations
        )
        const trainLabel = trainSection?.display_informations?.commercial_mode || 'Train'
        const trainNumber = trainSection?.display_informations?.headsign || null

        // Prix : disponible seulement si l'API le retourne
        const fareLinks = journey.fare?.links || []
        const priceLink = fareLinks.find((l) => l.rel === 'tickets')
        const priceNum = journey.fare?.total?.value
          ? parseFloat(journey.fare.total.value) / 100
          : null

        return {
          type: 'train',
          provider: trainLabel,
          source: 'sncf',
          details: {
            departure_city: origin,
            arrival_city: destination,
            departure_time: formatSncfTime(journey.departure_date_time),
            arrival_time: formatSncfTime(journey.arrival_date_time),
            duration: formatDurationSec(journey.duration),
            train_number: trainNumber,
            transfers: journey.nb_transfers ?? 0,
            ...(priceNum === null && { note: 'Prix disponible sur SNCF Connect' }),
          },
          price: priceNum,
          currency: 'EUR',
          url: `https://www.sncf-connect.com/app/home/shop/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}&date=${start_date}T08:00:00&passengers=1`,
        }
      })

    return applyTransportFilters(results, filters, { minKey: 'min_train', maxKey: 'max_train' })
  } catch (err) {
    console.error('SNCF trains error:', err.message)
    return []
  }
}

module.exports = { scrapeTrains }
