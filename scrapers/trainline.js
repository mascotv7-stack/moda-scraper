// Scrape Trainline pour 3 options de trains (Europe)
async function scrapeTrainline(context, { origin, destination, start_date }) {
  const page = await context.newPage()
  const results = []

  try {
    const dateObj = new Date(start_date)
    const isoDate = `${start_date}T08:00:00`

    const url = `https://www.trainline.fr/search/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}?departure_at=${isoDate}&pax=1`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    // Attendre les résultats
    await page.waitForSelector('[data-testid="journey-result"], [class*="Journey"], article[class*="result"]', { timeout: 10000 }).catch(() => {})

    const trainCards = await page.$$('[data-testid="journey-result"], [class*="JourneyResult"], article[class*="result"]')
    const maxResults = Math.min(trainCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = trainCards[i]
      try {
        const depTime = await card.$eval('[data-testid="departure-time"], [class*="departure-time"]', el => el.textContent.trim()).catch(() => null)
        const arrTime = await card.$eval('[data-testid="arrival-time"], [class*="arrival-time"]', el => el.textContent.trim()).catch(() => null)
        const duration = await card.$eval('[data-testid="journey-duration"], [class*="duration"]', el => el.textContent.trim()).catch(() => null)
        const trainType = await card.$eval('[data-testid="transport-mode"], [class*="carrier"]', el => el.textContent.trim()).catch(() => 'Train')
        const priceText = await card.$eval('[data-testid="price"], [class*="Price"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.')) : null

        results.push({
          type: 'train',
          provider: trainType,
          source: 'trainline',
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
      const altCards = await page.$$('[class*="journey"], [class*="Journey"]')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const text = await altCards[i].textContent().catch(() => '')
        if (text && text.trim().length > 20) {
          results.push({
            type: 'train',
            provider: 'Train disponible',
            source: 'trainline',
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

module.exports = { scrapeTrainline }
