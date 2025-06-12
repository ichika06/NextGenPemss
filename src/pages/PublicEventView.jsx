import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  Globe,
  User,
  Lock,
  Radio,
  Share2,
  Heart,
  ChevronLeft,
  BellRing,
  QrCode,
  CalendarPlus,
  Eye,
} from "lucide-react";
import NFCRegistration from "../components/RegisterEvent/CurrentNFCRegistration";
import HardwareNFCScanner from "../components/RegisterEvent/HardwareRegistraion";
import QRCodeGenerator from "../components/RegisterEvent/QrcodeRegistraion";
import QRScannerModal from "../pages/student/EventQRCodeScanner";
import RegistrationOptionsModal from "../components/RegisterEvent/RegisterEventModal";
import CountdownDisplay from "../components/CountingDisplay";
import StudentPreRegistration from "../pages/student/StudentPreregistered";
import useFirestoreChecker from "../components/reuseChecker/FirestoreCheckerHook";

export default function PublicEventView() {
  const { eventId } = useParams();
  const { currentUser, currentUserData } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [showNFCRegistration, setShowNFCRegistration] = useState(false);
  const [showQRRegistration, setShowQRRegistration] = useState(false);
  const [showHardRegistration, setShowHardRegistration] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showRegistrationOptions, setShowRegistrationOptions] = useState(false);
  const [showPreRegistration, setShowPreRegistration] = useState(false); // New state for pre-registration modal
  const [selectedRegistrationOption, setSelectedRegistrationOption] =
    useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [userIsRegistered, setUserIsRegistered] = useState(false);

  const {
    loading: checkingFirestore,
    error: firestoreError,
    checkUserByNfcData,
    checkUserEventRegistration,
    checkEventAttendanceSheet,
  } = useFirestoreChecker();

  useEffect(() => {
    let unsubscribe;
    const fetchEventDetails = () => {
      try {
        setLoading(true);
        unsubscribe = onSnapshot(doc(db, "events", eventId), (eventDoc) => {
          if (!eventDoc.exists()) {
            setError("Event not found");
            setLoading(false);
            return;
          }

          const eventData = {
            id: eventDoc.id,
            ...eventDoc.data(),
          };
          setEvent(eventData);
          setLoading(false);
        });
      } catch (error) {
        console.error("Error fetching event:", error);
        setError("Failed to load event details");
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEventDetails();
    }

    // Cleanup the listener when the component unmounts or eventId changes
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [eventId]);

  // Track view when a user loads the event
  useEffect(() => {
    const trackEventView = async () => {
      if (!currentUser || !eventId || !event) return;

      try {
        const eventRef = doc(db, "events", eventId);
        const eventDoc = await getDoc(eventRef);

        if (eventDoc.exists()) {
          // Get existing views or initialize empty array
          const existingData = eventDoc.data();
          const views = existingData.views || [];

          // Only add the view if this user hasn't viewed this event before
          if (!views.includes(currentUser.email)) {
            // Update event document with the new view
            await updateDoc(eventRef, {
              views: arrayUnion(currentUser.email),
            });

            console.log(
              `Tracked view for ${currentUser.email} on event ${eventId}`
            );
          }
        }
      } catch (error) {
        console.error("Error tracking event view:", error);
      }
    };

    trackEventView();
  }, [currentUser, eventId, event]);

  // Fetch user role and pre-registration status when currentUser changes
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser || !eventId) {
        setUserRole(null);
        setIsPreRegistered(false);
        return;
      }

      try {
        // Fetch user role
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }

        // Check if user is pre-registered for this event
        const registrationId = `${currentUser.uid}_${eventId}`;
        const preRegDoc = await getDoc(
          doc(db, "usersPreRegistered", registrationId)
        );
        setIsPreRegistered(preRegDoc.exists());
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [currentUser, eventId]);

  const handleRegister = () => {
    setShowRegistrationOptions(true);
  };

  const handlePreRegister = () => {
    setShowPreRegistration(true);
  };

  const handlePreRegistrationSuccess = () => {
    setShowPreRegistration(false);
    setIsPreRegistered(true);
    // Optionally refresh event data to update counters
  };

  const handleRegistrationOptionSelect = (option) => {
    setShowRegistrationOptions(false);
    setSelectedRegistrationOption(option);

    // Handle different registration options
    switch (option) {
      case "hardware-nfc":
        setShowHardRegistration(true);
        break;
      case "device-nfc":
        // Current Device NFC Scanner logic
        setShowNFCRegistration(true);
        break;
      case "qr-code":
        setShowQRRegistration(true);
        break;
      default:
        break;
    }
  };

  const handleShowQRScanner = () => {
    setShowQRScanner(true); // Show QR scanner modal
  };

  // Close modal handlers
  const handleCloseHardModal = () => {
    setShowHardRegistration(false);
  };

  const handleCloseNFCModal = () => {
    setShowNFCRegistration(false);
  };

  const handleCloseQRModal = () => {
    setShowQRRegistration(false);
  };

  const handleCloseQRScannerModal = () => {
    setShowQRScanner(false);
  };

  const handleClosePreRegistrationModal = () => {
    setShowPreRegistration(false);
  };

  // Success handlers
  const handleNFCSuccess = () => {
    setShowNFCRegistration(false);
  };

  const handleQRScannerSuccess = (data) => {
    setShowQRScanner(false);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: event?.title,
          text: `Check out this event: ${event?.title}`,
          url: window.location.href,
        })
        .catch((error) => console.log("Error sharing", error));
    } else {
      // Fallback for browsers that don't support the Web Share API
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => alert("Link copied to clipboard!"))
        .catch((err) => console.error("Could not copy text: ", err));
    }
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // Here you would typically save this to the user's profile in your database
  };

  // Check if current user is an authorized registrar
  const isAuthorizedRegistrar = () => {
    // Allow if user is a super admin
    if (currentUserData.role === "admin" && currentUserData.accessLevel === "super") return true;
    
    if (!currentUser || !event) return false;
    // Allow if user is the event registrar
    if (currentUser.uid === event.registrarId) return true;
    
    return false;
  };

  // Check if current user is a student
  const isStudent = () => {
    return userRole === "student";
  };

  // const isExpired = () => {
  //   if (!event || !event.date) return false;
  //   const currentDate = new Date();
  //   const eventDate = new Date(event.date);
  //   return eventDate < currentDate;
  // };

  const isExpired = () => {
  if (!event || !event.date || !event.time) return false;
  
  try {
    const currentDate = new Date();
    
    // Parse the event date
    const [year, month, day] = event.date.split('-').map(Number);
    
    // Parse the event time (handle both 12-hour and 24-hour formats)
    let eventHour, eventMinute;
    const timeStr = event.time.toLowerCase().trim();
    
    if (timeStr.includes('pm') || timeStr.includes('am')) {
      // 12-hour format
      const [time, period] = timeStr.split(/\s*(am|pm)\s*/);
      const [hourStr, minuteStr = '0'] = time.split(':');
      
      eventHour = parseInt(hourStr);
      eventMinute = parseInt(minuteStr);
      
      // Convert to 24-hour format
      if (period === 'pm' && eventHour !== 12) {
        eventHour += 12;
      } else if (period === 'am' && eventHour === 12) {
        eventHour = 0;
      }
    } else {
      // 24-hour format
      const [hourStr, minuteStr = '0'] = timeStr.split(':');
      eventHour = parseInt(hourStr);
      eventMinute = parseInt(minuteStr);
    }
    
    // Create event date object
    const eventDateTime = new Date(year, month - 1, day, eventHour, eventMinute);
    
    // Compare current time with event date/time
    return currentDate > eventDateTime;
  } catch (error) {
    console.error('Error checking if event is expired:', error);
    return false;
  }
};

  const isLive = () => {
    return event.isLive === false;
  };

  const checkIfUserIsRegistered = async () => {
    if (!currentUser || !currentUserData || !eventId) {
      return false;
    }

    try {
      const result = await checkUserEventRegistration(
        currentUserData.email,
        eventId
      );
      setUserIsRegistered(result.isRegistered);
      return result.isRegistered;
    } catch (error) {
      console.error("Error checking registration status:", error);
      return false;
    }
  };

  // Add useEffect to check registration status when component loads
  useEffect(() => {
    if (currentUser && currentUserData && eventId) {
      checkIfUserIsRegistered();
    }
  }, [currentUser, currentUserData, eventId]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">{/* Skeleton UI */}</div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">{/* Error UI */}</div>
    );
  }

  if (!event) return null;

  // Calculate if event is full or almost full
  const isFull = event.attendees >= event.capacity;
  const isAlmostFull = event.attendees >= event.capacity * 0.8 && !isFull;

  // Format date for better display
  const formatDate = (dateString) => {
    try {
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      return dateString;
    }
  };

  const backtolast = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.close();
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <button
        onClick={backtolast}
        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 shadow-2xl  text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-2.5"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to List events
      </button>

      <div className="bg-white rounded-lg  shadow-md overflow-hidden border border-gray-200">
        {/* Event header image section */}
        {event.image ? (
          <div className="relative h-72 md:h-96 overflow-hidden">
            <img
              src={event.image || "/placeholder.svg"}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 dark:from-white/60 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/80 text-white backdrop-blur-sm">
                  <Tag className="h-3 w-3 mr-1" />
                  {event.category.charAt(0).toUpperCase() +
                    event.category.slice(1)}
                </span>

                {event.isPublic ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/80 text-white backdrop-blur-sm">
                    <Globe className="h-3 w-3 mr-1" />
                    Public Event
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/80 text-white backdrop-blur-sm">
                    <Lock className="h-3 w-3 mr-1" />
                    Private Event
                  </span>
                )}

                {event.isLive ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                    <Radio className="h-3 w-3 mr-1" />
                    Live access
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <Radio className="h-3 w-3 mr-1" />
                    Hide
                  </span>
                )}

                {isFull && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/80 text-white backdrop-blur-sm">
                    Fully Booked
                  </span>
                )}

                {isAlmostFull && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/80 text-white backdrop-blur-sm">
                    Almost Full
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold dark:text-gray-900 text-white mb-2 drop-shadow-sm">
                {event.title}
              </h1>
            </div>
          </div>
        ) : (
          <div className="p-6 pt-8">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                <Tag className="h-3 w-3 mr-1" />
                {event.category.charAt(0).toUpperCase() +
                  event.category.slice(1)}
              </span>

              {event.isPublic ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Globe className="h-3 w-3 mr-1" />
                  Public Event
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  <Lock className="h-3 w-3 mr-1" />
                  Private Event
                </span>
              )}

              {event.isLive ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                  <Radio className="h-3 w-3 mr-1" />
                  Live access
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  <Radio className="h-3 w-3 mr-1" />
                  Hide
                </span>
              )}

              {isFull && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Fully Booked
                </span>
              )}

              {isAlmostFull && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  Almost Full
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
              {event.title}
            </h1>
          </div>
        )}

        <div className="p-6 pt-0">
          {/* Event details section */}
          <div className="flex flex-wrap justify-between items-center mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 w-full">
              <div className="flex items-center text-gray-700">
                <div className="bg-indigo-50 p-2 rounded-full mr-3">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Date</div>
                  <div>{formatDate(event.date)}</div>
                </div>
              </div>

              <div className="flex items-center text-gray-700">
                <div className="bg-indigo-50 p-2 rounded-full mr-3">
                  <Clock className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Time</div>
                  <div>{event.time}</div>
                </div>
              </div>

              <div className="flex items-center text-gray-700">
                <div className="bg-indigo-50 p-2 rounded-full mr-3">
                  <MapPin className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Location</div>
                  <div>{event.location}</div>
                </div>
              </div>

              <div className="flex items-center text-gray-700">
                <div className="bg-indigo-50 p-2 rounded-full mr-3">
                  <BellRing className="h-5 w-5 text-indigo-600" />
                </div>

                <div>
                  <div className="text-sm text-gray-500">Remaining</div>
                  <CountdownDisplay
                    eventId={event.id}
                    eventDate={event.date}
                    eventTime={event.time}
                    eventTitle={event.title}
                    totalCapacity ={event.capacity}
                    showSeconds={true}
                    expiredText="Not Available"
                    eventAnalytics={{
                      registrations: event.attendees,
                      views: event.views || [],
                    }}
                    db={db}
                  />
                </div>
              </div>

              <div className="flex items-center text-gray-700">
                <div
                  className={`p-2 rounded-full mr-3 ${isFull
                      ? "bg-red-50"
                      : isAlmostFull
                        ? "bg-amber-50"
                        : "bg-green-50"
                    }`}
                >
                  <Users
                    className={`h-5 w-5 ${isFull
                        ? "text-red-600"
                        : isAlmostFull
                          ? "text-amber-600"
                          : "text-green-600"
                      }`}
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Capacity</div>
                  <div className={isFull ? "text-red-600 font-medium" : ""}>
                    {event.attendees || 0} / {event.capacity} attendees
                    {isFull && " (Fully Booked)"}
                  </div>
                </div>
              </div>

              {/* Add pre-registered count if available */}
              {event.preRegisteredCount > 0 && (
                <div className="flex items-center text-gray-700">
                  <div className="bg-purple-50 p-2 rounded-full mr-3">
                    <CalendarPlus className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Pre-Registered</div>
                    <div>{event.preRegisteredCount || 0} students</div>
                  </div>
                </div>
              )}

              {/* Display view count if available */}
              {event.views && event.views.length > 0 && (
                <div className="flex items-center text-gray-700">
                  <div className="bg-blue-50 p-2 rounded-full mr-3">
                    <Eye className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Views</div>
                    <div>{event.views.length} viewers</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
              About This Event
              <div className="h-px bg-gray-200 flex-grow ml-4"></div>
            </h2>
            <div className="prose max-w-none text-gray-600">
              <p className="whitespace-pre-line">{event.description}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
              Event Host
              <div className="h-px bg-gray-200 flex-grow ml-4"></div>
            </h2>
            <div className="flex items-center">
              <div className="bg-indigo-50 p-2 rounded-full mr-3">
                <User className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <div className="font-medium dark:text-gray-900 ">
                  {event.registrarName || "Event Organizer"}
                </div>
                {event.registrarEmail && (
                  <div className="text-sm text-gray-500">
                    {event.registrarEmail}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <div className="flex gap-3">
              {/* Share and favorite buttons */}
              <button
                onClick={handleShare}
                className="p-3 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                aria-label="Share event"
              >
                <Share2 className="h-5 w-5" />
              </button>

              <button
                onClick={toggleFavorite}
                className={`p-3 rounded-md border transition-colors ${isFavorite
                    ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                    : "border-gray-200 hover:bg-gray-50 text-gray-600"
                  }`}
                aria-label={
                  isFavorite ? "Remove from favorites" : "Add to favorites"
                }
              >
                <Heart
                  className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Registration section */}
          {isFull && (
            <div className="mt-4 bg-red-50 border border-red-100 rounded-md p-4 text-center text-red-700">
              This event is fully booked. Please check back later or browse
              other events.
            </div>
          )}

          {!isAuthorizedRegistrar() && currentUser && !isStudent() && (
            <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-md p-4 text-center text-yellow-700">
              If you are curious, please ask the Owner {event.registrarName}{" "}
              about the details
            </div>
          )}

          {/* Pre-registration notification for students */}
          {isPreRegistered && (
            <div className="mt-4 bg-green-50 border border-green-100 rounded-md p-4 text-center text-green-700 flex items-center justify-center">
              <CalendarPlus className="h-5 w-5 mr-2" />
              You're pre-registered for this event! Please arrive on time.
            </div>
          )}

          {showRegistrationOptions && (
            <RegistrationOptionsModal
              eventId={eventId}
              onClose={() => setShowRegistrationOptions(false)}
              onSelectOption={handleRegistrationOptionSelect}
            />
          )}

          {showHardRegistration && (
            <div className="w-full container mx-auto p-6 max-w-4xl">
              <HardwareNFCScanner
                eventId={eventId}
                onClose={handleCloseHardModal}
                onSuccess={handleNFCSuccess}
              />
            </div>
          )}

          {showNFCRegistration && (
            <div className="w-full container mx-auto p-6 max-w-4xl">
              <NFCRegistration
                eventId={eventId}
                onClose={handleCloseNFCModal}
                onSuccess={handleNFCSuccess}
              />
            </div>
          )}

          {showQRRegistration && (
            <div className="w-full container mx-auto p-6 max-w-4xl">
              <QRCodeGenerator
                eventId={eventId}
                onClose={handleCloseQRModal}
                onSuccess={handleNFCSuccess}
              />
            </div>
          )}

          {/* StudentPreRegistration modal */}
          {showPreRegistration && (
            <div className="fixed inset-0 backdrop-blur-xs backdrop-grayscale-150 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md">
                <StudentPreRegistration
                  eventId={eventId}
                  onClose={handleClosePreRegistrationModal}
                  onSuccess={handlePreRegistrationSuccess}
                />
              </div>
            </div>
          )}

          {/* QR Scanner modal */}
          <QRScannerModal
            isOpen={showQRScanner}
            onClose={handleCloseQRScannerModal}
            onRegister={handleQRScannerSuccess}
          />

          {/* Registration button for authorized registrars */}
          {!isFull && isAuthorizedRegistrar() && !isLive() && (
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRegister}
                disabled={isFull}
                className={`flex-1 py-3 px-6 rounded-md font-medium transition-colors flex justify-center items-center ${isFull
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
              >
                {isFull ? "Event Full" : "Register Attendee"}
              </button>
            </div>
          )}

          {/* Button options for students */}
          {!isFull &&
            currentUser &&
            isStudent() &&
            !isExpired() &&
            !isLive() && (
              <div className="mt-6 grid grid-cols-1 gap-3">
                {/* QR Code Registration button - only show if not registered */}
                {!userIsRegistered && (
                  <button
                    onClick={handleShowQRScanner}
                    className="w-full py-3 px-6 rounded-md font-medium transition-colors flex justify-center items-center bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <QrCode className="h-5 w-5 mr-2" />
                    Register via QR Code
                  </button>
                )}

                {/* Pre-registration button - only show if not already pre-registered and not registered */}
                {!isPreRegistered && !userIsRegistered && (
                  <button
                    onClick={handlePreRegister}
                    className="w-full py-3 px-6 rounded-md font-medium transition-colors flex justify-center items-center bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <CalendarPlus className="h-5 w-5 mr-2" />
                    Pre-Register for Event
                  </button>
                )}

                {/* Show message if already registered */}
                {userIsRegistered && (
                  <div className="mt-4 bg-green-50 border border-green-100 rounded-md p-4 text-center text-green-700 flex items-center justify-center">
                    <BellRing className="h-5 w-5 mr-2" />
                    You're already registered for this event!
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}