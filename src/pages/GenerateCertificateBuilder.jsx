import { useState, useRef, useEffect } from "react";
import {
  Save,
  ImageIcon,
  Type,
  Download,
  Trash2,
  Undo,
  Redo,
  FilePenLineIcon as Signature,
  Copy,
  Eye,
  FileImage,
  FileIcon as FilePdf,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Square,
  Grid,
  Loader2,
  Calendar,
  Mail,
  ChevronLeft,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import html2canvas from "html2canvas";
import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  doc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  where,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { jsPDF } from "jspdf";
import { storage } from "../firebase/config";
import {
  ref,
  uploadString,
  getDownloadURL,
  uploadBytes,
} from "firebase/storage";
import { sendEmail, EmailTemplates } from "../sendEmail";
import { useNavigate } from "react-router-dom";

// Add a function to parse and replace placeholders in text content
const parsePlaceholders = (text, event) => {
  if (!text || !event) return text;

  // Use regex to find all placeholders in curly braces with exact pattern matching
  return text.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (match, key) => {
    // Check if the key exists in the event data
    if (event[key] !== undefined) {
      return event[key];
    }
    // If key doesn't exist, return the original placeholder
    return match;
  });
};

// Add a new function to parse and replace attendee placeholders after the existing parsePlaceholders function
const parseAttendeePlaceholders = (text, attendee) => {
  if (!text || !attendee) return text;

  // Use regex to find all placeholders in curly braces with exact pattern matching
  return text.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (match, key) => {
    // Check if the key exists in the attendee data
    if (attendee[key] !== undefined) {
      return attendee[key];
    }
    // If key doesn't exist, return the original placeholder
    return match;
  });
};

// Main Creative Certificate Builder Component
export default function CreativeCertificateBuilder() {
  const certificateRef = useRef(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [gridColor, setGridColor] = useState("rgba(0, 0, 0, 0.1)");
  const [rulerColor, setRulerColor] = useState("rgba(0, 0, 0, 0.3)");
  const [isWhiteLines, setIsWhiteLines] = useState(false);
  const [borderStyle, setBorderStyle] = useState({
    color: "#d4af37",
    width: 12,
    style: "solid",
    radius: 8,
  });

  // Get current user from auth context
  const { currentUser } = useAuth();

  // Add state for user events
  const [userEvents, setUserEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Add state for event attendees after the other state declarations
  const [eventAttendees, setEventAttendees] = useState([]);
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [sendingMultiple, setSendingMultiple] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  // History for undo/redo functionality
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Certificate size and orientation
  const [certificateSize, setCertificateSize] = useState({
    width: 1000,
    height: 700,
    orientation: "landscape",
  });

  // Start with an empty elements array
  const [elements, setElements] = useState([]);
  const [originalelements, setoriginalelements] = useState([]);

  // Ruler and grid settings
  const [showRulers, setShowRulers] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50); // Set a default grid size

  const navigate = useNavigate();

  const [selectedElement, setSelectedElement] = useState(null);
  const [templates, setTemplates] = useState([
    {
      name: "Academic",
      border: "#003366",
      background: "#f5f5f5",
      elements: [
        {
          id: "title",
          type: "text",
          content: "Academic Certificate",
          x: 50,
          y: 15,
          fontSize: 32,
          fontFamily: "serif",
          color: "#003366",
          fontWeight: "bold",
          textAlign: "center",
          width: 300, // Add width property
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 10,
        },
        {
          id: "recipient-label",
          type: "text",
          content: "This certifies that",
          x: 50,
          y: 30,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 250,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 9,
        },
        {
          id: "recipient-name",
          type: "text",
          content: "John Doe",
          x: 50,
          y: 40,
          fontSize: 36,
          fontFamily: "cursive",
          color: "#0047ab",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: true,
            color: "rgba(0,0,0,0.2)",
            blur: 3,
            offsetX: 1,
            offsetY: 1,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 8,
        },
        {
          id: "accomplishment",
          type: "text",
          content: "has successfully completed the course with excellence",
          x: 50,
          y: 50,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 400,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 7,
        },
        {
          id: "date",
          type: "text",
          content: "April 19, 2025",
          x: 30,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 6,
        },
        {
          id: "issuer",
          type: "text",
          content: "Certificate Authority",
          x: 70,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 5,
        },
      ],
    },
    {
      name: "Professional",
      border: "#2c3e50",
      background: "#ecf0f1",
      elements: [
        {
          id: "title",
          type: "text",
          content: "Professional Certificate",
          x: 50,
          y: 15,
          fontSize: 32,
          fontFamily: "sans-serif",
          color: "#2c3e50",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 10,
        },
        {
          id: "recipient-label",
          type: "text",
          content: "This certifies that",
          x: 50,
          y: 30,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 250,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 9,
        },
        {
          id: "recipient-name",
          type: "text",
          content: "John Doe",
          x: 50,
          y: 40,
          fontSize: 36,
          fontFamily: "sans-serif",
          color: "#2c3e50",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: true,
            color: "rgba(0,0,0,0.2)",
            blur: 3,
            offsetX: 1,
            offsetY: 1,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 8,
        },
        {
          id: "accomplishment",
          type: "text",
          content:
            "has successfully completed the professional development program",
          x: 50,
          y: 50,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 400,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 7,
        },
        {
          id: "date",
          type: "text",
          content: "April 19, 2025",
          x: 30,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 6,
        },
        {
          id: "issuer",
          type: "text",
          content: "Professional Institute",
          x: 70,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 5,
        },
      ],
    },
    {
      name: "Creative",
      border: "#9b59b6",
      background: "#f9f2ff",
      elements: [
        {
          id: "title",
          type: "text",
          content: "Creative Achievement",
          x: 50,
          y: 15,
          fontSize: 32,
          fontFamily: "cursive",
          color: "#9b59b6",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 10,
        },
        {
          id: "recipient-label",
          type: "text",
          content: "This certifies that",
          x: 50,
          y: 30,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 250,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 9,
        },
        {
          id: "recipient-name",
          type: "text",
          content: "John Doe",
          x: 50,
          y: 40,
          fontSize: 36,
          fontFamily: "cursive",
          color: "#9b59b6",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: true,
            color: "rgba(0,0,0,0.2)",
            blur: 3,
            offsetX: 1,
            offsetY: 1,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 8,
        },
        {
          id: "accomplishment",
          type: "text",
          content:
            "has demonstrated exceptional creativity and artistic excellence",
          x: 50,
          y: 50,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 400,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 7,
        },
        {
          id: "date",
          type: "text",
          content: "April 19, 2025",
          x: 30,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 6,
        },
        {
          id: "issuer",
          type: "text",
          content: "Creative Arts Academy",
          x: 70,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 5,
        },
      ],
    },
    {
      name: "Elegant",
      border: "#d4af37",
      background: "#ffffff",
      elements: [
        {
          id: "title",
          type: "text",
          content: "Certificate of Excellence",
          x: 50,
          y: 15,
          fontSize: 32,
          fontFamily: "serif",
          color: "#d4af37",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 10,
        },
        {
          id: "recipient-label",
          type: "text",
          content: "This certifies that",
          x: 50,
          y: 30,
          fontSize: 18,
          fontFamily: "serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 250,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 9,
        },
        {
          id: "recipient-name",
          type: "text",
          content: "John Doe",
          x: 50,
          y: 40,
          fontSize: 36,
          fontFamily: "serif",
          color: "#d4af37",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: true,
            color: "rgba(0,0,0,0.2)",
            blur: 3,
            offsetX: 1,
            offsetY: 1,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 8,
        },
        {
          id: "accomplishment",
          type: "text",
          content: "has achieved the highest standards of excellence",
          x: 50,
          y: 50,
          fontSize: 18,
          fontFamily: "serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 400,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 7,
        },
        {
          id: "date",
          type: "text",
          content: "April 19, 2025",
          x: 30,
          y: 75,
          fontSize: 16,
          fontFamily: "serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 6,
        },
        {
          id: "issuer",
          type: "text",
          content: "Prestigious Institution",
          x: 70,
          y: 75,
          fontSize: 16,
          fontFamily: "serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 5,
        },
      ],
    },
    {
      name: "Modern",
      border: "#3498db",
      background: "#f8f9fa",
      elements: [
        {
          id: "title",
          type: "text",
          content: "Modern Certificate",
          x: 50,
          y: 15,
          fontSize: 32,
          fontFamily: "sans-serif",
          color: "#3498db",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 10,
        },
        {
          id: "recipient-label",
          type: "text",
          content: "This certifies that",
          x: 50,
          y: 30,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 250,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 9,
        },
        {
          id: "recipient-name",
          type: "text",
          content: "John Doe",
          x: 50,
          y: 40,
          fontSize: 36,
          fontFamily: "sans-serif",
          color: "#3498db",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: true,
            color: "rgba(0,0,0,0.2)",
            blur: 3,
            offsetX: 1,
            offsetY: 1,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 8,
        },
        {
          id: "accomplishment",
          type: "text",
          content: "has successfully completed the modern design course",
          x: 50,
          y: 50,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 400,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 7,
        },
        {
          id: "date",
          type: "text",
          content: "April 19, 2025",
          x: 30,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 6,
        },
        {
          id: "issuer",
          type: "text",
          content: "Modern Design Institute",
          x: 70,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 5,
        },
      ],
    },
    {
      name: "Corporate",
      border: "#34495e",
      background: "#ffffff",
      elements: [
        {
          id: "title",
          type: "text",
          content: "Corporate Recognition",
          x: 50,
          y: 15,
          fontSize: 32,
          fontFamily: "sans-serif",
          color: "#34495e",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 10,
        },
        {
          id: "recipient-label",
          type: "text",
          content: "This certifies that",
          x: 50,
          y: 30,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 250,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 9,
        },
        {
          id: "recipient-name",
          type: "text",
          content: "John Doe",
          x: 50,
          y: 40,
          fontSize: 36,
          fontFamily: "sans-serif",
          color: "#34495e",
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: true,
            color: "rgba(0,0,0,0.2)",
            blur: 3,
            offsetX: 1,
            offsetY: 1,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 8,
        },
        {
          id: "accomplishment",
          type: "text",
          content: "has demonstrated exceptional leadership and commitment",
          x: 50,
          y: 50,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 400,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 7,
        },
        {
          id: "date",
          type: "text",
          content: "April 19, 2025",
          x: 30,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 6,
        },
        {
          id: "issuer",
          type: "text",
          content: "Global Corporation",
          x: 70,
          y: 75,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#333333",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 5,
        },
      ],
    },
  ]);

  // Saved certificate designs
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [currentDesignName, setCurrentDesignName] = useState("Untitled Design");

  // Tabs for the control panel
  const [activeTab, setActiveTab] = useState("elements");

  // Signature pad
  const signaturePadRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  // Add a new state for background properties
  const [backgroundProps, setBackgroundProps] = useState({
    blur: 0,
    opacity: 1,
  });

  // Add a state for save status
  const [saveStatus, setSaveStatus] = useState("idle"); // idle, saving, saved, error

  // Add a new state for email sending status
  // Add this in the component's state declarations section
  const [emailStatus, setEmailStatus] = useState("idle"); // idle, sending, sent, error
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [downloadUrl, setdownloadUrl] = useState(null);

  // Add a new state for tracking mouse position
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Initialize canvas when component mounts
  useEffect(() => {
    const canvas = signaturePadRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000";

      // Set canvas dimensions to match displayed size to prevent scaling issues
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }, []);

  // Initialize history with the initial state
  useEffect(() => {
    if (history.length === 0) {
      saveToHistory();
    }
  }, []);

  // Add useEffect to load designs from Firestore on component mount
  useEffect(() => {
    loadDesignsFromFirestore();
  }, []);

  // Add useEffect to fetch user events when currentUser changes
  useEffect(() => {
    if (currentUser?.email) {
      fetchUserEvents();
    }
  }, [currentUser]);

  // Function to fetch user events from Firestore
  const fetchUserEvents = async () => {
    if (!currentUser?.email) return;

    setIsLoadingEvents(true);
    try {
      const eventsRef = collection(db, "events");
      const q = query(
        eventsRef,
        where("registrarEmail", "==", currentUser.email)
      );
      const querySnapshot = await getDocs(q);

      const events = [];
      querySnapshot.forEach((doc) => {
        events.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setUserEvents(events);
    } catch (error) {
      console.error("Error fetching user events:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Add this function after the fetchUserEvents function
  const fetchEventAttendees = async (eventId) => {
    if (!eventId) return;

    setIsLoadingAttendees(true);
    try {
      const attendeesRef = collection(db, "eventAttendees");
      const q = query(attendeesRef, where("eventId", "==", eventId));
      const querySnapshot = await getDocs(q);

      const attendees = [];
      querySnapshot.forEach((doc) => {
        attendees.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setEventAttendees(attendees);
      // Initially select all attendees
      setSelectedAttendees(attendees.map((a) => a.id));
    } catch (error) {
      console.error("Error fetching event attendees:", error);
    } finally {
      setIsLoadingAttendees(false);
    }
  };

  // Modify the handleEventSelect function to also fetch attendees
  const handleEventSelect = (eventId) => {
    const event = userEvents.find((event) => event.id === eventId);
    setSelectedEvent(event);

    // Fetch attendees for this event
    if (event) {
      fetchEventAttendees(event.id);

      // certificate elements with event data
      const updatedElements = elements.map((element) => {
        if (element.id === "title") {
          return { ...element, content: event.title };
        }
        if (element.id === "accomplishment") {
          return { ...element, content: `for participating in ${event.title}` };
        }
        if (element.id === "date") {
          return { ...element, content: event.date };
        }
        if (element.id === "issuer") {
          return { ...element, content: event.location || "Event Location" };
        }
        return element;
      });

      setElements(updatedElements);
      saveToHistory();

      // Update design name with event title
      setCurrentDesignName(`${event.title} Certificate`);

      // If event has an image, set it as background
      if (event.image) {
        setBackgroundImage(event.image);

        // Ensure background blur is applied if it was previously set
        if (backgroundProps.blur > 0) {
          // Force a re-render to ensure blur is applied
          setBackgroundProps({
            ...backgroundProps,
            blur: backgroundProps.blur,
          });
        }
      } else {
        // Clear attendees if no event is selected
        setEventAttendees([]);
        setSelectedAttendees([]);
      }
    } else {
      // Clear attendees if no event is selected
      setEventAttendees([]);
      setSelectedAttendees([]);
    }
  };

  // Add a function to upload certificate to Firebase Storage
  const uploadCertificateToStorage = async (dataUrl, attendeeId) => {
    if (!dataUrl) return null;

    try {
      // Create a clean folder name (remove special characters)
      const folderName = (selectedEvent?.title || currentDesignName).replace(
        /[^a-zA-Z0-9]/g,
        "_"
      );

      // Create a reference to the file location in Firebase Storage
      const storageRef = ref(
        storage,
        `certificates/${folderName}/${attendeeId}.png`
      );

      // Convert data URL to blob and upload
      const imageData = dataUrl.split(",")[1];
      await uploadString(storageRef, imageData, "base64", {
        contentType: "image/png",
      });

      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Set the downloadUrl state
      setdownloadUrl(downloadURL);

      return downloadURL;
    } catch (error) {
      console.error("Error uploading certificate to storage:", error);
      return null;
    }
  };

  // Function to convert oklch colors to hex/rgba before passing to html2canvas
  const convertOklchColors = (element) => {
    // Process element's content
    const processElement = (el) => {
      // Replace any oklch colors in style attributes with hex
      if (el.getAttribute && el.getAttribute("style")) {
        const style = el.getAttribute("style");
        if (style.includes("oklch")) {
          // Replace oklch with a safe fallback (using hex or rgba)
          el.setAttribute("style", style.replace(/oklch$$[^)]+$$/g, "#333333"));
        }
      }

      // Process inline styles
      if (el.style) {
        const style = el.style;
        const props = [
          "color",
          "backgroundColor",
          "borderColor",
          "boxShadow",
          "textShadow",
        ];

        props.forEach((prop) => {
          if (
            style[prop] &&
            typeof style[prop] === "string" &&
            style[prop].includes("oklch")
          ) {
            style[prop] = "#333333"; // Safe fallback color
          }
        });
      }

      // Process children recursively
      if (el.childNodes && el.childNodes.length) {
        Array.from(el.childNodes).forEach((child) => {
          if (child.nodeType === 1) {
            // Element node
            processElement(child);
          }
        });
      }
    };

    processElement(element);
    return element;
  };

  // Modify the generateCertificateForAttendeeFn function
  const generateCertificateForAttendeeFn = async (attendee) => {
    if (!certificateRef.current || !attendee) return null;
    setShowRulers(false);
    setShowGrid(false);
    setGridColor("rgba(0, 0, 0, 0)");
    setRulerColor("rgba(0, 0, 0, 0)");
    // Create a temporary clone of elements with attendee data
    setoriginalelements([...elements]);
    const attendeeElements = elements.map((el) => {
      if (el.type === "text") {
        return {
          ...el,
          content: parseAttendeePlaceholders(el.content, attendee),
        };
      }
      return el;
    });

    // Update elements with attendee data
    setElements(attendeeElements);

    // Wait longer for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Store the original background image
    const originalBackgroundImage = backgroundImage;

    // If we have a background image and blur is enabled, create a pre-blurred version
    let blurredBackground = null;
    if (backgroundImage && backgroundProps.blur > 0) {
      try {
        blurredBackground = await applyBlurToImageDataUrl(
          backgroundImage,
          backgroundProps.blur
        );
      } catch (blurError) {
        console.error("Error pre-blurring background:", blurError);
      }
    }

    try {
      // Create a wrapper div with the same border-radius to clip the content
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.left = "-9999px";
      wrapper.style.overflow = "hidden";
      wrapper.style.borderRadius = borderStyle.radius
        ? `${borderStyle.radius}px`
        : "0";
      wrapper.style.width = `${certificateSize.width}px`;
      wrapper.style.height = `${certificateSize.height}px`;

      // Clone the certificate
      const certificateClone = certificateRef.current.cloneNode(true);
      certificateClone.style.transform = "none";

      // If we're using a pre-blurred background, update the clone's background
      if (blurredBackground) {
        const blurredBgElement = certificateClone.querySelector(
          '[data-background-blur="true"]'
        );
        if (blurredBgElement) {
          blurredBgElement.style.filter = "none";
          blurredBgElement.style.backgroundImage = `url(${blurredBackground})`;
          blurredBgElement.style.transform = "scale(1.1)"; // Slight scale to prevent blur edges
          blurredBgElement.style.opacity = backgroundProps.opacity;
        }
      } else if (backgroundImage && backgroundProps.blur > 0) {
        // If pre-blurring failed but we still need blur, ensure it's strongly applied
        const blurredBgElement = certificateClone.querySelector(
          '[data-background-blur="true"]'
        );
        if (blurredBgElement) {
          blurredBgElement.style.setProperty(
            "filter",
            `blur(${backgroundProps.blur}px)`,
            "important"
          );
          blurredBgElement.style.setProperty(
            "transform",
            "scale(1.1)",
            "important"
          );
          blurredBgElement.style.setProperty(
            "opacity",
            backgroundProps.opacity,
            "important"
          );
        }
      }

      // Append the clone to the wrapper
      wrapper.appendChild(certificateClone);
      document.body.appendChild(wrapper);

      // Capture the certificate as PNG with more basic settings
      const canvas = await html2canvas(certificateClone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: backgroundColor,
        onclone: (clonedDoc) => {
          // Process oklch colors
          convertOklchColors(clonedDoc.documentElement);

          const certificateElement = clonedDoc.querySelector(
            '[data-certificate="true"]'
          );

          if (certificateElement) {
            if (borderStyle.radius) {
              certificateElement.style.borderRadius = `${borderStyle.radius}px`;
              certificateElement.style.overflow = "hidden";
            }

            // Apply blur in the cloned document
            if (blurredBackground) {
              // If we have a pre-blurred background, use it
              const blurredBgElement = certificateElement.querySelector(
                '[data-background-blur="true"]'
              );
              if (blurredBgElement) {
                blurredBgElement.style.filter = "none";
                blurredBgElement.style.backgroundImage = `url(${blurredBackground})`;
                blurredBgElement.style.transform = "scale(1.1)";
                blurredBgElement.style.opacity = backgroundProps.opacity;
              }
            } else if (backgroundImage && backgroundProps.blur > 0) {
              // Otherwise force the blur with !important
              const blurredBgElement = certificateElement.querySelector(
                '[data-background-blur="true"]'
              );
              if (blurredBgElement) {
                blurredBgElement.style.setProperty(
                  "filter",
                  `blur(${backgroundProps.blur}px)`,
                  "important"
                );
                blurredBgElement.style.setProperty(
                  "transform",
                  "scale(1.1)",
                  "important"
                );
                blurredBgElement.style.setProperty(
                  "opacity",
                  backgroundProps.opacity,
                  "important"
                );
              }
            }
          }
        },
      });

      // Remove the wrapper after capture
      document.body.removeChild(wrapper);

      // Create a new canvas with the same dimensions
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height;
      const ctx = finalCanvas.getContext("2d");

      // Draw the original canvas onto the new one with rounded corners
      ctx.beginPath();
      const radius = borderStyle.radius ? borderStyle.radius * 2 : 0; // Scale radius for the 2x scale
      const width = canvas.width;
      const height = canvas.height;

      // Draw rounded rectangle path
      ctx.moveTo(radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();

      // Clip to the rounded rectangle
      ctx.clip();

      // Draw the original canvas content
      ctx.drawImage(canvas, 0, 0);

      const dataUrl = finalCanvas.toDataURL("image/png");

      // Upload to Firebase Storage
      const certificateUrl = await uploadCertificateToStorage(
        dataUrl,
        attendee.userId || attendee.id
      );

      if (!dataUrl || dataUrl === "data:,") {
        console.error("PNG generation failed - empty data URL");
        // Try a fallback approach with simpler settings
        try {
          const fallbackCanvas = await html2canvas(certificateClone, {
            scale: 1, // Lower scale
            useCORS: true,
            allowTaint: true,
            backgroundColor: backgroundColor,
            logging: true, // Enable logging
          });

          const fallbackDataUrl = fallbackCanvas.toDataURL("image/png");

          if (fallbackDataUrl && fallbackDataUrl !== "data:,") {
            console.log("Fallback PNG generation succeeded");
            // Upload fallback image
            const certificateUrl = await uploadCertificateToStorage(
              fallbackDataUrl,
              attendee.userId || attendee.id
            );

            // Restore original elements
            setElements(originalelements);

            return {
              dataUrl: fallbackDataUrl,
              certificateUrl,
            };
          }
        } catch (fallbackError) {
          console.error("Fallback approach also failed:", fallbackError);
        }
      }

      return {
        dataUrl,
        certificateUrl,
      };
    } catch (error) {
      console.error("Error generating certificate:", error);
      // Restore original elements
      setElements(originalelements);
      setGridColor("rgba(0, 0, 0, 0.1)");
      setRulerColor("rgba(0, 0, 0, 0.3)");
      return null;
    }
  };

  const sendCertificatesToMultipleAttendees = async () => {
    if (
      !certificateRef.current ||
      !selectedEvent ||
      selectedAttendees.length === 0
    )
      return;

    try {
      setSendingMultiple(true);
      setSendProgress({ current: 0, total: selectedAttendees.length });

      const originalElements = [...elements];

      // Hide rulers and grid
      await new Promise((resolve) => {
        setShowRulers(false);
        setShowGrid(false);
        setGridColor("rgba(0, 0, 0, 0)");
        setRulerColor("rgba(0, 0, 0, 0)");
        resolve();
      });

      // Get selected attendees data
      const attendeesToProcess = eventAttendees.filter((a) =>
        selectedAttendees.includes(a.id)
      );

      // Process each attendee with more careful state management
      for (let i = 0; i < attendeesToProcess.length; i++) {
        const attendee = attendeesToProcess[i];
        setSendProgress({ current: i + 1, total: attendeesToProcess.length });

        try {
          // More thorough reset between attendees
          if (i > 0) {
            // Ensure complete UI reset
            setElements([...originalElements]); // Reset to original elements
            await new Promise((resolve) => setTimeout(resolve, 250)); // Longer wait
          }

          // Generate and upload certificate
          const certificate = await generateCertificateForAttendeeFn(attendee);

          if (certificate && certificate.certificateUrl) {
            // Prepare email data
            const emailData = {
              email: attendee.email,
              subject: `Certificate: ${selectedEvent.title}`,
              message:
                emailMessage ||
                `Here is your certificate for ${selectedEvent.title}.`,
              certificateUrl: certificate.certificateUrl,
              certificateName: `${selectedEvent.title}_Certificate.png`,
              eventDetails: selectedEvent,
              name: attendee.userName || "Attendee",
              attendeeName: attendee.userName || "Attendee",
            };

            // Send email with certificate link
            await sendEmail({
              template: EmailTemplates.CERTIFICATE_EMAIL,
              data: emailData,
            });

            // Wait a bit after sending to ensure everything is complete
            await new Promise((resolve) => setTimeout(resolve, 100));
          } else {
            console.error(
              `Failed to generate certificate for ${
                attendee.userName || "Attendee"
              }`
            );
          }
        } catch (error) {
          console.error(
            `Error processing attendee ${attendee.userName}:`,
            error
          );
        }
      }

      setElements([...originalElements]);
      setGridColor("rgba(0, 0, 0, 0.)");
      setRulerColor("rgba(0, 0, 0, 0)");

      setEmailStatus("sent");
      setTimeout(() => {
        setEmailStatus("idle");
        setSendingMultiple(false);
        setSendProgress({ current: 0, total: 0 });
      }, 3000);
    } catch (error) {
      console.error("Error sending multiple certificates:", error);
      setEmailStatus("error");
      setTimeout(() => {
        setEmailStatus("idle");
        setSendingMultiple(false);
        setSendProgress({ current: 0, total: 0 });
      }, 3000);
    }
  };

  // Declare saveToHistory function
  const saveToHistory = () => {
    const currentState = {
      elements: JSON.parse(JSON.stringify(elements)),
      backgroundImage,
      backgroundColor,
      borderStyle: JSON.parse(JSON.stringify(borderStyle)),
      certificateSize: JSON.parse(JSON.stringify(certificateSize)),
      backgroundProps: JSON.parse(JSON.stringify(backgroundProps)),
    };

    const newHistory = [...history.slice(0, historyIndex + 1), currentState];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Declare loadDesignsFromFirestore function
  const loadDesignsFromFirestore = async () => {
    if (!currentUser?.email) return;

    try {
      const designsRef = collection(db, "certificateDesigns");
      const q = query(
        designsRef,
        where("userEmail", "==", currentUser.email),
        orderBy("date", "desc")
      );
      const querySnapshot = await getDocs(q);

      const designs = [];
      querySnapshot.forEach((doc) => {
        designs.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setSavedDesigns(designs);
    } catch (error) {
      console.error("Error loading designs from Firestore:", error);
    }
  };

  // Declare handleUndo function
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const previousState = history[historyIndex - 1];
      setElements(previousState.elements);
      setBackgroundImage(previousState.backgroundImage);
      setBackgroundColor(previousState.backgroundColor);
      setBorderStyle(previousState.borderStyle);
      setCertificateSize(previousState.certificateSize);
      setBackgroundProps(previousState.backgroundProps);
    }
  };

  // Declare handleRedo function
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const nextState = history[historyIndex + 1];
      setElements(nextState.elements);
      setBackgroundImage(nextState.backgroundImage);
      setBackgroundColor(nextState.backgroundColor);
      setBorderStyle(nextState.borderStyle);
      setCertificateSize(nextState.certificateSize);
      setBackgroundProps(nextState.backgroundProps);
    }
  };

  // Declare saveCurrentDesign function
  const saveCurrentDesign = async () => {
    if (!currentUser?.email) return;

    setSaveStatus("saving");

    try {
      // First, upload backgroundImage to Firebase Storage if it exists and is large
      let backgroundImageURL = backgroundImage;

      if (backgroundImage && backgroundImage.length > 500000) {
        // If it's a large data URL
        // Convert data URL to blob
        const response = await fetch(backgroundImage);
        const blob = await response.blob();

        // Create a reference to Firebase Storage
        const storageRef = ref(
          storage,
          `certificate-backgrounds/${currentUser.email}/${currentDesignName}`
        );

        // Upload the image
        const uploadResult = await uploadBytes(storageRef, blob);

        // Get the download URL
        backgroundImageURL = await getDownloadURL(uploadResult.ref);
      }

      const designData = {
        name: currentDesignName,
        elements: JSON.parse(JSON.stringify(elements)),
        backgroundImage: backgroundImageURL, // Store URL instead of full image data
        backgroundColor,
        borderStyle: JSON.parse(JSON.stringify(borderStyle)),
        certificateSize: JSON.parse(JSON.stringify(certificateSize)),
        backgroundProps: JSON.parse(JSON.stringify(backgroundProps)),
        date: new Date(),
        userEmail: currentUser.email,
      };

      // Rest of your code remains the same...
      const designsRef = collection(db, "certificateDesigns");
      const q = query(
        designsRef,
        where("userEmail", "==", currentUser.email),
        where("name", "==", currentDesignName)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingDesign = querySnapshot.docs[0];
        const designRef = doc(db, "certificateDesigns", existingDesign.id);
        await updateDoc(designRef, designData);
      } else {
        await addDoc(designsRef, designData);
      }

      setSaveStatus("saved");
      loadDesignsFromFirestore();

      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    } catch (error) {
      console.error("Error saving design to Firestore:", error);
      setSaveStatus("error");

      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    }
  };

  // Add this function to your component
  const applyBlurToImageDataUrl = async (imageUrl, blurAmount) => {
    return new Promise((resolve, reject) => {
      if (!imageUrl || blurAmount <= 0) {
        resolve(imageUrl);
        return;
      }

      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        try {
          // Create a temporary canvas to apply the blur
          const tempCanvas = document.createElement("canvas");
          const tempCtx = tempCanvas.getContext("2d");

          // Set canvas dimensions to match image
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;

          // Draw the original image
          tempCtx.drawImage(img, 0, 0);

          // Apply CSS blur filter to the canvas
          tempCtx.filter = `blur(${blurAmount}px)`;

          // Draw the image again with the filter applied
          tempCtx.drawImage(img, 0, 0);

          // Convert back to data URL
          resolve(tempCanvas.toDataURL("image/png"));
        } catch (error) {
          console.error("Error applying blur to image:", error);
          resolve(imageUrl); // Return original if there's an error
        }
      };

      img.onerror = () => {
        console.error("Failed to load image for blur processing");
        resolve(imageUrl); // Return original if there's an error
      };

      img.src = imageUrl;
    });
  };

  // In the exportAsImage function, modify how blur is applied:
  const exportAsImage = async () => {
    if (!certificateRef.current) return;

    try {
      // Hide rulers and grid
      const originalRulerState = showRulers;
      const originalGridState = showGrid;
      setShowRulers(false);
      setShowGrid(false);

      // Wait for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Store the original background image
      const originalBackgroundImage = backgroundImage;

      // If we have a background image and blur is enabled, create a pre-blurred version
      let blurredBackground = null;
      if (backgroundImage && backgroundProps.blur > 0) {
        blurredBackground = await applyBlurToImageDataUrl(
          backgroundImage,
          backgroundProps.blur
        );

        // Temporarily replace the background image with the pre-blurred version
        const blurredBgElement = certificateRef.current.querySelector(
          '[data-background-blur="true"]'
        );
        if (blurredBgElement) {
          const originalStyle = blurredBgElement.getAttribute("style");
          blurredBgElement.style.filter = "none"; // Remove filter since image is pre-blurred
          blurredBgElement.style.backgroundImage = `url(${blurredBackground})`;

          // Wait for the change to take effect
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Create wrapper and clone as before
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.left = "-9999px";
      wrapper.style.overflow = "hidden";
      wrapper.style.borderRadius = borderStyle.radius
        ? `${borderStyle.radius}px`
        : "0";
      wrapper.style.width = `${certificateSize.width}px`;
      wrapper.style.height = `${certificateSize.height}px`;

      const certificateClone = certificateRef.current.cloneNode(true);
      certificateClone.style.transform = "none";

      // If we're using a pre-blurred background, update the clone's background as well
      if (blurredBackground) {
        const blurredBgElement = certificateClone.querySelector(
          '[data-background-blur="true"]'
        );
        if (blurredBgElement) {
          blurredBgElement.style.filter = "none";
          blurredBgElement.style.backgroundImage = `url(${blurredBackground})`;
          blurredBgElement.style.transform = "scale(1.05)"; // Slight scale to prevent blur edges
          blurredBgElement.style.opacity = backgroundProps.opacity;
        }
      }

      wrapper.appendChild(certificateClone);
      document.body.appendChild(wrapper);

      // Capture the certificate
      const canvas = await html2canvas(certificateClone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: backgroundColor,
        onclone: (clonedDoc) => {
          // Process oklch colors
          convertOklchColors(clonedDoc.documentElement);

          const certificateElement = clonedDoc.querySelector(
            '[data-certificate="true"]'
          );
          if (certificateElement) {
            if (borderStyle.radius) {
              certificateElement.style.borderRadius = `${borderStyle.radius}px`;
              certificateElement.style.overflow = "hidden";
            }

            // If using pre-blurred background, update the clone's background as well
            if (blurredBackground) {
              const blurredBgElement = certificateElement.querySelector(
                '[data-background-blur="true"]'
              );
              if (blurredBgElement) {
                blurredBgElement.style.filter = "none";
                blurredBgElement.style.backgroundImage = `url(${blurredBackground})`;
                blurredBgElement.style.transform = "scale(1.05)";
                blurredBgElement.style.opacity = backgroundProps.opacity;
              }
            }
          }
        },
      });

      console.log(borderStyle.radius);

      // Remove the wrapper after capture
      document.body.removeChild(wrapper);

      // Create a new canvas with the same dimensions
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height;
      const ctx = finalCanvas.getContext("2d");

      // Draw the original canvas onto the new one with rounded corners
      ctx.beginPath();
      const radius = borderStyle.radius ? borderStyle.radius * 2 : 0; // Scale radius for the 2x scale
      const width = canvas.width;
      const height = canvas.height;

      // Draw rounded rectangle path
      ctx.moveTo(radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();

      // Clip to the rounded rectangle
      ctx.clip();

      // Draw the original canvas content
      ctx.drawImage(canvas, 0, 0);

      const dataURL = finalCanvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `${currentDesignName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Restore original settings
      setShowRulers(originalRulerState);
      setShowGrid(originalGridState);
    } catch (error) {
      console.error("Error exporting as image:", error);
    }
  };

  // Update the exportAsPDF function to use the same approach
  const exportAsPDFOriginal = async () => {
    if (!certificateRef.current) return;

    try {
      // Hide rulers and grid
      const originalRulerState = showRulers;
      const originalGridState = showGrid;
      setShowRulers(false);
      setShowGrid(false);

      // Wait for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create a wrapper div with the same border-radius to clip the content
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.left = "-9999px";
      wrapper.style.overflow = "hidden"; // This is crucial for clipping the content
      wrapper.style.borderRadius = borderStyle.radius
        ? `${borderStyle.radius}px`
        : "0";
      wrapper.style.width = `${certificateSize.width}px`;
      wrapper.style.height = `${certificateSize.height}px`;

      // Clone the certificate
      const certificateClone = certificateRef.current.cloneNode(true);
      certificateClone.style.transform = "none"; // Remove any transform that might affect rendering

      // Ensure the background blur is properly applied to the clone
      if (backgroundImage) {
        const blurredBgElement = certificateClone.querySelector(
          '[data-background-blur="true"]'
        );
        if (blurredBgElement) {
          // Make sure the blur is explicitly set
          blurredBgElement.style.filter = `blur(${backgroundProps.blur}px)`;
          blurredBgElement.style.transform = "scale(1.1)"; // Prevent blur edges
          blurredBgElement.style.opacity = backgroundProps.opacity;
        }
      }

      // Append the clone to the wrapper
      wrapper.appendChild(certificateClone);
      document.body.appendChild(wrapper);

      // Make sure all styles are computed and applied before capture
      const canvas = await html2canvas(certificateClone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: backgroundColor,
        onclone: (clonedDoc) => {
          // Process oklch colors
          convertOklchColors(clonedDoc.documentElement);

          // Ensure border radius is applied to the certificate
          const certificateElement = clonedDoc.querySelector(
            '[data-certificate="true"]'
          );

          if (certificateElement) {
            if (borderStyle.radius) {
              certificateElement.style.borderRadius = `${borderStyle.radius}px`;
              certificateElement.style.overflow = "hidden";
            }

            // Ensure background blur is applied
            if (backgroundImage) {
              const blurredBgElement = certificateElement.querySelector(
                '[data-background-blur="true"]'
              );
              if (blurredBgElement) {
                blurredBgElement.style.filter = `blur(${backgroundProps.blur}px)`;
                blurredBgElement.style.transform = "scale(1.1)"; // Prevent blur edges
                blurredBgElement.style.opacity = backgroundProps.opacity;
              }
            }
          }
        },
      });

      // Remove the wrapper after capture
      document.body.removeChild(wrapper);

      // Create a new canvas with the same dimensions
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height;
      const ctx = finalCanvas.getContext("2d");

      // Draw the original canvas onto the new one with rounded corners
      ctx.beginPath();
      const radius = borderStyle.radius ? borderStyle.radius * 2 : 0; // Scale radius for the 2x scale
      const width = canvas.width;
      const height = canvas.height;

      // Draw rounded rectangle path
      ctx.moveTo(radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();

      // Clip to the rounded rectangle
      ctx.clip();

      // Draw the original canvas content
      ctx.drawImage(canvas, 0, 0);

      const imgData = finalCanvas.toDataURL("image/png");

      // A4 size page in jsPDF
      const pdf = new jsPDF({
        orientation: certificateSize.orientation,
        unit: "px",
        format: [certificateSize.width, certificateSize.height],
      });

      pdf.addImage(
        imgData,
        "PNG",
        0,
        0,
        certificateSize.width,
        certificateSize.height
      );
      pdf.save(`${currentDesignName}.pdf`);

      // Restore original settings
      setShowRulers(originalRulerState);
      setShowGrid(originalGridState);
    } catch (error) {
      console.error("Error exporting as PDF:", error);
    }
  };

  const sendCertificateEmailFn = async () => {
    if (!certificateRef.current || !recipientEmail) return;

    try {
      setEmailStatus("sending");

      // Hide rulers and grid
      await new Promise((resolve) => {
        setShowRulers(false);
        setShowGrid(false);
        setGridColor("rgba(0, 0, 0, 0)");
        setRulerColor("rgba(0, 0, 0, 0)");
        resolve();
      });

      // If we have a background image and blur is enabled, create a pre-blurred version
      let blurredBackground = null;
      if (backgroundImage && backgroundProps.blur > 0) {
        try {
          blurredBackground = await applyBlurToImageDataUrl(
            backgroundImage,
            backgroundProps.blur
          );
        } catch (blurError) {
          console.error("Error pre-blurring background:", blurError);
        }
      }

      try {
        // Create a wrapper div with the same border-radius to clip the content
        const wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = "-9999px";
        wrapper.style.overflow = "hidden";
        wrapper.style.borderRadius = borderStyle.radius
          ? `${borderStyle.radius}px`
          : "0";
        wrapper.style.width = `${certificateSize.width}px`;
        wrapper.style.height = `${certificateSize.height}px`;

        // Clone the certificate
        const certificateClone = certificateRef.current.cloneNode(true);
        certificateClone.style.transform = "none";

        // If we're using a pre-blurred background, update the clone's background
        if (blurredBackground) {
          const blurredBgElement = certificateClone.querySelector(
            '[data-background-blur="true"]'
          );
          if (blurredBgElement) {
            blurredBgElement.style.filter = "none";
            blurredBgElement.style.backgroundImage = `url(${blurredBackground})`;
            blurredBgElement.style.transform = "scale(1.1)"; // Slight scale to prevent blur edges
            blurredBgElement.style.opacity = backgroundProps.opacity;
          }
        } else if (backgroundImage && backgroundProps.blur > 0) {
          // If pre-blurring failed but we still need blur, ensure it's strongly applied
          const blurredBgElement = certificateClone.querySelector(
            '[data-background-blur="true"]'
          );
          if (blurredBgElement) {
            blurredBgElement.style.setProperty(
              "filter",
              `blur(${backgroundProps.blur}px)`,
              "important"
            );
            blurredBgElement.style.setProperty(
              "transform",
              "scale(1.1)",
              "important"
            );
            blurredBgElement.style.setProperty(
              "opacity",
              backgroundProps.opacity,
              "important"
            );
          }
        }

        // Append the clone to the wrapper
        wrapper.appendChild(certificateClone);
        document.body.appendChild(wrapper);

        // Capture the certificate as PNG
        const canvas = await html2canvas(certificateClone, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: backgroundColor,
          onclone: (clonedDoc) => {
            // Process oklch colors
            convertOklchColors(clonedDoc.documentElement);

            const certificateElement = clonedDoc.querySelector(
              '[data-certificate="true"]'
            );

            if (certificateElement) {
              if (borderStyle.radius) {
                certificateElement.style.borderRadius = `${borderStyle.radius}px`;
                certificateElement.style.overflow = "hidden";
              }

              // Apply blur in the cloned document
              if (blurredBackground) {
                // If we have a pre-blurred background, use it
                const blurredBgElement = certificateElement.querySelector(
                  '[data-background-blur="true"]'
                );
                if (blurredBgElement) {
                  blurredBgElement.style.filter = "none";
                  blurredBgElement.style.backgroundImage = `url(${blurredBackground})`;
                  blurredBgElement.style.transform = "scale(1.1)";
                  blurredBgElement.style.opacity = backgroundProps.opacity;
                }
              } else if (backgroundImage && backgroundProps.blur > 0) {
                // Otherwise force the blur with !important
                const blurredBgElement = certificateElement.querySelector(
                  '[data-background-blur="true"]'
                );
                if (blurredBgElement) {
                  blurredBgElement.style.setProperty(
                    "filter",
                    `blur(${backgroundProps.blur}px)`,
                    "important"
                  );
                  blurredBgElement.style.setProperty(
                    "transform",
                    "scale(1.1)",
                    "important"
                  );
                  blurredBgElement.style.setProperty(
                    "opacity",
                    backgroundProps.opacity,
                    "important"
                  );
                }
              }
            }
          },
        });

        // Remove the wrapper after capture
        document.body.removeChild(wrapper);

        // Create a new canvas with the same dimensions
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = canvas.width;
        finalCanvas.height = canvas.height;
        const ctx = finalCanvas.getContext("2d");

        // Draw the original canvas onto the new one with rounded corners
        ctx.beginPath();
        const radius = borderStyle.radius ? borderStyle.radius * 2 : 0; // Scale radius for the 2x scale
        const width = canvas.width;
        const height = canvas.height;

        // Draw rounded rectangle path
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius);
        ctx.quadraticCurveTo(width, height, width - radius, height);
        ctx.lineTo(radius, height);
        ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();

        // Clip to the rounded rectangle
        ctx.clip();

        // Draw the original canvas content
        ctx.drawImage(canvas, 0, 0);

        const dataUrl = finalCanvas.toDataURL("image/png");

        // Check if generation failed and try fallback approach
        if (!dataUrl || dataUrl === "data:,") {
          console.error("PNG generation failed - empty data URL");
          throw new Error("Certificate image generation failed");
        }

        // Upload to Firebase Storage
        const certificateUrl = await uploadCertificateToStorage(
          dataUrl,
          "single-recipient"
        );

        if (!certificateUrl) {
          throw new Error("Failed to generate certificate URL");
        }

        // Prepare email data
        const emailData = {
          email: recipientEmail,
          subject: `Certificate: ${currentDesignName}`,
          message:
            emailMessage ||
            `Here is your certificate for ${
              selectedEvent?.title || "the event"
            }.`,
          certificateUrl: certificateUrl, // URL for download link
          certificateImageUrl: certificateUrl, // URL for embedded image
          certificateName: `${currentDesignName}.png`,
          eventDetails: selectedEvent || {
            title: currentDesignName,
            date: new Date().toLocaleDateString(),
          },
          name:
            elements.find((el) => el.id === "recipient-name")?.content ||
            "Recipient",
        };

        // Send email with certificate link
        await sendEmail({
          template: EmailTemplates.CERTIFICATE_EMAIL,
          data: emailData,
          onProgress: (progress) => {
            console.log("Email sending progress:", progress);
          },
          onError: (error) => {
            console.error("Email sending error:", error);
            setEmailStatus("error");
          },
        });

        setEmailStatus("sent");
        setGridColor("rgba(0, 0, 0, 0.1)");
        setRulerColor("rgba(0, 0, 0, 0.3)");

        setTimeout(() => {
          setEmailStatus("idle");
        }, 3000);
      } catch (error) {
        console.error("Error capturing certificate:", error);
        setEmailStatus("error");
        setTimeout(() => {
          setEmailStatus("idle");
        }, 3000);
      } finally {
      }
    } catch (error) {
      console.error("Error sending certificate email:", error);
      setEmailStatus("error");
      setTimeout(() => {
        setEmailStatus("idle");
      }, 3000);
    }
  };

  const exportAsPDF = async () => {
    if (!certificateRef.current) return;

    try {
      // Hide rulers and grid
      const originalRulerState = showRulers;
      const originalGridState = showGrid;
      setShowRulers(false);
      setShowGrid(false);

      // Wait for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        onclone: (clonedDoc) => {
          convertOklchColors(clonedDoc.documentElement);
        },
      });
      const imgData = canvas.toDataURL("image/png");

      // A4 size page in jsPDF
      const pdf = new jsPDF({
        orientation: certificateSize.orientation,
        unit: "px",
        format: [certificateSize.width, certificateSize.height],
      });

      pdf.addImage(
        imgData,
        "PNG",
        0,
        0,
        certificateSize.width,
        certificateSize.height
      );
      pdf.save(`${currentDesignName}.pdf`);

      // Restore original settings
      setShowRulers(originalRulerState);
      setShowGrid(originalGridState);
    } catch (error) {
      console.error("Error exporting as PDF:", error);
    }
  };

  // Fix the handleMouseMove function to prevent elements from snapping back
  const handleMouseMove = (e) => {
    if (!selectedElement) return;

    e.preventDefault();
    if (isDrawing) return;

    if (elements.find((el) => el.id === selectedElement)?.isDragging) {
      const rect = certificateRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate position as percentage of certificate dimensions
      const newX = (x / rect.width) * 100;
      const newY = (y / rect.height) * 100;

      // Ensure the element stays within bounds
      const boundedX = Math.min(100, Math.max(0, newX));
      const boundedY = Math.min(100, Math.max(0, newY));

      updateElement(selectedElement, {
        x: boundedX,
        y: boundedY,
      });
    }
  };

  // Add this function to handle mouse movement over the certificate
  const handleCertificateMouseMove = (e) => {
    if (showRulers) {
      const rect = certificateRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePosition({ x, y });
    }

    // Keep the existing mouse move handler functionality
    handleMouseMove(e);
  };

  // Update the handleMouseDown function to improve dragging
  const handleMouseDown = (e, elementId) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedElement(elementId);
    updateElement(elementId, { isDragging: true });
  };

  const handleMouseUp = () => {
    if (!selectedElement) return;

    updateElement(selectedElement, { isDragging: false });
    saveToHistory();
  };

  const handleCertificateClick = (e) => {
    setSelectedElement(null);
  };

  const updateElement = (id, newProps) => {
    setElements((prevElements) =>
      prevElements.map((element) =>
        element.id === id ? { ...element, ...newProps } : element
      )
    );
    saveToHistory();
  };

  const addNewElement = (type) => {
    const newElementId = `element-${Date.now()}`;
    let newElement;

    switch (type) {
      case "text":
        newElement = {
          id: newElementId,
          type: "text",
          content: "New Text",
          x: 50,
          y: 50,
          fontSize: 24,
          fontFamily: "sans-serif",
          color: "#000000",
          fontWeight: "normal",
          textAlign: "center",
          width: 250, // Add default width
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 1,
        };
        break;
      case "image":
        newElement = {
          id: newElementId,
          type: "image",
          content: "/placeholder.svg",
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 1,
        };
        break;
      case "shape":
        newElement = {
          id: newElementId,
          type: "shape",
          shapeType: "rectangle",
          color: "#3498db",
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 1,
        };
        break;
      case "signature":
        newElement = {
          id: newElementId,
          type: "signature",
          content: signatureData,
          x: 50,
          y: 50,
          width: 100,
          height: 50,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 1,
        };
        break;
      default:
        return;
    }

    setElements((prevElements) => [...prevElements, newElement]);
    setSelectedElement(newElementId);
    saveToHistory();
  };

  const removeElement = (id) => {
    setElements((prevElements) =>
      prevElements.filter((element) => element.id !== id)
    );
    setSelectedElement(null);
    saveToHistory();
  };

  const duplicateElement = (id) => {
    const elementToDuplicate = elements.find((element) => element.id === id);
    if (!elementToDuplicate) return;

    const newElementId = `element-${Date.now()}`;
    const newElement = { ...elementToDuplicate, id: newElementId };

    setElements((prevElements) => [...prevElements, newElement]);
    setSelectedElement(newElementId);
    saveToHistory();
  };

  const toggleElementVisibility = (id) => {
    setElements((prevElements) =>
      prevElements.map((element) =>
        element.id === id
          ? { ...element, isVisible: !element.isVisible }
          : element
      )
    );
    saveToHistory();
  };

  const moveElementLayer = (id, direction) => {
    setElements((prevElements) => {
      const elementIndex = prevElements.findIndex(
        (element) => element.id === id
      );
      if (elementIndex === -1) return prevElements;

      const newElements = [...prevElements];
      const element = newElements[elementIndex];
      const newZIndex = element.zIndex || 0;

      if (direction === "up") {
        element.zIndex = newZIndex + 1;
      } else if (direction === "down") {
        element.zIndex = Math.max(0, newZIndex - 1);
      }

      newElements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      return newElements;
    });
    saveToHistory();
  };

  const updateCertificateSize = (newSize) => {
    setCertificateSize({ ...certificateSize, ...newSize });
    saveToHistory();
  };

  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage(reader.result);

        // Ensure background blur is applied if it was previously set
        if (backgroundProps.blur > 0) {
          // Force a re-render to ensure blur is applied
          setBackgroundProps({
            ...backgroundProps,
            blur: backgroundProps.blur,
          });
        }

        saveToHistory();
      };
      reader.readAsDataURL(file);
    }
  };

  const applyTemplate = (template) => {
    setBackgroundColor(template.background);
    setBorderStyle({
      color: template.border,
      width: 12,
      style: "solid",
      radius: 8,
    });
    setElements(template.elements);
    saveToHistory();
  };

  // Signature Pad functions
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = signaturePadRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    // Calculate position relative to canvas
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);

    // Prevent scrolling while drawing
    e.preventDefault();
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = signaturePadRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    // Calculate position relative to canvas
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Prevent scrolling while drawing
    e.preventDefault();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const canvas = signaturePadRef.current;
      const ctx = canvas.getContext("2d");
      ctx.closePath();
      setIsDrawing(false);

      // Update signature data
      setSignatureData(canvas.toDataURL("image/png"));
    }
  };

  const clearSignature = () => {
    const canvas = signaturePadRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const addSignature = () => {
    if (!signaturePadRef.current) return;

    const canvas = signaturePadRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureData(dataUrl);
    addNewElement("signature");
  };

  // Handle touch events for mobile devices
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    startDrawing(mouseEvent);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    draw(mouseEvent);
  };

  const handleTouchEnd = () => {
    stopDrawing();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSignatureData(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateRulerTicks = (length, horizontal) => {
    const tickCount = Math.floor(length / gridSize);
    const ticks = [];

    for (let i = 0; i <= tickCount; i++) {
      const position = i * gridSize;
      const isMajorTick = i % 2 === 0;

      ticks.push(
        <div
          key={i}
          className={`absolute ${isMajorTick ? "bg-gray-400" : "bg-gray-300"}`}
          style={{
            left: horizontal ? `${position}px` : isMajorTick ? "0" : "15px",
            top: horizontal ? (isMajorTick ? "0" : "15px") : `${position}px`,
            width: horizontal ? "1px" : isMajorTick ? "100%" : "50%",
            height: horizontal ? (isMajorTick ? "100%" : "50%") : "1px",
          }}
        ></div>
      );

      // Add tick labels (numbers) every 100px or at major ticks
      if (isMajorTick) {
        ticks.push(
          <div
            key={`label-${i}`}
            className="absolute text-[9px] text-gray-600 font-medium"
            style={{
              left: horizontal ? `${position + 2}px` : "2px",
              top: horizontal ? "2px" : `${position - 12}px`,
              pointerEvents: "none",
              transform: horizontal ? "none" : "rotate(-90deg)",
              transformOrigin: horizontal ? "none" : "left bottom",
            }}
          >
            {position}
          </div>
        );
      }
    }
    return ticks;
  };

  const loadDesign = (design) => {
    setCurrentDesignName(design.name);
    setElements(design.elements);
    setBackgroundImage(design.backgroundImage);
    setBackgroundColor(design.backgroundColor);
    setBorderStyle(design.borderStyle);
    setCertificateSize(design.certificateSize);

    // Ensure background props are set correctly
    if (design.backgroundProps) {
      setBackgroundProps(design.backgroundProps);
    } else {
      // Default values if not present in saved design
      setBackgroundProps({
        blur: 0,
        opacity: 1,
      });
    }

    saveToHistory();
  };

  const deleteDesignFromFirestore = async (designId, designName) => {
    if (!currentUser?.email || !designId) return;

    if (
      window.confirm(
        `Are you sure you want to delete the design "${designName}"?`
      )
    ) {
      try {
        const designRef = doc(db, "certificateDesigns", designId);
        await deleteDoc(designRef);
        loadDesignsFromFirestore(); // Refresh the list of saved designs
      } catch (error) {
        console.error("Error deleting design from Firestore:", error);
      }
    }
  };

  // Add a new useEffect hook for keyboard navigation after the other useEffect hooks
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedElement) return;

      // Skip if we're editing text directly in the certificate
      if (
        e.target.getAttribute &&
        e.target.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      // Handle Shift+Enter for text elements to add a new line
      if (e.key === "Enter" && e.shiftKey) {
        const element = elements.find((el) => el.id === selectedElement);
        if (element && element.type === "text") {
          e.preventDefault();
          const newContent = element.content + "\n";
          updateElement(selectedElement, {
            content: newContent,
          });
          return;
        }
      }

      // Only handle arrow keys
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        return;

      e.preventDefault();

      const element = elements.find((el) => el.id === selectedElement);
      if (!element) return;

      const step = e.shiftKey ? 0.1 : 1; // Smaller steps with shift key
      let newX = element.x;
      let newY = element.y;

      switch (e.key) {
        case "ArrowUp":
          newY = Math.max(0, element.y - step);
          break;
        case "ArrowDown":
          newY = Math.min(100, element.y + step);
          break;
        case "ArrowLeft":
          newX = Math.max(0, element.x - step);
          break;
        case "ArrowRight":
          newX = Math.min(100, element.x + step);
          break;
      }

      updateElement(selectedElement, { x: newX, y: newY });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedElement, elements]);

  const backtolast = () => {
    navigate(-1);
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto gap-6 p-4">
      <button
        onClick={backtolast}
        className="w-fit inline-flex items-center px-4 py-2 bg-white border border-gray-300 shadow-2xl  text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-2.5"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to List events
      </button>
      {/* Top toolbar */}
      <div className="w-full bg-white border-b pb-2 mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <Undo size={18} />
          </button>
          <button
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
          >
            <Redo size={18} />
          </button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <input
            type="text"
            value={currentDesignName}
            onChange={(e) => setCurrentDesignName(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
            placeholder="Design name"
          />
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button
            className={`p-2 rounded ${
              showRulers ? "bg-blue-100" : "hover:bg-gray-100"
            }`}
            onClick={() => setShowRulers(!showRulers)}
            title="Toggle Rulers"
          >
            <Grid size={18} />
          </button>
          <button
            className={`p-2 rounded ${
              showGrid ? "bg-blue-100" : "hover:bg-gray-100"
            }`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid"
          >
            <Grid size={18} className="rotate-45" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Event Selector Dropdown */}
          <div className="relative">
            <select
              className="px-3 py-1 bg-white border rounded text-sm appearance-none pr-8"
              value={selectedEvent?.id || ""}
              onChange={(e) => handleEventSelect(e.target.value)}
              disabled={isLoadingEvents}
            >
              <option value="">Select an event</option>
              {userEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
              {isLoadingEvents ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Calendar size={14} />
              )}
            </div>
          </div>

          <button
            className={`px-3 py-1 ${
              saveStatus === "error"
                ? "bg-red-100 text-red-700"
                : saveStatus === "saved"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            } rounded text-sm flex items-center gap-1`}
            onClick={saveCurrentDesign}
            disabled={saveStatus === "saving"}
          >
            {saveStatus === "saving" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saveStatus === "saved" ? (
              <Check size={16} />
            ) : saveStatus === "error" ? (
              <X size={16} />
            ) : (
              <Save size={16} />
            )}
            <span>
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                ? "Saved!"
                : saveStatus === "error"
                ? "Error!"
                : "Save"}
            </span>
          </button>
          <div className="dropdown relative">
            <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center gap-1">
              <Download size={16} />
              <span>Export</span>
            </button>
            <div className="dropdown-menu absolute right-0 mt-1 bg-white shadow-lg rounded-md border p-1 hidden group-hover:block">
              <button
                className="w-full px-3 py-1 text-left hover:bg-gray-100 rounded flex items-center gap-2"
                onClick={exportAsImage}
              >
                <FileImage size={16} />
                <span>Export as PNG</span>
              </button>
              <button
                className="w-full px-3 py-1 text-left hover:bg-gray-100 rounded flex items-center gap-2"
                onClick={exportAsPDFOriginal}
              >
                <FilePdf size={16} />
                <span>Export as PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Details Panel (when event is selected) */}
      {selectedEvent && (
        <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
          <h3 className="font-medium text-lg mb-2">
            Selected Event: {selectedEvent.title}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Description:</p>
              <p className="text-sm">{selectedEvent.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date & Time:</p>
              <p className="text-sm">
                {selectedEvent.date} at {selectedEvent.time}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Location:</p>
              <p className="text-sm">{selectedEvent.location}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Capacity:</p>
              <p className="text-sm">
                {selectedEvent.attendees} /{" "}
                {selectedEvent.capacity}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Certificate Preview Area */}
      <div className="flex-1 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Certificate Preview</h2>
        <div className="bg-gray-100 p-4 rounded-lg flex-1 flex items-center justify-center overflow-auto">
          <div className="relative">
            {/* Horizontal Ruler */}
            {showRulers && (
              <div
                className="absolute h-[30px] bg-white border-b border-r left-[30px] right-0 top-0 z-10"
                style={{
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                {generateRulerTicks(certificateSize.width, true)}
              </div>
            )}

            {/* Vertical Ruler */}
            {showRulers && (
              <div
                className="absolute w-[30px] bg-white border-r border-b top-[30px] bottom-0 left-0 z-10"
                style={{
                  boxShadow: "1px 0 3px rgba(0,0,0,0.1)",
                }}
              >
                {generateRulerTicks(certificateSize.height, false)}
              </div>
            )}

            {/* Ruler Corner */}
            {showRulers && (
              <div
                className="absolute w-[30px] h-[30px] bg-white border-r border-b left-0 top-0 z-20"
                style={{
                  boxShadow: "1px 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                <div className="flex items-center justify-center h-full text-[10px] text-gray-500">
                  0,0
                </div>
              </div>
            )}

            <div
              ref={certificateRef}
              className="relative shadow-xl overflow-hidden"
              data-certificate="true"
              style={{
                backgroundColor: backgroundColor,
                borderWidth: `${borderStyle.width}px`,
                borderStyle: borderStyle.style,
                borderColor: borderStyle.color,
                borderRadius: borderStyle.radius
                  ? `${borderStyle.radius}px`
                  : "0px",
                width: `${certificateSize.width}px`,
                height: `${certificateSize.height}px`,
                transform: `scale(${Math.min(1, 600 / certificateSize.width)})`,
                transformOrigin: "center",
                transition: "transform 0.2s ease",
                marginTop: showRulers ? "30px" : "0",
                marginLeft: showRulers ? "30px" : "0",
                position: "relative", // Ensure position is set for absolute children
                overflow: "hidden", // Ensure overflow is hidden to contain the blur
              }}
              onMouseMove={handleCertificateMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCertificateClick}
            >
              {/* Background layer */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: backgroundColor,
                  zIndex: 0,
                }}
              />

              {/* Background image with blur effect */}
              {backgroundImage && (
                <>
                  {/* Blurred background layer */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${backgroundImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      filter: `blur(${backgroundProps.blur}px)`,
                      opacity: backgroundProps.opacity,
                      transform: "scale(1.1)", // Slightly scale up to avoid blur edges
                    }}
                    data-background-blur="true"
                  ></div>

                  {/* Original background for when blur is 0 */}
                  {backgroundProps.blur === 0 && (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${backgroundImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        opacity: backgroundProps.opacity,
                        zIndex: 2,
                      }}
                    ></div>
                  )}
                </>
              )}

              {/* Grid overlay */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none z-[2]"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), 
                      linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
                    backgroundSize: `${gridSize}px ${gridSize}px`,
                    backgroundPosition: "0 0",
                  }}
                />
              )}
              {/* Ruler lines */}
              {showRulers && (
                <>
                  {/* Horizontal ruler line */}
                  <div
                    className="absolute pointer-events-none z-[2]"
                    style={{
                      left: 0,
                      top: `${certificateSize.height / 2}px`,
                      width: "100%",
                      height: "1px",
                      backgroundColor: `${rulerColor}`,
                    }}
                  />

                  {/* Vertical ruler line */}
                  <div
                    className="absolute pointer-events-none z-[2]"
                    style={{
                      left: `${certificateSize.width / 2}px`,
                      top: 0,
                      width: "1px",
                      height: "100%",
                      backgroundColor: `${rulerColor}`,
                    }}
                  />
                </>
              )}

              {/* Content container - ensures content is above background */}
              <div className="absolute inset-0" style={{ zIndex: 3 }}>
                {elements
                  .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                  .map(
                    (element) =>
                      element.isVisible && (
                        <div
                          key={element.id}
                          className={`absolute cursor-move ${
                            selectedElement === element.id
                              ? "ring-2 ring-blue-500"
                              : ""
                          }`}
                          style={{
                            left: `${element.x}%`,
                            top: `${element.y}%`,
                            transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                            opacity: element.opacity,
                            userSelect: "none",
                            zIndex: element.zIndex || 0,
                          }}
                          onMouseDown={(e) => handleMouseDown(e, element.id)}
                        >
                          {element.type === "text" ? (
                            <div
                              contentEditable={selectedElement === element.id}
                              suppressContentEditableWarning={true}
                              data-element-id={element.id}
                              onBlur={(e) => {
                                if (selectedElement === element.id) {
                                  updateElement(element.id, {
                                    content: e.target.innerText,
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && e.shiftKey) {
                                  e.preventDefault();
                                  document.execCommand("insertLineBreak");
                                }
                              }}
                              style={{
                                color: element.color,
                                fontSize: `${element.fontSize}px`,
                                fontFamily: element.fontFamily,
                                fontWeight: element.fontWeight,
                                textAlign: element.textAlign,
                                textShadow: element.shadow?.enabled
                                  ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`
                                  : "none",
                                width: element.width || "auto",
                                minWidth: "50px",
                                minHeight: "1.2em",
                                maxWidth: "960px",
                                padding: "10px", // Always add padding to prevent text cut-off
                                border:
                                  selectedElement === element.id
                                    ? "1px dashed #3b82f6"
                                    : "none",
                                outline: "none",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                                resize:
                                  selectedElement === element.id
                                    ? "both"
                                    : "none",
                                overflow: "hidden",
                                lineHeight: "1.3", // Improve line height for better readability
                              }}
                            >
                              {selectedEvent
                                ? parsePlaceholders(
                                    element.content,
                                    selectedEvent
                                  )
                                : element.content}
                            </div>
                          ) : // Also update the element rendering to ensure border radius is properly applied
                          // Find the section where elements are rendered in the return statement and update the image and shape elements

                          // For image elements, update the style to ensure border-radius is properly applied
                          element.type === "image" ? (
                            <img
                              src={element.content || "/placeholder.svg"}
                              alt="Element"
                              style={{
                                width: `${element.width}px`,
                                height: `${element.height}px`,
                                boxShadow: element.shadow?.enabled
                                  ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`
                                  : "none",
                                borderRadius: element.borderRadius
                                  ? `${element.borderRadius}px`
                                  : "0px",
                                border: element.border?.enabled
                                  ? `${element.border.width}px ${element.border.style} ${element.border.color}`
                                  : "none",
                              }}
                            />
                          ) : element.type === "signature" ? (
                            <img
                              src={element.content || "/placeholder.svg"}
                              alt="Signature"
                              style={{
                                width: `${element.width}px`,
                                height: `${element.height}px`,
                                boxShadow: element.shadow?.enabled
                                  ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`
                                  : "none",
                                borderRadius: element.borderRadius
                                  ? `${element.borderRadius}px`
                                  : "0px",
                                border: element.border?.enabled
                                  ? `${element.border.width}px ${element.border.style} ${element.border.color}`
                                  : "none",
                              }}
                            />
                          ) : element.type === "shape" ? (
                            <div
                              style={{
                                width: `${element.width}px`,
                                height: `${element.height}px`,
                                backgroundColor: element.color,
                                borderRadius:
                                  element.shapeType === "circle"
                                    ? "50%"
                                    : element.shapeType === "rounded"
                                    ? "10px"
                                    : element.borderRadius
                                    ? `${element.borderRadius}px`
                                    : "0px",
                                boxShadow: element.shadow?.enabled
                                  ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`
                                  : "none",
                              }}
                            ></div>
                          ) : null}
                        </div>
                      )
                  )}
                {/* Close the content container div */}
              </div>
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="w-full bg-gray-100 rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b bg-white">
            <button
              className={`flex-1 py-3 px-4 text-center ${
                activeTab === "elements"
                  ? "border-b-2 border-blue-500 font-medium"
                  : ""
              }`}
              onClick={() => setActiveTab("elements")}
            >
              Elements
            </button>
            <button
              className={`flex-1 py-3 px-4 text-center ${
                activeTab === "design"
                  ? "border-b-2 border-blue-500 font-medium"
                  : ""
              }`}
              onClick={() => setActiveTab("design")}
            >
              Design
            </button>
            <button
              className={`flex-1 py-3 px-4 text-center ${
                activeTab === "templates"
                  ? "border-b-2 border-blue-500 font-medium"
                  : ""
              }`}
              onClick={() => setActiveTab("templates")}
            >
              Templates
            </button>
          </div>

          <div
            className="p-6 overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            {/* Elements Tab */}
            {activeTab === "elements" && (
              <>
                {/* Add New Elements */}
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Add Elements</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      onClick={() => addNewElement("text")}
                    >
                      <Type size={16} />
                      <span>Add Text</span>
                    </button>
                    <button
                      className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                      onClick={() => addNewElement("image")}
                    >
                      <ImageIcon size={16} />
                      <span>Add Image</span>
                    </button>
                    <button
                      className="flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                      onClick={() => addNewElement("shape")}
                    >
                      <Square size={16} />
                      <span>Add Shape</span>
                    </button>
                  </div>
                </div>

                {/* Placeholder Helper */}
                <div className="mb-6 border p-3 rounded bg-white">
                  <h3 className="font-medium mb-2">
                    Event & Attendee Data Placeholders
                  </h3>
                  <p className="text-sm mb-2">
                    You can use placeholders in text elements to automatically
                    insert data:
                  </p>

                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-1">
                      Event Placeholders:
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ title }"}</code> - Event
                        title
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ description }"}</code> -
                        Event description
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ date }"}</code> - Event
                        date
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ time }"}</code> - Event
                        time
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ location }"}</code> -
                        Event location
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ registrarName }"}</code>{" "}
                        - Organizer name
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-1">
                      Attendee Placeholders:
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ userName }"}</code> -
                        Attendee's name
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ email }"}</code> -
                        Attendee's email
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ userId }"}</code> -
                        Attendee's ID
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <code className="font-mono">{"{ phone }"}</code> -
                        Attendee's phone (if available)
                      </div>
                    </div>
                  </div>

                  <p className="text-sm mt-3">
                    <span className="font-medium">Example:</span>{" "}
                    <span className="font-mono">
                      This certificate is awarded to {"{ userName }"} for
                      attending {"{ title }"} on {"{ date }"}
                    </span>
                  </p>
                  <p className="text-sm mt-1 text-gray-600">
                    When sending to multiple attendees, these placeholders will
                    be automatically replaced with each attendee's information.
                  </p>
                </div>

                {/* Event Data Elements */}
                {selectedEvent && (
                  <div className="mb-6 border p-3 rounded bg-white">
                    <h3 className="font-medium mb-2">Add Event Data</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                        onClick={() => {
                          addNewElement("text");
                          const newElementId = `element-${Date.now()}`;
                          updateElement(newElementId, { content: "{ title }" });
                        }}
                      >
                        Add Event Title
                      </button>
                      <button
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                        onClick={() => {
                          addNewElement("text");
                          const newElementId = `element-${Date.now()}`;
                          updateElement(newElementId, {
                            content: "{ description }",
                          });
                        }}
                      >
                        Add Description
                      </button>
                      <button
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                        onClick={() => {
                          addNewElement("text");
                          const newElementId = `element-${Date.now()}`;
                          updateElement(newElementId, { content: "{ date }" });
                        }}
                      >
                        Add Date
                      </button>
                      <button
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                        onClick={() => {
                          addNewElement("text");
                          const newElementId = `element-${Date.now()}`;
                          updateElement(newElementId, {
                            content: "{ location }",
                          });
                        }}
                      >
                        Add Location
                      </button>
                      <button
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                        onClick={() => {
                          addNewElement("text");
                          const newElementId = `element-${Date.now()}`;
                          updateElement(newElementId, {
                            content: "{ userName }",
                          });
                        }}
                      >
                        Add Attendee Name
                      </button>
                      <button
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm col-span-2"
                        onClick={() => {
                          addNewElement("text");
                          const newElementId = `element-${Date.now()}`;
                          updateElement(newElementId, {
                            content:
                              "This is to certify that [Attendee Name] participated in { title } held at { location } on { date }",
                          });
                        }}
                      >
                        Add Certificate Text
                      </button>
                      <button
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm col-span-2"
                        onClick={() => {
                          addNewElement("text");
                          const newElementId = `element-${Date.now()}`;
                          updateElement(newElementId, {
                            content:
                              "This is to certify that { userName } participated in { title } held at { location } on { date }",
                            fontSize: 18,
                            fontFamily: "serif",
                            color: "#333333",
                            textAlign: "center",
                          });
                        }}
                      >
                        Add Certificate Text with Attendee Name
                      </button>
                    </div>
                  </div>
                )}

                {/* Signature Pad */}
                <div className="mb-6 border p-3 rounded bg-white">
                  <h3 className="font-medium mb-2">Add Signature</h3>
                  <div className="border rounded mb-2 bg-gray-50">
                    <canvas
                      ref={signaturePadRef}
                      className="w-full h-36 cursor-crosshair"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    />
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      className="flex-1 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm flex items-center justify-center gap-1"
                      onClick={clearSignature}
                    >
                      <X size={14} />
                      <span>Clear</span>
                    </button>
                    <button
                      className="flex-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center justify-center gap-1 disabled:bg-blue-300 disabled:cursor-not-allowed"
                      onClick={addSignature}
                      disabled={!signatureData}
                    >
                      <Check size={14} />
                      <span>Add to Certificate</span>
                    </button>
                  </div>

                  {/* Upload Signature Option */}
                  <div className="mt-3 border-t pt-3">
                    <label className="block text-sm mb-2">
                      Or Upload Signature Image
                    </label>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="text-sm w-full"
                      accept="image/*"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Transparent PNG files work best for signatures
                    </div>
                  </div>
                </div>

                {/* Email Certificate */}

                <div className="mb-6 border p-3 rounded bg-white">
                  <h3 className="font-medium mb-2">
                    Send Certificate by Email
                  </h3>
                  <div className="space-y-3">
                    {selectedEvent ? (
                      <>
                        {eventAttendees.length > 0 ? (
                          <>
                            <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-3">
                              <h4 className="font-medium text-sm mb-2">
                                Event Attendees
                              </h4>
                              <div className="max-h-40 overflow-y-auto">
                                {eventAttendees.map((attendee) => (
                                  <div
                                    key={attendee.id}
                                    className="flex items-center mb-1"
                                  >
                                    <input
                                      type="checkbox"
                                      id={`attendee-${attendee.id}`}
                                      checked={selectedAttendees.includes(
                                        attendee.id
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAttendees([
                                            ...selectedAttendees,
                                            attendee.id,
                                          ]);
                                        } else {
                                          setSelectedAttendees(
                                            selectedAttendees.filter(
                                              (id) => id !== attendee.id
                                            )
                                          );
                                        }
                                      }}
                                      className="mr-2"
                                    />
                                    <label
                                      htmlFor={`attendee-${attendee.id}`}
                                      className="text-sm flex-1"
                                    >
                                      {attendee.userName} ({attendee.email})
                                    </label>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between mt-2">
                                <button
                                  type="button"
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  onClick={() =>
                                    setSelectedAttendees(
                                      eventAttendees.map((a) => a.id)
                                    )
                                  }
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  onClick={() => setSelectedAttendees([])}
                                >
                                  Deselect All
                                </button>
                              </div>
                              <div className="mt-3">
                                <button
                                  className={`w-full px-3 py-2 ${
                                    emailStatus === "error"
                                      ? "bg-red-100 text-red-700"
                                      : emailStatus === "sent"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-blue-500 hover:bg-blue-600 text-white"
                                  } rounded text-sm flex items-center justify-center gap-1`}
                                  onClick={sendCertificatesToMultipleAttendees}
                                  disabled={
                                    emailStatus === "sending" ||
                                    sendingMultiple ||
                                    selectedAttendees.length === 0
                                  }
                                >
                                  {sendingMultiple ? (
                                    <>
                                      <Loader2
                                        size={16}
                                        className="animate-spin"
                                      />
                                      <span>
                                        Sending {sendProgress.current}/
                                        {sendProgress.total}...
                                      </span>
                                    </>
                                  ) : emailStatus === "sent" ? (
                                    <>
                                      <Check size={16} />
                                      <span>Certificates Sent!</span>
                                    </>
                                  ) : emailStatus === "error" ? (
                                    <>
                                      <X size={16} />
                                      <span>Error Sending</span>
                                    </>
                                  ) : (
                                    <>
                                      <Mail size={16} />
                                      <span>
                                        Send to Selected Attendees (
                                        {selectedAttendees.length})
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="border-t pt-3 mt-3">
                              <h4 className="font-medium text-sm mb-2">
                                Or Send to a Single Email
                              </h4>
                            </div>
                          </>
                        ) : isLoadingAttendees ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 size={20} className="animate-spin mr-2" />
                            <span>Loading attendees...</span>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-3 text-sm">
                            No attendees found for this event. You can still
                            send to a single email below.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-3 text-sm">
                        Select an event to see attendees or send to a single
                        email below.
                      </div>
                    )}

                    <div>
                      <label className="block text-sm mb-1">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="w-full p-2 border rounded"
                        placeholder="recipient@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">
                        Email Message (Optional)
                      </label>
                      <textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        className="w-full p-2 border rounded"
                        rows="3"
                        placeholder="Add a personal message to accompany the certificate..."
                      ></textarea>
                    </div>
                    <button
                      className={`w-full px-3 py-2 ${
                        emailStatus === "error"
                          ? "bg-red-100 text-red-700"
                          : emailStatus === "sent"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-500 hover:bg-blue-600 text-white"
                      } rounded text-sm flex items-center justify-center gap-1`}
                      onClick={sendCertificateEmailFn}
                      disabled={
                        emailStatus === "sending" ||
                        sendingMultiple ||
                        !recipientEmail
                      }
                    >
                      {emailStatus === "sending" && !sendingMultiple ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : emailStatus === "sent" && !sendingMultiple ? (
                        <>
                          <Check size={16} />
                          <span>Certificate Sent!</span>
                        </>
                      ) : emailStatus === "error" && !sendingMultiple ? (
                        <>
                          <X size={16} />
                          <span>Error Sending</span>
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          <span>Send Certificate</span>
                        </>
                      )}
                    </button>
                    {emailStatus === "error" && (
                      <p className="text-xs text-red-600 mt-1">
                        There was an error sending the certificate. Please try
                        again.
                      </p>
                    )}
                  </div>
                </div>

                {/* Elements List */}
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Elements</h3>
                  {elements.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {elements.map((element) => (
                        <div
                          key={element.id}
                          className={`flex items-center justify-between p-2 rounded border ${
                            selectedElement === element.id
                              ? "bg-blue-50 border-blue-300"
                              : "bg-white"
                          }`}
                          onClick={() => setSelectedElement(element.id)}
                        >
                          <div className="flex items-center gap-2">
                            {element.type === "text" ? (
                              <Type size={14} />
                            ) : element.type === "image" ? (
                              <ImageIcon size={14} />
                            ) : element.type === "signature" ? (
                              <Signature size={14} />
                            ) : element.type === "shape" ? (
                              <Square size={14} />
                            ) : null}
                            <span className="text-sm truncate max-w-[120px]">
                              {element.type === "text"
                                ? element.content
                                : element.type}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <button
                              className="p-1 text-blue-500 hover:text-blue-700 mr-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                const elementEdit = document.querySelector(
                                  `[data-element-id="${element.id}"]`
                                );
                                if (elementEdit) {
                                  setSelectedElement(element.id);
                                  setTimeout(() => {
                                    elementEdit.focus();
                                  }, 100);
                                }
                              }}
                              title="Edit Text"
                            >
                              <Type size={14} />
                            </button>
                            <button
                              className="p-1 text-gray-500 hover:text-gray-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleElementVisibility(element.id);
                              }}
                              title={element.isVisible ? "Hide" : "Show"}
                            >
                              {element.isVisible ? (
                                <Eye size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                            </button>
                            <button
                              className="p-1 text-gray-500 hover:text-gray-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateElement(element.id);
                              }}
                              title="Duplicate"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              className="p-1 text-red-500 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeElement(element.id);
                              }}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 bg-white rounded border">
                      No elements added yet. Start by adding text, images, or
                      shapes.
                    </div>
                  )}
                </div>

                {/* Ruler and Grid Settings */}
                <div className="mb-6 border p-3 rounded bg-white">
                  <h3 className="font-medium mb-2">Alignment Tools</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm">Show Rulers</label>
                      <input
                        type="checkbox"
                        checked={showRulers}
                        onChange={(e) => setShowRulers(e.target.checked)}
                        className="ml-2"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm">Show Grid</label>
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        className="ml-2"
                      />
                    </div>
                    {/* Color toggle checkbox */}
                    <div className="flex items-center justify-between">
                      <label htmlFor="lineColorToggle" className="text-sm">
                        White Lines
                      </label>
                      <input
                        type="checkbox"
                        id="lineColorToggle"
                        checked={isWhiteLines}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsWhiteLines(checked);
                          setGridColor(
                            checked
                              ? "rgba(255, 255, 255, 0.2)"
                              : "rgba(0, 0, 0, 0.1)"
                          );
                          setRulerColor(
                            checked
                              ? "rgba(255, 255, 255, 0.5)"
                              : "rgba(0, 0, 0, 0.3)"
                          );
                        }}
                        className="ml-2"
                      />
                    </div>
                    {showGrid && (
                      <div>
                        <label className="block text-sm mb-1">Grid Size</label>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="10"
                          value={gridSize}
                          onChange={(e) => setGridSize(Number(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-xs">{gridSize}px</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Design Tab */}
            {activeTab === "design" && (
              <>
                {/* Certificate Size */}
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Certificate Size</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-sm mb-1">Width (px)</label>
                      <input
                        type="number"
                        value={certificateSize.width}
                        onChange={(e) =>
                          updateCertificateSize({
                            width: Number(e.target.value),
                          })
                        }
                        className="w-full p-2 border rounded"
                        min="500"
                        max="2000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Height (px)</label>
                      <input
                        type="number"
                        value={certificateSize.height}
                        onChange={(e) =>
                          updateCertificateSize({
                            height: Number(e.target.value),
                          })
                        }
                        className="w-full p-2 border rounded"
                        min="500"
                        max="2000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Orientation</label>
                    <select
                      value={certificateSize.orientation}
                      onChange={(e) =>
                        updateCertificateSize({ orientation: e.target.value })
                      }
                      className="w-full p-2 border rounded"
                    >
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                </div>

                {/* Background */}
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Background</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-sm mb-1">Color</label>
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => {
                          setBackgroundColor(e.target.value);
                          saveToHistory();
                        }}
                        className="w-full h-10 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Image</label>
                      <input
                        type="file"
                        onChange={handleBackgroundUpload}
                        className="text-sm w-full"
                        accept="image/*"
                      />
                    </div>
                  </div>

                  {backgroundImage && (
                    <>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="block text-sm mb-1">Blur</label>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            value={backgroundProps.blur}
                            onChange={(e) => {
                              setBackgroundProps({
                                ...backgroundProps,
                                blur: Number(e.target.value),
                              });
                              saveToHistory();
                            }}
                            className="w-full"
                          />
                          <span className="text-xs">
                            {backgroundProps.blur}px
                          </span>
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Opacity</label>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={backgroundProps.opacity}
                            onChange={(e) => {
                              setBackgroundProps({
                                ...backgroundProps,
                                opacity: Number(e.target.value),
                              });
                              saveToHistory();
                            }}
                            className="w-full"
                          />
                          <span className="text-xs">
                            {Math.round(backgroundProps.opacity * 100)}%
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Border Styling */}
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Border</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-sm mb-1">Color</label>
                      <input
                        type="color"
                        value={borderStyle.color}
                        onChange={(e) => {
                          setBorderStyle({
                            ...borderStyle,
                            color: e.target.value,
                          });
                          saveToHistory();
                        }}
                        className="w-full h-10 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-1">Width</label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={borderStyle.width}
                        onChange={(e) => {
                          setBorderStyle({
                            ...borderStyle,
                            width: Number(e.target.value),
                          });
                          saveToHistory();
                        }}
                        className="w-full"
                      />
                      <span className="text-xs">{borderStyle.width}px</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm mb-1">Style</label>
                      <select
                        value={borderStyle.style}
                        onChange={(e) => {
                          setBorderStyle({
                            ...borderStyle,
                            style: e.target.value,
                          });
                          saveToHistory();
                        }}
                        className="w-full p-2 border rounded"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                        <option value="double">Double</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Radius</label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={borderStyle.radius}
                        onChange={(e) => {
                          setBorderStyle({
                            ...borderStyle,
                            radius: Number(e.target.value),
                          });
                          saveToHistory();
                        }}
                        className="w-full"
                      />
                      <span className="text-xs">{borderStyle.radius}px</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Templates Tab */}
            {activeTab === "templates" && (
              <>
                {/* Preset Templates */}
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Quick Templates</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.name}
                        className="p-3 bg-white border rounded hover:bg-gray-50 flex flex-col items-center"
                        onClick={() => applyTemplate(template)}
                      >
                        <div
                          className="w-full h-16 mb-2 rounded"
                          style={{
                            backgroundColor: template.background,
                            borderWidth: "4px",
                            borderStyle: "solid",
                            borderColor: template.border,
                          }}
                        ></div>
                        <span className="text-sm">{template.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saved Designs */}
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Saved Designs</h3>
                  {savedDesigns.length > 0 ? (
                    <div className="space-y-2">
                      {savedDesigns.map((design) => (
                        <div
                          key={design.name}
                          className="flex justify-between items-center p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer"
                          onClick={() => loadDesign(design)}
                        >
                          <div>
                            <div className="font-medium">{design.name}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(
                                design.date.seconds * 1000
                              ).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            className="p-1 text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDesignFromFirestore(design.id, design.name);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 bg-white rounded border">
                      No saved designs yet
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Selected Element Properties */}
            {selectedElement && (
              <div className="mb-6 border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Edit Element</h3>
                  <div className="flex items-center">
                    <button
                      className="p-1 text-gray-500 hover:text-gray-700 mr-1"
                      onClick={() => moveElementLayer(selectedElement, "up")}
                      title="Bring Forward"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      className="p-1 text-gray-500 hover:text-gray-700 mr-1"
                      onClick={() => moveElementLayer(selectedElement, "down")}
                      title="Send Backward"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      className="p-1 text-red-500 hover:text-red-700"
                      onClick={() => removeElement(selectedElement)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {elements.find((el) => el.id === selectedElement)?.type ===
                "text" ? (
                  <>
                    <div className="mb-2">
                      <label className="block text-sm mb-1">Text Content</label>
                      <textarea
                        value={
                          elements.find((el) => el.id === selectedElement)
                            ?.content
                        }
                        onChange={(e) =>
                          updateElement(selectedElement, {
                            content: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.shiftKey) {
                            e.preventDefault();
                            const textarea = e.target;
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const value = textarea.value;
                            const newValue =
                              value.substring(0, start) +
                              "\n" +
                              value.substring(end);
                            updateElement(selectedElement, {
                              content: newValue,
                            });

                            // Set cursor position after the inserted newline
                            setTimeout(() => {
                              textarea.selectionStart = start + 1;
                              textarea.selectionEnd = start + 1;
                            }, 0);
                          }
                        }}
                        className="w-full p-2 border rounded font-mono"
                        style={{
                          fontFamily: elements.find(
                            (el) => el.id === selectedElement
                          )?.fontFamily,
                          fontSize: "14px",
                          resize: "vertical",
                          minHeight: "80px",
                        }}
                        rows="4"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Press Shift+Enter to add a new line
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-sm mb-1">Font Size</label>
                        <input
                          type="range"
                          min="10"
                          max="72"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.fontSize
                          }
                          onChange={(e) =>
                            updateElement(selectedElement, {
                              fontSize: Number(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                        <span className="text-xs">
                          {
                            elements.find((el) => el.id === selectedElement)
                              ?.fontSize
                          }
                          px
                        </span>
                      </div>

                      <div>
                        <label className="block text-sm mb-1">Color</label>
                        <input
                          type="color"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.color
                          }
                          onChange={(e) =>
                            updateElement(selectedElement, {
                              color: e.target.value,
                            })
                          }
                          className="w-full h-10 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-sm mb-1">
                          Font Family
                        </label>
                        <select
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.fontFamily
                          }
                          onChange={(e) =>
                            updateElement(selectedElement, {
                              fontFamily: e.target.value,
                            })
                          }
                          className="w-full p-2 border rounded"
                        >
                          <option value="sans-serif">Sans-serif</option>
                          <option value="serif">Serif</option>
                          <option value="monospace">Monospace</option>
                          <option value="cursive">Cursive</option>
                          <option value="fantasy">Fantasy</option>
                          <option value="Rowdies">Rowdies</option>
                          <option value="Open Sans">Open Sans</option>
                          <option value="Poppins">Poppins</option>
                          <option value="Special Gothic Condensed One">
                            Special Gothic Condensed One
                          </option>
                          <option value="Big Shoulders">Big Shoulders</option>
                          <option value="Playwrite AU SA">
                            Playwrite AU SA
                          </option>
                          <option value="Playwrite RO">Playwrite RO</option>
                          <option value="Anton">Anton</option>
                          <option value="Lilita One">Lilita One</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm mb-1">
                          Font Weight
                        </label>
                        <select
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.fontWeight
                          }
                          onChange={(e) =>
                            updateElement(selectedElement, {
                              fontWeight: e.target.value,
                            })
                          }
                          className="w-full p-2 border rounded"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Bold</option>
                          <option value="lighter">Lighter</option>
                        </select>
                      </div>
                    </div>

                    <div className="mb-2">
                      <label className="block text-sm mb-1">Text Width</label>
                      <input
                        type="range"
                        min="100"
                        max="960"
                        value={
                          elements.find((el) => el.id === selectedElement)
                            ?.width || 500
                        }
                        onChange={(e) =>
                          updateElement(selectedElement, {
                            width: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                      <span className="text-xs">
                        {elements.find((el) => el.id === selectedElement)
                          ?.width || 500}
                        px
                      </span>
                    </div>

                    <div className="mb-2">
                      <label className="block text-sm mb-1">Text Align</label>
                      <div className="flex border rounded overflow-hidden">
                        <button
                          className={`flex-1 p-2 ${
                            elements.find((el) => el.id === selectedElement)
                              ?.textAlign === "left"
                              ? "bg-blue-100"
                              : "bg-white"
                          }`}
                          onClick={() =>
                            updateElement(selectedElement, {
                              textAlign: "left",
                            })
                          }
                        >
                          <AlignLeft size={16} className="mx-auto" />
                        </button>
                        <button
                          className={`flex-1 p-2 ${
                            elements.find((el) => el.id === selectedElement)
                              ?.textAlign === "center"
                              ? "bg-blue-100"
                              : "bg-white"
                          }`}
                          onClick={() =>
                            updateElement(selectedElement, {
                              textAlign: "center",
                            })
                          }
                        >
                          <AlignCenter size={16} className="mx-auto" />
                        </button>
                        <button
                          className={`flex-1 p-2 ${
                            elements.find((el) => el.id === selectedElement)
                              ?.textAlign === "right"
                              ? "bg-blue-100"
                              : "bg-white"
                          }`}
                          onClick={() =>
                            updateElement(selectedElement, {
                              textAlign: "right",
                            })
                          }
                        >
                          <AlignRight size={16} className="mx-auto" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm mb-1">Width</label>
                        <input
                          type="range"
                          min="20"
                          max="300"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.width
                          }
                          onChange={(e) =>
                            updateElement(selectedElement, {
                              width: Number(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                        <span className="text-xs">
                          {
                            elements.find((el) => el.id === selectedElement)
                              ?.width
                          }
                          px
                        </span>
                      </div>

                      <div>
                        <label className="block text-sm mb-1">Height</label>
                        <input
                          type="range"
                          min="20"
                          max="300"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.height
                          }
                          onChange={(e) =>
                            updateElement(selectedElement, {
                              height: Number(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                        <span className="text-xs">
                          {
                            elements.find((el) => el.id === selectedElement)
                              ?.height
                          }
                          px
                        </span>
                      </div>
                    </div>

                    {elements.find((el) => el.id === selectedElement)?.type ===
                      "image" && (
                      <div className="mt-2">
                        <label className="block text-sm mb-1">Image URL</label>
                        <input
                          type="text"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.content
                          }
                          onChange={(e) =>
                            updateElement(selectedElement, {
                              content: e.target.value,
                            })
                          }
                          className="w-full p-2 border rounded"
                          placeholder="Enter image URL or upload"
                        />
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                updateElement(selectedElement, {
                                  content: e.target.result,
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="mt-1 text-sm w-full"
                          accept="image/*"
                        />
                        {/* Image Border Controls */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-sm">Border</label>
                            <input
                              type="checkbox"
                              checked={
                                elements.find((el) => el.id === selectedElement)
                                  ?.border?.enabled || false
                              }
                              onChange={(e) => {
                                const element = elements.find(
                                  (el) => el.id === selectedElement
                                );
                                updateElement(selectedElement, {
                                  border: {
                                    ...(element.border || {
                                      width: 2,
                                      color: "#000000",
                                      style: "solid",
                                    }),
                                    enabled: e.target.checked,
                                  },
                                });
                              }}
                              className="ml-2"
                            />
                          </div>

                          {elements.find((el) => el.id === selectedElement)
                            ?.border?.enabled && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs mb-1">
                                  Color
                                </label>
                                <input
                                  type="color"
                                  value={
                                    elements.find(
                                      (el) => el.id === selectedElement
                                    )?.border?.color || "#000000"
                                  }
                                  onChange={(e) => {
                                    const element = elements.find(
                                      (el) => el.id === selectedElement
                                    );
                                    updateElement(selectedElement, {
                                      border: {
                                        ...element.border,
                                        color: e.target.value,
                                      },
                                    });
                                  }}
                                  className="w-full h-8 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="block text-xs mb-1">
                                  Width
                                </label>
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  value={
                                    elements.find(
                                      (el) => el.id === selectedElement
                                    )?.border?.width || 2
                                  }
                                  onChange={(e) => {
                                    const element = elements.find(
                                      (el) => el.id === selectedElement
                                    );
                                    updateElement(selectedElement, {
                                      border: {
                                        ...element.border,
                                        width: Number(e.target.value),
                                      },
                                    });
                                  }}
                                  className="w-full"
                                />
                                <span className="text-xs">
                                  {elements.find(
                                    (el) => el.id === selectedElement
                                  )?.border?.width || 2}
                                  px
                                </span>
                              </div>
                            </div>
                          )}

                          {elements.find((el) => el.id === selectedElement)
                            ?.border?.enabled && (
                            <div className="mt-2">
                              <label className="block text-xs mb-1">
                                Style
                              </label>
                              <select
                                value={
                                  elements.find(
                                    (el) => el.id === selectedElement
                                  )?.border?.style || "solid"
                                }
                                onChange={(e) => {
                                  const element = elements.find(
                                    (el) => el.id === selectedElement
                                  );
                                  updateElement(selectedElement, {
                                    border: {
                                      ...element.border,
                                      style: e.target.value,
                                    },
                                  });
                                }}
                                className="w-full p-1 border rounded text-xs"
                              >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                                <option value="double">Double</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Border Radius Control */}
                        <div className="mt-3">
                          <label className="block text-sm mb-1">
                            Border Radius
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={
                              elements.find((el) => el.id === selectedElement)
                                ?.borderRadius || 0
                            }
                            onChange={(e) => {
                              updateElement(selectedElement, {
                                borderRadius: Number(e.target.value),
                              });
                            }}
                            className="w-full"
                          />
                          <span className="text-xs">
                            {elements.find((el) => el.id === selectedElement)
                              ?.borderRadius || 0}
                            px
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {elements.find((el) => el.id === selectedElement)?.type ===
                  "shape" && (
                  <>
                    <div className="mb-2">
                      <label className="block text-sm mb-1">Shape Type</label>
                      <select
                        value={
                          elements.find((el) => el.id === selectedElement)
                            ?.shapeType || "rectangle"
                        }
                        onChange={(e) =>
                          updateElement(selectedElement, {
                            shapeType: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded"
                      >
                        <option value="rectangle">Rectangle</option>
                        <option value="rounded">Rounded Rectangle</option>
                        <option value="circle">Circle</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm mb-1">Color</label>
                      <input
                        type="color"
                        value={
                          elements.find((el) => el.id === selectedElement)
                            ?.color
                        }
                        onChange={(e) =>
                          updateElement(selectedElement, {
                            color: e.target.value,
                          })
                        }
                        className="w-full h-10 cursor-pointer"
                      />
                    </div>
                  </>
                )}
                {elements.find((el) => el.id === selectedElement)?.type ===
                  "signature" && (
                  <div className="mt-2">
                    {/* Image Border Controls */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm">Border</label>
                        <input
                          type="checkbox"
                          checked={
                            elements.find((el) => el.id === selectedElement)
                              ?.border?.enabled || false
                          }
                          onChange={(e) => {
                            const element = elements.find(
                              (el) => el.id === selectedElement
                            );
                            updateElement(selectedElement, {
                              border: {
                                ...(element.border || {
                                  width: 2,
                                  color: "#000000",
                                  style: "solid",
                                }),
                                enabled: e.target.checked,
                              },
                            });
                          }}
                          className="ml-2"
                        />
                      </div>

                      {elements.find((el) => el.id === selectedElement)?.border
                        ?.enabled && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs mb-1">Color</label>
                            <input
                              type="color"
                              value={
                                elements.find((el) => el.id === selectedElement)
                                  ?.border?.color || "#000000"
                              }
                              onChange={(e) => {
                                const element = elements.find(
                                  (el) => el.id === selectedElement
                                );
                                updateElement(selectedElement, {
                                  border: {
                                    ...element.border,
                                    color: e.target.value,
                                  },
                                });
                              }}
                              className="w-full h-8 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1">Width</label>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={
                                elements.find((el) => el.id === selectedElement)
                                  ?.border?.width || 2
                              }
                              onChange={(e) => {
                                const element = elements.find(
                                  (el) => el.id === selectedElement
                                );
                                updateElement(selectedElement, {
                                  border: {
                                    ...element.border,
                                    width: Number(e.target.value),
                                  },
                                });
                              }}
                              className="w-full"
                            />
                            <span className="text-xs">
                              {elements.find((el) => el.id === selectedElement)
                                ?.border?.width || 2}
                              px
                            </span>
                          </div>
                        </div>
                      )}

                      {elements.find((el) => el.id === selectedElement)?.border
                        ?.enabled && (
                        <div className="mt-2">
                          <label className="block text-xs mb-1">Style</label>
                          <select
                            value={
                              elements.find((el) => el.id === selectedElement)
                                ?.border?.style || "solid"
                            }
                            onChange={(e) => {
                              const element = elements.find(
                                (el) => el.id === selectedElement
                              );
                              updateElement(selectedElement, {
                                border: {
                                  ...element.border,
                                  style: e.target.value,
                                },
                              });
                            }}
                            className="w-full p-1 border rounded text-xs"
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                            <option value="double">Double</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Border Radius Control */}
                    <div className="mt-3">
                      <label className="block text-sm mb-1">
                        Border Radius
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={
                          elements.find((el) => el.id === selectedElement)
                            ?.borderRadius || 0
                        }
                        onChange={(e) => {
                          updateElement(selectedElement, {
                            borderRadius: Number(e.target.value),
                          });
                        }}
                        className="w-full"
                      />
                      <span className="text-xs">
                        {elements.find((el) => el.id === selectedElement)
                          ?.borderRadius || 0}
                        px
                      </span>
                    </div>
                  </div>
                )}
                {/* Common properties for all element types */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-sm mb-1">Rotation</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={
                        elements.find((el) => el.id === selectedElement)
                          ?.rotation || 0
                      }
                      onChange={(e) =>
                        updateElement(selectedElement, {
                          rotation: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <span className="text-xs">
                      {elements.find((el) => el.id === selectedElement)
                        ?.rotation || 0}
                      °
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Opacity</label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={
                        elements.find((el) => el.id === selectedElement)
                          ?.opacity || 1
                      }
                      onChange={(e) =>
                        updateElement(selectedElement, {
                          opacity: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <span className="text-xs">
                      {Math.round(
                        (elements.find((el) => el.id === selectedElement)
                          ?.opacity || 1) * 100
                      )}
                      %
                    </span>
                  </div>
                </div>
                {/* Shadow settings */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm">Shadow</label>
                    <input
                      type="checkbox"
                      checked={
                        elements.find((el) => el.id === selectedElement)?.shadow
                          ?.enabled || false
                      }
                      onChange={(e) => {
                        const element = elements.find(
                          (el) => el.id === selectedElement
                        );
                        updateElement(selectedElement, {
                          shadow: {
                            ...(element.shadow || {
                              color: "rgba(0,0,0,0.3)",
                              blur: 5,
                              offsetX: 2,
                              offsetY: 2,
                            }),
                            enabled: e.target.checked,
                          },
                        });
                      }}
                      className="ml-2"
                    />
                  </div>

                  {elements.find((el) => el.id === selectedElement)?.shadow
                    ?.enabled && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs mb-1">Color</label>
                        <input
                          type="color"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.shadow?.color || "rgba(0,0,0,0.3)"
                          }
                          onChange={(e) => {
                            const element = elements.find(
                              (el) => el.id === selectedElement
                            );
                            updateElement(selectedElement, {
                              shadow: {
                                ...element.shadow,
                                color: e.target.value,
                              },
                            });
                          }}
                          className="w-full h-8 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Blur</label>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.shadow?.blur || 5
                          }
                          onChange={(e) => {
                            const element = elements.find(
                              (el) => el.id === selectedElement
                            );
                            updateElement(selectedElement, {
                              shadow: {
                                ...element.shadow,
                                blur: Number(e.target.value),
                              },
                            });
                          }}
                          className="w-full"
                        />
                        <span className="text-xs">
                          {elements.find((el) => el.id === selectedElement)
                            ?.shadow?.blur || 5}
                          px
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Offset X</label>
                        <input
                          type="range"
                          min="-10"
                          max="10"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.shadow?.offsetX || 2
                          }
                          onChange={(e) => {
                            const element = elements.find(
                              (el) => el.id === selectedElement
                            );
                            updateElement(selectedElement, {
                              shadow: {
                                ...element.shadow,
                                offsetX: Number(e.target.value),
                              },
                            });
                          }}
                          className="w-full"
                        />
                        <span className="text-xs">
                          {elements.find((el) => el.id === selectedElement)
                            ?.shadow?.offsetX || 2}
                          px
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Offset Y</label>
                        <input
                          type="range"
                          min="-10"
                          max="10"
                          value={
                            elements.find((el) => el.id === selectedElement)
                              ?.shadow?.offsetY || 2
                          }
                          onChange={(e) => {
                            const element = elements.find(
                              (el) => el.id === selectedElement
                            );
                            updateElement(selectedElement, {
                              shadow: {
                                ...element.shadow,
                                offsetY: Number(e.target.value),
                              },
                            });
                          }}
                          className="w-full"
                        />
                        <span className="text-xs">
                          {elements.find((el) => el.id === selectedElement)
                            ?.shadow?.offsetY || 2}
                          px
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
