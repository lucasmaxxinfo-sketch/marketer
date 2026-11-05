(()=>{'use strict';
const button=document.getElementById('kira-talk-button');if(!button)return;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null,listening=false,sessionActive=false,speaking=false,restarting=false;
let conversation=[];
const status=document.createElement('div');status.id='kira-voice-status';status.className='kira-voice-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
status.innerHTML='<span class="voice-pulse"></span><span class="voice-status-copy">Kira is ready</span><button type="button" class="voice-dismiss" aria-label="Dismiss voice status">×</button>';
document.body.appendChild(status);
const copy=status.querySelector('.voice-status-copy');
function show(message){copy.textContent=message;status.classList.add('visible')}
status.querySelector('.voice-dismiss').addEventListener('click',()=>status.classList.remove('visible'));
function speak(message){if(!('speechSynthesis'in window)){show(message);return}speaking=true;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);const voices=speechSynthesis.getVoices();const hints=/female|woman|samantha|victoria|karen|moira|tessa|serena|ava|aria|jenny|natasha|sophie|emily|olivia|allison|zira/i;const v=voices.find(x=>/^en(-|_)/i.test(x.lang)&&hints.test(x.name))||voices.find(x=>/en-NZ/i.test(x.lang))||voices.find(x=>/en-AU|en-GB/i.test(x.lang));if(v)u.voice=v;u.rate=1.23;u.pitch=1.12;u.volume=1;u.onstart=()=>{show('Kira: '+message);button.classList.add('is-speaking')};u.onend=()=>{speaking=false;button.classList.remove('is-speaking');if(sessionActive)listenAgain()};u.onerror=()=>{speaking=false;if(sessionActive)listenAgain()};speechSynthesis.speak(u)}
function navigate(view){const b=document.querySelector('[data-view="'+view+'"]');if(b)b.click()}
function listenAgain(){if(!sessionActive||speaking||listening||restarting||!recognition)return;restarting=true;setTimeout(()=>{restarting=false;if(!sessionActive||speaking||listening)return;try{recognition.start()}catch(_){listenAgain()}},350)}
function respond(raw){const t=raw.toLowerCase().trim();show('You: '+raw);
if(/\b(approval|approvals|review|to review)\b/.test(t)){navigate('approvals');speak('I’ll bring up the items that need your decision. I’ll talk you through them one at a time.')}
else if(/\b(schedule|calendar|plan|planned posts)\b/.test(t)){navigate('schedule');speak('Here’s the plan. I’ll flag anything that needs your attention.')}
else if(/\b(saved|archive|results|reports)\b/.test(t)){navigate('results');speak('Here’s the saved work and results.')}
else if(/\b(business|businesses|tools|channels|connection|connect)\b/.test(t)){navigate('connections');speak('I’ll bring up the business and channel setup. I’ll tell you what is connected and what still needs attention.')}
else if(/\b(setting|settings)\b/.test(t)){navigate('settings');speak('I’ll take you to the workspace details. I’ll explain what I need as we go.')}
else if(/\b(create|campaign|make an ad|make a post|new ad)\b/.test(t)){navigate('studio');speak('Let’s make something. Tell me what you want people to notice, and I’ll take it from there.')}
else if(/\b(home|back|main screen)\b/.test(t)){navigate('dashboard');speak('Back at the home space. What shall we tackle next?')}
else if(/\b(stop|quiet|cancel voice|pause)\b/.test(t)){sessionActive=false;speechSynthesis.cancel();try{recognition?.stop()}catch(_){}show('Kira has paused listening. Tap Start with Kira to resume.');button.textContent='🎙 Start with Kira';button.classList.remove('is-listening','is-speaking')}
else if(/\b(hello|hi|hey|oi)\b/.test(t)){speak('Hey. I’m here. Tell me what you want to get done.')}
else{show('Kira is thinking…');if(typeof window.kiraAskAI==='function'){window.kiraAskAI(raw,conversation.slice(-12)).then(reply=>{conversation.push({role:'user',content:raw},{role:'assistant',content:reply});conversation=conversation.slice(-12);speak(reply)}).catch(()=>speak('I heard you. The live assistant service is not connected yet, so I can handle the built-in workspace actions for now.'))}else speak('I heard you. I can take you to approvals, create, schedule, saved work, business setup or settings. What are we doing?')}
}
function start(){if(!SpeechRecognition){show('Voice input is not supported here. Use Chrome on Android for voice conversations.');return}
try{recognition=new SpeechRecognition();recognition.lang='en-NZ';recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=1;
recognition.onstart=()=>{listening=true;restarting=false;button.classList.add('is-listening');button.textContent='🎙 Kira is listening';show('I’m listening. Just speak naturally.')};
recognition.onresult=e=>{const result=e.results[e.results.length-1];if(result?.isFinal){const transcript=result[0]?.transcript||'';if(transcript.trim())respond(transcript)}};
recognition.onerror=e=>{if(e.error==='not-allowed'){sessionActive=false;show('Microphone permission is blocked. Allow microphone access in your browser settings.');button.textContent='🎙 Start with Kira'}else if(e.error!=='no-speech'&&e.error!=='aborted')show('I lost the microphone connection. I’ll try again.')};
recognition.onend=()=>{listening=false;button.classList.remove('is-listening');if(sessionActive&&!speaking)listenAgain()};
sessionActive=true;button.textContent='🎙 Kira is listening';recognition.start();speak('Hi. I’m Kira. You don’t need to navigate menus or work out which button to press. Tell me what you want done, and I’ll guide the process. I’ll only bring you in when I need a decision.');
}catch(e){sessionActive=false;show('Could not start the microphone. Check browser microphone permission.')}
}
button.textContent='🎙 Start with Kira';button.title='Start a voice-led conversation with Kira';
button.addEventListener('click',()=>{if(sessionActive){sessionActive=false;speechSynthesis.cancel();try{recognition?.stop()}catch(_){}button.textContent='🎙 Start with Kira';button.classList.remove('is-listening','is-speaking');show('Kira has paused. Start again whenever you’re ready.');return}start()});
if(!SpeechRecognition)button.title='Voice input requires a browser with speech recognition support';
})();