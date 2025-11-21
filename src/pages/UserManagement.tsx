import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Pencil, Trash2, UserPlus, Home } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  phone: string | null;
  email?: string;
  role?: string;
  apartments?: string[];
}

interface Apartment {
  id: string;
  apartment_number: string;
  building_id: string;
}

interface Building {
  id: string;
  name: string;
}

const UserManagement = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [assigningUser, setAssigningUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<{ name: string; phone: string; role: 'admin' | 'user' }>({ name: '', phone: '', role: 'user' });
  const [createFormData, setCreateFormData] = useState({ email: '', password: '', name: '', phone: '', role: 'user' as 'admin' | 'user' });
  const [selectedApartments, setSelectedApartments] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchBuildings();
      fetchApartments();
      fetchUsers();
    }
  }, [user, isAdmin]);

  const fetchBuildings = async () => {
    const { data, error } = await supabase
      .from('buildings')
      .select('id, name')
      .order('name');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBuildings(data || []);
    }
  };

  const fetchApartments = async () => {
    const { data, error } = await supabase
      .from('apartments')
      .select('id, apartment_number, building_id')
      .order('apartment_number');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setApartments(data || []);
    }
  };

  const fetchUsers = async () => {
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .order('name');

    if (profilesError) {
      toast({ title: 'Error', description: profilesError.message, variant: 'destructive' });
      return;
    }

    // Fetch user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      toast({ title: 'Error', description: rolesError.message, variant: 'destructive' });
      return;
    }

    // Fetch user apartment assignments
    const { data: userApartments, error: apartmentsError } = await supabase
      .from('user_apartments')
      .select('user_id, apartment_id');

    if (apartmentsError) {
      toast({ title: 'Error', description: apartmentsError.message, variant: 'destructive' });
      return;
    }

    // Combine all data
    const usersWithDetails = profiles?.map(profile => {
      const userRole = roles?.find(r => r.user_id === profile.id);
      const userApts = userApartments?.filter(ua => ua.user_id === profile.id).map(ua => ua.apartment_id) || [];
      
      return {
        ...profile,
        role: userRole?.role || 'user',
        apartments: userApts,
      };
    }) || [];

    setUsers(usersWithDetails);
  };

  const handleEdit = (userProfile: UserProfile) => {
    setEditingUser(userProfile);
    setFormData({
      name: userProfile.name,
      phone: userProfile.phone || '',
      role: (userProfile.role || 'user') as 'admin' | 'user',
    });
    setIsDialogOpen(true);
  };

  const handleAssignApartments = (userProfile: UserProfile) => {
    setAssigningUser(userProfile);
    setSelectedApartments(userProfile.apartments || []);
    setIsAssignDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name: formData.name, phone: formData.phone || null })
      .eq('id', editingUser.id);

    if (profileError) {
      toast({ title: 'Error', description: profileError.message, variant: 'destructive' });
      return;
    }

    // Update role
    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ role: formData.role as 'admin' | 'user' })
      .eq('user_id', editingUser.id);

    if (roleError) {
      toast({ title: 'Error', description: roleError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'User updated successfully' });
    fetchUsers();
    resetForm();
  };

  const handleCreateUser = async () => {
    if (!createFormData.email || !createFormData.password || !createFormData.name) {
      toast({ title: 'Error', description: 'Email, password, and name are required', variant: 'destructive' });
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: createFormData.email,
          password: createFormData.password,
          name: createFormData.name,
          phone: createFormData.phone || null,
          role: createFormData.role,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({ title: 'Success', description: 'User created successfully' });
        fetchUsers();
        resetCreateForm();
      } else {
        throw new Error(data.error || 'Failed to create user');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveApartments = async () => {
    if (!assigningUser) return;

    // Delete existing assignments
    await supabase
      .from('user_apartments')
      .delete()
      .eq('user_id', assigningUser.id);

    // Insert new assignments
    if (selectedApartments.length > 0) {
      const assignments = selectedApartments.map(apartmentId => ({
        user_id: assigningUser.id,
        apartment_id: apartmentId,
      }));

      const { error } = await supabase
        .from('user_apartments')
        .insert(assignments);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Success', description: 'Apartment assignments updated successfully' });
    fetchUsers();
    setIsAssignDialogOpen(false);
    setAssigningUser(null);
    setSelectedApartments([]);
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', role: 'user' });
    setEditingUser(null);
    setIsDialogOpen(false);
  };

  const resetCreateForm = () => {
    setCreateFormData({ email: '', password: '', name: '', phone: '', role: 'user' });
    setIsCreateDialogOpen(false);
  };

  const getApartmentLabel = (apartmentId: string) => {
    const apartment = apartments.find(a => a.id === apartmentId);
    if (!apartment) return 'Unknown';
    const building = buildings.find(b => b.id === apartment.building_id);
    return `${apartment.apartment_number} - ${building?.name || 'Unknown'}`;
  };

  const toggleApartmentSelection = (apartmentId: string) => {
    setSelectedApartments(prev =>
      prev.includes(apartmentId)
        ? prev.filter(id => id !== apartmentId)
        : [...prev, apartmentId]
    );
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">User Management</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Create User
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Apartments</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((userProfile) => (
                    <TableRow key={userProfile.id}>
                      <TableCell className="font-medium">{userProfile.name}</TableCell>
                      <TableCell>{userProfile.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={userProfile.role === 'admin' ? 'default' : 'secondary'}>
                          {userProfile.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userProfile.apartments && userProfile.apartments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {userProfile.apartments.slice(0, 2).map(aptId => (
                              <Badge key={aptId} variant="outline" className="text-xs">
                                {apartments.find(a => a.id === aptId)?.apartment_number || 'Unknown'}
                              </Badge>
                            ))}
                            {userProfile.apartments.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{userProfile.apartments.length - 2} more
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No apartments</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(userProfile)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAssignApartments(userProfile)}
                          >
                            <Home className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'user' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveUser} className="flex-1">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="create_email">Email *</Label>
                <Input
                  id="create_email"
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="create_password">Password *</Label>
                <Input
                  id="create_password"
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  required
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <Label htmlFor="create_name">Name *</Label>
                <Input
                  id="create_name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="create_phone">Phone</Label>
                <Input
                  id="create_phone"
                  value={createFormData.phone}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="create_role">Role</Label>
                <Select value={createFormData.role} onValueChange={(value) => setCreateFormData({ ...createFormData, role: value as 'admin' | 'user' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateUser} className="flex-1" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create User'}
                </Button>
                <Button variant="outline" onClick={resetCreateForm} disabled={isCreating}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign Apartments Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Assign Apartments - {assigningUser?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                {buildings.map(building => {
                  const buildingApartments = apartments.filter(a => a.building_id === building.id);
                  if (buildingApartments.length === 0) return null;

                  return (
                    <div key={building.id} className="space-y-2">
                      <h3 className="font-semibold text-sm">{building.name}</h3>
                      <div className="grid grid-cols-3 gap-2 pl-4">
                        {buildingApartments.map(apartment => (
                          <div
                            key={apartment.id}
                            onClick={() => toggleApartmentSelection(apartment.id)}
                            className={`
                              cursor-pointer p-2 rounded border text-sm text-center transition-colors
                              ${selectedApartments.includes(apartment.id)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-accent border-border'
                              }
                            `}
                          >
                            {apartment.apartment_number}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveApartments} className="flex-1">
                  Save Assignments
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAssignDialogOpen(false);
                    setAssigningUser(null);
                    setSelectedApartments([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default UserManagement;
