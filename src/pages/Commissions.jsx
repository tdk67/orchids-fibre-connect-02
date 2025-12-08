import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCircle, Euro, TrendingUp, Calendar } from 'lucide-react';

export default function Commissions() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sale_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  // Filter sales by month and employee
  const filteredSales = sales.filter((sale) => {
    const monthMatch = sale.sale_date?.startsWith(selectedMonth);
    
    // Nicht-Admins sehen nur ihre eigenen Verkäufe
    if (user?.role !== 'admin') {
      return monthMatch && sale.employee_id === user?.email;
    }
    
    const employeeMatch = selectedEmployee === 'all' || sale.employee_name === selectedEmployee;
    return monthMatch && employeeMatch;
  });

  // Group by employee
  const commissionsByEmployee = {};
  filteredSales.forEach((sale) => {
    if (!commissionsByEmployee[sale.employee_name]) {
      commissionsByEmployee[sale.employee_name] = {
        employee: sale.employee_name,
        total_commission: 0,
        total_revenue: 0,
        sales_count: 0,
        paid_count: 0,
        unpaid_count: 0,
        sales: []
      };
    }
    commissionsByEmployee[sale.employee_name].total_commission += sale.commission_amount || 0;
    commissionsByEmployee[sale.employee_name].total_revenue += sale.contract_value || 0;
    commissionsByEmployee[sale.employee_name].sales_count += 1;
    if (sale.commission_paid) {
      commissionsByEmployee[sale.employee_name].paid_count += 1;
    } else {
      commissionsByEmployee[sale.employee_name].unpaid_count += 1;
    }
    commissionsByEmployee[sale.employee_name].sales.push(sale);
  });

  const commissionSummary = Object.values(commissionsByEmployee);
  const totalCommissions = commissionSummary.reduce((sum, e) => sum + e.total_commission, 0);
  const totalRevenue = commissionSummary.reduce((sum, e) => sum + e.total_revenue, 0);
  const totalSales = commissionSummary.reduce((sum, e) => sum + e.sales_count, 0);

  // Generate month options (last 12 months)
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    monthOptions.push(date.toISOString().slice(0, 7));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Provisionsübersicht</h1>
        <p className="text-slate-500 mt-1">Analyse der Provisionen nach Mitarbeiter und Zeitraum</p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Monat</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
{user?.role === 'admin' && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-slate-700 mb-2 block">Mitarbeiter</label>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100">
                <Euro className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Gesamtprovisionen</p>
                <p className="text-2xl font-bold text-green-900">
                  {totalCommissions.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100">
                <TrendingUp className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Gesamtumsatz</p>
                <p className="text-2xl font-bold text-blue-900">
                  {totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-100">
                <Calendar className="h-6 w-6 text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700">Verkäufe</p>
                <p className="text-2xl font-bold text-purple-900">{totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

{user?.role === 'admin' && (
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Provisionen nach Mitarbeiter</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Verkäufe</TableHead>
                    <TableHead>Umsatz</TableHead>
                    <TableHead>Provision</TableHead>
                    <TableHead>Bezahlt</TableHead>
                    <TableHead>Offen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionSummary.map((item) => (
                    <TableRow key={item.employee} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-slate-400" />
                          <span className="font-semibold text-slate-900">{item.employee}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">
                          {item.sales_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {item.total_revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </TableCell>
                      <TableCell className="font-bold text-green-600 text-lg">
                        {item.total_commission.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">
                          {item.paid_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-100 text-amber-800">
                          {item.unpaid_count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {commissionSummary.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                Keine Provisionen für den ausgewählten Zeitraum
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed Sales */}
      {(user?.role === 'admin' ? (selectedEmployee !== 'all' && commissionsByEmployee[selectedEmployee]) : commissionSummary.length > 0) && (
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>
              {user?.role === 'admin' ? `Verkäufe von ${selectedEmployee}` : 'Meine Verkäufe'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Sparte</TableHead>
                    <TableHead>Vertragswert</TableHead>
                    <TableHead>Provision</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(user?.role === 'admin' 
                    ? commissionsByEmployee[selectedEmployee].sales 
                    : filteredSales
                  ).map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-slate-50">
                      <TableCell className="text-sm">
                        {new Date(sale.sale_date).toLocaleDateString('de-DE')}
                      </TableCell>
                      <TableCell className="font-semibold">{sale.customer_name}</TableCell>
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
                        <Badge className={sale.commission_paid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                          {sale.commission_paid ? 'Bezahlt' : 'Offen'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}