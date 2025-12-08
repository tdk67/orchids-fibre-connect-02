import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get employee IMAP config
    const employees = await base44.asServiceRole.entities.Employee.filter({ email: user.email });
    const employee = employees[0];

    if (!employee || !employee.imap_server || !employee.imap_username || !employee.imap_password) {
      return Response.json({ 
        error: 'IMAP-Konfiguration fehlt. Bitte in Mitarbeiter-Einstellungen hinterlegen.' 
      }, { status: 400 });
    }

    const { limit = 20 } = await req.json().catch(() => ({}));

    // Use Deno's native TCP connection for IMAP
    const conn = await Deno.connect({
      hostname: employee.imap_server,
      port: employee.imap_port || 993,
      transport: "tcp",
    });

    // Upgrade to TLS
    const tlsConn = await Deno.startTls(conn, { hostname: employee.imap_server });
    
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Helper to read response
    const readResponse = async () => {
      const buffer = new Uint8Array(4096);
      const n = await tlsConn.read(buffer);
      return decoder.decode(buffer.subarray(0, n));
    };

    // Helper to send command
    const sendCommand = async (command) => {
      await tlsConn.write(encoder.encode(command + "\r\n"));
      return await readResponse();
    };

    // Read greeting
    await readResponse();

    // Login
    await sendCommand(`a1 LOGIN ${employee.imap_username} ${employee.imap_password}`);
    
    // Select INBOX
    await sendCommand('a2 SELECT INBOX');
    
    // Search for recent emails
    const searchResp = await sendCommand(`a3 SEARCH 1:${limit}`);
    
    // Parse email IDs from search response
    const emailIds = searchResp.match(/\* SEARCH ([\d\s]+)/)?.[1]?.trim().split(' ').reverse() || [];
    
    const emails = [];

    // Fetch each email
    for (const id of emailIds.slice(0, limit)) {
      const fetchResp = await sendCommand(`a4 FETCH ${id} (BODY[HEADER.FIELDS (FROM SUBJECT DATE)] BODY[TEXT])`);
      
      // Parse email data
      const fromMatch = fetchResp.match(/From: ([^\r\n]+)/i);
      const subjectMatch = fetchResp.match(/Subject: ([^\r\n]+)/i);
      const dateMatch = fetchResp.match(/Date: ([^\r\n]+)/i);
      
      // Extract body text (simplified)
      const bodyMatch = fetchResp.match(/BODY\[TEXT\]\s*\{[\d]+\}\r\n([\s\S]+?)(?=\r\n\)|$)/);
      
      emails.push({
        id: id,
        from: fromMatch?.[1] || 'Unknown',
        subject: subjectMatch?.[1] || '(Kein Betreff)',
        date: dateMatch?.[1] || new Date().toISOString(),
        body: bodyMatch?.[1]?.trim().substring(0, 500) || '(Keine Nachricht)'
      });
    }

    // Logout
    await sendCommand('a5 LOGOUT');
    tlsConn.close();

    return Response.json({ 
      success: true,
      emails: emails
    });

  } catch (error) {
    console.error('IMAP Error:', error);
    return Response.json({ 
      error: error.message || 'Fehler beim Abrufen der E-Mails'
    }, { status: 500 });
  }
});