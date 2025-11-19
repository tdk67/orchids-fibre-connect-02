import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tantml:react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function LeadStatusSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    color: 'blue',
    order: 0
  });

  const queryClient = useQueryClient();

  const { data: statuses = [] } = useQuery({
    queryKey: ['leadStatuses'],
    queryFn: () => base44.entities.LeadStatus.list('order'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LeadStatus.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leadStatuses']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LeadStatus.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['leadStatuses']);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      order: statuses.length
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      color: 'blue',
      order: 0
    });
  };

  const handleDelete = (id) => {
    if (confirm('Möchten Sie diesen Status wirklich löschen?')) {
      deleteMutation.mutate(id);
    }
  };

  const colorOptions = [
    { value: 'blue', label: 'Blau' },
    { value: 'green', label: 'Grün' },
    { value: 'yellow', label: 'Gelb' },
    { value: 'red', label: 'Rot' },
    { value: 'purple', label: 'Lila' },
    { value: 'pink', label: 'Pink' },
    { value: 'gray', label: 'Grau' },
    { value: 'orange', label: 'Orange' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to={createPageUrl('Leads')}>
            <Button variant="ghost" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zu Leads
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Lead-Status Verwaltung</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie die verfügbaren Status-Optionen</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Plus className="h-4 w-4 mr-2" />
              Neuer Status
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuer Lead-Status</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Statusname *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Angebote"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Farbe</Label>
                <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full bg-${color.value}-500`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                  Erstellen
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-900 mb-2">Standard-Status</p>
              <p>Hier können Sie die verfügbaren Lead-Status-Optionen verwalten. Diese werden im Dropdown-Menü bei der Lead-Bearbeitung angezeigt.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statuses List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Status-Optionen ({statuses.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reihenfolge</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Farbe</TableHead>
                  <TableHead>Vorschau</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status, index) => (
                  <TableRow key={status.id} className="hover:bg-slate-50">
                    <TableCell className="font-semibold">{index + 1}</TableCell>
                    <TableCell className="font-semibold">{status.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full bg-${status.color}-500`} />
                        <span className="capitalize">{status.color}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${status.color}-100 text-${status.color}-800`}>
                        {status.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(status.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {statuses.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Noch keine Status-Optionen angelegt
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}