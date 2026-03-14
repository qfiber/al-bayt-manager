import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Plus, Send } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface MessageRow {
  message: {
    id: string;
    subject: string;
    body: string;
    isRead: boolean;
    parentId: string | null;
    senderId: string;
    createdAt: string;
  };
  senderEmail: string;
  senderName: string | null;
}

const Messages = () => {
  useRequireAuth();
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  const fetchMessages = async () => {
    try {
      const data = await api.get<MessageRow[]>('/messages');
      setMessages(data || []);
    } catch {} finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    try {
      await api.post('/messages', { subject, body, parentId: replyTo || undefined });
      toast({ title: t('success'), description: t('messageSent') });
      setSubject('');
      setBody('');
      setReplyTo(null);
      setIsDialogOpen(false);
      fetchMessages();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkRead = async (id: string) => {
    await api.put(`/messages/${id}/read`).catch(() => {});
    setMessages(prev => prev.map(m => m.message.id === id ? { ...m, message: { ...m.message, isRead: true } } : m));
  };

  const handleReply = (msg: MessageRow) => {
    setReplyTo(msg.message.id);
    setSubject(`Re: ${msg.message.subject}`);
    setBody('');
    setIsDialogOpen(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('messages')}</h1>
          </div>
          <Button onClick={() => { setReplyTo(null); setSubject(''); setBody(''); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 me-2" />
            {t('newMessage')}
          </Button>
        </div>

        {messages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{t('noMessages')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((item) => (
              <Card key={item.message.id} className={!item.message.isRead && item.message.senderId !== user?.id ? 'border-primary/50' : ''} onClick={() => !item.message.isRead && handleMarkRead(item.message.id)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">{item.message.subject}</h3>
                        {!item.message.isRead && <Badge variant="default" className="text-[10px] shrink-0">{t('unread')}</Badge>}
                        {item.message.parentId && <Badge variant="outline" className="text-[10px] shrink-0">{t('reply')}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.senderName || item.senderEmail} — {formatDate(item.message.createdAt)}
                      </p>
                      <p className="text-sm mt-2 whitespace-pre-wrap">{item.message.body}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleReply(item); }}>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{replyTo ? t('replyMessage') : t('newMessage')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('subject')}</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <Label>{t('messageBody')}</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
              </div>
              <Button onClick={handleSend} disabled={!subject.trim() || !body.trim()} className="w-full">
                <Send className="w-4 h-4 me-2" />
                {t('sendMessage')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Messages;
