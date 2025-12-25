/**
 * Das Örtliche Scraper
 * 
 * Based on prototype IMPL.md sections 20.5 and 20.6
 * Scrapes business data from das-oertliche.de using JSON-LD structured data
 */

import { buildDasOertlicheUrl, wrapWithCorsProxy } from './url-builder';
import { removeDuplicates } from './duplicate-detection';

const LEAD_STATUS = {
  NEW: 'Neu',
  CONTACTED: 'Kontaktiert',
  INTERESTED: 'Interessiert',
  NOT_INTERESTED: 'Nicht interessiert',
  CONVERTED: 'Konvertiert',
  INVALID: 'Ungültig',
};

const LEAD_SOURCE = {
  DAS_OERTLICHE: 'das_oertliche',
  STREET_WALKER: 'street_walker',
  MANUAL: 'manual',
};

/**
 * Fetches a single page from das örtliche
 * @param {string} street - Street name
 * @param {string} city - City name
 * @param {number} pageNum - Page number
 * @returns {Promise<Array>} - Array of leads
 */
export async function fetchSinglePage(street, city, pageNum = 1) {
  const url = buildDasOertlicheUrl(street, city, pageNum);
  const proxyUrl = wrapWithCorsProxy(url);
  
  try {
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      if (response.status === 410) {
        // 410 Gone = no more pages available
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Check for error pages
    if (html.includes('<title>Fehlermeldung</title>') || html.includes('Keine Treffer')) {
      return [];
    }
    
    // Parse JSON-LD structured data
    const leads = parseJsonLdFromHtml(html, street, city);
    
    return leads;
  } catch (error) {
    console.error(`Error fetching page ${pageNum} for ${street}, ${city}:`, error);
    return [];
  }
}

/**
 * Parses JSON-LD structured data from HTML
 * @param {string} html - HTML content
 * @param {string} street - Street name for context
 * @param {string} city - City name for validation
 * @returns {Array} - Array of leads
 */
function parseJsonLdFromHtml(html, street, city) {
  const leads = [];
  
  // Find all JSON-LD script tags
  const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  
  if (!jsonLdMatches) return [];
  
  for (const match of jsonLdMatches) {
    try {
      const json = match
        .replace(/<script type="application\/ld\+json">/, '')
        .replace(/<\/script>/, '');
      
      const data = JSON.parse(json);
      
      // Handle ItemList or individual entries
      if (data['@type'] === 'ItemList' && data.itemListElement) {
        for (const listItem of data.itemListElement) {
          const parsed = toLead(listItem.item, street, city);
          if (parsed) leads.push(parsed);
        }
      } else {
        const parsed = toLead(data, street, city);
        if (parsed) leads.push(parsed);
      }
    } catch (err) {
      console.warn('Failed to parse JSON-LD:', err);
    }
  }
  
  return leads;
}

/**
 * Converts JSON-LD item to lead object with business filtering
 * @param {Object} item - JSON-LD data
 * @param {string} street - Street name
 * @param {string} city - City name for validation
 * @returns {Object|null} - Lead object or null if filtered out
 */
function toLead(item, street, city) {
  if (!item || !item.name) return null;
  
  // STEP 1: Type validation
  const rawTypes = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
  const types = rawTypes.map((t) => String(t).toLowerCase());
  
  // STEP 2: Filter private persons (CRITICAL per IMPL.md)
  if (types.includes('person')) {
    return null; // Explicit Person type = private person
  }
  
  // STEP 3: Check for business indicators
  const businessTypePatterns = [
    'localbusiness', 'organization', 'restaurant', 'foodestablishment',
    'store', 'bar', 'cafe', 'hotel', 'corporation', 'company',
    'autorepair', 'medicalclinic', 'dentist', 'hospital', 'pharmacy',
    'realestate', 'bank', 'school', 'gym', 'salon', 'lawyer',
    'accountant', 'plumber', 'electrician', 'contractor',
  ];
  
  const isBusiness = types.some((t) =>
    businessTypePatterns.some((pattern) => t.includes(pattern))
  );
  
  const hasTelephone = !!(item.telephone || item.phone);
  
  // Require EITHER business @type OR telephone
  if (!isBusiness && !hasTelephone) {
    return null;
  }
  
  // STEP 4: City validation
  const addressCity = item.address?.addressLocality;
  if (addressCity && addressCity.toLowerCase() !== city.toLowerCase()) {
    return null; // Wrong city = filter out
  }
  
  // STEP 5: Extract contact data
  const rawPhone = item.telephone || item.phone;
  const isValidPhone = rawPhone && /[\d\s\-\+\(\)]{7,}/.test(rawPhone);
  
  let website = item.url || item.website;
  // Filter out directory links
  if (website?.includes('dasoertliche') || website?.includes('herold.at') || website?.includes('gelbeseiten')) {
    website = undefined;
  }
  
  // Extract street number from address
  const streetNumber = item.address?.streetAddress?.match(/\d+[\w\/-]*/)?.[0];
  
  // Build description from multiple sources
  let description = item.description || item.category || item.slogan || item.servesCuisine;
  if (item.priceRange) {
    description = description ? `${description} | Price: ${item.priceRange}` : `Price: ${item.priceRange}`;
  }
  
  // Extract industry from types (exclude generic "LocalBusiness")
  const industry = rawTypes
    .filter((t) => !/LocalBusiness/i.test(t))
    .join(', ') || undefined;
  
  // STEP 6: Build lead object
  const lead = {
    firma: item.name,
    strasse_hausnummer: streetNumber ? `${street} ${streetNumber}` : street,
    stadt: city,
    postleitzahl: item.address?.postalCode || '',
    telefon: isValidPhone ? rawPhone : '',
    email: item.email || '',
    branche: industry,
    webseite: website || '',
    infobox: description || '',
    status: LEAD_STATUS.NEW,
    source: LEAD_SOURCE.DAS_OERTLICHE,
    verified: false,
    // Additional fields for internal tracking
    street_name: street,
    street_number: streetNumber || '',
  };
  
  return lead;
}

/**
 * Checks if next page exists
 * @param {string} street - Street name
 * @param {string} city - City name
 * @param {number} pageNum - Page number to check
 * @returns {Promise<boolean>} - True if page exists
 */
export async function checkForNextPage(street, city, pageNum) {
  const url = buildDasOertlicheUrl(street, city, pageNum);
  const proxyUrl = wrapWithCorsProxy(url);
  
  try {
    // HEAD request to check if page exists (faster than GET)
    const response = await fetch(proxyUrl, { method: 'HEAD' });
    
    // 410 Gone = no more pages
    return response.ok && response.status !== 410;
  } catch {
    return false;
  }
}

/**
 * Fetches all leads for a street with pagination
 * @param {string} street - Street name
 * @param {string} city - City name
 * @param {Object} options - Options (onProgress callback, maxPages)
 * @returns {Promise<Array>} - Array of all leads
 */
export async function fetchStreetLeads(street, city, options = {}) {
  const { onProgress, maxPages = 10 } = options;
  
  const allLeads = [];
  let page = 1;
  let hasMorePages = true;
  
  while (hasMorePages && page <= maxPages) {
    if (onProgress) {
      onProgress({ street, city, page, status: 'fetching' });
    }
    
    const leads = await fetchSinglePage(street, city, page);
    
    if (leads.length === 0) {
      hasMorePages = false;
    } else {
      allLeads.push(...leads);
      
      if (onProgress) {
        onProgress({ street, city, page, status: 'found', count: leads.length });
      }
      
      // Check if next page exists
      const hasNextPage = await checkForNextPage(street, city, page + 1);
      if (hasNextPage) {
        page++;
        // Rate limiting: 800ms delay between pages per IMPL.md
        await new Promise((resolve) => setTimeout(resolve, 800));
      } else {
        hasMorePages = false;
      }
    }
  }
  
  // Remove in-page duplicates
  const deduplicated = removeDuplicates(allLeads);
  
  if (onProgress) {
    onProgress({ 
      street, 
      city, 
      status: 'completed', 
      totalPages: page,
      totalLeads: deduplicated.length 
    });
  }
  
  return deduplicated;
}

/**
 * Geocodes an address using Nominatim
 * @param {string} street - Street name
 * @param {string} streetNumber - Street number
 * @param {string} city - City name
 * @param {string} postalCode - Postal code (optional)
 * @returns {Promise<Object|null>} - {lat, lon} or null
 */
export async function geocodeAddress(street, streetNumber, city, postalCode = "") {
  try {
    const addressParts = [street, streetNumber, postalCode, city, 'Germany'].filter(Boolean);
    const address = addressParts.join(' ').trim();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: { 'User-Agent': 'FiberConnect-LeadGen/1.0' },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.length === 0) {
      return null;
    }
    
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (error) {
    // Silently fail - geocoding is optional
    return null;
  }
}

export { LEAD_STATUS, LEAD_SOURCE };
