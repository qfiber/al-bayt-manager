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
import { Users, Pencil, Trash2, UserPlus, Key } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface UserProfile {
  id: string;
  name: string;
  phone: string | null;
  email?: string;
  role?: string;
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
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<{ name: string; phone: string; role: 'admin' | 'moderator' | 'user' }>({ name: '', phone: '', role: 'user' });
  const [createFormData, setCreateFormData] = useState({ email: '', password: '', name: '', phone: '', role: 'user' as 'admin' | 'moderator' | 'user' });
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [changingPasswordUser, setChangingPasswordUser] = useState<UserProfile | null>(null);
  const [passwordFormData, setPasswordFormData] = useState({ adminPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [isOwnerDialogOpen, setIsOwnerDialogOpen] = useState(false);
  const [isBeneficiaryDialogOpen, setIsBeneficiaryDialogOpen] = useState(false);
  const [assigningOwnerUser, setAssigningOwnerUser] = useState<UserProfile | null>(null);
  const [assigningBeneficiaryUser, setAssigningBeneficiaryUser] = useState<UserProfile | null>(null);
  const [selectedOwnerApartments, setSelectedOwnerApartments] = useState<string[]>([]);
  const [selectedBeneficiaryApartments, setSelectedBeneficiaryApartments] = useState<string[]>([]);

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
      
      return {
        ...profile,
        role: userRole?.role || 'user',
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
      console.error('Create user error:', error);
      
      // Extract the most relevant error message
      let errorMessage = 'Failed to create user';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.context?.body) {
        try {
          const bodyError = JSON.parse(error.context.body);
          errorMessage = bodyError.error || errorMessage;
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsCreating(false);
    }
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

  const handleChangePassword = (userProfile: UserProfile) => {
    setChangingPasswordUser(userProfile);
    setPasswordFormData({ adminPassword: '', newPassword: '', confirmPassword: '' });
    setIsPasswordDialogOpen(true);
  };

  const resetPasswordForm = () => {
    setPasswordFormData({ adminPassword: '', newPassword: '', confirmPassword: '' });
    setChangingPasswordUser(null);
    setIsPasswordDialogOpen(false);
  };

  const handleSavePassword = async () => {
    if (!changingPasswordUser) return;

    // Validate passwords
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      toast({ title: t('error'), description: t('passwordsDoNotMatch'), variant: 'destructive' });
      return;
    }

    // Validate password strength (14+ chars, uppercase, lowercase, number, special char)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{14,}$/;
    if (!passwordRegex.test(passwordFormData.newPassword)) {
      toast({ title: t('error'), description: t('passwordTooWeak'), variant: 'destructive' });
      return;
    }

    if (!passwordFormData.adminPassword) {
      toast({ title: t('error'), description: t('adminPasswordRequired'), variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke('change-user-password', {
        body: {
          targetUserId: changingPasswordUser.id,
          newPassword: passwordFormData.newPassword,
          adminPassword: passwordFormData.adminPassword,
        },
      });

      if (error) throw error;

      toast({ title: t('success'), description: t('passwordChanged') });
      resetPasswordForm();
    } catch (error: any) {
      toast({ 
        title: t('error'), 
        description: error.message || t('failedToChangePassword'), 
        variant: 'destructive' 
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    // Prevent deleting yourself
    if (deletingUser.id === user?.id) {
      toast({ title: 'Error', description: 'You cannot delete your own account', variant: 'destructive' });
      return;
    }

    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: deletingUser.id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({ title: 'Success', description: 'User deleted successfully' });
        fetchUsers();
        setIsDeleteDialogOpen(false);
        setDeletingUser(null);
      } else {
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteUser = (userProfile: UserProfile) => {
    setDeletingUser(userProfile);
    setIsDeleteDialogOpen(true);
  };

  const getApartmentLabel = (apartmentId: string) => {
    const apartment = apartments.find(a => a.id === apartmentId);
    if (!apartment) return 'Unknown';
    const building = buildings.find(b => b.id === apartment.building_id);
    return `${apartment.apartment_number} - ${building?.name || 'Unknown'}`;
  };

  const handleAssignOwner = async (userProfile: UserProfile) => {
    setAssigningOwnerUser(userProfile);
    
    // Fetch apartments where this user is owner
    const { data: ownedApartments, error } = await supabase
      .from('apartments')
      .select('id')
      .eq('owner_id', userProfile.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setSelectedOwnerApartments(ownedApartments?.map(a => a.id) || []);
    setIsOwnerDialogOpen(true);
  };

  const handleAssignBeneficiary = async (userProfile: UserProfile) => {
    setAssigningBeneficiaryUser(userProfile);
    
    // Fetch apartments where this user is beneficiary
    const { data: beneficiaryApartments, error } = await supabase
      .from('apartments')
      .select('id')
      .eq('beneficiary_id', userProfile.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setSelectedBeneficiaryApartments(beneficiaryApartments?.map(a => a.id) || []);
    setIsBeneficiaryDialogOpen(true);
  };

  const handleSaveOwnerAssignments = async () => {
    if (!assigningOwnerUser) return;

    // First, remove this user as owner from all apartments
    await supabase
      .from('apartments')
      .update({ owner_id: null })
      .eq('owner_id', assigningOwnerUser.id);

    // Then, set this user as owner for selected apartments
    if (selectedOwnerApartments.length > 0) {
      const { error } = await supabase
        .from('apartments')
        .update({ owner_id: assigningOwnerUser.id })
        .in('id', selectedOwnerApartments);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Success', description: 'Owner assignments updated successfully' });
    setIsOwnerDialogOpen(false);
    setAssigningOwnerUser(null);
    setSelectedOwnerApartments([]);
  };

  const handleSaveBeneficiaryAssignments = async () => {
    if (!assigningBeneficiaryUser) return;

    // First, remove this user as beneficiary from all apartments
    await supabase
      .from('apartments')
      .update({ beneficiary_id: null })
      .eq('beneficiary_id', assigningBeneficiaryUser.id);

    // Then, set this user as beneficiary for selected apartments
    if (selectedBeneficiaryApartments.length > 0) {
      const { error } = await supabase
        .from('apartments')
        .update({ beneficiary_id: assigningBeneficiaryUser.id })
        .in('id', selectedBeneficiaryApartments);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Success', description: 'Beneficiary assignments updated successfully' });
    setIsBeneficiaryDialogOpen(false);
    setAssigningBeneficiaryUser(null);
    setSelectedBeneficiaryApartments([]);
  };

  const toggleOwnerApartmentSelection = (apartmentId: string) => {
    setSelectedOwnerApartments(prev =>
      prev.includes(apartmentId)
        ? prev.filter(id => id !== apartmentId)
        : [...prev, apartmentId]
    );
  };

  const toggleBeneficiaryApartmentSelection = (apartmentId: string) => {
    setSelectedBeneficiaryApartments(prev =>
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
            <h1 className="text-3xl font-bold">{t('userManagement')}</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              {t('createUser')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              {t('backToDashboard')}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('allUsers')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t('nameLabel')}</TableHead>
                  <TableHead className="text-right">{t('phoneLabel')}</TableHead>
                  <TableHead className="text-right">{t('role')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t('noUsersFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((userProfile) => (
                    <TableRow key={userProfile.id}>
                      <TableCell className="font-medium text-right">{userProfile.name}</TableCell>
                      <TableCell className="text-right">{userProfile.phone || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={userProfile.role === 'admin' ? 'default' : userProfile.role === 'moderator' ? 'outline' : 'secondary'}>
                          {t(userProfile.role as 'admin' | 'moderator' | 'user')}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(userProfile)}
                            title={t('editUser')}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChangePassword(userProfile)}
                            title={t('changePassword')}
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAssignOwner(userProfile)}
                            title={t('assignAsOwner')}
                          >
                            👤
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAssignBeneficiary(userProfile)}
                            title={t('assignAsBeneficiary')}
                          >
                            ⭐
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => confirmDeleteUser(userProfile)}
                            disabled={userProfile.id === user?.id}
                            title={t('deleteUser')}
                          >
                            <Trash2 className="w-4 h-4" />
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
              <DialogTitle>{t('editUser')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t('nameLabel')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">{t('phoneLabel')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">{t('role')}</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'moderator' | 'user' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t('user')}</SelectItem>
                    <SelectItem value="moderator">{t('moderator')}</SelectItem>
                    <SelectItem value="admin">{t('admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveUser} className="flex-1">
                  {t('saveChanges')}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('createNewUser')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="create_email">{t('emailLabel')} *</Label>
                <Input
                  id="create_email"
                  type="email"
                  placeholder="user@example.com"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="create_password">{t('passwordLabel')} *</Label>
                <Input
                  id="create_password"
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  required
                  placeholder={t('minimumCharacters')}
                />
              </div>
              <div>
                <Label htmlFor="create_name">{t('nameLabel')} *</Label>
                <Input
                  id="create_name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="create_phone">{t('phoneLabel')}</Label>
                <Input
                  id="create_phone"
                  value={createFormData.phone}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="create_role">{t('role')}</Label>
                <Select value={createFormData.role} onValueChange={(value) => setCreateFormData({ ...createFormData, role: value as 'admin' | 'moderator' | 'user' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t('user')}</SelectItem>
                    <SelectItem value="moderator">{t('moderator')}</SelectItem>
                    <SelectItem value="admin">{t('admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateUser} className="flex-1" disabled={isCreating}>
                  {isCreating ? t('creating') : t('createUser')}
                </Button>
                <Button variant="outline" onClick={resetCreateForm} disabled={isCreating}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {changingPasswordUser && t('changePasswordFor').replace('{name}', changingPasswordUser.name)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                {t('enterAdminPassword')}
              </div>
              <div>
                <Label htmlFor="admin_password">{t('adminPassword')}</Label>
                <Input
                  id="admin_password"
                  type="password"
                  value={passwordFormData.adminPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, adminPassword: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="new_password">{t('newPassword')}</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordFormData.newPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                  required
                  placeholder={t('minimumCharacters')}
                />
              </div>
              <div>
                <Label htmlFor="confirm_password">{t('confirmPassword')}</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordFormData.confirmPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSavePassword} className="flex-1" disabled={isChangingPassword}>
                  {isChangingPassword ? t('saving') : t('changePassword')}
                </Button>
                <Button variant="outline" onClick={resetPasswordForm} disabled={isChangingPassword}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('areYouSure')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('thisWillPermanentlyDelete')} <strong>{deletingUser?.name}</strong> {t('andAllAssociatedData')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingUser(null)}>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? t('deleting') : t('deleteUser')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Assign as Owner Dialog */}
        <Dialog open={isOwnerDialogOpen} onOpenChange={setIsOwnerDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t('assignAsOwner')} - {assigningOwnerUser?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('selectApartmentsAsOwner')}</p>
              <div className="space-y-2">
                {buildings.map(building => {
                  const buildingApartments = apartments.filter(a => a.building_id === building.id);
                  if (buildingApartments.length === 0) return null;

                  return (
                    <div key={building.id} className="space-y-2">
                      <h3 className="font-semibold text-sm">{building.name}</h3>
                      <div className="grid grid-cols-3 gap-2 pl-4">
                        {buildingApartments.map(apartment => {
                          const isSelected = selectedOwnerApartments.includes(apartment.id);
                          
                          return (
                            <div
                              key={apartment.id}
                              onClick={() => toggleOwnerApartmentSelection(apartment.id)}
                              className={`
                                p-2 rounded border text-sm text-center transition-colors cursor-pointer
                                ${isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background hover:bg-accent border-border'
                                }
                              `}
                            >
                              <div>{apartment.apartment_number}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveOwnerAssignments} className="flex-1">
                  {t('saveAssignments')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsOwnerDialogOpen(false);
                    setAssigningOwnerUser(null);
                    setSelectedOwnerApartments([]);
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign as Beneficiary Dialog */}
        <Dialog open={isBeneficiaryDialogOpen} onOpenChange={setIsBeneficiaryDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t('assignAsBeneficiary')} - {assigningBeneficiaryUser?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('selectApartmentsAsBeneficiary')}</p>
              <div className="space-y-2">
                {buildings.map(building => {
                  const buildingApartments = apartments.filter(a => a.building_id === building.id);
                  if (buildingApartments.length === 0) return null;

                  return (
                    <div key={building.id} className="space-y-2">
                      <h3 className="font-semibold text-sm">{building.name}</h3>
                      <div className="grid grid-cols-3 gap-2 pl-4">
                        {buildingApartments.map(apartment => {
                          const isSelected = selectedBeneficiaryApartments.includes(apartment.id);
                          
                          return (
                            <div
                              key={apartment.id}
                              onClick={() => toggleBeneficiaryApartmentSelection(apartment.id)}
                              className={`
                                p-2 rounded border text-sm text-center transition-colors cursor-pointer
                                ${isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background hover:bg-accent border-border'
                                }
                              `}
                            >
                              <div>{apartment.apartment_number}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveBeneficiaryAssignments} className="flex-1">
                  {t('saveAssignments')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsBeneficiaryDialogOpen(false);
                    setAssigningBeneficiaryUser(null);
                    setSelectedBeneficiaryApartments([]);
                  }}
                >
                  {t('cancel')}
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
