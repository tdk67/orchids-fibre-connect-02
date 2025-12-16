/**
 * Duplicate Detection Utilities
 * 
 * Based on prototype IMPL.md section 20.8
 * Handles phone and address normalization for duplicate checking
 */

/**
 * Normalizes phone number for comparison
 * Removes spaces, dashes, parentheses, and country code prefixes
 * @param {string} phone - Raw phone number
 * @returns {string} - Normalized phone (digits only)
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove German country code prefix if present
  if (cleaned.startsWith('49')) {
    cleaned = '0' + cleaned.substring(2);
  } else if (cleaned.startsWith('+49')) {
    cleaned = '0' + cleaned.substring(3);
  }
  
  return cleaned;
}

/**
 * Normalizes business name for comparison
 * @param {string} name - Business name
 * @returns {string} - Normalized name
 */
export function normalizeBusinessName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Normalizes street address for comparison
 * @param {string} street - Street name
 * @param {string} number - Street number
 * @param {string} city - City name
 * @returns {string} - Normalized address key
 */
export function normalizeAddress(street, number, city) {
  const normStreet = street
    .toLowerCase()
    .replace(/straße/g, 'str')
    .replace(/strasse/g, 'str')
    .replace(/\./g, '')
    .trim();
  
  // Extract only digits from street number
  const normNumber = number ? number.replace(/[^0-9]/g, '') : '';
  
  const normCity = city.toLowerCase().trim();
  
  return `${normStreet}|${normNumber}|${normCity}`;
}

/**
 * Checks if two phone numbers are equal after normalization
 * @param {string} phone1 - First phone
 * @param {string} phone2 - Second phone
 * @returns {boolean} - True if equal
 */
export function arePhonesEqual(phone1, phone2) {
  if (!phone1 || !phone2) return false;
  
  const norm1 = normalizePhoneNumber(phone1);
  const norm2 = normalizePhoneNumber(phone2);
  
  if (!norm1 || !norm2) return false;
  
  return norm1 === norm2;
}

/**
 * Checks if two business names are similar (fuzzy match)
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @param {number} threshold - Similarity threshold (0-1), default 0.85
 * @returns {boolean} - True if similar enough
 */
export function areNamesEqual(name1, name2, threshold = 0.85) {
  if (!name1 || !name2) return false;
  
  const norm1 = normalizeBusinessName(name1);
  const norm2 = normalizeBusinessName(name2);
  
  if (norm1 === norm2) return true;
  
  // Simple similarity check (Levenshtein would be better but this is faster)
  const longer = norm1.length > norm2.length ? norm1 : norm2;
  const shorter = norm1.length > norm2.length ? norm2 : norm1;
  
  if (longer.length === 0) return true;
  
  const editDistance = levenshteinDistance(longer, shorter);
  const similarity = (longer.length - editDistance) / longer.length;
  
  return similarity >= threshold;
}

/**
 * Simple Levenshtein distance implementation
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Removes in-page duplicates from scraped records
 * @param {Array} records - Array of scraped records
 * @returns {Array} - Deduplicated records
 */
export function removeDuplicates(records) {
  const seen = new Map(); // key -> index
  const result = [];
  
  records.forEach((record) => {
    // Create key from normalized address + phone
    const addressKey = normalizeAddress(
      record.street_name || '',
      record.street_number || '',
      record.city || ''
    );
    const phoneNorm = normalizePhoneNumber(record.phone || '');
    const key = `${addressKey}|${phoneNorm}`;
    
    if (!seen.has(key)) {
      seen.set(key, true);
      result.push(record);
    }
  });
  
  return result;
}
