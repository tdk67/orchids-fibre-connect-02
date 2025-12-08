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
import { Search, Pencil, Building2, Euro, TrendingUp, Target, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BenutzertypFilter from '../components/BenutzertypFilter';

export default function Verkaufschancen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedBenutzertyp, setSelectedBenutzertyp] = useState('Interner Mitarbeiter');

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setSelectedBenutzertyp(u?.benutzertyp || 'Interner Mitarbeiter');
    }).catch(() => {});
  }, []);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      setIsDialogOpen(false);
      setEditingLead(null);
    },
  });

  // Filter nur Leads mit Verkaufschancen-Status + Benutzertyp
  const verkaufschancen = leads.filter((lead) => {
    const istVerkaufschance = 
      lead.status?.toLowerCase().includes('angebot') ||
      lead.verkaufschance_status;
    
    if (!istVerkaufschance) return false;

    // Benutzertyp-Filter
    if (user?.role === 'admin') {
      if (lead.benutzertyp !== selectedBenutzertyp) return false;
    } else {
      if (lead.benutzertyp !== (user?.benutzertyp || 'Interner Mitarbeiter')) return false;
    }

    const searchMatch = 
      lead.firma?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.ansprechpartner?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusMatch = selectedStatus === 'all' || lead.verkaufschance_status === selectedStatus;
    
    let employeeMatch = true;
    if (user?.role !== 'admin') {
      employeeMatch = lead.assigned_to_email === user?.email;
    } else if (selectedEmployee !== 'all') {
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
    
    // Wenn Status auf "Gewonnen" gesetzt wird, erstelle automatisch einen Verkauf
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
        
        alert('Verkaufschance gewonnen! Verkauf wurde automatisch erstellt.');
      } catch (error) {
        alert('Fehler beim Erstellen des Verkaufs: ' + error.message);
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
    setEditingLead({ ...editingLead, [field]: value });
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: editingLead.id,
      data: editingLead
    });
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
      'Nachfassen': 'orange',
      'Gewonnen': 'green',
      'Verloren': 'red'
    };
    return colors[status] || 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Verkaufschancen</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie Ihre aktiven Verkaufschancen</p>
        </div>
        <BenutzertypFilter 
          value={selectedBenutzertyp} 
          onChange={setSelectedBenutzertyp}
          userRole={user?.role}
        />
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
                  <TableHead>Produkt / Bandbreite</TableHead>
                  <TableHead>Provision</TableHead>
                  <TableHead>Closer</TableHead>
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
                          <p className="text-xs text-slate-500">{lead.ansprechpartner}</p>
                        </div>
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
                      <span className="text-sm text-slate-600">{lead.closer_name || '-'}</span>
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
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(lead)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                      <p className="text-xs text-slate-500">{editingLead.stadt} • {editingLead.email}</p>
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

              {/* Provisions-Details */}
              <div className="grid grid-cols-4 gap-4 bg-blue-50 p-4 rounded-lg">
                <div>
                  <Label className="text-xs text-slate-600">Produkt & Bandbreite</Label>
                  <p className="font-semibold text-slate-900">{editingLead.produkt || '-'}</p>
                  <p className="text-sm text-slate-600">{editingLead.bandbreite || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Laufzeit</Label>
                  <p className="font-semibold text-slate-900">{editingLead.laufzeit_monate ? `${editingLead.laufzeit_monate} Monate` : '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Closer</Label>
                  <p className="font-semibold text-slate-900">{editingLead.closer_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Setter</Label>
                  <p className="font-semibold text-slate-900">{editingLead.setter_name || '-'}</p>
                </div>
              </div>

              {/* Call Qualifizierung */}
              <div className="space-y-2 bg-amber-50 p-4 rounded-lg border border-amber-200">
                <Label>Call Qualifizierung</Label>
                <div className="flex gap-3">
                  <Button
                    variant={editingLead.qualifizierter_call === true ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateDetails('qualifizierter_call', true)}
                    className={editingLead.qualifizierter_call === true ? 'bg-green-600 hover:bg-green-700' : 'border-green-600 text-green-600'}
                  >
                    ✓ Qualifizierter Call
                  </Button>
                  <Button
                    variant={editingLead.qualifizierter_call === false ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateDetails('qualifizierter_call', false)}
                    className={editingLead.qualifizierter_call === false ? 'bg-red-600 hover:bg-red-700' : 'border-red-600 text-red-600'}
                  >
                    ✗ Nicht qualifiziert
                  </Button>
                </div>
                <p className="text-xs text-slate-600">
                  Nur bei qualifizierten Calls wird die Setter-Provision berechnet
                </p>
              </div>

              {/* Status Buttons */}
              <div className="space-y-2">
                <Label>Status der Verkaufschance</Label>
                <div className="flex flex-wrap gap-2">
                  {['Verhandlung', 'Angebot erstellt', 'Angebot gesendet', 'Nachfassen', 'Gewonnen', 'Verloren'].map((status) => (
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