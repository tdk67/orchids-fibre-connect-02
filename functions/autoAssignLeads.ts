import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employeeEmail } = await req.json();

    // Hole Mitarbeiter
    const employees = await base44.asServiceRole.entities.Employee.list();
    const employee = employees.find(e => e.email === employeeEmail);

    if (!employee) {
      return Response.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
    }

    // Hole alle Leads
    const allLeads = await base44.asServiceRole.entities.Lead.list();
    
    // Zähle Leads in kritischen Archiv-Kategorien
    const bearbeitetCount = allLeads.filter(l => 
      l.assigned_to_email === employeeEmail && 
      l.archiv_kategorie === 'Bearbeitet'
    ).length;
    
    const adresspunkteCount = allLeads.filter(l => 
      l.assigned_to_email === employeeEmail && 
      l.archiv_kategorie === 'Adresspunkte'
    ).length;
    
    const nichtErreichtCount = allLeads.filter(l => 
      l.assigned_to_email === employeeEmail && 
      l.archiv_kategorie === 'Nicht erreicht'
    ).length;
    
    // Prüfe ob Limits überschritten sind
    if (bearbeitetCount >= 10) {
      return Response.json({
        success: false,
        message: `Hat ${bearbeitetCount} Leads in "Bearbeitet". Erst diese bearbeiten!`,
        assigned: 0,
        currentCount: 0
      });
    }
    
    if (adresspunkteCount >= 10) {
      return Response.json({
        success: false,
        message: `Hat ${adresspunkteCount} Leads in "Adresspunkte". Erst diese bearbeiten!`,
        assigned: 0,
        currentCount: 0
      });
    }
    
    if (nichtErreichtCount >= 50) {
      return Response.json({
        success: false,
        message: `Hat ${nichtErreichtCount} Leads in "Nicht erreicht". Erst diese bearbeiten!`,
        assigned: 0,
        currentCount: 0
      });
    }
    
    // Zähle NUR AKTIVE Leads des Mitarbeiters
    const assignedLeads = allLeads.filter(l => 
      l.assigned_to_email === employeeEmail && 
      l.pool_status === 'zugewiesen' &&
      l.benutzertyp === (user.benutzertyp || 'Interner Mitarbeiter') &&
      !l.archiv_kategorie &&
      !l.verkaufschance_status &&
      !l.verloren
    );

    const currentCount = assignedLeads.length;
    const targetCount = 100;
    const minThreshold = 80;
    
    // Nur auffüllen wenn unter 80 Leads
    if (currentCount >= minThreshold) {
      return Response.json({ 
        success: true, 
        message: `Mitarbeiter hat ${currentCount} Leads (Schwelle: ${minThreshold})`,
        assigned: 0,
        currentCount 
      });
    }
    
    const needsAssignment = targetCount - currentCount;

    // Hole unzugewiesene Leads aus Pool (schließe Leads vom vorherigen MA aus)
    const poolLeads = allLeads.filter(l => 
      l.pool_status === 'im_pool' &&
      l.benutzertyp === (user.benutzertyp || 'Interner Mitarbeiter') &&
      l.vorheriger_mitarbeiter !== employeeEmail
    ).slice(0, needsAssignment);

    if (poolLeads.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Keine Leads mehr im Pool',
        assigned: 0,
        currentCount 
      });
    }

    // Weise Leads zu
    for (const lead of poolLeads) {
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        ...lead,
        pool_status: 'zugewiesen',
        assigned_to: employee.full_name,
        assigned_to_email: employee.email,
        status: 'Neu',
        google_calendar_link: employee.google_calendar_link || ''
      });
    }

    return Response.json({ 
      success: true, 
      message: `${poolLeads.length} Leads erfolgreich zugewiesen`,
      assigned: poolLeads.length,
      currentCount: currentCount + poolLeads.length
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});