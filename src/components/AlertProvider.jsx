import React, { createContext, useContext, useState, useEffect } from "react";
import {
  CheckCircle,
  AlertCircle,
  Info,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import "../index.css";

// Create context with default values
const AlertContext = createContext({
  showAlert: () => {},
  hideAlert: () => {},
});

// Custom hook for using the alert context
export const useAlert = () => useContext(AlertContext);

export const AlertProvider = ({ children }) => {
  const [alert, setAlert] = useState({
    show: false,
    icon: "info",
    header: "",
    description: "",
    variant: "info",
    position: "bottom-left",
    animation: "slide-up",
    duration: 5000,
    headerColor: "",
    descriptionColor: "",
    borderColor: "",
    closeButtonColor: "",
    closeBtnHoverColor: "",
    fadeOutDuration: 500,
    hideAfterDuration: true,
    onComplete: null,
    width: "md", // Default width (medium)
    height: "auto", // Default height (auto)
    responsiveMode: "stack", // Default responsive mode
  });

  // Function to show alert with named parameters
  const showAlert = (options = {}) => {
    const {
      icon = "info",
      header = "",
      description = "",
      variant = "info",
      position = "bottom-left",
      animation = "slide-up",
      duration = 5000,
      headerColor = "",
      descriptionColor = "",
      borderColor = "",
      closeButtonColor = "",
      closeBtnHoverColor = "",
      fadeOutDuration = 500,
      hideAfterDuration = true,
      onComplete = null,
      width = "md",
      height = "auto",
      responsiveMode = "stack",
    } = options;

    setAlert({
      show: true,
      icon,
      header,
      description,
      variant,
      position,
      animation,
      duration,
      headerColor,
      descriptionColor,
      borderColor,
      closeButtonColor,
      closeBtnHoverColor,
      fadeOutDuration,
      hideAfterDuration,
      onComplete,
      width,
      height,
      responsiveMode,
    });
  };

  // Legacy function to maintain backward compatibility
  const showAlertLegacy = (
    icon = "info",
    header = "",
    description = "",
    variant = "info",
    position = "bottom-left",
    animation = "slide-up",
    duration = 5000,
    headerColor = "",
    descriptionColor = "",
    borderColor = "",
    closeButtonColor = "",
    closeBtnHoverColor = "",
    fadeOutDuration = 500,
    hideAfterDuration = true,
    onComplete = null,
    width = "md",
    height = "auto",
    responsiveMode = "stack"
  ) => {
    setAlert({
      show: true,
      icon,
      header,
      description,
      variant,
      position,
      animation,
      duration,
      headerColor,
      descriptionColor,
      borderColor,
      closeButtonColor,
      closeBtnHoverColor,
      fadeOutDuration,
      hideAfterDuration,
      onComplete,
      width,
      height,
      responsiveMode,
    });
  };

  // Function to hide alert
  const hideAlert = () => {
    setAlert((prev) => ({ ...prev, show: false }));
  };

  // The Alert component integrated directly into the provider
  const Alert = () => {
    const [isShowing, setIsShowing] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [windowWidth, setWindowWidth] = useState(
      typeof window !== "undefined" ? window.innerWidth : 1200
    );

    // Track window size for responsive behavior
    useEffect(() => {
      const handleResize = () => {
        setWindowWidth(window.innerWidth);
      };

      if (typeof window !== "undefined") {
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
      }
    }, []);

    // Control visibility and fading states
    useEffect(() => {
      if (alert.show) {
        setIsShowing(true);
        setIsFadingOut(false);
      } else {
        handleHide();
      }
    }, [alert.show]);

    // Auto-hide alert after duration
    useEffect(() => {
      let timer;
      if (
        isShowing &&
        !isFadingOut &&
        alert.hideAfterDuration &&
        alert.duration > 0
      ) {
        timer = setTimeout(() => {
          handleHide();
        }, alert.duration);
      }

      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [isShowing, isFadingOut, alert.duration, alert.hideAfterDuration]);

    // Handle hiding with fade effect
    const handleHide = () => {
      setIsFadingOut(true);
      // Wait for fade animation to complete before fully removing
      setTimeout(() => {
        setIsShowing(false);
        setIsFadingOut(false);
        hideAlert();

        // Execute the callback after the alert is completely hidden
        if (typeof alert.onComplete === "function") {
          alert.onComplete();
        }
      }, alert.fadeOutDuration);
    };

    // Define variant styles with CSS variables
    const variantStyles = {
      info: {
        bg: { backgroundColor: "var(--color-blue-50)" },
        text: { color: "var(--color-blue-800)" },
        border: { borderColor: "var(--color-blue-200)" },
        headerDefault: { color: "var(--color-blue-900)" },
        descDefault: { color: "var(--color-blue-700)" },
        closeDefault: { color: "var(--color-blue-500)" },
        closeHoverDefault: { backgroundColor: "var(--color-blue-100)" },
      },
      success: {
        bg: { backgroundColor: "var(--color-green-50)" },
        text: { color: "var(--color-green-800)" },
        border: { borderColor: "var(--color-green-200)" },
        headerDefault: { color: "var(--color-green-900)" },
        descDefault: { color: "var(--color-green-700)" },
        closeDefault: { color: "var(--color-green-500)" },
        closeHoverDefault: { backgroundColor: "var(--color-green-100)" },
      },
      warning: {
        bg: { backgroundColor: "var(--color-amber-50)" },
        text: { color: "var(--color-amber-800)" },
        border: { borderColor: "var(--color-amber-200)" },
        headerDefault: { color: "var(--color-amber-900)" },
        descDefault: { color: "var(--color-amber-700)" },
        closeDefault: { color: "var(--color-amber-500)" },
        closeHoverDefault: { backgroundColor: "var(--color-amber-100)" },
      },
      error: {
        bg: { backgroundColor: "var(--color-red-50)" },
        text: { color: "var(--color-red-800)" },
        border: { borderColor: "var(--color-red-200)" },
        headerDefault: { color: "var(--color-red-900)" },
        descDefault: { color: "var(--color-red-700)" },
        closeDefault: { color: "var(--color-red-500)" },
        closeHoverDefault: { backgroundColor: "var(--color-red-100)" },
      },
    };

    // Get the appropriate style based on variant
    const style = variantStyles[alert.variant] || variantStyles.info;

    // Position styles
    const positionStyles = {
      "top-left": "fixed top-4 left-4",
      "top-center": "fixed top-4 left-1/2 transform -translate-x-1/2",
      "top-right": "fixed top-4 right-4",
      "bottom-left": "fixed bottom-4 left-4",
      "bottom-center": "fixed bottom-4 left-1/2 transform -translate-x-1/2",
      "bottom-right": "fixed bottom-4 right-4",
      center:
        "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
      static: "", // Default, non-positioned
    };

    // Width styles
    const widthStyles = {
      xs: "max-w-xs",
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
      xl: "max-w-xl",
      "2xl": "max-w-2xl",
      full: "w-full",
      auto: "w-auto",
    };

    // Height styles
    const heightStyles = {
      xs: "h-16",
      sm: "h-24",
      md: "h-32",
      lg: "h-40",
      xl: "h-48",
      "2xl": "h-56",
      auto: "h-auto",
      full: "h-full",
    };

    // Animation styles (using the custom CSS animations)
    const getAnimationClass = () => {
      if (!isShowing) return "opacity-0";
      if (isFadingOut) return "animate-fade-out";

      return animationStyles[alert.animation] || "animate-fade-in";
    };

    // Animation styles
    const animationStyles = {
      "slide-up": "animate-slide-up",
      "slide-down": "animate-slide-down",
      "slide-right": "animate-slide-right",
      "slide-left": "animate-slide-left",
      fade: "animate-fade-in",
      none: "opacity-100",
    };

    // Determine if we're in mobile view
    const isMobile = windowWidth < 640;

    // Get responsive layout
    const getResponsiveLayout = () => {
      if (isMobile) {
        // On mobile, adjust width to be smaller and proper positioning
        return "w-11/12 mx-auto";
      }

      return widthStyles[alert.width] || widthStyles.md;
    };

    // Map string icon names to components
    const getIcon = () => {
      if (React.isValidElement(alert.icon)) {
        return alert.icon;
      }

      const iconMap = {
        info: <Info className="h-5 w-5" />,
        success: <CheckCircle className="h-5 w-5" />,
        warning: <AlertTriangle className="h-5 w-5" />,
        error: <XCircle className="h-5 w-5" />,
        alert: <AlertCircle className="h-5 w-5" />,
      };

      return iconMap[alert.icon] || iconMap.info;
    };

    if (!isShowing && !alert.show) return null;

    // Parse hex colors or use default styles
    const getCustomColorStyle = (color, defaultStyle) => {
      if (color && typeof color === "string") {
        // If it's a hex color, use it directly
        if (color.startsWith("#")) {
          return { color };
        }
        // If it's a named color with variant (like red-500), convert to CSS variable
        else if (color.includes("-")) {
          const [colorName, shade] = color.split("-");
          return { color: `var(--color-${colorName}-${shade})` };
        }
        // If it's just a Tailwind class, just return an empty object
        // as we'll handle this as a className elsewhere
        return {};
      }
      return defaultStyle;
    };

    // Apply custom colors or defaults
    const headerStyle = getCustomColorStyle(
      alert.headerColor,
      style.headerDefault
    );
    const descStyle = getCustomColorStyle(
      alert.descriptionColor,
      style.descDefault
    );
    const closeBtnStyle = getCustomColorStyle(
      alert.closeButtonColor,
      style.closeDefault
    );

    // Get border style
    const getBorderStyle = () => {
      if (alert.borderColor && typeof alert.borderColor === "string") {
        // If it's a hex color
        if (alert.borderColor.startsWith("#")) {
          return { borderColor: alert.borderColor };
        }
        // If it's a named color with variant (like red-500)
        else if (alert.borderColor.includes("-")) {
          const [colorName, shade] = alert.borderColor.split("-");
          return { borderColor: `var(--color-${colorName}-${shade})` };
        }
      }
      return style.border;
    };

    // Prepare hover style for close button
    const getHoverClass = () => {
      // If custom hover color provided
      if (alert.closeBtnHoverColor) {
        if (alert.closeBtnHoverColor.startsWith("#")) {
          // For hex color, we'd need to use inline style with :hover in a real app
          // This is simplified for the example
          return "";
        } else {
          // For named colors, we could use Tailwind, but keeping it simple
          return "";
        }
      }
      return "hover:bg-opacity-80"; // Default hover effect
    };

    // Get height style
    const getHeight = () => {
      if (alert.height === "auto") return {};

      return {
        height: heightStyles[alert.height]?.replace("h-", "") || "auto",
      };
    };

    // Get content layout for the alert
    const getContentLayout = () => {
      // For inline mode, we'll use a different structure
      if (alert.responsiveMode === "inline") {
        return "flex items-center w-full";
      }

      // For stack mode or default behavior, stack on mobile only
      return isMobile
        ? "flex flex-col items-start"
        : "flex flex-row items-start";
    };

    const getIconSpacing = () => {
      if (alert.responsiveMode === "inline") {
        return "mr-3"; // Always have right margin in inline mode
      }

      return isMobile ? "mb-2" : "mr-3";
    };

    return (
      <div
        className={`z-50 ${getResponsiveLayout()} ${
          positionStyles[alert.position]
        } transition-all duration-300 ${getAnimationClass()}`}
        style={{ transitionDuration: `${alert.fadeOutDuration}ms` }}
      >
        <div
          className="flex items-start p-4 mb-4 border rounded-lg shadow-xl relative"
          style={{
            ...style.bg,
            border: "1px solid",
            ...getBorderStyle(),
            ...getHeight(),
          }}
          role="alert"
        >
          {/* Conditional layout based on responsiveMode */}
          {alert.responsiveMode === "inline" ? (
            <>
              {/* Icon on the left */}
              <div className="flex-shrink-0 mr-3" style={style.text}>
                {getIcon()}
              </div>

              {/* Content centered */}
              <div className="flex-grow text-center">
                {alert.header && (
                  <h3
                    className="font-medium inline-block mr-2"
                    style={headerStyle}
                  >
                    {alert.header}
                  </h3>
                )}
                {alert.description && (
                  <div className="text-sm inline-block" style={descStyle}>
                    {alert.description}
                  </div>
                )}
              </div>

              {/* Close button on the right */}
              <button
                onClick={handleHide}
                className={`flex-shrink-0 -mx-1.5 -my-1.5 p-1.5 rounded-lg focus:ring-2 focus:ring-gray-400 inline-flex items-center justify-center ${getHoverClass()}`}
                style={closeBtnStyle}
                aria-label="Close"
              >
                <span className="sr-only">Close</span>
                <XCircle className="w-4 h-4" />
              </button>
            </>
          ) : (
            // Original layout for non-inline modes
            <div className={getContentLayout()}>
              <div
                className={`flex-shrink-0 ${getIconSpacing()}`}
                style={style.text}
              >
                {getIcon()}
              </div>
              <div className="flex-1">
                {alert.header && (
                  <h3 className="font-medium mb-1" style={headerStyle}>
                    {alert.header}
                  </h3>
                )}
                {alert.description && (
                  <div className="text-sm" style={descStyle}>
                    {alert.description}
                  </div>
                )}
              </div>
              <button
                onClick={handleHide}
                className={`ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-lg focus:ring-2 focus:ring-gray-400 inline-flex items-center justify-center ${getHoverClass()}`}
                style={closeBtnStyle}
                aria-label="Close"
              >
                <span className="sr-only">Close</span>
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AlertContext.Provider value={{ showAlert, showAlertLegacy, hideAlert }}>
      {children}
      {alert.show && <Alert />}
    </AlertContext.Provider>
  );
};

export default AlertContext;

// Example usage with the updated AlertContext

// Using the new named parameters approach
// const { showAlert } = useAlert();

// Example 1: Session timeout alert with named parameters
// showAlert({
//   icon: "warning",
//   header: "Session Expired",
//   description: "Your session has expired due to inactivity. Please log in again to continue.",
//   variant: "warning",
//   position: "bottom-left",
//   animation: "slide-up",
//   duration: 15000,
//   headerColor: "#78350f",
//   descriptionColor: "#92400e",
//   borderColor: "#fde68a",
//   width: "md",
//   height: "auto",
//   responsiveMode: "stack"
// });

// // Example 2: Success alert with different width and height
// showAlert({
//   icon: "success",
//   header: "Profile Updated",
//   description: "Your profile has been successfully updated!",
//   variant: "success",
//   position: "top-right",
//   animation: "slide-down",
//   duration: 5000,
//   width: "sm",
//   height: "sm"
// });

// // Example 3: Error alert with custom dimensions
// showAlert({
//   icon: "error",
//   header: "Error",
//   description: "There was an error processing your request. Please try again later.",
//   variant: "error",
//   position: "center",
//   width: "lg",
//   height: "auto",
//   responsiveMode: "inline" // Keep the icon and text inline even on small screens
// });

// // Example 4: Alert for smaller screens with stack layout
// showAlert({
//   icon: "info",
//   header: "Information",
//   description: "This alert will stack content vertically on small screens for better readability.",
//   variant: "info",
//   position: "bottom-center",
//   width: "xl",
//   responsiveMode: "stack" // Stack the icon and content on small screens
// });

// import { AlertProvider, useAlert } from "./components/AlertContext.jsx";

// const { showAlert } = useAlert();

// showAlert({
//   icon: "warning",
//   header: "Session Expired",
//   description:
//     "Your session has expired due to inactivity. Please log in again to continue.",
//   variant: "warning",
//   position: window.innerWidth < 768 ? "top-center" : "bottom-left",
//   animation: window.innerWidth < 768 ? "slide-down" : "slide-up",
//   duration: 15000,
//   headerColor: "#78350f",
//   descriptionColor: "#92400e",
//   borderColor: "#fde68a",
//   width: window.innerWidth < 768 ? "sm" : "md", // Adjust width for smaller screens
//   responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
// });