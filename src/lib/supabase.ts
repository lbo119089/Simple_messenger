import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
};

export type Message = {
  id: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  content: string;
};

export type Conversation = {
  other_user: Profile;
  last_message: Message;
};
