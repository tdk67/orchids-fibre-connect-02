/**
 * Das Örtliche Scraper
 * 
 * Based on prototype IMPL.md sections 20.5 and 20.6
 * Scrapes business data from das-oertliche.de using JSON-LD structured data
 */

import { buildDasOertlicheUrl, wrapWithCorsProxy } from './url-builder';
import { removeDuplicates } from './duplicate-detection';
import { base44 } from '../../api/base44Client';
import { geocodeAddress } from '../../utils/geoUtils';

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
 * Converts JSON-LD item to lead object with business filtering
 */
export async function fetchSinglePage(street, city, pageNum = 1) {
  const url = buildDasOertlicheUrl(street, city, pageNum);
  const proxyUrl = wrapWithCorsProxy(url);
  
  try {
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      if (response.status === 410 || response.status === 404) {
        // 410 Gone / 404 Not Found = no more pages available
        return { leads: [], hasNextPage: false };
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Check for error pages
    if (html.includes('<title>Fehlermeldung</title>') || html.includes('Keine Treffer')) {
      return { leads: [], hasNextPage: false };
    }

// Parse JSON-LD structured data
const leads = parseJsonLdFromHtml(html, street, city);

// Check if next page link exists in HTML - Robust detection
// Das Örtliche uses various patterns for the next page link
const hasNextPage = html.includes(`Seite-${pageNum + 1}.htm`) || 
html.includes('title="Nächste Seite"') ||
html.includes('rel="next"') ||
html.includes('class="next"') ||
html.includes('>Nächste<') ||
html.includes('>vorwärts<') ||
html.includes('title="vorwärts"') ||
// Sometimes it's encoded or different
html.includes('href="') && html.includes(`-Seite-${pageNum + 1}`);

return { leads, hasNextPage };
} catch (error) {
// If we hit a 404 or 410, it's just the end of results
if (error.message?.includes('404') || error.message?.includes('410')) {
return { leads: [], hasNextPage: false };
}
console.error(`Error fetching page ${pageNum} for ${street}, ${city}:`, error);
return { leads: [], hasNextPage: false };
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
 * Fetches all leads for a street with pagination
 * @param {string} street - Street name
 * @param {string} city - City name
  * @param {Object} options - Options (onProgress callback, maxPages)
 * @returns {Promise<Array>} - Array of all leads
 */
export async function fetchStreetLeads(street, city, options = {}) {
  const { onProgress, maxPages = 50 } = options;
  
  const allLeads = [];

  let page = 1;
  let hasMorePages = true;
  
  while (hasMorePages && page <= maxPages) {
    if (onProgress) {
      onProgress({ street, city, page, status: 'fetching' });
    }
    
    const { leads, hasNextPage } = await fetchSinglePage(street, city, page);
    
    if (leads.length === 0) {
      hasMorePages = false;
    } else {
      allLeads.push(...leads);
      
      if (onProgress) {
        onProgress({ street, city, page, status: 'found', count: leads.length });
      }
      
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

export { LEAD_STATUS, LEAD_SOURCE };
