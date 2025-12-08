import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Send, Inbox, Search, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Postfach() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [composeData, setComposeData] = useState({
    empfaenger: '',
    betreff: '',
    nachricht: ''
  });
  const [importData, setImportData] = useState({
    absender: '',
    betreff: '',
    nachricht: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: allEmails = [] } = useQuery({
    queryKey: ['emails'],
    queryFn: () => base44.entities.Email.list('-timestamp'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  // Find current employee
  const currentEmployee = employees.find(e => e.email === user?.email);

  // Filter emails based on employee's email_adresse
  const emails = React.useMemo(() => {
    if (!user) return [];
    
    // Admin/Geschäftsführer sehen alle Emails
    if (user.role === 'admin' || currentEmployee?.titel === 'Geschäftsführer') {
      return allEmails;
    }
    
    if (!currentEmployee?.email_adresse) {
      return []; // Kein Email-Zugang konfiguriert
    }
    
    // Mitarbeiter sehen nur Emails ihrer konfigurierten Email-Adresse
    return allEmails.filter(email => 
      email.mitarbeiter_email === currentEmployee.email_adresse ||
      email.empfaenger === currentEmployee.email_adresse ||
      email.absender === currentEmployee.email_adresse
    );
  }, [allEmails, user, currentEmployee]);

  const sendEmailMutation = useMutation({
    mutationFn: (data) => base44.entities.Email.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['emails']);
      setIsComposeOpen(false);
      setComposeData({ empfaenger: '', betreff: '', nachricht: '' });
    },
  });

  const importEmailMutation = useMutation({
    mutationFn: (data) => base44.entities.Email.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['emails']);
      setIsImportOpen(false);
      setImportData({ absender: '', betreff: '', nachricht: '' });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Email.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['emails']);
    },
  });

  // Filter emails by search term
  const filteredEmails = emails.filter((email) => {
    return email.betreff?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.absender?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.empfaenger?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSendEmail = async () => {
    if (!currentEmployee?.email_adresse) {
      alert('Bitte konfigurieren Sie zuerst Ihre E-Mail-Adresse in den Mitarbeitereinstellungen.');
      return;
    }
    
    setIsSending(true);
    try {
      // E-Mail über Base44 Core Integration senden
      await base44.integrations.Core.SendEmail({
        from_name: currentEmployee.full_name,
        to: composeData.empfaenger,
        subject: composeData.betreff,
        body: composeData.nachricht
      });

      // In Datenbank speichern
      await base44.entities.Email.create({
        betreff: composeData.betreff,
        absender: currentEmployee.email_adresse,
        empfaenger: composeData.empfaenger,
        nachricht: composeData.nachricht,
        mitarbeiter_email: currentEmployee.email_adresse,
        mitarbeiter_name: user?.full_name || '',
        sparte: currentEmployee?.sparte || 'Backoffice',
        typ: 'Ausgang',
        gelesen: true,
        timestamp: new Date().toISOString()
      });

      queryClient.invalidateQueries(['emails']);
      setIsComposeOpen(false);
      setComposeData({ empfaenger: '', betreff: '', nachricht: '' });
      alert('E-Mail erfolgreich versendet!');
    } catch (error) {
      alert(`Fehler beim Versenden: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleImportEmail = () => {
    if (!currentEmployee?.email_adresse) {
      alert('Bitte konfigurieren Sie zuerst Ihre E-Mail-Adresse in den Mitarbeitereinstellungen.');
      return;
    }
    
    importEmailMutation.mutate({
      ...importData,
      empfaenger: currentEmployee.email_adresse,
      mitarbeiter_email: currentEmployee.email_adresse,
      mitarbeiter_name: user?.full_name || '',
      sparte: currentEmployee?.sparte || 'Backoffice',
      typ: 'Eingang',
      gelesen: false,
      timestamp: new Date().toISOString()
    });
  };

  const handleEmailClick = (email) => {
    setSelectedEmail(email);
    if (!email.gelesen) {
      markAsReadMutation.mutate({
        id: email.id,
        data: { ...email, gelesen: true }
      });
    }
  };

  const stats = {
    gesamt: filteredEmails.length,
    ungelesen: filteredEmails.filter(e => !e.gelesen && e.typ === 'Eingang').length,
    gesendet: filteredEmails.filter(e => e.typ === 'Ausgang').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">E-Mail Postfach</h1>
          <p className="text-slate-500 mt-1">
            {currentEmployee?.email_adresse ? `Postfach: ${currentEmployee.email_adresse}` : 'Keine E-Mail-Adresse konfiguriert'}
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Inbox className="h-4 w-4 mr-2" />
                E-Mail empfangen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>E-Mail manuell erfassen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Von</Label>
                  <Input
                    type="email"
                    value={importData.absender}
                    onChange={(e) => setImportData({ ...importData, absender: e.target.value })}
                    placeholder="absender@beispiel.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Betreff</Label>
                  <Input
                    value={importData.betreff}
                    onChange={(e) => setImportData({ ...importData, betreff: e.target.value })}
                    placeholder="Betreff eingeben..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nachricht</Label>
                  <Textarea
                    value={importData.nachricht}
                    onChange={(e) => setImportData({ ...importData, nachricht: e.target.value })}
                    rows={8}
                    placeholder="E-Mail Text..."
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleImportEmail} className="bg-blue-900 hover:bg-blue-800">
                    <Inbox className="h-4 w-4 mr-2" />
                    Importieren
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-900 hover:bg-blue-800">
                <Plus className="h-4 w-4 mr-2" />
                E-Mail senden
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Neue E-Mail verfassen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-xs text-green-900">
                    Von: {currentEmployee?.email_adresse || 'Keine E-Mail konfiguriert'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>An</Label>
                  <Input
                    type="email"
                    value={composeData.empfaenger}
                    onChange={(e) => setComposeData({ ...composeData, empfaenger: e.target.value })}
                    placeholder="empfaenger@beispiel.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Betreff</Label>
                  <Input
                    value={composeData.betreff}
                    onChange={(e) => setComposeData({ ...composeData, betreff: e.target.value })}
                    placeholder="Betreff eingeben..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nachricht</Label>
                  <Textarea
                    value={composeData.nachricht}
                    onChange={(e) => setComposeData({ ...composeData, nachricht: e.target.value })}
                    rows={8}
                    placeholder="Ihre Nachricht..."
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsComposeOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleSendEmail} 
                    disabled={isSending}
                    className="bg-blue-900 hover:bg-blue-800"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Wird gesendet...' : 'Senden'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100">
                <Inbox className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Gesamt</p>
                <p className="text-2xl font-bold text-slate-900">{stats.gesamt}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-100">
                <Mail className="h-6 w-6 text-red-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Ungelesen</p>
                <p className="text-2xl font-bold text-slate-900">{stats.ungelesen}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100">
                <Send className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Gesendet</p>
                <p className="text-2xl font-bold text-slate-900">{stats.gesendet}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="E-Mails durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email List */}
        <Card className="lg:col-span-1 border-0 shadow-md">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Posteingang</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => handleEmailClick(email)}
                  className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                    selectedEmail?.id === email.id ? 'bg-blue-50' : ''
                  } ${!email.gelesen && email.typ === 'Eingang' ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {email.typ === 'Eingang' ? (
                          <Mail className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Send className="h-4 w-4 text-green-600" />
                        )}
                        <span className={`text-sm truncate ${!email.gelesen && email.typ === 'Eingang' ? 'font-bold' : ''}`}>
                          {email.typ === 'Eingang' ? email.absender : email.empfaenger}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${!email.gelesen && email.typ === 'Eingang' ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                        {email.betreff}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(email.timestamp || email.created_date).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    {!email.gelesen && email.typ === 'Eingang' && (
                      <div className="h-2 w-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                </div>
              ))}
              {filteredEmails.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  Keine E-Mails gefunden
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Email Detail */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardContent className="p-6">
            {selectedEmail ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedEmail.betreff}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={selectedEmail.typ === 'Eingang' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {selectedEmail.typ}
                      </Badge>
                      {selectedEmail.sparte && (
                        <Badge variant="outline">{selectedEmail.sparte}</Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-slate-500">
                    {new Date(selectedEmail.timestamp || selectedEmail.created_date).toLocaleString('de-DE')}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs text-slate-500">Von</Label>
                      <p className="text-sm font-medium">{selectedEmail.absender}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">An</Label>
                      <p className="text-sm font-medium">{selectedEmail.empfaenger}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedEmail.nachricht}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 text-slate-500">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>Wählen Sie eine E-Mail aus</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}