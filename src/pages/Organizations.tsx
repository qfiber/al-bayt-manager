import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { usePaginatedSearch } from '@/hooks/use-paginated-search';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Pencil, Trash2, Users, UserPlus, LogIn, X, Check, CreditCard } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  subdomain: string | null;
  defaultLanguage: string;
  maxBuildings: number;
  maxApartments: number;
  onlinePaymentsEnabled: boolean;
  isActive: boolean;
  createdAt: string;
}

interface OrgMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

const Organizations = () => {
  useRequireAuth('admin');
  const { user, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({ name: '', subdomain: '', defaultLanguage: 'ar', maxBuildings: '0', maxApartments: '0', onlinePaymentsEnabled: false });

  // Members dialog
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [addMemberForm, setAddMemberForm] = useState({ email: '', role: 'org_admin' });

  // Plan assignment
  const [plans, setPlans] = useState<any[]>([]);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planOrgId, setPlanOrgId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('monthly');

  const { search, setSearch, paginated, page, hasPrevious, hasNext, onPrevious, onNext } = usePaginatedSearch({
    items: orgs,
    searchFields: ['name'] as (keyof Organization)[],
  });

  useEffect(() => {
    if (user && isSuperAdmin) {
      fetchOrgs();
      api.get('/subscriptions/plans').then(setPlans).catch(() => {});
    }
  }, [user, isSuperAdmin]);

  const fetchOrgs = async () => {
    try {
      const data = await api.get<Organization[]>('/organizations');
      setOrgs(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      subdomain: formData.subdomain || null,
      defaultLanguage: formData.defaultLanguage,
      maxBuildings: parseInt(formData.maxBuildings) || 0,
      maxApartments: parseInt(formData.maxApartments) || 0,
      onlinePaymentsEnabled: formData.onlinePaymentsEnabled,
    };
    try {
      if (editingOrg) {
        await api.put(`/organizations/${editingOrg.id}`, payload);
        toast({ title: t('success'), description: t('organizationUpdated') });
      } else {
        await api.post('/organizations', payload);
        toast({ title: t('success'), description: t('organizationCreated') });
      }
      fetchOrgs();
      resetForm();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteOrganizationConfirm'))) return;
    try {
      await api.delete(`/organizations/${id}`);
      toast({ title: t('success'), description: t('organizationDeleted') });
      fetchOrgs();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      subdomain: org.subdomain || '',
      defaultLanguage: org.defaultLanguage || 'ar',
      maxBuildings: String(org.maxBuildings ?? 0),
      maxApartments: String(org.maxApartments ?? 0),
      onlinePaymentsEnabled: org.onlinePaymentsEnabled ?? false,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', subdomain: '', defaultLanguage: 'ar', maxBuildings: '0', maxApartments: '0', onlinePaymentsEnabled: false });
    setEditingOrg(null);
    setIsDialogOpen(false);
  };

  const showMembers = async (org: Organization) => {
    setSelectedOrg(org);
    try {
      const data = await api.get<OrgMember[]>(`/organizations/${org.id}/members`);
      setMembers(data || []);
      setMembersDialogOpen(true);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleAddMember = async () => {
    if (!selectedOrg || !addMemberForm.email) return;
    try {
      await api.post(`/organizations/${selectedOrg.id}/members`, addMemberForm);
      toast({ title: t('success'), description: t('memberAdded') });
      const data = await api.get<OrgMember[]>(`/organizations/${selectedOrg.id}/members`);
      setMembers(data || []);
      setAddMemberForm({ email: '', role: 'org_admin' });
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      await api.post(`/organizations/impersonate/${userId}`);
      // Force full page reload to pick up new auth cookies
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedOrg) return;
    try {
      await api.delete(`/organizations/${selectedOrg.id}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.userId !== userId));
      toast({ title: t('success'), description: t('memberRemoved') });
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  if (!user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('organizations')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <SearchInput value={search} onChange={setSearch} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 me-2" />
                  {t('createOrganization')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingOrg ? t('editOrganization') : t('createOrganization')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="orgName">{t('organizationName')}</Label>
                    <Input
                      id="orgName"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>{t('subdomain')}</Label>
                    <Input
                      value={formData.subdomain}
                      onChange={(e) => setFormData({...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                      placeholder="acme-properties"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('subdomainHelp')}</p>
                  </div>
                  <div>
                    <Label>{t('defaultLanguage')}</Label>
                    <Select value={formData.defaultLanguage} onValueChange={(v) => setFormData({...formData, defaultLanguage: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="he">עברית</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t('maxBuildings')}</Label>
                      <Input type="number" min="0" value={formData.maxBuildings} onChange={(e) => setFormData({...formData, maxBuildings: e.target.value})} placeholder="0 = unlimited" />
                    </div>
                    <div>
                      <Label>{t('maxApartments')}</Label>
                      <Input type="number" min="0" value={formData.maxApartments} onChange={(e) => setFormData({...formData, maxApartments: e.target.value})} placeholder="0 = unlimited" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('limitZeroUnlimited')}</p>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <Label>{t('onlinePayments')}</Label>
                      <p className="text-xs text-muted-foreground">{t('onlinePaymentsDesc')}</p>
                    </div>
                    <Switch
                      checked={formData.onlinePaymentsEnabled}
                      onCheckedChange={(checked) => setFormData({...formData, onlinePaymentsEnabled: checked})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingOrg ? t('update') : t('create')}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      {t('cancel')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('allOrganizations')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('nameLabel')}</TableHead>
                  <TableHead className="text-start">{t('subdomain')}</TableHead>
                  <TableHead className="text-start">{t('language')}</TableHead>
                  <TableHead className="text-start">{t('maxBuildings')}</TableHead>
                  <TableHead className="text-start">{t('maxApartments')}</TableHead>
                  <TableHead className="text-start">{t('status')}</TableHead>
                  <TableHead className="text-start">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableEmptyRow colSpan={7} message={t('noOrganizationsFound')} />
                ) : (
                  paginated.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium text-start">{org.name}</TableCell>
                      <TableCell className="text-start text-muted-foreground text-sm">
                        {org.subdomain ? `${org.subdomain}.domain.com` : '-'}
                      </TableCell>
                      <TableCell className="text-start">
                        {org.defaultLanguage === 'ar' ? 'العربية' : org.defaultLanguage === 'he' ? 'עברית' : 'English'}
                      </TableCell>
                      <TableCell className="text-start">{org.maxBuildings === 0 ? '∞' : org.maxBuildings}</TableCell>
                      <TableCell className="text-start">{org.maxApartments === 0 ? '∞' : org.maxApartments}</TableCell>
                      <TableCell className="text-start">
                        <Badge variant={org.isActive ? 'default' : 'secondary'}>
                          {org.isActive ? t('active') : t('inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-start">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setPlanOrgId(org.id); setPlanDialogOpen(true); }} title={t('changePlan')}>
                            <CreditCard className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setAddMemberForm({ email: '', role: 'org_admin' });
                            showMembers(org);
                          }} title={t('assignLandlord')}>
                            <UserPlus className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => showMembers(org)} title={t('members')}>
                            <Users className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={org.isActive ? 'outline' : 'default'}
                            onClick={async () => {
                              try {
                                await api.post(`/organizations/${org.id}/toggle-status`);
                                toast({ title: t('success'), description: org.isActive ? t('organizationSuspended') : t('organizationReactivated') });
                                fetchOrgs();
                              } catch (err: any) {
                                toast({ title: t('error'), description: err.message, variant: 'destructive' });
                              }
                            }}
                            title={org.isActive ? t('suspend') : t('reactivate')}
                          >
                            {org.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(org)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(org.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls page={page} hasPrevious={hasPrevious} hasNext={hasNext} onPrevious={onPrevious} onNext={onNext} />
          </CardContent>
        </Card>

        {/* Members Dialog */}
        <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('members')} — {selectedOrg?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Add member */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>{t('email')}</Label>
                  <Input
                    type="email"
                    value={addMemberForm.email}
                    onChange={(e) => setAddMemberForm({ ...addMemberForm, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="w-32">
                  <Label>{t('role')}</Label>
                  <Select value={addMemberForm.role} onValueChange={(v) => setAddMemberForm({ ...addMemberForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org_admin">{t('orgAdmin')}</SelectItem>
                      <SelectItem value="moderator">{t('moderator')}</SelectItem>
                      <SelectItem value="user">{t('user')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddMember}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>

              {/* Members list */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('nameLabel')}</TableHead>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead>{t('role')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableEmptyRow colSpan={4} message={t('noMembers')} />
                  ) : (
                    members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.name || '-'}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{member.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleImpersonate(member.userId)} title={t('loginAs')}>
                              <LogIn className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleRemoveMember(member.userId)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Plan Assignment Dialog */}
        <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('assignPlan')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('plan')}</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger><SelectValue placeholder={t('selectPlan')} /></SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => p.isActive).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.maxBuildings} {t('buildings')}, {p.maxApartmentsPerBuilding} {t('maxApartmentsPerBuilding')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('billingCycle')}</Label>
                <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t('monthly')}</SelectItem>
                    <SelectItem value="semi_annual">{t('semiAnnual')}</SelectItem>
                    <SelectItem value="yearly">{t('yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={async () => {
                try {
                  await api.post('/subscriptions/assign', { organizationId: planOrgId, planId: selectedPlanId, billingCycle: selectedCycle });
                  toast({ title: t('success'), description: t('planAssigned') });
                  setPlanDialogOpen(false);
                  fetchOrgs();
                } catch (err: any) {
                  toast({ title: t('error'), description: err.message, variant: 'destructive' });
                }
              }}>{t('assignPlan')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Organizations;
