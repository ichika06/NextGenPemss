// src/components/DarkModeToggle.jsx
import { useEffect, useState } from 'react';
import { Moon, SunDim } from 'lucide-react';

export default function DarkModeToggle() {
  // Initialize state from localStorage or default to system preference
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      // Check system preference if no theme is saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      
      // Apply dark mode styles to all elements
      document.documentElement.style.setProperty('--bg-color', '#1f2937');
      document.documentElement.style.setProperty('--text-color', '#e5e7eb');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      
      // Apply light mode styles to all elements
      document.documentElement.style.setProperty('--bg-color', '#ffffff');
      document.documentElement.style.setProperty('--text-color', '#111827');
    }
    
    // Add global styles that apply to all elements
    const globalStyle = document.getElementById('dark-mode-global-style') || document.createElement('style');
    globalStyle.id = 'dark-mode-global-style';
    globalStyle.textContent = `
      * {
        transition: background-color 0.3s ease, color 0.3s ease;
      }
      
      .dark * {
        color-scheme: dark;
      }
    `;
    document.head.appendChild(globalStyle);
  }, [darkMode]);

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="p-2 rounded-full transition-all duration-300 ease-in-out
                 bg-white dark:bg-gray-800
                 text-gray-800 dark:text-gray-200
                 hover:bg-gray-100 dark:hover:bg-gray-700
                 shadow-md dark:shadow-gray-900/30
                 border border-gray-200 dark:border-gray-700
                 transform hover:scale-110"
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? 
        <SunDim className="h-5 w-5 text-amber-500" /> : 
        <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
      }
    </button>
  );
}
