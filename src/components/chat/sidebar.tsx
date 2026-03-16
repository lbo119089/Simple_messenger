"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MessageSquare, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  currentUserId: string;
  users: any[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onLogout: () => void;
}

export function ChatSidebar({
  currentUserId,
  users,
  selectedUserId,
  onSelectUser,
  onLogout,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const otherUsers = users.filter(u => u.id !== currentUserId);
  const filteredUsers = otherUsers.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-border w-full md:w-[320px]">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            바이브챗
          </h1>
          <Button variant="ghost" size="icon" onClick={onLogout} title="Logout">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </Button>
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
                    상태 메시지가 없습니다.
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              친구가 없습니다.
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="h-4 w-4 mr-2" /> 새로운 친구 추가
        </Button>
      </div>
    </div>
  );
}
