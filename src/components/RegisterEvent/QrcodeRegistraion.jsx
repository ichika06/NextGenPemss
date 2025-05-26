import { useState, useRef, useEffect } from "react";
import { X, Download, Copy, Share2 } from "lucide-react";
import QRCode from "react-qr-code";

/**
 * Component for generating a QR code for event registration
 * @param {Object} props Component props
 * @param {string} props.eventId The ID of the event
 * @param {string} props.eventTitle The title of the event
 * @param {Function} props.onClose Function to close the modal
 * @returns {JSX.Element} QR code registration component
 */
export default function QRCodeRegistration({ eventId, eventTitle = "Event", onClose }) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);
  
  // This would be your actual registration URL
  const registrationUrl = `https://next-gen-pemss.netlify.app/register/${eventId}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Register for ${eventTitle || "Event"}`,
        text: `Scan this QR code to register for ${eventTitle || "Event"}`,
        url: registrationUrl,
      }).catch(err => console.error("Error sharing:", err));
    } else {
      handleCopyLink();
    }
  };

  const handleDownload = () => {
    const svg = qrRef.current;
    if (!svg) return;
    
    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    // Set dimensions
    canvas.width = 256;
    canvas.height = 256;
    
    // Create a new image with SVG data
    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      // Draw white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw the QR code
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Generate a safe filename with fallback for missing eventTitle
      const safeFileName = (eventTitle || "event").replace(/\s+/g, '-').toLowerCase();
      
      // Convert to PNG and trigger download
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${safeFileName}-registration-qr.png`;
      link.href = dataUrl;
      link.click();
      
      // Clean up
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Registration QR Code</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="px-6 py-6 flex flex-col items-center">
          <p className="text-gray-600 mb-4 text-center">
            Share this QR code with attendees to allow them to register for the event.
          </p>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
            <QRCode
              ref={qrRef}
              value={registrationUrl}
              size={192} // 48 * 4 = 192px (equals w-48 h-48)
              level="H" // High error correction
              className="w-48 h-48"
            />
          </div>
          
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">Registration Link:</p>
            <p className="text-gray-700 font-medium break-all">{registrationUrl}</p>
          </div>
          
          <div className="flex gap-3 w-full mb-3">
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy Link"}
            </button>
            
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
          
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            <Download className="h-4 w-4" />
            Download QR Code
          </button>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}