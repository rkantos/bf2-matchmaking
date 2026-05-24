# bf2-admin-api

Small HTTP control server that runs on the BF2 game-server host and exposes
fixed endpoints for restarting and inspecting the server. Designed for
machine-to-machine use with a shared API key. See [SPEC.md](./SPEC.md) for the
full design rationale.

## Endpoints

| Method | Path       | Auth | Description |
|--------|------------|------|-------------|
| GET    | `/health`  | no   | Liveness check. |
| GET    | `/status`  | yes  | Returns `{running, pid, profile}` based on `pgrep` of the BF2 control daemon. |
| POST   | `/restart` | yes  | Restarts the BF2 server. Optional body: `{"profile": "<name>"}`. |

Auth header: `Authorization: Bearer <API_KEY>`.

## Configuration

All settings come from environment variables.

| Variable        | Required | Default                                      | Notes |
|-----------------|----------|----------------------------------------------|-------|
| `API_KEY`       | yes      | —                                            | Long random string (32+ bytes). |
| `LISTEN_ADDR`   | no       | `127.0.0.1:8443`                             | Keep on localhost; reach it via SSH tunnel or VPN. |
| `TLS_CERT`      | no       | —                                            | If set with `TLS_KEY`, server terminates TLS itself. |
| `TLS_KEY`       | no       | —                                            | |
| `CMD_TIMEOUT`   | no       | `30s`                                        | Go duration string. Bounds each subprocess. |
| `MONO_PATH`     | no       | `/home/bf2/mono-1.1.12.1/bin/mono`           | |
| `BF2CCD_PATH`   | no       | `/home/bf2/server/bf2ccd.exe`                | |
| `BF2_HOME`      | no       | `/home/bf2`                                  | Working directory for the screen session. |
| `SCREEN_NAME`   | no       | `bf2server`                                  | Name of the detached screen session. |
| `BF2_PROFILE`   | no       | `BF2_Playerbase_XX`                          | Default autostart profile. Validated against `^[A-Za-z0-9_]+$`. |

## Build

Cross-compile a static Linux binary from any machine — no Go toolchain needed
on the server:

```bash
cd go/bf2-admin-api
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bf2-admin-api .
```

`-s -w` strips debug info; the resulting binary is ~6 MB.

## Distribute

```bash
scp bf2-admin-api bf2@<host>:/usr/local/bin/bf2-admin-api
ssh bf2@<host> 'chmod 0755 /usr/local/bin/bf2-admin-api'
```

For repeatable releases, tag the commit and attach the binary to a GitHub
Release (`gh release create vX.Y.Z bf2-admin-api`) or build it in CI
(`actions/setup-go` + the same `go build`). The server then `curl`s the
release asset instead of being scp'd to from a laptop.

## Run on the server (systemd)

Put secrets in `/etc/bf2-admin-api.env` (mode `0600`, owner `bf2`):

```
API_KEY=<long random string>
BF2_PROFILE=BF2_Playerbase_XX
LISTEN_ADDR=127.0.0.1:8443
# MONO_PATH=/home/bf2/mono-1.1.12.1/bin/mono
# BF2CCD_PATH=/home/bf2/server/bf2ccd.exe
# BF2_HOME=/home/bf2
```

`/etc/systemd/system/bf2-admin-api.service`:

```ini
[Unit]
Description=BF2 Admin API
After=network.target

[Service]
User=bf2
Group=bf2
EnvironmentFile=/etc/bf2-admin-api.env
ExecStart=/usr/local/bin/bf2-admin-api
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/bf2
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`pgrep`, `screen`, and `sudo firewall-cmd --reload` must work as the `bf2`
user. The last needs a narrow sudoers rule:

```
bf2 ALL=(root) NOPASSWD: /usr/bin/firewall-cmd --reload
```

Enable and verify:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bf2-admin-api
curl http://127.0.0.1:8443/health
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:8443/status
```

## Reaching it from outside

The service binds to `127.0.0.1` — clients should reach it over an SSH tunnel
or WireGuard, not a public port. If exposing it publicly is unavoidable, front
it with Caddy or nginx for TLS rather than putting cert paths in the env file,
and add a public firewall rule that only allows your known client IPs.

## Updating

```bash
scp bf2-admin-api bf2@<host>:/usr/local/bin/bf2-admin-api.new
ssh bf2@<host> 'mv /usr/local/bin/bf2-admin-api.new /usr/local/bin/bf2-admin-api && systemctl restart bf2-admin-api'
```

The `mv` is atomic, so an in-flight restart won't see a half-written binary.

## Example requests

```bash
# Liveness
curl http://127.0.0.1:8443/health

# Status
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:8443/status

# Restart (default profile)
curl -X POST -H "Authorization: Bearer $API_KEY" http://127.0.0.1:8443/restart

# Restart with a specific profile
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"profile":"BF2_Playerbase_XX"}' \
  http://127.0.0.1:8443/restart
```
