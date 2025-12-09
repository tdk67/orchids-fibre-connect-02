import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadData } = await req.json();

    // Recherchiere korrekte Firmendaten im Internet
    const prompt = `
Suche im Internet nach korrekten und aktuellen Daten für folgendes Unternehmen:

Firma: ${leadData.firma}
${leadData.stadt ? `Stadt: ${leadData.stadt}` : ''}
${leadData.postleitzahl ? `PLZ: ${leadData.postleitzahl}` : ''}
${leadData.strasse_hausnummer ? `Adresse: ${leadData.strasse_hausnummer}` : ''}
${leadData.telefon ? `Telefon (zu überprüfen): ${leadData.telefon}` : ''}

Aufgabe:
1. Finde die offizielle Webseite und aktuelle Kontaktdaten des Unternehmens
2. Verifiziere oder korrigiere: Firmenname, vollständige Adresse (Straße, Hausnummer, PLZ, Stadt), Telefonnummer, E-Mail
3. WICHTIG: Finde unbedingt eine aktuelle Telefonnummer des Unternehmens - prüfe mehrere Quellen (Webseite, Google Maps, Branchenverzeichnisse)
4. PRÜFE OB DIE ANGEGEBENE ADRESSE KORREKT IST - wenn nicht, gib die korrekte Adresse zurück
5. PRÜFE OB DAS UNTERNEHMEN MEHRERE STANDORTE/FILIALEN HAT - liste ALLE gefundenen Standorte auf
6. Finde einen Ansprechpartner wenn möglich
7. Prüfe ob das Unternehmen noch existiert und aktiv ist

KRITISCH: Die Telefonnummer ist PFLICHT. Wenn keine aktuelle Telefonnummer gefunden werden kann, setze telefon auf null.

MEHRERE STANDORTE:
- Wenn das Unternehmen mehrere Standorte hat, liste ALLE Adressen in standorte_liste auf
- Markiere in notizen, welcher Standort die Hauptfiliale/Zentrale ist
- Setze mehrere_standorte auf true

ADRESSE:
- Wenn die angegebene Adresse nicht stimmt, gib die korrekte zurück und setze adresse_korrekt auf false
- Vermerke in notizen die ursprüngliche und korrekte Adresse

Gib nur verifizierte, aktuelle Daten zurück. Wenn etwas nicht gefunden werden kann, gib null zurück.
`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          firma: { type: "string" },
          ansprechpartner: { type: ["string", "null"] },
          strasse_hausnummer: { type: "string" },
          postleitzahl: { type: "string" },
          stadt: { type: "string" },
          telefon: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          existiert: { type: "boolean" },
          adresse_korrekt: { type: "boolean", description: "Ob die ursprüngliche Adresse korrekt ist" },
          mehrere_standorte: { type: "boolean", description: "Ob das Unternehmen mehrere Standorte/Filialen hat" },
          standorte_liste: { type: ["string", "null"], description: "Liste aller Standorte falls mehrere vorhanden" },
          notizen: { type: "string" }
        }
      }
    });

    // Prüfe ob Daten gefunden wurden - Telefonnummer ist PFLICHT
    const dataFound = result && result.existiert && result.telefon && (
      result.firma || 
      result.strasse_hausnummer
    );

    return Response.json({
      success: true,
      verifiedData: result,
      dataFound: dataFound
    });

  } catch (error) {
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});