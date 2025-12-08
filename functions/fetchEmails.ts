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

        const { limit = 50 } = await req.json();

        const employees = await base44.asServiceRole.entities.Employee.list();
        const employee = employees.find(e => e.email === user.email);

        if (!employee || !employee.email_adresse || !employee.email_password || !employee.imap_server) {
            return Response.json({ 
                error: 'Keine E-Mail-Zugangsdaten konfiguriert',
                success: false 
            }, { status: 400 });
        }

        const imap = new Imap({
            user: employee.email_adresse,
            password: employee.email_password,
            host: employee.imap_server,
            port: employee.imap_port || 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        const emails = [];

        await new Promise((resolve, reject) => {
            imap.once('ready', () => {
                imap.openBox('INBOX', true, (err, box) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const fetchLimit = Math.min(limit, box.messages.total);
                    if (fetchLimit === 0) {
                        imap.end();
                        resolve();
                        return;
                    }

                    const fetch = imap.seq.fetch(`${box.messages.total - fetchLimit + 1}:*`, {
                        bodies: '',
                        struct: true
                    });

                    fetch.on('message', (msg) => {
                        msg.on('body', (stream) => {
                            simpleParser(stream, async (err, parsed) => {
                                if (err) return;

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
                            });
                        });
                    });

                    fetch.once('end', () => {
                        imap.end();
                    });
                });
            });

            imap.once('error', (err) => {
                reject(err);
            });

            imap.once('end', () => {
                resolve();
            });

            imap.connect();
        });

        // Check for duplicates and save
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
        console.error('E-Mail Abruf Fehler:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});