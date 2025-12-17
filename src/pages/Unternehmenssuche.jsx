import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  Zap,
  Save,
  X,
} from 'lucide-react';
import { fetchStreetLeads } from '@/lib/scraping/das-oertliche-scraper';

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

function DrawingHandler({ isDrawing, onDrawComplete }) {
  const [startPoint, setStartPoint] = useState(null);
  const [rect, setRect] = useState(null);
  const mapRef = useMap();

  useMapEvents({
    mousedown(e) {
      if (!isDrawing) return;
      setStartPoint(e.latlng);
      if (rect) {
        mapRef.removeLayer(rect);
      }
      mapRef.dragging.disable();
    },
    mousemove(e) {
      if (!isDrawing || !startPoint) return;
      if (rect) {
        mapRef.removeLayer(rect);
      }
      const bounds = L.latLngBounds(startPoint, e.latlng);
      const newRect = L.rectangle(bounds, {
        color: '#9333ea',
        weight: 2,
        fillOpacity: 0.1,
        dashArray: '5, 5',
      }).addTo(mapRef);
      setRect(newRect);
    },
    mouseup(e) {
      if (!isDrawing || !startPoint) return;
      mapRef.dragging.enable();
      
      const bounds = L.latLngBounds(startPoint, e.latlng);
      const size = Math.abs(bounds.getNorth() - bounds.getSouth()) + Math.abs(bounds.getEast() - bounds.getWest());
      
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

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function Unternehmenssuche() {
  const [activeSection, setActiveSection] = useState('map');
  const [user, setUser] = useState(null);
  
  const [mapCenter, setMapCenter] = useState([52.52, 13.405]);
  const [mapZoom, setMapZoom] = useState(12);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedAreas, setSavedAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaBounds, setNewAreaBounds] = useState(null);
  const [cityInput, setCityInput] = useState('Berlin');
  
  const [generatingArea, setGeneratingArea] = useState(null);
  const [generationProgress, setGenerationProgress] = useState({});
  const [foundCompanies, setFoundCompanies] = useState([]);
  const [assignEmployee, setAssignEmployee] = useState('');
  
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadAreas();
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
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

  const selectedArea = useMemo(() => {
    return savedAreas.find((a) => a.id === selectedAreaId);
  }, [savedAreas, selectedAreaId]);

  async function loadAreas() {
    try {
      const areas = await base44.sql(`SELECT * FROM areas ORDER BY created_at DESC`);
      setSavedAreas(areas || []);
    } catch (err) {
      console.error('Failed to load areas:', err);
    }
  }

  async function saveArea() {
    if (!newAreaName.trim() || !newAreaBounds) return;
    
    try {
      const streetsResult = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `
          [out:json][timeout:25];
          way["highway"]["name"](${newAreaBounds.south},${newAreaBounds.west},${newAreaBounds.north},${newAreaBounds.east});
          out tags;
        `,
      });
      
      const data = await streetsResult.json();
      const streetNames = Array.from(
        new Set(
          (data.elements || [])
            .map((el) => el.tags?.name)
            .filter(Boolean)
        )
      ).map((name) => ({ name }));

      const areaData = {
        name: newAreaName.trim(),
        city: cityInput.trim(),
        bounds: JSON.stringify(newAreaBounds),
        streets: JSON.stringify(streetNames),
        color: '#3b82f6',
      };

      await base44.sql(
        `INSERT INTO areas (name, city, bounds, streets, color) 
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
        [areaData.name, areaData.city, areaData.bounds, areaData.streets, areaData.color]
      );

      await loadAreas();
      setShowAreaDialog(false);
      setNewAreaName('');
      setNewAreaBounds(null);
      alert(`Bereich "${areaData.name}" mit ${streetNames.length} Straßen gespeichert!`);
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message);
    }
  }

  async function handleDrawComplete(bounds) {
    setIsDrawing(false);
    setNewAreaBounds(bounds);
    setShowAreaDialog(true);
  }

  function handleAreaSelect(areaId) {
    setSelectedAreaId(areaId);
    const area = savedAreas.find((a) => a.id === areaId);
    if (area && area.bounds) {
      const bounds = typeof area.bounds === 'string' ? JSON.parse(area.bounds) : area.bounds;
      const center = [(bounds.north + bounds.south) / 2, (bounds.east + bounds.west) / 2];
      setMapCenter(center);
      setMapZoom(14);
    }
  }

  function navigateToGenerator() {
    if (selectedArea) {
      setActiveSection('generator');
    }
  }

  function navigateToMap() {
    setActiveSection('map');
  }

  async function generateLeadsForArea() {
    if (!selectedArea) return;
    
    const streets = typeof selectedArea.streets === 'string' 
      ? JSON.parse(selectedArea.streets) 
      : selectedArea.streets || [];
    
    if (streets.length === 0) {
      alert('Keine Straßen in diesem Bereich gefunden');
      return;
    }

    setGeneratingArea(selectedArea.id);
    setGenerationProgress({});
    
    let allLeads = [];
    
    for (let i = 0; i < streets.length; i++) {
      const street = streets[i];
      const streetName = street.name || street;
      
      setGenerationProgress({
        current: i + 1,
        total: streets.length,
        street: streetName,
      });

      try {
        const leads = await fetchStreetLeads(streetName, selectedArea.city || cityInput, {
          maxPages: 5,
        });
        
        const withMeta = leads.map((lead) => ({
          ...lead,
          id: `${Date.now()}-${Math.random()}`,
          area_id: selectedArea.id,
          source_address: `${streetName}, ${selectedArea.city || cityInput}`,
        }));
        
        allLeads = [...allLeads, ...withMeta];
        
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (err) {
        console.error(`Error scraping ${streetName}:`, err);
      }
    }

    setFoundCompanies([...foundCompanies, ...allLeads]);
    setGeneratingArea(null);
    setGenerationProgress({});
    setActiveSection('generator');
    alert(`${allLeads.length} Unternehmen gefunden!`);
  }

  async function geocodeCity() {
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
      } else {
        alert('Keine Ergebnisse für diese Stadt gefunden');
      }
    } catch (err) {
      alert('Stadt-Suche fehlgeschlagen');
    } finally {
      setIsGeocoding(false);
    }
  }

  async function addCompaniesToLeads() {
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
    
    const employee = employees.find((e) => e.full_name === assignEmployee);
    const leadsToCreate = foundCompanies.map((company) => ({
      firma: company.firma || '',
      strasse_hausnummer: company.strasse_hausnummer || '',
      postleitzahl: company.postleitzahl || '',
      stadt: company.stadt || cityInput,
      telefon: company.telefon || '',
      email: company.email || '',
      infobox: `Branche: ${company.branche || '-'}\nWebseite: ${company.webseite || '-'}\nGefunden über: ${company.source_address || 'Unternehmensuche'}`,
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
      alert(`${leadsToCreate.length} Leads erfolgreich erstellt und ${employee?.full_name} zugewiesen!`);
    } catch (error) {
      alert('Fehler beim Erstellen: ' + error.message);
    }
  }

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
            Bereiche definieren, Straßen extrahieren, Leads generieren
          </p>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-3 bg-slate-100">
          <TabsTrigger value="map" className="flex items-center gap-2">
            <MapIcon className="h-4 w-4" />
            Karte & Bereiche
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

        <TabsContent value="map" className="mt-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Karte - Bereiche zeichnen & verwalten
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
                    </Button>
                  </div>
                  <Button
                    variant={isDrawing ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsDrawing(!isDrawing)}
                    className={isDrawing ? 'bg-purple-500 hover:bg-purple-600' : ''}
                  >
                    <Crosshair className="h-4 w-4 mr-1" />
                    {isDrawing ? 'Zeichnen...' : 'Bereich zeichnen'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1 space-y-3">
                  <h3 className="font-semibold text-slate-900">Gespeicherte Bereiche</h3>
                  {savedAreas.length === 0 ? (
                    <p className="text-sm text-slate-500">Noch keine Bereiche gespeichert</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {savedAreas.map((area) => {
                        const streets = typeof area.streets === 'string' ? JSON.parse(area.streets) : area.streets || [];
                        const isSelected = area.id === selectedAreaId;
                        return (
                          <div
                            key={area.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                            onClick={() => handleAreaSelect(area.id)}
                          >
                            <h4 className="font-semibold text-slate-900">{area.name}</h4>
                            <p className="text-xs text-slate-600 mt-1">
                              Stadt: {area.city} · {streets.length} Straßen
                            </p>
                            {isSelected && (
                              <Button
                                size="sm"
                                className="w-full mt-2 bg-amber-600 hover:bg-amber-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToGenerator();
                                }}
                              >
                                <Zap className="h-4 w-4 mr-1" />
                                Leads generieren
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3">
                  <div className="h-[600px] w-full rounded-lg overflow-hidden border-2 border-slate-200">
                    <MapContainer
                      center={mapCenter}
                      zoom={mapZoom}
                      style={{ height: '100%', width: '100%' }}
                      className="z-0"
                    >
                      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
                      <MapController center={mapCenter} zoom={mapZoom} />
                      
                      {isDrawing && (
                        <DrawingHandler
                          isDrawing={isDrawing}
                          onDrawComplete={handleDrawComplete}
                        />
                      )}

                      {savedAreas.map((area) => {
                        const bounds = typeof area.bounds === 'string' ? JSON.parse(area.bounds) : area.bounds;
                        const isSelected = area.id === selectedAreaId;
                        return (
                          <Rectangle
                            key={area.id}
                            bounds={[
                              [bounds.south, bounds.west],
                              [bounds.north, bounds.east],
                            ]}
                            pathOptions={{
                              color: isSelected ? '#3b82f6' : area.color || '#3b82f6',
                              weight: isSelected ? 3 : 2,
                              fillOpacity: isSelected ? 0.2 : 0.1,
                            }}
                            eventHandlers={{
                              click: () => handleAreaSelect(area.id),
                            }}
                          >
                            <Popup>
                              <div className="p-2">
                                <h3 className="font-bold">{area.name}</h3>
                                <p className="text-sm">{area.city}</p>
                              </div>
                            </Popup>
                          </Rectangle>
                        );
                      })}

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
                                </p>
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
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-green-600" />
                  Gefundene Leads ({leadsWithCoordinates.length})
                </CardTitle>
                {selectedArea && (
                  <Button variant="outline" size="sm" onClick={navigateToMap}>
                    <MapIcon className="h-4 w-4 mr-1" />
                    Zurück zur Karte
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {leadsWithCoordinates.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>Keine Leads mit Koordinaten vorhanden</p>
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

        <TabsContent value="generator" className="mt-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-amber-600" />
                    Lead Generator
                  </CardTitle>
                  {selectedArea && (
                    <p className="text-sm text-slate-500 mt-1">
                      Aktiver Bereich: {selectedArea.name} ({selectedArea.city})
                    </p>
                  )}
                </div>
                {selectedArea && (
                  <Button variant="outline" size="sm" onClick={navigateToMap}>
                    <MapIcon className="h-4 w-4 mr-1" />
                    Zurück zur Karte
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {selectedArea && (
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-4">Bereichsanalyse</h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Bereich:</span> {selectedArea.name}
                      </p>
                      <p>
                        <span className="font-medium">Stadt:</span> {selectedArea.city}
                      </p>
                      <p>
                        <span className="font-medium">Straßen:</span>{' '}
                        {typeof selectedArea.streets === 'string'
                          ? JSON.parse(selectedArea.streets).length
                          : selectedArea.streets?.length || 0}
                      </p>
                    </div>
                    <Button
                      onClick={generateLeadsForArea}
                      disabled={generatingArea === selectedArea.id}
                      className="w-full mt-4 bg-amber-600 hover:bg-amber-700"
                    >
                      {generatingArea === selectedArea.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {generationProgress.street && (
                            <span>
                              {generationProgress.current}/{generationProgress.total}: {generationProgress.street}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Alle Straßen scrapen
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {!selectedArea && (
                  <div className="text-center py-12 text-slate-500">
                    <MapPin className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>Kein Bereich ausgewählt</p>
                    <p className="text-sm mt-2">
                      Gehen Sie zur Karte und wählen Sie einen Bereich aus
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveSection('map')}
                    >
                      Zur Karte
                    </Button>
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
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {company.branche}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAreaDialog} onOpenChange={setShowAreaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bereich speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bereichsname *</Label>
              <Input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="z.B. Berlin Mitte"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Stadt *</Label>
              <Input
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Berlin"
                className="mt-1"
              />
            </div>
            <p className="text-sm text-slate-500">
              Die Straßennamen werden automatisch aus dem gewählten Bereich extrahiert.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAreaDialog(false)}>
              <X className="h-4 w-4 mr-1" />
              Abbrechen
            </Button>
            <Button onClick={saveArea} disabled={!newAreaName.trim()}>
              <Save className="h-4 w-4 mr-1" />
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
