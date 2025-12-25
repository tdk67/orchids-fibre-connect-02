import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
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
  Clock,
  FileText,
} from 'lucide-react';
import { fetchStreetLeads, geocodeAddress } from '@/lib/scraping/das-oertliche-scraper';

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
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4); pointer-events: auto;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
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
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('map');
  const [user, setUser] = useState(null);
  
  const [mapCenter, setMapCenter] = useState([52.52, 13.405]);
  const [mapZoom, setMapZoom] = useState(12);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedAreas, setSavedAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [filterCity, setFilterCity] = useState('Berlin');
  const [filterAreaId, setFilterAreaId] = useState('all');

  const selectedArea = useMemo(() => {
    return savedAreas.find((a) => a.id === selectedAreaId || a.id === filterAreaId);
  }, [savedAreas, selectedAreaId, filterAreaId]);

  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaBounds, setNewAreaBounds] = useState(null);
  const [cityInput, setCityInput] = useState('Berlin');
  const [genAreaId, setGenAreaId] = useState('all');
  
  const [generatingArea, setGeneratingArea] = useState(null);
  const [generationProgress, setGenerationProgress] = useState({});
  const [foundCompanies, setFoundCompanies] = useState([]);
  const [assignEmployee, setAssignEmployee] = useState('');
  
  const queryClient = useQueryClient();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const city = params.get('city');
    const areaId = params.get('areaId');
    if (city) {
      setCityInput(city);
      setFilterCity(city);
    }
    if (areaId) {
      setFilterAreaId(areaId);
      setGenAreaId(areaId);
      setSelectedAreaId(areaId);
    }
  }, [location.search]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadAreas();
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

  const getAreaLeadMatch = (lead, area) => {
    if (!lead || !area) return false;
    if (lead.area_id === area.id) return true;
    
    const leadCity = lead.stadt?.toLowerCase();
    const areaCity = area.city?.toLowerCase();
    if (leadCity !== areaCity) return false;

    const streetName = lead.strasse_hausnummer?.split(/\s\d/)[0]?.trim()?.toLowerCase();
    if (!streetName) return false;

    const areaStreets = typeof area.streets === 'string' ? JSON.parse(area.streets) : area.streets || [];
    return areaStreets.some(s => {
      const aStreetName = (typeof s === 'string' ? s : s.name)?.toLowerCase();
      return aStreetName && (streetName.includes(aStreetName) || aStreetName.includes(streetName));
    });
  };

  const filteredLeads = useMemo(() => {
    if (!filterCity && filterAreaId === 'all') return [];

    return allLeads.filter((lead) => {
      const cityMatch = !filterCity || lead.stadt?.toLowerCase() === filterCity.toLowerCase();
      
      let areaMatch = true;
      if (filterAreaId !== 'all') {
        const area = savedAreas.find(a => a.id === filterAreaId);
        areaMatch = getAreaLeadMatch(lead, area);
      }
      
      return cityMatch && areaMatch;
    });
  }, [allLeads, filterCity, filterAreaId, savedAreas]);

  const selectedAreaLeads = useMemo(() => {
    const areaToUse = savedAreas.find(a => a.id === (genAreaId !== 'all' ? genAreaId : selectedAreaId));
    if (!areaToUse) return [];

    return allLeads.filter(lead => getAreaLeadMatch(lead, areaToUse));
  }, [allLeads, savedAreas, genAreaId, selectedAreaId]);

  const leadsWithCoordinates = useMemo(() => {
    return filteredLeads.filter((lead) => lead.latitude && lead.longitude);
  }, [filteredLeads]);

  const foundWithCoordinates = useMemo(() => {
    return foundCompanies.filter((company) => company.latitude && company.longitude);
  }, [foundCompanies]);


  async function loadAreas() {
    try {
      const { data: areas, error } = await base44.client
        .from('areas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
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

      const { error: insertError } = await base44.client
        .from('areas')
        .insert({
          name: areaData.name,
          city: areaData.city,
          bounds: newAreaBounds,
          streets: streetNames,
          color: areaData.color,
        });
      
      if (insertError) throw insertError;

        await loadAreas();
        setShowAreaDialog(false);
        setNewAreaName('');
        setNewAreaBounds(null);
        toast({
          title: "Bereich gespeichert",
          description: `Bereich "${areaData.name}" mit ${streetNames.length} Straßen gespeichert!`,
        });
      } catch (err) {
        toast({
          title: "Fehler",
          description: 'Fehler beim Speichern: ' + err.message,
          variant: "destructive",
        });
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
      setMapZoom(16);
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
        toast({
          title: "Warnung",
          description: 'Keine Straßen in diesem Bereich gefunden',
          variant: "destructive",
        });
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
          
          // Geocode each lead to get coordinates
          const withCoordinates = await Promise.all(
            leads.map(async (lead) => {
              // Double check if lead is already in database
              const isDuplicate = allLeads.some(existing => 
                existing.firma?.toLowerCase() === lead.firma?.toLowerCase() &&
                (existing.strasse_hausnummer?.toLowerCase() === lead.strasse_hausnummer?.toLowerCase() || 
                 existing.telefon === lead.telefon)
              );

              if (isDuplicate) return null;

              // Also check if already in foundCompanies (local state)
              const isAlreadyFound = foundCompanies.some(found => 
                found.firma?.toLowerCase() === lead.firma?.toLowerCase() &&
                (found.strasse_hausnummer?.toLowerCase() === lead.strasse_hausnummer?.toLowerCase() || 
                 found.telefon === lead.telefon)
              );

              if (isAlreadyFound) return null;

              const coords = await geocodeAddress(
                lead.street_name || streetName,
                lead.street_number || '',
                selectedArea.city || cityInput
              );
              
              return {
                ...lead,
                id: `${Date.now()}-${Math.random()}`,
                area_id: selectedArea.id,
                source_address: `${streetName}, ${selectedArea.city || cityInput}`,
                latitude: coords?.lat?.toString() || '',
                longitude: coords?.lon?.toString() || '',
              };
            })
          );
          
          const filteredNewLeads = withCoordinates.filter(Boolean);
          allLeads = [...allLeads, ...filteredNewLeads];
          
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (err) {
          console.error(`Error scraping ${streetName}:`, err);
        }
    }

      setFoundCompanies([...foundCompanies, ...allLeads]);
      setGeneratingArea(null);
      setGenerationProgress({});
      setActiveSection('generator');
      toast({
        title: "Erfolgreich",
        description: `${allLeads.length} Unternehmen gefunden!`,
      });
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
          toast({
            title: "Nicht gefunden",
            description: 'Keine Ergebnisse für diese Stadt gefunden',
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Fehler",
          description: 'Stadt-Suche fehlgeschlagen',
          variant: "destructive",
        });
      } finally {
        setIsGeocoding(false);
      }
    }

    async function addCompaniesToLeads() {
      if (foundCompanies.length === 0) {
        toast({
          title: "Warnung",
          description: 'Keine Unternehmen zum Hinzufügen vorhanden',
          variant: "destructive",
        });
        return;
      }
      if (!assignEmployee) {
        toast({
          title: "Warnung",
          description: 'Bitte wählen Sie einen Mitarbeiter aus',
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
      area_id: company.area_id || selectedArea?.id,
    }));
    
    try {
        await base44.entities.Lead.bulkCreate(leadsToCreate);
        queryClient.invalidateQueries(['leads']);
        queryClient.invalidateQueries(['allLeads']);
        setFoundCompanies([]);
        toast({
          title: "Erfolgreich",
          description: `${leadsToCreate.length} Leads erstellt und ${employee?.full_name} zugewiesen!`,
        });
      } catch (error) {
        toast({
          title: "Fehler",
          description: 'Fehler beim Erstellen: ' + error.message,
          variant: "destructive",
        });
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
            Leads ({filteredLeads.length})
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Lead Generator
          </TabsTrigger>
        </TabsList>

          <TabsContent value="map" className="mt-6">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Karte
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={cityInput}
                            onChange={(e) => setCityInput(e.target.value)}
                            placeholder="Stadt suchen..."
                            className="w-48 bg-white text-slate-900"
                            onKeyDown={(e) => e.key === 'Enter' && geocodeCity()}
                          />
                          <Button variant="secondary" size="sm" onClick={geocodeCity} disabled={isGeocoding}>
                            {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button
                          variant={isDrawing ? 'default' : 'secondary'}
                          size="sm"
                          onClick={() => setIsDrawing(!isDrawing)}
                          className={isDrawing ? 'bg-purple-600 hover:bg-purple-700' : ''}
                        >
                          <Crosshair className="h-4 w-4 mr-1" />
                          {isDrawing ? 'Zeichnen aktiv...' : 'Bereich zeichnen'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[calc(100vh-220px)] w-full">
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
                                color: isSelected ? '#2563eb' : '#94a3b8',
                                weight: isSelected ? 3 : 2,
                                fillOpacity: isSelected ? 0.15 : 0.08,
                              }}
                              eventHandlers={{
                                click: () => handleAreaSelect(area.id),
                              }}
                            >
                              <Popup>
                                <div className="p-2">
                                  <h3 className="font-bold text-slate-900">{area.name}</h3>
                                  <p className="text-sm text-slate-600">{area.city}</p>
                                </div>
                              </Popup>
                            </Rectangle>
                          );
                        })}

                          {leadsWithCoordinates.map((lead) => {
                            const lat = parseFloat(lead.latitude);
                            const lng = parseFloat(lead.longitude);
                            return (
                              <Marker key={lead.id} position={[lat, lng]} icon={createCustomIcon('#3b82f6')}>
                                <Popup>
                                  <div className="p-3">
                                    <h3 className="font-bold text-slate-900 mb-2">{lead.firma || 'Unbekannt'}</h3>
                                    {lead.ansprechpartner && (
                                      <p className="text-sm text-slate-700 font-medium">
                                        {lead.ansprechpartner}
                                      </p>
                                    )}
                                    <p className="text-sm text-slate-600 mt-1">
                                      {lead.strasse_hausnummer}
                                      {lead.postleitzahl && `, ${lead.postleitzahl}`}
                                      {lead.stadt && ` ${lead.stadt}`}
                                    </p>
                                    {lead.telefon && (
                                      <p className="text-sm text-blue-600 flex items-center gap-1 mt-2">
                                        <Phone className="h-3 w-3" /> {lead.telefon}
                                      </p>
                                    )}
                                    {lead.email && (
                                      <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
                                        <Mail className="h-3 w-3" /> {lead.email}
                                      </p>
                                    )}
                                    {lead.status && (
                                      <Badge className="mt-2 bg-blue-100 text-blue-800">
                                        {lead.status}
                                      </Badge>
                                    )}
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          })}

                          {foundWithCoordinates.map((company) => {
                            const lat = parseFloat(company.latitude);
                            const lng = parseFloat(company.longitude);
                            return (
                              <Marker key={company.id} position={[lat, lng]} icon={createCustomIcon('#3b82f6')}>
                                <Popup>
                                  <div className="p-2">
                                    <h3 className="font-bold text-slate-900">{company.firma || 'Unbekannt'}</h3>
                                    <p className="text-sm text-slate-600 mt-1">
                                      {company.strasse_hausnummer}
                                    </p>
                                    <Badge className="mt-2 bg-blue-100 text-blue-800">
                                      Gefunden (nicht gespeichert)
                                    </Badge>
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          })}
                      </MapContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="xl:col-span-1">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapIcon className="h-4 w-4" />
                      Bereiche
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {savedAreas.length === 0 ? (
                      <div className="text-center py-8">
                        <MapPin className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">Keine Bereiche</p>
                        <p className="text-xs text-slate-400 mt-1">Zeichnen Sie einen Bereich auf der Karte</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                          {savedAreas.map((area) => {
                            const streets = typeof area.streets === 'string' ? JSON.parse(area.streets) : area.streets || [];
                            const isSelected = area.id === selectedAreaId;
                            const areaLeads = allLeads.filter(lead => getAreaLeadMatch(lead, area));
                            return (
                              <div
                                key={area.id}
                                className={`group p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 shadow-md'
                                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                              }`}
                              onClick={() => handleAreaSelect(area.id)}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-semibold text-slate-900 text-sm">{area.name}</h4>
                                {isSelected && (
                                  <Badge className="bg-blue-600 text-white text-xs">Aktiv</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mb-2">
                                <span className="font-medium">{area.city}</span>
                              </p>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <MapPin className="h-3 w-3" />
                                  <span>{streets.length} Straßen</span>
                                </div>
                                  <div 
                                    className="flex items-center gap-2 text-xs text-blue-600 font-medium cursor-pointer hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterCity(area.city || '');
                                      setFilterAreaId(area.id);
                                      setActiveSection('leads');
                                    }}
                                  >
                                    <Building2 className="h-3 w-3" />
                                    <span>{areaLeads.length} Leads</span>
                                  </div>
                                </div>
                                {areaLeads.length > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full mt-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterCity(area.city || '');
                                      setFilterAreaId(area.id);
                                      setActiveSection('leads');
                                    }}
                                  >
                                    <List className="h-3 w-3 mr-1" />
                                    Leads ansehen
                                  </Button>
                                )}
                              {isSelected && (
                                <Button
                                  size="sm"
                                  className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGenAreaId(area.id);
                                    setCityInput(area.city || '');
                                    setActiveSection('generator');
                                  }}
                                >
                                  <Zap className="h-3 w-3 mr-1" />
                                  Leads generieren
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leads" className="mt-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Leads Liste ({filteredLeads.length})
                  </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] text-white/70 ml-1">Stadt</Label>
                        <Input 
                          value={filterCity} 
                          onChange={(e) => setFilterCity(e.target.value)} 
                          className="w-48 bg-white text-slate-900"
                          placeholder="Stadt eingeben..."
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] text-white/70 ml-1">Bereich</Label>
                        <Select value={filterAreaId} onValueChange={setFilterAreaId}>
                          <SelectTrigger className="w-48 bg-white text-slate-900">
                            <SelectValue placeholder="Bereich wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle Bereiche</SelectItem>
                            {savedAreas.filter(a => !filterCity || a.city?.toLowerCase() === filterCity.toLowerCase()).map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button variant="secondary" size="sm" onClick={navigateToMap}>
                          <MapIcon className="h-4 w-4 mr-1" />
                          Zur Karte
                        </Button>
                      </div>
                  </div>
                </div>
              </CardHeader>
                <CardContent className="p-6">
                  {filteredLeads.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <Building2 className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                      <p className="text-lg font-medium">Keine Leads gefunden</p>
                      <p className="text-sm mt-2">Filter anpassen oder Leads im Generator suchen</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-4 rounded-lg border-2 border-slate-200 hover:border-green-400 bg-white shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-lg">{lead.firma || 'Unbekannt'}</h4>
                          <Badge 
                            className="mt-1" 
                            style={{ backgroundColor: statusColors[lead.status] || statusColors['Neu'] }}
                          >
                            {lead.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 space-y-2">
                        {lead.strasse_hausnummer && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <p className="flex-1">
                              {lead.strasse_hausnummer}<br />
                              {lead.postleitzahl} {lead.stadt}
                            </p>
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                          {lead.telefon && (
                            <a href={`tel:${lead.telefon}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                              <Phone className="h-4 w-4" /> {lead.telefon}
                            </a>
                          )}
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                              <Mail className="h-4 w-4" /> {lead.email}
                            </a>
                          )}
                        </div>
                        {lead.assigned_to && (
                          <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                            <span className="font-medium">Zugewiesen:</span> {lead.assigned_to}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generator" className="mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Lead Generator
                      </CardTitle>
                        {selectedArea && (
                          <p className="text-sm text-blue-100 mt-1">
                            {selectedArea.name} · {selectedArea.city}
                          </p>
                        )}
                    </div>
                    <Button variant="secondary" size="sm" onClick={navigateToMap}>
                      <MapIcon className="h-4 w-4 mr-1" />
                      Zur Karte
                    </Button>
                  </div>
                </CardHeader>
                  <CardContent className="p-6">
                      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>Stadt (Textsuche)</Label>
                          <Input 
                            value={cityInput} 
                            onChange={(e) => setCityInput(e.target.value)} 
                            className="w-full"
                            placeholder="z.B. Berlin"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Bereich auswählen (Dropdown)</Label>
                          <Select value={genAreaId} onValueChange={setGenAreaId}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Wählen Sie einen Bereich..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Kein Bereich ausgewählt</SelectItem>
                              {savedAreas.filter(a => !cityInput || a.city?.toLowerCase() === cityInput.toLowerCase()).map((area) => (
                                <SelectItem key={area.id} value={area.id}>
                                  {area.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                    {genAreaId === 'all' && !selectedAreaId ? (
                    <div className="text-center py-16">
                      <MapPin className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                      <p className="text-lg font-medium text-slate-700">Kein Bereich ausgewählt</p>
                      <p className="text-sm text-slate-500 mt-2">
                        Wählen Sie einen Bereich aus dem Dropdown oder auf der Karte
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setActiveSection('map')}
                      >
                        <MapIcon className="h-4 w-4 mr-2" />
                        Zur Karte
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-blue-900 text-lg">
                              {savedAreas.find(a => a.id === genAreaId)?.name || selectedArea?.name}
                            </h3>
                            <p className="text-sm text-blue-700 mt-1">{cityInput}</p>
                          </div>
                          <Badge className="bg-blue-600 text-white">
                            {(() => {
                              const area = savedAreas.find(a => a.id === genAreaId) || selectedArea;
                              const streets = typeof area?.streets === 'string' ? JSON.parse(area.streets) : area?.streets || [];
                              return streets.length;
                            })()} Straßen
                          </Badge>
                        </div>
                          <Button
                            onClick={generateLeadsForArea}
                            disabled={generatingArea === (genAreaId !== 'all' ? genAreaId : selectedAreaId)}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md"
                            size="lg"
                          >
                          {generatingArea ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              {generationProgress.street && (
                                <span>
                                  {generationProgress.current}/{generationProgress.total}: {generationProgress.street}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <PlayCircle className="h-5 w-5 mr-2" />
                              Lead-Generierung starten
                            </>
                          )}
                        </Button>
                      </div>

                      {foundCompanies.length > 0 && (
                        <div className="bg-white rounded-xl border-2 border-green-200 p-6 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-green-600" />
                                Gefundene Unternehmen
                                <Badge className="bg-green-600 text-white">{foundCompanies.length}</Badge>
                              </h3>
                              <Button variant="outline" size="sm" onClick={clearAllCompanies}>
                                <X className="h-4 w-4 mr-1" />
                                Liste leeren
                              </Button>
                            </div>

                              {selectedAreaLeads.length > 0 && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm text-blue-800 font-bold">
                                      {selectedAreaLeads.length} Leads bereits in der Datenbank:
                                    </p>
                                    <Badge variant="outline" className="bg-white">{selectedAreaLeads.length}</Badge>
                                  </div>
                                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                    {selectedAreaLeads.slice(0, 10).map(lead => (
                                      <div key={lead.id} className="text-xs p-2 bg-white rounded border border-blue-100 flex justify-between items-center">
                                        <span className="font-medium truncate mr-2">{lead.firma}</span>
                                        <span className="text-slate-500 flex-shrink-0">{lead.strasse_hausnummer}</span>
                                      </div>
                                    ))}
                                    {selectedAreaLeads.length > 10 && (
                                      <p className="text-[10px] text-center text-blue-600 font-medium">
                                        + {selectedAreaLeads.length - 10} weitere Leads (siehe Leads tab)
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-lg mb-4 border border-green-200">
                            <Label className="text-green-900 font-semibold mb-2 block">Mitarbeiter zuweisen</Label>
                            <Select value={assignEmployee} onValueChange={setAssignEmployee}>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Mitarbeiter auswählen..." />
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
                              className="w-full mt-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md"
                              size="lg"
                            >
                              <UserPlus className="h-5 w-5 mr-2" />
                              {foundCompanies.length} als Leads hinzufügen
                            </Button>
                          </div>

                          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                            {foundCompanies.map((company) => (
                              <div
                                key={company.id}
                                className="p-4 rounded-lg border-2 border-slate-200 bg-slate-50 hover:bg-white hover:border-green-300 transition-all"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-bold text-slate-900">{company.firma || 'Unbekannt'}</h4>
                                      {company.branche && (
                                        <Badge variant="outline" className="text-xs">
                                          {company.branche}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-slate-600 space-y-1">
                                      {company.strasse_hausnummer && (
                                        <p className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {company.strasse_hausnummer}, {company.postleitzahl} {company.stadt}
                                        </p>
                                      )}
                                      <div className="flex flex-wrap gap-3 pt-1">
                                        {company.telefon && (
                                          <span className="flex items-center gap-1 text-blue-600">
                                            <Phone className="h-3 w-3" /> {company.telefon}
                                          </span>
                                        )}
                                        {company.email && (
                                          <span className="flex items-center gap-1 text-blue-600">
                                            <Mail className="h-3 w-3" /> {company.email}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => removeCompany(company.id)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-1">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Progress Log
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {generatingArea ? (
                      <div className="space-y-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            <span className="font-semibold text-blue-900">Generierung läuft...</span>
                          </div>
                          {generationProgress.street && (
                            <div className="text-sm text-blue-800 space-y-1">
                            <p>
                              <span className="font-medium">Fortschritt:</span> {generationProgress.current}/{generationProgress.total}
                            </p>
                            <p className="text-xs truncate">
                              <span className="font-medium">Aktuelle Straße:</span> {generationProgress.street}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">Keine aktive Generierung</p>
                      <p className="text-xs text-slate-400 mt-1">Starten Sie eine Lead-Generierung</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
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
