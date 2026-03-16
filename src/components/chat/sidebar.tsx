
"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MessageSquare, LogOut, Settings, User, Check, Loader2, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useFirestore } from "@/firebase";
import { doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface ChatSidebarProps {
  currentUserId: string;
  currentUserProfile: any;
  allUsers: any[];
  friends: any[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onLogout: () => void;
}

export function ChatSidebar({
  currentUserId,
  currentUserProfile,
  allUsers,
  friends,
  selectedUserId,
  onSelectUser,
  onLogout,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  const db = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (currentUserProfile) {
      setEditUsername(currentUserProfile.username || "");
      setEditAvatar(currentUserProfile.avatarUrl || "");
    }
  }, [currentUserProfile, isEditDialogOpen]);

  // 검색된 친구 목록
  const filteredFriends = useMemo(() => {
    if (!friends) return [];
    return friends.filter((u) =>
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [friends, searchQuery]);

  // 친구 추가 가능한 사용자들 (나를 제외하고 이미 친구가 아닌 사람들)
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

  return (
    <div className="flex flex-col h-full bg-white border-r border-border w-full md:w-[320px]">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            바이브챗
          </h1>
          <div className="flex items-center gap-1">
            {/* 친구 추가 다이얼로그 */}
            <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Add Friend">
                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>친구 찾기</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="이름으로 검색..."
                      className="pl-9 h-11"
                      value={friendSearchQuery}
                      onChange={(e) => setFriendSearchQuery(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-72 rounded-xl border border-muted/20 bg-muted/5 p-2">
                    {addableUsers.length > 0 ? (
                      addableUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors mb-1">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.avatarUrl} />
                              <AvatarFallback>{user.username?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{user.username}</span>
                          </div>
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => handleAddFriend(user.id)}>
                            <Plus className="h-3 w-3" /> 추가
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-sm text-muted-foreground">
                        {friendSearchQuery ? "검색 결과가 없습니다." : "가입된 사용자가 없습니다."}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Edit Profile">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>내 프로필 수정</DialogTitle></DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-muted-foreground">아바타 변경</label>
                    <ScrollArea className="h-48 rounded-xl border border-muted p-4 bg-muted/10">
                      <div className="grid grid-cols-4 gap-4">
                        {PlaceHolderImages.map((img) => (
                          <div key={img.id} className="relative cursor-pointer flex flex-col items-center" onClick={() => setEditAvatar(img.imageUrl)}>
                            <Avatar className={cn("h-14 w-14 border-2 transition-all", editAvatar === img.imageUrl ? "border-primary scale-110 shadow-md ring-2 ring-primary/20" : "border-transparent opacity-60 grayscale-[40%]")}>
                              <AvatarImage src={img.imageUrl} /><AvatarFallback><User /></AvatarFallback>
                            </Avatar>
                            {editAvatar === img.imageUrl && <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 border-2 border-white shadow-sm z-10"><Check className="h-2.5 w-2.5" /></div>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">이름</label>
                    <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="이름을 입력하세요" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>취소</Button>
                  <Button onClick={handleUpdateProfile} disabled={isUpdating}>{isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}저장하기</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={onLogout} title="Logout"><LogOut className="h-5 w-5 text-muted-foreground" /></Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="친구 검색..." className="pl-9 bg-background border-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="px-2">
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
            내 친구 ({filteredFriends.length})
          </div>
          {filteredFriends.length > 0 ? (
            filteredFriends.map((user) => (
              <div key={user.id} className="relative group mb-1">
                <button
                  onClick={() => onSelectUser(user.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                    selectedUserId === user.id ? "bg-secondary text-primary" : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-12 w-12 border-2 border-transparent">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary">{user.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="font-semibold truncate">{user.username}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {selectedUserId === user.id ? "대화 중..." : "최근 활동 중"}
                    </div>
                  </div>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemoveFriend(user.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-all"
                  title="Remove Friend"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col gap-2 items-center">
              <UserPlus className="h-8 w-8 opacity-20" />
              <p>{searchQuery ? "검색 결과가 없습니다." : "친구를 추가하여 대화를 시작해보세요!"}</p>
              {!searchQuery && (
                <Button variant="link" size="sm" onClick={() => setIsAddFriendOpen(true)}>친구 찾으러 가기</Button>
              )}
            </div>
          )}
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
