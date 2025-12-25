import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Pencil, Building2, Phone, Mail, Upload, Settings, Trash2, Calendar, Clock, FileText, Download, Eye, Zap } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { isDuplicateLead } from '@/utils/leadDeduplication';
import AngebotPDFGenerator from '../components/AngebotPDFGenerator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [user, setUser] = useState(null);
    const [filterCity, setFilterCity] = useState('');
    const [filterAreaId, setFilterAreaId] = useState('all');
    const [filterStreet, setFilterStreet] = useState('');
    const [sortBy, setSortBy] = useState('name');
    
    const { data: savedAreas = [] } = useQuery({
      queryKey: ['areas'],
      queryFn: async () => {
        const { data, error } = await base44.client.from('areas').select('*');
        if (error) throw error;
        return data || [];
      },
    });

    const [importFile, setImportFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState('');
    const [pastedData, setPastedData] = useState('');
    const [importAssignedTo, setImportAssignedTo] = useState('');
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [showBulkAssign, setShowBulkAssign] = useState(false);
    const [bulkAssignEmployee, setBulkAssignEmployee] = useState('');
    const [selectedAdresspunkte, setSelectedAdresspunkte] = useState([]);
    const location = useLocation();
    const activeTab = new URLSearchParams(location.search).get('tab') || 'aktiv';
    const cityParam = new URLSearchParams(location.search).get('city');
    const areaIdParam = new URLSearchParams(location.search).get('areaId');

    useEffect(() => {
      if (cityParam) setFilterCity(cityParam);
      if (areaIdParam) setFilterAreaId(areaIdParam);
    }, [cityParam, areaIdParam]);

    const [showTerminDialog, setShowTerminDialog] = useState(false);
  const [selectedLeadForTermin, setSelectedLeadForTermin] = useState(null);
  const [selectedTerminDate, setSelectedTerminDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [terminTypFromLead, setTerminTypFromLead] = useState('Termin');
  const [showAngebotPreview, setShowAngebotPreview] = useState(false);
  const [angebotLead, setAngebotLead] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedBenutzertyp, setSelectedBenutzertyp] = useState(() => {
    return localStorage.getItem('selectedBenutzertyp') || 'Interner Mitarbeiter';
  });
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

  const queryClient = useQueryClient();

  const [teamleiterAnsicht, setTeamleiterAnsicht] = useState(() => {
    return localStorage.getItem('teamleiterAnsicht') === 'true';
  });

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

      const handleTeamleiterAnsichtChange = () => {
        setTeamleiterAnsicht(localStorage.getItem('teamleiterAnsicht') === 'true');
      };

      window.addEventListener('benutzertypChanged', handleBenutzertypChange);
      window.addEventListener('teamleiterAnsichtChanged', handleTeamleiterAnsichtChange);
      return () => {
        window.removeEventListener('benutzertypChanged', handleBenutzertypChange);
        window.removeEventListener('teamleiterAnsichtChanged', handleTeamleiterAnsichtChange);
      };
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

  const { data: provisionsregeln = [] } = useQuery({
    queryKey: ['provisionsregeln'],
    queryFn: () => base44.entities.Provisionsregel.list(),
  });

  const { data: termine = [] } = useQuery({
    queryKey: ['termine'],
    queryFn: () => base44.entities.Termin.list(),
  });

  // Lokale Auto-Zuweisung (ersetzt defekte Edge Function)
  const assignLeadsFromPool = async (employeeEmail) => {
    if (!employeeEmail || !employees?.length) return 0;
    const emp = employees.find((e) => e.email === employeeEmail);
    if (!emp) return 0;

    const allLeads = await base44.entities.Lead.list();

    const bearbeitetCount = allLeads.filter(
      (l) => l.assigned_to_email === emp.email && l.archiv_kategorie === 'Bearbeitet'
    ).length;
    const adresspunkteCount = allLeads.filter(
      (l) => l.assigned_to_email === emp.email && l.archiv_kategorie === 'Adresspunkte'
    ).length;
    const nichtErreichtCount = allLeads.filter(
      (l) => l.assigned_to_email === emp.email && l.archiv_kategorie === 'Nicht erreicht'
    ).length;

    if (bearbeitetCount >= 10 || adresspunkteCount >= 10 || nichtErreichtCount >= 50) {
      return 0;
    }

    const activeAssigned = allLeads.filter(
      (l) =>
        l.assigned_to_email === emp.email &&
        l.pool_status === 'zugewiesen' &&
        !l.archiv_kategorie &&
        !l.verkaufschance_status &&
        !l.verloren
    );

    const targetCount = 100;
    const minThreshold = 80;
    if (activeAssigned.length >= minThreshold) return 0;

    const needsAssignment = targetCount - activeAssigned.length;
    const poolLeads = allLeads
      .filter(
        (l) =>
          l.pool_status === 'im_pool' &&
          l.benutzertyp === emp.benutzertyp &&
          l.vorheriger_mitarbeiter !== emp.email
      )
      .slice(0, needsAssignment);

    for (const lead of poolLeads) {
      await base44.entities.Lead.update(lead.id, {
        pool_status: 'zugewiesen',
        assigned_to: emp.full_name,
        assigned_to_email: emp.email,
        status: 'Neu',
        google_calendar_link: emp.google_calendar_link || '',
      });
      // Halte lokale Kopie aktuell, damit nachfolgende Filter nicht doppelt zuweisen
      lead.pool_status = 'zugewiesen';
      lead.assigned_to_email = emp.email;
      lead.assigned_to = emp.full_name;
    }

    if (poolLeads.length > 0) {
      await queryClient.invalidateQueries(['leads']);
    }

    return poolLeads.length;
  };

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
      onSuccess: async (response, variables) => {
        // Warte auf Query-Invalidierung
        await queryClient.invalidateQueries(['leads']);

        // Automatische Lead-Nachlieferung für diesen Mitarbeiter (lokal)
        if (variables.data.assigned_to_email) {
          await assignLeadsFromPool(variables.data.assigned_to_email);
        }

        // Bestimme den Ziel-Tab basierend auf archiv_kategorie

      let targetTab = 'aktiv';
      if (variables.data.archiv_kategorie === 'Nicht erreicht') {
        targetTab = 'nicht_erreicht';
        alert('Lead wurde in "Nicht erreicht" verschoben!');
      } else if (variables.data.archiv_kategorie === 'Anderer Provider') {
        targetTab = 'anderer_provider';
        alert('Lead wurde in "Anderer Provider" verschoben!');
      } else if (variables.data.archiv_kategorie === 'Kein Interesse') {
        targetTab = 'kein_interesse';
        alert('Lead wurde in "Kein Interesse" verschoben!');
      }

      // Navigiere zum richtigen Tab
      navigate(createPageUrl('Leads') + `?tab=${targetTab}`);
    },
  });

  const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Lead.delete(id),
        onSuccess: () => {
          queryClient.invalidateQueries(['leads']);
        },
      });

      const deleteAllLeads = async () => {
        if (!confirm('Möchten Sie wirklich ALLE Leads (inkl. Lead Pool) löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
          return;
        }
        try {
          // Hole ALLE Leads inkl. Pool-Leads
          const allLeadsToDelete = await base44.entities.Lead.list();
          for (const lead of allLeadsToDelete) {
            await base44.entities.Lead.delete(lead.id);
          }
          queryClient.invalidateQueries(['leads']);
          alert(`${allLeadsToDelete.length} Leads (inkl. Pool) wurden gelöscht.`);
        } catch (error) {
          alert('Fehler beim Löschen: ' + error.message);
        }
      };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let dataToSave = { 
      ...formData,
      benutzertyp: user?.benutzertyp || 'Interner Mitarbeiter'
    };

    // Prüfe ob Status ein Archiv-Status ist
    const archivStatusMapping = {
      'Nicht erreicht': 'Nicht erreicht',
      'Anderer Provider': 'Anderer Provider',
      'Kein Interesse': 'Kein Interesse'
    };

    // Setze archiv_kategorie basierend auf Status
    if (archivStatusMapping[dataToSave.status]) {
      dataToSave.archiv_kategorie = archivStatusMapping[dataToSave.status];
      // Setze Datum wenn noch nicht vorhanden oder wenn Kategorie neu/geändert wurde
      if (!editingLead?.archiv_kategorie || editingLead.archiv_kategorie !== dataToSave.archiv_kategorie) {
        dataToSave.archiviert_am = new Date().toISOString().split('T')[0];
      }
    } else {
      // Kein Archiv-Status - entferne Archivierung
      dataToSave.archiv_kategorie = '';
      dataToSave.archiviert_am = '';
    }

    // Wenn Status "Angebot erstellt" ist, setze verkaufschance_status
    if (dataToSave.status === 'Angebot erstellt') {
      dataToSave.verkaufschance_status = 'Angebot erstellt';
    }
    
    if (editingLead) {
      // Wenn Status auf "Angebot gesendet" geändert wird, verschiebe zu Verkaufschancen
      if (dataToSave.status === 'Angebot gesendet' && editingLead.status !== 'Angebot gesendet') {
        try {
          await base44.entities.Lead.update(editingLead.id, {
            ...dataToSave,
            verkaufschance_status: 'Angebot gesendet'
          });
          
          setTimeout(() => {
            deleteMutation.mutate(editingLead.id);
          }, 500);
          
          setIsDialogOpen(false);
          alert('Lead wurde zu Verkaufschancen verschoben!');
        } catch (error) {
          alert('Fehler: ' + error.message);
        }
      } else {
        updateMutation.mutate({ id: editingLead.id, data: dataToSave });
      }
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const resetForm = () => {
    // Finde aktuellen Mitarbeiter
    const currentEmployee = employees.find(e => e.email === user?.email);
    
    setFormData({
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
      assigned_to: currentEmployee?.full_name || '',
      assigned_to_email: currentEmployee?.email || user?.email || '',
      berechnete_provision: 0,
      teamleiter_bonus: 0,
      sparte: 'Telekom',
      google_calendar_link: currentEmployee?.google_calendar_link || '',
      archiv_kategorie: '',
      archiviert_am: ''
    });
    setEditingLead(null);
  };

  const handleEdit = (lead) => {
    navigate(createPageUrl('LeadDetails') + `?id=${lead.id}`);
  };

  // Calculate provision based on rules
  const calculateProvision = (produkt, bandbreite, laufzeit, assignedTo) => {
    if (!produkt || !bandbreite || !laufzeit) return { provision: 0, bonus: 0 };
    
    const regel = provisionsregeln.find(r => 
      r.tarif === produkt && 
      r.bandbreite === bandbreite && 
      r.laufzeit_monate === laufzeit
    );
    
    if (!regel) return { provision: 0, bonus: 0 };
    
    // Check if assigned employee is a Teamleiter or Mitarbeiter
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

  // Get available bandwidths for selected product
  const getAvailableBandwidths = (produkt) => {
    if (!produkt) return [];
    const bandwidths = provisionsregeln
      .filter(r => r.tarif === produkt)
      .map(r => r.bandbreite);
    return [...new Set(bandwidths)];
  };

  // Handle product change
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

  // Handle bandbreite change
  const handleBandbreiteChange = (bandbreite) => {
    const { provision, bonus } = calculateProvision(formData.produkt, bandbreite, formData.laufzeit_monate, formData.assigned_to);
    
    setFormData({
      ...formData,
      bandbreite,
      berechnete_provision: provision,
      teamleiter_bonus: bonus
    });
  };

  // Handle laufzeit change
  const handleLaufzeitChange = (laufzeit) => {
    const { provision, bonus } = calculateProvision(formData.produkt, formData.bandbreite, laufzeit, formData.assigned_to);
    
    setFormData({
      ...formData,
      laufzeit_monate: laufzeit,
      berechnete_provision: provision,
      teamleiter_bonus: bonus
    });
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignEmployee || selectedLeads.length === 0) return;
    
    const employee = employees.find(e => e.full_name === bulkAssignEmployee);
    
    for (const leadId of selectedLeads) {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        await base44.entities.Lead.update(leadId, {
          ...lead,
          assigned_to: employee.full_name,
          assigned_to_email: employee.email
        });
      }
    }
    
    queryClient.invalidateQueries(['leads']);
    setSelectedLeads([]);
    setShowBulkAssign(false);
    setBulkAssignEmployee('');
    alert(`${selectedLeads.length} Leads erfolgreich zugewiesen!`);
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleAllLeads = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id));
    }
  };

  const toggleAdresspunkt = (leadId) => {
    setSelectedAdresspunkte(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleAllAdresspunkte = () => {
    if (selectedAdresspunkte.length === filteredLeads.length) {
      setSelectedAdresspunkte([]);
    } else {
      setSelectedAdresspunkte(filteredLeads.map(l => l.id));
    }
  };

  const handleTransferToUnternehmenssuche = async () => {
    if (selectedAdresspunkte.length === 0) return;

    // Sammle Adressen
    const addresses = selectedAdresspunkte.map(id => {
      const lead = leads.find(l => l.id === id);
      return `${lead.strasse_hausnummer}, ${lead.postleitzahl} ${lead.stadt}`;
    }).join('\n');

    // Speichere in LocalStorage für Unternehmenssuche
    const storageKey = `unternehmenssuche_addresses_${user?.email}`;
    localStorage.setItem(storageKey, addresses);

    // Lösche ausgewählte Leads
    for (const leadId of selectedAdresspunkte) {
      await deleteMutation.mutateAsync(leadId);
    }

    setSelectedAdresspunkte([]);
    alert(`${selectedAdresspunkte.length} Adresse(n) zur Unternehmenssuche übertragen und gelöscht!`);
    
    // Navigation zur Unternehmenssuche
    navigate(createPageUrl('Unternehmenssuche'));
  };

  const handleDelete = (lead) => {
    if (confirm(`Lead "${lead.firma}" wirklich löschen?`)) {
      deleteMutation.mutate(lead.id);
    }
  };

  const handleTerminClick = (lead) => {
    setSelectedLeadForTermin(lead);
    setSelectedTerminDate(new Date());
    setSelectedTimeSlot('');
    // Setze Termintyp basierend auf Lead-Status
    const terminTyp = lead.status === 'Wiedervorlage' ? 'Wiedervorlage' : 'Termin';
    setTerminTypFromLead(terminTyp);
    setShowTerminDialog(true);
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
        
        // Check if slot is already taken
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
      alert('Angebot erfolgreich erstellt!');
    },
  });

  const handleCreateTermin = () => {
    if (!selectedTimeSlot || !selectedLeadForTermin) return;
    
    const [dateStr, timeStr] = selectedTimeSlot.split('T');
    const [hour, minute] = timeStr.split(':');
    const startDate = new Date(selectedTerminDate);
    startDate.setHours(parseInt(hour), parseInt(minute), 0);
    
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    
    createTerminMutation.mutate({
      titel: `${terminTypFromLead}: ${selectedLeadForTermin.firma}`,
      beschreibung: `Kundentermin mit ${selectedLeadForTermin.ansprechpartner || selectedLeadForTermin.firma}`,
      startzeit: startDate.toISOString().slice(0, 16),
      endzeit: endDate.toISOString().slice(0, 16),
      mitarbeiter_email: selectedLeadForTermin.assigned_to_email || user?.email,
      mitarbeiter_name: selectedLeadForTermin.assigned_to || user?.full_name,
      kunde_name: selectedLeadForTermin.firma,
      lead_id: selectedLeadForTermin.id,
      typ: terminTypFromLead,
      status: 'Geplant',
      benutzertyp: user?.benutzertyp || 'Interner Mitarbeiter'
    });
  };

  const handleCreateAngebot = async (lead) => {
    if (!lead.produkt) {
      alert('Bitte wählen Sie zuerst ein Produkt aus.');
      return;
    }
    
    setAngebotLead(lead);
    setShowAngebotPreview(true);
  };

  const handleDownloadAngebot = async () => {
    if (!angebotLead) return;
    
    setIsGeneratingPDF(true);
    
    try {
      const element = document.getElementById('angebot-content');
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
      pdf.save(`Angebot_${angebotLead.firma}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      // Angebot in DB speichern
      const angebotData = {
        lead_id: angebotLead.id,
        firma: angebotLead.firma,
        ansprechpartner: angebotLead.ansprechpartner,
        strasse_hausnummer: angebotLead.strasse_hausnummer,
        postleitzahl: angebotLead.postleitzahl,
        stadt: angebotLead.stadt,
        produkt: angebotLead.produkt,
        template_name: angebotLead.produkt,
        status: 'Erstellt',
        erstellt_von: user?.full_name || user?.email,
        erstellt_datum: new Date().toISOString().split('T')[0],
        notizen: `Bandbreite: ${angebotLead.bandbreite || '-'}, Laufzeit: ${angebotLead.laufzeit_monate || '-'} Monate`
      };
      
      createAngebotMutation.mutate(angebotData);
      
    } catch (error) {
      alert('Fehler beim Erstellen des PDFs: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleEmployeeChange = (employeeName) => {
    const employee = employees.find(e => e.full_name === employeeName);
    
    // Recalculate provision based on employee role
    const { provision, bonus } = calculateProvision(formData.produkt, formData.bandbreite, formData.laufzeit_monate, employeeName);
    
    setFormData({
      ...formData,
      assigned_to: employeeName,
      assigned_to_email: employee?.email || '',
      google_calendar_link: employee?.google_calendar_link || '',
      berechnete_provision: provision,
      teamleiter_bonus: bonus
    });
  };

  const findDuplicateLead = (newLead, existingLeads) => {
    return existingLeads.find(existing => isDuplicateLead(newLead, existing));
  };

  const mergeDuplicateData = (existing, newData) => {
    return {
      ...existing,
      ansprechpartner: newData.ansprechpartner || existing.ansprechpartner,
      telefon: newData.telefon || existing.telefon,
      telefon2: newData.telefon2 || existing.telefon2 || newData.telefon,
      email: newData.email || existing.email,
      infobox: `${existing.infobox || ''}\n\n[Import ${new Date().toLocaleDateString('de-DE')}] Duplikat erkannt und zusammengeführt:\n${newData.ansprechpartner ? `Ansprechpartner: ${newData.ansprechpartner}\n` : ''}${newData.telefon ? `Telefon: ${newData.telefon}\n` : ''}${newData.telefon2 ? `Telefon2: ${newData.telefon2}\n` : ''}${newData.email ? `Email: ${newData.email}` : ''}`.trim()
    };
  };

  const handlePasteImport = async () => {
    if (!pastedData.trim()) return;

    setIsImporting(true);

    try {
      const lines = pastedData.trim().split("\n");
      const assignedEmployee = employees.find(
        (e) => e.full_name === importAssignedTo,
      );
      const existingLeads = await base44.entities.Lead.list();

      let imported = 0;
      let merged = 0;

      const parsedLeads = lines
        .map((line) => {
          const columns = line.split("\t");
          return {
            firma: columns[0] || "",
            ansprechpartner: columns[1] || "",
            stadt: columns[2] || "",
            postleitzahl: columns[3] || "",
            strasse_hausnummer: columns[4] || "",
            telefon: columns[5] || "",
            telefon2: columns[6] || "",
            email: columns[7] || "",
            infobox: columns[8] || "",
            leadnummer: columns[9] || "",
            cluster_id: columns[10] || "",
            assigned_to: assignedEmployee?.full_name || "",
            assigned_to_email: assignedEmployee?.email || "",
            sparte: "1&1 Versatel",
            status: "Neu",
            benutzertyp: user?.benutzertyp || "Interner Mitarbeiter",
          };
        })
        .filter((lead) => lead.firma);

      if (parsedLeads.length === 0) {
        alert("Keine gültigen Daten gefunden");
        setIsImporting(false);
        return;
      }

      const geocodeAddress = async (street, number, city) => {
        try {
          const q = `${street} ${number}, ${city}`.trim();
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
          );
          const data = await res.json();
          if (data && data[0]) {
            return { lat: data[0].lat, lon: data[0].lon };
          }
        } catch (e) {}
        return null;
      };

      for (const newLead of parsedLeads) {
        const duplicate = findDuplicateLead(newLead, existingLeads);

        // Try to geocode if address exists
        let coords = null;
        if (newLead.strasse_hausnummer && newLead.stadt) {
          coords = await geocodeAddress("", newLead.strasse_hausnummer, newLead.stadt);
        }

        const finalLeadData = {
          ...newLead,
          latitude: coords?.lat?.toString() || "",
          longitude: coords?.lon?.toString() || "",
        };

        if (duplicate) {
          const mergedData = mergeDuplicateData(duplicate, finalLeadData);
          await base44.entities.Lead.update(duplicate.id, mergedData);
          merged++;
        } else {
          await base44.entities.Lead.create(finalLeadData);
          imported++;
        }
      }

      queryClient.invalidateQueries(["leads"]);
      setIsImportDialogOpen(false);
      setPastedData("");
      setImportAssignedTo("");
      alert(
        `Import erfolgreich!\n${imported} neue Leads erstellt\n${merged} Duplikate zusammengeführt`,
      );
    } catch (error) {
      alert("Fehler beim Import: " + error.message);
      console.error("Import error:", error);
    } finally {
      setIsImporting(false);
    }
  };

  // Open lead from URL parameter (e.g., from calendar)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const leadId = params.get('openLead');
    if (leadId && leads.length > 0) {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        handleEdit(lead);
        window.history.replaceState({}, '', '/Leads');
      }
    }
  }, [location.search, leads]);

    // Get unique cities and areas for filtering
    const uniqueCities = [...new Set(leads.map(l => l.stadt).filter(Boolean))].sort();
    const uniqueAreas = [...new Set(leads.map(l => l.postleitzahl).filter(Boolean))].sort();
    
    // Filter leads based on user role, selected employee, active tab, and benutzertyp
    const userBenutzertyp = user?.benutzertyp || 'Interner Mitarbeiter';
    const isTeamleiter = user?.rolle === 'Teamleiter';
    const isInternalAdmin = (user?.role === 'admin' || isTeamleiter) && userBenutzertyp === 'Interner Mitarbeiter';
    
    let filteredLeads = leads.filter((lead) => {
      // WICHTIG: Pool-Leads (im_pool) niemals anzeigen - nur im Hintergrund
      if (lead.pool_status === 'im_pool') return false;

      // Tab-basierte Filterung ZUERST
      if (activeTab === 'aktiv') {
        if (lead.archiv_kategorie || lead.verkaufschance_status || lead.verloren) return false;
      } else if (activeTab === 'angebote') {
        if (!lead.verkaufschance_status) return false;
      } else if (activeTab === 'bearbeitet') {
        if (lead.archiv_kategorie !== 'Bearbeitet') return false;
      } else if (activeTab === 'adresspunkte') {
        if (lead.archiv_kategorie !== 'Adresspunkte') return false;
      } else if (activeTab === 'verloren') {
        if (!lead.verloren) return false;
      } else if (activeTab === 'nicht_erreicht') {
        if (lead.archiv_kategorie !== 'Nicht erreicht') return false;
      } else if (activeTab === 'anderer_provider') {
        if (lead.archiv_kategorie !== 'Anderer Provider') return false;
      } else if (activeTab === 'kein_interesse') {
        if (lead.archiv_kategorie !== 'Kein Interesse') return false;
      } else if (activeTab === 'falsche_daten') {
        if (lead.archiv_kategorie !== 'Falsche Daten') return false;
      }

      // Benutzertyp-Filter
      if (isInternalAdmin) {
        if (lead.benutzertyp !== selectedBenutzertyp) return false;
      } else {
        if (lead.benutzertyp !== userBenutzertyp) return false;
      }
      
      const searchMatch = 
        lead.firma?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.ansprechpartner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.telefon?.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Employee-Filter
      let employeeMatch = true;
      if (!isInternalAdmin && user?.role !== 'admin' && !isTeamleiter) {
        // Normaler Mitarbeiter: nur eigene Leads
        employeeMatch = lead.assigned_to_email === user?.email;
      } else if (isInternalAdmin && selectedEmployee !== 'all') {
        // Admin/Teamleiter mit Filter
        employeeMatch = lead.assigned_to === selectedEmployee;
      }
      
        // City filter
        const cityMatch = !filterCity || lead.stadt?.toLowerCase().includes(filterCity.toLowerCase());
        
        // Area (area_id) filter
        let areaMatch = true;
        if (filterAreaId !== 'all') {
          const area = savedAreas.find(a => a.id === filterAreaId);
          if (area) {
            areaMatch = lead.area_id === area.id || 
                       (lead.stadt?.toLowerCase() === area.city?.toLowerCase() && 
                        (typeof area.streets === 'string' ? area.streets.includes(lead.strasse_hausnummer?.split(' ')[0]) : false));
          }
        }
        
        // Street filter
        const streetMatch = !filterStreet || lead.strasse_hausnummer?.toLowerCase().includes(filterStreet.toLowerCase());
        
        return searchMatch && employeeMatch && cityMatch && areaMatch && streetMatch;
      });
    
    // Apply sorting
    filteredLeads = [...filteredLeads].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.firma || '').localeCompare(b.firma || '');
      } else if (sortBy === 'address') {
        // Virtual column: street + padded street number + business name
        const getStreetName = (addr) => addr?.match(/^[^0-9]*/)?.[0]?.trim() || '';
        const getStreetNumber = (addr) => {
          const match = addr?.match(/\d+/);
          return match ? match[0].padStart(4, '0') : '0000';
        };
        
        const aKey = `${getStreetName(a.strasse_hausnummer)}|${getStreetNumber(a.strasse_hausnummer)}|${a.firma || ''}`;
        const bKey = `${getStreetName(b.strasse_hausnummer)}|${getStreetNumber(b.strasse_hausnummer)}|${b.firma || ''}`;
        
        return aKey.localeCompare(bKey);
      }
      return 0;
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">Leads</h1>
            <p className="text-slate-600 mt-1">Verwalten Sie Ihre Lead-Datenbank</p>
          </div>
            <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (filterCity !== 'all') params.set('city', filterCity);
                          navigate(`${createPageUrl('Unternehmenssuche')}?${params.toString()}`);
                        }}
                        className="border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Lead-Generierung
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={deleteAllLeads}
                      className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Alle Leads löschen
                    </Button>
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
                  <p className="text-xs text-blue-800">Firma | Ansprechpartner | Stadt | PLZ | Straße & Nr. | Telefon | Telefon2 | Email | Infobox | Leadnummer | Cluster-ID</p>
                </div>
                <div className="space-y-2">
                  <Label>Mitarbeiter zuweisen *</Label>
                  <Select value={importAssignedTo} onValueChange={setImportAssignedTo}>
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
                <p className="text-xs text-slate-500 bg-blue-50 p-2 rounded">
                  Alle importierten Leads werden als <strong>1&1 Versatel</strong> mit Status <strong>"Neu"</strong> importiert
                </p>
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
                  }}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handlePasteImport}
                    disabled={!pastedData.trim() || !importAssignedTo || isImporting}
                    className="bg-blue-900 hover:bg-blue-800"
                  >
                    {isImporting ? 'Importiere...' : 'Importieren'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            onClick={() => navigate(createPageUrl('LeadDetails'))}
            className="bg-blue-900 hover:bg-blue-800"
          >
            <Plus className="h-4 w-4 mr-2" />
            Neuer Lead
          </Button>

        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <Card className="border-0 shadow-md bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-semibold text-blue-900 text-lg">
                {selectedLeads.length} Lead(s) ausgewählt
              </span>
              <div className="flex gap-2 items-center flex-1 flex-wrap">
                <Select value={bulkAssignEmployee} onValueChange={setBulkAssignEmployee}>
                  <SelectTrigger className="w-48 bg-white">
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
                <Button 
                  onClick={handleBulkAssign}
                  disabled={!bulkAssignEmployee}
                  className="bg-blue-900 hover:bg-blue-800"
                >
                  Zuweisen
                </Button>
                <div className="h-6 w-px bg-blue-300" />
                <Select value={importStatus} onValueChange={setImportStatus}>
                  <SelectTrigger className="w-48 bg-white">
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
                <Button 
                  onClick={async () => {
                    if (!importStatus) return;
                    for (const leadId of selectedLeads) {
                      const lead = leads.find(l => l.id === leadId);
                      if (lead) {
                        await base44.entities.Lead.update(leadId, {
                          ...lead,
                          status: importStatus
                        });
                      }
                    }
                    queryClient.invalidateQueries(['leads']);
                    setSelectedLeads([]);
                    setImportStatus('');
                    alert(`Status von ${selectedLeads.length} Lead(s) geändert!`);
                  }}
                  disabled={!importStatus}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Status ändern
                </Button>
                <div className="h-6 w-px bg-blue-300" />
                <Button 
                  onClick={async () => {
                    if (confirm(`${selectedLeads.length} Lead(s) wirklich löschen?`)) {
                      for (const leadId of selectedLeads) {
                        await deleteMutation.mutateAsync(leadId);
                      }
                      setSelectedLeads([]);
                      alert(`${selectedLeads.length} Lead(s) gelöscht!`);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </Button>
              </div>
              <Button variant="outline" onClick={() => setSelectedLeads([])}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adresspunkte Bulk Actions */}
      {activeTab === 'adresspunkte' && selectedAdresspunkte.length > 0 && (
        <Card className="border-0 shadow-md bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-green-900">
                {selectedAdresspunkte.length} Adresse(n) ausgewählt
              </span>
              <div className="flex gap-2 items-center flex-1">
                <Button 
                  onClick={handleTransferToUnternehmenssuche}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Zur Unternehmenssuche übertragen & löschen
                </Button>
              </div>
              <Button variant="outline" onClick={() => setSelectedAdresspunkte([])}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

        {/* Tabs & Filters */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(tab) => navigate(createPageUrl('Leads') + `?tab=${tab}`)} className="space-y-4">
              <TabsList className="grid w-full grid-cols-9 bg-slate-100 p-1.5 gap-1">
                <TabsTrigger value="aktiv" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Aktiv ({leads.filter(l => !l.archiv_kategorie && !l.verkaufschance_status && !l.verloren).length})
                </TabsTrigger>
                <TabsTrigger value="angebote" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
                  Angebote ({leads.filter(l => l.verkaufschance_status).length})
                </TabsTrigger>
                <TabsTrigger value="bearbeitet" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                  Bearbeitet ({leads.filter(l => l.archiv_kategorie === 'Bearbeitet').length})
                </TabsTrigger>
                <TabsTrigger value="adresspunkte" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  Adresspunkte ({leads.filter(l => l.archiv_kategorie === 'Adresspunkte').length})
                </TabsTrigger>
                <TabsTrigger value="verloren" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                  Verloren ({leads.filter(l => l.verloren).length})
                </TabsTrigger>
                <TabsTrigger value="nicht_erreicht" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                  Nicht erreicht ({leads.filter(l => l.archiv_kategorie === 'Nicht erreicht').length})
                </TabsTrigger>
                <TabsTrigger value="anderer_provider" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                  Anderer Provider ({leads.filter(l => l.archiv_kategorie === 'Anderer Provider').length})
                </TabsTrigger>
                <TabsTrigger value="kein_interesse" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                  Kein Interesse ({leads.filter(l => l.archiv_kategorie === 'Kein Interesse').length})
                </TabsTrigger>
                <TabsTrigger value="falsche_daten" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white">
                  Falsche Daten ({leads.filter(l => l.archiv_kategorie === 'Falsche Daten').length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
              <div className="space-y-3 mt-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Lead suchen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-slate-300"
                    />
                  </div>
                  {(user?.role === 'admin' || user?.rolle === 'Teamleiter') && (
                    <div className="min-w-[200px]">
                      <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                        <SelectTrigger className="border-slate-300">
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
                  <div className="flex gap-4 flex-wrap">
                    <div className="min-w-[160px] flex-1">
                      <Input
                        placeholder="Stadt filtern..."
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="border-slate-300"
                      />
                    </div>
                    <div className="min-w-[200px] flex-1">
                      <Select value={filterAreaId} onValueChange={setFilterAreaId}>
                        <SelectTrigger className="border-slate-300">
                          <SelectValue placeholder="Bereich auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle Bereiche</SelectItem>
                          {savedAreas.filter(a => !filterCity || a.city?.toLowerCase().includes(filterCity.toLowerCase())).map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name} ({area.city})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative min-w-[200px] flex-1">
                      <Input
                        placeholder="Straßenname (optional)..."
                        value={filterStreet}
                        onChange={(e) => setFilterStreet(e.target.value)}
                        className="border-slate-300"
                      />
                    </div>
                    <div className="min-w-[180px]">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="border-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Sortieren nach Name</SelectItem>
                          <SelectItem value="address">Sortieren nach Adresse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              </div>
          </CardContent>
        </Card>

      {/* Leads List */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
          <CardTitle className="text-slate-800 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            {activeTab === 'aktiv' && `Aktive Leads`}
            {activeTab === 'angebote' && `Angebote`}
            {activeTab === 'verloren' && `Verloren`}
            {activeTab === 'nicht_erreicht' && `Nicht erreicht`}
            {activeTab === 'anderer_provider' && `Anderer Provider`}
            {activeTab === 'kein_interesse' && `Kein Interesse`}
            {activeTab === 'bearbeitet' && `Bearbeitet`}
            {activeTab === 'adresspunkte' && `Adresspunkte`}
            {activeTab === 'falsche_daten' && `Falsche Daten`}
            <Badge variant="secondary" className="ml-2">{filteredLeads.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={
                        activeTab === 'adresspunkte'
                          ? selectedAdresspunkte.length === filteredLeads.length && filteredLeads.length > 0
                          : selectedLeads.length === filteredLeads.length && filteredLeads.length > 0
                      }
                      onChange={activeTab === 'adresspunkte' ? toggleAllAdresspunkte : toggleAllLeads}
                      className="w-4 h-4"
                    />
                  </TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Stadt</TableHead>
                  <TableHead>PLZ / Adresse</TableHead>
                  <TableHead>Ansprechpartner</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Zugewiesen an</TableHead>

                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow 
                    key={lead.id} 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleEdit(lead)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={
                          activeTab === 'adresspunkte'
                            ? selectedAdresspunkte.includes(lead.id)
                            : selectedLeads.includes(lead.id)
                        }
                        onChange={() => 
                          activeTab === 'adresspunkte'
                            ? toggleAdresspunkt(lead.id)
                            : toggleLeadSelection(lead.id)
                        }
                        className="w-4 h-4"
                      />
                    </TableCell>
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
                      <span className="text-sm text-slate-700">{lead.stadt || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {lead.postleitzahl && <div className="font-medium">{lead.postleitzahl}</div>}
                        {lead.strasse_hausnummer && <div className="text-slate-600">{lead.strasse_hausnummer}</div>}
                      </div>
                    </TableCell>
                    <TableCell>{lead.ansprechpartner || '-'}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        {lead.telefon && (
                          <a href={`tel:${lead.telefon}`} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                            <Phone className="h-3 w-3" />
                            {lead.telefon}
                          </a>
                        )}
                        {lead.telefon2 && (
                          <a href={`tel:${lead.telefon2}`} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                            <Phone className="h-3 w-3" />
                            {lead.telefon2}
                          </a>
                        )}
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.produkt && (
                        <Badge variant="outline" className="text-xs">
                          {lead.produkt}
                        </Badge>
                      )}
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

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {lead.google_calendar_link && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(lead.google_calendar_link, '_blank')}
                            title="Google Kalender öffnen"
                          >
                            <Calendar className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(lead)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(lead)}
                          className="text-red-600 hover:text-red-700"
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
          {filteredLeads.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Keine Leads gefunden
            </div>
          )}
        </CardContent>
        </Card>

        {/* Angebot Preview Dialog */}
        <Dialog open={showAngebotPreview} onOpenChange={setShowAngebotPreview}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Angebotsvorschau - {angebotLead?.firma}</DialogTitle>
            </DialogHeader>
            {angebotLead && (
              <div>
                <AngebotPDFGenerator lead={angebotLead} />
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowAngebotPreview(false)}>
                    Schließen
                  </Button>
                  <Button 
                    onClick={handleDownloadAngebot}
                    disabled={isGeneratingPDF}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isGeneratingPDF ? 'Erstelle PDF...' : 'PDF Download'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Termin Dialog */}
        <Dialog open={showTerminDialog} onOpenChange={setShowTerminDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Termin erstellen für {selectedLeadForTermin?.firma}</DialogTitle>
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
                {selectedLeadForTermin?.firma} - {selectedLeadForTermin?.ansprechpartner}
              </p>
              <p className="text-xs text-blue-800">
                Zugewiesen: {selectedLeadForTermin?.assigned_to}
              </p>
              {selectedTimeSlot && (
                <p className="text-xs text-blue-800 font-semibold mt-2">
                  Termin: {format(selectedTerminDate, 'dd.MM.yyyy', { locale: de })} um {selectedTimeSlot.split('T')[1]} (30 Min.)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowTerminDialog(false)}>
                Abbrechen
              </Button>
              <Button 
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