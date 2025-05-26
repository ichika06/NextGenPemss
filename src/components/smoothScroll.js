/**
 * SmoothScroll component that handles smooth scrolling behavior and global transitions.
 * It sets up event listeners for anchor link clicks, applies global CSS transitions,
 * and configures scroll restoration behavior.
 * @returns null
 */
import { useEffect } from "react";

/**
 * SmoothScroll Component
 * 
 * This component provides universal smooth scrolling and transitions to your application
 * using your custom design system variables.
 * It should be imported once at the top level of your application.
 */
const SmoothScroll = () => {
  useEffect(() => {
    // Function to handle smooth scrolling for all anchor links
    const handleAnchorLinkClick = (e) => {
      const target = e.target.closest('a[href^="#"]');
      if (!target) return;
      
      const id = target.getAttribute('href');
      if (!id || id === '#') return;
      
      const element = document.querySelector(id);
      if (!element) return;

      e.preventDefault();
      
      // Smooth scroll to element
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      
      // Update URL without reloading page
      if (history.pushState) {
        history.pushState(null, null, id);
      }
    };

    // Apply global transition styles using your design system variables
    const applyGlobalTransitions = () => {
      const style = document.createElement('style');
      style.innerHTML = `
        * {
          transition: all 0.3s ease-out;
        }
        
        /* Button hover transitions */
        button, a.btn-primary, .btn-primary, a {
          transition: all 0.25s ease !important;
        }
        
        /* Smooth scrolling for whole page */
        html {
          scroll-behavior: smooth;
          background-color: var(--background);
          color: var(--text-primary);
        }
        
        /* Navigation hover effects */
        nav a, .mobile-menu a {
          position: relative;
          transition: color 0.3s ease !important;
          font-family: var(--header-font-second);
          font-weight: 600;
        }
        
        nav a::after, .mobile-menu a::after {
          content: '';
          position: absolute;
          width: 0;
          height: 2px;
          bottom: -2px;
          left: 0;
          background-color: var(--primary);
          transition: width 0.3s ease;
          opacity: 0;
        }
        
        nav a:hover::after, .mobile-menu a:hover::after {
          width: 100%;
          opacity: 1;
        }
        
        /* Card and section transitions */
        .bg-white, .bg-gray-50, .shadow-md, .shadow-lg, .hover\\:shadow-md, .hover\\:shadow-lg {
          transition: all 0.4s ease !important;
          border-radius: var(--radius-lg);
        }
        
        /* Mobile menu animation */
        .mobile-menu {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.5s ease-in-out, opacity 0.5s ease-in-out !important;
          opacity: 0;
          font-family: var(--header-font-second);
        }
        
        .mobile-menu.open {
          max-height: 500px;
          opacity: 1;
        }
        
        /* Button styles with your custom colors */
        .btn-primary {
          background-color: var(--primary);
          color: white;
          transition: background-color 0.3s ease;
          border-radius: var(--radius-md);
          font-family: var(--paragraph-font);
        }
        
        .btn-primary:hover {
          background-color: var(--primary-hover);
        }
        
        /* Card hover effects */
        .card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }
        
        .card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
        }
        
        /* Input focus animations */
        input, textarea, select {
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
        }
        
        input:focus, textarea:focus, select:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--primary-transparent);
          outline: none;
        }
        
        /* Page section transitions */
        section {
          transition: opacity 0.5s ease;
        }
      `;
      document.head.appendChild(style);
    };

    // Apply scroll restoration to preserve scroll position on navigation
    const setupScrollRestoration = () => {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto';
      }
    };

    // Add event listener for all anchor links
    document.body.addEventListener('click', handleAnchorLinkClick);
    
    // Apply global transitions
    applyGlobalTransitions();
    
    // Setup scroll restoration
    setupScrollRestoration();

    // Cleanup function
    return () => {
      document.body.removeEventListener('click', handleAnchorLinkClick);
    };
  }, []);

  return null; // This component doesn't render anything
};

export default SmoothScroll;