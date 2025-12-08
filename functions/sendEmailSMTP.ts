import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import nodemailer from 'npm:nodemailer@6.9.8';

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

    // Create transporter - use port 465 with SSL for IONOS
    const transporter = nodemailer.createTransport({
      host: employee.smtp_server,
      port: 465, // Force SSL port for Deno Deploy
      secure: true, // Use SSL
      auth: {
        user: employee.smtp_username,
        pass: employee.smtp_password,
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"${employee.full_name || user.full_name}" <${employee.email_adresse || employee.smtp_username}>`,
      to: to,
      subject: subject,
      text: fullBody,
    });

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
    return Response.json({ 
      error: error.message || 'Fehler beim Versenden der E-Mail'
    }, { status: 500 });
  }
});