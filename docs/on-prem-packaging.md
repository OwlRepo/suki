# On-Prem Packaging Model

## Overview

Self-hosted deployment with signed container images, environment-bound config, and entitlement enforcement.

## Packaging

- **Container images**: Docker/OCI images signed with Cosign or similar
- **Releases**: Versioned artifacts (e.g. `suki-server-1.2.3.tar.gz`) with checksums
- **Config**: Environment variables for `DATABASE_URL`, `LICENSE_PUBLIC_KEY`, etc.

## License Verification

1. License file contains JSON payload (org, plan, seats, expiry, features)
2. RSA-SHA256 detached signature
3. Server verifies with `LICENSE_PUBLIC_KEY` before accepting activation
4. Expiry and seat limits enforced server-side

## Activation Flows

### Online
1. Client sends payload + signature + machine fingerprint
2. Server verifies, checks seat limit, records activation
3. Returns activation ID for attestation

### Offline / Air-gapped
1. Generate challenge (nonce + org ID) on target machine
2. Transfer challenge to licensed machine with connectivity
3. Obtain signed response from license server
4. Apply response file on target machine

## Secure Updates

1. Fetch signed metadata (version, artifact URL, SHA256)
2. Verify metadata signature with update public key
3. Download artifact, verify hash
4. Apply update or abort on mismatch

## Anti-Sharing

- Activation records per organization + machine fingerprint
- Seat limit enforced at activation
- Periodic attestation (when online) to refresh validity
- Revoke workflow for admin control

## Offline Activation (Challenge-Response)

1. **Request challenge** (from connected machine): `POST /licensing/offline/challenge`
   - Requires auth; returns `challengeId`, `challenge`, `validUntil` (default 2h)
2. **Transfer** challenge + license file to air-gapped machine
3. **Activate** (from connected intermediary): `POST /licensing/offline/activate`
   - Body: `challengeId`, `challenge`, `payload`, `signature`, `publicKey`, `machineFingerprint?`
   - Returns `responsePayload`, `responseSignature` for offline verification
4. **Apply** signed response on air-gapped machine

## Signed OTA Updates

- `GET /licensing/ota/releases?channel=stable` — list releases
- `GET /licensing/ota/manifest?channel=stable` — signed metadata (version, artifactUrl, artifactSha256)
- Client verifies metadata signature with bundled public key before download
- Client verifies artifact SHA256 before applying
- Env: `OTA_ARTIFACT_BASE_URL`, `OTA_CURRENT_VERSION`, `LICENSE_SIGNING_PRIVATE_KEY`

## Key Rotation and Revocation

### Revoking an activation
- `POST /licensing/revoke/:activationId` — marks activation revoked (auth required)
- Revoked activations fail attestation; client should deactivate locally

### Key rotation (LICENSE_SIGNING_PRIVATE_KEY)
1. Generate new RSA key pair
2. Deploy new private key to license server; keep old public key for grace period
3. New offline activation responses signed with new key
4. Distribute new public key with next OTA release
5. After grace period, retire old key

### Operational health
- `GET /health` — basic liveness
- `GET /health/db` — database connectivity
