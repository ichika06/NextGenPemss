import { useState, useEffect } from "react"
import {
  Calendar,
  Users,
  Award,
  Bell,
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Tag,
} from "lucide-react"
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore"
import { db } from "../firebase/config"
import logo from "../assets/next-gen-pemss-logo.svg"
import LoginModal from "./Login"
import bg_landing from "../assets/bglanding.jpg"

// Modal Components
function Modal({ isOpen, onClose, children, title }) {
  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop itself, not the modal content
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 backdrop-blur-xs backdrop-grayscale-300 flex items-center justify-center p-2 sm:p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg w-full max-w-xs xs:max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold truncate pr-2">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  )
}

function EventDetailsModal({ isOpen, onClose, event }) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  if (!event) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Event Details">
      <div className="space-y-4">
        <div className="relative w-full h-32 sm:h-40 md:h-48 rounded-lg overflow-hidden">
          <img
            src={event.image || "/placeholder.svg?height=200&width=300"}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2">{event.title}</h3>
          <p className="text-gray-600 mb-4 text-sm sm:text-base">{event.description || "Join us for this exciting event!"}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm sm:text-base">Date:</span>
              <span className="ml-2 text-sm sm:text-base break-words">{event.date}</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm sm:text-base">Time:</span>
              <span className="ml-2 text-sm sm:text-base break-words">{event.time}</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm sm:text-base">Location:</span>
              <span className="ml-2 text-sm sm:text-base break-words">{event.location}</span>
            </div>
          </div>
          {event.category && (
            <div className="flex items-start gap-3">
              <Tag className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-sm sm:text-base">Category:</span>
                <span className="ml-2 text-sm sm:text-base capitalize break-words">{event.category}</span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4">
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 sm:py-3 px-4 rounded-md transition-colors font-medium text-sm sm:text-base">
            Register for Event
          </button>
        </div>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />

      </div>
    </Modal>
  )
}

export default function LandingPage() {
  const [] = useState(false)
  const [currentEventIndex, setCurrentEventIndex] = useState(0)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [eventDetailsModalOpen, setEventDetailsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);



  // Fetch upcoming events from Firebase
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsQuery = query(
          collection(db, "events"),
          where("isPublic", "==", true),
          orderBy("createdAt", "desc"),
          limit(20),
        )

        const querySnapshot = await getDocs(eventsQuery)
        const eventsData = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((event) => event.image != null) // Filters out null and undefined

        setUpcomingEvents(eventsData)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching upcoming events:", err)
        setError("Failed to load events")
        setLoading(false)

        // Fallback to default events if there's an error
        setUpcomingEvents([
          {
            id: 1,
            title: "Annual Sports Day",
            date: "May 15, 2024",
            time: "9:00 AM - 4:00 PM",
            location: "School Grounds",
            image: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 2,
            title: "Science Exhibition",
            date: "June 5, 2024",
            time: "10:00 AM - 2:00 PM",
            location: "School Auditorium",
            image: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 3,
            title: "Cultural Festival",
            date: "July 10, 2024",
            time: "5:00 PM - 9:00 PM",
            location: "School Amphitheater",
            image: "/placeholder.svg?height=200&width=300",
          },
        ])
      }
    }

    fetchEvents()
  }, [])



  // Auto-rotate carousel
  useEffect(() => {
    if (upcomingEvents.length > 0) {
      const interval = setInterval(() => {
        setCurrentEventIndex((prevIndex) => (prevIndex === upcomingEvents.length - 1 ? 0 : prevIndex + 1))
      }, 4000)

      return () => clearInterval(interval)
    }
  }, [upcomingEvents.length])

  const nextEvent = () => {
    setCurrentEventIndex((prevIndex) => (prevIndex === upcomingEvents.length - 1 ? 0 : prevIndex + 1))
  }

  const prevEvent = () => {
    setCurrentEventIndex((prevIndex) => (prevIndex === 0 ? upcomingEvents.length - 1 : prevIndex - 1))
  }

  const handleEventClick = (event) => {
    setSelectedEvent(event)
    setEventDetailsModalOpen(true)
  }

  // TypewriterText component
  function TypewriterText({ text, speed = 50, pause = 2200 }) {
    const [displayed, setDisplayed] = useState("");
    const [typing, setTyping] = useState(true);

    useEffect(() => {
      let timeout;
      let i = 0;

      function type() {
        if (i <= text.length) {
          setDisplayed(text.slice(0, i));
          i++;
          timeout = setTimeout(type, speed);
        } else {
          timeout = setTimeout(() => {
            setTyping(false);
          }, pause);
        }
      }

      function erase() {
        if (i >= 0) {
          setDisplayed(text.slice(0, i));
          i--;
          timeout = setTimeout(erase, speed);
        } else {
          timeout = setTimeout(() => {
            setTyping(true);
          }, pause / 2);
        }
      }

      if (typing) {
        i = 0;
        type();
      } else {
        i = text.length;
        erase();
      }

      return () => clearTimeout(timeout);
    }, [text, speed, pause, typing]);

    return (
      <span>
        {displayed}
        <span className="animate-pulse">|</span>
      </span>
    );
  }

  const features = [
    {
      icon: <Calendar className="h-6 w-6 text-blue-600" />,
      title: "Event Scheduling",
      description: "Easily schedule and manage school events with our intuitive calendar interface.",
    },
    {
      icon: <Users className="h-6 w-6 text-blue-600" />,
      title: "Attendance Tracking",
      description: "Track student and staff attendance for each event with automated reporting.",
    },
    {
      icon: <Bell className="h-6 w-6 text-blue-600" />,
      title: "Notifications",
      description: "Send automated reminders and updates to participants about upcoming events.",
    },
    {
      icon: <Award className="h-6 w-6 text-blue-600" />,
      title: "Certificate Generation",
      description: "Generate and distribute certificates for event participants and winners.",
    },
  ]

  const currentEvent = upcomingEvents[currentEventIndex]



  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: `url(${bg_landing})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-xs backdrop-grayscale-50 z-0 pointer-events-none" />

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-2">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-[calc(100vh-12rem)] lg:min-h-[calc(100vh-8rem)]">
            {/* Left side - Main content and Features */}
            <div className="space-y-8">
              {/* Hero Content */}
              {window.innerWidth < 769 ? (
                <div className="flex flex-row justify-between items-center px-4">
                  <div className="flex items-center">
                    <img
                      src={logo || "/placeholder.svg"}
                      className="w-9 h-9 xs:w-10 xs:h-10 mr-2 rounded-full flex-shrink-0"
                      alt="NextGen-Pemss Logo"
                    />
                    <h1 className="text-xl xs:text-base sm:text-2xl font-extrabold text-blue-600 leading-tight whitespace-nowrap">
                      NextGen-Pemss
                    </h1>
                  </div>
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm rounded-md font-medium flex items-center gap-1 transition-colors shadow-lg hover:shadow-xl flex-shrink-0">
                    Login
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                // Desktop version (screens 768px and larger)
                <div className="text-center lg:text-left">
                  <div className="flex items-center justify-center lg:justify-start mb-6">
                    <img
                      src={logo || "/placeholder.svg"}
                      className="w-16 h-16 lg:w-20 lg:h-20 mr-4 rounded-full flex-shrink-0"
                      alt="NextGen-Pemss Logo"
                    />
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-blue-600 leading-tight">
                      <span className="lg:hidden">NextGen-Pemss</span>
                      <span className="hidden lg:inline">
                        <TypewriterText text="NextGen-Pemss" />
                      </span>
                    </h1>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    <button
                      onClick={() => setIsLoginModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors shadow-lg hover:shadow-xl">
                      Login
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="bg-white p-6 rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
                    <div className="mb-3">{feature.icon}</div>
                    <h3 className="text-lg font-semibold mb-2 text-gray-900">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Upcoming Events</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={prevEvent}
                      className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                      disabled={loading || upcomingEvents.length === 0}
                    >
                      <ChevronLeft className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                      onClick={nextEvent}
                      className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                      disabled={loading || upcomingEvents.length === 0}
                    >
                      <ChevronRight className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="animate-pulse">
                    <div className="w-full h-48 bg-gray-200 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">
                    <p className="mb-2 font-semibold">Unable to load events</p>
                    <p className="text-sm">Please check back later</p>
                  </div>
                ) : currentEvent ? (
                  <div className="transition-all duration-500 ease-in-out">
                    <div
                      className="relative w-full h-48 mb-4 rounded-lg overflow-hidden cursor-pointer group"
                      onClick={() => handleEventClick(currentEvent)}
                    >
                      <img
                        src={currentEvent.image || "/placeholder.svg?height=200&width=300"}
                        alt={currentEvent.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                    </div>
                    {currentEvent.category && (
                      <div className="flex items-center mb-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                          <Tag className="h-3 w-3 mr-1" />
                          {currentEvent.category.charAt(0).toUpperCase() + currentEvent.category.slice(1)}
                        </span>
                      </div>
                    )}
                    <h4
                      className="text-lg font-semibold mb-3 cursor-pointer hover:text-blue-600 transition-colors text-gray-900"
                      onClick={() => handleEventClick(currentEvent)}
                    >
                      {currentEvent.title}
                    </h4>
                    <div className="space-y-2 text-gray-600 text-sm mb-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <span>{currentEvent.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <span>{currentEvent.time}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <span>{currentEvent.location}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleEventClick(currentEvent)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors text-sm font-medium shadow-md hover:shadow-lg"
                    >
                      View Details
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 text-lg">No upcoming events</p>
                    <p className="text-gray-400 text-sm mt-1">Check back later for new events</p>
                  </div>
                )}

                {/* Carousel indicators */}
                {upcomingEvents.length > 0 && (
                  <div className="flex justify-center gap-2 mt-6 absolute left-1/2 -translate-x-1/2 bottom-5">
                    {upcomingEvents.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentEventIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${index === currentEventIndex ? "bg-blue-600" : "bg-gray-300"
                          }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-transparent py-4 flex-shrink-0 w-full relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm">&copy; {new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        </div>
      </footer>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <EventDetailsModal
        isOpen={eventDetailsModalOpen}
        onClose={() => setEventDetailsModalOpen(false)}
        event={selectedEvent}
      />
    </div>
  )
}