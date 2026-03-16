
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChatSidebar } from "@/components/chat/sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Info, MoreVertical, MessageSquarePlus, Loader2, Users, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, orderBy, limit } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

const INITIAL_MESSAGE_LIMIT = 30;
const LOAD_MORE_STEP = 20;

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
  const [currentSearchMatchIndex, setCurrentSearchMatchIndex] = useState(-1);
  
  const [messageLimit, setMessageLimit] = useState(INITIAL_MESSAGE_LIMIT);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const topObserverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !userLoading && !user && !isLoggingOut) {
      router.push("/");
    }
  }, [user, userLoading, isMounted, router, isLoggingOut]);

  useEffect(() => {
    setMessageLimit(INITIAL_MESSAGE_LIMIT);
    setIsInitialLoad(true);
    setIsSearchMode(false);
    setMessageSearchQuery("");
    setCurrentSearchMatchIndex(-1);
  }, [selectedChat]);

  const currentUserDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: currentUserProfile } = useDoc(currentUserDocRef);

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "users"));
  }, [db]);
  const { data: allUsers, isLoading: usersLoading } = useCollection(usersQuery);

  const friendsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "friends"));
  }, [db, user]);
  const { data: friendsListData } = useCollection(friendsQuery);

  const friends = useMemo(() => {
    if (!allUsers || !friendsListData || !user) return [];
    const friendIds = friendsListData.map((f: any) => f.id);
    return allUsers.filter(u => u.id !== user.uid && friendIds.includes(u.id));
  }, [allUsers, friendsListData, user]);

  const groupsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "groups"), where("members", "array-contains", user.uid));
  }, [db, user]);
  const { data: userGroups } = useCollection(groupsQuery);

  const selectedInfo = useMemo(() => {
    if (!selectedChat) return null;
    if (selectedChat.type === "private") {
      return allUsers?.find(u => u.id === selectedChat.id);
    } else {
      return userGroups?.find(g => g.id === selectedChat.id);
    }
  }, [selectedChat, allUsers, userGroups]);

  // 방별 전용 쿼리: limit가 현재 대화방 내에서만 작동하도록 수정
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedChat) return null;
    
    if (selectedChat.type === "group") {
      return query(
        collection(db, "messages"),
        where("groupId", "==", selectedChat.id),
        orderBy("createdAt", "desc"),
        limit(messageLimit)
      );
    } else {
      // 1:1 대화: 상대방이 포함된 메시지만 가져옴 (보안 규칙이 내가 포함된 것만 필터링해줌)
      return query(
        collection(db, "messages"),
        where("participants", "array-contains", selectedChat.id),
        where("groupId", "==", null),
        orderBy("createdAt", "desc"),
        limit(messageLimit)
      );
    }
  }, [db, user, selectedChat, messageLimit]);
  
  const { data: rawMessages, isLoading: messagesLoading } = useCollection(messagesQuery);

  const allMessagesInChat = useMemo(() => {
    if (!rawMessages) return [];
    
    // 이미 쿼리에서 방별 필터링이 되었으므로 정렬만 수행
    return [...rawMessages].sort((a: any, b: any) => {
      const timeA = a.createdAt?.toMillis?.() || Date.now();
      const timeB = b.createdAt?.toMillis?.() || Date.now();
      return timeA - timeB;
    });
  }, [rawMessages]);

  useEffect(() => {
    if (!topObserverRef.current || messagesLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && allMessagesInChat.length >= messageLimit) {
          setMessageLimit((prev) => prev + LOAD_MORE_STEP);
          setIsInitialLoad(false);
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(topObserverRef.current);
    return () => observer.disconnect();
  }, [allMessagesInChat.length, messageLimit, messagesLoading]);

  const searchMatchIndices = useMemo(() => {
    if (!messageSearchQuery.trim() || !isSearchMode) return [];
    return allMessagesInChat
      .map((msg, index) => msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase()) ? index : -1)
      .filter(index => index !== -1);
  }, [allMessagesInChat, messageSearchQuery, isSearchMode]);

  useEffect(() => {
    if (searchMatchIndices.length > 0) {
      setCurrentSearchMatchIndex(0);
    } else {
      setCurrentSearchMatchIndex(-1);
    }
  }, [searchMatchIndices]);

  useEffect(() => {
    if (scrollRef.current && !isSearchMode && isInitialLoad && allMessagesInChat.length > 0) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessagesInChat, isSearchMode, isInitialLoad]);

  const handleSendMessage = async (content: string) => {
    const text = content.trim();
    if (!text || !selectedChat || !user || !db) return;
    
    setInputValue("");
    setIsInitialLoad(true);

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
        messageData.groupId = null; // 쿼리 필터링을 위해 명시적으로 null 설정
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

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchMatchIndices.length === 0) return;
    
    setCurrentSearchMatchIndex(prev => {
      if (direction === 'next') {
        return (prev + 1) % searchMatchIndices.length;
      } else {
        return (prev - 1 + searchMatchIndices.length) % searchMatchIndices.length;
      }
    });
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
                <div className="relative max-w-4xl mx-auto flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="대화 내용 검색..." 
                      className="pl-9 h-10 bg-white border-muted pr-20"
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {searchMatchIndices.length > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                        {currentSearchMatchIndex + 1} / {searchMatchIndices.length}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-10 w-10 bg-white"
                      disabled={searchMatchIndices.length === 0}
                      onClick={() => navigateSearch('prev')}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-10 w-10 bg-white"
                      disabled={searchMatchIndices.length === 0}
                      onClick={() => navigateSearch('next')}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setIsSearchMode(false); setMessageSearchQuery(""); setCurrentSearchMatchIndex(-1); }}
                    >
                      <X className="h-4 w-4 mr-1" /> 닫기
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 p-6 custom-scrollbar">
              <div className="flex flex-col gap-1 max-w-4xl mx-auto">
                <div ref={topObserverRef} className="h-10 flex items-center justify-center">
                   {allMessagesInChat.length >= messageLimit && (
                     <Loader2 className="h-4 w-4 animate-spin text-muted-foreground opacity-50" />
                   )}
                </div>

                {allMessagesInChat.length === 0 && !messagesLoading ? (
                  <div className="flex flex-col items-center justify-center h-full pt-20 text-muted-foreground">
                    <MessageSquarePlus className="h-12 w-12 mb-4 opacity-20" />
                    <p>메시지를 보내 대화를 시작해보세요!</p>
                  </div>
                ) : (
                  allMessagesInChat.map((msg: any, index: number) => (
                    <MessageBubble
                      key={msg.id}
                      id={`msg-${index}`}
                      content={msg.content}
                      timestamp={msg.createdAt?.toDate ? msg.createdAt.toDate().toISOString() : new Date().toISOString()}
                      isUser={msg.senderId === user?.uid}
                      senderName={selectedChat.type === "group" ? msg.senderName : undefined}
                      senderAvatar={selectedChat.type === "group" ? msg.senderAvatar : undefined}
                      isHighlighted={isSearchMode && currentSearchMatchIndex !== -1 && searchMatchIndices[currentSearchMatchIndex] === index}
                    />
                  ))
                )}
                {messagesLoading && allMessagesInChat.length === 0 && (
                  <div className="flex justify-center p-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <footer className="bg-white/80 backdrop-blur-md border-t border-border shrink-0">
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
