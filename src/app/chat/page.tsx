
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChatSidebar } from "@/components/chat/sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Send, Info, MoreVertical, MessageSquarePlus, Loader2, Users, Search, X, ChevronUp, ChevronDown, User, UserPlus, Download, Trash2, Bell, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, limit, updateDoc, arrayUnion, arrayRemove, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const INITIAL_MESSAGE_LIMIT = 50;
const LOAD_MORE_STEP = 30;

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

  // 초대 관련 상태
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedFriendsToInvite, setSelectedFriendsToInvite] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  // 더보기 메뉴 상태
  const [isMuted, setIsMuted] = useState(false);
  const [isClearHistoryOpen, setIsClearHistoryOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
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
    setIsMuted(false);
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

  const chatMembers = useMemo(() => {
    if (!selectedChat || !allUsers || !user) return [];
    
    if (selectedChat.type === "private") {
      const otherUser = allUsers.find(u => u.id === selectedChat.id);
      const me = allUsers.find(u => u.id === user.uid);
      return [me, otherUser].filter(Boolean);
    } else if (selectedChat.type === "group" && selectedInfo) {
      return allUsers.filter(u => selectedInfo.members.includes(u.id));
    }
    return [];
  }, [selectedChat, allUsers, user, selectedInfo]);

  const invitableFriends = useMemo(() => {
    if (selectedChat?.type !== "group" || !selectedInfo || !friends) return [];
    return friends.filter(f => !selectedInfo.members.includes(f.id));
  }, [selectedChat, selectedInfo, friends]);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedChat) return null;
    return query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid),
      limit(messageLimit)
    );
  }, [db, user, selectedChat, messageLimit]);
  
  const { data: rawMessages, isLoading: messagesLoading } = useCollection(messagesQuery);

  const allMessagesInChat = useMemo(() => {
    if (!rawMessages || !selectedChat) return [];
    
    const filtered = rawMessages.filter((msg: any) => {
      if (selectedChat.type === "group") {
        return msg.groupId === selectedChat.id;
      } else {
        return (!msg.groupId || msg.groupId === null) && 
               msg.participants?.includes(selectedChat.id);
      }
    });

    return [...filtered].sort((a: any, b: any) => {
      const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return timeA - timeB;
    });
  }, [rawMessages, selectedChat]);

  useEffect(() => {
    if (!topObserverRef.current || messagesLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && rawMessages.length >= messageLimit) {
          setMessageLimit((prev) => prev + LOAD_MORE_STEP);
          setIsInitialLoad(false);
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(topObserverRef.current);
    return () => observer.disconnect();
  }, [rawMessages.length, messageLimit, messagesLoading]);

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
      scrollRef.current.scrollIntoView({ behavior: "auto" });
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
        messageData.groupId = selectedChat.id;
        messageData.participants = selectedInfo.members;
      } else {
        messageData.receiverId = selectedChat.id;
        messageData.participants = [user.uid, selectedChat.id];
        messageData.groupId = null;
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

  const handleExportChat = () => {
    if (!allMessagesInChat.length) {
      toast({ title: "내보낼 대화 내용이 없습니다." });
      return;
    }
    const chatTitle = selectedChat?.type === "group" ? selectedInfo.name : selectedInfo.username;
    const content = allMessagesInChat.map(m => {
      const dateStr = m.createdAt?.toDate?.().toLocaleString() || new Date().toLocaleString();
      return `[${dateStr}] ${m.senderName || '익명'}: ${m.content}`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VibeChat_${chatTitle}_${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "대화 내보내기 완료", description: "텍스트 파일이 다운로드되었습니다." });
  };

  const handleClearHistory = async () => {
    if (!db || !allMessagesInChat.length) return;
    setIsClearing(true);
    try {
      const deletePromises = allMessagesInChat.map(m => deleteDoc(doc(db, "messages", m.id)));
      await Promise.all(deletePromises);
      toast({ title: "대화 내용 삭제 완료", description: "이 방의 모든 메시지가 삭제되었습니다." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "삭제 실패", description: error.message });
    } finally {
      setIsClearing(false);
      setIsClearHistoryOpen(false);
    }
  };

  const handleInviteFriends = async () => {
    if (!db || !selectedChat || selectedChat.type !== "group" || selectedFriendsToInvite.length === 0) return;
    
    setIsInviting(true);
    try {
      const groupRef = doc(db, "groups", selectedChat.id);
      await updateDoc(groupRef, {
        members: arrayUnion(...selectedFriendsToInvite)
      });
      
      toast({ title: "친구 초대 완료", description: `${selectedFriendsToInvite.length}명의 친구를 초대했습니다.` });
      setSelectedFriendsToInvite([]);
      setIsInviteOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "초대 실패", description: error.message });
    } finally {
      setIsInviting(false);
    }
  };

  const handleLeaveChat = async () => {
    if (!db || !selectedChat || !user) return;

    try {
      if (selectedChat.type === "group") {
        const groupRef = doc(db, "groups", selectedChat.id);
        await updateDoc(groupRef, {
          members: arrayRemove(user.uid)
        });
        toast({ title: "대화방을 나갔습니다." });
      } else {
        toast({ title: "대화 목록에서 제외되었습니다." });
      }
      setSelectedChat(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "오류 발생", description: error.message });
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
      if (direction === 'next') return (prev + 1) % searchMatchIndices.length;
      return (prev - 1 + searchMatchIndices.length) % searchMatchIndices.length;
    });
  };

  if (!isMounted || userLoading || usersLoading || !user || isLoggingOut) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse">
            {isLoggingOut ? "로그아웃 중..." : "데이터를 불러오는 중..."}
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
                    {selectedChat.type === "group" ? `멤버 ${selectedInfo.members?.length}명` : "활동 중"}
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
                
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Info className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
                    <div className="flex flex-col h-full">
                      <SheetHeader className="p-6 text-left border-b">
                        <SheetTitle className="text-xl font-bold flex items-center gap-2">
                          {selectedChat.type === "group" ? <Users className="h-5 w-5" /> : <User className="h-5 w-5" />}
                          대화방 정보
                        </SheetTitle>
                        <SheetDescription>
                          {selectedChat.type === "group" ? `${selectedInfo.name} 그룹 채팅방` : `${selectedInfo.username}님과의 대화`}
                        </SheetDescription>
                      </SheetHeader>
                      
                      <div className="flex-1 overflow-y-auto">
                        <div className="p-6 space-y-6">
                          {selectedChat.type === "group" && (
                            <div>
                              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                                <DialogTrigger asChild>
                                  <Button className="w-full gap-2 mb-4" variant="secondary">
                                    <UserPlus className="h-4 w-4" /> 친구 초대하기
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>그룹에 친구 초대</DialogTitle></DialogHeader>
                                  <div className="py-4">
                                    <ScrollArea className="h-60 border rounded-md p-2">
                                      {invitableFriends.length > 0 ? (
                                        invitableFriends.map(friend => (
                                          <div 
                                            key={friend.id} 
                                            className="flex items-center gap-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                                            onClick={() => {
                                              setSelectedFriendsToInvite(prev => 
                                                prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id]
                                              );
                                            }}
                                          >
                                            <Checkbox checked={selectedFriendsToInvite.includes(friend.id)} />
                                            <Avatar className="h-8 w-8">
                                              <AvatarImage src={friend.avatarUrl} />
                                              <AvatarFallback>{friend.username?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium">{friend.username}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-10 text-sm text-muted-foreground">초대할 수 있는 친구가 없습니다.</div>
                                      )}
                                    </ScrollArea>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsInviteOpen(false)}>취소</Button>
                                    <Button onClick={handleInviteFriends} disabled={isInviting || selectedFriendsToInvite.length === 0}>
                                      {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "초대 완료"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}

                          <div>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">참여 멤버 ({chatMembers.length})</h3>
                            <div className="space-y-4">
                              {chatMembers.map((member: any) => (
                                <div key={member.id} className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={member.avatarUrl} />
                                    <AvatarFallback>{member.username?.[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-bold truncate flex items-center gap-2">
                                      {member.username}
                                      {member.id === user.uid && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-normal">나</span>}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">최근 활동 중</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">채팅 설정</h3>
                            <Button 
                              variant="outline" 
                              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20"
                              onClick={handleLeaveChat}
                            >
                              대화방 나가기
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5 text-muted-foreground" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="gap-2" onClick={handleExportChat}>
                      <Download className="h-4 w-4" /> 대화 내용 내보내기
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2" onClick={() => setIsMuted(!isMuted)}>
                      {isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                      알림 {isMuted ? "켜기" : "끄기"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => setIsClearHistoryOpen(true)}>
                      <Trash2 className="h-4 w-4" /> 대화 내용 전체 삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog open={isClearHistoryOpen} onOpenChange={setIsClearHistoryOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>대화 내용을 삭제하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        이 대화방의 모든 메시지가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleClearHistory} disabled={isClearing}>
                        {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : "전체 삭제"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                    <Button variant="outline" size="icon" className="h-10 w-10 bg-white" disabled={searchMatchIndices.length === 0} onClick={() => navigateSearch('prev')}><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" className="h-10 w-10 bg-white" disabled={searchMatchIndices.length === 0} onClick={() => navigateSearch('next')}><ChevronDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setIsSearchMode(false); setMessageSearchQuery(""); }}> <X className="h-4 w-4 mr-1" /> 닫기</Button>
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 p-6 custom-scrollbar">
              <div className="flex flex-col gap-1 max-w-4xl mx-auto">
                <div ref={topObserverRef} className="h-10 flex items-center justify-center">
                   {messagesLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground opacity-50" />}
                </div>

                {allMessagesInChat.length === 0 && !messagesLoading ? (
                  <div className="flex flex-col items-center justify-center h-full pt-20 text-muted-foreground">
                    <MessageSquarePlus className="h-12 w-12 mb-4 opacity-20" />
                    <p>메시지를 보내 대화를 시작해보세요!</p>
                  </div>
                ) : (
                  allMessagesInChat.map((msg: any, index: number) => (
                    <MessageBubble
                      key={msg.id || index}
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
