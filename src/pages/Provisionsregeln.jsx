import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Euro, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Provisionsregeln() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    tarif: '',
    bandbreite: '',
    laufzeit_monate: 36,
    mitarbeiter_provision: 0,
    teamleiter_provision: 0,
    teamleiter_bonus_provision: 0,
    sparte: 'Telekom',
    aktiv: true
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: regeln = [] } = useQuery({
    queryKey: ['provisionsregeln'],
    queryFn: () => base44.entities.Provisionsregel.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provisionsregel.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['provisionsregeln']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provisionsregel.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['provisionsregeln']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Provisionsregel.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['provisionsregeln']);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({
      tarif: '',
      bandbreite: '',
      laufzeit_monate: 36,
      mitarbeiter_provision: 0,
      teamleiter_provision: 0,
      teamleiter_bonus_provision: 0,
      sparte: 'Telekom',
      aktiv: true
    });
    setEditingRule(null);
  };

  const handleEdit = (regel) => {
    setEditingRule(regel);
    setFormData(regel);
    setIsDialogOpen(true);
  };

  const handleDelete = (regel) => {
    if (confirm(`Provisionsregel für "${regel.tarif}" wirklich löschen?`)) {
      deleteMutation.mutate(regel.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Provisionsregeln</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie die Provisionsstruktur nach Tarif, Bandbreite und Laufzeit</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Plus className="h-4 w-4 mr-2" />
              Neue Regel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Regel bearbeiten' : 'Neue Provisionsregel'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tarif *</Label>
                  <Select value={formData.tarif} onValueChange={(value) => setFormData({ ...formData, tarif: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tarif wählen" />
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
                  <Label>Bandbreite *</Label>
                  <Input
                    value={formData.bandbreite}
                    onChange={(e) => setFormData({ ...formData, bandbreite: e.target.value })}
                    placeholder="z.B. 100 Mbit/s"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Laufzeit (Monate) *</Label>
                  <Input
                    type="number"
                    value={formData.laufzeit_monate}
                    onChange={(e) => setFormData({ ...formData, laufzeit_monate: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sparte *</Label>
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
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Provisionswerte</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Mitarbeiter Provision (€) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.mitarbeiter_provision}
                      onChange={(e) => setFormData({ ...formData, mitarbeiter_provision: parseFloat(e.target.value) || 0 })}
                      required
                    />
                    <p className="text-xs text-slate-500">Provision die ein Mitarbeiter für einen Abschluss erhält</p>
                  </div>
                  {user?.role === 'admin' && (
                                        <>
                                          <div className="space-y-2">
                                            <Label>Teamleiter Provision (€) *</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={formData.teamleiter_provision}
                                              onChange={(e) => setFormData({ ...formData, teamleiter_provision: parseFloat(e.target.value) || 0 })}
                                              required
                                            />
                                            <p className="text-xs text-slate-500">Provision für eigene Abschlüsse des Teamleiters</p>
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Teamleiter Bonus bei Mitarbeiter-Abschluss (€)</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={formData.teamleiter_bonus_provision}
                                              onChange={(e) => setFormData({ ...formData, teamleiter_bonus_provision: parseFloat(e.target.value) || 0 })}
                                            />
                                            <p className="text-xs text-slate-500">Zusätzliche Provision wenn ein Mitarbeiter abschließt</p>
                                          </div>
                                        </>
                                      )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                  {editingRule ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="border-0 shadow-md bg-blue-50">
        <CardContent className="p-4">
          <p className="text-sm text-blue-900">
            <strong>Provisionslogik:</strong> Mitarbeiter erhalten ihre Provision für Abschlüsse. Teamleiter erhalten höhere Provisionen für eigene Abschlüsse. Bei Abschlüssen von Mitarbeitern erhält der zugeordnete Teamleiter zusätzlich eine Bonus-Provision.
          </p>
        </CardContent>
      </Card>

      {/* Rules List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Provisionsregeln ({regeln.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarif</TableHead>
                  <TableHead>Bandbreite</TableHead>
                  <TableHead>Laufzeit</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  {user?.role === 'admin' && <TableHead>Teamleiter (eigen)</TableHead>}
                  {user?.role === 'admin' && <TableHead>TL Bonus (MA)</TableHead>}
                  <TableHead>Sparte</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regeln.map((regel) => (
                  <TableRow key={regel.id} className="hover:bg-slate-50">
                    <TableCell className="font-semibold">{regel.tarif}</TableCell>
                    <TableCell>{regel.bandbreite}</TableCell>
                    <TableCell>{regel.laufzeit_monate} Monate</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {(regel.mitarbeiter_provision || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </TableCell>
                    {user?.role === 'admin' && (
                      <TableCell className="text-blue-600 font-medium">
                        {(regel.teamleiter_provision || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </TableCell>
                    )}
                    {user?.role === 'admin' && (
                      <TableCell className="text-purple-600 font-medium">
                        {(regel.teamleiter_bonus_provision || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="text-sm">{regel.sparte}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(regel)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(regel)}
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
          {regeln.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Noch keine Provisionsregeln angelegt
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}