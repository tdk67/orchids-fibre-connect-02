import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Imap from 'npm:imap@0.8.19';
import { simpleParser } from 'npm:mailparser@3.6.5';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { limit = 20 } = await req.json();

        const employees = await base44.asServiceRole.entities.Employee.list();
        const employee = employees.find(e => e.email === user.email);

        if (!employee || !employee.email_adresse || !employee.email_password) {
            return Response.json({ 
                error: 'Keine IONOS-Zugangsdaten konfiguriert',
                success: false 
            }, { status: 400 });
        }

        const imap = new Imap({
            user: employee.email_adresse,
            password: employee.email_password,
            host: 'imap.ionos.de',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        const emails = [];

        await new Promise((resolve, reject) => {
            let timeoutId;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                try {
                    imap.end();
                } catch (e) {}
            };

            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('IMAP-Verbindung Timeout'));
            }, 30000);

            imap.once('ready', () => {
                imap.openBox('INBOX', true, (err, box) => {
                    if (err) {
                        cleanup();
                        reject(err);
                        return;
                    }

                    const fetchLimit = Math.min(limit, box.messages.total);
                    if (fetchLimit === 0) {
                        cleanup();
                        resolve();
                        return;
                    }

                    const startSeq = Math.max(1, box.messages.total - fetchLimit + 1);
                    const fetch = imap.seq.fetch(`${startSeq}:${box.messages.total}`, {
                        bodies: '',
                        struct: true
                    });

                    let processed = 0;

                    fetch.on('message', (msg) => {
                        msg.on('body', (stream) => {
                            simpleParser(stream, (err, parsed) => {
                                if (!err && parsed) {
                                    emails.push({
                                        betreff: parsed.subject || '(Kein Betreff)',
                                        absender: parsed.from?.text || '',
                                        empfaenger: employee.email_adresse,
                                        nachricht: parsed.text || parsed.html || '',
                                        mitarbeiter_email: employee.email_adresse,
                                        mitarbeiter_name: employee.full_name,
                                        sparte: employee.sparte,
                                        typ: 'Eingang',
                                        gelesen: false,
                                        timestamp: parsed.date ? parsed.date.toISOString() : new Date().toISOString()
                                    });
                                }
                                processed++;
                            });
                        });
                    });

                    fetch.once('end', () => {
                        setTimeout(() => {
                            cleanup();
                            resolve();
                        }, 1000);
                    });

                    fetch.once('error', (err) => {
                        cleanup();
                        reject(err);
                    });
                });
            });

            imap.once('error', (err) => {
                cleanup();
                reject(err);
            });

            imap.once('end', () => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve();
            });

            imap.connect();
        });

        const existingEmails = await base44.asServiceRole.entities.Email.list();
        const newEmails = [];

        for (const email of emails) {
            const exists = existingEmails.some(e => 
                e.betreff === email.betreff &&
                e.absender === email.absender &&
                Math.abs(new Date(e.timestamp) - new Date(email.timestamp)) < 60000
            );

            if (!exists) {
                await base44.asServiceRole.entities.Email.create(email);
                newEmails.push(email);
            }
        }

        return Response.json({ 
            success: true,
            fetched: emails.length,
            new: newEmails.length
        });

    } catch (error) {
        console.error('IONOS E-Mail Abruf Fehler:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});