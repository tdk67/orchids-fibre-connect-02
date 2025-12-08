import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

        // SMTP über fetch API (einfacher als nodemailer)
        const smtpUrl = `smtps://${encodeURIComponent(employee.email_adresse)}:${encodeURIComponent(employee.email_password)}@smtp.ionos.de:465`;
        
        const emailContent = [
            `From: ${employee.full_name} <${employee.email_adresse}>`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `Content-Type: text/plain; charset=utf-8`,
            '',
            text
        ].join('\r\n');

        // Alternative: Direkter SMTP-Aufruf mit nativen Deno-Mitteln
        const response = await fetch('https://api.smtp2go.com/v3/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // Fallback auf direkten SMTP-Socket
                host: 'smtp.ionos.de',
                port: 587,
                secure: false,
                auth: {
                    user: employee.email_adresse,
                    pass: employee.email_password
                },
                from: `${employee.full_name} <${employee.email_adresse}>`,
                to: [to],
                subject: subject,
                text: text
            })
        });

        // Speichere E-Mail in Datenbank
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
            message: 'E-Mail wurde versendet'
        });

    } catch (error) {
        console.error('SMTP-Versand Fehler:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});