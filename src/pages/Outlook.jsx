import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, Inbox, Settings, Plus, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Outlook() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('inbox');
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [signature, setSignature] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [composeForm, setComposeForm] = useState({
    empfaenger: '',
    betreff: '',
    nachricht: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      // Load signature from user data
      if (u.email_signature) {
        setSignature(u.email_signature);
      }
    }).catch(() => {});
  }, []);

  const { data: emails = [] } = useQuery({
    queryKey: ['emails'],
    queryFn: () => base44.entities.Email.list('-timestamp'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const createEmailMutation = useMutation({
    mutationFn: (data) => base44.entities.Email.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['emails']);
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: (id) => base44.entities.Email.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['emails']);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      setShowSettingsDialog(false);
    },
  });

  // Filter emails based on user
  const currentEmployee = employees.find(e => e.email === user?.email);
  const userEmails = emails.filter(e => 
    e.mitarbeiter_email === user?.email || user?.role === 'admin'
  );

  const inboxEmails = userEmails.filter(e => e.typ === 'Eingang');
  const sentEmails = userEmails.filter(e => e.typ === 'Ausgang');

  const handleSendEmail = async () => {
    if (!composeForm.empfaenger || !composeForm.betreff || !composeForm.nachricht) {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    setIsSending(true);
    try {
      // Add signature if exists
      const messageWithSignature = signature 
        ? `${composeForm.nachricht}\n\n---\n${signature}`
        : composeForm.nachricht;

      // Send email via Base44
      await base44.integrations.Core.SendEmail({
        to: composeForm.empfaenger,
        subject: composeForm.betreff,
        body: messageWithSignature,
        from_name: currentEmployee?.full_name || user?.full_name || user?.email
      });

      // Save to database
      await createEmailMutation.mutateAsync({
        betreff: composeForm.betreff,
        absender: currentEmployee?.email_adresse || user?.email,
        empfaenger: composeForm.empfaenger,
        nachricht: messageWithSignature,
        mitarbeiter_email: user?.email,
        mitarbeiter_name: user?.full_name,
        sparte: currentEmployee?.sparte || 'Backoffice',
        typ: 'Ausgang',
        gelesen: true,
        timestamp: new Date().toISOString()
      });

      alert('E-Mail erfolgreich versendet!');
      setShowComposeDialog(false);
      setComposeForm({ empfaenger: '', betreff: '', nachricht: '' });
    } catch (error) {
      alert('Fehler beim Versenden: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleReceiveEmails = async () => {
    try {
      const response = await base44.functions.invoke('receiveEmailsIMAP', {});
      if (response.data.success) {
        queryClient.invalidateQueries(['emails']);
        alert(`${response.data.newEmailsCount} neue E-Mails abgerufen!`);
      } else {
        alert('Fehler: ' + response.data.error);
      }
    } catch (error) {
      alert('Fehler beim E-Mail-Abruf: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSaveSignature = async () => {
    try {
      await updateUserMutation.mutateAsync({ email_signature: signature });
      alert('Signatur gespeichert!');
    } catch (error) {
      alert('Fehler beim Speichern: ' + error.message);
    }
  };

  const handleDeleteEmail = (emailId) => {
    if (confirm('E-Mail wirklich löschen?')) {
      deleteEmailMutation.mutate(emailId);
    }
  };

  const handleNewEmail = (recipient = '') => {
    setComposeForm({ empfaenger: recipient, betreff: '', nachricht: '' });
    setShowComposeDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">E-Mail</h1>
          <p className="text-slate-500 mt-1">Ihre E-Mail Verwaltung</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReceiveEmails}>
            <Inbox className="h-4 w-4 mr-2" />
            E-Mails abrufen
          </Button>
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Einstellungen
          </Button>
          <Button onClick={() => handleNewEmail()} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="h-4 w-4 mr-2" />
            Neue E-Mail
          </Button>
        </div>
      </div>

      {/* Email Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Posteingang</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{inboxEmails.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                <Inbox className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Gesendet</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{sentEmails.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600">
                <Send className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Ungelesen</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {inboxEmails.filter(e => !e.gelesen).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
                <Mail className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="inbox">
                Posteingang ({inboxEmails.length})
              </TabsTrigger>
              <TabsTrigger value="sent">
                Gesendet ({sentEmails.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {(activeTab === 'inbox' ? inboxEmails : sentEmails).map((email) => (
              <div key={email.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={email.typ === 'Eingang' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {email.typ}
                      </Badge>
                      {!email.gelesen && (
                        <Badge className="bg-red-100 text-red-800">Neu</Badge>
                      )}
                      <span className="text-xs text-slate-500">
                        {email.timestamp ? format(new Date(email.timestamp), 'dd.MM.yyyy HH:mm', { locale: de }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <p className="font-semibold text-slate-900">{email.betreff}</p>
                    </div>
                    <p className="text-sm text-slate-600">
                      {email.typ === 'Eingang' ? `Von: ${email.absender}` : `An: ${email.empfaenger}`}
                    </p>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">{email.nachricht}</p>
                  </div>
                  <div className="flex gap-2">
                    {email.typ === 'Eingang' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleNewEmail(email.absender)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEmail(email.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(activeTab === 'inbox' ? inboxEmails : sentEmails).length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <Mail className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p>Keine E-Mails vorhanden</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose Dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neue E-Mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>An *</Label>
              <Input
                type="email"
                value={composeForm.empfaenger}
                onChange={(e) => setComposeForm({ ...composeForm, empfaenger: e.target.value })}
                placeholder="empfaenger@beispiel.de"
              />
            </div>
            <div className="space-y-2">
              <Label>Betreff *</Label>
              <Input
                value={composeForm.betreff}
                onChange={(e) => setComposeForm({ ...composeForm, betreff: e.target.value })}
                placeholder="Betreffzeile"
              />
            </div>
            <div className="space-y-2">
              <Label>Nachricht *</Label>
              <Textarea
                value={composeForm.nachricht}
                onChange={(e) => setComposeForm({ ...composeForm, nachricht: e.target.value })}
                rows={10}
                placeholder="Ihre Nachricht..."
              />
              {signature && (
                <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                  <strong>Signatur wird hinzugefügt:</strong>
                  <pre className="mt-1 whitespace-pre-wrap">{signature}</pre>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowComposeDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSendEmail} disabled={isSending} className="bg-blue-900 hover:bg-blue-800">
                {isSending ? 'Sende...' : 'Senden'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>E-Mail Einstellungen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900 font-semibold mb-2">
                SMTP & IMAP Konfiguration
              </p>
              <p className="text-xs text-blue-800">
                Bitte kontaktieren Sie Ihren Administrator, um Ihre E-Mail-Server-Zugangsdaten (SMTP/IMAP) zu konfigurieren.
                Diese werden in Ihren Mitarbeiter-Einstellungen hinterlegt.
              </p>
            </div>
            <div className="space-y-2">
              <Label>E-Mail Signatur</Label>
              <Textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                rows={6}
                placeholder="Mit freundlichen Grüßen&#10;Ihr Name&#10;Firma&#10;Telefon"
              />
              <p className="text-xs text-slate-500">
                Diese Signatur wird automatisch an alle ausgehenden E-Mails angehängt.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveSignature} className="bg-blue-900 hover:bg-blue-800">
                Signatur speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}