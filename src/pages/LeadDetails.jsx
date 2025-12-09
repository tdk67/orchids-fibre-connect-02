import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, FileText, Calendar, Trash2 } from 'lucide-react';
import { createPageUrl } from '../utils';

export default function LeadDetails() {
  const [user, setUser] = useState(null);
  const [lead, setLead] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const leadId = new URLSearchParams(location.search).get('id');

  const [formData, setFormData] = useState({
    firma: '',
    ansprechpartner: '',
    stadt: '',
    postleitzahl: '',
    strasse_hausnummer: '',
    telefon: '',
    telefon2: '',
    email: '',
    infobox: '',
    status: '',
    produkt: '',
    bandbreite: '',
    laufzeit_monate: 36,
    assigned_to: '',
    assigned_to_email: '',
    berechnete_provision: 0,
    teamleiter_bonus: 0,
    sparte: 'Telekom',
    google_calendar_link: '',
    archiv_kategorie: '',
    archiviert_am: ''
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: leadStatuses = [] } = useQuery({
    queryKey: ['leadStatuses'],
    queryFn: () => base44.entities.LeadStatus.list('order'),
  });

  const { data: provisionsregeln = [] } = useQuery({
    queryKey: ['provisionsregeln'],
    queryFn: () => base44.entities.Provisionsregel.list(),
  });

  useEffect(() => {
    if (leadId) {
      base44.entities.Lead.filter({ id: leadId }).then(([foundLead]) => {
        if (foundLead) {
          setLead(foundLead);
          setFormData(foundLead);
        }
      });
    } else {
      // Neuer Lead - setze Default-Mitarbeiter
      const currentEmployee = employees.find(e => e.email === user?.email);
      if (currentEmployee) {
        setFormData(prev => ({
          ...prev,
          assigned_to: currentEmployee.full_name,
          assigned_to_email: currentEmployee.email,
          google_calendar_link: currentEmployee.google_calendar_link || ''
        }));
      }
    }
  }, [leadId, employees, user]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      navigate(createPageUrl('Leads'));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      navigate(createPageUrl('Leads'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      navigate(createPageUrl('Leads'));
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    let dataToSave = { 
      ...formData,
      benutzertyp: user?.benutzertyp || 'Interner Mitarbeiter'
    };

    const archivStatusMapping = {
      'Nicht erreicht': 'Nicht erreicht',
      'Anderer Provider': 'Anderer Provider',
      'Kein Interesse': 'Kein Interesse'
    };

    if (archivStatusMapping[dataToSave.status]) {
      dataToSave.archiv_kategorie = archivStatusMapping[dataToSave.status];
      if (!lead?.archiv_kategorie || lead.archiv_kategorie !== dataToSave.archiv_kategorie) {
        dataToSave.archiviert_am = new Date().toISOString().split('T')[0];
      }
    } else {
      dataToSave.archiv_kategorie = '';
      dataToSave.archiviert_am = '';
    }

    if (dataToSave.status === 'Angebot erstellt') {
      dataToSave.verkaufschance_status = 'Angebot erstellt';
    }
    
    if (lead) {
      if (dataToSave.status === 'Angebot gesendet' && lead.status !== 'Angebot gesendet') {
        await base44.entities.Lead.update(lead.id, {
          ...dataToSave,
          verkaufschance_status: 'Angebot gesendet'
        });
        
        setTimeout(() => {
          deleteMutation.mutate(lead.id);
        }, 500);
        
        alert('Lead wurde zu Verkaufschancen verschoben!');
      } else {
        updateMutation.mutate({ id: lead.id, data: dataToSave });
      }
    } else {
      createMutation.mutate(dataToSave);
    }
  };

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

  const getAvailableBandwidths = (produkt) => {
    if (!produkt) return [];
    const bandwidths = provisionsregeln
      .filter(r => r.tarif === produkt)
      .map(r => r.bandbreite);
    return [...new Set(bandwidths)];
  };

  const handleProduktChange = (produkt) => {
    const bandwidths = getAvailableBandwidths(produkt);
    const newBandbreite = bandwidths.length > 0 ? bandwidths[0] : '';
    const { provision, bonus } = calculateProvision(produkt, newBandbreite, formData.laufzeit_monate, formData.assigned_to);
    
    setFormData({
      ...formData,
      produkt,
      bandbreite: newBandbreite,
      berechnete_provision: provision,
      teamleiter_bonus: bonus
    });
  };

  const handleBandbreiteChange = (bandbreite) => {
    const { provision, bonus } = calculateProvision(formData.produkt, bandbreite, formData.laufzeit_monate, formData.assigned_to);
    
    setFormData({
      ...formData,
      bandbreite,
      berechnete_provision: provision,
      teamleiter_bonus: bonus
    });
  };

  const handleLaufzeitChange = (laufzeit) => {
    const { provision, bonus } = calculateProvision(formData.produkt, formData.bandbreite, laufzeit, formData.assigned_to);
    
    setFormData({
      ...formData,
      laufzeit_monate: laufzeit,
      berechnete_provision: provision,
      teamleiter_bonus: bonus
    });
  };

  const handleDelete = () => {
    if (confirm(`Lead "${formData.firma}" wirklich löschen?`)) {
      deleteMutation.mutate(lead.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('Leads'))}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {lead ? formData.firma : 'Neuer Lead'}
            </h1>
            <p className="text-slate-500 mt-1">
              {lead ? 'Lead bearbeiten' : 'Neuen Lead erstellen'}
            </p>
          </div>
        </div>
        {lead && (
          <Button variant="outline" onClick={handleDelete} className="border-red-300 text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </Button>
        )}
      </div>

      {/* Form */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
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
                <Label>Stadt</Label>
                <Input
                  value={formData.stadt}
                  onChange={(e) => setFormData({ ...formData, stadt: e.target.value })}
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
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Optional"
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
                <Select value={formData.status} onValueChange={(value) => {
                  setFormData({ ...formData, status: value });
                }}>
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
                {(formData.status === 'Nicht erreicht' || formData.status === 'Anderer Provider' || formData.status === 'Kein Interesse') && (
                  <p className="text-xs text-amber-600 font-medium">
                    ⚠️ Lead wird archiviert in: {formData.status}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Produkt/Service</Label>
                <Select value={formData.produkt} onValueChange={handleProduktChange}>
                  <SelectTrigger>
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
                <Label>Bandbreite</Label>
                <Select 
                  value={formData.bandbreite} 
                  onValueChange={handleBandbreiteChange}
                  disabled={!formData.produkt}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Bandbreite wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableBandwidths(formData.produkt).map((bw) => (
                      <SelectItem key={bw} value={bw}>
                        {bw}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vertragslaufzeit</Label>
                <Select 
                  value={formData.laufzeit_monate?.toString()} 
                  onValueChange={(value) => handleLaufzeitChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="36">36 Monate</SelectItem>
                    <SelectItem value="48">48 Monate</SelectItem>
                    <SelectItem value="60">60 Monate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const assignedEmp = employees.find(e => e.full_name === formData.assigned_to);
                const isTeamleiter = assignedEmp?.rolle === 'Teamleiter';
                
                return (
                  <>
                    {formData.berechnete_provision > 0 && (
                      <div className="space-y-2">
                        <Label>Berechnete Provision</Label>
                        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                          <span className="text-lg font-bold text-green-700">
                            {formData.berechnete_provision.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        </div>
                      </div>
                    )}
                    {formData.teamleiter_bonus > 0 && user?.role === 'admin' && (
                      <div className="space-y-2">
                        <Label>Teamleiter Bonus</Label>
                        <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-md">
                          <span className="text-lg font-bold text-purple-700">
                            {formData.teamleiter_bonus.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Bonus für zugeordneten Teamleiter</p>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="space-y-2 col-span-2">
                <Label>Zugewiesen an</Label>
                <Input
                  value={formData.assigned_to}
                  disabled
                  className="bg-slate-100"
                />
                <p className="text-xs text-slate-500">
                  Automatisch zugewiesen. Teamleiter wird über Mitarbeiter-Einstellungen zugeordnet.
                </p>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Google Kalender</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.google_calendar_link}
                    onChange={(e) => setFormData({ ...formData, google_calendar_link: e.target.value })}
                    placeholder="https://calendar.google.com/..."
                  />
                  {formData.google_calendar_link && (
                    <Button 
                      type="button"
                      onClick={() => window.open(formData.google_calendar_link, '_blank')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Termin buchen
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Wird automatisch vom zugewiesenen Mitarbeiter übernommen. Klicken Sie "Termin buchen" um den Kalender zu öffnen.
                </p>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Infobox / Notizen</Label>
                <Textarea
                  value={formData.infobox}
                  onChange={(e) => setFormData({ ...formData, infobox: e.target.value })}
                  rows={4}
                />
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t">
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate(createPageUrl('Kalender'))}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-900"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Termin erstellen
                </Button>
                {formData.produkt && (
                  <Button 
                    type="button" 
                    variant="outline"
                    className="bg-green-50 hover:bg-green-100 text-green-900"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Angebot erstellen
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(createPageUrl('Leads'))}
                >
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                  {lead ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}