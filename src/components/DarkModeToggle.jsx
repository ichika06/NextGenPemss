// src/components/DarkModeToggle.jsx
import { useEffect, useState } from 'react';
import { Moon, SunDim } from 'lucide-react';

export default function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      root.classList.remove('dark');
      localStorage.theme = 'light';
    }
  }, [darkMode]);

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="p-2 rounded bg-gray-200 dark:bg-gray-500 text-black dark:text-white"
    >
      {darkMode ? <SunDim /> : <Moon />}
    </button>
  );
}
