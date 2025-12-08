import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, Plus, Settings, RefreshCw, Inbox, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Outlook() {
  const [user, setUser] = useState(null);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [signature, setSignature] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivedEmails, setReceivedEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [composeForm, setComposeForm] = useState({
    to: '',
    subject: '',
    body: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      if (u.email_signature) {
        setSignature(u.email_signature);
      }
    }).catch(() => {});
  }, []);

  const { data: sentEmails = [] } = useQuery({
    queryKey: ['emails'],
    queryFn: () => base44.entities.Email.list('-timestamp'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
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

  const currentEmployee = employees.find(e => e.email === user?.email);
  const userSentEmails = sentEmails.filter(e => 
    e.mitarbeiter_email === user?.email || user?.role === 'admin'
  );

  const hasEmailConfig = currentEmployee?.smtp_server && currentEmployee?.imap_server;

  const handleSendEmail = async () => {
    if (!composeForm.to || !composeForm.subject || !composeForm.body) {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    if (!hasEmailConfig) {
      alert('Bitte konfigurieren Sie zuerst Ihre E-Mail-Einstellungen in der Mitarbeiterverwaltung.');
      return;
    }

    setIsSending(true);
    try {
      const response = await base44.functions.invoke('sendEmailSMTP', {
        to: composeForm.to,
        subject: composeForm.subject,
        body: composeForm.body,
        signature: signature
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      alert('E-Mail erfolgreich versendet!');
      setShowComposeDialog(false);
      setComposeForm({ to: '', subject: '', body: '' });
      queryClient.invalidateQueries(['emails']);
    } catch (error) {
      alert('Fehler beim Versenden: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleReceiveEmails = async () => {
    if (!hasEmailConfig) {
      alert('Bitte konfigurieren Sie zuerst Ihre E-Mail-Einstellungen in der Mitarbeiterverwaltung.');
      return;
    }

    setIsReceiving(true);
    try {
      const response = await base44.functions.invoke('receiveEmailsIMAP', { limit: 20 });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setReceivedEmails(response.data.emails || []);
      alert(`${response.data.emails?.length || 0} E-Mails abgerufen!`);
    } catch (error) {
      alert('Fehler beim Abrufen: ' + error.message);
    } finally {
      setIsReceiving(false);
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
    setComposeForm({ to: recipient, subject: '', body: '' });
    setShowComposeDialog(true);
  };

  const handleReply = (email) => {
    setComposeForm({
      to: email.from,
      subject: `Re: ${email.subject}`,
      body: `\n\n---\nAm ${email.date} schrieb ${email.from}:\n${email.body}`
    });
    setShowComposeDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">E-Mail</h1>
          <p className="text-slate-500 mt-1">IONOS E-Mail-Client (SMTP/IMAP)</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Signatur
          </Button>
          <Button onClick={() => handleNewEmail()} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="h-4 w-4 mr-2" />
            Neue E-Mail
          </Button>
        </div>
      </div>

      {!hasEmailConfig && (
        <Card className="border-0 shadow-md bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-amber-900 font-semibold">
              ⚠️ E-Mail-Konfiguration fehlt! Bitte konfigurieren Sie SMTP/IMAP in der Mitarbeiterverwaltung.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Gesendet</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{userSentEmails.length}</p>
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
                <p className="text-sm font-medium text-slate-500">Empfangen</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{receivedEmails.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                <Inbox className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle>Postfach</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReceiveEmails}
              disabled={isReceiving || !hasEmailConfig}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isReceiving ? 'animate-spin' : ''}`} />
              {isReceiving ? 'Lade...' : 'Abrufen'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="received" className="w-full">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="received" className="flex-1">
                Posteingang ({receivedEmails.length})
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex-1">
                Gesendet ({userSentEmails.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="m-0">
              <div className="divide-y divide-slate-100">
                {receivedEmails.map((email, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <p className="font-semibold text-slate-900">{email.subject}</p>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">Von: {email.from}</p>
                        <p className="text-sm text-slate-500 line-clamp-2">{email.body}</p>
                        <p className="text-xs text-slate-400 mt-2">{email.date}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReply(email);
                        }}
                      >
                        Antworten
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {receivedEmails.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p>Keine E-Mails im Posteingang</p>
                  <Button 
                    variant="outline" 
                    onClick={handleReceiveEmails}
                    className="mt-4"
                    disabled={!hasEmailConfig}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Jetzt abrufen
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent" className="m-0">
              <div className="divide-y divide-slate-100">
                {userSentEmails.map((email) => (
                  <div key={email.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs text-slate-500">
                            {email.timestamp ? format(new Date(email.timestamp), 'dd.MM.yyyy HH:mm', { locale: de }) : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <Send className="h-4 w-4 text-slate-400" />
                          <p className="font-semibold text-slate-900">{email.betreff}</p>
                        </div>
                        <p className="text-sm text-slate-600">An: {email.empfaenger}</p>
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{email.nachricht}</p>
                      </div>
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
                ))}
              </div>
              {userSentEmails.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Send className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p>Noch keine E-Mails versendet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      {selectedEmail && (
        <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedEmail.subject}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm"><strong>Von:</strong> {selectedEmail.from}</p>
                <p className="text-xs text-slate-500 mt-1">{selectedEmail.date}</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-slate-700">{selectedEmail.body}</pre>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSelectedEmail(null)}>
                  Schließen
                </Button>
                <Button onClick={() => {
                  handleReply(selectedEmail);
                  setSelectedEmail(null);
                }} className="bg-blue-900 hover:bg-blue-800">
                  Antworten
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Compose Dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neue E-Mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-900">
                <strong>Absender:</strong> {currentEmployee?.email_adresse || user?.email}
              </p>
            </div>
            <div className="space-y-2">
              <Label>An *</Label>
              <Input
                type="email"
                value={composeForm.to}
                onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                placeholder="empfaenger@beispiel.de"
              />
            </div>
            <div className="space-y-2">
              <Label>Betreff *</Label>
              <Input
                value={composeForm.subject}
                onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                placeholder="Betreffzeile"
              />
            </div>
            <div className="space-y-2">
              <Label>Nachricht *</Label>
              <Textarea
                value={composeForm.body}
                onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
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
            <DialogTitle>E-Mail Signatur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Signatur</Label>
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