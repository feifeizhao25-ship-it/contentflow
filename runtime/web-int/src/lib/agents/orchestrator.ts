      titles: [
        `${p.topic}: 5 Practical Moves Worth Testing`,
        `What Most Teams Miss About ${p.topic}`,
        `${p.topic} Getting Started Guide`,
      ],
      hooks: [
        `Most teams treat ${p.topic} as a tactic. It is really an operating system.`,
        `If ${p.topic} feels noisy, start with these three signals.`,
        `Here is the simplest way to turn ${p.topic} into a repeatable workflow.`,
      ],
      script: `# ${p.topic}\n\n## Opening\nHere is the practical version of ${p.topic}.\n\n## Body\nStart with one measurable audience problem, turn it into a platform-native post, then review the result before scaling.\n\n## Ending\nSave this workflow and adapt it for your next campaign.`,
      cta: 'Save this for your next planning session and follow for practical content operations.',
      tiktok: { max_title_length: 2200, max_description: 2200, cover_ratio: '9:16' },
      instagram: { max_title_length: 2200, max_description: 2200, cover_ratio: '4:5' },
      youtube: { max_title_length: 100, max_description: 5000, cover_ratio: '16:9' },
      x: { max_title_length: 280, max_description: 280, cover_ratio: '16:9' },
      linkedin: { max_title_length: 3000, max_description: 3000, cover_ratio: '1.91:1' },
      reddit: { max_title_length: 300, max_description: 40000, cover_ratio: '16:9' },
    const platforms = ['linkedin', 'x', 'instagram', 'tiktok', 'youtube'];
    const days = ['Monday', 'Wednesday', 'Friday'];
      hook: `A practical angle most teams miss: version ${i + 1}`,
      platform: ['linkedin', 'x', 'tiktok'],
