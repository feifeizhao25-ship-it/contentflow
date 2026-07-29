  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    // Seed enough profile context for the personalized dashboard to choose the active layout.
    const storage = new Map([
      ['userId', 'test-user'],
      ['userNiche', 'b2b'],
    ]);
    delete (window as any).localStorage;
    (window as any).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };
  });
