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

    // Get employee IMAP settings
    const allEmployees = await base44.asServiceRole.entities.Employee.list();
    const employee = allEmployees.find(e => e.email === user.email || e.email_adresse === user.email);
    
    if (!employee) {
      return Response.json({ 
        error: `Kein Mitarbeiter-Profil gefunden für ${user.email}. Bitte im Admin-Bereich Mitarbeiter anlegen.` 
      }, { status: 404 });
    }

    if (!employee.imap_server || !employee.imap_username || !employee.imap_password) {
      return Response.json({ 
        error: 'IMAP-Zugangsdaten nicht konfiguriert. Bitte in Mitarbeiter-Einstellungen hinterlegen.' 
      }, { status: 400 });
    }

    // Connect to IMAP
    const imap = new Imap({
      user: employee.imap_username,
      password: employee.imap_password,
      host: employee.imap_server,
      port: employee.imap_port || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    const emails = [];

    await new Promise((resolve, reject) => {
      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          // Fetch last 20 emails
          const fetchCount = Math.min(20, box.messages.total);
          if (fetchCount === 0) {
            imap.end();
            resolve();
            return;
          }

          const fetch = imap.seq.fetch(`${Math.max(1, box.messages.total - fetchCount + 1)}:*`, {
            bodies: '',
            struct: true
          });

          fetch.on('message', (msg) => {
            let buffer = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });

            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(buffer);
                emails.push({
                  subject: parsed.subject || 'Kein Betreff',
                  from: parsed.from?.text || 'Unbekannt',
                  to: parsed.to?.text || employee.imap_username,
                  text: parsed.text || parsed.html || '',
                  date: parsed.date || new Date()
                });
              } catch (e) {
                console.error('Parse error:', e);
              }
            });
          });

          fetch.once('error', reject);
          fetch.once('end', () => {
            imap.end();
          });
        });
      });

      imap.once('error', reject);
      imap.once('end', resolve);
      imap.connect();
    });

    // Get existing emails to avoid duplicates
    const existingEmails = await base44.asServiceRole.entities.Email.filter({
      mitarbeiter_email: user.email,
      typ: 'Eingang'
    });

    let newEmailsCount = 0;

    for (const email of emails) {
      // Check if email already exists
      const exists = existingEmails.some(e => 
        e.betreff === email.subject && 
        e.absender === email.from &&
        Math.abs(new Date(e.timestamp).getTime() - new Date(email.date).getTime()) < 60000
      );

      if (!exists) {
        await base44.asServiceRole.entities.Email.create({
          betreff: email.subject,
          absender: email.from,
          empfaenger: email.to,
          nachricht: email.text,
          mitarbeiter_email: user.email,
          mitarbeiter_name: employee.full_name,
          sparte: employee.sparte || 'Backoffice',
          typ: 'Eingang',
          gelesen: false,
          timestamp: new Date(email.date).toISOString()
        });
        newEmailsCount++;
      }
    }

    return Response.json({ 
      success: true, 
      newEmailsCount: newEmailsCount,
      totalFetched: emails.length
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});