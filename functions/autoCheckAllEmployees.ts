import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userBenutzertyp = user.benutzertyp || 'Interner Mitarbeiter';

    // Hole alle Mitarbeiter und Leads
    const employees = await base44.asServiceRole.entities.Employee.list();
    const allLeads = await base44.asServiceRole.entities.Lead.list();

    const results = [];
    const targetCount = 50;
    const minThreshold = 40;

    // Filter Mitarbeiter nach Benutzertyp
    const relevantEmployees = employees.filter(e => 
      e.benutzertyp === userBenutzertyp && 
      e.status === 'Aktiv' &&
      e.rolle === 'Mitarbeiter'
    );

    for (const employee of relevantEmployees) {
      // Zähle kritische Archive
      const bearbeitetCount = allLeads.filter(l => 
        l.assigned_to_email === employee.email && 
        l.archiv_kategorie === 'Bearbeitet'
      ).length;
      
      const adresspunkteCount = allLeads.filter(l => 
        l.assigned_to_email === employee.email && 
        l.archiv_kategorie === 'Adresspunkte'
      ).length;
      
      const nichtErreichtCount = allLeads.filter(l => 
        l.assigned_to_email === employee.email && 
        l.archiv_kategorie === 'Nicht erreicht'
      ).length;

      // Skip wenn Limits überschritten
      if (bearbeitetCount >= 10 || adresspunkteCount >= 10 || nichtErreichtCount >= 50) {
        continue;
      }

      // Zähle NUR AKTIVE Leads
      const activeLeads = allLeads.filter(l => 
        l.assigned_to_email === employee.email && 
        l.pool_status === 'zugewiesen' &&
        l.benutzertyp === userBenutzertyp &&
        !l.archiv_kategorie &&
        !l.verkaufschance_status &&
        !l.verloren
      );

      const currentCount = activeLeads.length;

      // Nur auffüllen wenn unter Schwelle
      if (currentCount < minThreshold) {
        const needsAssignment = targetCount - currentCount;

        // Hole verfügbare Pool-Leads
        const poolLeads = allLeads.filter(l => 
          l.pool_status === 'im_pool' &&
          l.benutzertyp === userBenutzertyp &&
          l.vorheriger_mitarbeiter !== employee.email
        ).slice(0, needsAssignment);

        // Weise zu
        for (const lead of poolLeads) {
          await base44.asServiceRole.entities.Lead.update(lead.id, {
            ...lead,
            pool_status: 'zugewiesen',
            assigned_to: employee.full_name,
            assigned_to_email: employee.email,
            google_calendar_link: employee.google_calendar_link || ''
          });
        }

        if (poolLeads.length > 0) {
          results.push({
            employee: employee.full_name,
            hadLeads: currentCount,
            assigned: poolLeads.length,
            nowHas: currentCount + poolLeads.length
          });
        }
      }
    }

    return Response.json({ 
      success: true, 
      message: `${results.length} Mitarbeiter automatisch aufgefüllt`,
      results 
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});