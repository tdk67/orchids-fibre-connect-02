import { fetchStreetLeads } from './das-oertliche-scraper';
import { isDuplicateLead } from '@/utils/leadDeduplication';
import { geocodeAddress, isPointInBounds } from '@/utils/geoUtils';
import { base44 } from '@/api/base44Client';

/**
 * LeadGenerator Module
 * Encapsulates the logic for generating, deduplicating, geocoding, and assigning leads to areas.
 */
export const LeadGenerator = {
  /**
   * Generates leads for a specific area and its streets.
   * 
   * @param {Object} area - The area object {id, name, city, streets, bounds}
   * @param {Array} existingLeads - List of leads already in the database
   * @param {Object} options - { rescanMode, onProgress, user }
   * @returns {Promise<Array>} - List of newly created/updated leads in this session
   */
  async generateForArea(area, existingLeads, options = {}) {
    const { rescanMode = false, onProgress, user } = options;
    const streets = typeof area.streets === 'string' ? JSON.parse(area.streets) : area.streets || [];
    const city = area.city || 'Berlin';
    const sessionLeads = [];

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
      const alreadyHasLeads = existingLeads.some(l => 
        l.stadt?.toLowerCase() === city.toLowerCase() && 
        l.strasse_hausnummer?.toLowerCase().includes(streetName.toLowerCase())
      );

      if (alreadyHasLeads && !rescanMode) {
        continue;
      }

      try {
        const foundLeads = await fetchStreetLeads(streetName, city, { maxPages: 50 });
        const leadsToSave = [];

        for (const lead of foundLeads) {
          const leadData = {
            firma: lead.firma || "",
            strasse_hausnummer: lead.strasse_hausnummer || "",
            stadt: lead.stadt || city,
            email: lead.email || "",
            postleitzahl: lead.postleitzahl || "",
            telefon: lead.telefon || "",
          };

          // 1. Session Duplicate Check
          const isDuplicateInSession = sessionLeads.some(existing => isDuplicateLead(leadData, existing));
          if (isDuplicateInSession) continue;

          // 2. Database Duplicate Check
          const existingLeadInDB = existingLeads.find(existing => isDuplicateLead(leadData, existing));
          
          if (existingLeadInDB) {
            // Update area_id if different
            if (String(existingLeadInDB.area_id) !== String(area.id)) {
              await base44.entities.Lead.update(existingLeadInDB.id, {
                area_id: area.id,
                pool_status: existingLeadInDB.pool_status || "im_pool"
              });
            }

            // Update missing coordinates
            if (!existingLeadInDB.latitude || !existingLeadInDB.longitude) {
              const coords = await geocodeAddress(
                lead.street_name || streetName,
                lead.street_number || "",
                city,
                lead.postleitzahl || ""
              );
              if (coords) {
                await base44.entities.Lead.update(existingLeadInDB.id, {
                  latitude: coords.lat.toString(),
                  longitude: coords.lon.toString()
                });
              }
            }
            
            sessionLeads.push({ ...existingLeadInDB, area_id: area.id });
            continue;
          }

          // 3. New Lead - Geocode and Create
          // Try to reuse coordinates from another lead at same address in this session or DB
          let coords = sessionLeads.find(l => 
            l.strasse_hausnummer === leadData.strasse_hausnummer && 
            l.stadt === leadData.stadt && 
            (l.latitude || l.lat) && (l.longitude || l.lon)
          ) || existingLeads.find(l => 
            l.strasse_hausnummer === leadData.strasse_hausnummer && 
            l.stadt === leadData.stadt && 
            l.latitude && l.longitude
          );

          if (!coords) {
            coords = await geocodeAddress(
              lead.street_name || streetName,
              lead.street_number || "",
              city,
              lead.postleitzahl || ""
            );
          }

          const newLead = {
            ...leadData,
            infobox: `Branche: ${lead.branche || "-"}\nWebseite: ${lead.webseite || "-"}\nGefunden über: ${streetName}, ${city}`,
            status: "Neu",
            pool_status: "im_pool",
            benutzertyp: user?.benutzertyp || "Interner Mitarbeiter",
            sparte: "1&1 Versatel",
            latitude: coords?.lat?.toString() || coords?.latitude || "",
            longitude: coords?.lon?.toString() || coords?.longitude || "",
            area_id: area.id,
          };

          leadsToSave.push(newLead);
          sessionLeads.push(newLead);
        }

        if (leadsToSave.length > 0) {
          await base44.entities.Lead.bulkCreate(leadsToSave);
        }

        // Slight delay to prevent being blocked by scraper proxy or database
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`Error processing street ${streetName}:`, err);
      }
    }

    return sessionLeads;
  }
};
