func NewWithRedis(cfg *config.Config, redisClient *redis.Client) (*Handler, error) {
	if cfg.IsProd() && redisClient == nil {
		return nil, fmt.Errorf("production gateway requires Redis-backed distributed rate limiting")
	}
	jwtMgr := auth.NewJWTManagerSimple(cfg.JWTSecret)

	routeTable := buildRouteTable()
	if cfg.IsProd() {
		for prefix, addr := range routeTable {
			target, err := url.Parse(addr)
			if err != nil || target.Scheme == "" || target.Hostname() == "" {
				return nil, fmt.Errorf("invalid production upstream for %s: %q", prefix, addr)
			}
			host := strings.ToLower(target.Hostname())
			if host == "localhost" || host == "127.0.0.1" || host == "::1" {
				return nil, fmt.Errorf(
					"production upstream %s resolves to loopback %q; configure service discovery explicitly",
					prefix, addr,
				)
			}
		}
	}
		target, err := url.Parse(addr)
		if err != nil || target.Scheme == "" || target.Host == "" {
			return nil, fmt.Errorf("invalid upstream URL for %s: %q", prefix, addr)
		}