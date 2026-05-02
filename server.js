const express = require('express')
const { chromium } = require('playwright')
const { scrapeFlights } = require('./scrapers/flights')
const { scrapeTrains } = require('./scrapers/trains')
const { scrapeHotels } = require('./scrapers/hotels')
const { scrapeKayak } = require('./scrapers/kayak')
const { scrapeTrainline } = require('./scrapers/trainline')
const { scrapeHotelsCom } = require('./scrapers/hotels_com')
const { scrapeSnapcar } = require('./scrapers/snapcar')
const { scrapeSkyscanner } = require('./scrapers/skyscanner')
const { scrapeOuigo } = require('./scrapers/ouigo')
const { scrapeEurostar } = require('./scrapers/eurostar')
const { scrapeExpediaFlights, scrapeExpediaHotels } = require('./scrapers/expedia')
const { scrapeTreenitalia } = require('./scrapers/trenitalia')
const { scrapeMrMrsSmith } = require('./scrapers/mrandmrssmith')
const { scrapeAirbnb } = require('./scrapers/airbnb')
const { scrapeMomondo } = require('./scrapers/momondo')
const { scrapeBlacklane } = require('./scrapers/blacklane')
const { scrapeUber } = require('./scrapers/uber')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3100

app.get('/health', (_, res) => res.json({ ok: true }))

app.post('/search', async (req, res) => {
  const { booking_id, origin, destination, start_date, end_date, preferences, travel_constraints } = req.body

  if (!origin || !destination || !start_date) {
    return res.status(400).json({ error: 'origin, destination et start_date sont requis' })
  }

  const filters = {
    cabin_class: preferences?.cabin_class || null,
    excluded_airlines: preferences?.excluded_airlines || [],
    direct_only: travel_constraints?.direct_only || false,
    max_flight: travel_constraints?.budget?.flight?.max || null,
    max_train: travel_constraints?.budget?.train?.max || null,
    max_hotel: travel_constraints?.budget?.hotel?.max || null,
    max_chauffeur: travel_constraints?.budget?.chauffeur?.max || null,
    arrival_before: travel_constraints?.arrival_before || null,
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

    // Lancer tous les scrapers en parallèle
    const [
      flights, kayak, skyscanner, expediaFlights, momondo,
      trains, trainline, ouigo, eurostar, trenitalia,
      hotels, hotelsCom, expediaHotels, mrMrsSmith, airbnb,
      snapcar, blacklane, uber,
    ] = await Promise.allSettled([
      scrapeFlights(context, { origin, destination, start_date, end_date, filters }),
      scrapeKayak(context, { origin, destination, start_date, filters }),
      scrapeSkyscanner(context, { origin, destination, start_date, filters }),
      scrapeExpediaFlights(context, { origin, destination, start_date, filters }),
      scrapeMomondo(context, { origin, destination, start_date, filters }),
      scrapeTrains(context, { origin, destination, start_date, end_date, filters }),
      scrapeTrainline(context, { origin, destination, start_date, filters }),
      scrapeOuigo(context, { origin, destination, start_date, filters }),
      scrapeEurostar(context, { origin, destination, start_date, filters }),
      scrapeTreenitalia(context, { origin, destination, start_date, filters }),
      scrapeHotels(context, { destination, start_date, end_date, filters }),
      scrapeHotelsCom(context, { destination, start_date, end_date, filters }),
      scrapeExpediaHotels(context, { destination, start_date, end_date, filters }),
      scrapeMrMrsSmith(context, { destination, start_date, end_date, filters }),
      scrapeAirbnb(context, { destination, start_date, end_date, filters }),
      scrapeSnapcar(context, { origin, destination, start_date, filters }),
      scrapeBlacklane(context, { origin, destination, start_date, filters }),
      scrapeUber(context, { origin, destination, start_date, filters }),
    ])

    const options = [
      ...(flights.status === 'fulfilled' ? flights.value : []),
      ...(kayak.status === 'fulfilled' ? kayak.value : []),
      ...(skyscanner.status === 'fulfilled' ? skyscanner.value : []),
      ...(expediaFlights.status === 'fulfilled' ? expediaFlights.value : []),
      ...(momondo.status === 'fulfilled' ? momondo.value : []),
      ...(trains.status === 'fulfilled' ? trains.value : []),
      ...(trainline.status === 'fulfilled' ? trainline.value : []),
      ...(ouigo.status === 'fulfilled' ? ouigo.value : []),
      ...(eurostar.status === 'fulfilled' ? eurostar.value : []),
      ...(trenitalia.status === 'fulfilled' ? trenitalia.value : []),
      ...(hotels.status === 'fulfilled' ? hotels.value : []),
      ...(hotelsCom.status === 'fulfilled' ? hotelsCom.value : []),
      ...(expediaHotels.status === 'fulfilled' ? expediaHotels.value : []),
      ...(mrMrsSmith.status === 'fulfilled' ? mrMrsSmith.value : []),
      ...(airbnb.status === 'fulfilled' ? airbnb.value : []),
      ...(snapcar.status === 'fulfilled' ? snapcar.value : []),
      ...(blacklane.status === 'fulfilled' ? blacklane.value : []),
      ...(uber.status === 'fulfilled' ? uber.value : []),
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
