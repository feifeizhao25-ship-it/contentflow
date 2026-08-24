export type SharePlatform = 'x' | 'linkedin' | 'copy_link' | 'qrcode';
      title: 'ContentFlow - AI content operations for global teams',
      description: 'Turn one idea into platform-ready posts, videos, and reports without losing your voice.',
      url: baseUrl,
      hashtags: ['ContentFlow', 'AIContentOps', 'CreatorWorkflow'],
      platforms: ['x', 'linkedin', 'copy_link', 'qrcode'],
    },
    script: {
      title: content?.title || 'I generated a platform-ready script with ContentFlow',
      description: 'One idea, multiple channels, clearer publishing review.',
      url: `${baseUrl}/script/${content?.scriptId || ''}`,
      hashtags: ['ContentFlow', 'AIScriptWriting'],
      platforms: ['x', 'linkedin', 'copy_link'],
    },
    video: {
      title: content?.title || 'I generated a video draft with ContentFlow',
      description: 'AI-assisted video planning, review, and platform adaptation.',
      url: `${baseUrl}/video/${content?.videoId || ''}`,
      hashtags: ['ContentFlow', 'AIVideoWorkflow'],
      platforms: ['x', 'linkedin', 'copy_link'],
export const SHARE_TEMPLATES = {
  x: { title: 'ContentFlow - AI content operations', description: 'I found a practical way to turn one idea into platform-ready content without losing my voice.' },
  linkedin: { title: 'ContentFlow for content teams', description: 'A structured workflow for creating, reviewing, scheduling, and measuring global social content.' },
  general: { title: 'I use ContentFlow for content operations', description: 'AI-assisted creation, platform adaptation, publishing review, and performance learning in one workflow.' },
};
