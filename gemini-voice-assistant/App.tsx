
import React from 'react';
import VoiceAssistant from './components/VoiceAssistant';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Gemini Voice Assistant
          </h1>
          <p className="text-slate-400 mt-2">
            Real-time native audio conversation powered by Gemini 2.5 Flash
          </p>
        </header>
        
        <main className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8">
          <VoiceAssistant />
        </main>

        <footer className="mt-8 text-center text-slate-500 text-sm">
          <p>Requires microphone access and a valid Gemini API Key</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
