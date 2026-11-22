"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Settings, Moon, Sun, Monitor } from "lucide-react";
import { PushNotificationManager } from "@/components/features/PushNotificationManager";
import { Modal } from "@/components/ui/Modal";

export function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-12 h-12 flex items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all active:scale-95"
        aria-label="Configurações"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Settings size={24} aria-hidden="true" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Configurações"
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-6">
          {/* Notificações */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Avisos
            </p>
            <PushNotificationManager />
          </div>

          {/* Aparência */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Aparência
            </p>

            <div className="flex gap-2 p-1.5 bg-background/50 rounded-xl border border-border-strong">
              <button
                type="button"
                aria-pressed={theme === "light"}
                onClick={() => setTheme("light")}
                className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg transition-all ${
                  theme === "light"
                    ? "bg-card shadow-sm border border-border-strong text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <Sun size={20} aria-hidden="true" />
                <span className="text-xs">Claro</span>
              </button>

              <button
                type="button"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
                className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg transition-all ${
                  theme === "dark"
                    ? "bg-card shadow-sm border border-border-strong text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <Moon size={20} aria-hidden="true" />
                <span className="text-xs">Escuro</span>
              </button>

              <button
                type="button"
                aria-pressed={theme === "system"}
                onClick={() => setTheme("system")}
                className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg transition-all ${
                  theme === "system"
                    ? "bg-card shadow-sm border border-border-strong text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <Monitor size={20} aria-hidden="true" />
                <span className="text-xs">Sistema</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
