// Scrape Mr & Mrs Smith pour 3 hôtels boutique luxe
async function scrapeMrMrsSmith(context, { destination, start_date, end_date }) {
  const page = await context.newPage()
  const results = []

  try {
    const checkout = end_date || start_date
    const url = `https://www.mrandmrssmith.com/hotel-search?destination=${encodeURIComponent(destination)}&check-in=${start_date}&check-out=${checkout}&adults=1`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000)

    const acceptBtn = await page.$('[class*="accept"], [id*="accept"], button[data-testid="cookie-accept"]')
    if (acceptBtn) await acceptBtn.click().catch(() => {})
    await page.waitForTimeout(1000)

    await page.waitForSelector('[class*="PropertyCard"], [class*="hotel-card"], [class*="HotelCard"]', { timeout: 10000 }).catch(() => {})

    const hotelCards = await page.$$('[class*="PropertyCard"], [class*="hotel-card"], [class*="HotelCard"], article[class*="property"]')
    const maxResults = Math.min(hotelCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = hotelCards[i]
      try {
        const name = await card.$eval('h2, h3, [class*="hotel-name"], [class*="property-name"]', el => el.textContent.trim()).catch(() => 'Hôtel boutique')
        const location = await card.$eval('[class*="location"], [class*="destination"], [class*="address"]', el => el.textContent.trim()).catch(() => destination)
        const priceText = await card.$eval('[class*="price"], [class*="Price"], [class*="rate"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9]/g, '')) : null
        const link = await card.$eval('a', el => el.href).catch(() => url)

        results.push({
          type: 'hotel',
          provider: name,
          source: 'mrandmrssmith',
          details: {
            name,
            address: location,
            category: 'boutique-luxe',
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
      const altCards = await page.$$('[class*="card"], [class*="Card"]')
      const maxAlt = Math.min(altCards.length, 3)
      for (let i = 0; i < maxAlt; i++) {
        const text = await altCards[i].textContent().catch(() => '')
        if (text && text.trim().length > 20) {
          results.push({
            type: 'hotel',
            provider: 'Mr & Mrs Smith',
            source: 'mrandmrssmith',
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

module.exports = { scrapeMrMrsSmith }
