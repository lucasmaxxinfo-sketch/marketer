import { SpeechRecognition } from "@capacitor-community/speech-recognition";

// Expose the native plugin to the app's existing no-bundler interface.
window.KiraNativeSpeech = SpeechRecognition;
