import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Building2, Calendar, User, Package, Euro, Plus } from 'lucide-react';

export default function Bestandskunden() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSparte, setSelectedSparte] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const queryClient = useQueryClient();

  const { data: bestandskunden = [] } = useQuery({
    queryKey: ['bestandskunden'],
    queryFn: () => base44.entities.Bestandskunde.list('-created_date'),
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list(),
  });

  const migratePaidSalesMutation = useMutation({
    mutationFn: async () => {
      const paidSales = sales.filter(s => s.commission_paid);
      
      if (paidSales.length === 0) {
        throw new Error('Keine bezahlten Verkäufe gefunden');
      }

      let kundenNr = bestandskunden.length + 1;
      
      for (const sale of paidSales) {
        const bestandskundeData = {
          kundennummer: `BK-${String(kundenNr).padStart(5, '0')}`,
          firma: sale.customer_name,
          sparte: sale.sparte,
          produkt: sale.product,
          vertragswert: sale.contract_value,
          provision_mitarbeiter: sale.commission_amount,
          mitarbeiter_name: sale.employee_name,
          mitarbeiter_email: sale.employee_id,
          abschlussdatum: sale.sale_date,
          status: 'Aktiv',
          notizen: sale.notes || ''
        };
        
        await base44.entities.Bestandskunde.create(bestandskundeData);
        await base44.entities.Sale.delete(sale.id);
        
        kundenNr++;
      }
      
      return paidSales.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries(['bestandskunden']);
      queryClient.invalidateQueries(['sales']);
      alert(`${count} bezahlte Verkäufe wurden erfolgreich zu Bestandskunden übertragen!`);
    },
    onError: (error) => {
      alert('Fehler: ' + error.message);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Bestandskunde.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['bestandskunden']);
    },
  });

  // Filter
  const filteredKunden = bestandskunden.filter((kunde) => {
    const searchMatch = 
      kunde.kundennummer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kunde.firma?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kunde.mitarbeiter_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const sparteMatch = selectedSparte === 'all' || kunde.sparte === selectedSparte;
    const statusMatch = selectedStatus === 'all' || kunde.status === selectedStatus;
    
    return searchMatch && sparteMatch && statusMatch;
  });

  // Statistiken
  const stats = {
    gesamt: bestandskunden.length,
    aktiv: bestandskunden.filter(k => k.status === 'Aktiv').length,
    gesamtwert: bestandskunden.reduce((sum, k) => sum + (k.vertragswert || 0), 0),
    telekom: bestandskunden.filter(k => k.sparte === 'Telekom').length,
    versatel: bestandskunden.filter(k => k.sparte === '1&1 Versatel').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bestandskunden</h1>
          <p className="text-slate-500 mt-1">Übersicht aller bezahlten und aktiven Verträge</p>
        </div>
        {sales.filter(s => s.commission_paid).length > 0 && (
          <Button 
            onClick={() => {
              if (confirm(`${sales.filter(s => s.commission_paid).length} bezahlte Verkäufe werden zu Bestandskunden übertragen und aus Verkäufen gelöscht. Fortfahren?`)) {
                migratePaidSalesMutation.mutate();
              }
            }}
            className="bg-blue-900 hover:bg-blue-800"
            disabled={migratePaidSalesMutation.isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            {migratePaidSalesMutation.isLoading ? 'Übertrage...' : `${sales.filter(s => s.commission_paid).length} Bezahlte Verkäufe übertragen`}
          </Button>
        )}
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100">
                <Building2 className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Gesamt Kunden</p>
                <p className="text-2xl font-bold text-blue-900">{stats.gesamt}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100">
                <Package className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Aktive Verträge</p>
                <p className="text-2xl font-bold text-green-900">{stats.aktiv}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-100">
                <Euro className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-700">Gesamtwert</p>
                <p className="text-2xl font-bold text-amber-900">
                  {stats.gesamtwert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-100">
                <Building2 className="h-6 w-6 text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700">Sparten</p>
                <p className="text-sm text-purple-900">
                  Telekom: {stats.telekom} | 1&1: {stats.versatel}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Kunde suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="min-w-[150px]">
              <Select value={selectedSparte} onValueChange={setSelectedSparte}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Sparten</SelectItem>
                  <SelectItem value="Telekom">Telekom</SelectItem>
                  <SelectItem value="1&1 Versatel">1&1 Versatel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="Aktiv">Aktiv</SelectItem>
                  <SelectItem value="Gekündigt">Gekündigt</SelectItem>
                  <SelectItem value="Ausgelaufen">Ausgelaufen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kunden Liste */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Bestandskunden ({filteredKunden.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kundennummer</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Sparte</TableHead>
                  <TableHead>Vertragswert</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Abschlussdatum</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKunden.map((kunde) => (
                  <TableRow key={kunde.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="font-mono text-sm font-semibold text-blue-600">
                        {kunde.kundennummer}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-semibold text-slate-900">{kunde.firma}</p>
                          {kunde.ansprechpartner && (
                            <p className="text-xs text-slate-500">{kunde.ansprechpartner}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium text-slate-900">{kunde.produkt}</p>
                        {kunde.bandbreite && (
                          <p className="text-xs text-slate-500">{kunde.bandbreite}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={kunde.sparte === 'Telekom' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}>
                        {kunde.sparte}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {(kunde.vertragswert || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700">{kunde.mitarbeiter_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {kunde.abschlussdatum ? new Date(kunde.abschlussdatum).toLocaleDateString('de-DE') : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={kunde.status} 
                        onValueChange={(value) => updateStatusMutation.mutate({ id: kunde.id, status: value })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Aktiv">Aktiv</SelectItem>
                          <SelectItem value="Gekündigt">Gekündigt</SelectItem>
                          <SelectItem value="Ausgelaufen">Ausgelaufen</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredKunden.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Keine Bestandskunden gefunden
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}