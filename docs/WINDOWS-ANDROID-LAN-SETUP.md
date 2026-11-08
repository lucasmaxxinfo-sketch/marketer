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

## 3. Configure private LAN HTTPS automatically

Open **PowerShell as Administrator** in the repository folder and run:

```powershell
.\scripts\setup-windows-lan.ps1
```

The helper detects the PC's active private IPv4 address, writes it into `backend/local/.env`, creates a Windows firewall rule limited to the local subnet, starts the private Caddy HTTPS service, and exports the public root certificate as `marketing-genius-local-root.crt`.

After setup, run the runtime check from a normal PowerShell window:

```powershell
.\scripts\test-windows-lan.ps1
```

It checks the four Docker services, the local API health endpoint, LAN HTTPS using the exported CA certificate, and the configured Ollama model. It does not replace the separate Android phone connection test.

No router port forwarding is created. A DHCP reservation in your router is recommended so the PC keeps the same address. If its address changes, rerun the helper and update the phone's API address.

## 4. Install the certificate on Android

Transfer `marketing-genius-local-root.crt` to your Android phone using USB or another private method. Install it as a **CA certificate**:

**Settings → Security and privacy → More security settings → Encryption and credentials → Install a certificate → CA certificate**

Menu wording varies by manufacturer. Android may require a screen lock before it allows a user CA to be installed.

The app trusts user-installed CA certificates while continuing to reject cleartext HTTP. Never export or share the CA private key.

## 5. Install the Android app build

Install the latest Marketing Genius APK built after the LAN security update. The app must include the network security configuration that trusts user-installed CA certificates.

If Android was already running an older build, update it to the new build before testing the local HTTPS connection.

## 6. Connect the phone

Make sure the phone and Windows PC are on the same home Wi-Fi network. Turn off mobile data temporarily for the first connection test so the phone uses Wi-Fi.

In Marketing Genius on Android:

1. Open Settings.
2. Set the workspace API address to `https://192.168.1.50`, replacing the example with the PC's reserved IPv4 address.
3. Save the address.
4. Run the workspace health check.
5. Sign in with the owner password saved during installation.

The health check should report the local workspace online. Kira's AI and research services run on the Windows PC.

## 7. Keep Kira running after Windows restarts

Kira's scheduled research only runs while the PC and Docker services are online. Configure Windows and Docker to restart the services automatically:

1. Open Docker Desktop.
2. Open **Settings → General**.
3. Enable **Start Docker Desktop when you sign in to your computer**.
4. Apply the setting and leave Docker Desktop installed and available to your Windows account.
5. In Windows **Settings → System → Power & battery → Screen and sleep**, set the plugged-in sleep option to **Never**. Keep the PC connected to power. You can still let the screen turn off.
6. After the LAN profile has been started once, its containers use Docker's `unless-stopped` restart policy. When Docker starts again, the API, Ollama, SearXNG and LAN HTTPS proxy should restart automatically.

To verify after a Windows restart, open PowerShell in the repository folder and run:

```powershell
docker compose --profile lan ps
```

The API, Ollama, SearXNG and Caddy LAN services should show as running. If they do not, start them with:

```powershell
docker compose --profile lan up -d
```

Do not use Windows sleep or hibernation while expecting Kira to conduct scheduled research. The phone does not need to remain connected or have the app open.

## 8. Routine operation

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

If the Windows PC's reserved IP changes, update `LAN_ADDRESS`, restart the LAN Caddy service, and update the API address in the Android app. The same internal CA remains in place.

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
