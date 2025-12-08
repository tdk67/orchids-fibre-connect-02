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
import { Plus, Pencil, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Sales() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    customer_name: '',
    employee_name: '',
    sparte: 'Telekom',
    product: '',
    bandwidth: '',
    contract_duration_months: 36,
    contract_value: 0,
    commission_amount: 0,
    sale_date: new Date().toISOString().split('T')[0],
    commission_paid: false,
    notes: ''
  });

  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: allSales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sale_date'),
  });

  // Filter für Mitarbeiter - nur eigene Verkäufe
  const sales = user?.role === 'admin' 
    ? allSales 
    : allSales.filter(sale => sale.employee_id === user?.email);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const month = data.sale_date.slice(0, 7);
      const employee = employees.find(e => e.full_name === data.employee_name);
      return base44.entities.Sale.create({ 
        ...data, 
        commission_month: month,
        employee_id: employee?.email || data.employee_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sales']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sale.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sales']);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSale) {
      updateMutation.mutate({ id: editingSale.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      employee_name: '',
      sparte: 'Telekom',
      product: '',
      bandwidth: '',
      contract_duration_months: 36,
      contract_value: 0,
      commission_amount: 0,
      sale_date: new Date().toISOString().split('T')[0],
      commission_paid: false,
      notes: ''
    });
    setEditingSale(null);
  };

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setFormData(sale);
    setIsDialogOpen(true);
  };

  const toggleCommissionPaid = (sale) => {
    updateMutation.mutate({
      id: sale.id,
      data: { ...sale, commission_paid: !sale.commission_paid }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Verkäufe</h1>
          <p className="text-slate-500 mt-1">
            {user?.role === 'admin' ? 'Erfassen und verwalten Sie alle Verkäufe' : 'Meine Verkäufe'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Plus className="h-4 w-4 mr-2" />
              Neuer Verkauf
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSale ? 'Verkauf bearbeiten' : 'Neuer Verkauf'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kunde *</Label>
                  <Select value={formData.customer_name} onValueChange={(value) => setFormData({ ...formData, customer_name: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kunde wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.company_name}>
                          {customer.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mitarbeiter *</Label>
                  <Select value={formData.employee_name} onValueChange={(value) => setFormData({ ...formData, employee_name: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mitarbeiter wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.full_name}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="space-y-2">
                  <Label>Verkaufsdatum *</Label>
                  <Input
                    type="date"
                    value={formData.sale_date}
                    onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Produkt/Leistung</Label>
                  <Input
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bandbreite</Label>
                  <Input
                    value={formData.bandwidth}
                    onChange={(e) => setFormData({ ...formData, bandwidth: e.target.value })}
                    placeholder="z.B. 150/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vertragslaufzeit (Monate)</Label>
                  <Select 
                    value={formData.contract_duration_months?.toString()} 
                    onValueChange={(value) => setFormData({ ...formData, contract_duration_months: parseInt(value) })}
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
                <div className="space-y-2">
                  <Label>Vertragswert (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.contract_value}
                    onChange={(e) => setFormData({ ...formData, contract_value: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provisionsbetrag (€ Brutto) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.commission_amount}
                    onChange={(e) => setFormData({ ...formData, commission_amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                  <p className="text-xs text-slate-500">Provision inkl. 19% MwSt</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notizen</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                  {editingSale ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sales List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Verkäufe ({sales.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Sparte</TableHead>
                  <TableHead>Vertragswert</TableHead>
                  <TableHead>Provision</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="text-sm">{new Date(sale.sale_date).toLocaleDateString('de-DE')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{sale.customer_name}</TableCell>
                    <TableCell>{sale.employee_name}</TableCell>
                    <TableCell>
                      <Badge className={sale.sparte === 'Telekom' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}>
                        {sale.sparte}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {(sale.contract_value || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {(sale.commission_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCommissionPaid(sale)}
                        className={sale.commission_paid ? 'text-green-600' : 'text-amber-600'}
                      >
                        {sale.commission_paid ? (
                          <><CheckCircle className="h-4 w-4 mr-1" /> Bezahlt</>
                        ) : (
                          <><XCircle className="h-4 w-4 mr-1" /> Offen</>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(sale)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {sales.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Noch keine Verkäufe erfasst
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}