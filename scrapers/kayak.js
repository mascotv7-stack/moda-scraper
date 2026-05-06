const { applyTransportFilters } = require('./postFilters')

// Scrape Kayak pour 3 options de vols
async function scrapeKayak(context, { origin, destination, start_date, end_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const cabinMap = { economy: 'e', business: 'b', first: 'f' }
    const cabinParam = filters.cabin_class ? `;cabin=${cabinMap[filters.cabin_class] || 'e'}` : ''
    const directParam = filters.direct_only ? ';stops=0stop' : ''
    const priceParam = filters.max_flight ? `;price=-${filters.max_flight}` : ''

    const route = filters.round_trip && end_date
      ? `${encodeURIComponent(origin)}-${encodeURIComponent(destination)}/${start_date}/${end_date}`
      : `${encodeURIComponent(origin)}-${encodeURIComponent(destination)}/${start_date}`

    const url = `https://www.kayak.fr/vols/${route}?fs=${cabinParam}${directParam}${priceParam}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    await page.waitForSelector('.nrc6, [class*="resultWrapper"], [class*="FlightResult"]', { timeout: 10000 }).catch(() => {})

    const flightCards = await page.$$('.nrc6, [class*="resultWrapper"]')
    const maxResults = Math.min(flightCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = flightCards[i]
      try {
        const carrier = await card.$eval('[class*="codeshares-airline-names"], [class*="carrier-name"]', el => el.textContent.trim()).catch(() => 'Compagnie inconnue')
        const depTime = await card.$eval('[class*="depart-time"] span, [class*="departure"] span', el => el.textContent.trim()).catch(() => null)
        const arrTime = await card.$eval('[class*="arrival-time"] span, [class*="arrival"] span', el => el.textContent.trim()).catch(() => null)
        const duration = await card.$eval('[class*="duration-text"], [class*="duration"]', el => el.textContent.trim()).catch(() => null)
        const priceText = await card.$eval('[class*="price-text"], [class*="Price"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null

        results.push({
          type: 'flight',
          provider: carrier,
          source: 'kayak',
          details: { departure_city: origin, arrival_city: destination, departure_time: depTime, arrival_time: arrTime, duration },
          price: priceNum,
          currency: 'EUR',
          url,
        })
      } catch (_) {}
    }

    if (results.length === 0) {
      const altCards = await page.$$('[class*="Base-Results-HorizonResult"]')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const text = await altCards[i].textContent().catch(() => '')
        if (text) results.push({ type: 'flight', provider: 'Vol disponible', source: 'kayak', details: { departure_city: origin, arrival_city: destination, raw: text.trim().slice(0, 200) }, price: null, currency: 'EUR', url })
      }
    }

    return applyTransportFilters(results, filters, { minKey: 'min_flight', maxKey: 'max_flight' })
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeKayak }
