import { base44 } from "@/api/base44Client";

/**
 * Robust geographic point-in-bounds check
 */
export const isPointInBounds = (lat, lng, bounds) => {
  if (!lat || !lng || !bounds) return false;
  const b = typeof bounds === "string" ? JSON.parse(bounds) : bounds;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  return (
    latitude <= b.north &&
    latitude >= b.south &&
    longitude <= b.east &&
    longitude >= b.west
  );
};

/**
 * Centralized geocoding using local OSM cache (geocoding_cache)
 * PER USER REQUEST: Does not use Nominatim anymore.
 */
export async function geocodeAddress(street, streetNumber, city, postalCode = "") {
  try {
    // 1. Try local geocoding cache
    const { data: cached, error: cacheError } = await base44.client
      .from('geocoding_cache')
      .select('latitude, longitude')
      .eq('street', street)
      .eq('house_number', streetNumber)
      .eq('city', city)
      .maybeSingle();

    if (!cacheError && cached) {
      return { lat: cached.latitude, lon: cached.longitude };
    }

    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Robust lead-to-area match check with street fallback
 */
export function getAreaLeadMatch(lead, area) {
  if (!lead || !area) return false;

  // 1. Spatial check (most accurate)
  if (lead.latitude && lead.longitude && area.bounds) {
    return isPointInBounds(lead.latitude, lead.longitude, area.bounds);
  }
  
  // 2. Fallback to street name matching if no coordinates
  const leadCity = lead.stadt?.toLowerCase()?.trim() || "";
  const areaCity = area.city?.toLowerCase()?.trim() || "";
  
  if (areaCity && leadCity !== areaCity) return false;
  
  const streets = typeof area.streets === "string" ? JSON.parse(area.streets) : area.streets || [];
  const leadStreet = lead.strasse_hausnummer?.toLowerCase()?.trim() || "";
  
  return streets.some(s => {
    const streetName = (typeof s === 'string' ? s : s.name)?.toLowerCase()?.trim() || "";
    return streetName && leadStreet.startsWith(streetName);
  });
}

/**
 * Assigns a lead to the correct area based on coordinates or street matching
 */
export function findAreaForLead(lead, areas) {
  if (!lead || !areas?.length) return null;
  
  // Find first area that matches (spatial first, then street fallback)
  const matchingArea = areas.find(area => getAreaLeadMatch(lead, area));
  return matchingArea || null;
}

/**
 * Batch syncs leads with geocoding and area assignment
 * Now optimized: No Nominatim, no delays, batch processing
 */
export async function syncLeadsWithAreas(leads, areas, forceGeocode = false) {
  const updates = [];
  
  for (const lead of leads) {
    let lat = lead.latitude;
    let lon = lead.longitude;
    let needsUpdate = false;
    let updateData = {};

    // 1. Try to geocode from cache if missing or forced
    if ((!lat || !lon || forceGeocode) && lead.strasse_hausnummer && lead.stadt) {
      // Basic split for street/number
      const match = lead.strasse_hausnummer.match(/^(.*?)\s*(\d.*)?$/);
      const street = match?.[1] || lead.strasse_hausnummer;
      const num = match?.[2] || "";
      
      const coords = await geocodeAddress(street, num, lead.stadt, lead.postleitzahl);
      if (coords) {
        lat = coords.lat.toString();
        lon = coords.lon.toString();
        updateData.latitude = lat;
        updateData.longitude = lon;
        needsUpdate = true;
      }
    }

    // 2. Assign area (uses coordinates if available, otherwise street matching fallback)
    const area = findAreaForLead({ ...lead, latitude: lat, longitude: lon }, areas);
    if (area && String(lead.area_id) !== String(area.id)) {
      updateData.area_id = area.id;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.push({ id: lead.id, ...updateData });
    }
  }

  // Execute updates in batches to be efficient
  const batchSize = 50;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    await Promise.all(
      batch.map(update => {
        const { id, ...data } = update;
        return base44.entities.Lead.update(id, data);
      })
    );
  }

  return updates.length;
}

