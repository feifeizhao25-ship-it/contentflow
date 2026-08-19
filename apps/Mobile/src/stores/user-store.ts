      setUser: user => set({user, isAuthenticated: true}),
      updateProfile: async payload => {
        const res: any = await apiClient.put('/users/me', payload);
        const updated = res.data as User;
        set(state => ({
          user: state.user ? {...state.user, ...updated} : updated,
          isAuthenticated: true,
        }));
        return updated;
      },
      fetchProfile: async () => {
        const res: any = await apiClient.get('/users/me');
        const user = res.data as User;
        set({user, isAuthenticated: true});
      },
