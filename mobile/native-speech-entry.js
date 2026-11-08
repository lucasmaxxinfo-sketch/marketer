import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

// Expose the native plugin to the app's existing no-bundler interface.
window.KiraNativeSpeech = SpeechRecognition;
window.KiraNativeTTS = TextToSpeech;
