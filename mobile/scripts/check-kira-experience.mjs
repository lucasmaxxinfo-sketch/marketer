import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../app.js");
const avatar = read("../../kira-avatar-3d.js");
const voice = read("../../kira-voice.js");
const html = read("../../index.html");
const bridge = read("../native-speech-entry.js");
const webBridge = read("../../native-speech.js");
const mobile = JSON.parse(read("../package.json"));

assert.match(app, /function kiraAvatar\(size='large'\)\{return/);
assert.doesNotMatch(app, /window\.KIRA_PORTRAIT_DATA/);
assert.match(app, /kira-avatar-3d-canvas/);
assert.match(app, /class="kira-mouth-open"/);
assert.match(app, /KiraNativeTTS/);
assert.match(avatar, /querySelectorAll\('\.kira-avatar'\)/);
assert.match(avatar, /window\.KIRA_SPEAKING === true/);
assert.match(avatar, /talkingMouth\.scale\.y/);
assert.match(voice, /NativeSpeech\.requestPermissions\(\)/);
assert.match(voice, /NativeSpeech\.start\(\{language:'en-NZ'/);
assert.match(voice, /NativeTTS\.speak\(/);
assert.match(voice, /function stopSpeaking/);
assert.match(bridge, /TextToSpeech/);
assert.match(webBridge, /KiraNativeTTS/);
assert.match(html, /src="\.\/native-speech\.js"/);
assert.equal(mobile.dependencies["@capacitor-community/speech-recognition"], "7.0.1");
assert.equal(mobile.dependencies["@capacitor-community/text-to-speech"], "6.0.0");

assert.match(read("../../ux-refinements.css"), /Mobile workspace navigation/);
assert.match(read("../../ux-refinements.css"), /min-height: 48px/);
assert.match(read("../../ux-refinements.css"), /prefers-reduced-motion: reduce/);

console.log("Kira experience checks passed: animated avatar, native microphone input, native Android speech output, and mobile navigation/accessibility refinements.");
