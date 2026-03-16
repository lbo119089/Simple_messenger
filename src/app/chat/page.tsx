
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChatSidebar } from "@/components/chat/sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { AiSuggestions } from "@/components/chat/ai-suggestions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Phone, Video, Info, MoreVertical, MessageSquarePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore, useUser, useCollection, useDoc } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isLoading: userLoading } = useUser();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !userLoading && !user && !isLoggingOut) {
      router.push("/");
    }
  }, [user, userLoading, isMounted, router, isLoggingOut]);

  // 내 프로필 정보
  const currentUserDocRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: currentUserProfile } = useDoc(currentUserDocRef);

  // 전체 사용자 목록 (친구 추가용)
  const usersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "users"));
  }, [db]);
  const { data: allUsers, isLoading: usersLoading } = useCollection(usersQuery);

  // 내 친구 목록 가져오기 (서브 컬렉션)
  const friendsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "friends"));
  }, [db, user]);
  const { data: friendsListData } = useCollection(friendsQuery);

  // 실제 친구 객체들만 필터링
  const friends = useMemo(() => {
    if (!allUsers || !friendsListData || !user) return [];
    const friendIds = friendsListData.map((f: any) => f.id);
    // 나 자신은 친구 목록에서 제외하고, 추가된 사람만 필터링
    return allUsers.filter(u => u.id !== user.uid && friendIds.includes(u.id));
  }, [allUsers, friendsListData, user]);

  // 메시지 가져오기
  const messagesQuery = useMemo(() => {
    if (!db || !user || !selectedUserId) return null;
    return query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid)
    );
  }, [db, user, selectedUserId]);
  
  const { data: rawMessages } = useCollection(messagesQuery);

  // 클라이언트 측 메시지 필터링 및 정렬
  const messages = useMemo(() => {
    if (!rawMessages || !selectedUserId || !user) return [];
    
    const now = Date.now();
    return rawMessages
      .filter((msg: any) => 
        msg.participants && msg.participants.includes(selectedUserId)
      )
      .sort((a: any, b: any) => {
        // 서버 타임스탬프가 아직 생성되지 않은 경우(null) 현재 시간을 기준으로 정렬
        const timeA = a.createdAt?.toMillis?.() || now;
        const timeB = b.createdAt?.toMillis?.() || now;
        return timeA - timeB;
      });
  }, [rawMessages, selectedUserId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const text = content.trim();
    if (!text || !selectedUserId || !user || !db) return;
    
    setInputValue("");

    try {
      await addDoc(collection(db, "messages"), {
        senderId: user.uid,
        receiverId: selectedUserId,
        participants: [user.uid, selectedUserId],
        content: text,
        createdAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error("메시지 전송 실패:", error);
      toast({
        variant: "destructive",
        title: "전송 실패",
        description: error.message,
      });
      setInputValue(text);
    }
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        setIsLoggingOut(true);
        await signOut(auth);
        router.push("/");
      } catch (error: any) {
        console.error("Logout failed", error);
        setIsLoggingOut(false);
      }
    }
  };

  if (!isMounted || userLoading || usersLoading || !user || isLoggingOut) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse">
            {isLoggingOut ? "로그아웃 중..." : "대화 불러오는 중..."}
          </p>
        </div>
      </div>
    );
  }

  const selectedUser = allUsers?.find(u => u.id === selectedUserId);

  const aiMessageFormat = messages.slice(-5).map((m: any) => ({
    sender: m.senderId === user?.uid ? "user" as const : "other" as const,
    content: m.content
  }));

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <ChatSidebar
        currentUserId={user?.uid || ""}
        currentUserProfile={currentUserProfile}
        allUsers={allUsers || []}
        friends={friends}
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
                  <AvatarImage src={selectedUser.avatarUrl} />
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
              <div className="flex flex-col gap-1 max-w-4xl mx-auto">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full pt-20 text-muted-foreground">
                    <MessageSquarePlus className="h-12 w-12 mb-4 opacity-20" />
                    <p>메시지를 보내 대화를 시작해보세요!</p>
                  </div>
                ) : (
                  messages.map((msg: any) => (
                    <MessageBubble
                      key={msg.id}
                      content={msg.content}
                      timestamp={msg.createdAt?.toDate ? msg.createdAt.toDate().toISOString() : new Date().toISOString()}
                      isUser={msg.senderId === user?.uid}
                    />
                  ))
                )}
                <div ref={scrollRef} />
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(inputValue);
                      }
                    }}
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
              왼쪽 목록에서 친구를 추가하거나 대화를 선택하여 소통해보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
