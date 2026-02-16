
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audio';

interface TranscriptItem {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: number;
}

const VoiceAssistant: React.FC = () => {
  // --- States ---
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  // --- Refs for managing session & audio ---
  const sessionRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Transcriptions are built up iteratively
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  // --- Helpers ---
  const addTranscript = useCallback((type: 'user' | 'ai', text: string) => {
    if (!text.trim()) return;
    setTranscripts((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        type,
        text,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const stopAllAudio = useCallback(() => {
    sourcesRef.current.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const cleanup = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    stopAllAudio();
  }, [stopAllAudio]);

  const startAssistant = async () => {
    if (isConnecting || isActive) return;
    setIsConnecting(true);
    setError(null);
    
    try {
      // 1. Setup Audio Contexts
      if (!inputAudioCtxRef.current) {
        inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      // Resume context (browser security)
      await inputAudioCtxRef.current.resume();
      await outputAudioCtxRef.current.resume();

      // 2. Get Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Analyser for UI feedback
      const source = inputAudioCtxRef.current.createMediaStreamSource(stream);
      const analyser = inputAudioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 3. Initialize Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are a helpful, enthusiastic AI voice assistant. Keep your responses conversational and concise.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Session Opened');
            setIsActive(true);
            setIsConnecting(false);

            // Start streaming audio data to Gemini
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume calculation for visualization
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length));

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);
            scriptProcessorRef.current = scriptProcessor;
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current) {
              const ctx = outputAudioCtxRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(ctx.destination);
              sourceNode.onended = () => sourcesRef.current.delete(sourceNode);
              
              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(sourceNode);
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              stopAllAudio();
            }

            // Handle Transcriptions
            if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            }

            // Turn completion: finalize transcript entries
            if (message.serverContent?.turnComplete) {
              if (currentInputTranscription.current) {
                addTranscript('user', currentInputTranscription.current);
                currentInputTranscription.current = '';
              }
              if (currentOutputTranscription.current) {
                addTranscript('ai', currentOutputTranscription.current);
                currentOutputTranscription.current = '';
              }
            }
          },
          onerror: (e) => {
            console.error('Gemini Error:', e);
            setError('Connection error. Please check your API key and network.');
            cleanup();
          },
          onclose: () => {
            console.log('Gemini Session Closed');
            cleanup();
          },
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Failed to start assistant:', err);
      setError(err.message || 'Failed to start. Check microphone permissions.');
      setIsConnecting(false);
    }
  };

  const stopAssistant = () => {
    cleanup();
  };

  // Auto-scroll transcripts
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className="flex flex-col gap-6">
      {/* Visual Feedback Area */}
      <div className="flex flex-col items-center justify-center py-8 relative">
        <div className="relative flex items-center justify-center">
          {/* Glowing Aura */}
          <div 
            className={`absolute inset-0 rounded-full bg-blue-500/20 blur-3xl transition-all duration-300 ${isActive ? 'scale-150 opacity-100' : 'scale-0 opacity-0'}`}
            style={{ transform: `scale(${1 + volume * 5})` }}
          />
          
          {/* Main Ring */}
          <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${isActive ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 bg-slate-800'}`}>
            {isActive ? (
              <div className="flex gap-1 items-end h-8">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className="w-1.5 bg-blue-400 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(4, volume * 100 * (0.5 + Math.random()))}px` }}
                  />
                ))}
              </div>
            ) : (
              <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
        </div>
        
        <div className="mt-6 text-center">
          {isConnecting ? (
            <span className="text-blue-400 animate-pulse font-medium">Connecting to Gemini...</span>
          ) : isActive ? (
            <span className="text-green-400 font-medium">Listening... Go ahead, talk to me!</span>
          ) : (
            <span className="text-slate-500 font-medium">Ready when you are</span>
          )}
        </div>
      </div>

      {/* Transcript Log */}
      <div 
        ref={scrollRef}
        className="h-64 overflow-y-auto bg-slate-900/50 rounded-2xl border border-slate-700/50 p-4 flex flex-col gap-4 scroll-smooth"
      >
        {transcripts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">
            No conversation yet...
          </div>
        ) : (
          transcripts.map((t) => (
            <div key={t.id} className={`flex flex-col ${t.type === 'user' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 px-2">
                {t.type === 'user' ? 'You' : 'Gemini'}
              </span>
              <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${t.type === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'}`}>
                {t.text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center pt-2">
        {!isActive ? (
          <button
            onClick={startAssistant}
            disabled={isConnecting}
            className={`
              flex items-center gap-2 px-8 py-4 rounded-full font-bold text-white shadow-lg transition-all
              ${isConnecting ? 'bg-slate-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 active:scale-95 shadow-blue-500/20'}
            `}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Start Conversation
          </button>
        ) : (
          <button
            onClick={stopAssistant}
            className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 shadow-lg shadow-red-500/20 transition-all"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
            Stop Assistant
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceAssistant;
