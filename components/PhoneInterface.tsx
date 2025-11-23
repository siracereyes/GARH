import React, { useState, useRef, useEffect } from 'react';

interface PhoneInterfaceProps {
  isActive: boolean;
  isSpeaking: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  statusMessage: string;
  isTagalog: boolean;
  setIsTagalog: (value: boolean) => void;
  isIrate: boolean;
  setIsIrate: (value: boolean) => void;
}

export const PhoneInterface: React.FC<PhoneInterfaceProps> = ({ 
  isActive, 
  isSpeaking, 
  onStartCall, 
  onEndCall,
  statusMessage,
  isTagalog,
  setIsTagalog,
  isIrate,
  setIsIrate
}) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        });
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      isDragging.current = true;
      
      // Initialize position on first drag to prevent jumping
      if (!position) {
        setPosition({ x: rect.left, y: rect.top });
      }
    }
  };

  const style: React.CSSProperties = position 
    ? { left: `${position.x}px`, top: `${position.y}px` } 
    : {};

  return (
    <div 
      ref={containerRef}
      style={style}
      className={`fixed w-80 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden z-50 ${!position ? 'bottom-6 right-6' : ''}`}
    >
      {/* Header - Draggable Area */}
      <div 
        onMouseDown={handleMouseDown}
        className="bg-slate-800 p-4 flex items-center justify-between border-b border-slate-700 cursor-move select-none active:cursor-grabbing"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-white font-medium">Simulated Line</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 pointer-events-none">VoIP: HD</span>
          {/* Drag Handle Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      </div>

      {/* Main Display */}
      <div className="p-6 flex flex-col items-center justify-center min-h-[180px] bg-gradient-to-b from-slate-900 to-slate-800 relative">
        
        {isActive ? (
          <>
            {/* Avatar / Visualizer */}
            <div className="relative mb-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold transition-all duration-200 ${isSpeaking ? 'scale-110 recording-pulse' : ''} ${isIrate ? 'bg-red-600' : 'bg-blue-600'}`}>
                {isIrate ? '😡' : 'AI'}
              </div>
            </div>
            
            <div className="text-center">
              <h3 className="text-white text-lg font-semibold">Incoming Call</h3>
              <p className="text-slate-400 text-sm mt-1">{isSpeaking ? "Customer is speaking..." : "Customer listening..."}</p>
            </div>
          </>
        ) : (
          <div className="text-center text-slate-500 w-full">
            <p className="mb-2">Ready for training.</p>
            <p className="text-xs mb-4">Configure scenario settings:</p>
            
            {/* Config Toggles */}
            <div className="flex flex-col gap-3 px-4">
              
              {/* Tagalog Toggle */}
              <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                <span className={`text-xs font-medium ${isTagalog ? 'text-blue-400' : 'text-slate-400'}`}>Tagalog Mode</span>
                <button 
                  onClick={() => setIsTagalog(!isTagalog)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${isTagalog ? 'bg-blue-600' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isTagalog ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              {/* Irate Toggle */}
              <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                <span className={`text-xs font-medium ${isIrate ? 'text-red-400' : 'text-slate-400'}`}>Irate Customer</span>
                <button 
                  onClick={() => setIsIrate(!isIrate)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${isIrate ? 'bg-red-600' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isIrate ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

            </div>
            <p className="text-[10px] mt-4 text-slate-600">Caller will be random male/female</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-slate-800 grid grid-cols-3 gap-4 items-center justify-items-center border-t border-slate-700">
        <button className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        {!isActive ? (
           <button 
           onClick={onStartCall}
           className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg hover:bg-green-600 hover:scale-105 transition-all"
         >
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
           </svg>
         </button>
        ) : (
          <button 
            onClick={onEndCall}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg hover:bg-red-600 hover:scale-105 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21l-1.498-4.493A1 1 0 005.372 3H5z" />
            </svg>
          </button>
        )}

        <button className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </button>
      </div>
      
      {statusMessage && (
        <div className="px-4 py-2 bg-red-900/50 text-red-200 text-xs text-center">
          {statusMessage}
        </div>
      )}
    </div>
  );
};