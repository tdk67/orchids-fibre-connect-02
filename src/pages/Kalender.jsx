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
import { Plus, Clock, User, Calendar as CalendarIcon, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Kalender() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTermin, setEditingTermin] = useState(null);
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

  const handleNewTermin = () => {
    resetForm();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setFormData(prev => ({
      ...prev,
      startzeit: `${dateStr}T09:00`,
      endzeit: `${dateStr}T10:00`
    }));
    setIsDialogOpen(true);
  };

  // Filter termine based on user role
  const filteredTermine = termine.filter(t => {
    if (user?.role === 'admin') return true;
    return t.mitarbeiter_email === user?.email;
  });

  // Get termine for selected date
  const termineForSelectedDate = filteredTermine.filter(t => {
    try {
      return isSameDay(parseISO(t.startzeit), selectedDate);
    } catch {
      return false;
    }
  });

  // Get dates with termine for calendar highlighting
  const datesWithTermine = filteredTermine.map(t => {
    try {
      return parseISO(t.startzeit);
    } catch {
      return null;
    }
  }).filter(Boolean);

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
        <Button onClick={handleNewTermin} className="bg-blue-900 hover:bg-blue-800">
          <Plus className="h-4 w-4 mr-2" />
          Neuer Termin
        </Button>
      </div>

      {/* Calendar and Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Kalenderansicht</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={de}
              className="rounded-md border"
              modifiers={{
                hasEvent: datesWithTermine
              }}
              modifiersStyles={{
                hasEvent: {
                  fontWeight: 'bold',
                  textDecoration: 'underline'
                }
              }}
            />
            <div className="mt-4 text-xs text-slate-500">
              <p className="font-semibold mb-1">Legende:</p>
              <p>Unterstrichene Tage haben Termine</p>
            </div>
          </CardContent>
        </Card>

        {/* Appointments for selected date */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>
              Termine am {format(selectedDate, 'dd. MMMM yyyy', { locale: de })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {termineForSelectedDate.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>Keine Termine für diesen Tag</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleNewTermin}
                >
                  Termin hinzufügen
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {termineForSelectedDate.map((termin) => (
                  <Card key={termin.id} className="border border-slate-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-slate-900">{termin.titel}</h3>
                            <Badge className={getTypColor(termin.typ)}>{termin.typ}</Badge>
                            <Badge className={getStatusColor(termin.status)}>{termin.status}</Badge>
                          </div>
                          {termin.beschreibung && (
                            <p className="text-sm text-slate-600 mb-2">{termin.beschreibung}</p>
                          )}
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(termin.startzeit), 'HH:mm', { locale: de })}
                              {termin.endzeit && ` - ${format(parseISO(termin.endzeit), 'HH:mm', { locale: de })}`}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {termin.mitarbeiter_name}
                            </div>
                            {termin.kunde_name && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Kunde: {termin.kunde_name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(termin)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(termin)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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