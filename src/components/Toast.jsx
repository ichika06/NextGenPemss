// src/components/Toast.jsx
import React from 'react';
import { useToast } from '../contexts/ToastContext';
import { Loader2, CheckCircle } from 'lucide-react';
import 'ldrs/ring'
import { Mirage } from 'ldrs/react'
import 'ldrs/react/Mirage.css'

const Toast = () => {
  const { toast } = useToast();

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-indigo-500 dark:bg-indigo-500 text-white p-4 rounded-lg shadow-lg flex items-center">
        {toast.isLoading ? (
          

        // Default values shown
        <Mirage
          size="60"
          speed="2.5"
          color="white" 
        />
        ) : (
          <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
        )}
        <span>
          {toast.message} {toast.totalCount > 0 && `(${toast.sentCount}/${toast.totalCount})`}
        </span>
      </div>
    </div>
  );
};

export default Toast;
