import React from 'react';

export default function Loading() {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md z-50">
            <div className="relative w-24 h-24">
                {/* Outer Ring */}
                <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-indigo-500 animate-spin" style={{ animationDuration: '2s' }} />

                {/* Middle Ring */}
                <div className="absolute inset-3 rounded-full border-r-2 border-b-2 border-purple-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />

                {/* Inner Dot */}
                <div className="absolute inset-[38%] rounded-full bg-white animate-pulse shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
            </div>

            <div className="mt-8 text-center space-y-2">
                <h3 className="text-xl font-bold text-white tracking-widest animate-pulse">FENFA AI</h3>
                <p className="text-sm text-indigo-400 font-medium">Loading Experience...</p>
            </div>
        </div>
    );
}
