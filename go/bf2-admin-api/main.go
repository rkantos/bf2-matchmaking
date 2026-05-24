package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultListenAddr     = "127.0.0.1:8443"
	defaultTimeout        = 30 * time.Second
	defaultMonoPath       = "/home/bf2/mono-1.1.12.1/bin/mono"
	defaultBF2CCDPath     = "/home/bf2/server/bf2ccd.exe"
	defaultBF2Home        = "/home/bf2"
	defaultScreenName     = "bf2server"
	defaultServerProfile  = "BF2_Playerbase_XX"
)

var (
	apiKey         []byte
	cmdTimeout     time.Duration
	monoPath       string
	bf2ccdPath     string
	bf2Home        string
	screenName     string
	serverProfile  string
	unblockCommand = []string{"sudo", "/usr/bin/firewall-cmd", "--reload"}

	profileRegex = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

	restartMu sync.Mutex
)

type restartRequest struct {
	Profile string `json:"profile,omitempty"`
}

type response struct {
	OK     bool   `json:"ok"`
	Action string `json:"action,omitempty"`
	Detail string `json:"detail,omitempty"`
	Error  string `json:"error,omitempty"`
}

type statusResponse struct {
	OK      bool   `json:"ok"`
	Action  string `json:"action"`
	Running bool   `json:"running"`
	PID     int    `json:"pid,omitempty"`
	Profile string `json:"profile,omitempty"`
}

func main() {
	key := os.Getenv("API_KEY")
	if key == "" {
		log.Fatal("API_KEY environment variable is required")
	}
	apiKey = []byte(key)

	monoPath = envOr("MONO_PATH", defaultMonoPath)
	bf2ccdPath = envOr("BF2CCD_PATH", defaultBF2CCDPath)
	bf2Home = envOr("BF2_HOME", defaultBF2Home)
	screenName = envOr("SCREEN_NAME", defaultScreenName)
	serverProfile = envOr("BF2_PROFILE", defaultServerProfile)

	if !profileRegex.MatchString(serverProfile) {
		log.Fatalf("BF2_PROFILE %q does not match %s", serverProfile, profileRegex)
	}

	cmdTimeout = defaultTimeout
	if v := os.Getenv("CMD_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			log.Fatalf("invalid CMD_TIMEOUT: %v", err)
		}
		cmdTimeout = d
	}

	listenAddr := envOr("LISTEN_ADDR", defaultListenAddr)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/status", authMiddleware(handleStatus))
	mux.HandleFunc("/restart", authMiddleware(handleRestart))

	srv := &http.Server{
		Addr:              listenAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      cmdTimeout + 10*time.Second,
		IdleTimeout:       60 * time.Second,
	}

	certFile := os.Getenv("TLS_CERT")
	keyFile := os.Getenv("TLS_KEY")

	if certFile != "" && keyFile != "" {
		log.Printf("listening on https://%s", listenAddr)
		log.Fatal(srv.ListenAndServeTLS(certFile, keyFile))
	} else {
		log.Printf("listening on http://%s (no TLS — bind to localhost only)", listenAddr)
		log.Fatal(srv.ListenAndServe())
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		const prefix = "Bearer "
		if !strings.HasPrefix(header, prefix) {
			log.Printf("auth failure from %s: missing bearer", r.RemoteAddr)
			writeJSON(w, http.StatusUnauthorized, response{OK: false, Error: "unauthorized"})
			return
		}
		provided := []byte(strings.TrimPrefix(header, prefix))
		if subtle.ConstantTimeCompare(provided, apiKey) != 1 {
			log.Printf("auth failure from %s: bad key", r.RemoteAddr)
			writeJSON(w, http.StatusUnauthorized, response{OK: false, Error: "unauthorized"})
			return
		}
		next(w, r)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, response{OK: true, Action: "health"})
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{OK: false, Error: "method not allowed"})
		return
	}

	running, pid, err := serverProcess(r.Context())
	if err != nil {
		log.Printf("/status check failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, response{OK: false, Error: "status check failed"})
		return
	}

	writeJSON(w, http.StatusOK, statusResponse{
		OK:      true,
		Action:  "status",
		Running: running,
		PID:     pid,
		Profile: serverProfile,
	})
}

func handleRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, response{OK: false, Error: "method not allowed"})
		return
	}

	var req restartRequest
	if r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, response{OK: false, Error: "invalid json body"})
			return
		}
	}

	profile := serverProfile
	if req.Profile != "" {
		if !profileRegex.MatchString(req.Profile) {
			writeJSON(w, http.StatusBadRequest, response{OK: false, Error: "invalid profile"})
			return
		}
		profile = req.Profile
	}

	if !restartMu.TryLock() {
		writeJSON(w, http.StatusConflict, response{OK: false, Error: "restart already in progress"})
		return
	}
	defer restartMu.Unlock()

	log.Printf("/restart from %s profile=%s", r.RemoteAddr, profile)

	if err := restartBF2(r.Context(), profile); err != nil {
		log.Printf("/restart failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, response{OK: false, Error: "restart failed: " + err.Error()})
		return
	}

	if err := runCommand(r.Context(), "", unblockCommand[0], unblockCommand[1:]...); err != nil {
		log.Printf("firewall unblock failed (non-fatal): %v", err)
	}

	writeJSON(w, http.StatusOK, response{
		OK:     true,
		Action: "restart",
		Detail: "server restarted with profile " + profile,
	})
}

// restartBF2 mirrors scripts/restart-bf2.sh:
//   1. mono bf2ccd.exe -kill            (best effort — server may not be running)
//   2. screen -AdmS <name> mono bf2ccd.exe -showlog -autostart <profile>   (cwd = bf2Home)
func restartBF2(ctx context.Context, profile string) error {
	if err := runCommand(ctx, "", monoPath, bf2ccdPath, "-kill"); err != nil {
		log.Printf("kill returned error (continuing): %v", err)
	}

	return runCommand(ctx, bf2Home,
		"screen", "-AdmS", screenName,
		monoPath, bf2ccdPath, "-showlog", "-autostart", profile,
	)
}

func serverProcess(parent context.Context) (bool, int, error) {
	ctx, cancel := context.WithTimeout(parent, 5*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, "pgrep", "-f", bf2ccdPath).Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return false, 0, nil
		}
		return false, 0, err
	}

	first := strings.SplitN(strings.TrimSpace(string(out)), "\n", 2)[0]
	pid, err := strconv.Atoi(first)
	if err != nil {
		return true, 0, nil
	}
	return true, pid, nil
}

func runCommand(parent context.Context, dir, name string, args ...string) error {
	ctx, cancel := context.WithTimeout(parent, cmdTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	if dir != "" {
		cmd.Dir = dir
	}
	out, err := cmd.CombinedOutput()
	if len(out) > 0 {
		log.Printf("cmd %s output: %s", name, strings.TrimSpace(string(out)))
	}
	if err != nil {
		return errors.New(name + ": " + err.Error())
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
