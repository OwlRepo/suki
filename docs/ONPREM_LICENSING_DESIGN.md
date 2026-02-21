# On-Prem Licensing & Secure OTA Design

## Licensing

- **Signed license file**: Offline-verifiable, tamper-proof
- **Machine-bound activation**: Device fingerprint, activation limits
- **Claims**: org, plan, seats, expiry, feature flags
- **Air-gapped support**: Challenge-response flow for offline environments

## Update Security (TUF-style)

1. **Offline root keys** for maximum protection
2. **Key revocation** when compromised
3. **Threshold signatures** for critical roles
4. **Signed metadata** + artifact verification before install
5. **Rollback** support for admin-controlled revert

## Anti-Sharing Controls

- Activation limits per license
- Periodic attestation when online
- Audit logs for activations and updates
- Build fingerprinting / watermarking
