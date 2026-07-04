import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yxammlhdagjvtkoevezn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YW1tbGhkYWdqdnRrb2V2ZXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODEyNzUsImV4cCI6MjA5ODY1NzI3NX0.AZ1c7s9vPTs5F_plWA5JpnUQJXcpIvD2bPgkZK3LWyM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});
