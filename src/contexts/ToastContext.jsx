// src/contexts/ToastContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const savedToast = localStorage.getItem('toast');
    if (savedToast) {
      setToast(JSON.parse(savedToast));
    }
  }, []);

  useEffect(() => {
    if (toast) {
      localStorage.setItem('toast', JSON.stringify(toast));
    } else {
      localStorage.removeItem('toast');
    }
  }, [toast]);

  const showToast = (message, isLoading = true, sentCount = 0, totalCount = 0) => {
    setToast({ message, isLoading, sentCount, totalCount });
  };

  const updateToastProgress = (sentCount) => {
    setToast(prevToast => ({ ...prevToast, sentCount }));
  };

  const showSuccessToast = (message) => {
    setToast({ message, isLoading: false });
  };

  const hideToast = () => {
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ toast, showToast, updateToastProgress, showSuccessToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  return useContext(ToastContext);
};
