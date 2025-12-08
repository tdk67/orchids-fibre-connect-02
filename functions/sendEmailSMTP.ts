import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, signature } = await req.json();

    console.log('User:', user.email);
    console.log('Payload:', { to, subject, hasBody: !!body });

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    // Get employee SMTP config
    const employees = await base44.asServiceRole.entities.Employee.list();
    const employee = employees.find(e => e.email === user.email);

    console.log('Employee found:', !!employee);
    console.log('SMTP Config:', {
      server: employee?.smtp_server,
      port: employee?.smtp_port,
      username: employee?.smtp_username,
      hasPassword: !!employee?.smtp_password
    });

    if (!employee || !employee.smtp_server || !employee.smtp_username || !employee.smtp_password) {
      return Response.json({ 
        error: 'SMTP-Konfiguration fehlt. Bitte in Mitarbeiter-Einstellungen hinterlegen.',
        details: {
          hasEmployee: !!employee,
          hasServer: !!employee?.smtp_server,
          hasUsername: !!employee?.smtp_username,
          hasPassword: !!employee?.smtp_password
        }
      }, { status: 400 });
    }

    // Prepare email body with signature
    const fullBody = signature ? `${body}\n\n${signature}` : body;

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: employee.smtp_server,
        port: employee.smtp_port || 587,
        tls: true,
        auth: {
          username: employee.smtp_username,
          password: employee.smtp_password,
        },
      },
    });

    console.log('Sending email...');

    // Send email
    await client.send({
      from: employee.email_adresse || employee.email || employee.smtp_username,
      to: to,
      subject: subject,
      content: fullBody,
    });

    await client.close();

    console.log('Email sent successfully');

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
    console.error('SMTP Error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'Fehler beim Versenden der E-Mail',
      details: error.toString()
    }, { status: 500 });
  }
});