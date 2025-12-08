import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, signature } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get employee SMTP config
    const employees = await base44.asServiceRole.entities.Employee.list();
    const employee = employees.find(e => e.email === user.email);

    if (!employee || !employee.smtp_server || !employee.smtp_username || !employee.smtp_password) {
      return Response.json({ 
        error: 'SMTP-Konfiguration fehlt. Bitte in Mitarbeiter-Einstellungen hinterlegen.'
      }, { status: 400 });
    }

    // Prepare email body with signature
    const fullBody = signature ? `${body}\n\n${signature}` : body;

    // Use native fetch to call an email API
    const response = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: Deno.env.get('SMTP2GO_API_KEY'),
        sender: employee.email_adresse || employee.smtp_username,
        to: [to],
        subject: subject,
        text_body: fullBody,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send email via SMTP2GO');
    }

    // Save to Email entity
    await base44.asServiceRole.entities.Email.create({
      betreff: subject,
      empfaenger: to,
      nachricht: fullBody,
      mitarbeiter_email: user.email,
      mitarbeiter_name: user.full_name,
      timestamp: new Date().toISOString()
    });

    return Response.json({ 
      success: true,
      message: 'E-Mail erfolgreich versendet'
    });

  } catch (error) {
    console.error('Email Error:', error);
    return Response.json({ 
      error: error.message || 'Fehler beim Versenden der E-Mail'
    }, { status: 500 });
  }
});