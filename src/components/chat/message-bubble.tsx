
"use client";

import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isUser: boolean;
  senderName?: string;
  senderAvatar?: string;
}

export function MessageBubble({ content, timestamp, isUser, senderName, senderAvatar }: MessageBubbleProps) {
  const date = new Date(timestamp);
  const formattedTime = isValid(date) ? format(date, "HH:mm") : "--:--";

  return (
    <div
      className={cn(
        "flex w-full mb-4 animate-fade-in-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn("flex max-w-[75%] gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
        {!isUser && senderAvatar !== undefined && (
          <Avatar className="h-8 w-8 mt-1 shrink-0">
            <AvatarImage src={senderAvatar} />
            <AvatarFallback>{senderName?.[0]}</AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex flex-col">
          {!isUser && senderName && (
            <span className="text-[11px] font-medium text-muted-foreground mb-1 ml-1">{senderName}</span>
          )}
          
          <div className="flex items-end gap-2">
            {isUser && <span className="text-[10px] text-muted-foreground mb-1">{formattedTime}</span>}
            
            <div
              className={cn(
                "px-4 py-3 shadow-sm",
                isUser ? "chat-bubble-user" : "chat-bubble-other"
              )}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>

            {!isUser && <span className="text-[10px] text-muted-foreground mb-1">{formattedTime}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
