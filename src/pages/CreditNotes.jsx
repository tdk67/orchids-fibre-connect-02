import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Plus, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function CreditNotes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [user, setUser] = useState(null);

  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: allCreditNotes = [] } = useQuery({
    queryKey: ['creditNotes'],
    queryFn: () => base44.entities.CreditNote.list('-issued_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: allSales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list(),
  });

  // Filter für Mitarbeiter - nur eigene Daten
  const creditNotes = user?.role === 'admin' 
    ? allCreditNotes 
    : allCreditNotes.filter(cn => cn.employee_id === user?.email || cn.employee_name === user?.full_name);

  const sales = user?.role === 'admin' 
    ? allSales 
    : allSales.filter(sale => sale.employee_id === user?.email);

  const createCreditNoteMutation = useMutation({
    mutationFn: async (data) => {
      // Find employee
      const employee = employees.find(e => e.full_name === data.employee_name);
      
      // Get all unpaid sales for this employee in the period
      const employeeSales = sales.filter(s => 
        s.employee_name === data.employee_name &&
        s.sale_date?.startsWith(data.period) &&
        !s.commission_paid
      );

      const total = employeeSales.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
      
      // Generate credit note number
      const existingNotes = await base44.entities.CreditNote.list();
      const nextNumber = existingNotes.length + 1;
      const creditNoteNumber = `GS-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;

      const creditNoteData = {
        credit_note_number: creditNoteNumber,
        employee_id: employee?.id || '',
        employee_name: data.employee_name,
        period: data.period.replace('-', '/'),
        total_commission: total,
        sales_count: employeeSales.length,
        sales_ids: employeeSales.map(s => s.id),
        issued_date: new Date().toISOString().split('T')[0],
        status: 'Erstellt'
      };

      const creditNote = await base44.entities.CreditNote.create(creditNoteData);

      // Mark sales as paid
      for (const sale of employeeSales) {
        await base44.entities.Sale.update(sale.id, { ...sale, commission_paid: true });
      }

      return creditNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['creditNotes']);
      queryClient.invalidateQueries(['sales']);
      setIsDialogOpen(false);
      setSelectedEmployee('');
    },
  });

  const handleCreateCreditNote = () => {
    if (!selectedEmployee || !selectedPeriod) return;
    
    createCreditNoteMutation.mutate({
      employee_name: selectedEmployee,
      period: selectedPeriod
    });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => {
      const creditNote = creditNotes.find(cn => cn.id === id);
      return base44.entities.CreditNote.update(id, { ...creditNote, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['creditNotes']);
    },
  });

  // Generate month options (last 12 months)
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    monthOptions.push(date.toISOString().slice(0, 7));
  }

  // Calculate available employees with unpaid commissions
  const availableEmployees = employees.filter(emp => {
    const unpaidSales = sales.filter(s => 
      s.employee_name === emp.full_name &&
      s.sale_date?.startsWith(selectedPeriod) &&
      !s.commission_paid
    );
    return unpaidSales.length > 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gutschriften</h1>
          <p className="text-slate-500 mt-1">
            {user?.role === 'admin' ? 'Provisionsabrechnungen für Mitarbeiter' : 'Meine Provisionsabrechnungen'}
          </p>
        </div>
        {user?.role === 'admin' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Plus className="h-4 w-4 mr-2" />
              Neue Gutschrift
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Neue Gutschrift erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Zeitraum</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month} value={month}>
                        {new Date(month + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Mitarbeiter</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmployees.map((emp) => {
                      const unpaidSales = sales.filter(s => 
                        s.employee_name === emp.full_name &&
                        s.sale_date?.startsWith(selectedPeriod) &&
                        !s.commission_paid
                      );
                      const total = unpaidSales.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
                      return (
                        <SelectItem key={emp.id} value={emp.full_name}>
                          {emp.full_name} ({unpaidSales.length} Verkäufe - {total.toFixed(2)}€)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {availableEmployees.length === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  Keine offenen Provisionen für den ausgewählten Zeitraum
                </p>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleCreateCreditNote}
                  disabled={!selectedEmployee || availableEmployees.length === 0}
                  className="bg-blue-900 hover:bg-blue-800"
                >
                  Gutschrift erstellen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Info Card */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-100">
              <FileText className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Automatische Provisionsabrechnung</h3>
              <p className="text-sm text-slate-600">
                Erstellen Sie Gutschriften für Mitarbeiter basierend auf deren Verkäufen. 
                Jede Gutschrift erhält eine fortlaufende Nummer und markiert die entsprechenden Verkäufe als bezahlt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Notes List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Gutschriften ({creditNotes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Verkäufe</TableHead>
                  <TableHead>Betrag</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.map((note) => (
                  <TableRow key={note.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-sm font-semibold text-blue-900">
                      {note.credit_note_number}
                    </TableCell>
                    <TableCell className="font-semibold">{note.employee_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {note.period}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{note.sales_count}</Badge>
                    </TableCell>
                    <TableCell className="font-bold text-green-600 text-lg">
                      {(note.total_commission || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(note.issued_date).toLocaleDateString('de-DE')}
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={note.status} 
                        onValueChange={(value) => updateStatusMutation.mutate({ id: note.id, status: value })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Entwurf">Entwurf</SelectItem>
                          <SelectItem value="Erstellt">Erstellt</SelectItem>
                          <SelectItem value="Versendet">Versendet</SelectItem>
                          <SelectItem value="Bezahlt">Bezahlt</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {creditNotes.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p>Noch keine Gutschriften erstellt</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}