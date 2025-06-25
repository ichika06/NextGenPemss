import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Bouncy } from 'ldrs/react'
import 'ldrs/ring'
import 'ldrs/react/Bouncy.css'

/**
 * LoadingAnimation Component
 *
 * A versatile loading component that supports multiple animation types,
 * sizes, and color variants with optional auto-completion.
 *
 * @param {Object} props - Component props
 * @param {string} props.type - Animation type: "spinner", "pulse", "shimmer", or "dots"
 * @param {string} props.size - Size of animation: "xs", "sm", "md", "lg", or "xl"
 * @param {string} props.variant - Color variant: "primary", "success", "danger", "info", or "warning"
 * @param {boolean} props.showText - Whether to show text alongside animation
 * @param {string} props.text - Custom text to display
 * @param {boolean} props.isLoading - Whether loading state is active
 * @param {Function} props.onLoadingComplete - Callback when loading completes
 * @param {number} props.autoCompleteAfter - Duration in ms for auto-completion (0 to disable)
 * @param {string} props.className - Additional CSS classes
 */
export function LoadingAnimation({
  type = "spinner",
  size = "md",
  variant = "primary",
  showText = true,
  text = "Loading",
  isLoading = true,
  onLoadingComplete,
  autoCompleteAfter = 0,
  className,
}) {
  // State to track loading status
  const [loading, setLoading] = useState(isLoading);

  // Update loading state when isLoading prop changes
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  // Handle auto-completion of loading state
  useEffect(() => {
    if (autoCompleteAfter > 0 && loading) {
      const timer = setTimeout(() => {
        setLoading(false);
        onLoadingComplete && onLoadingComplete();
      }, autoCompleteAfter);

      return () => clearTimeout(timer);
    }
  }, [autoCompleteAfter, loading, onLoadingComplete]);

  // CSS class maps for different properties
  const sizeClasses = {
    xs: "h-3 w-3",
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-8 w-8",
  };

  const textSizeClasses = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  };

  const variantClasses = {
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
    info: "text-info",
    warning: "text-warning",
  };

  // Helper function to combine classes
  const cn = (...classes) => {
    return classes.filter(Boolean).join(" ");
  };

  /**
   * Render the appropriate animation based on the selected type
   * @returns JSX for the animation element
   */
  const renderAnimation = () => {
    if (!loading) {
      return null;
    }

    switch (type) {
      case "spinner":
        return (
          // Default values shown
          <Bouncy
            size="30"
            speed="1.20"
            color={variant === "primary" ? "blue" : variant}
          />  
        );
      case "pulse":
        return (
          <div
            className={cn(
              "rounded-full animate-pulse-blue",
              sizeClasses[size],
              variantClasses[variant],
              "bg-current opacity-75"
            )}
          />
        );
      case "shimmer":
        return (
          <div
            className={cn(
              "animate-shimmer rounded-md",
              sizeClasses[size],
              `bg-${variant}-light`
            )}
          />
        );
      case "dots":
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full",
                  variantClasses[variant],
                  "bg-current",
                  "animate-pulse",
                  {
                    "h-1 w-1": size === "xs",
                    "h-2 w-2": size === "sm",
                    "h-2.5 w-2.5": size === "md",
                    "h-3 w-3": size === "lg",
                    "h-4 w-4": size === "xl",
                  },
                  "opacity-75"
                )}
                style={{
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        );
      default:
        return (
          <RefreshCw
            className={cn(
              "animate-spin",
              sizeClasses[size],
              variantClasses[variant]
            )}
          />
        );
    }
  };

  // Return the component JSX
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderAnimation()}
      {showText && loading && (
        <span
          className={cn(
            textSizeClasses[size],
            variantClasses[variant],
            "font-medium"
          )}
        >
          {text}
        </span>
      )}
      {!loading && onLoadingComplete && (
        <div className="flex items-center gap-2 animate-fadeIn">
          <div
            className={cn(
              "rounded-full bg-success flex items-center justify-center",
              sizeClasses[size]
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="text-white w-3/4 h-3/4"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            className={cn(textSizeClasses[size], "text-success font-medium")}
          >
            Complete
          </span>
        </div>
      )}
    </div>
  );
}

// Export a simple utility function to replace the cn import
export const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};

// import { LoadingAnimation } from '../components/LoadingAnimation'

// // Basic usage
// <LoadingAnimation />

// // With customized props
// <LoadingAnimation
//   type="spinner"
//   size="md"
//   variant="primary"
//   text="Loading data..."
// />

// // With controlled loading state
// <LoadingAnimation
//   isLoading={isDataLoading}
//   onLoadingComplete={() => console.log('Loading complete!')}
// />

// // With auto-completion after 3 seconds
// <LoadingAnimation
//   autoCompleteAfter={3000}
//   onLoadingComplete={handleLoadingComplete}
// />
// <div className="flex justify-center py-8">
//             <LoadingAnimation
//               type="dots"
//               size="md"
//               variant="info"
//               text="Loading registered events..."
//             />
//           </div>
