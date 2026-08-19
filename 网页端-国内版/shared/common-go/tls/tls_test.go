package tls

import (
	"strings"
	"testing"
)

func TestClientTLSConfigRejectsInsecureVerificationInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	_, err := (Config{Enabled: true, Insecure: true}).ClientTLSConfig()
	if err == nil || !strings.Contains(err.Error(), "forbidden in production") {
		t.Fatalf("expected production insecure TLS rejection, got %v", err)
	}
}

func TestClientTLSConfigAllowsExplicitDevelopmentInsecureMode(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	cfg, err := (Config{Enabled: true, Insecure: true}).ClientTLSConfig()
	if err != nil {
		t.Fatalf("expected development config, got %v", err)
	}
	if !cfg.InsecureSkipVerify {
		t.Fatal("expected explicit development insecure mode")
	}
}