	// 2. POSTGRES_DSN must not contain placeholder credentials
	}
	if containsLoopbackHost(cfg.PostgresDSN) {
		log.Printf("[%s] FATAL: production POSTGRES_DSN must not use a loopback host", serviceName)
		fatal = true
	}
	redisEndpoint := cfg.RedisURL
	if redisEndpoint == "" {
		redisEndpoint = cfg.RedisAddr
	}
	if redisEndpoint == "" || containsLoopbackHost(redisEndpoint) {
		log.Printf("[%s] FATAL: production Redis must be explicitly configured with a non-loopback endpoint", serviceName)
		fatal = true
	}
}

func containsLoopbackHost(value string) bool {
	lower := strings.ToLower(value)
	return strings.Contains(lower, "localhost") ||
		strings.Contains(lower, "127.0.0.1") ||
		strings.Contains(lower, "[::1]")
}