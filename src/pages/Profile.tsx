import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User,
  Lock,
  Mail,
  Phone,
  Pencil,
  Camera,
  Building2,
  Home,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ApartmentData {
  apartment: {
    id: string;
    apartmentNumber: string;
    status: string;
    occupancyStart: string | null;
    subscriptionAmount: string;
    subscriptionStatus: string;
    cachedBalance: string;
    buildingId: string;
  };
  buildingName: string;
  buildingAddress: string;
}

interface IssueRow {
  issue: {
    id: string;
    buildingId: string;
    reporterId: string;
    floor: number | null;
    category: string;
    description: string;
    status: string;
    resolvedAt: string | null;
    createdAt: string;
  };
  buildingName: string;
  reporterName: string;
}

const Profile = () => {
  const { user, loading, refreshUser } = useAuth();
  const { t } = useLanguage();
  const { currencySymbol, formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phone edit state
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Email change state (two-step OTP)
  const [emailChangeStep, setEmailChangeStep] = useState<'request' | 'confirm'>('request');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSessionToken, setEmailSessionToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Apartments & issues
  const [apartments, setApartments] = useState<any[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      setPhoneValue(user.phone || '');
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const [aptData, issueData] = await Promise.allSettled([
        api.get<ApartmentData[]>('/my-apartments'),
        api.get<IssueRow[]>('/issues'),
      ]);

      // Process apartments with debt details (auto-scoped to active occupancy period)
      if (aptData.status === 'fulfilled' && aptData.value?.length > 0) {
        const withDetails = await Promise.all(
          aptData.value.map(async (item) => {
            try {
              // Default period scoping (current period) applied by backend
              const details = await api.get(`/apartments/${item.apartment.id}/debt-details`);
              return {
                ...item.apartment,
                buildingName: item.buildingName,
                buildingAddress: item.buildingAddress,
                payments: details.payments || [],
                expenses: details.expenses || [],
                balance: details.balance,
              };
            } catch {
              return {
                ...item.apartment,
                buildingName: item.buildingName,
                buildingAddress: item.buildingAddress,
                payments: [],
                expenses: [],
                balance: parseFloat(item.apartment.cachedBalance),
              };
            }
          }),
        );
        setApartments(withDetails);
      } else {
        setApartments([]);
      }

      // Filter issues to only user's own
      if (issueData.status === 'fulfilled') {
        setIssues(
          (issueData.value || []).filter((row) => row.issue.reporterId === user!.id),
        );
      } else {
        setIssues([]);
      }
    } finally {
      setDataLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const { url } = await api.upload<{ url: string }>('/upload/avatar', file);
      await api.put('/auth/profile', { avatarUrl: url });
      await refreshUser();
      toast.success(t('profileUpdated'));
    } catch {
      toast.error(t('error'));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSavePhone = async () => {
    setSavingPhone(true);
    try {
      await api.put('/auth/profile', { phone: phoneValue });
      await refreshUser();
      setEditingPhone(false);
      toast.success(t('profileUpdated'));
    } catch {
      toast.error(t('error'));
    } finally {
      setSavingPhone(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('passwordChanged'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error(t('wrongPassword'));
      } else {
        toast.error(t('error'));
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const result = await api.post<{ sessionToken: string }>('/auth/request-email-change', {
        newEmail,
        currentPassword: emailPassword,
      });
      setEmailSessionToken(result.sessionToken);
      setEmailChangeStep('confirm');
      toast.success(t('otpSentToCurrentEmail'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error(t('wrongPassword'));
      } else if (err instanceof ApiError && err.status === 409) {
        toast.error(t('emailAlreadyInUse'));
      } else {
        toast.error(t('error'));
      }
    } finally {
      setSavingEmail(false);
    }
  };

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      await api.put('/auth/confirm-email-change', {
        sessionToken: emailSessionToken,
        otp: otpCode,
        totpCode: totpCode || undefined,
      });
      await refreshUser();
      setNewEmail('');
      setEmailPassword('');
      setOtpCode('');
      setTotpCode('');
      setEmailSessionToken('');
      setEmailChangeStep('request');
      toast.success(t('emailChanged'));
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = (err as any).message || '';
        if (msg.includes('OTP') || msg.includes('otp')) {
          toast.error(t('invalidOtp'));
        } else if (msg.includes('TOTP') || msg.includes('totp')) {
          toast.error(t('totpCodeRequired'));
        } else if (msg.includes('expired')) {
          toast.error(t('emailChangeExpired'));
        } else if (msg.includes('Too many')) {
          toast.error(t('tooManyOtpAttempts'));
        } else {
          toast.error(t('error'));
        }
      } else {
        toast.error(t('error'));
      }
    } finally {
      setSavingEmail(false);
    }
  };

  const getTotalPaid = (payments: any[]) =>
    payments.filter((p: any) => !p.isCanceled).reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'destructive';
      case 'in_progress': return 'default';
      case 'resolved': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user) return null;

  return (
    <div className="container mx-auto px-3 py-4 sm:p-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">{t('profile')}</h1>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('profileInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative group"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || ''}
                  className="h-20 w-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold border-2 border-border">
                  {(user.name || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <Camera className="h-4 w-4 me-2" />
                {uploadingAvatar ? t('saving') : t('changePhoto')}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Read-only fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                {t('name')}
                <span className="text-xs text-muted-foreground">({t('readOnly')})</span>
              </Label>
              <p className="font-medium">{user.name || '—'}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {t('email')}
              </Label>
              <p className="font-medium">{user.email}</p>
            </div>

            {apartments.length > 0 && (
              <>
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    {t('buildings')}
                    <span className="text-xs text-muted-foreground">({t('readOnly')})</span>
                  </Label>
                  <p className="font-medium">
                    {[...new Set(apartments.map((a) => a.buildingName))].join(', ')}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    {t('apartments')}
                    <span className="text-xs text-muted-foreground">({t('readOnly')})</span>
                  </Label>
                  <p className="font-medium">
                    {apartments.map((a) => a.apartmentNumber).join(', ')}
                  </p>
                </div>
              </>
            )}

            {/* Editable phone */}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {t('phone')}
              </Label>
              {editingPhone ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    className="max-w-xs"
                    dir="ltr"
                  />
                  <Button size="icon" variant="ghost" onClick={handleSavePhone} disabled={savingPhone}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingPhone(false);
                      setPhoneValue(user.phone || '');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-medium" dir="ltr">{user.phone || '—'}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingPhone(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('changePassword')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>{t('currentPassword')}</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('newPassword')}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('confirmPassword')}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                dir="ltr"
              />
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? t('saving') : t('changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('changeEmail')}
          </CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          {emailChangeStep === 'request' ? (
            <form onSubmit={handleRequestEmailChange} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>{t('newEmail')}</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('currentPassword')}</Label>
                <Input
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              <Button type="submit" disabled={savingEmail}>
                {savingEmail ? t('saving') : t('requestEmailChange')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleConfirmEmailChange} className="space-y-4 max-w-md">
              <p className="text-sm text-muted-foreground">{t('otpSentToCurrentEmail')}</p>
              <div className="space-y-2">
                <Label>{t('otpCodeLabel')}</Label>
                <Input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  placeholder="000000"
                  dir="ltr"
                  className="tracking-widest text-center text-lg"
                />
              </div>
              {user.totpFactors?.some((f: any) => f.status === 'verified') && (
                <div className="space-y-2">
                  <Label>{t('totpCodeRequired')}</Label>
                  <Input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    placeholder="000000"
                    dir="ltr"
                    className="tracking-widest text-center text-lg"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={savingEmail}>
                  {savingEmail ? t('saving') : t('confirmEmailChange')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEmailChangeStep('request');
                    setOtpCode('');
                    setTotpCode('');
                    setEmailSessionToken('');
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* My Apartments & Expenses */}
      {dataLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('loading')}
          </CardContent>
        </Card>
      ) : apartments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              {t('myExpenses')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {apartments.map((apartment) => {
              const balance = typeof apartment.balance === 'number'
                ? apartment.balance
                : parseFloat(apartment.cachedBalance);
              const subscriptionAmount = parseFloat(apartment.subscriptionAmount || '0');

              return (
                <div key={apartment.id} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{apartment.buildingName}</span>
                    <span className="text-muted-foreground">—</span>
                    <span>{t('apartments')} {apartment.apartmentNumber}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">{t('status')}</p>
                      <p className="font-medium capitalize">{apartment.status}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">{t('monthlySubscription').replace('{currency}', currencySymbol)}</p>
                      <p className="font-medium">{formatCurrency(subscriptionAmount)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">{t('totalPaid')}</p>
                      <p className="font-medium text-green-600">{formatCurrency(getTotalPaid(apartment.payments))}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">{t('balance')}</p>
                      <p className={`font-medium ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : ''}`}>
                        {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>

                  {(apartment.payments.length > 0 || apartment.expenses.length > 0) && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('date')}</TableHead>
                          <TableHead>{t('description')}</TableHead>
                          <TableHead>{t('type')}</TableHead>
                          <TableHead className="text-start">{t('amount')} ({currencySymbol})</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          ...apartment.payments.map((p: any) => ({
                            id: p.id,
                            date: p.createdAt,
                            description: `${t('payments')} ${p.month}`,
                            type: 'payment' as const,
                            amount: parseFloat(p.amount),
                            isCanceled: p.isCanceled,
                          })),
                          ...apartment.expenses.map((ae: any) => ({
                            id: ae.id,
                            date: ae.createdAt,
                            description: ae.expenseDescription || t('expenses'),
                            type: 'expense' as const,
                            amount: parseFloat(ae.amount),
                            isCanceled: ae.isCanceled,
                          })),
                        ]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell>{formatDate(tx.date)}</TableCell>
                              <TableCell>
                                {tx.description}
                                {tx.isCanceled && (
                                  <span className="ms-2 text-xs text-muted-foreground">({t('canceled')})</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    tx.type === 'payment'
                                      ? 'bg-green-100 text-green-800'
                                      : tx.isCanceled
                                      ? 'bg-gray-100 text-gray-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {tx.type === 'payment' ? t('payments') : t('expenses')}
                                </span>
                              </TableCell>
                              <TableCell
                                className={`text-start font-medium ${
                                  tx.type === 'payment' ? 'text-green-600' : tx.isCanceled ? 'text-gray-600' : 'text-red-600'
                                }`}
                              >
                                {tx.type === 'payment' ? '+' : '-'}{formatCurrency(tx.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* My Reported Issues */}
      {!dataLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('myIssues')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">{t('noIssuesReported')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('buildings')}</TableHead>
                    <TableHead>{t('category')}</TableHead>
                    <TableHead>{t('description')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues
                    .sort((a, b) => new Date(b.issue.createdAt).getTime() - new Date(a.issue.createdAt).getTime())
                    .map((row) => (
                      <TableRow key={row.issue.id}>
                        <TableCell>{formatDate(row.issue.createdAt)}</TableCell>
                        <TableCell>{row.buildingName}</TableCell>
                        <TableCell className="capitalize">{row.issue.category.replace('_', ' ')}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.issue.description}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(row.issue.status)}>
                            {row.issue.status === 'in_progress' ? t('inProgress') : t(row.issue.status as any)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Profile;
