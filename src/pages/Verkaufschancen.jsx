import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Pencil, Building2, Euro, TrendingUp, Target, Calendar, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Verkaufschancen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedBenutzertyp, setSelectedBenutzertyp] = useState(() => {
    return localStorage.getItem('selectedBenutzertyp') || 'Interner Mitarbeiter';
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      if (!localStorage.getItem('selectedBenutzertyp')) {
        setSelectedBenutzertyp(u?.benutzertyp || 'Interner Mitarbeiter');
      }
    }).catch(() => {});

    const handleBenutzertypChange = () => {
      setSelectedBenutzertyp(localStorage.getItem('selectedBenutzertyp') || 'Interner Mitarbeiter');
    };

    window.addEventListener('benutzertypChanged', handleBenutzertypChange);
    return () => window.removeEventListener('benutzertypChanged', handleBenutzertypChange);
  }, []);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: provisionsregeln = [] } = useQuery({
    queryKey: ['provisionsregeln'],
    queryFn: () => base44.entities.Provisionsregel.list(),
  });

  // Provisionsberechnung
  const calculateProvision = (produkt, bandbreite, laufzeit, assignedTo) => {
    if (!produkt || !bandbreite || !laufzeit) return { provision: 0, bonus: 0 };
    
    const regel = provisionsregeln.find(r => 
      r.tarif === produkt && 
      r.bandbreite === bandbreite && 
      r.laufzeit_monate === laufzeit
    );
    
    if (!regel) return { provision: 0, bonus: 0 };
    
    const assignedEmp = employees.find(e => e.full_name === assignedTo);
    if (assignedEmp?.rolle === 'Teamleiter') {
      return { 
        provision: regel.teamleiter_provision || 0, 
        bonus: 0 
      };
    } else {
      return { 
        provision: regel.mitarbeiter_provision || 0, 
        bonus: regel.teamleiter_bonus_provision || 0 
      };
    }
  };

  // Verfügbare Bandbreiten für Produkt
  const getAvailableBandwidths = (produkt) => {
    if (!produkt) return [];
    const bandwidths = provisionsregeln
      .filter(r => r.tarif === produkt)
      .map(r => r.bandbreite);
    return [...new Set(bandwidths)];
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      setIsDialogOpen(false);
      setEditingLead(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
    },
  });

  // Filter nur Leads mit Verkaufschancen-Status + Benutzertyp
  const userBenutzertyp = user?.benutzertyp || 'Interner Mitarbeiter';
  const isInternalAdmin = user?.role === 'admin' && userBenutzertyp === 'Interner Mitarbeiter';
  
  const verkaufschancen = leads.filter((lead) => {
    const istVerkaufschance = 
      lead.status?.toLowerCase().includes('angebot') ||
      lead.verkaufschance_status;
    
    if (!istVerkaufschance) return false;

    // Benutzertyp-Filter
    if (isInternalAdmin) {
      if (lead.benutzertyp !== selectedBenutzertyp) return false;
    } else {
      if (lead.benutzertyp !== userBenutzertyp) return false;
    }

    const searchMatch = 
      lead.firma?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.ansprechpartner?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusMatch = selectedStatus === 'all' || lead.verkaufschance_status === selectedStatus;
    
    let employeeMatch = true;
    if (!isInternalAdmin && user?.role !== 'admin') {
      employeeMatch = lead.assigned_to_email === user?.email;
    } else if (isInternalAdmin && selectedEmployee !== 'all') {
      employeeMatch = lead.assigned_to === selectedEmployee;
    }
    
    return searchMatch && statusMatch && employeeMatch;
  });

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setIsDialogOpen(true);
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!editingLead) return;
    
    // Wenn Status auf "Gewonnen" gesetzt wird, erstelle automatisch einen Verkauf und lösche Lead
    if (newStatus === 'Gewonnen' && editingLead.verkaufschance_status !== 'Gewonnen') {
      const today = new Date();
      
      // Verkauf für den Mitarbeiter erstellen
      const saleData = {
        sale_number: `VK-${Date.now()}`,
        customer_name: editingLead.firma,
        employee_name: editingLead.assigned_to,
        employee_id: editingLead.assigned_to_email,
        sparte: editingLead.sparte,
        product: `${editingLead.produkt || ''} ${editingLead.bandbreite || ''} (${editingLead.laufzeit_monate || 0} Monate)`.trim(),
        contract_value: editingLead.berechnete_provision || 0,
        commission_amount: editingLead.berechnete_provision || 0,
        sale_date: today.toISOString().split('T')[0],
        commission_paid: false,
        commission_month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
        notes: `Automatisch erstellt aus Verkaufschance: ${editingLead.firma}`,
        benutzertyp: editingLead.benutzertyp || 'Interner Mitarbeiter'
      };
      
      try {
        await base44.entities.Sale.create(saleData);
        
        // Wenn Mitarbeiter zugewiesen ist und Teamleiter-Bonus existiert, erstelle zweiten Verkauf für Teamleiter
        if (editingLead.teamleiter_bonus && editingLead.teamleiter_bonus > 0) {
          const assignedEmployee = employees.find(e => e.email === editingLead.assigned_to_email);
          if (assignedEmployee?.teamleiter_id) {
            const teamleiter = employees.find(e => e.id === assignedEmployee.teamleiter_id);
            if (teamleiter) {
              const teamleiterSaleData = {
                sale_number: `VK-TL-${Date.now()}`,
                customer_name: editingLead.firma,
                employee_name: teamleiter.full_name,
                employee_id: teamleiter.email,
                sparte: editingLead.sparte,
                product: `Teamleiter-Bonus: ${editingLead.produkt || ''} ${editingLead.bandbreite || ''} (${editingLead.laufzeit_monate || 0} Monate)`.trim(),
                contract_value: 0,
                commission_amount: editingLead.teamleiter_bonus,
                sale_date: today.toISOString().split('T')[0],
                commission_paid: false,
                commission_month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
                notes: `Teamleiter-Bonus für Abschluss von ${editingLead.assigned_to}`,
                benutzertyp: editingLead.benutzertyp || 'Interner Mitarbeiter'
              };
              await base44.entities.Sale.create(teamleiterSaleData);
            }
          }
        }
        
        // Lead aus Verkaufschancen löschen
        await base44.entities.Lead.delete(editingLead.id);
        queryClient.invalidateQueries(['leads']);
        setIsDialogOpen(false);
        alert('Verkaufschance gewonnen! Verkauf wurde erstellt und Lead wurde aus Verkaufschancen entfernt.');
        return;
      } catch (error) {
        alert('Fehler beim Erstellen des Verkaufs: ' + error.message);
        return;
      }
    }
    
    // Wenn Status auf "Verloren" gesetzt wird, Lead zu Leads zurück verschieben
    if (newStatus === 'Verloren' && editingLead.verkaufschance_status !== 'Verloren') {
      try {
        await base44.entities.Lead.update(editingLead.id, {
          ...editingLead,
          status: 'Verloren',
          verkaufschance_status: '',
          verloren: true,
          verloren_am: new Date().toISOString().split('T')[0]
        });
        queryClient.invalidateQueries(['leads']);
        setIsDialogOpen(false);
        alert('Lead wurde als verloren markiert und zurück zu Leads verschoben.');
        return;
      } catch (error) {
        alert('Fehler: ' + error.message);
        return;
      }
    }
    
    updateMutation.mutate({
      id: editingLead.id,
      data: {
        ...editingLead,
        verkaufschance_status: newStatus
      }
    });
  };

  const handleUpdateDetails = (field, value) => {
    const updatedLead = { ...editingLead, [field]: value };
    
    // Provision neu berechnen wenn Produkt, Bandbreite oder Laufzeit geändert werden
    if (field === 'produkt' || field === 'bandbreite' || field === 'laufzeit_monate') {
      const { provision, bonus } = calculateProvision(
        field === 'produkt' ? value : updatedLead.produkt,
        field === 'bandbreite' ? value : updatedLead.bandbreite,
        field === 'laufzeit_monate' ? value : updatedLead.laufzeit_monate,
        updatedLead.assigned_to
      );
      updatedLead.berechnete_provision = provision;
      updatedLead.teamleiter_bonus = bonus;
    }
    
    setEditingLead(updatedLead);
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: editingLead.id,
      data: editingLead
    });
  };

  const handleDelete = (lead) => {
    if (confirm(`Verkaufschance "${lead.firma}" wirklich löschen?`)) {
      deleteMutation.mutate(lead.id);
    }
  };

  // Statistiken - nutze berechnete_provision statt erwarteter_wert
  const stats = {
    gesamt: verkaufschancen.length,
    gesamtwert: verkaufschancen.reduce((sum, v) => sum + (v.berechnete_provision || v.erwarteter_wert || 0), 0),
    gewonnen: verkaufschancen.filter(v => v.verkaufschance_status === 'Gewonnen').length,
    gewichteterWert: verkaufschancen.reduce((sum, v) => 
      sum + ((v.berechnete_provision || v.erwarteter_wert || 0) * ((v.wahrscheinlichkeit || 0) / 100)), 0
    )
  };

  const getStatusColor = (status) => {
    const colors = {
      'Verhandlung': 'yellow',
      'Angebot erstellt': 'blue',
      'Angebot gesendet': 'purple',
      'Auftrag gesendet': 'indigo',
      'Nachfassen': 'orange',
      'Gewonnen': 'green',
      'Verloren': 'red'
    };
    return colors[status] || 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Verkaufschancen</h1>
        <p className="text-slate-500 mt-1">Verwalten Sie Ihre aktiven Verkaufschancen</p>
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100">
                <Target className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Aktive Chancen</p>
                <p className="text-2xl font-bold text-blue-900">{stats.gesamt}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100">
                <Euro className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Gesamtwert</p>
                <p className="text-2xl font-bold text-green-900">
                  {stats.gesamtwert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-100">
                <TrendingUp className="h-6 w-6 text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700">Gewichteter Wert</p>
                <p className="text-2xl font-bold text-purple-900">
                  {stats.gewichteterWert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-100">
                <Target className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-700">Gewonnen</p>
                <p className="text-2xl font-bold text-amber-900">{stats.gewonnen}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Verkaufschance suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="min-w-[200px]">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="Verhandlung">Verhandlung</SelectItem>
                  <SelectItem value="Angebot erstellt">Angebot erstellt</SelectItem>
                  <SelectItem value="Angebot gesendet">Angebot gesendet</SelectItem>
                  <SelectItem value="Auftrag gesendet">Auftrag gesendet</SelectItem>
                  <SelectItem value="Nachfassen">Nachfassen</SelectItem>
                  <SelectItem value="Gewonnen">Gewonnen</SelectItem>
                  <SelectItem value="Verloren">Verloren</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Verkaufschancen Liste */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Verkaufschancen ({verkaufschancen.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Produkt / Bandbreite</TableHead>
                  <TableHead>Provision</TableHead>
                  <TableHead>Zugewiesen an</TableHead>
                  <TableHead>Wahrscheinlichkeit</TableHead>
                  <TableHead>Abschlussdatum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verkaufschancen.map((lead) => (
                  <TableRow 
                    key={lead.id} 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleEdit(lead)}
                  >
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
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{lead.ansprechpartner || '-'}</p>
                        {lead.telefon && <p className="text-xs text-slate-600">{lead.telefon}</p>}
                        {lead.email && <p className="text-xs text-slate-600">{lead.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {lead.strasse_hausnummer && <p>{lead.strasse_hausnummer}</p>}
                        {(lead.postleitzahl || lead.stadt) && (
                          <p className="text-xs text-slate-600">
                            {lead.postleitzahl} {lead.stadt}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {lead.produkt && (
                          <Badge variant="outline" className="text-xs">
                            {lead.produkt}
                          </Badge>
                        )}
                        {lead.bandbreite && (
                          <div className="text-xs text-slate-600">{lead.bandbreite}</div>
                        )}
                        {lead.laufzeit_monate && (
                          <div className="text-xs text-slate-500">{lead.laufzeit_monate} Monate</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      {(lead.berechnete_provision || lead.erwarteter_wert || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">{lead.assigned_to || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${lead.wahrscheinlichkeit || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{lead.wahrscheinlichkeit || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.geplanter_abschluss ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {new Date(lead.geplanter_abschluss).toLocaleDateString('de-DE')}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {lead.verkaufschance_status && (
                        <Badge className={`bg-${getStatusColor(lead.verkaufschance_status)}-100 text-${getStatusColor(lead.verkaufschance_status)}-800`}>
                          {lead.verkaufschance_status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(lead)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(lead)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {verkaufschancen.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Keine Verkaufschancen gefunden
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verkaufschance bearbeiten</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <div className="space-y-6">
              {/* Firmeninfo */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-slate-400" />
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900">{editingLead.firma}</h3>
                      <p className="text-sm text-slate-600">{editingLead.ansprechpartner}</p>
                      <p className="text-xs text-slate-500">
                        {editingLead.strasse_hausnummer && `${editingLead.strasse_hausnummer}, `}
                        {editingLead.postleitzahl} {editingLead.stadt}
                      </p>
                      <div className="flex gap-2 mt-1">
                        {editingLead.telefon && (
                          <p className="text-xs text-slate-500">📞 {editingLead.telefon}</p>
                        )}
                        {editingLead.email && (
                          <p className="text-xs text-slate-500">✉️ {editingLead.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {editingLead.berechnete_provision > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Provision</p>
                      <p className="text-2xl font-bold text-green-600">
                        {editingLead.berechnete_provision.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Lead Details - Editierbar */}
              <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Produkt</Label>
                    <Select value={editingLead.produkt} onValueChange={(value) => handleUpdateDetails('produkt', value)}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Produkt wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Office Fast And Secure">Office Fast And Secure</SelectItem>
                        <SelectItem value="Connect Basic">Connect Basic</SelectItem>
                        <SelectItem value="Premium">Premium</SelectItem>
                        <SelectItem value="Premium Pug 2">Premium Pug 2</SelectItem>
                        <SelectItem value="Premium Pug 3">Premium Pug 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Bandbreite</Label>
                    <Select 
                      value={editingLead.bandbreite} 
                      onValueChange={(value) => handleUpdateDetails('bandbreite', value)}
                      disabled={!editingLead.produkt}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Bandbreite wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableBandwidths(editingLead.produkt).map((bw) => (
                          <SelectItem key={bw} value={bw}>
                            {bw}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Laufzeit (Monate)</Label>
                    <Select value={editingLead.laufzeit_monate?.toString()} onValueChange={(value) => handleUpdateDetails('laufzeit_monate', parseInt(value))}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="36">36 Monate</SelectItem>
                        <SelectItem value="48">48 Monate</SelectItem>
                        <SelectItem value="60">60 Monate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-slate-600">Sparte</Label>
                    <Badge className={editingLead.sparte === 'Telekom' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}>
                      {editingLead.sparte}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Zugewiesen an</Label>
                    <p className="font-semibold text-slate-900">{editingLead.assigned_to || '-'}</p>
                  </div>
                  {editingLead.berechnete_provision > 0 && (
                    <div>
                      <Label className="text-xs text-slate-600">Provision</Label>
                      <p className="font-semibold text-green-600">
                        {editingLead.berechnete_provision.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notizen */}
              {editingLead.infobox && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <Label className="text-xs text-slate-600">Notizen</Label>
                  <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap">{editingLead.infobox}</p>
                </div>
              )}

              {/* Status Buttons */}
              <div className="space-y-2">
                <Label>Status der Verkaufschance</Label>
                <div className="flex flex-wrap gap-2">
                  {['Verhandlung', 'Angebot erstellt', 'Angebot gesendet', 'Auftrag gesendet', 'Nachfassen', 'Gewonnen', 'Verloren'].map((status) => (
                    <Button
                      key={status}
                      variant={editingLead.verkaufschance_status === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdateStatus(status)}
                      className={editingLead.verkaufschance_status === status ? 'bg-blue-900' : ''}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Verkaufschancen Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Wahrscheinlichkeit (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editingLead.wahrscheinlichkeit || ''}
                    onChange={(e) => handleUpdateDetails('wahrscheinlichkeit', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Geplanter Abschluss</Label>
                  <Input
                    type="date"
                    value={editingLead.geplanter_abschluss || ''}
                    onChange={(e) => handleUpdateDetails('geplanter_abschluss', e.target.value)}
                  />
                </div>
              </div>

              {/* Aktionen */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSave} className="bg-blue-900 hover:bg-blue-800">
                  Speichern
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}