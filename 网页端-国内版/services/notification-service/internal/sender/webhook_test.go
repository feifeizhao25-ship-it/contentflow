package sender

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWebhookUsesHMACSignatureWithoutExposingSecret(t *testing.T) {
	const secret = "production-webhook-signing-secret"
	var signature, timestamp, leakedSecret string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		signature = r.Header.Get("X-Webhook-Signature")
		timestamp = r.Header.Get("X-Webhook-Timestamp")
		leakedSecret = r.Header.Get("X-Webhook-Secret")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	err := NewWebhookSender().Send(context.Background(), WebhookConfig{
		URL:    server.URL,
		Format: "raw",
		Secret: secret,
	}, WebhookPayload{Event: "report.ready", Title: "Report", Message: "Ready"})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if timestamp == "" {
		t.Fatal("expected signed timestamp")
	}
	if !strings.HasPrefix(signature, "sha256=") || len(signature) != len("sha256=")+64 {
		t.Fatalf("unexpected signature format: %q", signature)
	}
	if leakedSecret != "" || strings.Contains(signature, secret) {
		t.Fatal("webhook secret must never be sent to the destination")
	}
}