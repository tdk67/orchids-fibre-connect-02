import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Send, Plus, Settings, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Outlook() {
  const [user, setUser] = useState(null);
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

  const currentEmployee = employees.find(e => e.email === user?.email);
  const userEmails = emails.filter(e => 
    e.mitarbeiter_email === user?.email || user?.role === 'admin'
  );

  const handleSendEmail = async () => {
    if (!composeForm.empfaenger || !composeForm.betreff || !composeForm.nachricht) {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    setIsSending(true);
    try {
      const messageWithSignature = signature 
        ? `${composeForm.nachricht}\n\n---\n${signature}`
        : composeForm.nachricht;

      await base44.integrations.Core.SendEmail({
        to: composeForm.empfaenger,
        subject: composeForm.betreff,
        body: messageWithSignature,
        from_name: currentEmployee?.full_name || user?.full_name || user?.email
      });

      await createEmailMutation.mutateAsync({
        betreff: composeForm.betreff,
        empfaenger: composeForm.empfaenger,
        nachricht: messageWithSignature,
        mitarbeiter_email: user?.email,
        mitarbeiter_name: user?.full_name,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">E-Mail</h1>
          <p className="text-slate-500 mt-1">Versenden Sie E-Mails im Namen Ihres Mitarbeiter-Accounts</p>
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

      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Gesendete E-Mails</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{userEmails.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600">
              <Send className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Gesendete E-Mails ({userEmails.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {userEmails.map((email) => (
              <div key={email.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-slate-500">
                        {email.timestamp ? format(new Date(email.timestamp), 'dd.MM.yyyy HH:mm', { locale: de }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-slate-400" />
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
          {userEmails.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <Mail className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p>Noch keine E-Mails versendet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neue E-Mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-900">
                <strong>Absender:</strong> {currentEmployee?.full_name || user?.full_name || user?.email}
              </p>
            </div>
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