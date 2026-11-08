import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("android/app/src/main/AndroidManifest.xml");
const securityPath = resolve("android/app/src/main/res/xml/network_security_config.xml");

const manifest = readFileSync(manifestPath, "utf8");
const security = readFileSync(securityPath, "utf8");

const checks = [
  [
    "Android manifest references the network security configuration",
    /android:networkSecurityConfig="@xml\/network_security_config"/.test(manifest),
  ],
  [
    "Base configuration explicitly blocks cleartext traffic",
    /<base-config\b[^>]*cleartextTrafficPermitted="false"/.test(security),
  ],
  [
    "System certificate authorities remain trusted",
    /<certificates\b[^>]*src="system"/.test(security),
  ],
  [
    "User-installed certificate authorities are trusted for private LAN HTTPS",
    /<certificates\b[^>]*src="user"/.test(security),
  ],
];

let failed = false;
for (const [description, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${description}`);
  if (!passed) failed = true;
}

if (failed) {
  throw new Error("Android network security configuration is incomplete.");
}
