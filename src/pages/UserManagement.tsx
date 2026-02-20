import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Pencil, Trash2, UserPlus, Key, Building2, ShieldOff } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface UserProfile {
  id: string;
  name: string;
  phone: string | null;
  email?: string;
  role?: string;
  has2FA?: boolean;
}

interface Apartment {
  id: string;
  apartmentNumber: string;
  buildingId: string;
}

interface Building {
  id: string;
  name: string;
}

interface ApiUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  preferredLanguage: string | null;
  role: string;
  createdAt: string;
}

interface TwoFAStatusEntry {
  id: string;
  email: string;
  name: string;
  totpStatus: 'none' | 'unverified' | 'verified';
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

  const [isBuildingsDialogOpen, setIsBuildingsDialogOpen] = useState(false);
  const [assigningBuildingsUser, setAssigningBuildingsUser] = useState<UserProfile | null>(null);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [moderatorBuildings, setModeratorBuildings] = useState<Map<string, string[]>>(new Map());

  const [isDisable2FADialogOpen, setIsDisable2FADialogOpen] = useState(false);
  const [disable2FAUser, setDisable2FAUser] = useState<UserProfile | null>(null);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  const [users2FAStatus, setUsers2FAStatus] = useState<Map<string, boolean>>(new Map());

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
      fetchUsers2FAStatus();
    }
  }, [user, isAdmin]);

  const fetchUsers2FAStatus = async () => {
    try {
      const data = await api.get<TwoFAStatusEntry[]>('/users/2fa-status');

      const statusMap = new Map<string, boolean>();
      data.forEach((entry) => {
        statusMap.set(entry.id, entry.totpStatus === 'verified');
      });
      setUsers2FAStatus(statusMap);
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
    }
  };

  const fetchBuildings = async () => {
    try {
      const data = await api.get<Building[]>('/buildings');
      setBuildings(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const fetchApartments = async () => {
    try {
      const data = await api.get<Apartment[]>('/apartments');
      setApartments(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.get<ApiUser[]>('/users');

      const usersWithDetails: UserProfile[] = (data || []).map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role || 'user',
      }));

      setUsers(usersWithDetails);

      // Fetch moderator building assignments
      fetchModeratorBuildings(usersWithDetails);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const fetchModeratorBuildings = async (usersList?: UserProfile[]) => {
    const moderators = (usersList || users).filter((u) => u.role === 'moderator');
    const buildingsMap = new Map<string, string[]>();

    try {
      await Promise.all(
        moderators.map(async (mod) => {
          try {
            const userData = await api.get<{ buildingAssignments?: string[] }>(`/users/${mod.id}`);
            if (userData.buildingAssignments && userData.buildingAssignments.length > 0) {
              buildingsMap.set(mod.id, userData.buildingAssignments);
            }
          } catch {
            // Ignore errors for individual moderators
          }
        })
      );
    } catch {
      // Ignore errors
    }

    setModeratorBuildings(buildingsMap);
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

    try {
      // Update profile and role in a single API call
      await api.put(`/users/${editingUser.id}`, {
        name: formData.name,
        phone: formData.phone || null,
        role: formData.role,
      });

      toast({ title: 'Success', description: 'User updated successfully' });
      fetchUsers();
      resetForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateUser = async () => {
    if (!createFormData.email || !createFormData.password || !createFormData.name) {
      toast({ title: 'Error', description: 'Email, password, and name are required', variant: 'destructive' });
      return;
    }

    setIsCreating(true);

    try {
      await api.post('/users', {
        email: createFormData.email,
        password: createFormData.password,
        name: createFormData.name,
        phone: createFormData.phone || null,
        role: createFormData.role,
      });

      toast({ title: 'Success', description: 'User created successfully' });
      fetchUsers();
      resetCreateForm();
    } catch (error: any) {
      console.error('Create user error:', error);

      const errorMessage = error.message || 'Failed to create user';

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
      await api.post(`/users/${changingPasswordUser.id}/change-password`, {
        newPassword: passwordFormData.newPassword,
        adminPassword: passwordFormData.adminPassword,
      });

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
      await api.delete(`/users/${deletingUser.id}`);

      toast({ title: 'Success', description: 'User deleted successfully' });
      fetchUsers();
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
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
    const building = buildings.find(b => b.id === apartment.buildingId);
    return `${apartment.apartmentNumber} - ${building?.name || 'Unknown'}`;
  };

  const handleAssignOwner = async (userProfile: UserProfile) => {
    setAssigningOwnerUser(userProfile);

    try {
      // Fetch user details to get current owner assignments
      const userData = await api.get<{ ownerAssignments?: string[] }>(`/users/${userProfile.id}`);
      setSelectedOwnerApartments(userData.ownerAssignments || []);
      setIsOwnerDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAssignBeneficiary = async (userProfile: UserProfile) => {
    setAssigningBeneficiaryUser(userProfile);

    try {
      // Fetch user details to get current beneficiary assignments
      const userData = await api.get<{ beneficiaryAssignments?: string[] }>(`/users/${userProfile.id}`);
      setSelectedBeneficiaryApartments(userData.beneficiaryAssignments || []);
      setIsBeneficiaryDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveOwnerAssignments = async () => {
    if (!assigningOwnerUser) return;

    try {
      await api.put(`/users/${assigningOwnerUser.id}/owner-assignments`, {
        ids: selectedOwnerApartments,
      });

      toast({ title: 'Success', description: 'Owner assignments updated successfully' });
      setIsOwnerDialogOpen(false);
      setAssigningOwnerUser(null);
      setSelectedOwnerApartments([]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveBeneficiaryAssignments = async () => {
    if (!assigningBeneficiaryUser) return;

    try {
      await api.put(`/users/${assigningBeneficiaryUser.id}/beneficiary-assignments`, {
        ids: selectedBeneficiaryApartments,
      });

      toast({ title: 'Success', description: 'Beneficiary assignments updated successfully' });
      setIsBeneficiaryDialogOpen(false);
      setAssigningBeneficiaryUser(null);
      setSelectedBeneficiaryApartments([]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
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

  const handleAssignBuildings = async (userProfile: UserProfile) => {
    // Only allow assigning buildings to moderators
    if (userProfile.role !== 'moderator') {
      toast({
        title: 'Error',
        description: 'Buildings can only be assigned to moderators',
        variant: 'destructive'
      });
      return;
    }

    setAssigningBuildingsUser(userProfile);

    try {
      // Fetch user details to get current building assignments
      const userData = await api.get<{ buildingAssignments?: string[] }>(`/users/${userProfile.id}`);
      setSelectedBuildings(userData.buildingAssignments || []);
      setIsBuildingsDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveBuildingAssignments = async () => {
    if (!assigningBuildingsUser) return;

    try {
      await api.put(`/users/${assigningBuildingsUser.id}/building-assignments`, {
        ids: selectedBuildings,
      });

      toast({ title: 'Success', description: 'Building assignments updated successfully' });
      fetchModeratorBuildings();
      setIsBuildingsDialogOpen(false);
      setAssigningBuildingsUser(null);
      setSelectedBuildings([]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleBuildingSelection = (buildingId: string) => {
    setSelectedBuildings(prev =>
      prev.includes(buildingId)
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    );
  };

  const handleDisable2FA = (userProfile: UserProfile) => {
    // Only allow for users and moderators, not admins
    if (userProfile.role === 'admin') {
      toast({
        title: t('error'),
        description: 'Cannot disable 2FA for admin users',
        variant: 'destructive'
      });
      return;
    }
    setDisable2FAUser(userProfile);
    setIsDisable2FADialogOpen(true);
  };

  const confirmDisable2FA = async () => {
    if (!disable2FAUser) return;

    setIsDisabling2FA(true);

    try {
      await api.post(`/users/${disable2FAUser.id}/disable-2fa`);

      toast({ title: t('success'), description: t('twoFactorDisabledForUser') });
      // Refresh 2FA status after disabling
      fetchUsers2FAStatus();
    } catch (error: any) {
      const errorMessage = error.message || t('failedToDisable2FAForUser');
      // Check if user doesn't have 2FA
      if (errorMessage.includes('does not have 2FA')) {
        toast({ title: t('error'), description: t('userHasNo2FA'), variant: 'destructive' });
      } else {
        toast({ title: t('error'), description: errorMessage, variant: 'destructive' });
      }
    } finally {
      setIsDisabling2FA(false);
      setIsDisable2FADialogOpen(false);
      setDisable2FAUser(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('userManagement')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto">
              <UserPlus className="w-4 h-4 mr-2" />
              {t('createUser')}
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
                  <TableHead className="text-right">{t('assignedBuildings')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                        {userProfile.role === 'moderator' ? (
                          moderatorBuildings.get(userProfile.id) && moderatorBuildings.get(userProfile.id)!.length > 0 ? (
                            <div className="flex flex-wrap gap-1 justify-end">
                              {moderatorBuildings.get(userProfile.id)!.slice(0, 2).map(buildingId => (
                                <Badge key={buildingId} variant="outline" className="text-xs">
                                  {buildings.find(b => b.id === buildingId)?.name || t('unknown')}
                                </Badge>
                              ))}
                              {moderatorBuildings.get(userProfile.id)!.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{moderatorBuildings.get(userProfile.id)!.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">{t('noBuildings')}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
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
                          {userProfile.role === 'moderator' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAssignBuildings(userProfile)}
                              title={t('assignBuildings')}
                            >
                              <Building2 className="w-4 h-4" />
                            </Button>
                          )}
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
                          {userProfile.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDisable2FA(userProfile)}
                              title={users2FAStatus.get(userProfile.id) ? t('adminDisable2FA') : t('userHasNo2FA')}
                              disabled={!users2FAStatus.get(userProfile.id)}
                              className={!users2FAStatus.get(userProfile.id) ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                              <ShieldOff className="w-4 h-4" />
                            </Button>
                          )}
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
                  const buildingApartments = apartments.filter(a => a.buildingId === building.id);
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
                              <div>{apartment.apartmentNumber}</div>
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

        {/* Assign Buildings to Moderator Dialog */}
        <Dialog open={isBuildingsDialogOpen} onOpenChange={setIsBuildingsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t('assignBuildingsToModerator')} - {assigningBuildingsUser?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('selectBuildingsForModerator')}</p>
              <div className="space-y-2">
                {buildings.length === 0 ? (
                  <p className="text-center text-muted-foreground">{t('noBuildingsFound')}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {buildings.map(building => {
                      const isSelected = selectedBuildings.includes(building.id);

                      return (
                        <div
                          key={building.id}
                          onClick={() => toggleBuildingSelection(building.id)}
                          className={`
                            p-3 rounded border text-sm text-center transition-colors cursor-pointer
                            ${isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-accent border-border'
                            }
                          `}
                        >
                          <div className="font-medium">{building.name}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveBuildingAssignments} className="flex-1">
                  {t('saveAssignments')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsBuildingsDialogOpen(false);
                    setAssigningBuildingsUser(null);
                    setSelectedBuildings([]);
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
                  const buildingApartments = apartments.filter(a => a.buildingId === building.id);
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
                              <div>{apartment.apartmentNumber}</div>
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

        {/* Disable 2FA Confirmation Dialog */}
        <AlertDialog open={isDisable2FADialogOpen} onOpenChange={setIsDisable2FADialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('adminDisable2FA')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('adminDisable2FAConfirm')}
                <br />
                <strong>{disable2FAUser?.name}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDisabling2FA}>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDisable2FA}
                disabled={isDisabling2FA}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDisabling2FA ? t('disabling') : t('adminDisable2FA')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default UserManagement;
