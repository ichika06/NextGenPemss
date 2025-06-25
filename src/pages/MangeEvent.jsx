import { useState, useEffect, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, onSnapshot, orderBy } from "firebase/firestore"
import { db } from "../firebase/config"
import { useAuth } from "../contexts/AuthContext"
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Eye,
  Edit,
  Trash2,
  Lock,
  Globe,
  BellRing,
  Plus,
  AlertCircle,
  Search,
  Filter,
  X,
  CalendarIcon as CalendarCog,
  Pencil,
  Wifi,
  WifiOff,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  RefreshCw,
} from "lucide-react"
import { LoadingAnimation } from "../components/LoadingAnimation"
import CountdownDisplay from "../components/CountingDisplay"
import { useAlert } from "../components/AlertProvider"
import { useOptimizedIndexedDBCache } from "../components/useIndexedDBCache"
import CachePermissionToast from "../components/CachePermissionToast"

export default function OptimizedManageEvent() {
  const { currentUser, userRole, currentUserData } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [backgroundSyncing, setBackgroundSyncing] = useState(false)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all")
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("dateCreated")
  const [sortOrder, setSortOrder] = useState("desc")
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const { showAlert } = useAlert()
  const [, setIsOnline] = useState(navigator.onLine)
  const [, setDataSource] = useState("network")
  const [lastUpdated, setLastUpdated] = useState(null)
  const [cacheInfo, setCacheInfo] = useState({ fromCache: false, isExpired: false })

  const { setCachePermissionStatus, fetchWithCache } =
    useOptimizedIndexedDBCache()

  // Enhanced sort options
  const sortOptions = [
    { value: "dateCreated", label: "Latest created", defaultOrder: "desc" },
    { value: "Upcomingevents", label: "Upcoming events", defaultOrder: "asc" },
    { value: "alphabetical", label: "Alphabetical", defaultOrder: "asc" },
    { value: "attendees", label: "Attendees", defaultOrder: "desc" },
    { value: "finishedEvents", label: "Finished events", defaultOrder: "desc" },
    { value: "activeEvents", label: "Active events", defaultOrder: "asc" },
  ]

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Helper functions (keeping your existing ones)
  const isEventFinished = (event) => {
    const now = new Date()
    const eventDate = new Date(event.date)
    const midnightAfterEvent = new Date(eventDate)
    midnightAfterEvent.setDate(eventDate.getDate() + 1)
    midnightAfterEvent.setHours(0, 0, 0, 0)
    return now >= midnightAfterEvent
  }

  const isEventActive = (event) => {
    const eventDateTime = new Date(`${event.date} ${event.time}`)
    const now = new Date()
    return eventDateTime >= now
  }

  const isEventCurrentlyActive = (event) => {
    const eventDateTime = new Date(`${event.date} ${event.time}`)
    const now = new Date()
    const eventDate = new Date(event.date)
    const midnightAfterEvent = new Date(eventDate)
    midnightAfterEvent.setDate(eventDate.getDate() + 1)
    midnightAfterEvent.setHours(0, 0, 0, 0)
    return eventDateTime <= now && now < midnightAfterEvent
  }

  // Optimized fetch function with better batching
  const fetchEventsFromFirestore = useCallback(async () => {
    return new Promise((resolve, reject) => {
      if (!currentUser) {
        navigate("/login")
        return
      }

      const eventsRef = collection(db, "events")
      let eventsQuery

      // Build query based on user role
      if (currentUserData?.role === "admin" && currentUserData?.accessLevel === "super") {
        try {
          eventsQuery = query(eventsRef, orderBy("createdAt", "desc"))
        } catch (error) {
          console.log("createdAt field not available for ordering, using default order")
          eventsQuery = query(eventsRef)
        }
      } else {
        try {
          eventsQuery = query(eventsRef, where("registrarId", "==", currentUser.uid), orderBy("createdAt", "desc"))
        } catch (error) {
          console.log("createdAt field not available for ordering, using default order")
          eventsQuery = query(eventsRef, where("registrarId", "==", currentUser.uid))
        }
      }

      const unsubscribe = onSnapshot(
        eventsQuery,
        async (querySnapshot) => {
          try {
            const eventsData = querySnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))

            // Filter events that user can view
            const canViewEvent = () => true
            const viewableEvents = eventsData.filter((eventData) => {
              if (typeof canViewEvent === "function") {
                return canViewEvent(eventData)
              }
              return true
            })

            // Batch fetch attendee counts and documents
            const [attendeeCounts, documentsData] = await Promise.all([
              Promise.all(
                viewableEvents.map(async (eventData) => {
                  const attendeesRef = collection(db, "eventAttendees")
                  const attendeesQuery = query(attendeesRef, where("eventId", "==", eventData.id))
                  const attendeesSnapshot = await getDocs(attendeesQuery)
                  return { eventId: eventData.id, attendeeCount: attendeesSnapshot.size }
                }),
              ),
              Promise.all(
                viewableEvents.map(async (eventData) => {
                  const docsRef = collection(db, "eventDocuments")
                  const docsQuery = query(docsRef, where("eventId", "==", eventData.id))
                  const docsSnapshot = await getDocs(docsQuery)
                  return {
                    eventId: eventData.id,
                    documents: docsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
                  }
                }),
              ),
            ])

            // Create lookup maps
            const attendeeMap = new Map(attendeeCounts.map((item) => [item.eventId, item.attendeeCount]))
            const documentsMap = new Map(documentsData.map((item) => [item.eventId, item.documents]))

            // Build final events list
            const eventsList = viewableEvents.map((eventData) => ({
              ...eventData,
              attendeeCount: attendeeMap.get(eventData.id) || 0,
              documents: documentsMap.get(eventData.id) || [],
              isLive: eventData.isLive || false,
            }))

            resolve(eventsList)
            unsubscribe()
          } catch (error) {
            console.error("Error processing events data:", error)
            reject(error)
            unsubscribe()
          }
        },
        (error) => {
          console.error("Error fetching events:", error)
          reject(error)
          unsubscribe()
        },
      )
    })
  }, [currentUser, currentUserData, navigate])

  // Callback for when cached data is available
  const handleCacheData = useCallback((cachedEvents, metadata) => {
    console.log("Loading cached data immediately...")
    setEvents(cachedEvents)
    setDataSource("cache")
    setLastUpdated(metadata.lastUpdate)
    setCacheInfo({ fromCache: true, isExpired: metadata.isExpired })
    setInitialLoading(false)
    setLoading(false)
  }, [])

  // Callback for when network data is available
  const handleNetworkData = useCallback((networkEvents, metadata) => {
    console.log("Network data received:", metadata.fromBackground ? "background" : "foreground")

    if (metadata.fromBackground) {
      setBackgroundSyncing(false)
      // Only update if data is different to avoid unnecessary re-renders
      setEvents((prevEvents) => {
        const eventsChanged = JSON.stringify(prevEvents) !== JSON.stringify(networkEvents)
        return eventsChanged ? networkEvents : prevEvents
      })
    } else {
      setEvents(networkEvents)
      setInitialLoading(false)
    }

    setDataSource("network")
    setLastUpdated(Date.now())
    setCacheInfo({ fromCache: false, isExpired: false })
    setLoading(false)
  }, [])

  // Optimized load events function
  const loadEvents = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && !initialLoading) {
        setLoading(true)
      }
      setError("")
      setBackgroundSyncing(!forceRefresh)

      try {
        const result = await fetchWithCache(fetchEventsFromFirestore, {
          forceRefresh,
          saveToCache: true,
          cacheFirst: !forceRefresh,
          onCacheData: handleCacheData,
          onNetworkData: handleNetworkData,
        })

        // Handle the case where no callbacks were called (no cache, direct network)
        if (!result.fromCache && !result.backgroundSyncScheduled) {
          setEvents(result.data || [])
          setDataSource("network")
          setLastUpdated(result.lastUpdate)
          setCacheInfo({ fromCache: false, isExpired: false })
          setInitialLoading(false)
          setLoading(false)
        }

        if (result.networkError) {
          console.warn("Using cached data due to network error:", result.networkError)
          setDataSource("offline")
        }
      } catch (error) {
        console.error("Error loading events:", error)
        setError("Failed to load events")
        setDataSource("offline")
        setInitialLoading(false)
        setLoading(false)
      } finally {
        setBackgroundSyncing(false)
      }
    },
    [fetchWithCache, fetchEventsFromFirestore, handleCacheData, handleNetworkData, initialLoading],
  )

  // Handle cache permission
  const handleCachePermission = useCallback(
    (granted) => {
      setCachePermissionStatus(granted)
      if (granted) {
        loadEvents(false)
      }
    },
    [setCachePermissionStatus, loadEvents],
  )

  // Initial load
  useEffect(() => {
    if (currentUser && currentUserData) {
      loadEvents(false)
    }
  }, [currentUser, currentUserData, loadEvents])

  // Your existing sort function (keeping it as is)
  const sortEvents = (eventsToSort) => {
    return [...eventsToSort].sort((a, b) => {
      let aValue, bValue
      const aIsActiveEvent = isEventCurrentlyActive(a)
      const bIsActiveEvent = isEventCurrentlyActive(b)
      const aIsFinished = isEventFinished(a)
      const bIsFinished = isEventFinished(b)
      const aIsActive = isEventActive(a)
      const bIsActive = isEventActive(b)

      switch (sortBy) {
        case "dateCreated":
          aValue = new Date(a.createdAt?.toDate?.() || a.createdAt || 0)
          bValue = new Date(b.createdAt?.toDate?.() || b.createdAt || 0)
          break

        case "Upcomingevents":
          if (aIsActive && !bIsActive) return -1
          if (!aIsActive && bIsActive) return 1

          const aEventDate = new Date(`${a.date} ${a.time}`)
          const bEventDate = new Date(`${b.date} ${b.time}`)

          if (aIsActive && bIsActive) {
            return sortOrder === "asc" ? aEventDate - bEventDate : bEventDate - aEventDate
          } else {
            return sortOrder === "asc" ? bEventDate - aEventDate : aEventDate - bEventDate
          }

        case "activeEvents":
          if (aIsActiveEvent && !bIsActiveEvent) return -1
          if (!aIsActiveEvent && bIsActiveEvent) return 1

          if (aIsActiveEvent && bIsActiveEvent) {
            const aEventTime = new Date(`${a.date} ${a.time}`)
            const bEventTime = new Date(`${b.date} ${b.time}`)
            return aEventTime - bEventTime
          }

          if (aIsFinished && !bIsFinished) return 1
          if (!aIsFinished && bIsFinished) return -1

          const aEventDateTime = new Date(`${a.date} ${a.time}`)
          const bEventDateTime = new Date(`${b.date} ${b.time}`)

          if (!aIsFinished && !bIsFinished) {
            return aEventDateTime - bEventDateTime
          } else {
            return bEventDateTime - aEventDateTime
          }

        case "alphabetical":
          aValue = a.title?.toLowerCase() || ""
          bValue = b.title?.toLowerCase() || ""
          break

        case "attendees":
          aValue = a.attendeeCount || 0
          bValue = b.attendeeCount || 0
          break

        case "finishedEvents":
          if (aIsFinished && !bIsFinished) return -1
          if (!aIsFinished && bIsFinished) return 1

          const aFinishDate = new Date(`${a.date} ${a.time}`)
          const bFinishDate = new Date(`${b.date} ${b.time}`)

          if (aIsFinished && bIsFinished) {
            return sortOrder === "desc" ? bFinishDate - aFinishDate : aFinishDate - bFinishDate
          } else {
            return aFinishDate - bFinishDate
          }

        default:
          return 0
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
  }

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(newSortBy)
      const option = sortOptions.find((opt) => opt.value === newSortBy)
      setSortOrder(option ? option.defaultOrder : "desc")
    }
    setShowSortDropdown(false)
  }

  // Filter and search events
  const filteredEvents = sortEvents(
    events.filter((event) => {
      const visibilityMatch = filter === "all" ? true : filter === "public" ? event.isPublic : !event.isPublic
      const searchMatch =
        searchQuery === ""
          ? true
          : event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.location?.toLowerCase().includes(searchQuery.toLowerCase())
      return visibilityMatch && searchMatch
    }),
  )

  // Your existing event handlers (keeping them as is)
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return

    try {
      setLoading(true)

      const docsRef = collection(db, "eventDocuments")
      const docsQuery = query(docsRef, where("eventId", "==", selectedEvent.id))
      const docsSnapshot = await getDocs(docsQuery)

      const deletePromises = docsSnapshot.docs.map((doc) => deleteDoc(doc.ref))
      await Promise.all(deletePromises)

      await deleteDoc(doc(db, "eventPermissions", selectedEvent.id))
      await deleteDoc(doc(db, "events", selectedEvent.id))

      setEvents((prevEvents) => prevEvents.filter((event) => event.id !== selectedEvent.id))
      setShowDeleteModal(false)
      setSelectedEvent(null)
    } catch (err) {
      console.error("Error deleting event:", err)
      setError("Failed to delete event. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const toggleEventVisibility = async (event) => {
    try {
      setLoading(true)
      const newIsPublic = !event.isPublic

      await updateDoc(doc(db, "events", event.id), { isPublic: newIsPublic })
      await updateDoc(doc(db, "eventPermissions", event.id), {
        isPublic: newIsPublic,
        viewers: newIsPublic ? ["*"] : [currentUser.uid],
      })

      const docsRef = collection(db, "eventDocuments")
      const docsQuery = query(docsRef, where("eventId", "==", event.id))
      const docsSnapshot = await getDocs(docsQuery)

      const updatePromises = docsSnapshot.docs.map((doc) => updateDoc(doc.ref, { isPublic: newIsPublic }))
      await Promise.all(updatePromises)

      showAlert({
        icon: "success",
        header: "Change Public event",
        description: newIsPublic ? "Event is now in Public event" : "Event is remove in Public event",
        variant: "success",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#086d3f",
        descriptionColor: "#086d3f",
        borderColor: "#086d3f",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })

      setEvents((prevEvents) => prevEvents.map((e) => (e.id === event.id ? { ...e, isPublic: newIsPublic } : e)))
    } catch (err) {
      console.error("Error updating event visibility:", err)
      setError("Failed to update event visibility.")
    } finally {
      setLoading(false)
    }
  }

  const toggleEventLiveStatus = async (event) => {
    try {
      setLoading(true)
      const newIsLive = !event.isLive

      await updateDoc(doc(db, "events", event.id), { isLive: newIsLive })

      showAlert({
        icon: "success",
        header: "Change live event",
        description: newIsLive ? "Event can now accept registraion" : "Event will not accept registration",
        variant: "success",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#086d3f",
        descriptionColor: "#086d3f",
        borderColor: "#086d3f",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })

      setEvents((prevEvents) => prevEvents.map((e) => (e.id === event.id ? { ...e, isLive: newIsLive } : e)))
    } catch (err) {
      console.error("Error updating event live status:", err)
      showAlert({
        icon: "error",
        header: "Changin Live properties",
        description: "Getting an erro while changing the event live property",
        variant: "error",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#36b37e",
        descriptionColor: "#36b37e",
        borderColor: "#36b37e",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewPrivateEvent = (event) => {
    const eventDetailsURL = `/stream-event-details/${event.id}`
    window.open(eventDetailsURL, "_blank")
  }

  const handleRegisterPrivateEvent = (event) => {
    const eventDetailsURL = `/events/${event.id}`
    window.open(eventDetailsURL, "_blank")
  }

  const getEventStatus = (event) => {
    const eventDateTime = new Date(`${event.date} ${event.time}`)
    const today = new Date()
    const eventDate = new Date(event.date)
    const midnightAfterEvent = new Date(eventDate)
    midnightAfterEvent.setDate(eventDate.getDate() + 1)
    midnightAfterEvent.setHours(0, 0, 0, 0)

    if (today >= midnightAfterEvent) {
      return { label: "Finished", color: "bg-gray-100 text-gray-700" }
    }

    if (eventDateTime < today) {
      return { label: "Active", color: "bg-emerald-100 text-emerald-700" }
    }

    if (event.attendeeCount >= event.capacity) {
      return { label: "Full", color: "bg-amber-100 text-amber-700" }
    }

    return { label: "Upcoming", color: "bg-blue-50 text-blue-700" }
  }

  const getSortIcon = () => {
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const getCurrentSortLabel = () => {
    const option = sortOptions.find((opt) => opt.value === sortBy)
    return option ? option.label : "Latest Created"
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".sort-dropdown")) {
        setShowSortDropdown(false)
      }
    }

    if (showSortDropdown) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [showSortDropdown])

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-gray-50 dark:bg-zinc-900 min-h-screen">
      {/* Cache Permission Toast */}
      <CachePermissionToast onPermissionSet={handleCachePermission} autoShow={true} position="top-right" />

      <div className="flex flex-col sm:mr-11 sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <CalendarCog className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-zinc-100">Manage Events</h1>
          </div>
          <p className="text-gray-500 dark:text-zinc-300 text-sm sm:text-base">View, Edit, and Manage your events</p>

          {/* Enhanced status info */}
          {/** Show status info for 10 seconds after mount or update */}
          {(() => {
            const [showStatusInfo, setShowStatusInfo] = useState(true);

            useEffect(() => {
              setShowStatusInfo(true);
              const timer = setTimeout(() => setShowStatusInfo(false), 5000);
              return () => clearTimeout(timer);
            }, [lastUpdated, cacheInfo, backgroundSyncing]);

            return showStatusInfo ? (
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                {lastUpdated && (
                  <div className="text-gray-500">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                  </div>
                )}
                {cacheInfo.fromCache && (
                  <div
                    className={`px-2 py-1 rounded-full ${cacheInfo.isExpired
                        ? "bg-orange-100 text-orange-800"
                        : "bg-blue-100 text-blue-800"
                      }`}
                  >
                    {cacheInfo.isExpired ? "Cached (Expired)" : "Cached Data"}
                  </div>
                )}
                {backgroundSyncing && (
                  <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-green-100 text-green-800">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Syncing...</span>
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>

        <button
          onClick={() => navigate(`/${userRole}/create-event`)}
          className="btn-primary text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150 ease-in-out flex items-center"
        >
          <Plus className="h-5 w-5 mr-1.5" /> Create New Event
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-500 dark:border-red-700 text-red-700 dark:text-red-200 p-4 rounded-lg mb-6 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
          <button onClick={() => setError("")} className="ml-auto text-red-500 dark:text-red-200 hover:text-red-700 dark:hover:text-red-100">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex flex-col gap-4">
            {/* Search and Filter Row */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="relative w-full sm:w-64 md:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 dark:text-zinc-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full py-2 px-4 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <X className="h-4 w-4 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium transition-colors ${filter === "all"
                      ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700"
                      : "bg-gray-100 dark:bg-zinc-900 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700"
                    }`}
                >
                  <Filter className="h-4 w-4 mr-1.5" /> All Events
                </button>
                <button
                  onClick={() => setFilter("public")}
                  className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium transition-colors ${filter === "public"
                      ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700"
                      : "bg-gray-100 dark:bg-zinc-900 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700"
                    }`}
                >
                  <Globe className="h-4 w-4 mr-1.5" /> Public
                </button>
                <button
                  onClick={() => setFilter("private")}
                  className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium transition-colors ${filter === "private"
                      ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700"
                      : "bg-gray-100 dark:bg-zinc-900 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700"
                    }`}
                >
                  <Lock className="h-4 w-4 mr-1.5" /> Private
                </button>
              </div>
            </div>

            {/* Enhanced Sorting Dropdown Row */}
            <div className="flex flex-col sm:flex-row sm:justify-end items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-200 mr-2">Sort by:</span>
              <div className="relative sort-dropdown">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center justify-between w-48 px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm dark:text-zinc-100"
                >
                  <div className="flex items-center">
                    {getSortIcon()}
                    <span className="ml-2">{getCurrentSortLabel()}</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 dark:text-zinc-500 transition-transform ${showSortDropdown ? "rotate-180" : ""}`}
                  />
                </button>

                {showSortDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-10">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSortChange(option.value)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 focus:outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 first:rounded-t-lg last:rounded-b-lg ${sortBy === option.value ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium" : "text-gray-700 dark:text-zinc-100"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option.label}</span>
                          {sortBy === option.value && getSortIcon()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Show loading only for initial load or when no cached data is available */}
        {initialLoading && events.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 bg-gray-50 dark:bg-zinc-900">
            <LoadingAnimation type="spinner" size="md" variant="primary" text="Loading events, please wait..." />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-zinc-900">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 mb-4">
              <Calendar className="h-8 w-8 text-gray-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-2">No events found</h3>
            <p className="text-gray-500 dark:text-zinc-300 mb-6 max-w-md mx-auto">
              {searchQuery
                ? "No events match your search criteria. Try a different search term or clear the filters."
                : "You haven't created any events yet. Create your first event to get started."}
            </p>
            <button
              onClick={() => navigate(`/${userRole}/create-event`)}
              className="inline-flex items-center px-4 py-2 btn-primary text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="h-5 w-5 mr-1.5" /> Create New Event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-zinc-700">
            {filteredEvents.map((event) => {
              const status = getEventStatus(event)
              return (
                <div key={event.id} className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Event Image */}
                    {event.image && (
                      <div className="w-full md:w-40 h-40 flex-shrink-0 order-1 md:order-2">
                        <img
                          src={event.image || "/placeholder.svg"}
                          alt={event.title}
                          className="w-full h-full object-cover rounded-lg shadow-sm"
                        />
                      </div>
                    )}

                    {/* Event Details */}
                    <div className="flex-1 order-2 md:order-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">{event.title}</h3>

                        {/* Status badges */}
                        <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${status.color}`}>
                          {status.label}
                        </span>

                        {event.isPublic ? (
                          <span className="inline-flex items-center bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs px-2.5 py-1 rounded-full">
                            <Globe className="h-3 w-3 mr-1" /> Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 text-xs px-2.5 py-1 rounded-full">
                            <Lock className="h-3 w-3 mr-1" /> Private
                          </span>
                        )}

                        {/* Live Status Badge */}
                        {event.isLive ? (
                          <span className="inline-flex items-center bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200 text-xs px-2.5 py-1 rounded-full">
                            <Wifi className="h-3 w-3 mr-1" /> Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 text-xs px-2.5 py-1 rounded-full">
                            <WifiOff className="h-3 w-3 mr-1" /> Not Live
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 dark:text-zinc-300 mb-4">
                        <div className="flex items-center bg-gray-50 dark:bg-zinc-900 p-2 rounded-lg">
                          <Calendar className="h-4 w-4 mr-2 text-indigo-500" />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center bg-gray-50 dark:bg-zinc-900 p-2 rounded-lg">
                          <BellRing className="h-4 w-4 mr-2 text-indigo-500" />
                          <CountdownDisplay
                            detailsOnClick={false}
                            eventDate={event.date}
                            eventTime={event.time}
                            showSeconds={true}
                            expiredText="Not Available"
                            startedText="Event Started"
                          />
                        </div>
                        <div className="flex items-center bg-gray-50 dark:bg-zinc-900 p-2 rounded-lg">
                          <Clock className="h-4 w-4 mr-2 text-indigo-500" />
                          <span>{event.time}</span>
                        </div>
                        <div className="flex items-center bg-gray-50 dark:bg-zinc-900 p-2 rounded-lg">
                          <MapPin className="h-4 w-4 mr-2 text-indigo-500" />
                          <span>{event.location}</span>
                        </div>
                        <div className="flex items-center bg-gray-50 dark:bg-zinc-900 p-2 rounded-lg">
                          <Users className="h-4 w-4 mr-2 text-indigo-500" />
                          <span>
                            {event.attendeeCount || 0} / {event.capacity} attendees
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-500 dark:text-zinc-400 line-clamp-2 mb-4">{event.description}</p>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Link
                          to={`/${userRole}/event/${event.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-lg text-sm text-gray-700 dark:text-zinc-200 transition-colors"
                        >
                          <Eye className="h-4 w-4 mr-1.5" /> View
                        </Link>

                        {/* Show Private Event Details Button - only for private events */}
                        {!event.isPublic && (
                          <button
                            onClick={() => handleViewPrivateEvent(event)}
                            className="inline-flex items-center px-3 py-1.5 bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-lg text-sm text-purple-700 dark:text-purple-200 transition-colors"
                            title="View private event details in new tab"
                          >
                            <ExternalLink className="h-4 w-4 mr-1.5" /> Stream
                          </button>
                        )}

                        {!event.isPublic && (
                          <button
                            onClick={() => handleRegisterPrivateEvent(event)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-200 transition-colors"
                            title="View private event details in new tab"
                          >
                            <Pencil className="h-4 w-4 mr-1.5" /> Register
                          </button>
                        )}

                        <Link
                          to={`/${userRole}/edit-event/${event.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-lg text-sm text-gray-700 dark:text-zinc-200 transition-colors"
                        >
                          <Edit className="h-4 w-4 mr-1.5" /> Edit
                        </Link>

                        <button
                          onClick={() => toggleEventVisibility(event)}
                          className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-lg text-sm text-gray-700 dark:text-zinc-200 transition-colors"
                        >
                          {event.isPublic ? (
                            <>
                              <Lock className="h-4 w-4 mr-1.5" /> Make Private
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4 mr-1.5" /> Make Public
                            </>
                          )}
                        </button>

                        {/* Toggle Live Status Button */}
                        <button
                          onClick={() => toggleEventLiveStatus(event)}
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors ${event.isLive
                              ? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-800 text-green-700 dark:text-green-200"
                              : "bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-700 dark:text-zinc-200"
                            }`}
                        >
                          {event.isLive ? (
                            <>
                              <WifiOff className="h-4 w-4 mr-1.5" /> Set Not Live
                            </>
                          ) : (
                            <>
                              <Wifi className="h-4 w-4 mr-1.5" /> Set Live
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedEvent(event)
                            setShowDeleteModal(true)
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-800 rounded-lg text-sm text-red-600 dark:text-red-200 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 backdrop-blur-xs backdrop-grayscale-150 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-200" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 text-center mb-2">Delete Event</h3>
            <p className="text-gray-600 dark:text-zinc-300 text-center mb-6">
              Are you sure you want to delete "{selectedEvent?.title}"? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="order-2 sm:order-1 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-700 dark:text-zinc-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={loading}
                className="order-1 sm:order-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <LoadingAnimation type="spinner" size="md" variant="info" text="Deleting, please wait..." />
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}