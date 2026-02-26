import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarDays, Plus, Edit, Trash2, Users, CheckSquare, MapPin, Building2, ArrowLeft, X } from 'lucide-react';

interface Building {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
  email?: string;
}

interface Decision {
  id?: string;
  description: string;
  assigneeId: string | null;
  dueDate: string;
  status: string;
}

interface Attendee {
  userId: string;
  attended: boolean;
}

interface Meeting {
  id: string;
  buildingId: string;
  title: string;
  meetingDate: string;
  location: string | null;
  notes: string | null;
  createdAt: string;
}

interface MeetingRow {
  meeting: Meeting;
  buildingName: string;
  attendeeCount: number;
  decisionCount: number;
}

interface MeetingDetail {
  meeting: Meeting;
  buildingName: string;
  attendees: Array<{
    userId: string;
    userName: string;
    attended: boolean;
  }>;
  decisions: Array<{
    id: string;
    description: string;
    assigneeId: string | null;
    assigneeName: string | null;
    dueDate: string | null;
    status: string;
  }>;
}

type ViewMode = 'list' | 'detail' | 'form';

const Meetings = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');

  // Form state
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [formBuildingId, setFormBuildingId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAttendees, setFormAttendees] = useState<string[]>([]);
  const [formDecisions, setFormDecisions] = useState<Decision[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail view state
  const [meetingDetail, setMeetingDetail] = useState<MeetingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const canManage = isAdmin || isModerator;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !canManage) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, isModerator, loading, navigate]);

  useEffect(() => {
    if (user && canManage) {
      fetchMeetings();
      fetchBuildings();
      fetchUsers();
    }
  }, [user, isAdmin, isModerator]);

  const fetchMeetings = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBuildingFilter !== 'all') params.set('buildingId', selectedBuildingFilter);
      const qs = params.toString();
      const data = await api.get<MeetingRow[]>(`/meetings${qs ? `?${qs}` : ''}`);
      setMeetings(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const fetchBuildings = async () => {
    try {
      const data = await api.get<Building[]>('/buildings');
      setBuildings(data || []);
    } catch {
      // silently fail
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.get<UserOption[]>('/users');
      setUsers(data || []);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    if (user && canManage) fetchMeetings();
  }, [selectedBuildingFilter]);

  const fetchMeetingDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const data = await api.get<MeetingDetail>(`/meetings/${id}`);
      setMeetingDetail(data);
      setViewMode('detail');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openCreateForm = () => {
    setEditingMeetingId(null);
    setFormBuildingId('');
    setFormTitle('');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormLocation('');
    setFormNotes('');
    setFormAttendees([]);
    setFormDecisions([]);
    setViewMode('form');
  };

  const openEditForm = async (id: string) => {
    try {
      const data = await api.get<MeetingDetail>(`/meetings/${id}`);
      setEditingMeetingId(id);
      setFormBuildingId(data.meeting.buildingId);
      setFormTitle(data.meeting.title);
      setFormDate(data.meeting.meetingDate);
      setFormLocation(data.meeting.location || '');
      setFormNotes(data.meeting.notes || '');
      setFormAttendees(data.attendees.map(a => a.userId));
      setFormDecisions(data.decisions.map(d => ({
        id: d.id,
        description: d.description,
        assigneeId: d.assigneeId,
        dueDate: d.dueDate || '',
        status: d.status,
      })));
      setViewMode('form');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBuildingId || !formTitle.trim() || !formDate) return;

    setIsSubmitting(true);
    try {
      const payload = {
        buildingId: formBuildingId,
        title: formTitle,
        meetingDate: formDate,
        location: formLocation || null,
        notes: formNotes || null,
        attendees: formAttendees.map(userId => ({ userId, attended: true })),
        decisions: formDecisions
          .filter(d => d.description.trim())
          .map(d => ({
            id: d.id || undefined,
            description: d.description,
            assigneeId: d.assigneeId || null,
            dueDate: d.dueDate || null,
            status: d.status || 'pending',
          })),
      };

      if (editingMeetingId) {
        await api.put(`/meetings/${editingMeetingId}`, payload);
        toast.success(t('meetingUpdated'));
      } else {
        await api.post('/meetings', payload);
        toast.success(t('meetingCreated'));
      }

      fetchMeetings();
      setViewMode('list');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/meetings/${id}`);
      toast.success(t('meetingDeleted'));
      fetchMeetings();
      if (viewMode === 'detail') setViewMode('list');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDecisionStatusUpdate = async (decisionId: string, newStatus: string) => {
    try {
      await api.put(`/meetings/decisions/${decisionId}/status`, { status: newStatus });
      toast.success(t('decisionStatusUpdated'));
      if (meetingDetail) {
        fetchMeetingDetail(meetingDetail.meeting.id);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAttendanceToggle = async (meetingId: string, userId: string, attended: boolean) => {
    try {
      await api.put(`/meetings/${meetingId}`, {
        attendees: meetingDetail?.attendees.map(a =>
          a.userId === userId ? { userId: a.userId, attended } : { userId: a.userId, attended: a.attended }
        ),
      });
      if (meetingDetail) {
        setMeetingDetail({
          ...meetingDetail,
          attendees: meetingDetail.attendees.map(a =>
            a.userId === userId ? { ...a, attended } : a
          ),
        });
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleAttendeeInForm = (userId: string) => {
    setFormAttendees(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const addDecisionRow = () => {
    setFormDecisions(prev => [...prev, { description: '', assigneeId: null, dueDate: '', status: 'pending' }]);
  };

  const removeDecisionRow = (index: number) => {
    setFormDecisions(prev => prev.filter((_, i) => i !== index));
  };

  const updateDecisionRow = (index: number, field: keyof Decision, value: string | null) => {
    setFormDecisions(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const getBuildingName = (buildingId: string) => {
    return buildings.find(b => b.id === buildingId)?.name || t('unknown');
  };

  const getUserName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || t('unknown');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">{t('pending')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">{t('inProgress')}</Badge>;
      case 'completed':
        return <Badge className="bg-green-600 hover:bg-green-700">{t('completed')}</Badge>;
      case 'canceled':
        return <Badge variant="destructive">{t('canceled')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !canManage) return null;

  // Detail view
  if (viewMode === 'detail' && meetingDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
        <div className="container mx-auto px-3 py-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setViewMode('list')}>
                <ArrowLeft className="w-4 h-4 me-1" />
                {t('back')}
              </Button>
              <CalendarDays className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold">{meetingDetail.meeting.title}</h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => openEditForm(meetingDetail.meeting.id)}>
                <Edit className="w-4 h-4 me-2" />
                {t('edit')}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 me-2" />
                    {t('delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('deleteMeetingConfirm')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('deleteMeetingDescription')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(meetingDetail.meeting.id)}>
                      {t('delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Meeting Info */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('building')}:</span>
                  <span className="font-medium">{meetingDetail.buildingName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('meetingDate')}:</span>
                  <span className="font-medium">{formatDate(meetingDetail.meeting.meetingDate)}</span>
                </div>
                {meetingDetail.meeting.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t('meetingLocation')}:</span>
                    <span className="font-medium">{meetingDetail.meeting.location}</span>
                  </div>
                )}
              </div>
              {meetingDetail.meeting.notes && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{meetingDetail.meeting.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendees */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('attendees')} ({meetingDetail.attendees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {meetingDetail.attendees.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t('noAttendeesFound')}</p>
                ) : (
                  meetingDetail.attendees.map((attendee) => (
                    <div key={attendee.userId} className="flex items-center gap-3 p-2 border rounded-lg">
                      <Checkbox
                        checked={attendee.attended}
                        onCheckedChange={(checked) =>
                          handleAttendanceToggle(meetingDetail.meeting.id, attendee.userId, !!checked)
                        }
                      />
                      <span className={attendee.attended ? '' : 'text-muted-foreground line-through'}>
                        {attendee.userName}
                      </span>
                      {attendee.attended && (
                        <Badge variant="outline" className="text-xs">{t('attended')}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Decisions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                {t('decisions')} ({meetingDetail.decisions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meetingDetail.decisions.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('noDecisionsFound')}</p>
              ) : (
                <div className="space-y-3">
                  {meetingDetail.decisions.map((decision) => (
                    <div key={decision.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium flex-1">{decision.description}</p>
                        <Select
                          value={decision.status}
                          onValueChange={(value) => handleDecisionStatusUpdate(decision.id, value)}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{t('pending')}</SelectItem>
                            <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                            <SelectItem value="completed">{t('completed')}</SelectItem>
                            <SelectItem value="canceled">{t('canceled')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {decision.assigneeName && (
                          <span>{t('assignedTo')}: {decision.assigneeName}</span>
                        )}
                        {decision.dueDate && (
                          <span>{t('dueDate')}: {formatDate(decision.dueDate)}</span>
                        )}
                        {getStatusBadge(decision.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Create/Edit form view
  if (viewMode === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
        <div className="container mx-auto px-3 py-4 sm:p-6">
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('list')}>
              <ArrowLeft className="w-4 h-4 me-1" />
              {t('back')}
            </Button>
            <CalendarDays className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">
              {editingMeetingId ? t('editMeeting') : t('addMeeting')}
            </h1>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('building')}</Label>
                    <Select value={formBuildingId} onValueChange={setFormBuildingId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectBuilding')} />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="meetingTitle">{t('meetingTitle')}</Label>
                    <Input
                      id="meetingTitle"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="meetingDate">{t('meetingDate')}</Label>
                    <Input
                      id="meetingDate"
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="meetingLocation">{t('meetingLocation')}</Label>
                    <Input
                      id="meetingLocation"
                      value={formLocation}
                      onChange={e => setFormLocation(e.target.value)}
                      placeholder={t('optional')}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="meetingNotes">{t('meetingNotes')}</Label>
                  <Textarea
                    id="meetingNotes"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    rows={4}
                    placeholder={t('optional')}
                  />
                </div>

                {/* Attendees */}
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('attendees')}
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">{t('selectAttendees')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-2 p-1 cursor-pointer hover:bg-muted/50 rounded">
                        <Checkbox
                          checked={formAttendees.includes(u.id)}
                          onCheckedChange={() => toggleAttendeeInForm(u.id)}
                        />
                        <span className="text-sm">{u.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('selectedCount')}: {formAttendees.length}
                  </p>
                </div>

                {/* Decisions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <CheckSquare className="w-4 h-4" />
                      {t('decisions')}
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={addDecisionRow}>
                      <Plus className="w-4 h-4 me-1" />
                      {t('addDecision')}
                    </Button>
                  </div>

                  {formDecisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('noDecisionsYet')}</p>
                  ) : (
                    <div className="space-y-4">
                      {formDecisions.map((decision, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <Label>{t('decisionDescription')}</Label>
                              <Input
                                value={decision.description}
                                onChange={e => updateDecisionRow(index, 'description', e.target.value)}
                                placeholder={t('decisionDescriptionPlaceholder')}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDecisionRow(index)}
                              className="mt-6"
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <Label>{t('assignedTo')}</Label>
                              <Select
                                value={decision.assigneeId || 'none'}
                                onValueChange={value => updateDecisionRow(index, 'assigneeId', value === 'none' ? null : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('selectAssignee')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t('unassigned')}</SelectItem>
                                  {users.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>{t('dueDate')}</Label>
                              <Input
                                type="date"
                                value={decision.dueDate}
                                onChange={e => updateDecisionRow(index, 'dueDate', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>{t('status')}</Label>
                              <Select
                                value={decision.status}
                                onValueChange={value => updateDecisionRow(index, 'status', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">{t('pending')}</SelectItem>
                                  <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                                  <SelectItem value="completed">{t('completed')}</SelectItem>
                                  <SelectItem value="canceled">{t('canceled')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={isSubmitting || !formBuildingId || !formTitle.trim()}>
                    {isSubmitting ? t('loading') : (editingMeetingId ? t('update') : t('create'))}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setViewMode('list')}>
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // List view (default)
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('meetings')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={selectedBuildingFilter} onValueChange={setSelectedBuildingFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('filterByBuilding')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allBuildings')}</SelectItem>
                {buildings.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreateForm} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 me-2" />
              {t('addMeeting')}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('allMeetings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t('meetingDate')}</TableHead>
                    <TableHead className="text-start">{t('meetingTitle')}</TableHead>
                    <TableHead className="text-start">{t('building')}</TableHead>
                    <TableHead className="text-start">{t('attendees')}</TableHead>
                    <TableHead className="text-start">{t('decisions')}</TableHead>
                    <TableHead className="text-start">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {t('noMeetingsFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    meetings.map((row) => (
                      <TableRow
                        key={row.meeting.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => fetchMeetingDetail(row.meeting.id)}
                      >
                        <TableCell className="text-start">{formatDate(row.meeting.meetingDate)}</TableCell>
                        <TableCell className="text-start font-medium">{row.meeting.title}</TableCell>
                        <TableCell className="text-start">{row.buildingName}</TableCell>
                        <TableCell className="text-start">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            {row.attendeeCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex items-center gap-1">
                            <CheckSquare className="w-4 h-4 text-muted-foreground" />
                            {row.decisionCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditForm(row.meeting.id)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('deleteMeetingConfirm')}</AlertDialogTitle>
                                  <AlertDialogDescription>{t('deleteMeetingDescription')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(row.meeting.id)}>
                                    {t('delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Meetings;
