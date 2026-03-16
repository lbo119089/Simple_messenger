
"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MessageSquare, LogOut, Settings, User, Check, Loader2, UserPlus, UserMinus, Users, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, updateDoc, setDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface ChatSidebarProps {
  currentUserId: string;
  currentUserProfile: any;
  allUsers: any[];
  friends: any[];
  groups: any[];
  selectedChat: { type: "private" | "group"; id: string } | null;
  onSelectChat: (chat: { type: "private" | "group"; id: string }) => void;
  onLogout: () => void;
}

export function ChatSidebar({
  currentUserId,
  currentUserProfile,
  allUsers,
  friends,
  groups,
  selectedChat,
  onSelectChat,
  onLogout,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  
  const [editUsername, setEditUsername] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  
  const db = useFirestore();
  const { toast } = useToast();

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !currentUserId) return null;
    return query(collection(db, "messages"), where("participants", "array-contains", currentUserId));
  }, [db, currentUserId]);
  const { data: allRelevantMessages, isLoading: messagesLoading } = useCollection(messagesQuery);

  const readStatusQuery = useMemoFirebase(() => {
    if (!db || !currentUserId) return null;
    return query(collection(db, "users", currentUserId, "readStatus"));
  }, [db, currentUserId]);
  const { data: readStatuses, isLoading: readStatusesLoading } = useCollection(readStatusQuery);

  const unreadCounts = useMemo(() => {
    // 모든 관련 데이터(메시지, 읽음 상태)가 완전히 로드될 때까지 계산을 수행하지 않음 (깜빡임 방지 핵심)
    if (messagesLoading || readStatusesLoading || !currentUserId) return {};
    if (!allRelevantMessages || !readStatuses) return {};
    
    const counts: Record<string, number> = {};
    const readMap: Record<string, number> = {};
    
    // 읽음 상태 맵 구성
    readStatuses.forEach(status => {
      const time = status.lastReadAt?.toMillis?.() || (status.lastReadAt?.seconds ? status.lastReadAt.seconds * 1000 : 0);
      readMap[status.id] = time;
    });

    allRelevantMessages.forEach((msg: any) => {
      // 본인이 보낸 메시지는 카운트 제외
      if (msg.senderId === currentUserId) return;
      
      // 채팅방 ID 결정 (그룹 ID 또는 상대방 UID)
      const chatId = msg.groupId || msg.participants?.find((p: string) => p !== currentUserId);
      if (!chatId) return;

      // 현재 선택된 채팅방이면 배지를 표시하지 않음 (사용자가 이미 보고 있음)
      if (selectedChat && selectedChat.id === chatId) return;

      const lastRead = readMap[chatId] || 0;
      const msgTime = msg.createdAt?.toMillis?.() || (msg.createdAt?.seconds ? msg.createdAt.seconds * 1000 : 0);

      // 메시지 시간이 마지막 읽은 시간보다 크고, 메시지 시간이 유효할 때만 카운트
      if (msgTime > 0 && msgTime > lastRead) {
        counts[chatId] = (counts[chatId] || 0) + 1;
      }
    });

    return counts;
  }, [allRelevantMessages, readStatuses, currentUserId, selectedChat, messagesLoading, readStatusesLoading]);

  useEffect(() => {
    if (currentUserProfile) {
      setEditUsername(currentUserProfile.username || "");
      setEditAvatar(currentUserProfile.avatarUrl || "");
    }
  }, [currentUserProfile, isEditDialogOpen]);

  const filteredFriends = useMemo(() => {
    if (!friends) return [];
    return friends.filter((u) =>
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [friends, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    return groups.filter((g) =>
      g.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groups, searchQuery]);

  const addableUsers = useMemo(() => {
    if (!allUsers || !currentUserId || !friends) return [];
    const friendIds = friends.map(f => f.id);
    return allUsers
      .filter(u => u.id !== currentUserId && !friendIds.includes(u.id))
      .filter(u => u.username?.toLowerCase().includes(friendSearchQuery.toLowerCase()));
  }, [allUsers, currentUserId, friends, friendSearchQuery]);

  async function handleUpdateProfile() {
    if (!db || !currentUserId) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", currentUserId), {
        username: editUsername,
        avatarUrl: editAvatar
      });
      toast({ title: "프로필 업데이트 완료" });
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "업데이트 실패", description: error.message });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddFriend(friendId: string) {
    if (!db || !currentUserId) return;
    try {
      await setDoc(doc(db, "users", currentUserId, "friends", friendId), {
        addedAt: new Date().toISOString()
      });
      toast({ title: "친구 추가 완료!" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "친구 추가 실패", description: error.message });
    }
  }

  async function handleRemoveFriend(friendId: string) {
    if (!db || !currentUserId) return;
    try {
      await deleteDoc(doc(db, "users", currentUserId, "friends", friendId));
      toast({ title: "친구 삭제 완료" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "친구 삭제 실패", description: error.message });
    }
  }

  async function handleCreateGroup() {
    if (!db || !currentUserId || !groupName || selectedFriendsForGroup.length === 0) {
      toast({ variant: "destructive", title: "정보 부족", description: "그룹 이름과 멤버를 선택해주세요." });
      return;
    }
    setIsCreatingGroup(true);
    try {
      const groupData = {
        name: groupName,
        members: [...selectedFriendsForGroup, currentUserId],
        createdBy: currentUserId,
        createdAt: serverTimestamp(),
        avatarUrl: `https://picsum.photos/seed/${groupName}/200/200`
      };
      const docRef = await addDoc(collection(db, "groups"), groupData);
      toast({ title: "그룹 생성 완료!" });
      setGroupName("");
      setSelectedFriendsForGroup([]);
      setIsCreateGroupOpen(false);
      onSelectChat({ type: "group", id: docRef.id });
    } catch (error: any) {
      toast({ variant: "destructive", title: "그룹 생성 실패", description: error.message });
    } finally {
      setIsCreatingGroup(false);
    }
  }

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriendsForGroup(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-border w-full md:w-[320px]">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            바이브챗
          </h1>
          <div className="flex items-center gap-1">
            <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Create Group">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>새 그룹 채팅</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">그룹 이름</label>
                    <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="그룹 이름을 입력하세요" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">멤버 선택 ({selectedFriendsForGroup.length})</label>
                    <ScrollArea className="h-48 border rounded-md p-2">
                      {friends.length > 0 ? (
                        friends.map(friend => (
                          <div key={friend.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => toggleFriendSelection(friend.id)}>
                            <Checkbox checked={selectedFriendsForGroup.includes(friend.id)} />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={friend.avatarUrl} />
                              <AvatarFallback>{friend.username?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{friend.username}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-center text-muted-foreground py-4">친구를 먼저 추가해주세요.</p>
                      )}
                    </ScrollArea>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateGroupOpen(false)}>취소</Button>
                  <Button onClick={handleCreateGroup} disabled={isCreatingGroup || !groupName || selectedFriendsForGroup.length === 0}>
                    {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : "생성하기"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Add Friend">
                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>친구 찾기</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="이름으로 검색..." className="pl-9 h-11" value={friendSearchQuery} onChange={(e) => setFriendSearchQuery(e.target.value)} />
                  </div>
                  <ScrollArea className="h-72 rounded-xl border border-muted/20 bg-muted/5 p-2">
                    {addableUsers.length > 0 ? (
                      addableUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors mb-1">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.username?.[0]}</AvatarFallback></Avatar>
                            <span className="font-medium text-sm">{user.username}</span>
                          </div>
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => handleAddFriend(user.id)}><Plus className="h-3 w-3" /> 추가</Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-sm text-muted-foreground">검색 결과가 없습니다.</div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild><Button variant="ghost" size="icon"><Settings className="h-5 w-5 text-muted-foreground" /></Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>내 프로필 수정</DialogTitle></DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">아바타 변경</label>
                    <ScrollArea className="h-48 rounded-xl border border-muted p-4 bg-muted/10">
                      <div className="grid grid-cols-4 gap-4">
                        {PlaceHolderImages.map((img) => (
                          <div key={img.id} className="relative cursor-pointer flex flex-col items-center" onClick={() => setEditAvatar(img.imageUrl)}>
                            <Avatar className={cn("h-14 w-14 border-2 transition-all", editAvatar === img.imageUrl ? "border-primary scale-110 shadow-md ring-2 ring-primary/20" : "border-transparent opacity-60 grayscale-[40%]")}><AvatarImage src={img.imageUrl} /><AvatarFallback><User /></AvatarFallback></Avatar>
                            {editAvatar === img.imageUrl && <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 border-2 border-white shadow-sm z-10"><Check className="h-2.5 w-2.5" /></div>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">이름</label>
                    <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>취소</Button>
                  <Button onClick={handleUpdateProfile} disabled={isUpdating}>{isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}저장하기</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={onLogout}><LogOut className="h-5 w-5 text-muted-foreground" /></Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="검색..." className="pl-9 bg-background border-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="px-2 space-y-4">
          <div>
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Users className="h-3 w-3" /> 그룹 ({filteredGroups.length})
            </div>
            {filteredGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => onSelectChat({ type: "group", id: group.id })}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg transition-colors mb-1 relative",
                  selectedChat?.type === "group" && selectedChat.id === group.id ? "bg-secondary text-primary" : "hover:bg-muted"
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={group.avatarUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary"><Users className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="font-semibold truncate text-sm">{group.name}</div>
                  <div className="text-[10px] text-muted-foreground">멤버 {group.members?.length}명</div>
                </div>
                {unreadCounts[group.id] > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center rounded-full p-1 text-[10px] animate-in zoom-in duration-200">
                    {unreadCounts[group.id]}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <div>
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <User className="h-3 w-3" /> 친구 ({filteredFriends.length})
            </div>
            {filteredFriends.map((user) => (
              <div key={user.id} className="relative group mb-1">
                <button
                  onClick={() => onSelectChat({ type: "private", id: user.id })}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                    selectedChat?.type === "private" && selectedChat.id === user.id ? "bg-secondary text-primary" : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary">{user.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="font-semibold truncate text-sm">{user.username}</div>
                    <div className="text-[10px] text-muted-foreground truncate">최근 활동 중</div>
                  </div>
                  {unreadCounts[user.id] > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center rounded-full p-1 text-[10px] animate-in zoom-in duration-200">
                      {unreadCounts[user.id]}
                    </Badge>
                  )}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemoveFriend(user.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-all"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            ))}
            {filteredFriends.length === 0 && !searchQuery && (
              <div className="p-4 text-center text-xs text-muted-foreground">친구를 추가해보세요!</div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <Avatar className="h-10 w-10 border border-white">
            <AvatarImage src={currentUserProfile?.avatarUrl} />
            <AvatarFallback>{currentUserProfile?.username?.[0] || <User />}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate">{currentUserProfile?.username}</p>
            <p className="text-[10px] text-muted-foreground truncate">내 프로필</p>
          </div>
        </div>
      </div>
    </div>
  );
}
