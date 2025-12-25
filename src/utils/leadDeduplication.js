/**
 * Utility for lead deduplication based on fuzzy matching rules.
 */

/**
 * Normalizes a company name for comparison.
 * Removes common legal suffixes and extra whitespace.
 */
export function normalizeCompanyName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\s+(gmbh|kg|ug|& co\.?|haftungsbeschränkt|e\.v\.|e\.k\.|inc\.|ltd\.)(\s+|$)/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes an address for comparison.
 * Extracts street name and base house number.
 */
export function normalizeAddress(address) {
  if (!address) return { street: "", number: "" };
  
  const normalized = address.toLowerCase().trim();
  
  // Extract street name (everything before the first digit)
  const streetMatch = normalized.match(/^([^0-9]+)/);
  const street = streetMatch ? streetMatch[1].trim() : normalized;
  
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

  // 2. Same Name & Fuzzy Address (Same street, same base number)
  if (nameA === nameB && addrA.street === addrB.street && addrA.number === addrB.number) {
    return true;
  }

  // 3. Same Address & Fuzzy Name (One name contains the other after normalization)
  const addressMatch = addrA.street === addrB.street && addrA.number === addrB.number;
  if (addressMatch && (nameA.includes(nameB) || nameB.includes(nameA))) {
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
