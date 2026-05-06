// Filtre les résultats par fourchette de prix
function filterByPrice(results, min, max) {
  return results.filter((r) => {
    if (r.price == null) return true
    if (min != null && r.price < min) return false
    if (max != null && r.price > max) return false
    return true
  })
}

// Filtre les résultats dont l'heure d'arrivée dépasse arrival_before (format "HH:MM")
function filterByArrival(results, arrivalBefore) {
  if (!arrivalBefore) return results
  return results.filter((r) => {
    const raw = r.details?.arrival_time
    if (!raw) return true
    const match = raw.match(/(\d{1,2}):(\d{2})/)
    if (!match) return true
    const [, h, m] = match
    const [limitH, limitM] = arrivalBefore.split(':').map(Number)
    return parseInt(h) * 60 + parseInt(m) <= limitH * 60 + limitM
  })
}

// Filtre les compagnies exclues (vols)
function filterByAirlines(results, excludedAirlines) {
  if (!excludedAirlines || excludedAirlines.length === 0) return results
  const excluded = excludedAirlines.map((a) => a.toLowerCase())
  return results.filter((r) => {
    const provider = (r.provider || '').toLowerCase()
    return !excluded.some((e) => provider.includes(e))
  })
}

// Applique tous les filtres transport (vols + trains)
function applyTransportFilters(results, filters, { minKey, maxKey } = {}) {
  let out = results
  if (minKey || maxKey) out = filterByPrice(out, filters[minKey] ?? null, filters[maxKey] ?? null)
  out = filterByArrival(out, filters.arrival_before)
  if (filters.excluded_airlines) out = filterByAirlines(out, filters.excluded_airlines)
  return out
}

module.exports = { filterByPrice, filterByArrival, filterByAirlines, applyTransportFilters }
