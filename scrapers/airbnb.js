// Scrape Airbnb pour 3 logements (Fashion Month — séjours longue durée)
async function scrapeAirbnb(context, { destination, start_date, end_date, filters = {} }) {
  const page = await context.newPage()
  const results = []

  try {
    const checkout = end_date || start_date
    const priceMax = filters.max_hotel || 500
    const url = `https://www.airbnb.fr/s/${encodeURIComponent(destination)}/homes?checkin=${start_date}&checkout=${checkout}&adults=1&price_max=${priceMax}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(5000)

    // Fermer popup cookies/géolocalisation
    const closeBtn = await page.$('[data-testid="modal-close-btn"], [aria-label="Fermer"], button[aria-label="Close"]')
    if (closeBtn) await closeBtn.click().catch(() => {})
    await page.waitForTimeout(1000)

    await page.waitForSelector('[data-testid="card-container"], [itemprop="itemListElement"]', { timeout: 10000 }).catch(() => {})

    const listingCards = await page.$$('[data-testid="card-container"]')
    const maxResults = Math.min(listingCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = listingCards[i]
      try {
        const name = await card.$eval('[data-testid="listing-card-title"], [class*="t1jojoys"]', el => el.textContent.trim()).catch(() => 'Logement')
        const type = await card.$eval('[data-testid="listing-card-subtitle"], [class*="s1cjsi4j"]', el => el.textContent.trim()).catch(() => 'Appartement')
        const priceText = await card.$eval('[data-testid="price-availability-row"] span, [class*="_1y74zjx"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null
        const ratingText = await card.$eval('[aria-label*="étoile"], [class*="ru0q88m"]', el => el.textContent.trim()).catch(() => null)
        const link = await card.$eval('a', el => el.href).catch(() => url)

        results.push({
          type: 'hotel',
          provider: name,
          source: 'airbnb',
          details: {
            name,
            type,
            rating: ratingText,
            check_in: start_date,
            check_out: checkout,
          },
          price: priceNum,
          currency: 'EUR',
          url: link,
        })
      } catch (_) {}
    }

    if (results.length === 0) {
      const altCards = await page.$$('[class*="atm_9s_1txwivl"], [class*="c4mnd7m"]')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const text = await altCards[i].textContent().catch(() => '')
        if (text && text.trim().length > 20) {
          results.push({
            type: 'hotel',
            provider: 'Airbnb',
            source: 'airbnb',
            details: { destination, raw: text.trim().slice(0, 200), check_in: start_date, check_out: checkout },
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

module.exports = { scrapeAirbnb }
