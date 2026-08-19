const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getLoginData = (payload: any) => payload?.data || payload || {};

const LoginScreen = () => {
    setLoading(true);
    try {
      const res: any = await apiClient.post('/auth/login', {email, password});
      const data = getLoginData(res.data);
      const token = data.access_token || data.token || data.jwt;
      if (!token) {
        throw new Error(t('请检查您的凭据_lpv5'));
      }
      await setAccessToken(token);
      setUser(data.user || data.profile || {id: email, email});
    } catch (err: any) {
      const message = err?.response?.data?.message || t('请检查您的凭据_lpv5');
      Alert.alert(t('登录失败_fcdp'), message);
