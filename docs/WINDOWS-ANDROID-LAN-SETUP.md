# Windows PC + Android phone: private Kira connection

This setup runs Kira on a Windows PC and connects the Android app over the same trusted home Wi-Fi network. It uses local HTTPS and a private certificate authority. It does not require a public server, domain, paid tunnel, subscription, or router port forwarding.

## What runs where

- Windows PC: Docker services, Ollama/Qwen3, SearXNG, SQLite and the Kira API.
- Android phone: Marketing Genius app and owner control panel.
- Home Wi-Fi: private connection between the devices.

Keep the Windows PC awake, powered on and connected to the internet for scheduled research. The phone can disconnect without stopping Kira.

## 1. Prepare Windows

Install these free tools:

- Git for Windows.
- Node.js 24 or newer.
- Docker Desktop with the WSL 2 backend, or another working Docker Engine + Compose installation.

Start Docker and wait until it reports that the engine is running. Open PowerShell.

Clone the repository:

```powershell
git clone https://github.com/lucasmaxxinfo-sketch/marketer.git
cd marketer
```

If the repository is already on the PC, update it instead:

```powershell
git pull
```

## 2. Install Kira on Windows

Run:

```powershell
node backend/local/install.mjs
```

The installer creates private credentials, starts the API, Ollama and SearXNG, downloads Qwen3 4B, then checks owner login and a real AI response.

Save the owner password shown by the installer. It is also stored in `backend/local/.env`.

The local API remains bound to Windows loopback on port 8787. Do not change that port mapping to expose the API directly.

## 3. Give the PC a stable home-network address

On Windows, run:

```powershell
ipconfig
```

Find the active Wi-Fi or Ethernet adapter and note its IPv4 address, for example `192.168.1.50`. Your actual address will differ.

In your router's settings, create a DHCP reservation for the Windows PC so that it keeps the same local IP address. This is a local network setting, not port forwarding.

Edit `backend/local/.env` and set:

```dotenv
LAN_ADDRESS=192.168.1.50
```

Replace the example with the actual reserved IPv4 address. Do not include `https://` or a port number.

## 4. Start private LAN HTTPS

From the repository root, run:

```powershell
docker compose --profile lan up -d
```

This starts Caddy on TCP port 443. Caddy creates a private local certificate for the reserved PC address and forwards requests to the API over Docker's private service network.

The API's port 8787 remains bound to 127.0.0.1 on the PC. Only the HTTPS proxy is available to other devices on the LAN.

### Allow access from your home network only

Open PowerShell as Administrator and run:

```powershell
New-NetFirewallRule -DisplayName "Marketing Genius LAN HTTPS" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -RemoteAddress LocalSubnet
```

Do not create a router port-forwarding rule. Do not enable the public Caddy profile for this LAN setup.

## 5. Export the public root certificate

The Android phone needs to trust the local certificate authority. Export only its public root certificate. Never export or share the CA private key.

From PowerShell in the repository root:

```powershell
docker cp marketing-genius-caddy-lan:/data/caddy/pki/authorities/local/root.crt .\marketing-genius-local-root.crt
```

If the container has not finished starting, wait a few seconds and retry. The certificate is public, but it should still only be installed on devices you control.

## 6. Install the certificate on Android

Transfer `marketing-genius-local-root.crt` to your Android phone using USB or another private method.

On Android, the menu wording varies by manufacturer. Look under:

**Settings → Security and privacy → More security settings → Encryption and credentials → Install a certificate → CA certificate**

Select the certificate and confirm the Android security warning. Android may require a screen lock before it allows a user CA to be installed.

The Android app build for this project is configured to trust user-installed CA certificates while continuing to reject cleartext HTTP. The certificate is only trusted on devices where you deliberately install it.

## 7. Install the Android app build

Install the latest Marketing Genius APK built after the LAN security update. The app must include the network security configuration that trusts user-installed CA certificates.

If Android was already running an older build, update it to the new build before testing the local HTTPS connection.

## 8. Connect the phone

Make sure the phone and Windows PC are on the same home Wi-Fi network. Turn off mobile data temporarily for the first connection test so the phone uses Wi-Fi.

In Marketing Genius on Android:

1. Open Settings.
2. Set the workspace API address to `https://192.168.1.50`, replacing the example with the PC's reserved IPv4 address.
3. Save the address.
4. Run the workspace health check.
5. Sign in with the owner password saved during installation.

The health check should report the local workspace online. Kira's AI and research services run on the Windows PC.

## 9. Routine operation

Start or inspect the services:

```powershell
docker compose --profile lan up -d
docker compose ps
```

View API logs:

```powershell
docker compose logs -f marketing-genius-api
```

Stop services without deleting stored data:

```powershell
docker compose down
```

Do not use `docker compose down -v` for routine shutdown. That deletes persistent data volumes, including the database and downloaded AI model.

## Security and network boundaries

- The API remains loopback-bound on the Windows host.
- LAN devices connect through Caddy over HTTPS.
- Caddy's private CA root certificate is installed manually on the Android device.
- Android trusts user-installed certificates for this app, but cleartext traffic remains disabled.
- The Windows firewall rule is limited to the local subnet.
- No router port forwarding is needed or recommended.
- Do not expose TCP 8787, Ollama 11434, or SearXNG 8080 to the LAN or internet.
- The owner login and bearer session remain required for protected API routes.
- Anyone with the CA private key could impersonate the local server. Keep the Caddy data volume private and never copy its private CA key.

If the Windows PC's reserved IP changes, update `LAN_ADDRESS`, restart the LAN Caddy service, and update the API address in the Android app. The same local CA remains in place.

## Troubleshooting

**Phone cannot reach the workspace**
- Confirm both devices are on the same Wi-Fi.
- Check the PC's current IPv4 address with `ipconfig`.
- Confirm `LAN_ADDRESS` matches it in `backend/local/.env`.
- Check `docker compose --profile lan ps` and `docker compose logs caddy-lan`.
- Confirm the Windows firewall rule is enabled for the local subnet.

**Certificate warning or TLS error**
- Confirm the public root certificate was exported from the current Caddy container.
- Confirm it is installed as a CA certificate on Android.
- Confirm the app was updated to a build with the network security configuration.
- Confirm the API URL uses `https://` and the exact reserved IP address.

**Kira is online but AI is unavailable**
- Check `docker compose logs ollama`.
- Check the model with `docker compose exec ollama ollama list`.
- The first model download and first response can take time on slower hardware.

**Do not solve connection problems by enabling mixed content or exposing port 8787.** Keep HTTPS and the private proxy in place.
