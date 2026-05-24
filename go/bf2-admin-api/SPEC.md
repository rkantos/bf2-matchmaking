# BF2 Game Server Control — Web Server Specification

## 1. Overview

A small, efficient HTTP web server that runs on the same IaaS instance as a
Battlefield 2 (BF2) game server. It exposes a set of HTTP endpoints that, when
called, trigger predefined local actions to influence the running BF2 game
server (e.g. restart, change map, kick a player).

The server is intended for **machine-to-machine use**: API clients that hold a
single shared API key. It is not a user-facing application and has no login,
sessions, or UI.

## 2. Goals

- Small footprint: single static binary, low idle memory, no runtime dependencies.
- Simple deployment: copy one file to the server, run as a service.
- Safe command execution: no shell injection, no arbitrary command execution.
- Minimal but sufficient auth: a single API key shared by trusted clients.

## 3. Non-Goals

- No multi-user accounts, roles, or permissions.
- No web UI or interactive frontend.
- No public/community-facing access (admin/automation clients only).

## 4. Technology Choice

**Language: Go**

Rationale:
- Compiles to a single static binary with no runtime or interpreter to install
  on the server.
- Standard library covers everything needed: `net/http` for the server,
  `os/exec` for local commands, `context` for timeouts, `crypto/subtle` for
  constant-time key comparison, TLS support built in.
- Low memory footprint and good concurrency handling.
- Trivial deployment: build, `scp` the binary, run under systemd.

Alternatives considered: Rust (smaller/faster but more development effort than
needed here), C (smallest, but hand-rolling HTTP is a security risk),
Python/Node (introduce a runtime and dependencies to maintain on the server).

## 5. Architecture

```
API client ──HTTPS──> [Web Control Server] ──local──> BF2 game server
   (holds API key)        (Go binary)         exec / RCON / systemd
```

The web server runs as an unprivileged service on the same host as the BF2
game server. Each endpoint maps to a fixed, predefined action. Actions are
carried out by one of:

- Calling the BF2 **RCON** interface over a local socket (preferred where
  possible — cleaner and avoids spawning processes), or
- Running a **predefined local command** via `os/exec` with separate arguments
  (never via a shell), or
- Controlling the game server **systemd unit** (e.g. restart/stop/start).

## 6. Authentication

- A **single static API key** authenticates all requests.
- The key is supplied by the client in an HTTP header:
  `Authorization: Bearer <API_KEY>`
- The key is read by the server from an environment variable or a config file
  with restrictive permissions (`0600`, owned by the service user). It is
  **never** hard-coded in the binary or committed to source control.
- Key comparison uses a constant-time comparison (`crypto/subtle`) to avoid
  timing attacks.
- Requests with a missing or invalid key receive `401 Unauthorized`.
- The key should be long and random (e.g. 32+ bytes, base64-encoded).
- Key rotation: changing the key is done by updating the config/env value and
  restarting the service. Clients update their stored key accordingly.

## 7. API Endpoints

All endpoints require the `Authorization` header. All responses are JSON.

| Method | Path             | Description                                  |
|--------|------------------|----------------------------------------------|
| GET    | `/health`        | Liveness check (no auth required).           |
| GET    | `/status`        | Returns game server status (running, map, players). |
| POST   | `/restart`       | Restarts the BF2 game server.                |
| POST   | `/map`           | Changes the current map. Body: `{ "map": "<name>" }`. |
| POST   | `/kick`          | Kicks a player. Body: `{ "player": "<name|id>" }`. |

Notes:
- The endpoint list is fixed. There is **no generic "run command" endpoint.**
- `/health` is exempt from auth so external monitoring can probe it without
  holding the key. It returns no sensitive information.
- Additional endpoints follow the same pattern: one fixed action per endpoint.

### Example request

```
POST /map HTTP/1.1
Host: localhost:8443
Authorization: Bearer <API_KEY>
Content-Type: application/json

{ "map": "strike_at_karkand" }
```

### Example response

```json
{ "ok": true, "action": "map", "detail": "map changed to strike_at_karkand" }
```

### Error response

```json
{ "ok": false, "error": "invalid map name" }
```

## 8. Input Validation

- Every parameter is validated before use. A request that fails validation
  returns `400 Bad Request` and the action is not performed.
- Map names are checked against an **allowlist** of known maps (or a strict
  regex, e.g. `^[A-Za-z0-9_]+$`).
- Player identifiers are checked against a strict pattern before being passed
  to a kick command.
- No user-supplied value is ever interpolated into a shell string.

## 9. Command Execution Safety

- Local commands are executed with `exec.Command(name, arg1, arg2, ...)`,
  passing each argument separately. **Never** `sh -c "..."` with interpolated
  input. This eliminates shell injection.
- Every command runs with a timeout via `context.Context`, so a stuck or
  hanging process cannot pile up.
- State-changing actions (e.g. `/restart`) are serialized — a mutex or work
  queue prevents two restart calls from racing.
- Command failures are caught; the endpoint returns a non-2xx status with an
  error message rather than failing silently.

## 10. Transport Security

- The server uses **HTTPS (TLS)**. The API key must never travel over plain HTTP.
- Two acceptable setups:
    1. TLS terminated by the Go server directly (built-in `crypto/tls`).
    2. The server binds to localhost and sits behind a reverse proxy
       (e.g. Caddy for automatic HTTPS, or nginx) that terminates TLS.
- **Recommended:** bind the server to `127.0.0.1` and do not expose it directly
  to the public internet. Clients reach it via an SSH tunnel or a VPN
  (e.g. WireGuard). This removes most of the attack surface even before auth.
- If the server must be public-facing, TLS plus the API key plus rate limiting
  are mandatory.

## 11. Rate Limiting

- A basic per-source rate limit is applied so that a leaked key or a
  brute-force attempt against the key is less damaging.
- Requests exceeding the limit receive `429 Too Many Requests`.

## 12. Privilege & Isolation

- The web server runs as an **unprivileged user** — ideally the same user that
  owns the BF2 game server process. It does **not** run as root.
- It is managed as a **systemd service** with:
    - `User=` set to the unprivileged service account.
    - `Restart=on-failure` and a sensible restart policy.
    - Resource limits (memory, file descriptors) where appropriate.
    - Hardening directives where possible (e.g. `NoNewPrivileges=true`,
      `ProtectSystem`, `PrivateTmp`).
- If the server controls the game server's systemd unit, grant only the
  specific permission needed (e.g. a narrowly scoped `sudo` rule or a
  systemd-level mechanism), not blanket `sudo`.

## 13. Logging & Auditing

- Every action request is logged with: timestamp, endpoint, parameters,
  source address, and outcome (success/failure).
- Authentication failures are logged.
- Logs go to stdout/journald (via systemd) so they are captured centrally.
- Logs must **not** contain the API key itself.

## 14. Configuration

Configuration is supplied via environment variables or a `0600` config file:

| Setting          | Description                                       |
|------------------|---------------------------------------------------|
| `API_KEY`        | The shared API key.                               |
| `LISTEN_ADDR`    | Bind address/port (e.g. `127.0.0.1:8443`).        |
| `TLS_CERT` / `TLS_KEY` | Paths to TLS cert/key (if terminating TLS).  |
| `RCON_ADDR`      | Address of the BF2 RCON interface.                |
| `RCON_PASSWORD`  | RCON password (kept out of source control).       |
| `MAP_ALLOWLIST`  | Allowed map names.                                |
| `CMD_TIMEOUT`    | Timeout for local command execution.              |

## 15. Deployment

1. Build the static binary: `CGO_ENABLED=0 go build`.
2. Copy the binary and config to the server.
3. Set config file permissions to `0600`, owned by the service user.
4. Install and enable the systemd unit.
5. Verify `/health` responds and an authenticated `/status` call works.

## 16. Open Questions / Decisions to Confirm

- Which actions can be done via **RCON** vs. requiring a local command or
  systemd control? Prefer RCON where it covers the need.
- Final list of endpoints beyond the initial set in section 7.
- Whether the server terminates TLS itself or runs behind a reverse proxy.
- Exact rate-limit thresholds.
