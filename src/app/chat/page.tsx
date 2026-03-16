
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
import { 
  useFirestore, 
  useUser, 
  useCollection, 
  useMemoFirebase,
  useAuth
} from "@/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ChatPage() {
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { user, isLoading: isUserLoading } = useUser();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 모든 사용자 목록 가져오기 (대화 상대 선택용)
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, "users");
  }, [db]);
  const { data: allUsers } = useCollection(usersQuery);

  const conversations = useMemo(() => {
    if (!allUsers || !user) return [];
    return allUsers
      .filter(u => u.id !== user.uid)
      .map(u => ({
        other_user: {
          id: u.id,
          username: u.username || "알 수 없음",
          avatar_url: u.avatarUrl || `https://picsum.photos/seed/${u.id}/200/200`,
        },
        last_message: { content: "대화를 시작해보세요.", created_at: new Date().toISOString() },
        unread: false,
      }));
  }, [allUsers, user]);

  // 선택된 대화의 메시지 실시간 감시
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedUserId) return null;
    return query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid),
      orderBy("createdAt", "asc")
    );
  }, [db, user, selectedUserId]);

  const { data: rawMessages } = useCollection(messagesQuery);

  // 현재 선택된 상대와의 메시지만 필터링
  const filteredMessages = useMemo(() => {
    if (!rawMessages || !selectedUserId) return [];
    return rawMessages.filter(m => 
      (m.senderId === user?.uid && m.receiverId === selectedUserId) ||
      (m.senderId === selectedUserId && m.receiverId === user?.uid)
    );
  }, [rawMessages, selectedUserId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages]);

  const handleSendMessage = (content: string) => {
    if (!content.trim() || !selectedUserId || !user || !db) return;
    
    const messageData = {
      senderId: user.uid,
      receiverId: selectedUserId,
      participants: [user.uid, selectedUserId],
      content,
      createdAt: serverTimestamp(),
    };
    
    addDoc(collection(db, "messages"), messageData)
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: 'messages',
          operation: 'create',
          requestResourceData: messageData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });

    setInputValue("");
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push("/");
    }
  };

  const selectedUser = conversations.find(c => c.other_user.id === selectedUserId)?.other_user;

  const aiMessageFormat = filteredMessages.slice(-5).map(m => ({
    sender: m.senderId === user?.uid ? "user" as const : "other" as const,
    content: m.content
  }));

  if (isUserLoading) return <div className="flex h-screen items-center justify-center">로딩 중...</div>;
  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <ChatSidebar
        currentUserId={user.uid}
        conversations={conversations}
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {selectedUserId ? (
          <>
            <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-border z-10">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedUser?.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-bold text-lg leading-none">{selectedUser?.username}</h2>
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

            <ScrollArea className="flex-1 p-6 custom-scrollbar" viewportRef={scrollRef}>
              <div className="flex flex-col gap-1 max-w-4xl mx-auto">
                {filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full pt-20 text-muted-foreground">
                    <MessageSquarePlus className="h-12 w-12 mb-4 opacity-20" />
                    <p>메시지를 보내 대화를 시작해보세요!</p>
                  </div>
                ) : (
                  filteredMessages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      content={msg.content}
                      timestamp={msg.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()}
                      isUser={msg.senderId === user.uid}
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
            <Button className="mt-8 bg-primary hover:bg-primary/90 px-8" onClick={() => setSelectedUserId(conversations[0]?.other_user?.id || null)}>
              최근 대화 보기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
