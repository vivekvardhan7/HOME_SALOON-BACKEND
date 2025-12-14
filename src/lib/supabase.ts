import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  logger.warn('⚠️ SUPABASE_URL not set. Supabase client may not work correctly.');
}

if (!supabaseServiceKey && !supabaseAnonKey) {
  logger.warn('⚠️ Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set. Supabase client may not work correctly.');
}

// Create Supabase client with service role key (bypasses RLS for backend operations)
// Use service role key for admin operations, anon key for user operations
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create a client with anon key for operations that should respect RLS
export const supabaseAnon = supabaseAnonKey
  ? createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : supabase;

// Test connection
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "relation does not exist" which is OK if tables aren't created yet
      throw error;
    }
    logger.info('✅ Supabase connection test successful');
    return true;
  } catch (error: any) {
    logger.error('❌ Supabase connection test failed:', error.message);
    return false;
  }
};



