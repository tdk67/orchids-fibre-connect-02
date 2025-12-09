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
import { Plus, Search, Pencil, Building2, Phone, Mail, Upload, Settings, Trash2, Calendar, Clock, FileText, Download, Eye } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
        if (!confirm('Möchten Sie wirklich ALLE Leads löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
          return;
        }
        try {
          for (const lead of leads) {
            await base44.entities.Lead.delete(lead.id);
          }
          queryClient.invalidateQueries(['leads']);
          alert(`${leads.length} Leads wurden gelöscht.`);
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

  const handlePasteImport = async () => {
    if (!pastedData.trim() || !importStatus) return;
    
    setIsImporting(true);
    
    try {
      // Parse pasted data (Tab-separated from Excel)
      const lines = pastedData.trim().split('\n');
      const assignedEmployee = employees.find(e => e.full_name === importAssignedTo);
      const leadsToImport = lines.map(line => {
        const columns = line.split('\t');
        return {
          firma: columns[0] || '',
          ansprechpartner: columns[1] || '',
          stadt: columns[2] || '',
          postleitzahl: columns[3] || '',
          strasse_hausnummer: columns[4] || '',
          telefon: columns[5] || '',
          telefon2: columns[6] || '',
          email: columns[7] || '',
          infobox: columns[8] || '',
          assigned_to: assignedEmployee?.full_name || '',
          assigned_to_email: assignedEmployee?.email || '',
          sparte: '1&1 Versatel',
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
      setImportAssignedTo('');
      alert(`${leadsToImport.length} Leads erfolgreich importiert und ${assignedEmployee?.full_name || 'zugewiesen'}!`);
    } catch (error) {
      alert('Fehler beim Import: ' + error.message);
      console.error('Import error:', error);
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

  // Filter leads based on user role, selected employee, active tab, and benutzertyp
  const userBenutzertyp = user?.benutzertyp || 'Interner Mitarbeiter';
  const isInternalAdmin = user?.role === 'admin' && userBenutzertyp === 'Interner Mitarbeiter';
  
  const filteredLeads = leads.filter((lead) => {
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
    
    // Employee-Filter: Partner-Admins sehen alle Leads ihres Benutzertyps, interne Admins mit Filter
    let employeeMatch = true;
    if (!isInternalAdmin && user?.role !== 'admin') {
      employeeMatch = lead.assigned_to_email === user?.email;
    } else if (isInternalAdmin && selectedEmployee !== 'all') {
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
                  <p className="text-xs text-blue-800">Firma | Ansprechpartner | Stadt | PLZ | Straße & Nr. | Telefon | Telefon2 | Email | Infobox</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label>Status für Leads</Label>
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
                  </div>
                </div>
                <p className="text-xs text-slate-500 bg-blue-50 p-2 rounded">
                  Alle importierten Leads werden als <strong>1&1 Versatel</strong> mit dem gewählten Status und Mitarbeiter importiert
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
                    setImportStatus('');
                  }}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handlePasteImport}
                    disabled={!pastedData.trim() || !importStatus || !importAssignedTo || isImporting}
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
            <div className="flex items-center gap-4">
              <span className="font-semibold text-blue-900">
                {selectedLeads.length} Lead(s) ausgewählt
              </span>
              <div className="flex gap-2 items-center flex-1">
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
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={(tab) => navigate(createPageUrl('Leads') + `?tab=${tab}`)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-9">
              <TabsTrigger value="aktiv">
                Aktive Leads ({leads.filter(l => !l.archiv_kategorie && !l.verkaufschance_status && !l.verloren).length})
              </TabsTrigger>
              <TabsTrigger value="angebote">
                Angebote ({leads.filter(l => l.verkaufschance_status).length})
              </TabsTrigger>
              <TabsTrigger value="bearbeitet">
                Bearbeitet ({leads.filter(l => l.archiv_kategorie === 'Bearbeitet').length})
              </TabsTrigger>
              <TabsTrigger value="adresspunkte">
                Adresspunkte ({leads.filter(l => l.archiv_kategorie === 'Adresspunkte').length})
              </TabsTrigger>
              <TabsTrigger value="verloren">
                Verloren ({leads.filter(l => l.verloren).length})
              </TabsTrigger>
              <TabsTrigger value="nicht_erreicht">
                Nicht erreicht ({leads.filter(l => l.archiv_kategorie === 'Nicht erreicht').length})
              </TabsTrigger>
              <TabsTrigger value="anderer_provider">
                Anderer Provider ({leads.filter(l => l.archiv_kategorie === 'Anderer Provider').length})
              </TabsTrigger>
              <TabsTrigger value="kein_interesse">
                Kein Interesse ({leads.filter(l => l.archiv_kategorie === 'Kein Interesse').length})
              </TabsTrigger>
              <TabsTrigger value="falsche_daten">
                Falsche Daten ({leads.filter(l => l.archiv_kategorie === 'Falsche Daten').length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-4 flex-wrap mt-4">
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
          <CardTitle>
            {activeTab === 'aktiv' && `Aktive Leads (${filteredLeads.length})`}
            {activeTab === 'angebote' && `Angebote (${filteredLeads.length})`}
            {activeTab === 'verloren' && `Verloren (${filteredLeads.length})`}
            {activeTab === 'nicht_erreicht' && `Nicht erreicht (${filteredLeads.length})`}
            {activeTab === 'anderer_provider' && `Anderer Provider (${filteredLeads.length})`}
            {activeTab === 'kein_interesse' && `Kein Interesse (${filteredLeads.length})`}
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