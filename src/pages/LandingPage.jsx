/**
 * LandingPage component that displays information about upcoming events, features, testimonials, and contact details.
 * @returns JSX element containing the landing page content.
 */

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Calendar, Users, Award, Bell, Clock, LogIn, Menu, X, ChevronRight, MapPin, Tag } from "lucide-react"
import logo from "../assets/next-gen-pemss-logo.png"
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore"
import { db } from "../firebase/config"
import user1 from "../assets/users/joserizal.jpg"
import user2 from "../assets/users/apolinariomabini.jpg"
import user3 from "../assets/users/emilioaguinaldo.jpg"

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navigate = useNavigate()
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Fetch upcoming events from Firebase
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Create a query to get only public events, ordered by date, limited to 3
        const eventsQuery = query(
          collection(db, "events"),
          where("isPublic", "==", true),
          orderBy("date", "asc"), // Use ascending to get upcoming events
          limit(3), // Limit to 3 events for the landing page
        )

        const querySnapshot = await getDocs(eventsQuery)
        const eventsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

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
            date: "May 15, 2023",
            time: "9:00 AM - 4:00 PM",
            location: "School Grounds",
            image: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 2,
            title: "Science Exhibition",
            date: "June 5, 2023",
            time: "10:00 AM - 2:00 PM",
            location: "School Auditorium",
            image: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 3,
            title: "Cultural Festival",
            date: "July 10, 2023",
            time: "5:00 PM - 9:00 PM",
            location: "School Amphitheater",
            image: "/placeholder.svg?height=200&width=300",
          },
        ])
      }
    }

    fetchEvents()
  }, [])

  const features = [
    {
      icon: <Calendar className="h-8 w-8 text-indigo-600 dark:text-indigo-800" />,
      title: "Event Scheduling",
      description: "Easily schedule and manage school events with our intuitive calendar interface.",
    },
    {
      icon: <Users className="h-8 w-8 text-indigo-600 dark:text-indigo-800" />,
      title: "Attendance Tracking",
      description: "Track student and staff attendance for each event with automated reporting.",
    },
    {
      icon: <Bell className="h-8 w-8 text-indigo-600 dark:text-indigo-800" />,
      title: "Notifications",
      description: "Send automated reminders and updates to participants about upcoming events.",
    },
    {
      icon: <Award className="h-8 w-8 text-indigo-600 dark:text-indigo-800" />,
      title: "Certificate Generation",
      description: "Generate and distribute certificates for event participants and winners.",
    },
  ]

  const testimonials = [
    {
      name: "Principal Jose Rizal",
      role: "School Principal",
      content:
        "This system has revolutionized how we manage school events. It's saved our administrative staff countless hours and improved communication with parents.",
      avatar: user1,
    },
    {
      name: "Apolinario Mabini",
      role: "History Teacher",
      content:
        "I can now organize events with half the effort. The automated notifications and attendance tracking are game-changers for our school.",
      avatar: user2,
    },
    {
      name: "Emilio Aguinaldo",
      role: "Student Council President",
      content:
        "Managing sports day used to be a nightmare. Now I can focus on the students instead of paperwork. Highly recommended!",
      avatar: user3,
    },
  ]

  // Event card skeleton for loading state
  const EventSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md animate-pulse">
      <div className="w-full h-48 bg-gray-200 dark:bg-gray-700"></div>
      <div className="p-6">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
        <div className="space-y-3">
          <div className="flex items-center">
            <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-4 w-4 mr-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
          <div className="flex items-center">
            <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-4 w-4 mr-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
          <div className="flex items-center">
            <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-4 w-4 mr-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center dark:border-gray-700 dark:bg-gray-300 dark:rounded-lg dark:m-1.5">
              <img src={logo || "/placeholder.svg"} className="w-15 h-15" alt="NextGen-Pemss Logo" />
              <span className="text-2xl font-bold text-indigo-600 logo-header">NextGen-Pemss</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-indigo-600 transition-colors">
                Features
              </a>
              <a href="#events" className="text-gray-700 hover:text-indigo-600 transition-colors">
                Events
              </a>
              <a href="#testimonials" className="text-gray-700 hover:text-indigo-600 transition-colors">
                Testimonials
              </a>
              <button
                onClick={() => navigate("/login")}
                className="btn-primary hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-700 hover:text-indigo-600 focus:outline-none"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className={`md:hidden bg-white pt-2 pb-4 px-4 mobile-menu ${isMenuOpen ? "open" : ""}`}>
          <div className="flex flex-col space-y-2">
            <a
              href="#features"
              className="text-gray-700 hover:text-indigo-600 transition-colors px-3 py-2 rounded-md"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#events"
              className="text-gray-700 hover:text-indigo-600 transition-colors px-3 py-2 rounded-md"
              onClick={() => setIsMenuOpen(false)}
            >
              Events
            </a>
            <a
              href="#testimonials"
              className="text-gray-700 hover:text-indigo-600 transition-colors px-3 py-2 rounded-md"
              onClick={() => setIsMenuOpen(false)}
            >
              Testimonials
            </a>
            <button
              onClick={() => navigate("/login")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-900 dark:to-purple-900 text-white dark:text-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
            <div className="md:w-2/3">
              <h1 className="text-3xl md:text-4xl font-extrabold mb-6 header">NFC-Enable Secure Online Attendance and Events Management System with Real-Time Notifications for Students and Teachers</h1>
              <p className="text-lg md:text-1xl mb-8 text-indigo-100 paragraph">
                NextGen-Pemss is a comprehensive event management system designed to simplify the planning and execution of school events. From scheduling to attendance tracking, we have you covered.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate("/login")}
                  className="bg-white text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  Get Started
                  <ChevronRight className="h-5 w-5" />
                </button>
                <a
                  href="#features"
                  className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-indigo-600 px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 h-16 bg-white"
            style={{ clipPath: "polygon(0 100%, 100% 100%, 100% 0)" }}
          ></div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Our event management system provides everything you need to run successful school events.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-gray-50 p-6 rounded-lg hover:shadow-md transition-shadow">
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="bg-indigo-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <p className="text-4xl font-bold text-indigo-600 mb-2">500+</p>
                <p className="text-gray-600">Events Managed</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-indigo-600 mb-2">50+</p>
                <p className="text-gray-600">Schools</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-indigo-600 mb-2">10,000+</p>
                <p className="text-gray-600">Students</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-indigo-600 mb-2">98%</p>
                <p className="text-gray-600">Satisfaction Rate</p>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Events Section */}
        <section id="events" className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Stay updated with the latest events happening at our school.
              </p>
            </div>

            {loading ? (
              // Loading state
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <EventSkeleton />
                <EventSkeleton />
                <EventSkeleton />
              </div>
            ) : error ? (
              // Error state
              <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg text-center">
                <p className="mb-2 font-semibold">Unable to load events</p>
                <p className="text-sm">Please check back later</p>
              </div>
            ) : upcomingEvents.length > 0 ? (
              // Events loaded successfully
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                  >
                    {event.image ? (
                      <img
                        src={event.image || "/placeholder.svg"}
                        alt={event.title}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                        <Calendar className="h-12 w-12 text-gray-300" />
                      </div>
                    )}
                    <div className="p-6">
                      {event.category && (
                        <div className="flex items-center mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            <Tag className="h-3 w-3 mr-1" />
                            {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                          </span>
                        </div>
                      )}
                      <h3 className="text-xl font-semibold mb-2 text-gray-900">{event.title}</h3>
                      <div className="flex items-center text-gray-600 mb-2">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center text-gray-600 mb-2">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{event.time}</span>
                      </div>
                      <div className="flex items-center text-gray-600 mb-4">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>{event.location}</span>
                      </div>
                      {event.description && <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>}
                      <Link to={`/events/${event.id}`}>
                        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md transition-colors">
                          View Details
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // No events found
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="flex flex-col items-center justify-center">
                  <Calendar className="h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Upcoming Events</h3>
                  <p className="text-gray-600 mb-6">
                    There are no public events scheduled at the moment. Check back soon!
                  </p>
                </div>
              </div>
            )}

            <div className="text-center mt-12">
              <Link to="/events">
                <button className="bg-white border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-md font-medium inline-flex items-center gap-2 transition-colors">
                  View All Events
                  <ChevronRight className="h-5 w-5" />
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-16 md:py-24 bg-indigo-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">What People Say</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Hear from our users about how our system has transformed their event management.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex items-center mb-4">
                    <img
                      src={testimonial.avatar || "/placeholder.svg"}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full mr-4 object-cover"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                      <p className="text-gray-600 text-sm">{testimonial.role}</p>
                    </div>
                  </div>
                  <p className="text-gray-700 italic">"{testimonial.content}"</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-indigo-600 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to simplify your school event management?</h2>
            <p className="text-xl text-indigo-100 mb-8 max-w-3xl mx-auto">
              Join hundreds of schools already using our platform to streamline their events.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="bg-white text-indigo-600 hover:bg-indigo-50 px-8 py-4 rounded-md font-medium text-lg inline-flex items-center gap-2 transition-colors"
            >
              Get Started Today
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">NextGen-Pemss</h3>
              <p className="text-gray-400">
                Simplifying school event management for administrators, teachers, and students.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#events" className="text-gray-400 hover:text-white transition-colors">
                    Events
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors">
                    Testimonials
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/docs" className="text-gray-400 hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link to="/help" className="text-gray-400 hover:text-white transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
              <p className="text-gray-400 mb-2">ICCT - Antipolo Campus, J. Sumulong Street</p>
              <p className="text-gray-400 mb-2">Antipolo, Rizal 1870</p>
              <p className="text-gray-400 mb-2">projectipt00@gmail.com</p>
              <p className="text-gray-400">(123) 456-7890</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

