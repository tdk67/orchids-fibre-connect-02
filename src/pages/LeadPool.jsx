import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Users, Database, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function LeadPool() {
  const [user, setUser] = useState(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [selectedBenutzertyp, setSelectedBenutzertyp] = useState(() => {
    return localStorage.getItem('selectedBenutzertyp') || 'Interner Mitarbeiter';
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      if (!localStorage.getItem('selectedBenutzertyp')) {
        setSelectedBenutzertyp(u?.benutzertyp || 'Interner Mitarbeiter');
      }
      
      // Automatische Lead-Zuweisung im Hintergrund
      base44.functions.invoke('autoCheckAllEmployees', {}).catch(() => {});
    }).catch(() => {});

    const handleBenutzertypChange = () => {
      setSelectedBenutzertyp(localStorage.getItem('selectedBenutzertyp') || 'Interner Mitarbeiter');
    };

    window.addEventListener('benutzertypChanged', handleBenutzertypChange);
    return () => window.removeEventListener('benutzertypChanged', handleBenutzertypChange);
  }, []);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  // Statistiken
  const userBenutzertyp = user?.benutzertyp || 'Interner Mitarbeiter';
  const isInternalAdmin = user?.role === 'admin' && userBenutzertyp === 'Interner Mitarbeiter';
  
  const filteredLeads = leads.filter(l => {
    if (isInternalAdmin) {
      return l.benutzertyp === selectedBenutzertyp;
    } else {
      return l.benutzertyp === userBenutzertyp;
    }
  });

  const poolLeads = filteredLeads.filter(l => l.pool_status === 'im_pool');
  const assignedLeads = filteredLeads.filter(l => l.pool_status === 'zugewiesen');
  const completedLeads = filteredLeads.filter(l => l.pool_status === 'bearbeitet');

  // Mitarbeiter-Statistiken
  const employeeStats = employees.map(emp => {
    const empLeads = assignedLeads.filter(l => l.assigned_to_email === emp.email);
    return {
      employee: emp,
      assignedCount: empLeads.length,
      needsMore: empLeads.length < 100
    };
  });

  const findDuplicateLead = (newLead, existingLeads) => {
    return existingLeads.find(existing => {
      const sameCompany = existing.firma?.toLowerCase() === newLead.firma?.toLowerCase();
      const sameAddress = existing.postleitzahl === newLead.postleitzahl && 
                          existing.strasse_hausnummer?.toLowerCase() === newLead.strasse_hausnummer?.toLowerCase();
      const samePhone = existing.telefon && newLead.telefon && existing.telefon === newLead.telefon;

      return sameCompany && (sameAddress || samePhone);
    });
  };

  const mergeDuplicateData = (existing, newData) => {
    return {
      ...existing,
      ansprechpartner: newData.ansprechpartner || existing.ansprechpartner,
      telefon: newData.telefon || existing.telefon,
      telefon2: newData.telefon2 || existing.telefon2 || newData.telefon,
      email: newData.email || existing.email,
      infobox: `${existing.infobox || ''}\n\n[Pool-Import ${new Date().toLocaleDateString('de-DE')}] Duplikat erkannt und zusammengeführt:\n${newData.ansprechpartner ? `Ansprechpartner: ${newData.ansprechpartner}\n` : ''}${newData.telefon ? `Telefon: ${newData.telefon}\n` : ''}${newData.telefon2 ? `Telefon2: ${newData.telefon2}\n` : ''}${newData.email ? `Email: ${newData.email}` : ''}`.trim()
    };
  };

  const handlePoolImport = async () => {
    if (!pastedData.trim()) return;

    setIsImporting(true);

    try {
      const lines = pastedData.trim().split('\n');
      const existingLeads = await base44.entities.Lead.list();

      let imported = 0;
      let merged = 0;

      const parsedLeads = lines.map(line => {
        const columns = line.split('\t');
        return {
          leadnummer: columns[0] || '',
          cluster_id: columns[1] || '',
          firma: columns[2] || '',
          ansprechpartner: columns[3] || '',
          stadt: columns[4] || '',
          postleitzahl: columns[5] || '',
          strasse_hausnummer: columns[6] || '',
          telefon: columns[7] || '',
          telefon2: columns[8] || '',
          email: columns[9] || '',
          infobox: columns[10] || '',
          pool_status: 'im_pool',
          sparte: '1&1 Versatel',
          benutzertyp: user?.benutzertyp || 'Interner Mitarbeiter'
        };
      }).filter(lead => lead.firma);

      if (parsedLeads.length === 0) {
        alert('Keine gültigen Daten gefunden');
        setIsImporting(false);
        return;
      }

      for (const newLead of parsedLeads) {
        const duplicate = findDuplicateLead(newLead, existingLeads);

        if (duplicate) {
          const mergedData = mergeDuplicateData(duplicate, newLead);
          await base44.entities.Lead.update(duplicate.id, mergedData);
          merged++;
        } else {
          await base44.entities.Lead.create(newLead);
          imported++;
        }
      }

      queryClient.invalidateQueries(['leads']);
      setIsImportDialogOpen(false);
      setPastedData('');
      alert(`Pool-Import erfolgreich!\n${imported} neue Leads erstellt\n${merged} Duplikate zusammengeführt`);
    } catch (error) {
      alert('Fehler beim Import: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAutoAssignAll = async () => {
    if (!confirm('Automatisch Leads an alle Mitarbeiter verteilen die weniger als 100 Leads haben?')) {
      return;
    }

    setIsAutoAssigning(true);
    let totalAssigned = 0;

    try {
      for (const emp of employees) {
        const { data: result } = await base44.functions.invoke('autoAssignLeads', {
          employeeEmail: emp.email
        });

        if (result.success) {
          totalAssigned += result.assigned;
        } else if (result.message) {
          console.log(`${emp.full_name}: ${result.message}`);
        }
      }

      queryClient.invalidateQueries(['leads']);
      alert(`${totalAssigned} Leads automatisch zugewiesen!`);
    } catch (error) {
      alert('Fehler bei automatischer Zuweisung: ' + error.message);
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleManualAssign = async (employeeEmail) => {
    try {
      const { data: result } = await base44.functions.invoke('autoAssignLeads', {
        employeeEmail
      });

      queryClient.invalidateQueries(['leads']);
      if (result.success) {
        alert(result.message);
      } else if (result.message) {
        alert(result.message);
      }
    } catch (error) {
      alert('Fehler bei Zuweisung: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lead Pool Management</h1>
          <p className="text-slate-500 mt-1">Automatische Lead-Verteilung</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Leads in Pool importieren
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Leads in Pool importieren</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 font-medium mb-2">Pool-Import:</p>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc ml-4">
                    <li>Leads werden zunächst NICHT zugewiesen (Status: im_pool)</li>
                    <li>Automatische Verteilung erfolgt dann an Mitarbeiter mit weniger als 50 Leads</li>
                    <li>Optimal für große Mengen (z.B. 5000 Leads)</li>
                  </ul>
                  <p className="text-xs text-blue-900 font-medium mt-3 mb-1">Spaltenreihenfolge:</p>
                  <p className="text-xs text-blue-800">Leadnummer | Cluster-ID | Firma | Ansprechpartner | Stadt | PLZ | Straße & Nr. | Telefon | Telefon2 | Email | Infobox</p>
                </div>
                <div className="space-y-2">
                  <Label>Daten aus Excel einfügen</Label>
                  <Textarea
                    value={pastedData}
                    onChange={(e) => setPastedData(e.target.value)}
                    placeholder="Kopieren Sie Zeilen aus Excel und fügen Sie sie hier ein..."
                    rows={15}
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
                  }}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handlePoolImport}
                    disabled={!pastedData.trim() || isImporting}
                    className="bg-blue-900 hover:bg-blue-800"
                  >
                    {isImporting ? 'Importiere...' : 'In Pool importieren'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            onClick={handleAutoAssignAll}
            disabled={isAutoAssigning || poolLeads.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAutoAssigning ? 'animate-spin' : ''}`} />
            Auto-Verteilung starten
          </Button>
        </div>
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Im Pool (unzugewiesen)</p>
                <p className="text-3xl font-bold text-slate-900">{poolLeads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-600 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Zugewiesen (aktiv)</p>
                <p className="text-3xl font-bold text-slate-900">{assignedLeads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Bearbeitet</p>
                <p className="text-3xl font-bold text-slate-900">{completedLeads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mitarbeiter Übersicht */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Mitarbeiter Lead-Übersicht (Ziel: 100 Leads pro Mitarbeiter)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Sparte</TableHead>
                  <TableHead>Zugewiesene Leads</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeStats.map(({ employee, assignedCount, needsMore }) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-semibold">{employee.full_name}</TableCell>
                    <TableCell className="text-sm text-slate-600">{employee.email}</TableCell>
                    <TableCell>
                      <Badge className={employee.sparte === 'Telekom' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}>
                        {employee.sparte}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{assignedCount}</span>
                        <span className="text-slate-500">/ 100</span>
                        <div className="w-24 bg-slate-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${assignedCount >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min((assignedCount / 100) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assignedCount >= 100 ? (
                        <Badge className="bg-green-100 text-green-800">Voll</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800">Braucht {100 - assignedCount} mehr</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleManualAssign(employee.email)}
                        disabled={!needsMore || poolLeads.length === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Leads zuweisen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-3">So funktioniert das Lead-Pool-System:</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>✅ Importieren Sie große Mengen Leads (z.B. 5000) in den Pool</li>
            <li>✅ Leads werden im Hintergrund als "im_pool" verwaltet (nicht sichtbar)</li>
            <li>✅ Jeder Mitarbeiter soll 100 aktive Leads gleichzeitig haben</li>
            <li>✅ Klicken Sie "Auto-Verteilung" um automatisch zu verteilen</li>
            <li>✅ Wenn ein Mitarbeiter Leads bearbeitet (Status ändert), werden automatisch neue Leads nachgeliefert</li>
            <li>⚠️ <strong>Limit-Regel:</strong> Bei ≥10 "Bearbeitet", ≥10 "Adresspunkte" oder ≥50 "Nicht erreicht" keine neuen Leads</li>
            <li>✅ System prüft automatisch: Hat Mitarbeiter {"<"} 100 Leads? → Neue Leads aus Pool zuweisen</li>
            <li>ℹ️ Pool-Leads werden nicht angezeigt - nur für die automatische Verteilung im Hintergrund</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}