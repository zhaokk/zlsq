import React, { useEffect } from 'react';
import { Display } from './components/Display';
import { Controls } from './components/Controls';
import { DebugPanel } from './components/DebugPanel';
import { timerStore } from './store/TimerStore';
import './App.css';

function App() {
  useEffect(() => {
    const interval = setInterval(() => {
      timerStore.tick();
    }, 100); // Run tick every 100ms
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="root">
      <Display />
      <Controls />
      <DebugPanel />
    </div>
  );
}

export default App;
