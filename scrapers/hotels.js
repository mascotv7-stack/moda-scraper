const { haversineKm, geocodeAddress, filterByDistance } = require('./geo')
const { filterByPrice } = require('./postFilters')

// Scrape Booking.com pour 3 options d'hôtels
async function scrapeHotels(context, { destination, start_date, end_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const checkin = start_date
    const checkout = end_date || start_date

    const priceParam = filters.max_hotel ? `&price_max=${filters.max_hotel}` : ''
    const starsParam = filters.hotel_stars_min ? `&class=${filters.hotel_stars_min}` : ''

    // Centrer la recherche sur le venue si les coordonnées sont disponibles
    const locationParam = filters.venue_lat && filters.venue_lon
      ? `latitude=${filters.venue_lat}&longitude=${filters.venue_lon}`
      : `ss=${encodeURIComponent(destination)}`

    const url = `https://www.booking.com/searchresults.fr.html?${locationParam}&checkin=${checkin}&checkout=${checkout}&group_adults=1&no_rooms=1&order=distance${priceParam}${starsParam}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Fermer le popup de consentement si présent
    const acceptBtn = await page.$('#onetrust-accept-btn-handler, button[id*="accept"]')
    if (acceptBtn) await acceptBtn.click().catch(() => {})
    await page.waitForTimeout(1000)

    // Sélectionner les cartes hôtels
    const hotelCards = await page.$$('[data-testid="property-card"], .sr_property_block')
    const maxResults = Math.min(hotelCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = hotelCards[i]
      try {
        const name = await card.$eval('[data-testid="title"], .sr-hotel__name', el => el.textContent.trim()).catch(() => 'Hôtel')
        const address = await card.$eval('[data-testid="address"], .bui-spacer--small', el => el.textContent.trim()).catch(() => destination)
        const starsEl = await card.$$('[data-testid="rating-stars"] span, .bui-rating__star')
        const stars = String(starsEl.length || 4)
        const priceText = await card.$eval('[data-testid="price-and-discounted-price"], .bui-price-display__value', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null
        const link = await card.$eval('a[data-testid="title-link"], a.hotel_name_link', el => el.href).catch(() => url)

        results.push({
          type: 'hotel',
          provider: name,
          details: {
            name,
            address,
            stars,
            check_in: checkin,
            check_out: checkout,
          },
          price: priceNum,
          currency: 'EUR',
          url: link,
        })
      } catch (_) {
        // Ignorer
      }
    }
    const byDistance = await filterByDistance(results, filters, destination)
    return filterByPrice(byDistance, filters.min_hotel, filters.max_hotel)
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeHotels }
