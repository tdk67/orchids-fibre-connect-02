import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, UserCircle, Mail, Phone, Percent } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Employees() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employee_number: '',
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    sparte: 'Telekom',
    rolle: 'Mitarbeiter',
    titel: 'Mitarbeiter',
    teamleiter_id: '',
    commission_rate: 0,
    fixed_commission: 0,
    bank_details: '',
    tax_id: '',
    google_calendar_link: '',
    email_adresse: '',
    email_password: '',
    status: 'Aktiv'
  });

  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_number: '',
      full_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      postal_code: '',
      sparte: 'Telekom',
      rolle: 'Mitarbeiter',
      titel: 'Mitarbeiter',
      teamleiter_id: '',
      commission_rate: 0,
      fixed_commission: 0,
      bank_details: '',
      tax_id: '',
      google_calendar_link: '',
      email_adresse: '',
      email_password: '',
      status: 'Aktiv'
    });
    setEditingEmployee(null);
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData(employee);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mitarbeiter</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie Ihr Team und Provisionsstrukturen</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Plus className="h-4 w-4 mr-2" />
              Neuer Mitarbeiter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mitarbeiternummer</Label>
                  <Input
                    value={formData.employee_number}
                    onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-Mail</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Adresse (Straße, Hausnummer)</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="z.B. Kantstr. 3"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postleitzahl</Label>
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="z.B. 65451"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stadt</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="z.B. Kelsterbach"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rolle *</Label>
                  <Select value={formData.rolle} onValueChange={(value) => setFormData({ ...formData, rolle: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mitarbeiter">Mitarbeiter</SelectItem>
                      <SelectItem value="Teamleiter">Teamleiter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Select value={formData.titel} onValueChange={(value) => setFormData({ ...formData, titel: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mitarbeiter">Mitarbeiter</SelectItem>
                      <SelectItem value="Teamleiter">Teamleiter</SelectItem>
                      <SelectItem value="Geschäftsführer">Geschäftsführer</SelectItem>
                      <SelectItem value="Partner">Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sparte/Abteilung *</Label>
                  <Select value={formData.sparte} onValueChange={(value) => setFormData({ ...formData, sparte: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Telekom">Telekom</SelectItem>
                      <SelectItem value="1&1 Versatel">1&1 Versatel</SelectItem>
                      <SelectItem value="Backoffice">Backoffice</SelectItem>
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
                      <SelectItem value="Aktiv">Aktiv</SelectItem>
                      <SelectItem value="Inaktiv">Inaktiv</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.rolle === 'Mitarbeiter' && (
                  <div className="space-y-2 col-span-2">
                    <Label>Zugeordneter Teamleiter</Label>
                    <Select value={formData.teamleiter_id} onValueChange={(value) => setFormData({ ...formData, teamleiter_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Teamleiter wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.filter(e => e.rolle === 'Teamleiter').map((tl) => (
                          <SelectItem key={tl.id} value={tl.id}>
                            {tl.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Der Teamleiter erhält zusätzliche Bonus-Provisionen für Abschlüsse dieses Mitarbeiters
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-slate-900 mb-4">Provisionsstruktur</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provisionssatz (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fixe Provision (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.fixed_commission}
                      onChange={(e) => setFormData({ ...formData, fixed_commission: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-slate-900 mb-4">Weitere Informationen</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bankverbindung</Label>
                    <Textarea
                      value={formData.bank_details}
                      onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Steuernummer</Label>
                    <Input
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Google Kalender Link</Label>
                    <Input
                      value={formData.google_calendar_link}
                      onChange={(e) => setFormData({ ...formData, google_calendar_link: e.target.value })}
                      placeholder="https://calendar.google.com/calendar/..."
                    />
                    <p className="text-xs text-slate-500">
                      Dieser Kalender wird automatisch mit den Leads des Mitarbeiters verknüpft
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-slate-900 mb-4">IONOS E-Mail Postfach</h3>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-4">
                  <p className="text-xs text-blue-900 font-medium mb-1">IONOS E-Mail Integration</p>
                  <p className="text-xs text-blue-800">
                    Verbinden Sie Ihr IONOS E-Mail-Konto. E-Mails werden automatisch über IONOS SMTP/IMAP versendet und empfangen.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IONOS E-Mail-Adresse</Label>
                    <Input
                      type="email"
                      value={formData.email_adresse}
                      onChange={(e) => setFormData({ ...formData, email_adresse: e.target.value })}
                      placeholder="mitarbeiter@ihre-domain.de"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>IONOS Passwort</Label>
                    <Input
                      type="password"
                      value={formData.email_password}
                      onChange={(e) => setFormData({ ...formData, email_password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Server: smtp.ionos.de (Port 587) / imap.ionos.de (Port 993)
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                  {editingEmployee ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Employees List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Mitarbeiter ({employees.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Sparte</TableHead>
                  <TableHead>Provision</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-semibold text-slate-900">{employee.full_name}</p>
                          {employee.employee_number && (
                            <p className="text-xs text-slate-500">Nr. {employee.employee_number}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={employee.rolle === 'Teamleiter' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'}>
                        {employee.rolle || 'Mitarbeiter'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {employee.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Mail className="h-3 w-3" />
                            {employee.email}
                          </div>
                        )}
                        {employee.phone && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Phone className="h-3 w-3" />
                            {employee.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        employee.sparte === 'Telekom' ? 'bg-pink-100 text-pink-800' :
                        employee.sparte === '1&1 Versatel' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }>
                        {employee.sparte}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Percent className="h-3 w-3 text-slate-400" />
                        <span>
                          {employee.commission_rate > 0 && `${employee.commission_rate}%`}
                          {employee.commission_rate > 0 && employee.fixed_commission > 0 && ' + '}
                          {employee.fixed_commission > 0 && `${employee.fixed_commission}€`}
                          {employee.commission_rate === 0 && employee.fixed_commission === 0 && '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        employee.status === 'Aktiv' ? 'border-green-300 text-green-800' : 'border-slate-300 text-slate-600'
                      }>
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(employee)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {employees.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Noch keine Mitarbeiter angelegt
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}