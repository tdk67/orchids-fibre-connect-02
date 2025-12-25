/**
 * Utility for lead deduplication based on fuzzy matching rules.
 */

/**
 * Normalizes a company name for comparison.
 * Removes common legal suffixes, extra whitespace, accents, and handles parentheses.
 */
export function normalizeCompanyName(name) {
  if (!name) return "";
  
  // 1. Normalize accents (e.g., É -> E)
  let normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  return normalized
    .toLowerCase()
    // 2. Handle parentheses (often contain legal forms or additional info)
    .replace(/\(.*?\)/g, " ")
    // 3. Remove common legal suffixes and variants
    .replace(/\s+(gmbh|kg|ug|& co\.?|haftungsbeschrankt|haftungsbeschrank|e\.v\.|e\.k\.|inc\.|ltd\.)(\s+|$)/g, " ")
    // 4. Remove all punctuation and special characters
    .replace(/[^\w\s]/g, " ")
    // 5. Clean up whitespace
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes an address for comparison.
 * Extracts street name and base house number.
 */
export function normalizeAddress(address) {
  if (!address) return { street: "", number: "" };
  
  const normalized = address.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  
  // Extract street name (everything before the first digit)
  const streetMatch = normalized.match(/^([^0-9]+)/);
  const street = streetMatch ? streetMatch[1].replace(/[^\w\s]/g, "").trim() : normalized;
  
  // Extract base house number (digits only)
  const numberMatch = normalized.match(/(\d+)/);
  const number = numberMatch ? numberMatch[1] : "";
  
  return { street, number };
}

/**
 * Checks if two leads are likely the same business.
 */
export function isDuplicateLead(leadA, leadB) {
  // 1. Identical Email is a strong match
  if (leadA.email && leadB.email && leadA.email.toLowerCase().trim() === leadB.email.toLowerCase().trim()) {
    return true;
  }

  const nameA = normalizeCompanyName(leadA.firma);
  const nameB = normalizeCompanyName(leadB.firma);
  
  const addrA = normalizeAddress(leadA.strasse_hausnummer);
  const addrB = normalizeAddress(leadB.strasse_hausnummer);
  
  const cityA = (leadA.stadt || "").toLowerCase().trim();
  const cityB = (leadB.stadt || "").toLowerCase().trim();

  // City check (must match if both provided)
  if (cityA && cityB && cityA !== cityB) return false;

  const addressMatch = addrA.street === addrB.street && addrA.number === addrB.number;

  // 2. Same Name & Fuzzy Address
  if (nameA === nameB && addressMatch) {
    return true;
  }

  // 3. Same Address & Fuzzy Name (One name contains the other after normalization)
  // Or high similarity (for cases like "Positions Berlin" vs "Positions Berlin GmbH" where normalization handles it)
  if (addressMatch && (nameA.includes(nameB) || nameB.includes(nameA)) && nameA.length > 3 && nameB.length > 3) {
    return true;
  }

  return false;
}

/**
 * Filters out duplicates from a list of leads against an existing set of leads.
 */
export function filterDuplicates(newLeads, existingLeads) {
  return newLeads.filter(newLead => {
    return !existingLeads.some(existingLead => isDuplicateLead(newLead, existingLead));
  });
}
