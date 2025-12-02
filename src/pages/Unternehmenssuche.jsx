import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, MapPin, Building2, Phone, Mail, Plus, Loader2, Trash2, UserPlus, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Unternehmenssuche() {
  const [addressInput, setAddressInput] = useState('');
  const [addressList, setAddressList] = useState([]);
  const [foundCompanies, setFoundCompanies] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState('');
  const [assignEmployee, setAssignEmployee] = useState('');
  const [assignStatus, setAssignStatus] = useState('');
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: leadStatuses = [] } = useQuery({
    queryKey: ['leadStatuses'],
    queryFn: () => base44.entities.LeadStatus.list('order'),
  });

  const handlePasteAddresses = () => {
    if (!addressInput.trim()) return;
    const newAddresses = addressInput
      .split('\n')
      .map(a => a.trim())
      .filter(a => a.length > 0);
    setAddressList([...addressList, ...newAddresses]);
    setAddressInput('');
    setIsAddressDialogOpen(false);
  };

  const removeAddress = (index) => {
    setAddressList(addressList.filter((_, i) => i !== index));
  };

  const searchCompaniesForAddress = async (address) => {
    setSearchingAddress(address);
    setIsSearching(true);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Finde das Unternehmen/die Firma die sich EXAKT an dieser Adresse befindet: "${address}".
        Suche NUR nach dem Unternehmen das genau an dieser Adresse registriert/ansässig ist.
        Keine Unternehmen in der Nähe, nur exakt diese Adresse.
        Wenn kein Unternehmen an dieser exakten Adresse gefunden wird, gib ein leeres Array zurück.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            companies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  firma: { type: "string" },
                  strasse_hausnummer: { type: "string" },
                  postleitzahl: { type: "string" },
                  stadt: { type: "string" },
                  telefon: { type: "string" },
                  email: { type: "string" },
                  branche: { type: "string" }
                }
              }
            }
          }
        }
      });

      const companies = result.companies || [];
      const companiesWithSource = companies.map(c => ({
        ...c,
        source_address: address,
        id: `${Date.now()}-${Math.random()}`
      }));
      
      setFoundCompanies(prev => [...prev, ...companiesWithSource]);
    } catch (error) {
      console.error('Suche fehlgeschlagen:', error);
      alert('Fehler bei der Suche: ' + error.message);
    } finally {
      setIsSearching(false);
      setSearchingAddress('');
    }
  };

  const searchSingleAddress = async (address) => {
    await searchCompaniesForAddress(address);
    // Address stays in list until added as lead
  };

  const toggleCompanySelection = (companyId) => {
    setSelectedCompanies(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const selectAllCompanies = () => {
    if (selectedCompanies.length === foundCompanies.length) {
      setSelectedCompanies([]);
    } else {
      setSelectedCompanies(foundCompanies.map(c => c.id));
    }
  };

  const addSelectedToLeads = async () => {
    if (selectedCompanies.length === 0) {
      alert('Bitte wählen Sie mindestens ein Unternehmen aus');
      return;
    }
    if (!assignEmployee) {
      alert('Bitte wählen Sie einen Mitarbeiter aus');
      return;
    }

    const employee = employees.find(e => e.full_name === assignEmployee);
    const companiestoAdd = foundCompanies.filter(c => selectedCompanies.includes(c.id));

    const leadsToCreate = companiestoAdd.map(company => ({
      firma: company.firma || '',
      strasse_hausnummer: company.strasse_hausnummer || '',
      postleitzahl: company.postleitzahl || '',
      stadt: company.stadt || '',
      telefon: company.telefon || '',
      email: company.email || '',
      infobox: `Branche: ${company.branche || '-'}\nGefunden über: ${company.source_address}`,
      assigned_to: employee?.full_name || '',
      assigned_to_email: employee?.email || '',
      status: assignStatus || '',
      sparte: '1&1 Versatel'
    }));

    try {
      await base44.entities.Lead.bulkCreate(leadsToCreate);
      queryClient.invalidateQueries(['leads']);
      
      // Get source addresses of added companies and remove them from address list
      const addedSourceAddresses = companiestoAdd.map(c => c.source_address);
      setAddressList(prev => prev.filter(a => !addedSourceAddresses.includes(a)));
      
      // Remove added companies from list
      setFoundCompanies(prev => prev.filter(c => !selectedCompanies.includes(c.id)));
      setSelectedCompanies([]);
      
      alert(`${leadsToCreate.length} Leads erfolgreich erstellt und ${employee?.full_name} zugewiesen!`);
    } catch (error) {
      alert('Fehler beim Erstellen: ' + error.message);
    }
  };

  const removeCompany = (companyId) => {
    setFoundCompanies(prev => prev.filter(c => c.id !== companyId));
    setSelectedCompanies(prev => prev.filter(id => id !== companyId));
  };

  const clearAllCompanies = () => {
    setFoundCompanies([]);
    setSelectedCompanies([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Unternehmenssuche</h1>
        <p className="text-slate-500 mt-1">Finden Sie Unternehmen anhand von Adresspunkten</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Adress-Eingabe Button */}
                  <Card className="border-0 shadow-md">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        Adresspunkte
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full bg-blue-900 hover:bg-blue-800">
                            <Upload className="h-4 w-4 mr-2" />
                            Adressen einfügen
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Adressen einfügen</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                              Fügen Sie Adressen ein - eine Adresse pro Zeile
                            </div>
                            <Textarea
                              value={addressInput}
                              onChange={(e) => setAddressInput(e.target.value)}
                              placeholder="z.B.&#10;Hauptstraße 1, 10115 Berlin&#10;Musterweg 5, 80331 München&#10;Industriestraße 23, 60329 Frankfurt"
                              rows={10}
                            />
                            <p className="text-xs text-slate-500">
                              {addressInput ? `${addressInput.split('\n').filter(l => l.trim()).length} Adressen erkannt` : 'Keine Adressen eingefügt'}
                            </p>
                            <div className="flex justify-end gap-3">
                              <Button variant="outline" onClick={() => setIsAddressDialogOpen(false)}>
                                Abbrechen
                              </Button>
                              <Button 
                                onClick={handlePasteAddresses}
                                disabled={!addressInput.trim()}
                                className="bg-blue-900 hover:bg-blue-800"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Hinzufügen
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>

        {/* Adressliste zum Anklicken */}
        <Card className="border-0 shadow-md lg:col-span-2">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-amber-600" />
                Zu durchsuchen ({addressList.length})
              </CardTitle>
              {addressList.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setAddressList([])}>
                  Leeren
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {addressList.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Keine Adressen</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {addressList.map((addr, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-amber-50 rounded text-sm group"
                  >
                    <Button
                      size="sm"
                      onClick={() => searchSingleAddress(addr)}
                      disabled={isSearching}
                      className="bg-amber-500 hover:bg-amber-600 h-7 px-2"
                    >
                      {isSearching && searchingAddress === addr ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Search className="h-3 w-3" />
                      )}
                    </Button>
                    <span className="truncate flex-1 text-slate-700">{addr}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeAddress(index)}
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gefundene Unternehmen */}
        <Card className="border-0 shadow-md lg:col-span-2 lg:row-span-2">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-green-600" />
                Gefundene Unternehmen ({foundCompanies.length})
              </CardTitle>
              {foundCompanies.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllCompanies}>
                    {selectedCompanies.length === foundCompanies.length ? 'Keine auswählen' : 'Alle auswählen'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAllCompanies}>
                    Liste leeren
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {foundCompanies.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>Noch keine Unternehmen gefunden</p>
                <p className="text-sm">Fügen Sie Adressen hinzu und starten Sie die Suche</p>
              </div>
            ) : (
              <>
                {/* Zuweisung */}
                <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-blue-900">Mitarbeiter zuweisen</Label>
                      <Select value={assignEmployee} onValueChange={setAssignEmployee}>
                        <SelectTrigger className="bg-white mt-1">
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
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-blue-900">Status</Label>
                      <Select value={assignStatus} onValueChange={setAssignStatus}>
                        <SelectTrigger className="bg-white mt-1">
                          <SelectValue placeholder="Status wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {leadStatuses.map((status) => (
                            <SelectItem key={status.id} value={status.name}>
                              {status.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={addSelectedToLeads}
                      disabled={selectedCompanies.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {selectedCompanies.length} als Leads hinzufügen
                    </Button>
                  </div>
                </div>

                {/* Unternehmensliste */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {foundCompanies.map((company) => (
                    <div 
                      key={company.id} 
                      className={`p-3 rounded-lg border transition-colors ${
                        selectedCompanies.includes(company.id) 
                          ? 'bg-green-50 border-green-300' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedCompanies.includes(company.id)}
                          onCheckedChange={() => toggleCompanySelection(company.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-slate-900">{company.firma || 'Unbekannt'}</h4>
                            <Button variant="ghost" size="sm" onClick={() => removeCompany(company.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                            {company.strasse_hausnummer && (
                              <p>{company.strasse_hausnummer}, {company.postleitzahl} {company.stadt}</p>
                            )}
                            <div className="flex flex-wrap gap-3">
                              {company.telefon && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {company.telefon}
                                </span>
                              )}
                              {company.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {company.email}
                                </span>
                              )}
                            </div>
                            {company.branche && (
                              <Badge variant="outline" className="text-xs mt-1">{company.branche}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Gefunden: {company.source_address}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}