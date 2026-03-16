
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChatSidebar } from "@/components/chat/sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { AiSuggestions } from "@/components/chat/ai-suggestions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Info, MoreVertical, MessageSquarePlus, Loader2, Users, Search, X } from "lucide-react";
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
  const [selectedChat, setSelectedChat] = useState<{ type: "private" | "group"; id: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
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

  // 전체 사용자 목록
  const usersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "users"));
  }, [db]);
  const { data: allUsers, isLoading: usersLoading } = useCollection(usersQuery);

  // 내 친구 목록
  const friendsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "friends"));
  }, [db, user]);
  const { data: friendsListData } = useCollection(friendsQuery);

  const friends = useMemo(() => {
    if (!allUsers || !friendsListData || !user) return [];
    const friendIds = friendsListData.map((f: any) => f.id);
    return allUsers.filter(u => u.id !== user.uid && friendIds.includes(u.id));
  }, [allUsers, friendsListData, user]);

  // 내가 속한 그룹 목록
  const groupsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "groups"), where("members", "array-contains", user.uid));
  }, [db, user]);
  const { data: userGroups } = useCollection(groupsQuery);

  // 선택된 채팅 대상 정보 (개인 또는 그룹)
  const selectedInfo = useMemo(() => {
    if (!selectedChat) return null;
    if (selectedChat.type === "private") {
      return allUsers?.find(u => u.id === selectedChat.id);
    } else {
      return userGroups?.find(g => g.id === selectedChat.id);
    }
  }, [selectedChat, allUsers, userGroups]);

  // 메시지 가져오기
  const messagesQuery = useMemo(() => {
    if (!db || !user || !selectedChat) return null;
    return query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid)
    );
  }, [db, user, selectedChat]);
  
  const { data: rawMessages } = useCollection(messagesQuery);

  const allMessagesInChat = useMemo(() => {
    if (!rawMessages || !selectedChat || !user) return [];
    
    const now = Date.now();
    return rawMessages
      .filter((msg: any) => {
        if (selectedChat.type === "group") {
          return msg.groupId === selectedChat.id;
        } else {
          return !msg.groupId && msg.participants && msg.participants.includes(selectedChat.id);
        }
      })
      .sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || now;
        const timeB = b.createdAt?.toMillis?.() || now;
        return timeA - timeB;
      });
  }, [rawMessages, selectedChat, user]);

  const messages = useMemo(() => {
    if (!messageSearchQuery.trim() || !isSearchMode) return allMessagesInChat;
    return allMessagesInChat.filter((msg: any) => 
      msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase())
    );
  }, [allMessagesInChat, messageSearchQuery, isSearchMode]);

  useEffect(() => {
    if (scrollRef.current && !isSearchMode) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSearchMode]);

  // 채팅방 변경 시 검색 모드 초기화
  useEffect(() => {
    setIsSearchMode(false);
    setMessageSearchQuery("");
  }, [selectedChat]);

  const handleSendMessage = async (content: string) => {
    const text = content.trim();
    if (!text || !selectedChat || !user || !db) return;
    
    setInputValue("");

    try {
      const messageData: any = {
        senderId: user.uid,
        content: text,
        createdAt: serverTimestamp(),
        senderName: currentUserProfile?.username || "Unknown",
        senderAvatar: currentUserProfile?.avatarUrl || ""
      };

      if (selectedChat.type === "group") {
        const group = userGroups?.find(g => g.id === selectedChat.id);
        messageData.groupId = selectedChat.id;
        messageData.participants = group.members;
      } else {
        messageData.receiverId = selectedChat.id;
        messageData.participants = [user.uid, selectedChat.id];
      }

      await addDoc(collection(db, "messages"), messageData);
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

  const aiMessageFormat = allMessagesInChat.slice(-5).map((m: any) => ({
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
        groups={userGroups || []}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {selectedChat && selectedInfo ? (
          <>
            <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-border z-10 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={selectedInfo.avatarUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedChat.type === "group" ? <Users className="h-5 w-5" /> : (selectedInfo.username ? selectedInfo.username[0].toUpperCase() : "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <h2 className="font-bold text-lg leading-none truncate">
                    {selectedChat.type === "group" ? selectedInfo.name : selectedInfo.username}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {selectedChat.type === "group" ? `멤버 ${selectedInfo.members?.length}명` : "현재 활동 중"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsSearchMode(!isSearchMode)}
                  className={isSearchMode ? "text-primary bg-primary/10" : "text-muted-foreground"}
                >
                  <Search className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon"><Info className="h-5 w-5 text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5 text-muted-foreground" /></Button>
              </div>
            </header>

            {isSearchMode && (
              <div className="px-6 py-2 bg-muted/30 border-b border-border animate-in slide-in-from-top duration-200">
                <div className="relative max-w-4xl mx-auto flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="대화 내용 검색..." 
                      className="pl-9 h-9 bg-white border-muted"
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setIsSearchMode(false); setMessageSearchQuery(""); }}>
                    <X className="h-4 w-4 mr-1" /> 닫기
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 p-6 custom-scrollbar">
              <div className="flex flex-col gap-1 max-w-4xl mx-auto">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full pt-20 text-muted-foreground">
                    <MessageSquarePlus className="h-12 w-12 mb-4 opacity-20" />
                    <p>{isSearchMode ? "검색 결과가 없습니다." : "메시지를 보내 대화를 시작해보세요!"}</p>
                  </div>
                ) : (
                  messages.map((msg: any) => (
                    <MessageBubble
                      key={msg.id}
                      content={msg.content}
                      timestamp={msg.createdAt?.toDate ? msg.createdAt.toDate().toISOString() : new Date().toISOString()}
                      isUser={msg.senderId === user?.uid}
                      senderName={selectedChat.type === "group" ? msg.senderName : undefined}
                      senderAvatar={selectedChat.type === "group" ? msg.senderAvatar : undefined}
                    />
                  ))
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <footer className="bg-white/80 backdrop-blur-md border-t border-border shrink-0">
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
              왼쪽 목록에서 친구를 선택하거나 그룹을 만들어 대화를 시작해보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
