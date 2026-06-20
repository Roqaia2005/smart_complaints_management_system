import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { Button } from '../ui/button';

export function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useThemeStore();

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-full w-10 h-10   transition-all border border-slate-700 dark:border-white/10"
    >
      {isDarkMode ? (
        <Sun className="text-amber-400" size={18} />
      ) : (
        <Moon className="text-slate-600" size={18} />
      )}
    </Button>
  );
}
