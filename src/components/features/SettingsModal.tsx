"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Settings, Moon, Sun, Monitor } from "lucide-react";
import { PushNotificationManager } from "@/components/features/PushNotificationManager";

export function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 250); // Matches animation duration
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-12 h-12 flex items-center justify-center rounded-full text-foreground/50 hover:bg-foreground/5 hover:text-foreground transition-all active:scale-95"
        aria-label="Configurações"
      >
        <Settings size={24} />
      </button>

      {isOpen && (
        <div className={`fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-foreground/20 backdrop-blur-sm ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
          <div className="absolute inset-0" onClick={handleClose}></div>
          
          <div className={`relative w-full max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden p-6 pb-8 ${isClosing ? 'animate-slideDown' : 'animate-slideUp'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-foreground">Configurações</h3>
              <button 
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/40 hover:text-error hover:bg-error/10 transition-colors active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {/* Notificações */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-foreground/50 uppercase tracking-wider">Avisos</p>
                <PushNotificationManager />
              </div>

              {/* Aparência */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-foreground/50 uppercase tracking-wider">Aparência</p>
                
                <div className="flex gap-2 p-1 bg-background/50 rounded-xl border border-border">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all ${
                      theme === "light" 
                        ? "bg-card shadow-sm border border-border text-foreground font-bold" 
                        : "text-foreground/50 hover:bg-foreground/5"
                    }`}
                  >
                    <Sun size={20} />
                    <span className="text-xs">Claro</span>
                  </button>
                  
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all ${
                      theme === "dark" 
                        ? "bg-card shadow-sm border border-border text-foreground font-bold" 
                        : "text-foreground/50 hover:bg-foreground/5"
                    }`}
                  >
                    <Moon size={20} />
                    <span className="text-xs">Escuro</span>
                  </button>

                  <button
                    onClick={() => setTheme("system")}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all ${
                      theme === "system" 
                        ? "bg-card shadow-sm border border-border text-foreground font-bold" 
                        : "text-foreground/50 hover:bg-foreground/5"
                    }`}
                  >
                    <Monitor size={20} />
                    <span className="text-xs">Sistema</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
