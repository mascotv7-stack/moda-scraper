const { applyTransportFilters } = require('./postFilters')

// Scrape Skyscanner pour 3 options de vols
async function scrapeSkyscanner(context, { origin, destination, start_date, end_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const date = start_date.replace(/-/g, '').slice(2)
    const cabinMap = { economy: 'economy', business: 'business', first: 'first' }
    const cabinParam = filters.cabin_class ? `?cabinclass=${cabinMap[filters.cabin_class] || 'economy'}` : ''
    const directParam = filters.direct_only ? (cabinParam ? '&stops=direct' : '?stops=direct') : ''

    const route = filters.round_trip && end_date
      ? `${encodeURIComponent(origin.toLowerCase())}/${encodeURIComponent(destination.toLowerCase())}/${date}/${end_date.replace(/-/g, '').slice(2)}`
      : `${encodeURIComponent(origin.toLowerCase())}/${encodeURIComponent(destination.toLowerCase())}/${date}`

    const url = `https://www.skyscanner.fr/transport/vols/${route}/${cabinParam}${directParam}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(5000)

    const closeBtn = await page.$('[class*="BpkModal_close"], [aria-label="Fermer"]')
    if (closeBtn) await closeBtn.click().catch(() => {})
    await page.waitForTimeout(1000)

    await page.waitForSelector('[class*="FlightsResults"], [class*="flight-result"], [class*="BpkCard"]', { timeout: 10000 }).catch(() => {})

    const flightCards = await page.$$('[class*="FlightsTicket"], [class*="ResultsItem"], [class*="BpkCard-module"]')
    const maxResults = Math.min(flightCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = flightCards[i]
      try {
        const carrier = await card.$eval('[class*="LogoImage"], [class*="CarrierLogo"] img', el => el.alt || el.title || 'Compagnie').catch(() => 'Compagnie inconnue')
        const depTime = await card.$eval('[class*="departure-time"], [class*="LegInfo_routePartialTime"]', el => el.textContent.trim()).catch(() => null)
        const arrTime = await card.$eval('[class*="arrival-time"], [class*="LegInfo_routePartialTime"]:last-child', el => el.textContent.trim()).catch(() => null)
        const duration = await card.$eval('[class*="duration"], [class*="LegInfo_stopsContainer"]', el => el.textContent.trim()).catch(() => null)
        const priceText = await card.$eval('[class*="Price_mainPriceContainer"], [class*="price"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null

        results.push({
          type: 'flight',
          provider: carrier,
          source: 'skyscanner',
          details: { departure_city: origin, arrival_city: destination, departure_time: depTime, arrival_time: arrTime, duration },
          price: priceNum,
          currency: 'EUR',
          url,
        })
      } catch (_) {}
    }

    if (results.length === 0) {
      const altCards = await page.$$('[class*="ticket"], [class*="Ticket"]')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const text = await altCards[i].textContent().catch(() => '')
        if (text && text.trim().length > 20) results.push({ type: 'flight', provider: 'Vol disponible', source: 'skyscanner', details: { departure_city: origin, arrival_city: destination, raw: text.trim().slice(0, 200) }, price: null, currency: 'EUR', url })
      }
    }

    return applyTransportFilters(results, filters, { minKey: 'min_flight', maxKey: 'max_flight' })
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeSkyscanner }
