const { applyTransportFilters } = require('./postFilters')

// Scrape Google Flights pour 3 options de vols
async function scrapeFlights(context, { origin, destination, start_date, end_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const from = encodeURIComponent(origin)
    const to = encodeURIComponent(destination)

    const cabinMap = { economy: 1, premium_economy: 2, business: 3, first: 4 }
    const cabinParam = filters.cabin_class ? `&tfs=${cabinMap[filters.cabin_class] || 1}` : ''
    const directParam = filters.direct_only ? '&stops=1' : ''
    const tripType = filters.round_trip && end_date ? `Flights+from+${from}+to+${to}+on+${start_date}+return+${end_date}` : `Flights+from+${from}+to+${to}+on+${start_date}`

    const url = `https://www.google.com/travel/flights?q=${tripType}${cabinParam}${directParam}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    const flightCards = await page.$$('div[jsname="IWWDBc"], li[jsname="IWWDBc"]')
    const maxResults = Math.min(flightCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = flightCards[i]
      try {
        const carrier = await card.$eval('[data-gs]', el => el.textContent.trim()).catch(() => 'Compagnie inconnue')
        const departure = await card.$eval('span[aria-label*="Départ"]', el => el.textContent.trim()).catch(() => null)
        const arrival = await card.$eval('span[aria-label*="Arrivée"]', el => el.textContent.trim()).catch(() => null)
        const duration = await card.$eval('div[aria-label*="durée"]', el => el.textContent.trim()).catch(() => null)
        const price = await card.$eval('span[data-gs]', el => el.textContent.trim()).catch(() => null)
        const priceNum = price ? parseFloat(price.replace(/[^0-9]/g, '')) : null

        results.push({
          type: 'flight',
          provider: carrier,
          details: { departure_city: origin, arrival_city: destination, departure_time: departure, arrival_time: arrival, duration },
          price: priceNum,
          currency: 'EUR',
          url,
        })
      } catch (_) {}
    }

    if (results.length === 0) {
      const altCards = await page.$$('.pIav2d')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const text = await altCards[i].textContent().catch(() => '')
        if (text) results.push({ type: 'flight', provider: 'Vol disponible', details: { departure_city: origin, arrival_city: destination, raw: text.trim().slice(0, 200) }, price: null, currency: 'EUR', url })
      }
    }

    return applyTransportFilters(results, filters, { minKey: 'min_flight', maxKey: 'max_flight' })
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeFlights }
