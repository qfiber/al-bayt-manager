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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { usePaginatedSearch } from '@/hooks/use-paginated-search';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Pencil, Trash2, Users, UserPlus } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
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
  const [formData, setFormData] = useState({ name: '', slug: '' });

  // Members dialog
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', role: 'user' });

  const { search, setSearch, paginated, page, hasPrevious, hasNext, onPrevious, onNext } = usePaginatedSearch({
    items: orgs,
    searchFields: ['name', 'slug'] as (keyof Organization)[],
  });

  useEffect(() => {
    if (user && isSuperAdmin) fetchOrgs();
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
    try {
      if (editingOrg) {
        await api.put(`/organizations/${editingOrg.id}`, formData);
        toast({ title: t('success'), description: t('organizationUpdated') });
      } else {
        await api.post('/organizations', formData);
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
    setFormData({ name: org.name, slug: org.slug });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '' });
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
    if (!selectedOrg || !addMemberForm.userId) return;
    try {
      await api.post(`/organizations/${selectedOrg.id}/members`, addMemberForm);
      toast({ title: t('success'), description: t('memberAdded') });
      const data = await api.get<OrgMember[]>(`/organizations/${selectedOrg.id}/members`);
      setMembers(data || []);
      setAddMemberForm({ userId: '', role: 'user' });
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

  const autoSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData({
                          name,
                          slug: editingOrg ? formData.slug : autoSlug(name),
                        });
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="orgSlug">{t('organizationSlug')}</Label>
                    <Input
                      id="orgSlug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      required
                      pattern="^[a-z0-9-]+$"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('slugHelp')}</p>
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
                  <TableHead className="text-start">{t('organizationSlug')}</TableHead>
                  <TableHead className="text-start">{t('status')}</TableHead>
                  <TableHead className="text-start">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableEmptyRow colSpan={4} message={t('noOrganizationsFound')} />
                ) : (
                  paginated.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium text-start">{org.name}</TableCell>
                      <TableCell className="text-start font-mono text-sm">{org.slug}</TableCell>
                      <TableCell className="text-start">
                        <Badge variant={org.isActive ? 'default' : 'secondary'}>
                          {org.isActive ? t('active') : t('inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-start">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => showMembers(org)} title={t('members')}>
                            <Users className="w-4 h-4" />
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
                  <Label>{t('userId')}</Label>
                  <Input
                    value={addMemberForm.userId}
                    onChange={(e) => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
                    placeholder="user UUID"
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
                          <Button size="sm" variant="destructive" onClick={() => handleRemoveMember(member.userId)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Organizations;
