package config

import "testing"

func TestContainsLoopbackHost(t *testing.T) {
	for _, value := range []string{
		"postgres://user@localhost:5432/db",
		"redis://127.0.0.1:6379",
		"rediss://[::1]:6379",
	} {
		if !containsLoopbackHost(value) {
			t.Errorf("expected loopback detection for %q", value)
		}
	}
	if containsLoopbackHost("rediss://redis.production.svc:6379") {
		t.Fatal("did not expect service DNS to be treated as loopback")
	}
}