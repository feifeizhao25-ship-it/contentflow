	if redisClient != nil {
		cancel()
	}
	if cfg.IsProd() && redisClient == nil {
		log.Fatal("❌ Production gateway requires a reachable Redis service for distributed rate limiting")
	}

	h, err := handler.NewWithRedis(cfg, redisClient)