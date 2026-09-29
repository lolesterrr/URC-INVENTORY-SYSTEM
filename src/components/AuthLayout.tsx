import React from 'react';
import urcLogo from '../assets/images/company_logo.png';
import ugandaTrain from '../assets/images/uganda_train_1784095821816.jpg';

/** Two-column layout shared by the sign-in and password-change screens. */
export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex bg-slate-900 overflow-hidden font-sans">
      {/* Left column: Beautiful highquality Uganda train image banner */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={ugandaTrain} 
            alt="Uganda Railways Passenger Train" 
            className="w-full h-full object-cover opacity-30 filter brightness-75 transition-all duration-700 hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </div>
        {/* Accent decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-bl-full blur-2xl"></div>
        
        <div className="relative z-10 max-w-lg text-white space-y-6">
          <div className="flex items-center gap-3">
            <span className="bg-yellow-500 text-slate-950 text-[10px] font-black uppercase font-mono px-2.5 py-1 rounded tracking-widest shadow-md">URC Operations</span>
            <span className="text-slate-300 text-xs font-bold tracking-widest font-mono">EST. 1901</span>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
              Uganda Railways <span className="text-yellow-400">Corporation</span>
            </h1>
            <p className="text-base text-slate-300 leading-relaxed font-light">
              IT asset register for hardware, software licences and server components, with role-based access and a full change history.
            </p>
          </div>

          <div className="border-l-2 border-yellow-500 pl-4 py-2 space-y-1.5 bg-slate-900/40 backdrop-blur-xs p-3 rounded">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-mono font-bold">Kampala Transit Operations</p>
            <p className="text-[11px] text-slate-300">
              Authorized operators can register, verify inventory serial keys, log server diagnostics, and process immediate custom asset audits.
            </p>
          </div>
          
          <div className="pt-4 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
            <span>INTERNAL NETWORK ONLY</span>
            <span>•</span>
            <span>HOST: KAMPALA DC 1</span>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 bg-white text-slate-950">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img
                src={urcLogo}
                alt="Uganda Railways Corporation Logo"
                className="h-20 w-20 object-contain rounded-full border border-slate-200 p-1 shadow-sm bg-white"
              />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
              <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
