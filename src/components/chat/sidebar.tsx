
"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MessageSquare, LogOut, Settings, User, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface ChatSidebarProps {
  currentUserId: string;
  currentUserProfile: any;
  users: any[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onLogout: () => void;
}

export function ChatSidebar({
  currentUserId,
  currentUserProfile,
  users,
  selectedUserId,
  onSelectUser,
  onLogout,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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

  // currentUserId가 있을 때만 필터링을 수행하여 로그아웃 시 본인이 목록에 뜨는 것을 방지
  const otherUsers = currentUserId ? users.filter(u => u.id !== currentUserId) : [];
  const filteredUsers = otherUsers.filter((u) =>
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-border w-full md:w-[320px]">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            바이브챗
          </h1>
          <div className="flex items-center gap-1">
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Edit Profile">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>내 프로필 수정</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-muted-foreground">아바타 변경 (12개 선택지)</label>
                    <ScrollArea className="h-48 rounded-xl border border-muted p-4 bg-muted/10">
                      <div className="grid grid-cols-4 gap-4">
                        {PlaceHolderImages.map((img) => (
                          <div 
                            key={img.id}
                            className="relative cursor-pointer flex flex-col items-center"
                            onClick={() => setEditAvatar(img.imageUrl)}
                          >
                            <Avatar className={cn(
                              "h-14 w-14 border-2 transition-all",
                              editAvatar === img.imageUrl ? "border-primary scale-110 shadow-md ring-2 ring-primary/10" : "border-transparent opacity-60 grayscale-[40%] hover:opacity-100 hover:grayscale-0"
                            )}>
                              <AvatarImage src={img.imageUrl} />
                              <AvatarFallback><User /></AvatarFallback>
                            </Avatar>
                            {editAvatar === img.imageUrl && (
                              <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 border-2 border-white shadow-sm z-10">
                                <Check className="h-2.5 w-2.5" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">이름</label>
                    <Input 
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="이름을 입력하세요"
                      className="h-11"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>취소</Button>
                  <Button onClick={handleUpdateProfile} disabled={isUpdating} className="min-w-[100px]">
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    저장하기
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={onLogout} title="Logout">
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="친구 검색..."
            className="pl-9 bg-background border-none ring-offset-background focus-visible:ring-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="px-2">
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            친구 목록
          </div>
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg transition-colors group mb-1",
                  selectedUserId === user.id
                    ? "bg-secondary text-primary"
                    : "hover:bg-muted"
                )}
              >
                <Avatar className="h-12 w-12 border-2 border-transparent group-hover:border-primary/20">
                  <AvatarImage src={user.avatarUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user.username ? user.username[0].toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="font-semibold truncate">{user.username}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedUserId === user.id ? "대화 중..." : "최근 활동 중"}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {searchQuery ? "검색 결과가 없습니다." : "친구가 없습니다."}
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

  async function handleUpdateProfile() {
    if (!db || !currentUserId) return;
    
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", currentUserId), {
        username: editUsername,
        avatarUrl: editAvatar
      });
      toast({
        title: "프로필 업데이트 완료",
        description: "사용자 정보가 성공적으로 변경되었습니다.",
      });
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "업데이트 실패",
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  }
}
