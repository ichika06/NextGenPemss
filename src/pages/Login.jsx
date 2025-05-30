/**
 * Represents the Login component that allows users to log in using email or NFC.
 * @returns JSX element containing the login form and NFC functionality.
 */
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LogIn,
  Mail,
  Lock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Smartphone,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useFirestoreChecker from "../components/reuseChecker/FirestoreCheckerHook";
import logo from "../assets/next-gen-pemss-logo.svg";
import vocalevent from "../assets/vocalevent.jpg";
import promnight from "../assets/promnight.jpg";
import musicevent from "../assets/musicevent.jpg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [publicEvents, setPublicEvents] = useState([]);
  const { login, userRole, currentUser, authReady } = useAuth();
  const navigate = useNavigate();
  const { checkUserByNfcData } = useFirestoreChecker();
  const [nfcController, setNfcController] = useState(null);
  const [nfcStoppingInProgress, setNfcStoppingInProgress] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState(null);

  // Check if NFC is supported in the browser
  useEffect(() => {
    setNfcSupported(!!window.NDEFReader);
  }, []);

  // Fetch public events for the carousel
  useEffect(() => {
    const fetchPublicEvents = async () => {
      try {
        const eventsQuery = query(
          collection(db, "events"),
          where("isPublic", "==", true),
          orderBy("date", "desc"),
          // Limit to 5 events for the carousel
          limit(5)
        );

        const querySnapshot = await getDocs(eventsQuery);
        const eventsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setPublicEvents(eventsData);
      } catch (error) {
        console.error("Error fetching public events for carousel:", error);
      }
    };

    fetchPublicEvents();
  }, []);

  // Generate carousel images from public events or use fallbacks if no events
  const carouselImages =
    publicEvents.length > 0
      ? publicEvents.map((event) => ({
        src: event.image || vocalevent, // Use event image or fallback
        alt: event.title || "Event",
        title: event.title || "Upcoming Event",
        description: event.description || "Join us for this exciting event",
      }))
      : [
        {
          src: vocalevent,
          alt: "Vocal Event",
          title: "Show your Talent",
          description:
            "Participate in our Vocal Event and showcase your skills",
        },
        {
          src: promnight,
          alt: "Prom Night",
          title: "Prom Night",
          description: "Join us for a night of fun and memories",
        },
        {
          src: musicevent,
          alt: "Music Event",
          title: "Music Event",
          description: "Experience the magic of live music performances",
        },
      ];

  // Carousel navigation functions
  const nextSlide = () => {
    setCurrentSlide((prev) =>
      prev === carouselImages.length - 1 ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setCurrentSlide((prev) =>
      prev === 0 ? carouselImages.length - 1 : prev - 1
    );
  };

  // Auto-advance carousel
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Effect for handling redirection after authentication is complete
  // Effect for handling redirection after authentication is complete
  useEffect(() => {
    // Stop NFC scanning if it's active and we're authenticated
    if (nfcReading && authReady && currentUser && userRole) {
      stopNfcReading();
    }

    // Only attempt redirection when auth process has fully completed and we have a user
    if (authReady && currentUser && userRole) {
      const fetchUserSettings = async () => {
        try {
          // Query the settings collection to find the document with matching userId
          const settingsQuery = query(
            collection(db, "settings"),
            where("userId", "==", currentUser.uid)
          );

          const settingsSnapshot = await getDocs(settingsQuery);

          if (!settingsSnapshot.empty) {
            // Get the first matching document
            const settingsDoc = settingsSnapshot.docs[0];
            const settingsData = settingsDoc.data();

            // Extract the defaultLandingPage from accountSettings
            const defaultLandingPage = settingsData.accountSettings?.defaultLandingPage || "";

            // Navigate to the appropriate route with the default landing page
            if (userRole === "admin") {
              navigate(`/admin${defaultLandingPage ? `/${defaultLandingPage}` : ""}`);
            } else if (userRole === "registrar") {
              navigate(`/registrar${defaultLandingPage ? `/${defaultLandingPage}` : ""}`);
            } else if (userRole === "teacher") {
              navigate(`/teacher${defaultLandingPage ? `/${defaultLandingPage}` : ""}`);
            } else if (userRole === "student") {
              navigate(`/student${defaultLandingPage ? `/${defaultLandingPage}` : ""}`);
            } else {
              navigate("/login"); // Fallback
            }
          } else {
            // If no settings found, navigate to default routes
            if (userRole === "admin") navigate("/admin");
            else if (userRole === "registrar") navigate("/registrar");
            else if (userRole === "teacher") navigate("/teacher");
            else if (userRole === "student") navigate("/student");
            else navigate("/login"); // Fallback
          }
        } catch (error) {
          console.error("Error fetching user settings:", error);

          // In case of error, fallback to default navigation
          if (userRole === "admin") navigate("/admin");
          else if (userRole === "registrar") navigate("/registrar");
          else if (userRole === "teacher") navigate("/teacher");
          else if (userRole === "student") navigate("/student");
          else navigate("/login"); // Fallback
        }
      };

      // Execute the settings fetch
      fetchUserSettings();
    }
  }, [authReady, currentUser, userRole, navigate, nfcReading]);

  // Handle form submission with email/password
  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError("");
      setLoading(true);
      await login(email, password);
      // Navigation will be handled by the useEffect
    } catch (error) {
      setError("Failed to log in. Please check your credentials.");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  }

  // Effect to handle pending login after NFC stopping completes
  useEffect(() => {
    const processPendingLogin = async () => {
      if (pendingLoginData && !nfcStoppingInProgress) {
        try {
          setLoading(true);
          const { userEmail, userPassword } = pendingLoginData;
          console.log("Processing pending NFC login...");
          await login(userEmail, userPassword);
          console.log("NFC login successful!");
          setPendingLoginData(null);
        } catch (error) {
          console.error("Error processing pending NFC login:", error);
          setError("Failed to log in with NFC. Please try again.");
        } finally {
          setLoading(false);
        }
      }
    };

    processPendingLogin();
  }, [pendingLoginData, nfcStoppingInProgress, login]);

  const decodeNfcText = (record) => {
    try {
      // Handle both text records and empty records
      if (record) {
        // For text records, use TextDecoder
        if (record.recordType === "text") {
          const textDecoder = new TextDecoder(record.encoding || "utf-8");
          let decodedText = textDecoder.decode(record.data);

          // Process &NDEF:T:en: format
          if (decodedText && decodedText.startsWith("(&NDEF:T:")) {
            const parts = decodedText.split(":");
            if (parts.length >= 4) {
              return parts.slice(3).join(":");
            }
          }

          return decodedText;
        }
        // For empty records, try to interpret the raw data
        else if (record.recordType === "empty" && record.data) {
          // Try to decode as UTF-8 text first
          try {
            const textDecoder = new TextDecoder("utf-8");
            let rawText = textDecoder.decode(record.data);

            // Check for &NDEF:T: format in the raw data
            if (rawText.includes("(&NDEF:T:")) {
              const startIdx = rawText.indexOf("(&NDEF:T:");
              const parts = rawText.substring(startIdx).split(":");
              if (parts.length >= 4) {
                return parts.slice(3).join(":");
              }
            }

            return rawText;
          } catch (emptyRecordError) {
            console.log("Could not decode empty record with TextDecoder, trying raw approach");

            // Raw byte-by-byte decoding attempt
            let rawString = "";
            for (let i = 0; i < record.data.length; i++) {
              rawString += String.fromCharCode(record.data[i]);
            }

            if (rawString.includes("(&NDEF:T:")) {
              const startIdx = rawString.indexOf("(&NDEF:T:");
              const parts = rawString.substring(startIdx).split(":");
              if (parts.length >= 4) {
                return parts.slice(3).join(":");
              }
            }

            return rawString;
          }
        }
      }
      return "";
    } catch (error) {
      console.error("Error decoding NFC data:", error);
      return "";
    }
  };

  // Start NFC reading
  const startNfcReading = async () => {
    if (!window.NDEFReader) {
      setError("NFC is not supported on your device.");
      return;
    }

    try {
      setNfcReading(true);
      setError("");

      const ndef = new window.NDEFReader();

      // Create an AbortController
      const abortController = new AbortController();
      const signal = abortController.signal;

      // Store reference to the controller for later cleanup
      setNfcController({
        reader: ndef,
        abortController: abortController
      });

      // Request permission explicitly
      await ndef.scan({ signal });
      console.log("NFC scan started...");

      ndef.addEventListener("reading", async ({ message }) => {
        console.log("NFC tag detected!", message);

        try {
          // Extract user data from the NDEF records
          if (message && message.records) {
            let userId = null;

            // Try to find a record with user data
            for (const record of message.records) {
              console.log("Record type:", record.recordType);

              // Process both text and empty records
              if (record.recordType === "text" || record.recordType === "empty") {
                const decodedText = decodeNfcText(record);
                console.log("Decoded text from NFC:", decodedText);

                if (decodedText && decodedText.trim()) {
                  // Check if it's in NDEF format
                  if (decodedText.includes("(&NDEF:T:")) {
                    const startIdx = decodedText.indexOf("(&NDEF:T:");
                    const parts = decodedText.substring(startIdx).split(":");
                    if (parts.length >= 4) {
                      userId = parts.slice(3).join(":").trim();
                      break;
                    }
                  }

                  try {
                    // Try to parse as JSON
                    const parsedData = JSON.parse(decodedText);
                    console.log("Parsed NFC data:", parsedData);
                    userId = parsedData.uid || parsedData.docId || parsedData.id;
                    if (userId) break;
                  } catch (e) {
                    // If not JSON, use the raw text as userId
                    userId = decodedText.trim();
                    break;
                  }
                }
              }
            }

            if (userId) {
              console.log("User ID found in NFC:", userId);

              // Use the hook to check if user exists using the user identifier
              const result = await checkUserByNfcData(userId);

              if (result && result.exists && result.userData) {
                // Get the email and password from the userData
                const userEmail = result.userData.email;

                // Use the stored password if available, or fallback to generatedPassword field
                const userPassword =
                  result.userData.password || result.userData.generatedPassword;

                if (userEmail && userPassword) {

                  // Set email field for visual feedback, but keep password secured
                  setEmail(userEmail);
                  setPassword("********"); // Mask the actual password

                  // Store the credentials for login after NFC stops
                  setPendingLoginData({ userEmail, userPassword });

                  // Stop NFC scanning since we found a valid user
                  await stopNfcReading();

                  // The login will be handled by the useEffect after stopping completes
                } else {
                  setError(
                    "User found but login credentials are incomplete. Contact administrator."
                  );
                  stopNfcReading();
                }
              } else {
                setError(
                  "NFC tag not recognized. Please register this tag or use email login."
                );
                stopNfcReading();
              }
            } else {
              setError(
                "No valid user ID found in NFC tag. Please use email login."
              );
              stopNfcReading();
            }
          } else {
            setError("No readable data found in NFC tag.");
            stopNfcReading();
          }
        } catch (err) {
          console.error("Error during NFC authentication:", err);
          setError(`NFC authentication failed: ${err.message}`);
          stopNfcReading();
        }
      });

      ndef.addEventListener(
        "error",
        (error) => {
          console.error("NFC Error:", error);
          setError(`NFC Error: ${error.message}`);
          stopNfcReading();
        },
        { signal }
      );
    } catch (error) {
      console.error("Error starting NFC scan:", error);
      setError(
        `Cannot start NFC scan: ${error.message}. Make sure NFC is enabled on your device.`
      );
      setNfcReading(false);
    }
  };

  // Add a function to stop NFC reading
  const stopNfcReading = async () => {
    return new Promise((resolve) => {
      if (nfcReading) {
        setNfcStoppingInProgress(true);
        console.log("Stopping NFC reading...");

        if (nfcController) {
          // Try to abort using the AbortController
          if (
            nfcController.abortController &&
            typeof nfcController.abortController.abort === "function"
          ) {
            try {
              nfcController.abortController.abort();
              console.log("NFC scanning aborted via AbortController");
            } catch (error) {
              console.error("Error aborting NFC scan:", error);
            }
          }

          // For older browsers or fallback
          if (
            nfcController.reader &&
            typeof nfcController.reader.abort === "function"
          ) {
            try {
              nfcController.reader.abort();
              console.log("NFC scanning aborted via reader");
            } catch (error) {
              console.error("Error aborting NFC reader:", error);
            }
          }
        }

        // Clear states
        setNfcController(null);
        setNfcReading(false);

        // Allow a small delay for resources to clean up properly
        setTimeout(() => {
          setNfcStoppingInProgress(false);
          console.log("NFC reading stopped completely");
          resolve();
        }, 300); // 300ms delay to ensure proper cleanup
      } else {
        // If NFC was not reading, just resolve immediately
        resolve();
      }
    });
  };

  // Make sure to clean up NFC when component unmounts
  useEffect(() => {
    return () => {
      if (nfcReading || nfcController) {
        stopNfcReading();
      }
    };
  }, [nfcReading, nfcController]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-blue-50 to-indigo-100 md:gap-0">
      {/* Back button - visible on mobile */}
      <div className="md:hidden p-4">
        <button
          onClick={() => navigate("/landingPage")}
          className="flex items-center gap-2 text-primary-dark hover:text-primary transition-colors"
          style={{ fontFamily: "var(--paragraph-font)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </button>
      </div>

      {/* Login Form Section */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-4 md:p-4">
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl max-w-md w-full border border-gray-100">
          {/* Back button - visible on desktop */}
          <div className="hidden md:block mb-6">
            <button
              onClick={() => navigate("/landingPage")}
              className="flex items-center gap-2 text-primary-dark hover:text-primary transition-colors"
              style={{ fontFamily: "var(--paragraph-font)" }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>
          </div>

          <div className="text-center mb-8">
            {/* Logo added here */}
            <div className="flex justify-center mb-4">
              <img
                src={logo || "/placeholder.svg"}
                alt="NextGen-Pemss Logo"
                className="w-20 h-20"
              />
            </div>
            <h1
              className="text-3xl font-bold"
              style={{
                fontFamily: "var(--header-font)",
                color: "var(--primary)",
              }}
            >
              NextGen-Pemss
            </h1>
            <p
              className="mt-2"
              style={{
                fontFamily: "var(--paragraph-font)",
                color: "var(--text-secondary)",
              }}
            >
              Sign in to your account
            </p>
          </div>

          {/* NFC Login Button */}
          {nfcSupported && (
            <div className="mb-6">
              <button
                type="button"
                onClick={nfcReading || nfcStoppingInProgress ? stopNfcReading : startNfcReading}
                disabled={loading || nfcStoppingInProgress}
                className={`w-full font-medium py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 transition duration-150 ease-in-out flex items-center justify-center gap-2 ${nfcReading || nfcStoppingInProgress
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                  }`}
                style={{ fontFamily: "var(--paragraph-font)" }}
              >
                {nfcReading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Stop NFC Scanning
                  </>
                ) : nfcStoppingInProgress ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-5 w-5" />
                    Login with NFC
                  </>
                )}
              </button>
              <p
                className="text-center text-sm mt-2 text-gray-500"
                style={{ fontFamily: "var(--paragraph-font)" }}
              >
                {nfcReading
                  ? "Waiting for NFC card... Tap to cancel"
                  : nfcStoppingInProgress
                    ? "Stopping NFC scanner..."
                    : "Tap your NFC card to login instantly"}
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span
                className="px-2 bg-white text-gray-500"
                style={{ fontFamily: "var(--paragraph-font)" }}
              >
                Or login with email
              </span>
            </div>
          </div>

          {error && (
            <div
              className="bg-danger-light border border-danger text-danger px-4 py-3 rounded-md mb-4 flex items-center"
              style={{ fontFamily: "var(--paragraph-font)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{
                  fontFamily: "var(--paragraph-font)",
                  color: "var(--text-primary)",
                }}
              >
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                  placeholder="Enter your email"
                  style={{ fontFamily: "var(--paragraph-font)" }}
                />
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{
                  fontFamily: "var(--paragraph-font)",
                  color: "var(--text-primary)",
                }}
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                  placeholder="Enter your password"
                  style={{ fontFamily: "var(--paragraph-font)" }}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path
                        fillRule="evenodd"
                        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                        clipRule="evenodd"
                      />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm"
                  style={{
                    fontFamily: "var(--paragraph-font)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="text-primary hover:text-primary-dark transition-colors"
                  style={{ fontFamily: "var(--paragraph-font)" }}
                >
                  Forgot password?
                </Link>
              </div>
            </div> */}

            <div>
              <button
                type="submit"
                disabled={loading || nfcStoppingInProgress}
                className="w-full btn-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light transition duration-150 ease-in-out flex items-center justify-center gap-2"
                style={{ fontFamily: "var(--paragraph-font)" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Sign In
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Custom Carousel Section */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-4 md:p-0 md:pl-0 bg-indigo-50 rounded-lg md:rounded-none">
        <div className="w-full max-w-2xl relative">
          {/* Carousel container */}
          <div className="relative overflow-hidden rounded-lg shadow-lg h-[400px] sm:h-[500px]">
            {/* Carousel slides */}
            {carouselImages.map((image, index) => (
              <div
                key={index}
                className={`absolute top-0 left-0 w-full h-full transition-all duration-500 ease-in-out ${index === currentSlide
                    ? "opacity-100 z-10 translate-x-0"
                    : index < currentSlide
                      ? "opacity-0 z-0 -translate-x-full"
                      : "opacity-0 z-0 translate-x-full"
                  }`}
              >
                <img
                  src={image.src || "/placeholder.svg"}
                  alt={image.alt}
                  className="w-full h-[300px] sm:h-[400px] object-cover"
                  onError={(e) => {
                    e.target.src = "/api/placeholder/800/600";
                    e.target.onerror = null;
                  }}
                />
                <div className="p-4 bg-white">
                  <h3
                    className="text-lg sm:text-xl font-semibold"
                    style={{
                      fontFamily: "var(--header-font-second)",
                      color: "var(--primary-dark)",
                    }}
                  >
                    {image.title}
                  </h3>
                  <p
                    className="text-sm sm:text-base"
                    style={{
                      fontFamily: "var(--paragraph-font)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {image.description}
                  </p>
                </div>
              </div>
            ))}

            {/* Carousel navigation buttons */}
            <button
              onClick={prevSlide}
              className="absolute top-1/2 left-2 z-20 bg-white/80 hover:bg-white rounded-full p-1 sm:p-2 transform -translate-y-1/2 focus:outline-none transition-all duration-200 hover:scale-110"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute top-1/2 right-2 z-20 bg-white/80 hover:bg-white rounded-full p-1 sm:p-2 transform -translate-y-1/2 focus:outline-none transition-all duration-200 hover:scale-110"
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            </button>

            {/* Carousel indicators */}
            <div className="absolute bottom-20 left-0 right-0 z-20 flex justify-center space-x-2">
              {carouselImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full focus:outline-none transition-all duration-200 ${index === currentSlide
                      ? "bg-primary scale-125"
                      : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}