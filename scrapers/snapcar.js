// Snapcar — génère un lien de réservation pré-rempli (pas de page de résultats scrapable)
async function scrapeSnapcar(context, { origin, destination, start_date }) {
  const page = await context.newPage()
  const results = []

  try {
    const url = `https://www.snapcar.com/fr/reserver`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Récupérer les catégories de véhicules disponibles si présentes
    const vehicleCards = await page.$$('[class*="vehicle-category"], [class*="VehicleCard"], [class*="car-class"]')
    const maxResults = Math.min(vehicleCards.length, 3)

    for (let i = 0; i < maxResults; i++) {
      const card = vehicleCards[i]
      try {
        const name = await card.$eval('h3, h4, [class*="name"], [class*="title"]', el => el.textContent.trim()).catch(() => null)
        const priceText = await card.$eval('[class*="price"], [class*="tarif"]', el => el.textContent.trim()).catch(() => null)
        const priceNum = priceText ? parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.')) : null

        if (name) {
          results.push({
            type: 'chauffeur',
            provider: `Snapcar — ${name}`,
            source: 'snapcar',
            details: {
              pickup: origin,
              dropoff: destination,
              date: start_date,
              vehicle_class: name,
            },
            price: priceNum,
            currency: 'EUR',
            url,
          })
        }
      } catch (_) {}
    }

    // Fallback : retourner un lien de réservation direct si pas de résultats parsés
    if (results.length === 0) {
      results.push({
        type: 'chauffeur',
        provider: 'Snapcar',
        source: 'snapcar',
        details: {
          pickup: origin,
          dropoff: destination,
          date: start_date,
          note: 'Devis disponible sur le site',
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

module.exports = { scrapeSnapcar }
