# Trusted client-IP validation plan

Status: **NOT VERIFIED. Do not deploy the login worker to production until this check passes.**

## Why this is needed

The login limiter uses `CF-Connecting-IP` as the per-client bucket key. A valid-looking IP address is not proof that a header was set by a trusted proxy. Current Supabase documentation confirms gateway routing, but the reviewed documentation does not provide an explicit security guarantee that caller-supplied `CF-Connecting-IP` is always overwritten for this project's Edge Function route.

A Supabase community report from April 2025 observed a spoofed `X-Forwarded-For` value being concatenated with an apparent client IP, while `CF-Connecting-IP` appeared to contain the observed client IP. This is useful evidence, but it is not a platform guarantee for this project: https://github.com/orgs/supabase/discussions/34647

## Controlled staging-only procedure

**Never run spoofing tests against the production login endpoint.** Use a dedicated non-production Supabase project and a temporary diagnostic function that has no secrets, database writes, or authentication behavior.

1. Create a temporary diagnostic Edge Function in the staging project. It should return only the values received for `CF-Connecting-IP` and `X-Forwarded-For`, and must not be deployed to production.
2. Invoke the function through the normal public Supabase Edge Function URL from a machine with a known public egress IP. First send a request without custom IP headers and record the observed `CF-Connecting-IP`.
3. Send a second request with deliberately false values, for example:
   ```sh
   curl -sS 'https://STAGING_PROJECT_REF.supabase.co/functions/v1/ip-header-diagnostic' \
     -H 'CF-Connecting-IP: 192.0.2.123' \
     -H 'X-Forwarded-For: 192.0.2.123'
   ```
   Replace only the staging project reference. Do not use production URLs.
4. Repeat with a different false value and with IPv6-capable client/network conditions if available. Compare the function's received header with the independently known source IP. Keep test results private; IP addresses are operational data.
5. If the received `CF-Connecting-IP` follows the spoofed value, varies according to the supplied header, or cannot be independently interpreted, mark the source **untrusted** and stop. Do not fall back to the first or last `X-Forwarded-For` value without proving the proxy chain.
6. If the header is overwritten with the independently observed source IP in all controlled cases, preserve the request/response evidence and obtain platform confirmation that this behavior is intended and stable before relying on it for production security.
7. Delete the temporary diagnostic function and any associated staging artifacts. Then run the worker's rate-limit tests and controlled staging login tests using the exact production-intended route.

## Release gate

- [ ] Staging-only test completed; no production login endpoint was probed.
- [ ] Result independently compared against the test client's public egress IP.
- [ ] Platform behavior confirmed or a trusted-proxy alternative selected.
- [ ] Evidence and cleanup recorded in the build diary.
- [ ] Existing CI and controlled login tests pass.
- [ ] Owner explicitly approves any production migration/deployment.

If this cannot be verified, do not ship an IP-based limiter that assumes the header is trustworthy. Evaluate a trusted proxy that overwrites a private client-IP header, or managed authentication with provider-side abuse controls and MFA. These are design alternatives, not changes authorized by this document.


## Observed isolated test: 2026-10-17

A zero-cost Supabase test project (`cyndbisxznohjkxuiyfi`, `ap-southeast-2`) was created and tested through GitHub-hosted runners. A temporary no-secret function echoed the headers received by the function. Two independent runs produced the same outcome:

- Baseline requests returned HTTP 200 with a gateway-supplied `CF-Connecting-IP`.
- Caller-supplied `CF-Connecting-IP: 198.51.100.77` requests were rejected by the gateway with HTTP 403 / Cloudflare error code 1000 before the function could echo the received headers.
- Requests with only spoofed `X-Forwarded-For` or `X-Real-IP` returned HTTP 200, but the spoofed values were not reflected in the function's received headers.
- Requests combining all three spoofed headers were also rejected with HTTP 403.

This supports retaining `CF-Connecting-IP` as the only candidate source and continuing to reject missing/malformed values, while never trusting `X-Forwarded-For` or `X-Real-IP`. The test is empirical evidence for the tested Supabase project and route, not an authoritative platform guarantee. The 403 response does not show whether the gateway overwrote the spoofed header or rejected the request for another reason. Obtain platform confirmation or verify the exact deployment route before considering this gate fully closed.

The diagnostic function was then changed to return HTTP 410 and no longer performs tests. The temporary workflow and PR are being removed. No production endpoint was tested.
