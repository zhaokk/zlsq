import React from 'react';
import { observer } from 'mobx-react-lite';
import { timerStore } from '../store/TimerStore';

export const Controls = observer(() => {
  const { lidClosed } = timerStore;

  const handleDown = (btn: 'set'|'back'|'lock') => (e: React.SyntheticEvent) => {
    // e.preventDefault(); // Prevent default might block click on some devices, but needed for long press not to select text
    // Actually for touch events we might need it.
    timerStore.setButtonState(btn, true);
  };
  const handleUp = (btn: 'set'|'back'|'lock') => (e: React.SyntheticEvent) => {
    e.preventDefault();
    timerStore.setButtonState(btn, false);
  };

  return (
    <div className="controls-container">
      <div className="main-controls">
        <div className="control-btn"
             onMouseDown={handleDown('back')} onMouseUp={handleUp('back')} onMouseLeave={handleUp('back')}
             onTouchStart={handleDown('back')} onTouchEnd={handleUp('back')}
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
        </div>

        <div className="control-btn"
             onMouseDown={handleDown('set')} onMouseUp={handleUp('set')} onMouseLeave={handleUp('set')}
             onTouchStart={handleDown('set')} onTouchEnd={handleUp('set')}
        >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
        </div>

        <div className="control-btn" onClick={() => timerStore.onDown()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
        </div>
        <div className="control-btn" onClick={() => timerStore.onUp()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
        </div>
        
        <div className="control-btn"
             onMouseDown={handleDown('lock')} onMouseUp={handleUp('lock')} onMouseLeave={handleUp('lock')}
             onTouchStart={handleDown('lock')} onTouchEnd={handleUp('lock')}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
        </div>
      </div>
    </div>
  );
});
