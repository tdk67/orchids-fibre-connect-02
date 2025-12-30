import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Rectangle,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
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
  Download,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  isPointInBounds,
  geocodeAddress,
  getAreaLeadMatch,
  findAreaForLead,
  syncLeadsWithAreas,
} from "@/utils/geoUtils";
import {
  fetchStreetLeads,
} from "@/lib/scraping/das-oertliche-scraper";
import { isDuplicateLead } from "@/utils/leadDeduplication";
import { useOSMImport } from "@/hooks/useOSMImport";
import { format } from "date-fns";
import { de } from "date-fns/locale";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const statusColors = {
  Neu: "#3b82f6",
  Kontaktiert: "#eab308",
  Interessiert: "#22c55e",
  "Nicht interessiert": "#ef4444",
  Konvertiert: "#a855f7",
  Ungültig: "#6b7280",
};

const createCustomIcon = (color) =>
  L.divIcon({
    className: "custom-div-icon",
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
        color: "#9333ea",
        weight: 2,
        fillOpacity: 0.1,
        dashArray: "5, 5",
      }).addTo(mapRef);
      setRect(newRect);
    },
    mouseup(e) {
      if (!isDrawing || !startPoint) return;
      mapRef.dragging.enable();

      const bounds = L.latLngBounds(startPoint, e.latlng);
      const size =
        Math.abs(bounds.getNorth() - bounds.getSouth()) +
        Math.abs(bounds.getEast() - bounds.getWest());

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
  const [isSyncing, setIsSyncing] = useState(false);

  const navigateToMap = () => setActiveSection("map");

  const selectedArea = useMemo(() => {
    const areaId =
      genAreaId !== "all" ? genAreaId : selectedAreaId || filterAreaId;
    return savedAreas.find((a) => a.id === areaId);
  }, [savedAreas, selectedAreaId, filterAreaId, genAreaId]);

  const [showAreaDialog, setShowAreaDialog] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list(),
  });

  const {
    data: allLeads = [],
    isLoading: isLoadingLeads,
    refetch: refetchAllLeads,
  } = useQuery({
    queryKey: ["allLeads"],
    queryFn: async () => {
      const leads = await base44.entities.Lead.list("-created_date", 5000);
      return leads;
    },
  });

  const [generatingArea, setGeneratingArea] = useState(null);
  const [generationProgress, setGenerationProgress] = useState({});
  const [rescanMode, setRescanMode] = useState(false);
  const [assignEmployee, setAssignEmployee] = useState("");

  const poolLeads = useMemo(() => {
    return allLeads.filter(lead => lead.pool_status === "im_pool");
  }, [allLeads]);

  const foundCompanies = useMemo(() => {
    if (!selectedArea) return [];
    return poolLeads.filter(lead => {
      return getAreaLeadMatch(lead, selectedArea);
    });
  }, [poolLeads, selectedArea]);

  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      if (lead.archiv_kategorie || lead.verkaufschance_status || lead.verloren)
        return false;

      const cityMatch =
        !filterCity ||
        lead.stadt
          ?.toLowerCase()
          ?.trim()
          ?.includes(filterCity.toLowerCase().trim());

      let areaMatch = true;
      const activeAreaId = filterAreaId !== "all" ? filterAreaId : selectedAreaId;
      
      if (activeAreaId) {
        const area = savedAreas.find((a) => a.id === activeAreaId);
        areaMatch = getAreaLeadMatch(lead, area);
      }

      return cityMatch && areaMatch;
    });
  }, [allLeads, filterCity, filterAreaId, savedAreas, selectedAreaId]);

  const sortedLeads = useMemo(() => {
    const sorted = [...filteredLeads];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key] || "";
        let bVal = b[sortConfig.key] || "";

        if (sortConfig.key === "strasse_hausnummer") {
          const getStreetName = (addr) => addr?.match(/^[^0-9]*/)?.[0]?.trim() || "";
          const getStreetNumber = (addr) => {
            const match = addr?.match(/\d+/);
            return match ? match[0].padStart(4, "0") : "0000";
          };
          aVal = `${getStreetName(aVal)}|${getStreetNumber(aVal)}|${a.firma || ""}`;
          bVal = `${getStreetName(bVal)}|${getStreetNumber(bVal)}|${b.firma || ""}`;
        }

        aVal = aVal.toString().toLowerCase();
        bVal = bVal.toString().toLowerCase();

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredLeads, sortConfig]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const selectedAreaLeads = useMemo(() => {
    const areaToUse = savedAreas.find(
      (a) => a.id === (genAreaId !== "all" ? genAreaId : selectedAreaId),
    );
    if (!areaToUse) return [];

    return allLeads.filter((lead) => 
      lead.pool_status !== "im_pool" && getAreaLeadMatch(lead, areaToUse)
    );
  }, [allLeads, savedAreas, genAreaId, selectedAreaId]);

  const leadsWithCoordinates = useMemo(() => {
    return allLeads.filter((lead) => {
      if (!lead.latitude || !lead.longitude) return false;
      if (selectedAreaId) {
        const area = savedAreas.find((a) => a.id === selectedAreaId);
        return getAreaLeadMatch(lead, area);
      }
      return true;
    });
  }, [allLeads, selectedAreaId, savedAreas]);

  async function loadAreas() {
    try {
      const { data: areas, error } = await base44.client
        .from("areas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSavedAreas(areas || []);
    } catch (err) {
      console.error("Failed to load areas:", err);
    }
  }

  async function saveArea() {
    if (!newAreaName.trim() || !newAreaBounds) return;

    try {
      const streetsResult = await fetch(
        "https://overpass-api.de/api/interpreter",
        {
          method: "POST",
          body: `
          [out:json][timeout:25];
          way["highway"]["name"](${newAreaBounds.south},${newAreaBounds.west},${newAreaBounds.north},${newAreaBounds.east});
          out tags;
        `,
        },
      );

      const data = await streetsResult.json();
      const streetNames = Array.from(
        new Set(
          (data.elements || []).map((el) => el.tags?.name).filter(Boolean),
        ),
      ).map((name) => ({ name }));

      const areaData = {
        name: newAreaName.trim(),
        city: cityInput.trim(),
        bounds: newAreaBounds,
        streets: streetNames,
        color: "#3b82f6",
      };

      const { error: insertError } = await base44.client.from("areas").insert(areaData);
      if (insertError) throw insertError;
  
      await loadAreas();
      
      setIsSyncing(true);
      try {
        const { data: currentLeads } = await base44.client.from('leads').select('*');
        if (currentLeads) {
          const { data: freshArea } = await base44.client.from('areas').select('*').eq('name', areaData.name).single();
          const updatedCount = await syncLeadsWithAreas(currentLeads, [freshArea]);
          if (updatedCount > 0) {
            await refetchAllLeads();
            toast({ title: "Synchronisierung", description: `${updatedCount} Leads wurden dem neuen Bereich zugeordnet.` });
          }
        }
      } catch (syncErr) {
        console.error("Auto-sync error:", syncErr);
      } finally {
        setIsSyncing(false);
      }
  
      setShowAreaDialog(false);
      setNewAreaName("");
      setNewAreaBounds(null);
      toast({
        title: "Bereich gespeichert",
        description: `Bereich "${areaData.name}" mit ${streetNames.length} Straßen gespeichert!`,
      });
    } catch (err) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern: " + err.message,
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
    if (selectedAreaId === areaId) {
      setSelectedAreaId(null);
    } else {
      setSelectedAreaId(areaId);
      const area = savedAreas.find((a) => a.id === areaId);
      if (area && area.bounds) {
        const bounds =
          typeof area.bounds === "string" ? JSON.parse(area.bounds) : area.bounds;
        const center = [
          (bounds.north + bounds.south) / 2,
          (bounds.east + bounds.west) / 2,
        ];
        setMapCenter(center);
        setMapZoom(16);
      }
    }
  }

  async function generateLeadsForArea() {
    if (!selectedArea) return;

    const streets =
      typeof selectedArea.streets === "string"
        ? JSON.parse(selectedArea.streets)
        : selectedArea.streets || [];

    if (streets.length === 0) {
      toast({
        title: "Warnung",
        description: "Keine Straßen in diesem Bereich gefunden",
        variant: "destructive",
      });
      return;
    }

    setGeneratingArea(selectedArea.id);
    setGenerationProgress({});

    const leadsToReassign = allLeads.filter(lead => 
      !lead.area_id && lead.latitude && lead.longitude && isPointInBounds(lead.latitude, lead.longitude, selectedArea.bounds)
    );

    if (leadsToReassign.length > 0) {
      for (const lead of leadsToReassign) {
        try {
          await base44.entities.Lead.update(lead.id, { area_id: selectedArea.id });
        } catch (e) {
          console.error("Failed to reassign lead:", lead.id, e);
        }
      }
      await refetchAllLeads();
    }

    const sessionLeads = [];

    for (let i = 0; i < streets.length; i++) {
      const street = streets[i];
      const streetName = street.name || street;

      setGenerationProgress({
        current: i + 1,
        total: streets.length,
        street: streetName,
      });

      const streetCity = selectedArea.city || cityInput;
      const alreadyHasLeads = allLeads.some(l => 
        l.stadt?.toLowerCase() === streetCity.toLowerCase() && 
        l.strasse_hausnummer?.toLowerCase().includes(streetName.toLowerCase())
      );

      if (alreadyHasLeads && !rescanMode) {
        continue;
      }

      try {
        const leads = await fetchStreetLeads(streetName, streetCity, { maxPages: 1 });
        const leadsToSave = [];
        
        for (const lead of leads) {
          const leadData = {
            firma: lead.firma || "",
            strasse_hausnummer: lead.strasse_hausnummer || "",
            stadt: lead.stadt || selectedArea.city || cityInput,
            email: lead.email || "",
            postleitzahl: lead.postleitzahl || "",
          };

          const isDuplicateInSession = sessionLeads.some(existing => isDuplicateLead(leadData, existing));
          if (isDuplicateInSession) continue;

          const existingLeadInDB = allLeads.find(existing => isDuplicateLead(leadData, existing));
          
          if (existingLeadInDB) {
            if (String(existingLeadInDB.area_id) !== String(selectedArea.id)) {
              await base44.entities.Lead.update(existingLeadInDB.id, {
                area_id: selectedArea.id,
                pool_status: existingLeadInDB.pool_status || "im_pool"
              });
            }

            if (!existingLeadInDB.latitude || !existingLeadInDB.longitude) {
              const coords = await geocodeAddress(
                lead.street_name || streetName,
                lead.street_number || "",
                selectedArea.city || cityInput,
                lead.postleitzahl || ""
              );
              if (coords) {
                await base44.entities.Lead.update(existingLeadInDB.id, {
                  latitude: coords.lat.toString(),
                  longitude: coords.lon.toString()
                });
              }
            }
            
            sessionLeads.push(existingLeadInDB);
            continue;
          }

          let coords = allLeads.find(l => 
            l.strasse_hausnummer === leadData.strasse_hausnummer && 
            l.stadt === leadData.stadt && 
            l.latitude && l.longitude
          );
          
          if (!coords) {
            coords = await geocodeAddress(
              lead.street_name || streetName,
              lead.street_number || "",
              selectedArea.city || cityInput,
              lead.postleitzahl || ""
            );
          }

          const newLead = {
            ...leadData,
            telefon: lead.telefon || "",
            infobox: `Branche: ${lead.branche || "-"}\nWebseite: ${lead.webseite || "-"}\nGefunden über: ${streetName}, ${selectedArea.city || cityInput}`,
            status: "Neu",
            pool_status: "im_pool",
            benutzertyp: user?.benutzertyp || "Interner Mitarbeiter",
            sparte: "1&1 Versatel",
            latitude: coords?.lat?.toString() || coords?.latitude || "",
            longitude: coords?.lon?.toString() || coords?.longitude || "",
            area_id: selectedArea.id,
          };

          leadsToSave.push(newLead);
          sessionLeads.push(newLead);
        }

        if (leadsToSave.length > 0) {
          await base44.entities.Lead.bulkCreate(leadsToSave);
          await refetchAllLeads();
        }
      } catch (err) {
        console.error(`Error scraping ${streetName}:`, err);
      }
    }

    setGeneratingArea(null);
    setGenerationProgress({});
    toast({
      title: "Erfolgreich",
      description: `Generierung abgeschlossen!`,
    });
  }

  async function geocodeCity() {
    if (!cityInput.trim()) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityInput)}`,
      );
      const data = await res.json();
      if (data?.length) {
        const { lat, lon } = data[0];
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        setMapZoom(13);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeocoding(false);
    }
  }

  async function addCompaniesToLeads() {
    if (foundCompanies.length === 0 || !assignEmployee) return;
    const employee = employees.find((e) => e.full_name === assignEmployee);
    try {
      const updatePromises = foundCompanies.map((company) => 
        base44.entities.Lead.update(company.id, {
          assigned_to: employee?.full_name || "",
          assigned_to_email: employee?.email || "",
          pool_status: "zugewiesen",
          status: "Neu"
        })
      );
      await Promise.all(updatePromises);
      await refetchAllLeads();
      toast({ title: "Erfolgreich", description: `${foundCompanies.length} Leads zugewiesen!` });
    } catch (error) {
      console.error(error);
    }
  }

  const removeCompany = async (companyId) => {
    try {
      await base44.entities.Lead.delete(companyId);
      await refetchAllLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllCompanies = async () => {
    if (!confirm(`Möchten Sie alle ${foundCompanies.length} Pool-Leads in diesem Bereich löschen?`)) return;
    try {
      for (const company of foundCompanies) {
        await base44.entities.Lead.delete(company.id);
      }
      await refetchAllLeads();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Unternehmensuche</h1>
          <p className="text-slate-500 mt-1">Bereiche definieren, Straßen extrahieren, Leads generieren</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            disabled={isSyncing}
            onClick={async () => {
              if (!confirm("Sollen ALLE Leads in der Datenbank neu synchronisiert werden?")) return;
              setIsSyncing(true);
              try {
                const { data: currentLeads } = await base44.client.from('leads').select('*');
                if (currentLeads) {
                  const updatedCount = await syncLeadsWithAreas(currentLeads, savedAreas);
                  await refetchAllLeads();
                  toast({ title: "Globaler Sync abgeschlossen", description: `${updatedCount} Leads wurden aktualisiert.` });
                }
              } catch (err) {
                console.error(err);
              } finally {
                setIsSyncing(false);
              }
            }}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Globaler Sync
          </Button>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-3 bg-slate-100">
          <TabsTrigger value="map" className="flex items-center gap-2">
            <MapIcon className="h-4 w-4" /> Karte & Bereiche
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <List className="h-4 w-4" /> Leads ({filteredLeads.length})
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Lead Generator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-4">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Karte</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Input value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="Stadt suchen..." className="w-48 bg-white text-slate-900" onKeyDown={(e) => e.key === "Enter" && geocodeCity()} />
                        <Button variant="secondary" size="sm" onClick={geocodeCity} disabled={isGeocoding}>
                          {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button variant={isDrawing ? "default" : "secondary"} size="sm" onClick={() => setIsDrawing(!isDrawing)} className={isDrawing ? "bg-purple-600 hover:bg-purple-700" : ""}>
                        <Crosshair className="h-4 w-4 mr-1" /> {isDrawing ? "Zeichnen aktiv..." : "Bereich zeichnen"}
                      </Button>
                      {cityInput && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                              <Download className="h-4 w-4 mr-1" /> OSM Daten
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>OSM Daten für {cityInput}</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                              {currentCityImportStatus ? (
                                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 text-green-800 font-semibold mb-1">
                                    <Badge className="bg-green-600">Bereits geladen</Badge>
                                    <span>Letzter Import: {format(new Date(currentCityImportStatus.last_import_at), "PPP 'um' p", { locale: de })}</span>
                                  </div>
                                </div>
                              ) : <p className="text-sm text-slate-600">Noch keine Daten vorhanden.</p>}
                              {isImporting && (
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs font-medium"><span>{importProgress.message}</span></div>
                                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <DialogFooter>
                              <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => importCityData(cityInput)} disabled={isImporting}>
                                {isImporting ? "Import läuft..." : "Importieren"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[calc(100vh-220px)] w-full">
                    <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }} className="z-0">
                      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
                      <MapController center={mapCenter} zoom={mapZoom} />
                      {isDrawing && <DrawingHandler isDrawing={isDrawing} onDrawComplete={handleDrawComplete} />}
                      {savedAreas.map((area) => {
                        const bounds = typeof area.bounds === "string" ? JSON.parse(area.bounds) : area.bounds;
                        return (
                          <Rectangle key={area.id} bounds={[[bounds.south, bounds.west], [bounds.north, bounds.east]]} pathOptions={{ color: area.id === selectedAreaId ? "#2563eb" : "#94a3b8", weight: area.id === selectedAreaId ? 3 : 2, fillOpacity: 0.1 }} eventHandlers={{ click: () => handleAreaSelect(area.id) }}>
                            <Popup><div className="p-2"><h3 className="font-bold">{area.name}</h3><p className="text-sm">{area.city}</p></div></Popup>
                          </Rectangle>
                        );
                      })}
                      {leadsWithCoordinates.map((lead) => (
                        <Marker key={lead.id} position={[parseFloat(lead.latitude), parseFloat(lead.longitude)]} icon={createCustomIcon(lead.pool_status === "im_pool" ? "#3b82f6" : "#22c55e")}>
                          <Popup>
                            <div className="p-3">
                              <h3 className="font-bold mb-1">{lead.firma}</h3>
                              <p className="text-sm text-slate-600 mb-1">{lead.strasse_hausnummer}</p>
                              {lead.telefon && (
                                <div className="flex items-center gap-2 text-xs text-blue-600 font-medium mb-2">
                                  <Phone className="h-3 w-3" /> {lead.telefon}
                                </div>
                              )}
                              <Badge className="mt-1">{lead.pool_status === "im_pool" ? "Pool" : lead.status}</Badge>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="xl:col-span-1">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white pb-4"><CardTitle className="text-base flex items-center gap-2"><MapIcon className="h-4 w-4" /> Bereiche</CardTitle></CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                    {savedAreas.map((area) => (
                      <div key={area.id} className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${area.id === selectedAreaId ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`} onClick={() => handleAreaSelect(area.id)}>
                        <h4 className="font-semibold text-sm">{area.name}</h4>
                        {area.description && <p className="text-xs text-slate-500 line-clamp-1">{area.description}</p>}
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-slate-600">{area.city}</p>
                          <Badge variant="secondary" className="text-[10px] px-1 h-4">
                            {allLeads.filter(l => getAreaLeadMatch(l, area)).length} Leads
                          </Badge>
                        </div>
                        {area.id === selectedAreaId && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <Button size="sm" className="bg-blue-600 h-8 text-xs" onClick={(e) => { e.stopPropagation(); setGenAreaId(area.id); setActiveSection("generator"); }}>
                              <Zap className="h-3 w-3 mr-1" /> Scannen
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); setFilterAreaId(area.id); setActiveSection("leads"); }}>
                              <List className="h-3 w-3 mr-1" /> View Leads
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Leads Liste ({filteredLeads.length})</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Input value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-48 bg-white text-slate-900" placeholder="Stadt filtern..." />
                  <Select value={filterAreaId} onValueChange={setFilterAreaId}>
                    <SelectTrigger className="w-48 bg-white text-slate-900"><SelectValue placeholder="Bereich" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Alle</SelectItem>{savedAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-4 cursor-pointer" onClick={() => requestSort("firma")}>Firma</th>
                      <th className="px-6 py-4 cursor-pointer" onClick={() => requestSort("strasse_hausnummer")}>Adresse</th>
                      <th className="px-6 py-4 cursor-pointer" onClick={() => requestSort("status")}>Status</th>
                      <th className="px-6 py-4">Kontakt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-blue-50/50">
                        <td className="px-6 py-4 font-bold">{lead.firma}</td>
                        <td className="px-6 py-4">{lead.strasse_hausnummer}, {lead.stadt}</td>
                        <td className="px-6 py-4"><Badge style={{ backgroundColor: statusColors[lead.status] || statusColors["Neu"], color: "white" }}>{lead.status}</Badge></td>
                        <td className="px-6 py-4">{lead.telefon && <div className="text-xs">{lead.telefon}</div>}{lead.email && <div className="text-xs">{lead.email}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generator" className="mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <div className="flex items-center justify-between">
                    <CardTitle><Zap className="h-5 w-5 inline mr-2" /> Lead Generator</CardTitle>
                    <Button variant="secondary" size="sm" onClick={navigateToMap}>Karte</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Stadt</Label><Input value={cityInput} onChange={(e) => setCityInput(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Bereich</Label>
                      <Select value={genAreaId} onValueChange={setGenAreaId}>
                        <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Keiner</SelectItem>{savedAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedArea ? (
                    <div className="space-y-6">
                      <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="flex items-center gap-2 mb-4">
                          <input type="checkbox" id="rescan-mode" checked={rescanMode} onChange={(e) => setRescanMode(e.target.checked)} />
                          <Label htmlFor="rescan-mode">Bereits geladene erneut scannen</Label>
                        </div>
                        <Button onClick={generateLeadsForArea} disabled={!!generatingArea} className="w-full bg-blue-600" size="lg">
                          {generatingArea ? `Scanne: ${generationProgress.street} (${generationProgress.current}/${generationProgress.total})` : "Starten"}
                        </Button>
                      </div>
                      {foundCompanies.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="font-bold text-lg">Gefunden: {foundCompanies.length}</h3>
                          <div className="p-5 bg-green-50 rounded-lg border border-green-200">
                            <Label>Zuweisen an:</Label>
                            <Select value={assignEmployee} onValueChange={setAssignEmployee}>
                              <SelectTrigger className="bg-white"><SelectValue placeholder="Mitarbeiter..." /></SelectTrigger>
                              <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.full_name}>{e.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button onClick={addCompaniesToLeads} disabled={!assignEmployee} className="w-full mt-3 bg-green-600">Hinzufügen</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : <div className="text-center py-16">Wählen Sie einen Bereich</div>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showAreaDialog} onOpenChange={setShowAreaDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bereich speichern</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} /></div>
            <div><Label>Stadt</Label><Input value={cityInput} onChange={(e) => setCityInput(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={saveArea} disabled={!newAreaName.trim()}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
