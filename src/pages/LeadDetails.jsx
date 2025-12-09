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
import { ArrowLeft, Clock, FileText, Calendar, Trash2, Download } from 'lucide-react';
import { createPageUrl } from '../utils';
import { format, parseISO, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import AngebotPDFGenerator from '../components/AngebotPDFGenerator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function LeadDetails() {
  const [user, setUser] = useState(null);
  const [lead, setLead] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showTerminDialog, setShowTerminDialog] = useState(false);
  const [selectedTerminDate, setSelectedTerminDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
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

  const { data: termine = [] } = useQuery({
    queryKey: ['termine'],
    queryFn: () => base44.entities.Termin.list(),
  });

  const createTerminMutation = useMutation({
    mutationFn: (data) => base44.entities.Termin.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['termine']);
      setShowTerminDialog(false);
      alert('Termin erfolgreich erstellt!');
    },
  });

  const createAngebotMutation = useMutation({
    mutationFn: (data) => base44.entities.Angebot.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['angebote']);
    },
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
    onSuccess: async (response, variables) => {
      await queryClient.invalidateQueries(['leads']);

      // Bestimme den Ziel-Tab basierend auf archiv_kategorie
      let targetTab = 'aktiv';
      let successMessage = '';

      if (variables.data.archiv_kategorie === 'Nicht erreicht') {
        targetTab = 'nicht_erreicht';
        successMessage = 'Lead wurde in "Nicht erreicht" verschoben!';
      } else if (variables.data.archiv_kategorie === 'Anderer Provider') {
        targetTab = 'anderer_provider';
        successMessage = 'Lead wurde in "Anderer Provider" verschoben!';
      } else if (variables.data.archiv_kategorie === 'Kein Interesse') {
        targetTab = 'kein_interesse';
        successMessage = 'Lead wurde in "Kein Interesse" verschoben!';
      }

      // Warte kurz damit die Query-Invalidierung durchgeführt wird
      setTimeout(() => {
        navigate(createPageUrl('Leads') + `?tab=${targetTab}`);
        if (successMessage) {
          alert(successMessage);
        }
      }, 100);
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

    // Wenn Status auf Angebot gesetzt wird, zu Verkaufschancen verschieben
    if (dataToSave.status === 'Angebot erstellt' || dataToSave.status === 'Angebot gesendet') {
      dataToSave.verkaufschance_status = dataToSave.status;
    }

    if (lead) {
      // Wenn Status auf Angebot geändert wird, zu Verkaufschancen verschieben
      if ((dataToSave.status === 'Angebot erstellt' || dataToSave.status === 'Angebot gesendet') && 
          lead.status !== dataToSave.status) {
        await base44.entities.Lead.update(lead.id, dataToSave);
        alert('Lead wurde zu Verkaufschancen verschoben!');
        navigate(createPageUrl('Verkaufschancen'));
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

  const handleProduktChange = async (produkt) => {
    const bandwidths = getAvailableBandwidths(produkt);
    const newBandbreite = bandwidths.length > 0 ? bandwidths[0] : '';
    const { provision, bonus } = calculateProvision(produkt, newBandbreite, formData.laufzeit_monate, formData.assigned_to);
    
    const updatedFormData = {
      ...formData,
      produkt,
      bandbreite: newBandbreite,
      berechnete_provision: provision,
      teamleiter_bonus: bonus
    };
    
    setFormData(updatedFormData);
    
    // Automatisch PDF erstellen wenn Produkt gewählt
    if (produkt && formData.firma) {
      setTimeout(() => {
        handleDownloadAngebot(updatedFormData);
      }, 500);
    }
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

  const getAvailableTimeSlots = () => {
    const slots = [];
    const startHour = 9;
    const endHour = 17;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const dateStr = format(selectedTerminDate, 'yyyy-MM-dd');
        const fullDateTime = `${dateStr}T${timeStr}`;
        
        const isOccupied = termine.some(t => {
          if (!t.startzeit) return false;
          const terminStart = new Date(t.startzeit);
          const slotStart = new Date(fullDateTime);
          const slotEnd = new Date(slotStart.getTime() + 30 * 60000);
          const terminEnd = t.endzeit ? new Date(t.endzeit) : new Date(terminStart.getTime() + 30 * 60000);
          
          return (
            (slotStart >= terminStart && slotStart < terminEnd) ||
            (slotEnd > terminStart && slotEnd <= terminEnd) ||
            (slotStart <= terminStart && slotEnd >= terminEnd)
          );
        });
        
        slots.push({
          time: timeStr,
          available: !isOccupied,
          dateTime: fullDateTime
        });
      }
    }
    
    return slots;
  };

  const handleCreateTermin = () => {
    if (!selectedTimeSlot) return;
    
    const [dateStr, timeStr] = selectedTimeSlot.split('T');
    const [hour, minute] = timeStr.split(':');
    const startDate = new Date(selectedTerminDate);
    startDate.setHours(parseInt(hour), parseInt(minute), 0);
    
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    
    const terminTyp = formData.status === 'Wiedervorlage' ? 'Wiedervorlage' : 'Termin';
    
    createTerminMutation.mutate({
      titel: `${terminTyp}: ${formData.firma}`,
      beschreibung: `Kundentermin mit ${formData.ansprechpartner || formData.firma}`,
      startzeit: startDate.toISOString().slice(0, 16),
      endzeit: endDate.toISOString().slice(0, 16),
      mitarbeiter_email: formData.assigned_to_email || user?.email,
      mitarbeiter_name: formData.assigned_to || user?.full_name,
      kunde_name: formData.firma,
      lead_id: lead?.id,
      typ: terminTyp,
      status: 'Geplant',
      benutzertyp: user?.benutzertyp || 'Interner Mitarbeiter'
    });
  };

  const handleDownloadAngebot = async (leadData = formData) => {
    if (!leadData.produkt || !leadData.firma) return;
    
    setIsGeneratingPDF(true);
    
    try {
      // Temporäres Element erstellen
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      
      // React Component rendern
      const root = document.createElement('div');
      tempDiv.appendChild(root);
      
      // Inline rendering
      root.innerHTML = `
        <div id="angebot-temp" style="width: 210mm; padding: 20mm; background: white;">
          <!-- Content wird von AngebotPDFGenerator kommen -->
        </div>
      `;
      
      // Warte kurz für Rendering
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const element = document.getElementById('angebot-content');
      if (element) {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Angebot_${leadData.firma}_${new Date().toISOString().split('T')[0]}.pdf`);
        
        // Angebot in DB speichern
        createAngebotMutation.mutate({
          lead_id: lead?.id,
          firma: leadData.firma,
          ansprechpartner: leadData.ansprechpartner,
          strasse_hausnummer: leadData.strasse_hausnummer,
          postleitzahl: leadData.postleitzahl,
          stadt: leadData.stadt,
          produkt: leadData.produkt,
          template_name: leadData.produkt,
          status: 'Erstellt',
          erstellt_von: user?.full_name || user?.email,
          erstellt_datum: new Date().toISOString().split('T')[0],
          notizen: `Bandbreite: ${leadData.bandbreite || '-'}, Laufzeit: ${leadData.laufzeit_monate || '-'} Monate`
        });
      }
      
      document.body.removeChild(tempDiv);
    } catch (error) {
      alert('Fehler beim Erstellen des PDFs: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
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
                  onClick={() => setShowTerminDialog(true)}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-900"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Termin erstellen
                </Button>
                {formData.produkt && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => handleDownloadAngebot()}
                    disabled={isGeneratingPDF}
                    className="bg-green-50 hover:bg-green-100 text-green-900"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isGeneratingPDF ? 'Erstelle PDF...' : 'Angebot Download'}
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

      {/* Hidden Angebot Generator for PDF */}
      <div style={{ position: 'absolute', left: '-9999px' }}>
        <AngebotPDFGenerator lead={formData} />
      </div>

      {/* Termin Dialog */}
      <Dialog open={showTerminDialog} onOpenChange={setShowTerminDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Termin erstellen für {formData.firma}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Datum wählen</Label>
              <Input
                type="date"
                value={format(selectedTerminDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  setSelectedTerminDate(new Date(e.target.value));
                  setSelectedTimeSlot('');
                }}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="space-y-2">
              <Label>Freie Zeitslots (30 Min.)</Label>
              <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2 border rounded-lg">
                {getAvailableTimeSlots().map((slot) => (
                  <Button
                    key={slot.time}
                    type="button"
                    variant={selectedTimeSlot === slot.dateTime ? "default" : "outline"}
                    className={`${
                      !slot.available 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : selectedTimeSlot === slot.dateTime
                        ? 'bg-blue-900'
                        : 'hover:bg-blue-50'
                    }`}
                    disabled={!slot.available}
                    onClick={() => setSelectedTimeSlot(slot.dateTime)}
                  >
                    {slot.time}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Grau = Besetzt, Weiß = Frei, Blau = Ausgewählt
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm font-semibold text-blue-900">Termindetails:</p>
              <p className="text-xs text-blue-800 mt-1">
                {formData.firma} - {formData.ansprechpartner}
              </p>
              <p className="text-xs text-blue-800">
                Zugewiesen: {formData.assigned_to}
              </p>
              {selectedTimeSlot && (
                <p className="text-xs text-blue-800 font-semibold mt-2">
                  Termin: {format(selectedTerminDate, 'dd.MM.yyyy', { locale: de })} um {selectedTimeSlot.split('T')[1]} (30 Min.)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowTerminDialog(false)}>
                Abbrechen
              </Button>
              <Button 
                type="button"
                onClick={handleCreateTermin}
                disabled={!selectedTimeSlot}
                className="bg-blue-900 hover:bg-blue-800"
              >
                Termin erstellen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}