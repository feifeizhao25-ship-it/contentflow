export type Platform = 'tiktok' | 'youtube' | 'instagram' | 'x' | 'twitter' | 'linkedin' | 'reddit';
  instagram: {
    name: 'Instagram',
  twitter: {
    name: 'X',
    maxTitleLength: 280,
    maxScriptLength: 280,
    maxHashtags: 10,
    supportsImage: true,
    apiVersion: 'v2',
  },
  x: {
    name: 'X',
    maxTitleLength: 280,
    maxScriptLength: 280,
    maxHashtags: 10,
    supportsVideo: true,
    supportsImage: true,
    apiVersion: 'v2',
  },
  linkedin: {
    name: 'LinkedIn',
    maxTitleLength: 3000,
    maxScriptLength: 3000,
    maxHashtags: 8,
    supportsVideo: true,
    supportsImage: true,
    apiVersion: 'v2',
  },
  reddit: {
    name: 'Reddit',
    maxTitleLength: 300,
    maxScriptLength: 40000,
    maxHashtags: 0,
    supportsVideo: true,
    supportsImage: true,
    apiVersion: 'v1',
  },
};
