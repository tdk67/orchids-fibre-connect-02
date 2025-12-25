import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Fetches all addresses for a given city from Overpass API
 * @param {string} city - Name of the city (e.g., 'Berlin')
 */
async function importCityAddresses(city) {
  console.log(`Starting import for city: ${city}`);
  
  // Overpass QL query to get all buildings with addresses in the city
  const query = `
    [out:json][timeout:300];
    area[name="${city}"][admin_level~"4|6"];
    (
      node["addr:street"]["addr:housenumber"](area);
      way["addr:street"]["addr:housenumber"](area);
      relation["addr:street"]["addr:housenumber"](area);
    );
    out center;
  `;

  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Overpass API error: ${response.statusText}`);
    
    const data = await response.json();
    const elements = data.elements || [];
    console.log(`Found ${elements.length} address elements in ${city}`);

    const batchSize = 1000;
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize).map(el => {
        const tags = el.tags || {};
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;

        if (!lat || !lon || !tags['addr:street'] || !tags['addr:housenumber']) return null;

        return {
          street: tags['addr:street'],
          house_number: tags['addr:housenumber'],
          postcode: tags['addr:postcode'] || null,
          city: tags['addr:city'] || city,
          latitude: lat,
          longitude: lon
        };
      }).filter(Boolean);

      if (batch.length > 0) {
        const { error } = await supabase
          .from('geocoding_cache')
          .upsert(batch, { onConflict: 'street,house_number,postcode,city' });

        if (error) {
          console.error(`Error inserting batch ${i / batchSize}:`, error.message);
        } else {
          console.log(`Imported batch ${i / batchSize + 1} (${batch.length} records)`);
        }
      }
    }

    console.log(`Import completed for ${city}`);
  } catch (error) {
    console.error('Import failed:', error);
  }
}

const city = process.argv[2] || 'Berlin';
importCityAddresses(city);
