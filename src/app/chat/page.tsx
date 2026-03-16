
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChatSidebar } from "@/components/chat/sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { AiSuggestions } from "@/components/chat/ai-suggestions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Phone, Video, Info, MoreVertical, MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
      } else {
        setUser(session.user);
        const { data } = await supabase.from('profiles').select('*');
        setProfiles(data || []);
      }
      setLoading(false);
    };
    fetchSession();
  }, [router]);

  const conversations = useMemo(() => {
    if (!profiles || !user) return [];
    return profiles
      .filter(p => p.id !== user.id)
      .map(p => ({
        other_user: {
          id: p.id,
          username: p.username || "사용자",
          avatar_url: p.avatar_url || `https://picsum.photos/seed/${p.id}/200/200`,
        },
        last_message: { content: "대화를 시작해보세요.", created_at: new Date(0).toISOString() },
        unread: false,
      }));
  }, [profiles, user]);

  useEffect(() => {
    if (!selectedUserId || !user) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      
      if (error) console.error(error);
      else setMessages(data || []);
    };

    fetchMessages();

    const channel = supabase
      .channel(`realtime-messages-${selectedUserId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        const newMessage = payload.new;
        const isRelevant = 
          (newMessage.sender_id === user.id && newMessage.receiver_id === selectedUserId) ||
          (newMessage.sender_id === selectedUserId && newMessage.receiver_id === user.id);
        
        if (isRelevant) {
          setMessages((prev) => {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const text = content.trim();
    if (!text || !selectedUserId || !user) return;
    
    setInputValue("");

    const { error } = await supabase
      .from('messages')
      .insert([
        { 
          sender_id: user.id, 
          receiver_id: selectedUserId, 
          content: text 
        }
      ]);

    if (error) {
      toast({
        variant: "destructive",
        title: "전송 실패",
        description: error.message,
      });
      setInputValue(text);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!isMounted || loading) return <div className="flex h-screen items-center justify-center bg-background">로딩 중...</div>;

  const selectedConversation = conversations.find(c => c.other_user.id === selectedUserId);
  const selectedUser = selectedConversation?.other_user;

  const aiMessageFormat = messages.slice(-5).map(m => ({
    sender: m.sender_id === user?.id ? "user" as const : "other" as const,
    content: m.content
  }));

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <ChatSidebar
        currentUserId={user?.id}
        conversations={conversations}
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {selectedUserId && selectedUser ? (
          <>
            <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-border z-10">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedUser.username ? selectedUser.username[0].toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-bold text-lg leading-none">{selectedUser.username}</h2>
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    현재 활동 중
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon"><Phone className="h-5 w-5 text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon"><Video className="h-5 w-5 text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon"><Info className="h-5 w-5 text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5 text-muted-foreground" /></Button>
              </div>
            </header>

            <ScrollArea className="flex-1 p-6 custom-scrollbar">
              <div className="flex flex-col gap-1 max-w-4xl mx-auto" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full pt-20 text-muted-foreground">
                    <MessageSquarePlus className="h-12 w-12 mb-4 opacity-20" />
                    <p>메시지를 보내 대화를 시작해보세요!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      content={msg.content}
                      timestamp={msg.created_at}
                      isUser={msg.sender_id === user.id}
                    />
                  ))
                )}
              </div>
            </ScrollArea>

            <footer className="bg-white/80 backdrop-blur-md border-t border-border">
              <AiSuggestions 
                messages={aiMessageFormat} 
                onSelect={(suggestion) => handleSendMessage(suggestion)} 
              />
              <div className="p-4 flex items-center gap-3 max-w-4xl mx-auto">
                <div className="flex-1 relative">
                  <Input
                    placeholder="메시지를 입력하세요..."
                    className="pr-12 h-12 bg-background border-none ring-offset-background focus-visible:ring-1 text-base rounded-2xl"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputValue)}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Button 
                      size="icon" 
                      className="h-9 w-9 bg-primary hover:bg-primary/90 rounded-xl"
                      onClick={() => handleSendMessage(inputValue)}
                      disabled={!inputValue.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-background/50 text-center p-8">
            <div className="bg-primary/5 p-8 rounded-full mb-6">
              <MessageSquarePlus className="h-20 w-20 text-primary opacity-20" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">당신의 이야기를 시작하세요</h2>
            <p className="text-muted-foreground max-w-xs">
              왼쪽 목록에서 대화를 선택하거나 새 대화를 시작하여 친구와 실시간으로 소통해보세요.
            </p>
            {conversations.length > 0 && (
              <Button className="mt-8 bg-primary hover:bg-primary/90 px-8" onClick={() => setSelectedUserId(conversations[0]?.other_user?.id || null)}>
                최근 대화 보기
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
