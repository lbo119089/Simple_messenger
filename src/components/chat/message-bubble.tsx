"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isUser: boolean;
}

export function MessageBubble({ content, timestamp, isUser }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex w-full mb-4 animate-fade-in-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] px-4 py-3",
          isUser ? "chat-bubble-user" : "chat-bubble-other"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        <div
          className={cn(
            "text-[10px] mt-1 opacity-70",
            isUser ? "text-right text-primary-foreground/80" : "text-left text-muted-foreground"
          )}
        >
          {format(new Date(timestamp), "HH:mm")}
        </div>
      </div>
    </div>
  );
}
