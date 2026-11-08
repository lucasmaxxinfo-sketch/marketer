import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const manifestPath = resolve("android/app/src/main/AndroidManifest.xml");
const manifest = readFileSync(manifestPath, "utf8");
const applicationTag = /<application\b/;

if (!applicationTag.test(manifest)) {
  throw new Error("Android manifest does not contain an application element.");
}

const configured = /android:networkSecurityConfig="@xml\/network_security_config"/.test(manifest)
  ? manifest
  : manifest.replace(applicationTag, '<application android:networkSecurityConfig="@xml/network_security_config"');

if (configured === manifest && !/android:networkSecurityConfig="@xml\/network_security_config"/.test(manifest)) {
  throw new Error("Could not configure Android network security.");
}

const xmlPath = resolve("android/app/src/main/res/xml/network_security_config.xml");
mkdirSync(dirname(xmlPath), { recursive: true });
writeFileSync(xmlPath, `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`);
writeFileSync(manifestPath, configured);
console.log("Android network security configured: HTTPS only, system and user-installed CA certificates trusted.");
