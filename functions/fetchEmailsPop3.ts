import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { limit = 100 } = await req.json();

        const employees = await base44.asServiceRole.entities.Employee.list();
        const employee = employees.find(e => e.email === user.email);

        if (!employee || !employee.email_adresse || !employee.email_password) {
            return Response.json({ 
                error: 'Keine IONOS-Zugangsdaten konfiguriert',
                success: false 
            }, { status: 400 });
        }

        // Verbindung zu POP3
        const conn = await Deno.connect({
            hostname: 'pop.ionos.de',
            port: 995,
            transport: 'tcp',
        });

        const tlsConn = await Deno.startTls(conn, { hostname: 'pop.ionos.de' });
        
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        // POP3-Befehle
        const sendCommand = async (command) => {
            await tlsConn.write(encoder.encode(command + '\r\n'));
            const buffer = new Uint8Array(4096);
            const n = await tlsConn.read(buffer);
            return decoder.decode(buffer.subarray(0, n));
        };

        // Login
        await sendCommand(`USER ${employee.email_adresse}`);
        await sendCommand(`PASS ${employee.email_password}`);
        
        // Anzahl Nachrichten abrufen
        const statResponse = await sendCommand('STAT');
        const messageCount = parseInt(statResponse.split(' ')[1]);
        
        const emails = [];
        const fetchCount = Math.min(limit, messageCount);

        // Letzte X E-Mails abrufen
        for (let i = messageCount; i > messageCount - fetchCount && i > 0; i--) {
            const retrResponse = await sendCommand(`RETR ${i}`);
            
            // Parse E-Mail-Header und Body
            const lines = retrResponse.split('\r\n');
            let subject = '';
            let from = '';
            let body = '';
            let inBody = false;
            
            for (const line of lines) {
                if (line.startsWith('Subject:')) {
                    subject = line.substring(8).trim();
                } else if (line.startsWith('From:')) {
                    from = line.substring(5).trim();
                } else if (line === '') {
                    inBody = true;
                } else if (inBody && line !== '.') {
                    body += line + '\n';
                }
            }

            if (subject && from) {
                emails.push({
                    betreff: subject,
                    absender: from,
                    empfaenger: employee.email_adresse,
                    nachricht: body.trim(),
                    mitarbeiter_email: employee.email_adresse,
                    mitarbeiter_name: employee.full_name,
                    sparte: employee.sparte,
                    typ: 'Eingang',
                    gelesen: false,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Verbindung schließen
        await sendCommand('QUIT');
        tlsConn.close();

        // Nur neue E-Mails speichern
        const existingEmails = await base44.asServiceRole.entities.Email.list();
        let newCount = 0;

        for (const email of emails) {
            const exists = existingEmails.some(e => 
                e.betreff === email.betreff &&
                e.absender === email.absender &&
                Math.abs(new Date(e.timestamp) - new Date(email.timestamp)) < 300000
            );

            if (!exists) {
                await base44.asServiceRole.entities.Email.create(email);
                newCount++;
            }
        }

        return Response.json({ 
            success: true,
            fetched: emails.length,
            new: newCount
        });

    } catch (error) {
        console.error('POP3-Abruf Fehler:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});