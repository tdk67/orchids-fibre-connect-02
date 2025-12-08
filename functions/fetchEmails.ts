import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { ImapFlow } from 'npm:imapflow@1.0.164';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { employee_email, limit = 50 } = await req.json();

        // Hole Mitarbeiter-Daten
        const employees = await base44.asServiceRole.entities.Employee.list();
        const employee = employees.find(e => e.email === employee_email);

        if (!employee || !employee.email_login || !employee.email_password) {
            return Response.json({ 
                error: 'Keine E-Mail-Zugangsdaten für diesen Mitarbeiter hinterlegt',
                success: false 
            }, { status: 400 });
        }

        // IMAP-Server-Konfiguration (Standard für die meisten Provider)
        const imapConfig = {
            host: employee.imap_server || 'imap.gmail.com',
            port: employee.imap_port || 993,
            secure: true,
            auth: {
                user: employee.email_login,
                pass: employee.email_password
            },
            logger: false
        };

        const client = new ImapFlow(imapConfig);
        
        try {
            await client.connect();
            
            // INBOX öffnen
            const lock = await client.getMailboxLock('INBOX');
            
            try {
                // Letzte X E-Mails abrufen
                const messages = [];
                
                // Alle E-Mails im Postfach
                for await (let message of client.fetch('1:*', { 
                    envelope: true, 
                    bodyStructure: true,
                    source: true 
                })) {
                    const from = message.envelope.from?.[0];
                    const to = message.envelope.to?.[0];
                    
                    // Body-Text extrahieren
                    let bodyText = '';
                    if (message.source) {
                        const decoder = new TextDecoder('utf-8');
                        const sourceText = decoder.decode(message.source);
                        
                        // Einfache Text-Extraktion
                        const bodyMatch = sourceText.match(/\r?\n\r?\n([\s\S]*)/);
                        if (bodyMatch) {
                            bodyText = bodyMatch[1].substring(0, 5000); // Limit für Speicherung
                        }
                    }
                    
                    messages.push({
                        betreff: message.envelope.subject || '(Kein Betreff)',
                        absender: from ? `${from.name || ''} <${from.address}>`.trim() : 'Unbekannt',
                        empfaenger: to ? `${to.name || ''} <${to.address}>`.trim() : employee.email_login,
                        nachricht: bodyText || 'Keine Nachricht verfügbar',
                        mitarbeiter_email: employee.email,
                        mitarbeiter_name: employee.full_name,
                        sparte: employee.sparte,
                        typ: 'Eingang',
                        gelesen: false,
                        timestamp: message.envelope.date?.toISOString() || new Date().toISOString()
                    });
                    
                    if (messages.length >= limit) break;
                }
                
                // E-Mails in Datenbank speichern (nur neue)
                const existingEmails = await base44.asServiceRole.entities.Email.list();
                const newEmails = [];
                
                for (const msg of messages) {
                    // Prüfe ob E-Mail bereits existiert (anhand Betreff + Timestamp)
                    const exists = existingEmails.some(e => 
                        e.betreff === msg.betreff && 
                        e.timestamp === msg.timestamp &&
                        e.absender === msg.absender
                    );
                    
                    if (!exists) {
                        newEmails.push(msg);
                    }
                }
                
                if (newEmails.length > 0) {
                    await base44.asServiceRole.entities.Email.bulkCreate(newEmails);
                }
                
                return Response.json({ 
                    success: true, 
                    fetched: messages.length,
                    new: newEmails.length,
                    messages: newEmails
                });
                
            } finally {
                lock.release();
            }
            
        } finally {
            await client.logout();
        }

    } catch (error) {
        console.error('E-Mail-Abruf Fehler:', error);
        return Response.json({ 
            error: error.message,
            success: false,
            details: 'Bitte IMAP-Server, Port und Zugangsdaten in den Mitarbeiter-Einstellungen prüfen'
        }, { status: 500 });
    }
});