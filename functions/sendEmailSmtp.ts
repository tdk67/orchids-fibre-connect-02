import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import nodemailer from 'npm:nodemailer@6.9.15';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { to, subject, text } = await req.json();

        const employees = await base44.asServiceRole.entities.Employee.list();
        const employee = employees.find(e => e.email === user.email);

        if (!employee || !employee.email_adresse || !employee.email_password) {
            return Response.json({ 
                error: 'Keine IONOS-Zugangsdaten konfiguriert. Bitte in Mitarbeitereinstellungen hinterlegen.',
                success: false 
            }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.ionos.de',
            port: 587,
            secure: false,
            auth: {
                user: employee.email_adresse,
                pass: employee.email_password
            }
        });

        await transporter.sendMail({
            from: `"${employee.full_name}" <${employee.email_adresse}>`,
            to: to,
            subject: subject,
            text: text
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
            timestamp: new Date().toISOString()
        });

        return Response.json({ 
            success: true,
            message: 'E-Mail erfolgreich versendet'
        });

    } catch (error) {
        console.error('SMTP Fehler:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});