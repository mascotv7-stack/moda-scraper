const { filterByPrice } = require('./postFilters')

// Blacklane — chauffeur luxe standard dans l'industrie mode
async function scrapeBlacklane(context, { origin, destination, start_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const url = `https://www.blacklane.com/fr/`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    const vehicleCards = await page.$$('[class*="vehicle"], [class*="Vehicle"], [class*="car-class"], [class*="CarClass"]')
    const vehicleClasses = ['Business Class', 'First Class', 'Van/SUV']

    if (vehicleCards.length > 0) {
      const maxResults = Math.min(vehicleCards.length, 3)
      for (let i = 0; i < maxResults; i++) {
        const card = vehicleCards[i]
        const name = await card.$eval('h3, h4, [class*="name"], [class*="title"]', el => el.textContent.trim()).catch(() => vehicleClasses[i] || 'Business Class')
        const priceText = await card.$eval('[class*="price"], [class*="from"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null
        results.push({ type: 'chauffeur', provider: `Blacklane — ${name}`, source: 'blacklane', details: { pickup: origin, dropoff: destination, date: start_date, arrival_before: filters.arrival_before || null, vehicle_class: name }, price: priceNum, currency: 'EUR', url })
      }
    } else {
      for (const vehicleClass of vehicleClasses) {
        results.push({ type: 'chauffeur', provider: `Blacklane — ${vehicleClass}`, source: 'blacklane', details: { pickup: origin, dropoff: destination, date: start_date, arrival_before: filters.arrival_before || null, vehicle_class: vehicleClass, note: 'Devis sur le site' }, price: null, currency: 'EUR', url })
      }
    }

    return filterByPrice(results, filters.min_chauffeur, filters.max_chauffeur)
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeBlacklane }
