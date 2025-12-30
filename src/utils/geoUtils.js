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
 * Centralized geocoding using local cache first
 */
export async function geocodeAddress(street, streetNumber, city, postalCode = "") {
  try {
    // 1. Try local geocoding cache first
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

    // 2. Fallback to Nominatim
    const addressParts = [street, streetNumber, postalCode, city, 'Germany'].filter(Boolean);
    const address = addressParts.join(' ').trim();
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: { 'User-Agent': 'FiberConnect-LeadGen/1.0' },
      }
    );
    
    if (!response.ok) return null;
    const data = await response.json();
    if (data.length === 0) return null;

    const result = {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };

    // 3. Update cache
    await base44.client.from('geocoding_cache').upsert({
      street,
      house_number: streetNumber,
      postcode: postalCode,
      city,
      latitude: result.lat,
      longitude: result.lon
    }, { onConflict: 'street,house_number,postcode,city' });
    
    return result;
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
 */
export async function syncLeadsWithAreas(leads, areas, forceGeocode = false) {
  const updates = [];
  
  for (const lead of leads) {
    let lat = lead.latitude;
    let lon = lead.longitude;
    let needsUpdate = false;
    let updateData = {};

    // 1. Try to geocode if missing or forced
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

    // 2. Assign area
    if (lat && lon) {
      const area = findAreaForLead({ latitude: lat, longitude: lon }, areas);
      if (area && String(lead.area_id) !== String(area.id)) {
        updateData.area_id = area.id;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updates.push({ id: lead.id, ...updateData });
    }
  }

  // Execute updates
  for (const update of updates) {
    const { id, ...data } = update;
    await base44.entities.Lead.update(id, data);
  }

  return updates.length;
}
