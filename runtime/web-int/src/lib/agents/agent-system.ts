/**
 * Agent System - Agent AutomationOperationsSeriesSystem
 * Supports global publishing operations for TikTok, YouTube, Instagram, X, LinkedIn and Reddit.
 */
export type AgentType = 'tiktok' | 'youtube' | 'instagram' | 'x' | 'twitter' | 'linkedin' | 'reddit';
    const platformMap: Record<AgentType, string> = {
      tiktok: 'tiktok',
      youtube: 'youtube',
      instagram: 'instagram',
      x: 'x',
      twitter: 'x',
      linkedin: 'linkedin',
      reddit: 'reddit',
    };
