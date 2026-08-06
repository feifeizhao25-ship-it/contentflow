    // 5. Context optimization for high-signal professional channels
    if (context?.platform === 'linkedin' && taskConfig.complexity === 'high') {
      selectedModel = 'claude-sonnet-4';
    }
