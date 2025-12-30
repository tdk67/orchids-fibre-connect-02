import { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export function useOSMImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });
  const { toast } = useToast();

    const getImportStatus = useCallback(async (city) => {
      try {
        const { data, error } = await base44.client
          .from("osm_imports")
          .select("*")
          .eq("city", city)
          .maybeSingle(); // Use maybeSingle to avoid 406/PGRST116 errors if not found
        
        if (error) {
          // Check if table exists error (42P01 in Postgres, often surfaced as 404/400 by PostgREST)
          if (error.code === '42P01' || error.message?.includes('relation "osm_imports" does not exist')) {
            console.warn("Table osm_imports does not exist yet. Please run the SQL migration.");
            return null;
          }
          throw error;
        }
        return data;
      } catch (err) {
        const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.error("Error fetching import status:", errorMessage);
        return null;
      }
    }, []);

  const importCityData = useCallback(async (city) => {
    if (!city) return;
    setIsImporting(true);
    setProgress({ current: 0, total: 0, message: `Starte Import für ${city}...` });

    try {
      // 1. Fetch from Overpass
      const query = `
        [out:json][timeout:180][maxsize:1073741824];
        area["name"="${city}"]["admin_level"~"4|6|8|9"]->.searchArea;
        (
          node["addr:street"]["addr:housenumber"](area.searchArea);
          way["addr:street"]["addr:housenumber"](area.searchArea);
          relation["addr:street"]["addr:housenumber"](area.searchArea);
        );
        out center;
      `;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Overpass API error response:", errorText);
        if (response.status === 429) throw new Error("Overpass API: Zu viele Anfragen. Bitte kurz warten.");
        if (response.status === 504) throw new Error("Overpass API: Zeitüberschreitung (die Stadt ist evtl. zu groß).");
        throw new Error(`Overpass API Fehler (${response.status})`);
      }
      const data = await response.json();
      const elements = data.elements || [];

      if (elements.length === 0) {
        toast({
          title: "Keine Daten",
          description: `Keine Adressdaten für ${city} in OSM gefunden.`,
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      setProgress({ current: 0, total: elements.length, message: `${elements.length} Adressen gefunden. Speichere...` });

      // 2. Process and Upsert in batches
      const batchSize = 100;
        for (let i = 0; i < elements.length; i += batchSize) {
          const batch = elements.slice(i, i + batchSize)
            .filter(el => el.tags && el.tags["addr:street"] && el.tags["addr:housenumber"])
            .map(el => ({
              street: el.tags["addr:street"],
              house_number: el.tags["addr:housenumber"],
              postcode: el.tags["addr:postcode"] || "",
              city: el.tags["addr:city"] || city,
              latitude: el.lat || (el.center && el.center.lat),
              longitude: el.lon || (el.center && el.center.lon),
            }))
            .filter(item => item.latitude && item.longitude);

          if (batch.length === 0) continue;

          const { error } = await base44.client
            .from("geocoding_cache")
            .upsert(batch, { 
              onConflict: 'street,house_number,postcode,city',
              ignoreDuplicates: false 
            });

          if (error) {
            console.error("Batch upsert error details:", JSON.stringify(error, null, 2));
            throw new Error(`Fehler beim Speichern der Daten: ${error.message || 'Unbekannter Datenbankfehler'}`);
          }
        
        setProgress(prev => ({ 
          ...prev, 
          current: Math.min(i + batchSize, elements.length),
          message: `Verarbeite... ${Math.min(i + batchSize, elements.length)} / ${elements.length}`
        }));
      }

      // 3. Update import status
      await base44.client.from("osm_imports").upsert({
        city: city,
        last_import_at: new Date().toISOString(),
        status: 'completed'
      }, { onConflict: 'city' });

      toast({
        title: "Import abgeschlossen",
        description: `${elements.length} Adressen für ${city} wurden aktualisiert.`,
      });

    } catch (err) {
      console.error("OSM Import error:", err);
      toast({
        title: "Import fehlgeschlagen",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setProgress({ current: 0, total: 0, message: "" });
    }
  }, [toast]);

  return {
    isImporting,
    progress,
    importCityData,
    getImportStatus
  };
}
