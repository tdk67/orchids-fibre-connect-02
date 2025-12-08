import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import nodemailer from 'npm:nodemailer@6.9.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get employee SMTP settings
    const employees = await base44.asServiceRole.entities.Employee.filter({ email: user.email });
    
    if (!employees || employees.length === 0) {
      return Response.json({ 
        error: 'Kein Mitarbeiter-Profil gefunden. Bitte kontaktieren Sie Ihren Administrator.' 
      }, { status: 404 });
    }

    const employee = employees[0];

    if (!employee.smtp_server || !employee.smtp_username || !employee.smtp_password) {
      return Response.json({ 
        error: 'SMTP-Zugangsdaten nicht konfiguriert. Bitte in Mitarbeiter-Einstellungen hinterlegen.' 
      }, { status: 400 });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: employee.smtp_server,
      port: employee.smtp_port || 587,
      secure: employee.smtp_port === 465,
      auth: {
        user: employee.smtp_username,
        pass: employee.smtp_password,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"${employee.full_name}" <${employee.smtp_username}>`,
      to: to,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });

    // Save to database
    await base44.asServiceRole.entities.Email.create({
      betreff: subject,
      absender: employee.smtp_username,
      empfaenger: to,
      nachricht: body,
      mitarbeiter_email: user.email,
      mitarbeiter_name: employee.full_name,
      sparte: employee.sparte || 'Backoffice',
      typ: 'Ausgang',
      gelesen: true,
      timestamp: new Date().toISOString()
    });

    return Response.json({ 
      success: true, 
      messageId: info.messageId 
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});