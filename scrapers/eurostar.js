// Scrape Eurostar pour 3 options (Paris ↔ Londres, Bruxelles, Amsterdam)
async function scrapeEurostar(context, { origin, destination, start_date }) {
  const page = await context.newPage()
  const results = []

  try {
    const url = `https://www.eurostar.com/fr-fr/train/recherche?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&outbound-date=${start_date}&adults=1`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    await page.waitForSelector('[class*="journey"], [class*="Journey"], [data-testid*="journey"]', { timeout: 10000 }).catch(() => {})

    const trainCards = await page.$$('[class*="JourneyCard"], [class*="journey-card"], [data-testid="journey-result"]')
    const maxResults = Math.min(trainCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = trainCards[i]
      try {
        const depTime = await card.$eval('[class*="departure-time"], [class*="DepartureTime"]', el => el.textContent.trim()).catch(() => null)
        const arrTime = await card.$eval('[class*="arrival-time"], [class*="ArrivalTime"]', el => el.textContent.trim()).catch(() => null)
        const duration = await card.$eval('[class*="duration"], [class*="Duration"]', el => el.textContent.trim()).catch(() => null)
        const priceText = await card.$eval('[class*="price"], [class*="Price"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.')) : null

        results.push({
          type: 'train',
          provider: 'Eurostar',
          source: 'eurostar',
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

    if (results.length === 0) {
      const altCards = await page.$$('[class*="result"], [class*="Result"]')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const text = await altCards[i].textContent().catch(() => '')
        if (text && text.trim().length > 20) {
          results.push({
            type: 'train',
            provider: 'Eurostar',
            source: 'eurostar',
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

module.exports = { scrapeEurostar }
