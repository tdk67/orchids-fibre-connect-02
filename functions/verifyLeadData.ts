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
3. Finde einen Ansprechpartner wenn möglich
4. Prüfe ob das Unternehmen noch existiert und aktiv ist

Wichtig: Gib nur verifizierte, aktuelle Daten zurück. Wenn etwas nicht gefunden werden kann, gib null zurück.
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
          notizen: { type: "string" }
        }
      }
    });

    return Response.json({
      success: true,
      verifiedData: result
    });

  } catch (error) {
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});