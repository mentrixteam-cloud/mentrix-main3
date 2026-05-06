import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Send, Sparkles, Bot, User, Loader2, Trash2, Upload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Document {
  id: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const Assistant = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!user) return;

    try {
      const [messagesRes, documentsRes] = await Promise.all([
        supabase
          .from('ai_conversations')
          .select('*')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('teacher_documents')
          .select('id, file_name, file_size, created_at')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (documentsRes.error) throw documentsRes.error;

      setMessages((messagesRes.data || []).map(m => ({
        ...m,
        role: m.role as 'user' | 'assistant'
      })));
      setDocuments(documentsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Only allow text-based files for now
    const allowedTypes = ['text/plain', 'text/csv', 'text/markdown', 'application/json'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      toast({
        title: 'Unsupported file type',
        description: 'Please upload text files (.txt, .md, .csv, .json)',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Read file content
      const content = await file.text();

      // Upload to storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('teacher-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save document metadata and content
      const { error: dbError } = await supabase.from('teacher_documents').insert({
        teacher_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        content: content.substring(0, 50000), // Limit content size
      });

      if (dbError) throw dbError;

      toast({ title: 'Document uploaded', description: `${file.name} is now available to the AI assistant` });
      fetchData();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ title: 'Upload failed', description: 'Could not upload the document', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string, fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return;

    try {
      const { error } = await supabase.from('teacher_documents').delete().eq('id', docId);
      if (error) throw error;
      toast({ title: 'Document deleted' });
      fetchData();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({ title: 'Error', description: 'Could not delete document', variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !user || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Save user message
      await supabase.from('ai_conversations').insert({
        teacher_id: user.id,
        role: 'user',
        content: userMessage,
      });

      // Prepare conversation history for AI
      const conversationHistory = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage },
      ];

      // Stream AI response
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: conversationHistory,
          teacherId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI request failed');
      }

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let aiContent = '';
      const aiMsgId = crypto.randomUUID();

      // Add placeholder AI message
      setMessages((prev) => [...prev, {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      }]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              aiContent += content;
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, content: aiContent } : m)
              );
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Save AI response
      await supabase.from('ai_conversations').insert({
        teacher_id: user.id,
        role: 'assistant',
        content: aiContent,
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get AI response',
        variant: 'destructive',
      });
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!user || !confirm('Clear all chat history?')) return;

    try {
      const { error } = await supabase.from('ai_conversations').delete().eq('teacher_id', user.id);
      if (error) throw error;
      setMessages([]);
      toast({ title: 'Chat cleared' });
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast({ title: 'Error', description: 'Failed to clear chat', variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex gap-4 animate-fade-in">
        {/* Main Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                AI Teaching Assistant
              </h1>
              <p className="text-sm text-muted-foreground">Personalized insights based on your students and data</p>
            </div>
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearChat} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Mentrix AI
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="p-4 gradient-primary rounded-2xl mb-4">
                      <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Welcome to your personalized AI!</h3>
                    <p className="text-muted-foreground max-w-md mb-4 text-sm">
                      I know about your students, classes, and uploaded documents. Ask me anything!
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        'How are my students doing?',
                        'Suggest a lesson for my class',
                        'Analyze recent grades',
                      ].map((suggestion) => (
                        <Button key={suggestion} variant="outline" size="sm" onClick={() => setInput(suggestion)}>
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={cn("flex gap-3", message.role === 'user' ? "justify-end" : "justify-start")}>
                        {message.role === 'assistant' && (
                          <div className="p-2 gradient-primary rounded-lg h-fit">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3",
                          message.role === 'user' ? "bg-primary text-primary-foreground" : "bg-secondary"
                        )}>
                          <p className="whitespace-pre-wrap text-sm">{message.content || '...'}</p>
                        </div>
                        {message.role === 'user' && (
                          <div className="p-2 bg-muted rounded-lg h-fit">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    {sending && messages[messages.length - 1]?.role === 'user' && (
                      <div className="flex gap-3">
                        <div className="p-2 gradient-primary rounded-lg h-fit">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-secondary rounded-2xl px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t bg-card">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your students, lessons, or teaching..."
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={!input.trim() || sending} className="gradient-primary">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents Sidebar */}
        <div className="w-64 hidden lg:block">
          <Card className="h-full flex flex-col">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Knowledge Base
              </CardTitle>
              <CardDescription className="text-xs">Upload documents to enhance AI responses</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-3 overflow-hidden">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full gap-2 mb-3"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload Document
              </Button>

              <ScrollArea className="flex-1">
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 rounded bg-secondary/50 group">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs truncate flex-1">{doc.file_name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No documents yet. Upload student info, notes, or curriculum documents.
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Assistant;
