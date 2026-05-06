const { filterByDistance } = require('./geo')
const { filterByPrice } = require('./postFilters')

// Scrape Expedia — vols et hôtels
async function scrapeExpediaFlights(context, { origin, destination, start_date }) {
  const page = await context.newPage()
  const results = []

  try {
    const url = `https://www.expedia.fr/Flights-Search?trip=oneway&leg1=from:${encodeURIComponent(origin)},to:${encodeURIComponent(destination)},departure:${start_date}TANYT&passengers=adults:1&mode=search`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    // Fermer popup consentement
    const acceptBtn = await page.$('#onetrust-accept-btn-handler, [data-stid="accept-button"]')
    if (acceptBtn) await acceptBtn.click().catch(() => {})
    await page.waitForTimeout(1000)

    await page.waitForSelector('[data-test-id="offer-listing"], [class*="uitk-card"]', { timeout: 10000 }).catch(() => {})

    const flightCards = await page.$$('[data-test-id="offer-listing"]')
    const maxResults = Math.min(flightCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = flightCards[i]
      try {
        const carrier = await card.$eval('[data-test-id="carrier-name"], [class*="carrier"]', el => el.textContent.trim()).catch(() => 'Compagnie inconnue')
        const depTime = await card.$eval('[data-test-id="departure-time"]', el => el.textContent.trim()).catch(() => null)
        const arrTime = await card.$eval('[data-test-id="arrival-time"]', el => el.textContent.trim()).catch(() => null)
        const duration = await card.$eval('[data-test-id="journey-duration"]', el => el.textContent.trim()).catch(() => null)
        const priceText = await card.$eval('[data-test-id="price-summary"] span', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null

        results.push({
          type: 'flight',
          provider: carrier,
          source: 'expedia',
          details: {
            departure_city: origin,
            arrival_city: destination,
            departure_time: depTime,
            arrival_time: arrTime,
            duration,
          },
          price: priceNum,
          currency: 'EUR',
          url,
        })
      } catch (_) {}
    }
  } finally {
    await page.close()
  }

  return results
}

async function scrapeExpediaHotels(context, { destination, start_date, end_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const checkout = end_date || start_date
    const url = `https://www.expedia.fr/Hotel-Search?destination=${encodeURIComponent(destination)}&startDate=${start_date}&endDate=${checkout}&rooms=1&adults=1`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    const acceptBtn = await page.$('#onetrust-accept-btn-handler, [data-stid="accept-button"]')
    if (acceptBtn) await acceptBtn.click().catch(() => {})
    await page.waitForTimeout(1000)

    await page.waitForSelector('[data-stid="property-listing"], [class*="uitk-card"]', { timeout: 10000 }).catch(() => {})

    const hotelCards = await page.$$('[data-stid="property-listing"]')
    const maxResults = Math.min(hotelCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = hotelCards[i]
      try {
        const name = await card.$eval('[data-stid="content-hotel-title"]', el => el.textContent.trim()).catch(() => 'Hôtel')
        const address = await card.$eval('[data-stid="content-hotel-address"]', el => el.textContent.trim()).catch(() => destination)
        const priceText = await card.$eval('[data-stid="price-summary-message-double"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null
        const link = await card.$eval('a[data-stid="open-hotel-information"]', el => el.href).catch(() => url)

        results.push({
          type: 'hotel',
          provider: name,
          source: 'expedia',
          details: {
            name,
            address,
            check_in: start_date,
            check_out: checkout,
          },
          price: priceNum,
          currency: 'EUR',
          url: link,
        })
      } catch (_) {}
    }

    const byDistance = await filterByDistance(results, filters, destination)
    return filterByPrice(byDistance, filters.min_hotel, filters.max_hotel)
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeExpediaFlights, scrapeExpediaHotels }
