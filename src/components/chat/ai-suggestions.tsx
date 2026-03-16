"use client";

import { useEffect, useState } from "react";
import { aiReplySuggestions, type AiReplySuggestionsInput } from "@/ai/flows/ai-reply-suggestions";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface AiSuggestionsProps {
  messages: { sender: "user" | "other"; content: string }[];
  onSelect: (suggestion: string) => void;
}

export function AiSuggestions({ messages, onSelect }: AiSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (messages.length === 0) return;
    
    // Only trigger if the last message was from "other"
    if (messages[messages.length - 1].sender !== "other") {
      setSuggestions([]);
      return;
    }

    async function fetchSuggestions() {
      setLoading(true);
      try {
        const input: AiReplySuggestionsInput = {
          messages: messages.slice(-5), // Use last 5 messages for context
        };
        const result = await aiReplySuggestions(input);
        setSuggestions(result.suggestions);
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchSuggestions, 1000); // Slight delay for natural feel
    return () => clearTimeout(timer);
  }, [messages]);

  if (suggestions.length === 0 && !loading) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 animate-fade-in-up">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
        <Sparkles className="h-3 w-3 text-accent" />
        AI Suggests:
      </div>
      {loading ? (
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 w-24 bg-muted animate-pulse rounded-full" />
          ))}
        </div>
      ) : (
        suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelect(suggestion)}
            className="rounded-full bg-white/80 hover:bg-accent hover:text-accent-foreground border-accent/20 text-xs transition-all duration-300"
          >
            {suggestion}
          </Button>
        ))
      )}
    </div>
  );
}
