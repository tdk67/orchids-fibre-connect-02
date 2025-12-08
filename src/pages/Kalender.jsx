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
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Clock, User, Calendar as CalendarIcon, Pencil, Trash2, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Kalender() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingTermin, setEditingTermin] = useState(null);
  const [importData, setImportData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importAssignedTo, setImportAssignedTo] = useState('');
  const [formData, setFormData] = useState({
    titel: '',
    beschreibung: '',
    startzeit: '',
    endzeit: '',
    mitarbeiter_email: '',
    mitarbeiter_name: '',
    kunde_name: '',
    typ: 'Termin',
    status: 'Geplant'
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setFormData(prev => ({
        ...prev,
        mitarbeiter_email: u.email,
        mitarbeiter_name: u.full_name
      }));
    }).catch(() => {});
  }, []);

  const { data: termine = [] } = useQuery({
    queryKey: ['termine'],
    queryFn: () => base44.entities.Termin.list('-startzeit'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Termin.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['termine']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Termin.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['termine']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Termin.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['termine']);
    },
  });

  const deleteAllTermine = async () => {
    if (!confirm('Möchten Sie wirklich ALLE Termine löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      return;
    }
    try {
      for (const termin of termine) {
        await base44.entities.Termin.delete(termin.id);
      }
      queryClient.invalidateQueries(['termine']);
      alert(`${termine.length} Termine wurden gelöscht.`);
    } catch (error) {
      alert('Fehler beim Löschen: ' + error.message);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTermin) {
      updateMutation.mutate({ id: editingTermin.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({
      titel: '',
      beschreibung: '',
      startzeit: '',
      endzeit: '',
      mitarbeiter_email: user?.email || '',
      mitarbeiter_name: user?.full_name || '',
      kunde_name: '',
      typ: 'Termin',
      status: 'Geplant'
    });
    setEditingTermin(null);
  };

  const handleEdit = (termin) => {
    setEditingTermin(termin);
    setFormData(termin);
    setIsDialogOpen(true);
  };

  const handleDelete = (termin) => {
    if (confirm(`Termin "${termin.titel}" wirklich löschen?`)) {
      deleteMutation.mutate(termin.id);
    }
  };

  const handleNewTermin = (date = selectedDate) => {
    resetForm();
    const dateStr = format(date, 'yyyy-MM-dd');
    setFormData(prev => ({
      ...prev,
      startzeit: `${dateStr}T09:00`,
      endzeit: `${dateStr}T10:00`
    }));
    setIsDialogOpen(true);
  };

  const handleImportCalendar = async () => {
    if (!importData.trim() || !importAssignedTo) return;
    
    setIsImporting(true);
    try {
      const assignedEmployee = employees.find(e => e.full_name === importAssignedTo);
      
      // Parse ICS or CSV format
      const lines = importData.trim().split('\n');
      const termine = [];
      
      if (importData.includes('BEGIN:VEVENT')) {
        // ICS Format
        let currentEvent = {};
        for (const line of lines) {
          if (line.startsWith('SUMMARY:')) {
            currentEvent.titel = line.replace('SUMMARY:', '').trim();
          } else if (line.startsWith('DTSTART')) {
            const dateStr = line.split(':')[1].trim();
            currentEvent.startzeit = parseICSDate(dateStr);
          } else if (line.startsWith('DTEND')) {
            const dateStr = line.split(':')[1].trim();
            currentEvent.endzeit = parseICSDate(dateStr);
          } else if (line.startsWith('DESCRIPTION:')) {
            currentEvent.beschreibung = line.replace('DESCRIPTION:', '').trim();
          } else if (line.startsWith('END:VEVENT')) {
            if (currentEvent.titel && currentEvent.startzeit) {
              termine.push({
                ...currentEvent,
                mitarbeiter_email: assignedEmployee?.email || user.email,
                mitarbeiter_name: assignedEmployee?.full_name || user.full_name,
                typ: 'Termin',
                status: 'Geplant'
              });
            }
            currentEvent = {};
          }
        }
      }
      
      if (termine.length > 0) {
        // Filter out duplicates
        const uniqueTermine = termine.filter(newTermin => {
          return !filteredTermine.some(existing => 
            existing.titel === newTermin.titel &&
            existing.startzeit === newTermin.startzeit &&
            existing.mitarbeiter_email === newTermin.mitarbeiter_email
          );
        });
        
        if (uniqueTermine.length > 0) {
          await base44.entities.Termin.bulkCreate(uniqueTermine);
          queryClient.invalidateQueries(['termine']);
          const skipped = termine.length - uniqueTermine.length;
          alert(`${uniqueTermine.length} Termine importiert${skipped > 0 ? `, ${skipped} Duplikate übersprungen` : ''}`);
        } else {
          alert('Alle Termine existieren bereits (Duplikate).');
        }
        
        setIsImportDialogOpen(false);
        setImportData('');
        setImportAssignedTo('');
      } else {
        alert('Keine gültigen Termine gefunden. Bitte prüfen Sie das Format.');
      }
    } catch (error) {
      alert('Fehler beim Import: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const parseICSDate = (icsDate) => {
    // Format: 20250115T100000Z or 20250115T100000
    const year = icsDate.substring(0, 4);
    const month = icsDate.substring(4, 6);
    const day = icsDate.substring(6, 8);
    const hour = icsDate.substring(9, 11);
    const minute = icsDate.substring(11, 13);
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  // Filter termine based on user role
  const currentEmployee = employees.find(e => e.email === user?.email);
  const isTeamleiter = currentEmployee?.rolle === 'Teamleiter';
  
  const filteredTermine = termine.filter(t => {
    if (user?.role === 'admin') return true;
    if (isTeamleiter) return true; // Teamleiter sehen alle Termine
    return t.mitarbeiter_email === user?.email;
  });

  // Get calendar days for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: de });
  const calendarEnd = endOfWeek(monthEnd, { locale: de });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get termine per day
  const getTermineForDay = (day) => {
    return filteredTermine.filter(t => {
      try {
        return isSameDay(parseISO(t.startzeit), day);
      } catch {
        return false;
      }
    }).sort((a, b) => {
      try {
        return parseISO(a.startzeit) - parseISO(b.startzeit);
      } catch {
        return 0;
      }
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Geplant': 'bg-blue-100 text-blue-800',
      'Bestätigt': 'bg-green-100 text-green-800',
      'Abgeschlossen': 'bg-gray-100 text-gray-800',
      'Abgesagt': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypColor = (typ) => {
    const colors = {
      'Termin': 'bg-blue-100 text-blue-800',
      'Telefonat': 'bg-purple-100 text-purple-800',
      'Meeting': 'bg-indigo-100 text-indigo-800',
      'Follow-up': 'bg-orange-100 text-orange-800',
      'Sonstiges': 'bg-gray-100 text-gray-800'
    };
    return colors[typ] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Kalender</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie Ihre Termine</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={deleteAllTermine}
            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Alle Termine löschen
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Kalender importieren
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Google Kalender importieren</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 font-medium mb-2">So funktioniert's:</p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal ml-4">
                    <li>Öffnen Sie Google Kalender</li>
                    <li>Gehen Sie zu Einstellungen → Import & Export</li>
                    <li>Klicken Sie auf "Exportieren"</li>
                    <li>Öffnen Sie die heruntergeladene .ics Datei mit einem Texteditor</li>
                    <li>Kopieren Sie den gesamten Inhalt und fügen Sie ihn unten ein</li>
                  </ol>
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
                <div className="space-y-2">
                  <Label>Kalender-Daten (ICS Format)</Label>
                  <Textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="BEGIN:VCALENDAR..."
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleImportCalendar}
                    disabled={!importData.trim() || !importAssignedTo || isImporting}
                    className="bg-blue-900 hover:bg-blue-800"
                  >
                    {isImporting ? 'Importiere...' : 'Importieren'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => handleNewTermin()} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="h-4 w-4 mr-2" />
            Neuer Termin
          </Button>
        </div>
      </div>

      {/* Month View Calendar */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {format(currentMonth, 'MMMM yyyy', { locale: de })}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Heute
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
              <div key={day} className="text-center font-semibold text-sm text-slate-600 py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = isSameDay(day, new Date());
              const dayTermine = getTermineForDay(day);
              
              return (
                <div
                  key={index}
                  className={`min-h-32 border rounded-lg p-2 ${
                    isCurrentMonth ? 'bg-white' : 'bg-slate-50'
                  } ${isToday ? 'ring-2 ring-blue-500' : ''} hover:shadow-md transition-shadow cursor-pointer`}
                  onClick={() => handleNewTermin(day)}
                >
                  <div className={`text-sm font-semibold mb-1 ${
                    isToday ? 'text-blue-600' : isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayTermine.slice(0, 3).map((termin) => (
                      <div
                        key={termin.id}
                        className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${getTypColor(termin.typ)} group relative`}
                      >
                        <div onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(termin);
                        }}>
                          <div className="font-semibold truncate">
                            {format(parseISO(termin.startzeit), 'HH:mm')} {termin.titel}
                          </div>
                          {termin.kunde_name && (
                            <div className="truncate opacity-75">{termin.kunde_name}</div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(termin);
                          }}
                          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded p-0.5 hover:bg-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {dayTermine.length > 3 && (
                      <div className="text-xs text-slate-500 pl-1">
                        +{dayTermine.length - 3} weitere
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTermin ? 'Termin bearbeiten' : 'Neuer Termin'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Titel *</Label>
                <Input
                  value={formData.titel}
                  onChange={(e) => setFormData({ ...formData, titel: e.target.value })}
                  placeholder="z.B. Kundentermin"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select value={formData.typ} onValueChange={(value) => setFormData({ ...formData, typ: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Termin">Termin</SelectItem>
                    <SelectItem value="Telefonat">Telefonat</SelectItem>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Geplant">Geplant</SelectItem>
                    <SelectItem value="Bestätigt">Bestätigt</SelectItem>
                    <SelectItem value="Abgeschlossen">Abgeschlossen</SelectItem>
                    <SelectItem value="Abgesagt">Abgesagt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Startzeit *</Label>
                <Input
                  type="datetime-local"
                  value={formData.startzeit}
                  onChange={(e) => setFormData({ ...formData, startzeit: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Endzeit</Label>
                <Input
                  type="datetime-local"
                  value={formData.endzeit}
                  onChange={(e) => setFormData({ ...formData, endzeit: e.target.value })}
                />
              </div>
              {user?.role === 'admin' && (
                <div className="space-y-2 col-span-2">
                  <Label>Mitarbeiter zuweisen</Label>
                  <Select 
                    value={formData.mitarbeiter_name} 
                    onValueChange={(name) => {
                      const emp = employees.find(e => e.full_name === name);
                      setFormData({
                        ...formData,
                        mitarbeiter_name: name,
                        mitarbeiter_email: emp?.email || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              )}
              <div className="space-y-2 col-span-2">
                <Label>Kundenname (optional)</Label>
                <Input
                  value={formData.kunde_name}
                  onChange={(e) => setFormData({ ...formData, kunde_name: e.target.value })}
                  placeholder="z.B. Firma XY"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Beschreibung</Label>
                <Textarea
                  value={formData.beschreibung}
                  onChange={(e) => setFormData({ ...formData, beschreibung: e.target.value })}
                  rows={3}
                  placeholder="Notizen zum Termin..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                {editingTermin ? 'Speichern' : 'Erstellen'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}