export interface PlatformAccount {
  id: string;
  tenant_id: string;
  platform: 'tiktok' | 'youtube' | 'instagram' | 'x' | 'twitter' | 'linkedin' | 'reddit';
  account_name: string;
