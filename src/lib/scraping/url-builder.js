/**
 * URL Builder for Das Örtliche
 * 
 * Based on prototype implementation from IMPL.md section 20.4
 * Handles street name encoding and pagination
 */

/**
 * Builds a Das Örtliche URL with proper encoding
 * @param {string} street - Street name
 * @param {string} city - City name
 * @param {number} page - Page number (1-indexed)
 * @returns {string} - Formatted URL
 */
export function buildDasOertlicheUrl(street, city, page = 1) {
  // Street name transformations per IMPL.md:
  // 1. Remove quotes
  // 2. Replace hyphens with double hyphens
  // 3. Replace spaces with single hyphens
  const streetUrl = street
    .replace(/['"]/g, '')           // Remove quotes
    .replace(/\//g, '-')            // Replace slashes with hyphens
    .replace(/-/g, '--')            // Double hyphens
    .replace(/\s+/g, '-');          // Spaces to hyphens
  
  const cityUrl = city.replace(/\s+/g, '-');
  
  // Page 1 has no suffix, page 2+ has -Seite-N
  if (page === 1) {
    return `https://www.dasoertliche.de/Themen/${streetUrl}/${cityUrl}.htm`;
  } else {
    return `https://www.dasoertliche.de/Themen/${streetUrl}/${cityUrl}-Seite-${page}.htm`;
  }
}

/**
 * Extracts district name from area name (e.g., "Mitte" from "Berlin-Mitte_2024")
 * @param {string} areaName - Area name that may contain district
 * @returns {string|null} - District name or null
 */
export function extractDistrictFromAreaName(areaName) {
  const districtMatch = areaName.match(/-([A-Za-zÄÖÜäöüß]+)_/);
  return districtMatch ? districtMatch[1] : null;
}

/**
 * Builds city with district if area name suggests a district
 * @param {string} city - Base city name
 * @param {string} areaName - Area name that may contain district
 * @returns {string} - City or City-District
 */
export function buildCityWithDistrict(city, areaName) {
  const district = extractDistrictFromAreaName(areaName);
  return district ? `${city}-${district}` : city;
}

/**
 * Wraps URL with CORS proxy
 * @param {string} url - Target URL
 * @returns {string} - Proxied URL
 */
export function wrapWithCorsProxy(url) {
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

/**
 * Fallback CORS proxy
 * @param {string} url - Target URL
 * @returns {string} - Proxied URL
 */
export function wrapWithFallbackProxy(url) {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}
