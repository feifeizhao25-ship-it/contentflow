func (c Config) ClientTLSConfig() (*tls.Config, error) {
	if !c.Enabled {
		return nil, nil
	}
	if c.Insecure && os.Getenv("APP_ENV") == "production" {
		return nil, fmt.Errorf("TLS_INSECURE_SKIP_VERIFY is forbidden in production")
	}
	cfg := &tls.Config{
		// #nosec G402 -- production use is rejected above; this flag is only
		// available for explicit local-development environments.
		InsecureSkipVerify: c.Insecure,
		ServerName:         c.ServerName,
	}