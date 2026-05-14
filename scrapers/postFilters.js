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

function filterByBedType(results, bedType) {
  if (!bedType) return results
  const keywords = {
    double: ['double', 'king', 'queen', 'matrimonial', 'grand lit'],
    twin:   ['twin', 'deux lits', 'lits jumeaux', 'two beds', '2 beds'],
  }
  const kws = keywords[bedType] || []
  const filtered = results.filter((r) => {
    const roomType = (r.details?.room_type || '').toLowerCase()
    if (!roomType) return true
    return kws.some((k) => roomType.includes(k))
  })
  return filtered.length > 0 ? filtered : results
}

function filterByAmenities(results, requiredAmenities) {
  if (!requiredAmenities || requiredAmenities.length === 0) return results
  const keywordMap = {
    gym:  ['gym', 'fitness', 'sport', 'musculation'],
    spa:  ['spa', 'sauna', 'hammam', 'bien-être'],
    pool: ['pool', 'piscine', 'swimming'],
  }
  const filtered = results.filter((r) => {
    const amenities = (r.details?.amenities || []).map((a) => a.toLowerCase())
    if (amenities.length === 0) return true
    return requiredAmenities.every((req) => {
      const kws = keywordMap[req] || [req]
      return amenities.some((a) => kws.some((k) => a.includes(k)))
    })
  })
  return filtered.length > 0 ? filtered : results
}

function sortByPreferredAirlines(results, preferredAirlines) {
  if (!preferredAirlines || preferredAirlines.length === 0) return results
  const preferred = preferredAirlines.map((a) => a.toLowerCase())
  return [...results].sort((a, b) => {
    const aMatch = preferred.some((p) => (a.provider || '').toLowerCase().includes(p))
    const bMatch = preferred.some((p) => (b.provider || '').toLowerCase().includes(p))
    if (aMatch && !bMatch) return -1
    if (!aMatch && bMatch) return 1
    return 0
  })
}

module.exports = { filterByPrice, filterByArrival, filterByAirlines, applyTransportFilters, filterByBedType, filterByAmenities, sortByPreferredAirlines }
