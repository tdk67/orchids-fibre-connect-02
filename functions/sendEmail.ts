import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import nodemailer from 'npm:nodemailer@6.9.7';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { to, subject, text, html, attachments = [] } = await req.json();

        const employees = await base44.asServiceRole.entities.Employee.list();
        const employee = employees.find(e => e.email === user.email);

        if (!employee || !employee.email_adresse || !employee.email_password || !employee.smtp_server) {
            return Response.json({ 
                error: 'Keine SMTP-Zugangsdaten konfiguriert',
                success: false 
            }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: employee.smtp_server,
            port: employee.smtp_port || 587,
            secure: employee.smtp_port === 465,
            auth: {
                user: employee.email_adresse,
                pass: employee.email_password
            }
        });

        const info = await transporter.sendMail({
            from: `"${employee.full_name}" <${employee.email_adresse}>`,
            to: to,
            subject: subject,
            text: text,
            html: html || text,
            attachments: attachments
        });

        await base44.asServiceRole.entities.Email.create({
            betreff: subject,
            absender: employee.email_adresse,
            empfaenger: to,
            nachricht: text,
            mitarbeiter_email: employee.email_adresse,
            mitarbeiter_name: employee.full_name,
            sparte: employee.sparte,
            typ: 'Ausgang',
            gelesen: true,
            anhaenge: attachments.map(a => a.filename || ''),
            timestamp: new Date().toISOString()
        });

        return Response.json({ 
            success: true,
            messageId: info.messageId
        });

    } catch (error) {
        console.error('E-Mail-Versand Fehler:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});