const { filterByDistance } = require('./geo')
const { filterByPrice } = require('./postFilters')

// Scrape Hotels.com pour 3 options d'hôtels
async function scrapeHotelsCom(context, { destination, start_date, end_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const checkin = start_date
    const checkout = end_date || start_date

    const url = `https://fr.hotels.com/search.do?q-destination=${encodeURIComponent(destination)}&q-check-in=${checkin}&q-check-out=${checkout}&q-rooms=1&q-room-0-adults=1`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    const acceptBtn = await page.$('button[data-stid="accept-button"], #onetrust-accept-btn-handler')
    if (acceptBtn) await acceptBtn.click().catch(() => {})
    await page.waitForTimeout(1000)

    const hotelCards = await page.$$('[data-stid="property-listing"], [data-stid="lodging-card-responsive"]')
    const maxResults = Math.min(hotelCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = hotelCards[i]
      try {
        const name = await card.$eval('h3, [data-stid="content-hotel-title"]', el => el.textContent.trim()).catch(() => 'Hôtel')
        const address = await card.$eval('[data-stid="content-hotel-address"], .uitk-text-spacing-two', el => el.textContent.trim()).catch(() => destination)
        const priceText = await card.$eval('[data-stid="price-summary-message-double"], .uitk-type-700', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null
        const ratingText = await card.$eval('[data-stid="content-hotel-reviews-summary"] span', el => el.textContent.trim()).catch(() => null)
        const link = await card.$eval('a[data-stid="open-hotel-information"]', el => el.href).catch(() => url)

        results.push({
          type: 'hotel',
          provider: name,
          source: 'hotels.com',
          details: { name, address, rating: ratingText, check_in: checkin, check_out: checkout },
          price: priceNum,
          currency: 'EUR',
          url: link,
        })
      } catch (_) {}
    }

    if (results.length === 0) {
      const altCards = await page.$$('.uitk-card, [class*="PropertyCard"]')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const text = await altCards[i].textContent().catch(() => '')
        if (text) {
          results.push({
            type: 'hotel',
            provider: 'Hôtel disponible',
            source: 'hotels.com',
            details: { destination, raw: text.trim().slice(0, 200), check_in: checkin, check_out: checkout },
            price: null,
            currency: 'EUR',
            url,
          })
        }
      }
    }

    const byDistance = await filterByDistance(results, filters, destination)
    return filterByPrice(byDistance, filters.min_hotel, filters.max_hotel)
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeHotelsCom }
