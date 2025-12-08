import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, UserCircle, Mail, Shield, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Benutzerverwaltung() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'user',
    benutzertyp: 'Interner Mitarbeiter'
  });

  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (userData) => {
      // Note: Base44 doesn't allow direct User entity creation
      // We'll need to use an invite system or admin function
      // For now, we'll show instructions
      return { email: userData.email, invited: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setIsDialogOpen(false);
      resetForm();
      alert('Benutzer-Einladung vorbereitet. Bitte nutzen Sie die Base44 Admin-Oberfläche um die Einladung zu versenden.');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    inviteUserMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      role: 'user',
      benutzertyp: 'Interner Mitarbeiter'
    });
  };

  const handleDelete = (user) => {
    if (confirm(`Benutzer "${user.full_name || user.email}" wirklich löschen?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const getUserEmployee = (userEmail) => {
    return employees.find(e => e.email === userEmail);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Benutzerverwaltung</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie App-Zugänge für Ihre Mitarbeiter</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Plus className="h-4 w-4 mr-2" />
              Benutzer einladen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Neuen Benutzer einladen</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 font-semibold mb-2">Wichtig:</p>
                <p className="text-xs text-blue-800">
                  Benutzer-Einladungen müssen über die Base44 Admin-Oberfläche versendet werden. 
                  Gehen Sie zu <strong>Einstellungen → Team</strong> in Ihrem Base44 Dashboard.
                </p>
              </div>
              <div className="space-y-2">
                <Label>E-Mail *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="mitarbeiter@firma.de"
                  required
                />
                <p className="text-xs text-slate-500">
                  Diese E-Mail sollte mit einem Mitarbeiter-Profil übereinstimmen
                </p>
              </div>
              <div className="space-y-2">
                <Label>Vollständiger Name *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Max Mustermann"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Benutzertyp *</Label>
                <Select value={formData.benutzertyp} onValueChange={(value) => setFormData({ ...formData, benutzertyp: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interner Mitarbeiter">Interner Mitarbeiter</SelectItem>
                    <SelectItem value="Partner 1">Partner 1</SelectItem>
                    <SelectItem value="Partner 2">Partner 2</SelectItem>
                    <SelectItem value="Partner 3">Partner 3</SelectItem>
                    <SelectItem value="Partner 4">Partner 4</SelectItem>
                    <SelectItem value="Partner 5">Partner 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rolle *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Benutzer (Mitarbeiter)</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  <strong>Benutzer:</strong> Sieht nur eigene Leads und Verkäufe<br/>
                  <strong>Admin:</strong> Voller Zugriff auf alle Daten
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                  Vorbereiten
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Instructions Card */}
      <Card className="border-0 shadow-md bg-amber-50 border-amber-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            So laden Sie Benutzer ein:
          </h3>
          <ol className="text-sm text-amber-800 space-y-2 list-decimal ml-5">
            <li>Gehen Sie zu Ihrem <strong>Base44 Dashboard</strong></li>
            <li>Klicken Sie auf <strong>Einstellungen → Team</strong></li>
            <li>Klicken Sie auf <strong>"Benutzer einladen"</strong></li>
            <li>Geben Sie die E-Mail-Adresse und Rolle ein</li>
            <li>Der Benutzer erhält eine Einladungs-E-Mail mit einem Link</li>
            <li>Nach dem Klick auf den Link kann der Benutzer ein Passwort setzen und sich anmelden</li>
          </ol>
        </CardContent>
      </Card>

      {/* Users Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Gesamt Benutzer</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{users.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                <UserCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Administratoren</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
                <Shield className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Mitarbeiter</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {users.filter(u => u.role === 'user').length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600">
                <UserCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Alle Benutzer ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Benutzertyp</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Mitarbeiter-Profil</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const employee = getUserEmployee(user.email);
                  return (
                    <TableRow key={user.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-slate-400" />
                          <span className="font-semibold text-slate-900">
                            {user.full_name || 'Kein Name'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          user.benutzertyp === 'Interner Mitarbeiter' ? 'border-blue-300 text-blue-800' : 'border-green-300 text-green-800'
                        }>
                          {user.benutzertyp || 'Interner Mitarbeiter'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'}>
                          {user.role === 'admin' ? 'Administrator' : 'Benutzer'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {employee ? (
                          <div className="text-sm">
                            <Badge className={
                              employee.sparte === 'Telekom' ? 'bg-pink-100 text-pink-800' :
                              employee.sparte === '1&1 Versatel' ? 'bg-blue-100 text-blue-800' :
                              'bg-purple-100 text-purple-800'
                            }>
                              {employee.sparte}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600">Kein Mitarbeiter-Profil</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {user.created_date ? new Date(user.created_date).toLocaleDateString('de-DE') : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          className="text-red-600 hover:text-red-700"
                          disabled={user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1}
                          title={user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1 ? 'Letzter Admin kann nicht gelöscht werden' : ''}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {users.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Noch keine Benutzer vorhanden
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input value={editingUser.email} disabled className="bg-slate-100" />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editingUser.full_name || ''} disabled className="bg-slate-100" />
              </div>
              <div className="space-y-2">
                <Label>Benutzertyp</Label>
                <Select 
                  value={editingUser.benutzertyp || 'Interner Mitarbeiter'} 
                  onValueChange={(value) => setEditingUser({ ...editingUser, benutzertyp: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interner Mitarbeiter">Interner Mitarbeiter</SelectItem>
                    <SelectItem value="Partner 1">Partner 1</SelectItem>
                    <SelectItem value="Partner 2">Partner 2</SelectItem>
                    <SelectItem value="Partner 3">Partner 3</SelectItem>
                    <SelectItem value="Partner 4">Partner 4</SelectItem>
                    <SelectItem value="Partner 5">Partner 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rolle</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Benutzer</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                  Speichern
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      </div>
      );
      }