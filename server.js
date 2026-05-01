const express = require('express')
const { chromium } = require('playwright')
const { scrapeFlights } = require('./scrapers/flights')
const { scrapeTrains } = require('./scrapers/trains')
const { scrapeHotels } = require('./scrapers/hotels')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3100

app.get('/health', (_, res) => res.json({ ok: true }))

app.post('/search', async (req, res) => {
  const { booking_id, origin, destination, start_date, end_date, preferences } = req.body

  if (!origin || !destination || !start_date) {
    return res.status(400).json({ error: 'origin, destination et start_date sont requis' })
  }

  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const context = await browser.newContext({
      locale: 'fr-FR',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    })

    // Lancer les scrapers en parallèle
    const [flights, trains, hotels] = await Promise.allSettled([
      scrapeFlights(context, { origin, destination, start_date, end_date }),
      scrapeTrains(context, { origin, destination, start_date, end_date }),
      scrapeHotels(context, { destination, start_date, end_date, preferences }),
    ])

    const options = [
      ...(flights.status === 'fulfilled' ? flights.value : []),
      ...(trains.status === 'fulfilled' ? trains.value : []),
      ...(hotels.status === 'fulfilled' ? hotels.value : []),
    ]

    res.json({ ok: true, booking_id, options })
  } catch (err) {
    console.error('Scraping error:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    if (browser) await browser.close()
  }
})

app.listen(PORT, () => console.log(`MODA Scraper running on port ${PORT}`))
