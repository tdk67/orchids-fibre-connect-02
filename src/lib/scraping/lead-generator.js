import { fetchStreetLeads } from './das-oertliche-scraper';
import { isDuplicateLead } from '@/utils/leadDeduplication';
import { geocodeAddress, isPointInBounds, findAreaForLead } from '@/utils/geoUtils';
import { base44 } from '@/api/base44Client';

/**
 * LeadGenerator Module
 * Encapsulates the logic for generating, deduplicating, geocoding, and assigning leads to areas.
 * This module is designed to be robust and "sealed" to prevent breakage during unrelated changes.
 */
export const LeadGenerator = {
  /**
   * Generates leads for a specific area and its streets.
   * 
   * @param {Object} area - The area object {id, name, city, streets, bounds}
   * @param {Array} allLeads - List of all leads in the database for duplicate checking
   * @param {Object} options - { rescanMode, onProgress, user, allAreas }
   * @returns {Promise<Array>} - List of leads processed in this session
   */
  async generateForArea(area, allLeads, options = {}) {
    const { rescanMode = false, onProgress, user, allAreas = [] } = options;
    const streets = typeof area.streets === 'string' ? JSON.parse(area.streets) : area.streets || [];
    const city = area.city || 'Berlin';
    const sessionLeads = [];
    
    // We maintain a local copy of leads to check for duplicates within the current session
    // and across streets that might be processed in this one area generation run.
    const currentLeadsPool = [...allLeads];

    if (streets.length === 0) return [];

    for (let i = 0; i < streets.length; i++) {
      const street = streets[i];
      const streetName = street.name || street;

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: streets.length,
          street: streetName,
          status: 'processing_street'
        });
      }

      // Skip already loaded streets unless rescanMode is active
      const alreadyHasLeads = currentLeadsPool.some(l => 
        l.stadt?.toLowerCase() === city.toLowerCase() && 
        l.strasse_hausnummer?.toLowerCase().includes(streetName.toLowerCase())
      );

      if (alreadyHasLeads && !rescanMode) {
        // Even if we skip the street, we might want to return existing leads for UI?
        // But usually, we just move on.
        continue;
      }

      try {
        // Fetch ALL pages for the street (up to 50)
        const foundLeads = await fetchStreetLeads(streetName, city, { maxPages: 50 });
        const leadsToCreate = [];

        for (const lead of foundLeads) {
          const leadData = {
            firma: lead.firma || "",
            strasse_hausnummer: lead.strasse_hausnummer || "",
            stadt: lead.stadt || city,
            email: lead.email || "",
            postleitzahl: lead.postleitzahl || "",
            telefon: lead.telefon || "",
          };

          // 1. Session & Database Duplicate Check
          const existingLead = currentLeadsPool.find(existing => isDuplicateLead(leadData, existing));
          
          if (existingLead) {
            // Update area_id if missing or different, but ONLY if it's actually in this area
            let shouldUpdate = false;
            let updatePayload = {};

            // If it doesn't have coordinates, try to get them
            if (!existingLead.latitude || !existingLead.longitude) {
              const coords = await geocodeAddress(
                lead.street_name || streetName,
                lead.street_number || "",
                city,
                lead.postleitzahl || ""
              );
              if (coords) {
                updatePayload.latitude = coords.lat.toString();
                updatePayload.longitude = coords.lon.toString();
                existingLead.latitude = updatePayload.latitude;
                existingLead.longitude = updatePayload.longitude;
                shouldUpdate = true;
              }
            }

            // Spatial check: Is it actually in the current area?
            const isInCurrentArea = existingLead.latitude && existingLead.longitude && 
                                   isPointInBounds(existingLead.latitude, existingLead.longitude, area.bounds);

            if (isInCurrentArea && String(existingLead.area_id) !== String(area.id)) {
              updatePayload.area_id = area.id;
              updatePayload.pool_status = existingLead.pool_status || "im_pool";
              shouldUpdate = true;
            }

            if (shouldUpdate) {
              await base44.entities.Lead.update(existingLead.id, updatePayload);
            }
            
            sessionLeads.push(existingLead);
            continue;
          }

          // 2. New Lead - Geocode and Create
          // Try to reuse coordinates from another lead at same address
          let coords = currentLeadsPool.find(l => 
            l.strasse_hausnummer === leadData.strasse_hausnummer && 
            l.stadt === leadData.stadt && 
            (l.latitude || l.lat) && (l.longitude || l.lon)
          );

          if (!coords) {
            coords = await geocodeAddress(
              lead.street_name || streetName,
              lead.street_number || "",
              city,
              lead.postleitzahl || ""
            );
          }

          // Spatial Verification: Only assign to this area if it's actually inside the bounds
          // OR if we have no coords, we fallback to the current area being scanned.
          let assignedAreaId = area.id;
          const lat = coords?.lat?.toString() || coords?.latitude || "";
          const lon = coords?.lon?.toString() || coords?.longitude || "";

          if (lat && lon) {
            const inCurrent = isPointInBounds(lat, lon, area.bounds);
            if (!inCurrent && allAreas.length > 0) {
              const matchingArea = findAreaForLead({ ...leadData, latitude: lat, longitude: lon }, allAreas);
              if (matchingArea) assignedAreaId = matchingArea.id;
            } else if (!inCurrent) {
              // If not in current area and no other areas provided/matched, 
              // we still keep it in this area's "found" list for the scraper run,
              // but maybe we shouldn't? For now, we follow the user's intent.
              assignedAreaId = area.id;
            }
          }

          const newLead = {
            ...leadData,
            infobox: `Branche: ${lead.branche || "-"}\nWebseite: ${lead.webseite || "-"}\nGefunden über: ${streetName}, ${city}`,
            status: "Neu",
            pool_status: "im_pool",
            benutzertyp: user?.benutzertyp || "Interner Mitarbeiter",
            sparte: "1&1 Versatel",
            latitude: lat,
            longitude: lon,
            area_id: assignedAreaId,
          };

          leadsToCreate.push(newLead);
          currentLeadsPool.push(newLead); // Add to local pool for duplicate check of next leads
          sessionLeads.push(newLead);
        }

        if (leadsToCreate.length > 0) {
          await base44.entities.Lead.bulkCreate(leadsToCreate);
        }

        // Slight delay between streets to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        console.error(`Error processing street ${streetName}:`, err);
      }
    }

    return sessionLeads;
  }
};
