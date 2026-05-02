// Uber Black — flexibilité last-minute
// Site très protégé : génère des liens de réservation avec paramètres pré-remplis
async function scrapeUber(context, { origin, destination, start_date }) {
  const page = await context.newPage()
  const results = []

  try {
    // Uber Rides deep link avec pickup/dropoff
    const rideUrl = `https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=${encodeURIComponent(origin)}&dropoff[formatted_address]=${encodeURIComponent(destination)}`

    // Page produits Uber pour récupérer les catégories disponibles
    const url = `https://www.uber.com/fr/fr/ride/`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    const acceptBtn = await page.$('[data-testid="accept-cookies-button"], #onetrust-accept-btn-handler')
    if (acceptBtn) await acceptBtn.click().catch(() => {})
    await page.waitForTimeout(1000)

    const productCards = await page.$$('[class*="ProductCard"], [class*="product-card"], [class*="RideOption"]')
    const uberServices = ['Uber Black', 'Uber Black SUV', 'Uber Comfort']

    if (productCards.length > 0) {
      const maxResults = Math.min(productCards.length, 3)
      for (let i = 0; i < maxResults; i++) {
        const card = productCards[i]
        const name = await card.$eval('h3, h4, [class*="title"], [class*="name"]', el => el.textContent.trim()).catch(() => uberServices[i] || 'Uber Black')

        results.push({
          type: 'chauffeur',
          provider: name,
          source: 'uber',
          details: { pickup: origin, dropoff: destination, date: start_date, note: 'Prix en temps réel via l\'app' },
          price: null,
          currency: 'EUR',
          url: rideUrl,
        })
      }
    } else {
      // Fallback : services Uber Black standards
      for (const service of uberServices) {
        results.push({
          type: 'chauffeur',
          provider: service,
          source: 'uber',
          details: { pickup: origin, dropoff: destination, date: start_date, note: 'Prix en temps réel via l\'app' },
          price: null,
          currency: 'EUR',
          url: rideUrl,
        })
      }
    }
  } finally {
    await page.close()
  }

  return results
}

module.exports = { scrapeUber }
