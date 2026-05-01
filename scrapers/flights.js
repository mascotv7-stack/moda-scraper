// Scrape Google Flights pour 3 options de vols
async function scrapeFlights(context, { origin, destination, start_date, end_date }) {
  const page = await context.newPage()
  const results = []

  try {
    // Encoder les paramètres pour Google Flights
    const from = encodeURIComponent(origin)
    const to = encodeURIComponent(destination)
    const date = start_date.replace(/-/g, '')

    const url = `https://www.google.com/travel/flights?q=Flights+from+${from}+to+${to}+on+${start_date}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Sélectionner les cartes de résultats de vols
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
          details: {
            departure_city: origin,
            arrival_city: destination,
            departure_time: departure,
            arrival_time: arrival,
            duration,
          },
          price: priceNum,
          currency: 'EUR',
          url,
        })
      } catch (_) {
        // Ignorer les cartes mal parsées
      }
    }

    // Si rien trouvé, essayer un sélecteur alternatif
    if (results.length === 0) {
      const altCards = await page.$$('.pIav2d')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const card = altCards[i]
        const text = await card.textContent().catch(() => '')
        if (text) {
          results.push({
            type: 'flight',
            provider: 'Vol disponible',
            details: { departure_city: origin, arrival_city: destination, raw: text.trim().slice(0, 200) },
            price: null,
            currency: 'EUR',
            url,
          })
        }
      }
    }
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeFlights }
