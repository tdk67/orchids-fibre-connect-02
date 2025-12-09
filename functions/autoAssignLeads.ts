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

    // Zähle aktuelle Leads des Mitarbeiters (zugewiesen, nicht bearbeitet)
    const allLeads = await base44.asServiceRole.entities.Lead.list();
    const assignedLeads = allLeads.filter(l => 
      l.assigned_to_email === employeeEmail && 
      l.pool_status === 'zugewiesen' &&
      l.benutzertyp === (user.benutzertyp || 'Interner Mitarbeiter')
    );

    const currentCount = assignedLeads.length;
    const targetCount = 50;
    const needsAssignment = targetCount - currentCount;

    if (needsAssignment <= 0) {
      return Response.json({ 
        success: true, 
        message: 'Mitarbeiter hat bereits 50 Leads',
        assigned: 0,
        currentCount 
      });
    }

    // Hole unzugewiesene Leads aus Pool
    const poolLeads = allLeads.filter(l => 
      l.pool_status === 'im_pool' &&
      l.benutzertyp === (user.benutzertyp || 'Interner Mitarbeiter')
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