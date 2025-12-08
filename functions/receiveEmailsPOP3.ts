import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Client as Pop3Client } from 'npm:node-pop3@0.8.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get employee POP3 settings
    const employees = await base44.asServiceRole.entities.Employee.filter({ email: user.email });
    if (!employees || employees.length === 0) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];

    if (!employee.pop3_server || !employee.pop3_username || !employee.pop3_password) {
      return Response.json({ 
        error: 'POP3 credentials not configured. Please update your settings.' 
      }, { status: 400 });
    }

    // Connect to POP3
    const client = new Pop3Client({
      host: employee.pop3_server,
      port: employee.pop3_port || 995,
      tls: true,
      username: employee.pop3_username,
      password: employee.pop3_password,
    });

    await client.connect();
    const messages = await client.retrieveAll();
    await client.quit();

    // Get existing emails to avoid duplicates
    const existingEmails = await base44.asServiceRole.entities.Email.filter({
      mitarbeiter_email: user.email,
      typ: 'Eingang'
    });

    const newEmails = [];

    for (const msg of messages) {
      const subject = msg.headers.subject || 'Kein Betreff';
      const from = msg.headers.from || 'Unbekannt';
      const body = msg.text || msg.html || '';
      const timestamp = msg.headers.date ? new Date(msg.headers.date).toISOString() : new Date().toISOString();

      // Check if email already exists
      const exists = existingEmails.some(e => 
        e.betreff === subject && 
        e.absender === from && 
        e.timestamp === timestamp
      );

      if (!exists) {
        const emailData = {
          betreff: subject,
          absender: from,
          empfaenger: employee.pop3_username,
          nachricht: body,
          mitarbeiter_email: user.email,
          mitarbeiter_name: employee.full_name,
          sparte: employee.sparte || 'Backoffice',
          typ: 'Eingang',
          gelesen: false,
          timestamp: timestamp
        };

        await base44.asServiceRole.entities.Email.create(emailData);
        newEmails.push(emailData);
      }
    }

    return Response.json({ 
      success: true, 
      newEmailsCount: newEmails.length,
      totalMessages: messages.length
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});