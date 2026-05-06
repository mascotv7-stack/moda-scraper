const { applyTransportFilters } = require('./postFilters')

// Scrape SNCF Connect pour 3 options de trains
async function scrapeTrains(context, { origin, destination, start_date, end_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const dateObj = new Date(start_date)
    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()

    const classParam = filters.cabin_class === 'business' ? '&travelClass=FIRST' : '&travelClass=SECOND'
    const directParam = filters.direct_only ? '&directTrains=true' : ''
    const roundTripParam = filters.round_trip && end_date ? `&returnDate=${end_date}T08:00:00` : ''

    const url = `https://www.sncf-connect.com/app/home/shop/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}&date=${year}-${month}-${day}T08:00:00&passengers=1${classParam}${directParam}${roundTripParam}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    const trainCards = await page.$$('[data-testid="proposal-card"], .proposal-card, article[class*="proposal"]')
    const maxResults = Math.min(trainCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = trainCards[i]
      try {
        const depTime = await card.$eval('[data-testid="departure-time"], .departure-time', el => el.textContent.trim()).catch(() => null)
        const arrTime = await card.$eval('[data-testid="arrival-time"], .arrival-time', el => el.textContent.trim()).catch(() => null)
        const duration = await card.$eval('[data-testid="duration"], .duration', el => el.textContent.trim()).catch(() => null)
        const priceText = await card.$eval('[data-testid="price"], .price', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.')) : null
        const trainType = await card.$eval('[data-testid="train-label"], .train-label', el => el.textContent.trim()).catch(() => 'TGV INOUI')

        results.push({
          type: 'train',
          provider: trainType,
          details: { departure_city: origin, arrival_city: destination, departure_time: depTime, arrival_time: arrTime, duration },
          price: priceNum,
          currency: 'EUR',
          url,
        })
      } catch (_) {}
    }

    return applyTransportFilters(results, filters, { minKey: 'min_train', maxKey: 'max_train' })
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeTrains }
