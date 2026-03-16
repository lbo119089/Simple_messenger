'use server';
/**
 * @fileOverview This file provides an AI flow for generating quick, context-aware reply suggestions
 * based on recent chat messages. It helps users respond faster without typing full messages.
 *
 * - aiReplySuggestions - A function that generates AI reply suggestions.
 * - AiReplySuggestionsInput - The input type for the aiReplySuggestions function.
 * - AiReplySuggestionsOutput - The return type for the aiReplySuggestions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiReplySuggestionsInputSchema = z.object({
  messages: z.array(z.object({
    sender: z.enum(['user', 'other']).describe('The sender of the message. "user" for the current user, "other" for the other participant.'),
    content: z.string().describe('The content of the message.'),
  })).describe('The recent chat history, ordered chronologically.'),
});
export type AiReplySuggestionsInput = z.infer<typeof AiReplySuggestionsInputSchema>;

const AiReplySuggestionsOutputSchema = z.object({
  suggestions: z.array(z.string().max(50)).max(3).describe('An array of up to 3 short, context-aware reply suggestions (max 50 characters each).'),
});
export type AiReplySuggestionsOutput = z.infer<typeof AiReplySuggestionsOutputSchema>;

export async function aiReplySuggestions(input: AiReplySuggestionsInput): Promise<AiReplySuggestionsOutput> {
  return aiReplySuggestionsFlow(input);
}

const aiReplySuggestionsPrompt = ai.definePrompt({
  name: 'aiReplySuggestionsPrompt',
  input: { schema: AiReplySuggestionsInputSchema },
  output: { schema: AiReplySuggestionsOutputSchema },
  prompt: `You are an AI assistant designed to provide short, context-aware reply suggestions for a chat application.
Analyze the conversation history provided and generate up to 3 concise, relevant, and helpful reply options for the current user.
Each suggestion should be no longer than 50 characters.

Conversation History:
{{#each messages}}
{{sender}}: {{content}}
{{/each}}

Based on the above conversation, generate up to 3 short reply suggestions for the current user.`,
});

const aiReplySuggestionsFlow = ai.defineFlow(
  {
    name: 'aiReplySuggestionsFlow',
    inputSchema: AiReplySuggestionsInputSchema,
    outputSchema: AiReplySuggestionsOutputSchema,
  },
  async (input) => {
    const { output } = await aiReplySuggestionsPrompt(input);
    return output!;
  }
);
