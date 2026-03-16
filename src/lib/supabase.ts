
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vnszmzogkdqiicvpevlf.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_jFyIzw_S3Zizf-gJ8SLhCA_rN3v6lTI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
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
