import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://localhost:3000/mock-supabase';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key';

// Only create a real client if the URL looks valid, otherwise we might see crashes in dev
export const supabase = (supabaseUrl && !supabaseUrl.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://localhost:3000/mock-supabase', 'mock-key'); // Fallback to something that won't resolve to a live server but won't crash either

// Database types (will be generated from Supabase)
export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended';
  limits: {
    accounts?: number;
    members?: number;
    monthly_posts?: number;
    ai_generations?: number;
    storage_gb?: number;
  };
  settings?: Record<string, any>;
  created_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Content {
  id: string;
  tenant_id: string;
  created_by: string;
  content_type: 'article' | 'video' | 'image';
  title: string;
  body?: string;
  media_urls?: string[];
  tags?: string[];
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
  source: 'manual' | 'ai_generated';
  ai_params?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PlatformAccount {
  id: string;
  tenant_id: string;
  platform: 'douyin' | 'xiaohongshu' | 'weixin' | 'weibo' | 'bilibili' | 'zhihu' | 'kuaishou' | 'toutiao';
  account_name: string;
  account_id?: string;
  avatar_url?: string;
  follower_count?: number;
  auth_type: 'oauth' | 'cookie' | 'token';
  auth_data?: Record<string, any>;
  status: 'active' | 'expired' | 'error';
  expires_at?: string;
  created_at: string;
}
