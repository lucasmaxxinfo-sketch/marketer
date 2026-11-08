import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><body><button id="kira-talk-button"></button></body></html>`);
  await page.evaluate(() => {
    class FakeRecognition {
      constructor() { window.__recognition = this; this.starts = 0; this.stops = 0; }
      start() { this.starts++; this.onstart?.(); }
      stop() { this.stops++; this.onend?.(); }
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    window.speechSynthesis = {
      cancel() {},
      getVoices() { return []; },
      speak(utterance) {
        window.__lastUtterance = utterance;
        queueMicrotask(() => utterance.onstart?.());
        setTimeout(() => utterance.onend?.(), 180);
      }
    };
  });
  await page.addScriptTag({ path: "kira-voice.js" });
  await page.locator("#kira-talk-button").click();
  await page.waitForFunction(() => !!window.__lastUtterance);
  await page.waitForTimeout(60);
  const duringGreeting = await page.evaluate(() => window.__recognition?.starts ?? 0);
  assert.equal(duringGreeting, 0, "the microphone must remain off while Kira gives her opening greeting");

  await page.waitForFunction(() => window.__recognition?.starts === 1, { timeout: 2000 });
  await page.evaluate(() => {
    const finalResult = { 0: { transcript: "hello" }, isFinal: true };
    window.__recognition.onresult({ results: [finalResult] });
  });
  await page.waitForFunction(() => window.__recognition?.stops === 1, { timeout: 2000 });
  await page.waitForFunction(() => window.__recognition?.starts === 2, { timeout: 2000 });

  console.log("KIRA_VOICE_SEQUENCE_PASSED: greeting before listening; microphone pauses during Kira reply; listening resumes afterwards.");
} finally {
  await browser.close();
}
