# Trade-offs Made

## 1. Single-replica orchestrator (vs multi-replica)
For MVP simplicity, we use a single orchestrator instance. Multi-replica scaling would require run partition keys or complex advisory locking to prevent race conditions. The trade-off is a temporary single point of failure (if it crashes, currently running flows stall until restart). Heartbeat scanners are implemented to recover stalled runs.

## 2. PostgreSQL logs table (vs ClickHouse)
ClickHouse is more efficient for high-volume append-only logs but introduces severe operational complexity for early stages. We chose a partitioned PostgreSQL logs table which easily supports up to 10M log entries without performance issues.

## 3. child_process script sandbox (vs Docker/Firecracker VM)
The script execution sandbox uses Node `child_process`. It does NOT offer robust network or filesystem isolation, which is a known security trade-off for the MVP. In high-security production environments, these should run inside isolated Firecracker VMs or Docker containers.

## 4. Static rate limit per route (vs adaptive)
We use a fixed token bucket rate limit per route of 600 req/60s. This protects from massive abuse but lacks granular configuration per tenant in the basic tier.

## 5. Plaintext webhook secret
HMAC-SHA256 signature verification requires the raw plaintext webhook secret. As a simplification, it is stored in plaintext in the database instead of being encrypted at rest with a KMS key, which is documented as a security limitation.

# What I'd Improve with More Time

- [ ] Multi-replica orchestrator with run partitioning
- [ ] MicroVM sandbox (Firecracker) for execution security
- [ ] ClickHouse or Vector/Loki integration for massive log volumes
- [ ] Webhook secrets encrypted at rest via KMS
- [ ] RS256 JWT instead of HS256 JWT
- [ ] Full coverage and property-based test suites using fast-check
