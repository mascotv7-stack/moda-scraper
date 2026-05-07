// Filtre les résultats par fourchette de prix
// Fallback : si tout est filtré, retourne les originaux avec out_of_budget: true
function filterByPrice(results, min, max) {
  if (min == null && max == null) return results
  const filtered = results.filter((r) => {
    if (r.price == null) return true
    if (min != null && r.price < min) return false
    if (max != null && r.price > max) return false
    return true
  })
  if (filtered.length === 0 && results.length > 0) {
    return results.map(r => ({ ...r, details: { ...(r.details || {}), out_of_budget: true } }))
  }
  return filtered
}

// Filtre les résultats dont l'heure d'arrivée dépasse arrival_before (format "HH:MM")
// Fallback : si tout est filtré, retourne les originaux avec arrives_late: true
function filterByArrival(results, arrivalBefore) {
  if (!arrivalBefore) return results
  const filtered = results.filter((r) => {
    const raw = r.details?.arrival_time
    if (!raw) return true
    const match = raw.match(/(\d{1,2}):(\d{2})/)
    if (!match) return true
    const [, h, m] = match
    const [limitH, limitM] = arrivalBefore.split(':').map(Number)
    return parseInt(h) * 60 + parseInt(m) <= limitH * 60 + limitM
  })
  if (filtered.length === 0 && results.length > 0) {
    return results.map(r => ({ ...r, details: { ...(r.details || {}), arrives_late: true } }))
  }
  return filtered
}

// Filtre les compagnies exclues (vols)
// Fallback : si tout est filtré, retourne les originaux avec excluded_airline: true
function filterByAirlines(results, excludedAirlines) {
  if (!excludedAirlines || excludedAirlines.length === 0) return results
  const excluded = excludedAirlines.map((a) => a.toLowerCase())
  const filtered = results.filter((r) => {
    const provider = (r.provider || '').toLowerCase()
    return !excluded.some((e) => provider.includes(e))
  })
  if (filtered.length === 0 && results.length > 0) {
    return results.map(r => ({ ...r, details: { ...(r.details || {}), excluded_airline: true } }))
  }
  return filtered
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
