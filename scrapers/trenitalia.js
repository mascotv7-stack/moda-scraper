// Scrape Trenitalia pour 3 options de trains (Italie — essentiel pour Milan Fashion Week)
async function scrapeTreenitalia(context, { origin, destination, start_date }) {
  const page = await context.newPage()
  const results = []

  try {
    const dateObj = new Date(start_date)
    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()
    const formattedDate = `${day}/${month}/${year}`

    const url = `https://www.trenitalia.com/en/search-trains.html?fromStation=${encodeURIComponent(origin)}&toStation=${encodeURIComponent(destination)}&departureDate=${formattedDate}&adults=1`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    // Accepter cookies si présent
    const acceptBtn = await page.$('#onetrust-accept-btn-handler, [class*="accept-cookies"], button[id*="accept"]')
    if (acceptBtn) await acceptBtn.click().catch(() => {})
    await page.waitForTimeout(1500)

    await page.waitForSelector('[class*="solution-row"], [class*="SolutionCard"], [class*="train-solution"]', { timeout: 10000 }).catch(() => {})

    const trainCards = await page.$$('[class*="solution-row"], [class*="SolutionCard"], [class*="train-result"]')
    const maxResults = Math.min(trainCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = trainCards[i]
      try {
        const trainType = await card.$eval('[class*="train-name"], [class*="service-name"], [class*="trainType"]', el => el.textContent.trim()).catch(() => 'Trenitalia')
        const depTime = await card.$eval('[class*="departure-time"], [class*="departureTime"]', el => el.textContent.trim()).catch(() => null)
        const arrTime = await card.$eval('[class*="arrival-time"], [class*="arrivalTime"]', el => el.textContent.trim()).catch(() => null)
        const duration = await card.$eval('[class*="duration"], [class*="travelTime"]', el => el.textContent.trim()).catch(() => null)
        const priceText = await card.$eval('[class*="price"], [class*="Price"], [class*="amount"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.')) : null

        results.push({
          type: 'train',
          provider: trainType,
          source: 'trenitalia',
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
      results.push({
        type: 'train',
        provider: 'Trenitalia',
        source: 'trenitalia',
        details: {
          departure_city: origin,
          arrival_city: destination,
          note: 'Résultats disponibles sur le site',
        },
        price: null,
        currency: 'EUR',
        url,
      })
    }
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeTreenitalia }
