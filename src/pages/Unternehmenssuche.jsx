import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, Rectangle, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  MapPin,
  Building2,
  Phone,
  Mail,
  Loader2,
  Trash2,
  UserPlus,
  Map as MapIcon,
  List,
  Crosshair,
  PlayCircle,
} from 'lucide-react';

// Fix Leaflet default marker icon issue in webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const statusColors = {
  Neu: '#3b82f6',
  Kontaktiert: '#eab308',
  Interessiert: '#22c55e',
  'Nicht interessiert': '#ef4444',
  Konvertiert: '#a855f7',
  Ungültig: '#6b7280',
};

const createCustomIcon = (color) =>
  L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 25px; height: 25px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [25, 25],
    iconAnchor: [12, 12],
  });

function AreaSelector({ isDrawing, onComplete, setDrawStart, drawStart }) {
  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      if (!drawStart) {
        setDrawStart(e.latlng);
      } else {
        const bounds = L.latLngBounds(drawStart, e.latlng);
        onComplete(bounds);
        setDrawStart(null);
      }
    },
  });
  return null;
}

// Fallback scraper using Overpass (open data) if Supabase edge function fails
async function fetchPOIsFromOverpass(street, city) {
  const query = `
    [out:json][timeout:25];
    (
      node["name"]["addr:street"="${street}"]["addr:city"="${city}"];
      way["name"]["addr:street"="${street}"]["addr:city"="${city}"];
      node["shop"]["addr:street"="${street}"]["addr:city"="${city}"];
      way["shop"]["addr:street"="${street}"]["addr:city"="${city}"];
      node["office"]["addr:street"="${street}"]["addr:city"="${city}"];
      way["office"]["addr:street"="${street}"]["addr:city"="${city}"];
    );
    out center tags;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  });
  if (!res.ok) throw new Error('Overpass Anfrage fehlgeschlagen');
  const data = await res.json();
  const companies = (data.elements || []).map((el) => {
    const tags = el.tags || {};
    const lat = el.lat || el.center?.lat;
    const lon = el.lon || el.center?.lon;
    if (!lat || !lon) return null;
    const streetNum = tags['addr:housenumber'] ? `${street} ${tags['addr:housenumber']}` : street;
    return {
      firma: tags.name || tags.brand || 'Unbekannt',
      strasse_hausnummer: streetNum,
      postleitzahl: tags['addr:postcode'] || '',
      stadt: city,
      telefon: tags['contact:phone'] || tags.phone || '',
      email: tags['contact:email'] || tags.email || '',
      branche: tags.shop || tags.office || tags.amenity || '',
      webseite: tags['contact:website'] || tags.website || '',
      latitude: lat,
      longitude: lon,
      source_address: `${street}, ${city}`,
    };
  });
  return companies.filter(Boolean);
}

function dedupeCompanies(list) {
  const seen = new Set();
  const clean = [];
  list.forEach((c) => {
    const key = `${(c.firma || '').toLowerCase()}|${(c.strasse_hausnummer || '').toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      clean.push(c);
    }
  });
  return clean;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function Unternehmenssuche() {
  const [activeSection, setActiveSection] = useState('map');
  const [addressInput, setAddressInput] = useState('');
  const [cityInput, setCityInput] = useState('Berlin');
  const [foundCompanies, setFoundCompanies] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAreaGenerating, setIsAreaGenerating] = useState(false);
  const [assignEmployee, setAssignEmployee] = useState('');
  const [user, setUser] = useState(null);

  const [mapCenter, setMapCenter] = useState([52.52, 13.405]);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapInstance, setMapInstance] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [selectedBounds, setSelectedBounds] = useState(null);
  const [streetNames, setStreetNames] = useState([]);
  const [streetNumbers, setStreetNumbers] = useState({});
  const [isFetchingStreets, setIsFetchingStreets] = useState(false);
  const [areaError, setAreaError] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: allLeads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ['allLeads'],
    queryFn: async () => {
      const leads = await base44.entities.Lead.list();
      return leads;
    },
  });

  const leadsWithCoordinates = useMemo(() => {
    return allLeads.filter((lead) => {
      const lat = parseFloat(lead.latitude);
      const lng = parseFloat(lead.longitude);
      return !isNaN(lat) && !isNaN(lng);
    });
  }, [allLeads]);

  const foundWithCoordinates = useMemo(() => {
    return foundCompanies.filter((c) => !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude)));
  }, [foundCompanies]);

  const geocodeCity = async () => {
    if (!cityInput.trim()) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityInput)}`
      );
      const data = await res.json();
      if (data?.length) {
        const { lat, lon } = data[0];
        const newCenter = [parseFloat(lat), parseFloat(lon)];
        setMapCenter(newCenter);
        setMapZoom(13);
        if (mapInstance) {
          mapInstance.setView(newCenter, 13);
        }
      } else {
        alert('Keine Ergebnisse für diese Stadt gefunden');
      }
    } catch (err) {
      alert('Stadt-Suche fehlgeschlagen');
    } finally {
      setIsGeocoding(false);
    }
  };

  const fetchStreetsInArea = async (bounds) => {
    if (!bounds) return;
    setIsFetchingStreets(true);
    setAreaError('');
    try {
      const southWest = bounds.getSouthWest();
      const northEast = bounds.getNorthEast();
      const bbox = `${southWest.lat},${southWest.lng},${northEast.lat},${northEast.lng}`;

      const streetQuery = `
        [out:json][timeout:25];
        (
          way["highway"]["name"](${bbox});
        );
        out tags;
      `;
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: streetQuery,
      });
      if (!res.ok) throw new Error('Overpass Straßenabfrage fehlgeschlagen');
      const data = await res.json();
      const names = Array.from(
        new Set(
          (data.elements || [])
            .map((el) => el.tags?.name)
            .filter(Boolean)
            .map((n) => n.trim())
        )
      ).sort();
      setStreetNames(names);

      const houseQuery = `
        [out:json][timeout:25];
        (
          node["addr:housenumber"]["addr:street"](${bbox});
          way["addr:housenumber"]["addr:street"](${bbox});
        );
        out tags;
      `;
      const houseRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: houseQuery,
      });
      if (houseRes.ok) {
        const houseData = await houseRes.json();
        const byStreet = {};
        (houseData.elements || []).forEach((el) => {
          const tags = el.tags || {};
          if (tags['addr:street'] && tags['addr:housenumber']) {
            const s = tags['addr:street'];
            const num = tags['addr:housenumber'];
            byStreet[s] = byStreet[s] || new Set();
            byStreet[s].add(num);
          }
        });
        const asArrays = Object.fromEntries(
          Object.entries(byStreet).map(([k, v]) => [k, Array.from(v).sort()])
        );
        setStreetNumbers(asArrays);
      } else {
        setStreetNumbers({});
      }
    } catch (err) {
      setAreaError(err.message || 'Fehler beim Laden der Straßen');
    } finally {
      setIsFetchingStreets(false);
    }
  };

  const scrapeStreet = async (street, city) => {
    // Try Supabase edge function first; fall back to Overpass when unavailable
    try {
      if (!base44?.integrations?.Core?.InvokeLLM) {
        throw new Error('LLM-Integration nicht verfügbar');
      }
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Suche auf "das oertliche" und ähnlichen Quellen ALLE Unternehmen in der Straße ${street}, ${city}. Gib JSON mit firma, strasse_hausnummer, postleitzahl, stadt, telefon, email, branche, webseite, latitude, longitude.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            companies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  firma: { type: 'string' },
                  strasse_hausnummer: { type: 'string' },
                  postleitzahl: { type: 'string' },
                  stadt: { type: 'string' },
                  telefon: { type: 'string' },
                  email: { type: 'string' },
                  branche: { type: 'string' },
                  webseite: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                },
              },
            },
          },
        },
      });
      if (result?.companies?.length) return result.companies;
    } catch (err) {
      console.warn('Edge LLM fehlgeschlagen, nutze Overpass', err?.message || err);
    }
    return await fetchPOIsFromOverpass(street, city);
  };

  const searchCompaniesInCity = async () => {
    if (!addressInput.trim()) {
      alert('Bitte geben Sie eine Adresse oder Straße ein');
      return;
    }
    setIsSearching(true);
    try {
      const companies = await scrapeStreet(addressInput.trim(), cityInput.trim());
      const filtered = (companies || []).filter((c) => c.telefon || c.email || c.latitude);
      const withMeta = filtered.map((c) => ({
        ...c,
        stadt: c.stadt || cityInput,
        source_address: `${addressInput}, ${cityInput}`,
        id: `${Date.now()}-${Math.random()}`,
      }));
      const deduped = dedupeCompanies([...foundCompanies, ...withMeta]);
      setFoundCompanies(deduped);
      if (!withMeta.length) {
        alert(`Keine Unternehmen an "${addressInput}, ${cityInput}" gefunden.`);
      }
    } catch (error) {
      console.error('Suche fehlgeschlagen:', error);
      alert('Fehler bei der Suche: ' + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const runGeneratorForArea = async () => {
    if (!streetNames.length) {
      alert('Keine Straßen im gewählten Bereich gefunden');
      return;
    }
    setIsAreaGenerating(true);
    try {
      let aggregated = [...foundCompanies];
      for (const street of streetNames) {
        const companies = await scrapeStreet(street, cityInput.trim());
        const filtered = (companies || []).filter((c) => c.telefon || c.email || c.latitude);
        const withMeta = filtered.map((c) => ({
          ...c,
          stadt: c.stadt || cityInput,
          strasse_hausnummer: c.strasse_hausnummer || street,
          source_address: `${street}, ${cityInput}`,
          id: `${Date.now()}-${Math.random()}`,
        }));
        aggregated = dedupeCompanies([...aggregated, ...withMeta]);
      }
      setFoundCompanies(aggregated);
      alert(`${aggregated.length} Unternehmen gesammelt (alle Straßen im Bereich).`);
    } catch (err) {
      alert('Fehler beim Sammeln der Leads aus dem Bereich: ' + err.message);
    } finally {
      setIsAreaGenerating(false);
    }
  };

  const addCompaniesToLeads = async () => {
    if (foundCompanies.length === 0) {
      alert('Keine Unternehmen zum Hinzufügen vorhanden');
      return;
    }
    if (!assignEmployee) {
      alert('Bitte wählen Sie einen Mitarbeiter aus');
      return;
    }
    const employee = employees.find((e) => e.full_name === assignEmployee);
    const leadsToCreate = foundCompanies.map((company) => ({
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
      longitude: company.longitude?.toString() || '',
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
    setFoundCompanies((prev) => prev.filter((c) => c.id !== companyId));
  };

  const clearAllCompanies = () => setFoundCompanies([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Unternehmensuche</h1>
          <p className="text-slate-500 mt-1">
            Karte, Leads & Lead-Generator mit Bereichsauswahl (Straßen & Hausnummern)
          </p>
        </div>
      </div>

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
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Karte - Stadt wählen & Bereich markieren
                </CardTitle>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      placeholder="Stadt"
                      className="w-40"
                    />
                    <Button variant="outline" size="sm" onClick={geocodeCity} disabled={isGeocoding}>
                      {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      <span className="ml-1">Stadt suchen</span>
                    </Button>
                  </div>
                  <Button
                    variant={isDrawing ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setIsDrawing(!isDrawing);
                      setDrawStart(null);
                    }}
                    className={isDrawing ? 'bg-amber-500 hover:bg-amber-600' : ''}
                  >
                    <Crosshair className="h-4 w-4 mr-1" />
                    Bereich wählen
                  </Button>
                  {selectedBounds && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBounds(null);
                        setStreetNames([]);
                        setStreetNumbers({});
                      }}
                    >
                      Auswahl zurücksetzen
                    </Button>
                  )}
                  {selectedBounds && (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => fetchStreetsInArea(selectedBounds)}
                      disabled={isFetchingStreets}
                    >
                      {isFetchingStreets ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      <span className="ml-1">Straßen laden</span>
                    </Button>
                  )}
                </div>
              </div>
              {selectedBounds && (
                <p className="text-sm text-slate-500 mt-2">
                  Bereich gesetzt. Klicken Sie erneut in zwei Ecken, um einen neuen Bereich zu setzen.
                </p>
              )}
            </CardHeader>
            <CardContent>
                <div className="h-[600px] w-full rounded-lg overflow-hidden border-2 border-slate-200">
                  <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                    whenCreated={setMapInstance}
                  >
                    <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

                    <AreaSelector

                    isDrawing={isDrawing}
                    drawStart={drawStart}
                    setDrawStart={setDrawStart}
                    onComplete={(b) => {
                      setSelectedBounds(b);
                      setIsDrawing(false);
                      setStreetNames([]);
                      setStreetNumbers({});
                    }}
                  />

                  {selectedBounds && (
                    <Rectangle
                      bounds={selectedBounds}
                      pathOptions={{ color: '#f97316', weight: 2, fillOpacity: 0.05 }}
                    />
                  )}

                  {leadsWithCoordinates.map((lead) => {
                    const lat = parseFloat(lead.latitude);
                    const lng = parseFloat(lead.longitude);
                    const statusColor = statusColors[lead.status] || statusColors['Neu'];
                    return (
                      <Marker key={lead.id} position={[lat, lng]} icon={createCustomIcon(statusColor)}>
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

                  {foundWithCoordinates.map((company) => {
                    const lat = parseFloat(company.latitude);
                    const lng = parseFloat(company.longitude);
                    return (
                      <Marker key={company.id} position={[lat, lng]} icon={createCustomIcon(statusColors.Kontaktiert)}>
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-slate-900">{company.firma || 'Unbekannt'}</h3>
                            <p className="text-sm text-slate-600 mt-1">
                              {company.strasse_hausnummer}
                              {company.postleitzahl && `, ${company.postleitzahl}`}
                              {company.stadt && ` ${company.stadt}`}
                            </p>
                            {company.telefon && (
                              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" /> {company.telefon}
                              </p>
                            )}
                            {company.email && (
                              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                <Mail className="h-3 w-3" /> {company.email}
                              </p>
                            )}
                            <Badge className="mt-2" variant="outline">
                              Neuer Fund
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
                      <div
                        style={{ backgroundColor: color }}
                        className="w-4 h-4 rounded-full border-2 border-white shadow"
                      />
                      <span className="text-slate-700">{status}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white shadow" style={{ backgroundColor: statusColors.Kontaktiert }} />
                    <span className="text-slate-700">Neu gefundene (Generator)</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">Straßen im Bereich</h4>
                  {selectedBounds ? (
                    isFetchingStreets ? (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" /> Lädt Straßen...
                      </div>
                    ) : streetNames.length ? (
                      <div className="text-sm space-y-2 max-h-56 overflow-y-auto">
                        {streetNames.map((s) => (
                          <div key={s} className="flex justify-between items-center border-b pb-1">
                            <span>{s}</span>
                            {streetNumbers[s]?.length ? (
                              <span className="text-xs text-slate-500">HN: {streetNumbers[s].slice(0, 8).join(', ')}{streetNumbers[s].length > 8 ? '…' : ''}</span>
                            ) : (
                              <span className="text-xs text-slate-400">keine HNr gefunden</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Noch keine Straßen geladen.</p>
                    )
                  ) : (
                    <p className="text-sm text-slate-500">Wählen Sie einen Bereich auf der Karte.</p>
                  )}
                  {areaError && <p className="text-sm text-red-600 mt-2">{areaError}</p>}
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-slate-900">Schnellaktionen</h4>
                  <p className="text-sm text-slate-600">
                    1) Stadt suchen, 2) Bereich klicken (2 Ecken), 3) Straßen laden, 4) Generator für Bereich starten.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      className="bg-amber-600 hover:bg-amber-700"
                      disabled={!streetNames.length || isAreaGenerating}
                      onClick={runGeneratorForArea}
                    >
                      {isAreaGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4 mr-2" />
                      )}
                      Alle Straßen im Bereich abarbeiten
                    </Button>
                    <p className="text-xs text-slate-500">
                      Gefundene Unternehmen erscheinen unten im Lead Generator und können dann als Leads angelegt werden.
                    </p>
                  </div>
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
              {selectedBounds && (
                <p className="text-sm text-slate-500 mt-1">
                  Aktive Stadt: {cityInput} · Straßen im Bereich: {streetNames.length}
                </p>
              )}
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
                              <p>
                                {lead.strasse_hausnummer}, {lead.postleitzahl} {lead.stadt}
                              </p>
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
              <p className="text-sm text-slate-500">
                Stadt: {cityInput || '-'} {selectedBounds ? `· Straßen im Bereich: ${streetNames.length}` : ''}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
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

                {selectedBounds && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-amber-900">Aktiver Bereich</h4>
                        <p className="text-sm text-amber-800">
                          Straßen: {streetNames.length || 0} | Hausnummern erfasst: {Object.keys(streetNumbers).length}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        disabled={!streetNames.length || isAreaGenerating}
                        onClick={runGeneratorForArea}
                      >
                        {isAreaGenerating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4 mr-2" />
                        )}
                        Alle Straßen jetzt scrapen
                      </Button>
                    </div>
                  </div>
                )}

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
                                  <p>
                                    {company.strasse_hausnummer}, {company.postleitzahl} {company.stadt}
                                  </p>
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
                                {company.latitude && company.longitude && (
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
                    <p className="text-sm">Geben Sie eine Adresse ein oder nutzen Sie den Bereich auf der Karte</p>
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
