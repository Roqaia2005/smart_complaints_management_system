import { motion } from "framer-motion";
import { Sparkles, MessageSquareText } from "lucide-react";
import { cn } from "../../lib/utils";

interface ExecutiveAssistantLauncherProps {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly unreadCount?: number;
}

export function ExecutiveAssistantLauncher({
  isOpen,
  onToggle,
  unreadCount = 0,
}: ExecutiveAssistantLauncherProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={cn(
        "fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full border border-white/60 bg-white/80 px-4 py-3 text-sm font-semibold shadow-[0_16px_48px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-all dark:border-white/10 dark:bg-slate-950/80",
        isOpen ? "ring-2 ring-primary/20" : "hover:border-primary/30",
      )}
      aria-label="Open executive assistant"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
        {isOpen ? (
          <MessageSquareText className="h-5 w-5" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
      </div>
      <div className="text-left">
        <div className="text-sm font-semibold">Executive AI Analyst</div>
        <div className="text-xs font-medium text-muted-foreground">
          {isOpen ? "Listening now" : "Ask anything"}
        </div>
      </div>
      {unreadCount > 0 ? (
        <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
          {unreadCount}
        </div>
      ) : null}
    </motion.button>
  );
}
