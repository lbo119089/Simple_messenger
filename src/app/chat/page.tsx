"use client";

import { useState, useEffect, useRef } from "react";
import { ChatSidebar } from "@/components/chat/sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { AiSuggestions } from "@/components/chat/ai-suggestions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Phone, Video, Info, MoreVertical, MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";

// Mock Data
const MOCK_USER = {
  id: "user_1",
  username: "나 (User)",
  avatar_url: "https://picsum.photos/seed/me/200/200",
};

const MOCK_CONVERSATIONS = [
  {
    other_user: {
      id: "user_2",
      username: "하늘이",
      avatar_url: "https://picsum.photos/seed/sky/200/200",
    },
    last_message: { content: "오늘 날씨 정말 좋네요!", created_at: new Date().toISOString() },
    unread: true,
  },
  {
    other_user: {
      id: "user_3",
      username: "바이브",
      avatar_url: "https://picsum.photos/seed/vibe/200/200",
    },
    last_message: { content: "네, 다음에 또 연락주세요.", created_at: new Date().toISOString() },
    unread: false,
  },
];

const MOCK_MESSAGES_MAP: Record<string, any[]> = {
  "user_2": [
    { id: "1", sender_id: "user_2", content: "안녕하세요!", created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: "2", sender_id: "user_1", content: "반가워요! 어떻게 지내세요?", created_at: new Date(Date.now() - 3000000).toISOString() },
    { id: "3", sender_id: "user_2", content: "잘 지내고 있어요. 오늘 날씨 정말 좋네요!", created_at: new Date(Date.now() - 60000).toISOString() },
  ],
  "user_3": [
    { id: "1", sender_id: "user_3", content: "프로젝트 진행 상황은 어떤가요?", created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: "2", sender_id: "user_1", content: "거의 다 마무리 되었습니다.", created_at: new Date(Date.now() - 80000000).toISOString() },
    { id: "3", sender_id: "user_3", content: "네, 다음에 또 연락주세요.", created_at: new Date(Date.now() - 70000000).toISOString() },
  ]
};

export default function ChatPage() {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedUserId && MOCK_MESSAGES_MAP[selectedUserId]) {
      setMessages(MOCK_MESSAGES_MAP[selectedUserId]);
    } else {
      setMessages([]);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (content: string) => {
    if (!content.trim() || !selectedUserId) return;
    
    const newMessage = {
      id: Date.now().toString(),
      sender_id: MOCK_USER.id,
      content,
      created_at: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
  };

  const selectedUser = MOCK_CONVERSATIONS.find(c => c.other_user.id === selectedUserId)?.other_user;

  const aiMessageFormat = messages.map(m => ({
    sender: m.sender_id === MOCK_USER.id ? "user" as const : "other" as const,
    content: m.content
  }));

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <ChatSidebar
        currentUserId={MOCK_USER.id}
        conversations={MOCK_CONVERSATIONS}
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
        onLogout={() => router.push("/")}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {selectedUserId ? (
          <>
            {/* Header */}
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

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-6 custom-scrollbar" viewportRef={scrollRef}>
              <div className="flex flex-col gap-1 max-w-4xl mx-auto">
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
                      isUser={msg.sender_id === MOCK_USER.id}
                    />
                  ))
                )}
              </div>
            </ScrollArea>

            {/* AI Suggestions & Input */}
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
            <Button className="mt-8 bg-primary hover:bg-primary/90 px-8" onClick={() => setSelectedUserId("user_2")}>
              최근 대화 보기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
