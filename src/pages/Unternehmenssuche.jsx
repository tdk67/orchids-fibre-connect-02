import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MapPin, Building2, Phone, Mail, Plus, Loader2, Trash2, UserPlus, Upload, Map as MapIcon, List, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue in webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons based on lead status
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 25px; height: 25px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [25, 25],
    iconAnchor: [12, 12],
  });
};

const statusColors = {
  'Neu': '#3b82f6', // blue
  'Kontaktiert': '#eab308', // yellow
  'Interessiert': '#22c55e', // green
  'Nicht interessiert': '#ef4444', // red
  'Konvertiert': '#a855f7', // purple
  'Ungültig': '#6b7280', // gray
};

export default function Unternehmenssuche() {
  const [activeSection, setActiveSection] = useState('map');
  const [addressInput, setAddressInput] = useState('');
  const [cityInput, setCityInput] = useState('Berlin');
  const [foundCompanies, setFoundCompanies] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [assignEmployee, setAssignEmployee] = useState('');
  const [user, setUser] = useState(null);
  const [mapCenter] = useState([52.52, 13.405]); // Berlin default
  const [mapZoom] = useState(12);

      if (size > 0.0001) {
        onDrawComplete({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
      }

      if (rect) {
        mapRef.removeLayer(rect);
      }
      setStartPoint(null);
      setRect(null);
    },
  });

  return null;
}

function MapController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  return null;
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  export default function Unternehmenssuche() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeSection, setActiveSection] = useState("map");
      const [user, setUser] = useState(null);
      const [currentCityImportStatus, setCurrentCityImportStatus] = useState(null);


    const { 
      isImporting, 
      progress: importProgress, 
      importCityData, 
      getImportStatus 
    } = useOSMImport();

    const [mapCenter, setMapCenter] = useState([52.52, 13.405]);
    const [mapZoom, setMapZoom] = useState(12);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [cityInput, setCityInput] = useState("Berlin");
    const [newAreaName, setNewAreaName] = useState("");
    const [newAreaBounds, setNewAreaBounds] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [savedAreas, setSavedAreas] = useState([]);
    const [selectedAreaId, setSelectedAreaId] = useState(null);
    const [filterCity, setFilterCity] = useState("");
    const [filterAreaId, setFilterAreaId] = useState("all");

    const isPointInBounds = useCallback((lat, lng, bounds) => {
      if (!lat || !lng || !bounds) return false;
      const b = typeof bounds === "string" ? JSON.parse(bounds) : bounds;
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      return (
        latitude <= b.north &&
        latitude >= b.south &&
        longitude <= b.east &&
        longitude >= b.west
      );
    }, []);

    const getAreaLeadMatch = useCallback((lead, area) => {
      if (!lead || !area) return false;

      // 1. Spatial check (most accurate)
      if (lead.latitude && lead.longitude && area.bounds) {
        return isPointInBounds(lead.latitude, lead.longitude, area.bounds);
      }
      
      // 2. Fallback to street name matching if no coordinates
      const leadCity = lead.stadt?.toLowerCase()?.trim() || "";
      const areaCity = area.city?.toLowerCase()?.trim() || "";
      
      if (areaCity && leadCity !== areaCity) return false;
      
      const streets = typeof area.streets === "string" ? JSON.parse(area.streets) : area.streets || [];
      const leadStreet = lead.strasse_hausnummer?.toLowerCase()?.trim() || "";
      
      return streets.some(s => {
        const streetName = s.name?.toLowerCase()?.trim() || "";
        return streetName && leadStreet.startsWith(streetName);
      });
    }, [isPointInBounds]);

    useEffect(() => {
      const fetchStatus = async () => {
        if (cityInput) {
          const status = await getImportStatus(cityInput);
          setCurrentCityImportStatus(status);
        }
      };
      fetchStatus();
    }, [cityInput, getImportStatus]);

    useEffect(() => {
      base44.auth.me().then(setUser).catch(() => {});
      loadAreas();
    }, []);
  const [genAreaId, setGenAreaId] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "firma", direction: "asc" });

  const selectedArea = useMemo(() => {
    const areaId =
      genAreaId !== "all" ? genAreaId : selectedAreaId || filterAreaId;
    return savedAreas.find((a) => a.id === areaId);
  }, [savedAreas, selectedAreaId, filterAreaId, genAreaId]);

  const [showAreaDialog, setShowAreaDialog] = useState(false);

  // Load user
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list(),
  });

  // Fetch all leads for map display
  const { data: allLeads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ['allLeads'],
    queryFn: async () => {
      const leads = await base44.entities.Lead.list();
      return leads;
    },
  });

  // Filter leads that have coordinates (latitude/longitude)
  const leadsWithCoordinates = useMemo(() => {
    return allLeads.filter(lead => {
      const lat = parseFloat(lead.latitude);
      const lng = parseFloat(lead.longitude);
      return !isNaN(lat) && !isNaN(lng);
    });
  }, [allLeads]);

  // Search companies using web scraping
  const searchCompaniesInCity = async () => {
    if (!addressInput.trim()) {
      alert('Bitte geben Sie eine Adresse oder Straße ein');
      return;
    }

    setIsSearching(true);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Finde ALLE Unternehmen an dieser Adresse/Straße: "${addressInput}, ${cityInput}"

AUFGABE:
1. Suche ALLE Firmen/Unternehmen die an dieser EXAKTEN Adresse/Straße registriert sind
2. Prüfe auch Unterhausnummern wie 15a, 15b, 15c usw.
3. Suche auch benachbarte Hausnummern auf gleicher Straße
4. Straße und Stadt müssen übereinstimmen

SUCHE NACH:
- Alle Unternehmen im Gebäude (alle Etagen)
- Unterhausnummern (a, b, c, usw.)
- Hinterhaus/Seitenflügel

      const data = await streetsResult.json();
      const streetNames = Array.from(
        new Set(
          (data.elements || []).map((el) => el.tags?.name).filter(Boolean),
        ),
      ).map((name) => ({ name }));

FÜR JEDES UNTERNEHMEN ANGEBEN:
- Firmenname
- Vollständige Adresse
- Telefonnummer
- E-Mail (falls vorhanden)
- Branche
- Koordinaten (Latitude, Longitude)

Nutze Google Maps, Gelbe Seiten, Google My Business, Das Örtliche, Handelsregister.
Liste ALLE gefundenen Unternehmen auf - auch wenn es viele sind!`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            companies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  firma: { type: "string", description: "Vollständiger Firmenname" },
                  strasse_hausnummer: { type: "string", description: "Straße und Hausnummer" },
                  postleitzahl: { type: "string", description: "PLZ" },
                  stadt: { type: "string", description: "Stadt" },
                  telefon: { type: "string", description: "Telefonnummer mit Vorwahl" },
                  email: { type: "string", description: "E-Mail-Adresse" },
                  branche: { type: "string", description: "Branche/Geschäftsfeld" },
                  webseite: { type: "string", description: "Webseite URL" },
                  latitude: { type: "number", description: "Latitude coordinate" },
                  longitude: { type: "number", description: "Longitude coordinate" }
                }
              }
            }
          }
        }
      });

      const companies = result.companies || [];
      const companiesFiltered = companies.filter(c => c.telefon || c.email);
      const companiesWithId = companiesFiltered.map(c => ({
        ...c,
        source_address: `${addressInput}, ${cityInput}`,
        id: `${Date.now()}-${Math.random()}`
      }));
      
      setFoundCompanies(prev => [...prev, ...companiesWithId]);
      
      if (companies.length === 0) {
        alert(`Kein Unternehmen an "${addressInput}, ${cityInput}" gefunden.`);
      } else {
        alert(`${companiesFiltered.length} Unternehmen gefunden!`);
      }
    } catch (error) {
      console.error('Suche fehlgeschlagen:', error);
      alert('Fehler bei der Suche: ' + error.message);
    } finally {
      setIsSearching(false);
    }
  }

  // Add selected companies as leads
  const addCompaniesToLeads = async () => {
    if (foundCompanies.length === 0) {
      alert('Keine Unternehmen zum Hinzufügen vorhanden');
      return;
    }
    if (!assignEmployee) {
      toast({
        title: "Warnung",
        description: "Bitte wählen Sie einen Mitarbeiter aus",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find(e => e.full_name === assignEmployee);

    const leadsToCreate = foundCompanies.map(company => ({
      firma: company.firma || '',
      strasse_hausnummer: company.strasse_hausnummer || '',
      postleitzahl: company.postleitzahl || '',
      stadt: company.stadt || cityInput,
      telefon: company.telefon || '',
      email: company.email || '',
      infobox: `Branche: ${company.branche || '-'}\nWebseite: ${company.webseite || '-'}\nGefunden über: ${company.source_address}`,
      assigned_to: employee?.full_name || '',
      assigned_to_email: employee?.email || '',
      status: 'Neu',
      sparte: '1&1 Versatel',
      latitude: company.latitude?.toString() || '',
      longitude: company.longitude?.toString() || ''
    }));

    try {
      await base44.entities.Lead.bulkCreate(leadsToCreate);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['allLeads']);

      setFoundCompanies([]);
      setAddressInput('');

      alert(`${leadsToCreate.length} Leads erfolgreich erstellt und ${employee?.full_name} zugewiesen!`);
    } catch (error) {
      alert('Fehler beim Erstellen: ' + error.message);
    }
  };

  const removeCompany = (companyId) => {
    setFoundCompanies(prev => prev.filter(c => c.id !== companyId));
  };

  const clearAllCompanies = () => {
    setFoundCompanies([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Unternehmensuche</h1>
          <p className="text-slate-500 mt-1">Finden und verwalten Sie neue Leads</p>
        </div>
      </div>

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-3 bg-slate-100">
          <TabsTrigger value="map" className="flex items-center gap-2">
            <MapIcon className="h-4 w-4" />
            Karte
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Leads ({leadsWithCoordinates.length})
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Lead Generator
          </TabsTrigger>
        </TabsList>

        {/* MAP SECTION */}
        <TabsContent value="map" className="mt-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Karte - Alle Leads anzeigen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] w-full rounded-lg overflow-hidden border-2 border-slate-200">
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Display all leads with coordinates */}
                  {leadsWithCoordinates.map((lead) => {
                    const lat = parseFloat(lead.latitude);
                    const lng = parseFloat(lead.longitude);
                    const statusColor = statusColors[lead.status] || statusColors['Neu'];

                    return (
                      <Marker
                        key={lead.id}
                        position={[lat, lng]}
                        icon={createCustomIcon(statusColor)}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-slate-900">{lead.firma || 'Unbekannt'}</h3>
                            <p className="text-sm text-slate-600 mt-1">
                              {lead.strasse_hausnummer}
                              {lead.postleitzahl && `, ${lead.postleitzahl}`}
                              {lead.stadt && ` ${lead.stadt}`}
                            </p>
                            {lead.telefon && (
                              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" /> {lead.telefon}
                              </p>
                            )}
                            {lead.email && (
                              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                <Mail className="h-3 w-3" /> {lead.email}
                              </p>
                            )}
                            <Badge className="mt-2" style={{ backgroundColor: statusColor }}>
                              {lead.status}
                            </Badge>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
              {isLoadingLeads && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-slate-600">Lade Leads...</span>
                </div>
              )}
              <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Legende</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {Object.entries(statusColors).map(([status, color]) => (
                    <div key={status} className="flex items-center gap-2">
                      <div style={{ backgroundColor: color }} className="w-4 h-4 rounded-full border-2 border-white shadow" />
                      <span className="text-slate-700">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEADS SECTION */}
        <TabsContent value="leads" className="mt-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-green-600" />
                Gefundene Leads mit Koordinaten ({leadsWithCoordinates.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leadsWithCoordinates.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>Keine Leads mit Koordinaten vorhanden</p>
                  <p className="text-sm">Generieren Sie neue Leads im Lead Generator</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {leadsWithCoordinates.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 bg-white"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900">{lead.firma || 'Unbekannt'}</h4>
                          <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                            {lead.strasse_hausnummer && (
                              <p>{lead.strasse_hausnummer}, {lead.postleitzahl} {lead.stadt}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-1">
                              {lead.telefon && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {lead.telefon}
                                </span>
                              )}
                              {lead.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {lead.email}
                                </span>
                              )}
                            </div>
                            {lead.assigned_to && (
                              <p className="text-xs text-slate-500 mt-1">Zugewiesen an: {lead.assigned_to}</p>
                            )}
                          </div>
                        </div>
                        <Badge style={{ backgroundColor: statusColors[lead.status] || statusColors['Neu'] }}>
                          {lead.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEAD GENERATOR SECTION */}
        <TabsContent value="generator" className="mt-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-amber-600" />
                Lead Generator - Unternehmen finden
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Search Input */}
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-4">Suche nach Unternehmen</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Adresse / Straße *</Label>
                      <Input
                        value={addressInput}
                        onChange={(e) => setAddressInput(e.target.value)}
                        placeholder="z.B. Hauptstraße 15"
                        className="bg-white mt-1"
                      />
                    </div>
                    <div>
                      <Label>Stadt *</Label>
                      <Input
                        value={cityInput}
                        onChange={(e) => setCityInput(e.target.value)}
                        placeholder="z.B. Berlin"
                        className="bg-white mt-1"
                      />
                    </div>
                    <Button
                      onClick={searchCompaniesInCity}
                      disabled={isSearching}
                      className="w-full bg-amber-600 hover:bg-amber-700"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Suche läuft...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Unternehmen suchen
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Found Companies */}
                {foundCompanies.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-green-600" />
                        Gefundene Unternehmen ({foundCompanies.length})
                      </h3>
                      <Button variant="outline" size="sm" onClick={clearAllCompanies}>
                        Liste leeren
                      </Button>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg mb-4 border border-green-200">
                      <Label className="text-green-900">Mitarbeiter zuweisen *</Label>
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
                      <Button
                        onClick={addCompaniesToLeads}
                        disabled={!assignEmployee}
                        className="w-full mt-3 bg-green-600 hover:bg-green-700"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {foundCompanies.length} als Leads hinzufügen
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {foundCompanies.map((company) => (
                        <div
                          key={company.id}
                          className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
                        >
                          <div className="flex items-start gap-3">
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
                                {(company.latitude && company.longitude) && (
                                  <p className="text-xs text-green-600 mt-1">✓ Koordinaten vorhanden</p>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-1">Gefunden: {company.source_address}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {foundCompanies.length === 0 && !isSearching && (
                  <div className="text-center py-12 text-slate-500">
                    <Search className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>Noch keine Unternehmen gefunden</p>
                    <p className="text-sm">Geben Sie eine Adresse ein und starten Sie die Suche</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
