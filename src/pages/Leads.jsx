import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Building2, Phone, Mail, Upload, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [user, setUser] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [pastedData, setPastedData] = useState('');
  const [formData, setFormData] = useState({
    firma: '',
    ansprechpartner: '',
    postleitzahl: '',
    strasse_hausnummer: '',
    telefon: '',
    telefon2: '',
    email: '',
    infobox: '',
    status: '',
    assigned_to: '',
    assigned_to_email: '',
    sparte: 'Telekom',
    google_calendar_link: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: leadStatuses = [] } = useQuery({
    queryKey: ['leadStatuses'],
    queryFn: () => base44.entities.LeadStatus.list('order'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({
      firma: '',
      ansprechpartner: '',
      postleitzahl: '',
      strasse_hausnummer: '',
      telefon: '',
      telefon2: '',
      email: '',
      infobox: '',
      status: '',
      assigned_to: '',
      assigned_to_email: '',
      sparte: 'Telekom',
      google_calendar_link: ''
    });
    setEditingLead(null);
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setFormData(lead);
    setIsDialogOpen(true);
  };

  const handleEmployeeChange = (employeeName) => {
    const employee = employees.find(e => e.full_name === employeeName);
    setFormData({
      ...formData,
      assigned_to: employeeName,
      assigned_to_email: employee?.email || ''
    });
  };

  const handlePasteImport = async () => {
    if (!pastedData.trim() || !importStatus) return;
    
    setIsImporting(true);
    
    try {
      // Parse pasted data (Tab-separated from Excel)
      const lines = pastedData.trim().split('\n');
      const leadsToImport = lines.map(line => {
        const columns = line.split('\t');
        return {
          firma: columns[0] || '',
          ansprechpartner: columns[1] || '',
          postleitzahl: columns[2] || '',
          strasse_hausnummer: columns[3] || '',
          telefon: columns[4] || '',
          telefon2: columns[5] || '',
          email: columns[6] || '',
          infobox: columns[7] || '',
          assigned_to: user?.full_name || '',
          assigned_to_email: user?.email || '',
          sparte: 'Telekom',
          status: importStatus
        };
      }).filter(lead => lead.firma); // Only import rows with a company name

      if (leadsToImport.length === 0) {
        alert('Keine gültigen Daten gefunden');
        setIsImporting(false);
        return;
      }

      await base44.entities.Lead.bulkCreate(leadsToImport);
      queryClient.invalidateQueries(['leads']);
      setIsImportDialogOpen(false);
      setPastedData('');
      setImportStatus('');
      alert(`${leadsToImport.length} Leads erfolgreich importiert und Ihnen zugewiesen!`);
    } catch (error) {
      alert('Fehler beim Import: ' + error.message);
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // Filter leads based on user role and selected employee
  const filteredLeads = leads.filter((lead) => {
    const searchMatch = 
      lead.firma?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.ansprechpartner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.telefon?.includes(searchTerm) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // If user is not admin, only show their own leads
    let employeeMatch = true;
    if (user?.role !== 'admin') {
      employeeMatch = lead.assigned_to_email === user?.email;
    } else if (selectedEmployee !== 'all') {
      employeeMatch = lead.assigned_to === selectedEmployee;
    }
    
    return searchMatch && employeeMatch;
  });

  const getStatusColor = (statusName) => {
    const status = leadStatuses.find(s => s.name === statusName);
    return status?.color || 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie Ihre Lead-Datenbank</p>
        </div>
        <div className="flex gap-3">
          <Link to={createPageUrl('LeadStatusSettings')}>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Status verwalten
            </Button>
          </Link>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Leads importieren
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Leads importieren (Copy & Paste)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 font-medium mb-2">So funktioniert's:</p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal ml-4">
                    <li>Kopieren Sie die Zeilen aus Ihrer Excel-Tabelle (ohne Überschrift)</li>
                    <li>Fügen Sie die Daten unten ein</li>
                    <li>Wählen Sie den Status für alle Leads</li>
                    <li>Klicken Sie auf "Importieren"</li>
                  </ol>
                  <p className="text-xs text-blue-900 font-medium mt-3 mb-1">Spaltenreihenfolge:</p>
                  <p className="text-xs text-blue-800">Firma | Ansprechpartner | PLZ | Straße & Nr. | Telefon | Telefon2 | Email | Infobox</p>
                </div>
                <div className="space-y-2">
                  <Label>Status für importierte Leads</Label>
                  <Select value={importStatus} onValueChange={setImportStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.name}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Alle importierten Leads werden Ihnen zugewiesen</p>
                </div>
                <div className="space-y-2">
                  <Label>Daten aus Excel einfügen</Label>
                  <Textarea
                    value={pastedData}
                    onChange={(e) => setPastedData(e.target.value)}
                    placeholder="Kopieren Sie Zeilen aus Excel und fügen Sie sie hier ein..."
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    {pastedData ? `${pastedData.split('\n').filter(l => l.trim()).length} Zeilen erkannt` : 'Keine Daten eingefügt'}
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => {
                    setIsImportDialogOpen(false);
                    setPastedData('');
                    setImportStatus('');
                  }}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handlePasteImport}
                    disabled={!pastedData.trim() || !importStatus || isImporting}
                    className="bg-blue-900 hover:bg-blue-800"
                  >
                    {isImporting ? 'Importiere...' : 'Importieren'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-900 hover:bg-blue-800">
                <Plus className="h-4 w-4 mr-2" />
                Neuer Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingLead ? 'Lead bearbeiten' : 'Neuer Lead'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Firma *</Label>
                    <Input
                      value={formData.firma}
                      onChange={(e) => setFormData({ ...formData, firma: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ansprechpartner</Label>
                    <Input
                      value={formData.ansprechpartner}
                      onChange={(e) => setFormData({ ...formData, ansprechpartner: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Postleitzahl</Label>
                    <Input
                      value={formData.postleitzahl}
                      onChange={(e) => setFormData({ ...formData, postleitzahl: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Straße und Hausnummer</Label>
                    <Input
                      value={formData.strasse_hausnummer}
                      onChange={(e) => setFormData({ ...formData, strasse_hausnummer: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon</Label>
                    <Input
                      value={formData.telefon}
                      onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon 2</Label>
                    <Input
                      value={formData.telefon2}
                      onChange={(e) => setFormData({ ...formData, telefon2: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-Mail</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sparte</Label>
                    <Select value={formData.sparte} onValueChange={(value) => setFormData({ ...formData, sparte: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Telekom">Telekom</SelectItem>
                        <SelectItem value="1&1 Versatel">1&1 Versatel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {leadStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.name}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Zugewiesen an</Label>
                    <Select value={formData.assigned_to} onValueChange={handleEmployeeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Mitarbeiter wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.full_name}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Google Kalender Link</Label>
                    <Input
                      value={formData.google_calendar_link}
                      onChange={(e) => setFormData({ ...formData, google_calendar_link: e.target.value })}
                      placeholder="https://calendar.google.com/..."
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Infobox / Notizen</Label>
                    <Textarea
                      value={formData.infobox}
                      onChange={(e) => setFormData({ ...formData, infobox: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                    {editingLead ? 'Speichern' : 'Erstellen'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Lead suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {user?.role === 'admin' && (
              <div className="min-w-[200px]">
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.full_name}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Leads ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Ansprechpartner</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>PLZ / Adresse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Zugewiesen an</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-semibold text-slate-900">{lead.firma}</p>
                          <Badge className={lead.sparte === 'Telekom' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}>
                            {lead.sparte}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{lead.ansprechpartner || '-'}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {lead.telefon && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Phone className="h-3 w-3" />
                            {lead.telefon}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {lead.postleitzahl && <div className="font-medium">{lead.postleitzahl}</div>}
                        {lead.strasse_hausnummer && <div className="text-slate-600">{lead.strasse_hausnummer}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.status && (
                        <Badge className={`bg-${getStatusColor(lead.status)}-100 text-${getStatusColor(lead.status)}-800`}>
                          {lead.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">{lead.assigned_to || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(lead)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredLeads.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Keine Leads gefunden
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}