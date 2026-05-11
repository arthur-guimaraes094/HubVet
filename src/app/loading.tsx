import { ViewTransition } from "react";

export default function Loading() {
  return (
    <ViewTransition exit="fade-out">
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 max-w-2xl mx-auto w-full animate-pulse">
        <div className="flex items-center justify-between mb-8 w-full">
          <div className="text-left space-y-2">
            <div className="h-10 w-32 bg-foreground/10 rounded-lg"></div>
            <div className="h-6 w-48 bg-foreground/10 rounded-lg"></div>
          </div>
          <div className="w-14 h-14 bg-foreground/10 rounded-full shadow-sm border border-border"></div>
        </div>

        <div className="w-full p-8 rounded-3xl bg-background shadow-sm border border-border flex flex-col gap-6">
          <div className="h-8 w-40 bg-foreground/10 rounded-lg"></div>
          
          <div className="h-14 w-full bg-background rounded-2xl shadow-inner border border-border bg-gray-50/50"></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 w-full bg-foreground/10 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}
