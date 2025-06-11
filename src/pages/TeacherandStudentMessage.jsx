"use client"

import { useState, useEffect, useRef } from "react"
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp,
    limit,
} from "firebase/firestore"
import { db } from "../firebase/config"
import { useAuth } from "../contexts/AuthContext"
import {
    Send,
    Inbox,
    ScrollText,
    User,
    RefreshCw,
    MessageSquare,
    ChevronLeft,
    Search,
    Edit,
    Users,
    Mail,
    School,
    Filter,
    X,
    CheckCircle,
    AlertCircle,
} from "lucide-react"

export default function MessagingCenter() {
    const { currentUser, currentUserData } = useAuth()
    const [activeTab, setActiveTab] = useState("inbox")
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [viewingMessage, setViewingMessage] = useState(null)
    const [composingMessage, setComposingMessage] = useState(false)
    const [messageText, setMessageText] = useState("")
    const [messageSubject, setMessageSubject] = useState("")
    const [recipients, setRecipients] = useState([])
    const [selectedRecipient, setSelectedRecipient] = useState(null)
    const [searchingRecipients, setSearchingRecipients] = useState(false)
    const [recipientSearchTerm, setRecipientSearchTerm] = useState("")

    // New state for role-based messaging
    const [messageType, setMessageType] = useState("individual") // individual or group
    const [sections, setSections] = useState([])
    const [selectedSection, setSelectedSection] = useState("")
    const [loadingSections, setLoadingSections] = useState(false)
    const [searchBy, setSearchBy] = useState("name") // name, email, id
    const [successMessage, setSuccessMessage] = useState("")
    const [errorMessage, setErrorMessage] = useState("")

    // Add these new state variables after the other state declarations
    const [predictedUsers, setPredictedUsers] = useState([])
    const [showPredictions, setShowPredictions] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const searchInputRef = useRef(null)

    // Fetch messages based on active tab
    useEffect(() => {
        fetchMessages()
    }, [activeTab, currentUser])

    // Fetch available sections for teachers
    useEffect(() => {
        if (currentUserData?.role === "teacher") {
            fetchSections()
        }
    }, [currentUserData])

    const fetchSections = async () => {
        if (!currentUser) return

        setLoadingSections(true)
        try {
            // Get unique sections from students
            const studentsQuery = query(collection(db, "users"), where("role", "==", "student"))

            const querySnapshot = await getDocs(studentsQuery)
            const uniqueSections = new Set()

            querySnapshot.forEach((doc) => {
                const userData = doc.data()
                if (userData.section) {
                    uniqueSections.add(userData.section)
                }
            })

            setSections(Array.from(uniqueSections).sort())
        } catch (error) {
            console.error("Error fetching sections:", error)
        } finally {
            setLoadingSections(false)
        }
    }

    const fetchMessages = async () => {
        if (!currentUser) return

        setLoading(true)
        try {
            let messagesQuery

            if (activeTab === "inbox") {
                messagesQuery = query(
                    collection(db, "messages"),
                    where("recipientId", "==", currentUser.uid),
                    orderBy("sentAt", "desc"),
                )
            } else if (activeTab === "sent") {
                messagesQuery = query(
                    collection(db, "messages"),
                    where("senderId", "==", currentUser.uid),
                    orderBy("sentAt", "desc"),
                )
            }

            const querySnapshot = await getDocs(messagesQuery)
            const messagesData = []

            querySnapshot.forEach((doc) => {
                messagesData.push({
                    id: doc.id,
                    ...doc.data(),
                })
            })

            setMessages(messagesData)
        } catch (error) {
            console.error("Error fetching messages:", error)
        } finally {
            setLoading(false)
        }
    }

    // Replace the existing searchRecipients function with this enhanced version
    const searchRecipients = async () => {
        if (!recipientSearchTerm.trim()) return

        setSearchingRecipients(true)
        setRecipients([])

        try {
            let usersQuery
            const searchTermLower = recipientSearchTerm.toLowerCase()

            // Different search strategies based on user role and search type
            if (currentUserData?.role === "teacher") {
                // Teachers search for students
                if (searchBy === "email") {
                    usersQuery = query(
                        collection(db, "users"),
                        where("role", "==", "student"),
                        where("email", ">=", searchTermLower),
                        where("email", "<=", searchTermLower + "\uf8ff"),
                        // Limit to 10 results for better performance
                        limit(10),
                    )
                } else if (searchBy === "id") {
                    usersQuery = query(
                        collection(db, "users"),
                        where("role", "==", "student"),
                        where("studentId", ">=", searchTermLower),
                        where("studentId", "<=", searchTermLower + "\uf8ff"),
                        limit(10),
                    )
                } else {
                    // Default search by name
                    usersQuery = query(
                        collection(db, "users"),
                        where("role", "==", "student"),
                        where("name", ">=", searchTermLower),
                        where("name", "<=", searchTermLower + "\uf8ff"),
                        limit(10),
                    )
                }
            } else {
                // Students search for teachers
                if (searchBy === "email") {
                    usersQuery = query(
                        collection(db, "users"),
                        where("role", "==", "teacher"),
                        where("email", ">=", searchTermLower),
                        where("email", "<=", searchTermLower + "\uf8ff"),
                        limit(10),
                    )
                } else if (searchBy === "id") {
                    usersQuery = query(
                        collection(db, "users"),
                        where("role", "==", "teacher"),
                        where("teacherId", ">=", searchTermLower),
                        where("teacherId", "<=", searchTermLower + "\uf8ff"),
                        limit(10),
                    )
                } else {
                    // Default search by name
                    usersQuery = query(
                        collection(db, "users"),
                        where("role", "==", "teacher"),
                        where("name", ">=", searchTermLower),
                        where("name", "<=", searchTermLower + "\uf8ff"),
                        limit(10),
                    )
                }
            }

            const querySnapshot = await getDocs(usersQuery)
            const users = []

            querySnapshot.forEach((doc) => {
                users.push({
                    id: doc.id,
                    ...doc.data(),
                })
            })

            setRecipients(users)
        } catch (error) {
            console.error("Error searching recipients:", error)
            setErrorMessage("Error searching for recipients. Please try again.")
        } finally {
            setSearchingRecipients(false)
        }
    }

    // Add this new function after the searchRecipients function
    const fetchPredictiveUsers = async () => {
        if (!recipientSearchTerm.trim() || recipientSearchTerm.length < 2) {
            setPredictedUsers([])
            return
        }

        try {
            const searchTermLower = recipientSearchTerm.toLowerCase()
            let usersQuery

            // Get users based on role
            if (currentUserData?.role === "teacher") {
                usersQuery = query(collection(db, "users"), where("role", "==", "student"), limit(20))
            } else {
                usersQuery = query(collection(db, "users"), where("role", "==", "teacher"), limit(20))
            }

            const querySnapshot = await getDocs(usersQuery)
            const allUsers = []

            querySnapshot.forEach((doc) => {
                allUsers.push({
                    id: doc.id,
                    ...doc.data(),
                })
            })

            // Filter users client-side based on search term and search type
            const filtered = allUsers.filter((user) => {
                if (searchBy === "email") {
                    return user.email && user.email.toLowerCase().includes(searchTermLower)
                } else if (searchBy === "id") {
                    const idField = currentUserData?.role === "teacher" ? "studentId" : "teacherId"
                    return user[idField] && user[idField].toLowerCase().includes(searchTermLower)
                } else {
                    // Default search by name
                    return user.name && user.name.toLowerCase().includes(searchTermLower)
                }
            })

            // Sort results by relevance (starts with search term first)
            filtered.sort((a, b) => {
                const fieldA =
                    searchBy === "email"
                        ? a.email
                        : searchBy === "id"
                            ? currentUserData?.role === "teacher"
                                ? a.studentId
                                : a.teacherId
                            : a.name

                const fieldB =
                    searchBy === "email"
                        ? b.email
                        : searchBy === "id"
                            ? currentUserData?.role === "teacher"
                                ? b.studentId
                                : b.teacherId
                            : b.name

                const aStartsWith = fieldA.toLowerCase().startsWith(searchTermLower)
                const bStartsWith = fieldB.toLowerCase().startsWith(searchTermLower)

                if (aStartsWith && !bStartsWith) return -1
                if (!aStartsWith && bStartsWith) return 1
                return 0
            })

            setPredictedUsers(filtered.slice(0, 5)) // Limit to top 5 predictions
        } catch (error) {
            console.error("Error fetching predictive users:", error)
            setPredictedUsers([])
        }
    }

    // Add this useEffect for predictive search
    useEffect(() => {
        if (recipientSearchTerm.trim().length >= 2) {
            fetchPredictiveUsers()
            setShowPredictions(true)
        } else {
            setPredictedUsers([])
            setShowPredictions(false)
        }
        setHighlightedIndex(-1)
    }, [recipientSearchTerm, searchBy])

    // Add this function to handle keyboard navigation
    const handleKeyDown = (e) => {
        if (!showPredictions || predictedUsers.length === 0) return

        // Arrow down
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlightedIndex((prev) => (prev < predictedUsers.length - 1 ? prev + 1 : prev))
        }
        // Arrow up
        else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        }
        // Enter
        else if (e.key === "Enter" && highlightedIndex >= 0) {
            e.preventDefault()
            setSelectedRecipient(predictedUsers[highlightedIndex])
            setShowPredictions(false)
            setRecipientSearchTerm("")
        }
        // Escape
        else if (e.key === "Escape") {
            setShowPredictions(false)
        }
    }

    // Add this function to handle clicking outside the predictions dropdown
    const handleClickOutside = (e) => {
        if (searchInputRef.current && !searchInputRef.current.contains(e.target)) {
            setShowPredictions(false)
        }
    }

    // Add this useEffect for click outside handling
    useEffect(() => {
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    const fetchStudentsBySection = async (section) => {
        try {
            const studentsQuery = query(
                collection(db, "users"),
                where("role", "==", "student"),
                where("section", "==", section),
            )
            const querySnapshot = await getDocs(studentsQuery)
            const students = []
            querySnapshot.forEach((doc) => {
                students.push({
                    uid: doc.id,
                    ...doc.data(),
                })
            })
            return students
        } catch (error) {
            console.error("Error fetching students by section:", error)
            return []
        }
    }

    const sendMessage = async () => {
        if (!messageText.trim() || !messageSubject.trim()) {
            setErrorMessage("Please enter both subject and message.")
            return
        }

        if (messageType === "individual" && !selectedRecipient) {
            setErrorMessage("Please select a recipient.")
            return
        }

        if (messageType === "group" && !selectedSection) {
            setErrorMessage("Please select a section.")
            return
        }

        setErrorMessage("")

        try {
            if (messageType === "individual") {
                // Send to individual recipient
                await addDoc(collection(db, "messages"), {
                    senderId: currentUser.uid,
                    senderName: currentUserData.name,
                    senderRole: currentUserData.role,
                    senderProfileImage: currentUserData.profileImage || "",
                    recipientId: selectedRecipient.uid,
                    recipientName: selectedRecipient.name,
                    recipientRole: selectedRecipient.role,
                    subject: messageSubject,
                    message: messageText,
                    read: false,
                    sentAt: serverTimestamp(),
                })

                setSuccessMessage(`Message sent to ${selectedRecipient.name}`)
            } else {
                // Send to all students in section
                const studentsInSection = await fetchStudentsBySection(selectedSection)

                if (studentsInSection.length === 0) {
                    setErrorMessage(`No students found in section ${selectedSection}`)
                    return
                }

                // Create a batch of messages
                const messagePromises = studentsInSection.map((student) =>
                    addDoc(collection(db, "messages"), {
                        senderId: currentUser.uid,
                        senderName: currentUserData.name,
                        senderRole: currentUserData.role,
                        senderProfileImage: currentUserData.profileImage || "",
                        recipientId: student.uid,
                        recipientName: student.name,
                        recipientRole: student.role,
                        subject: messageSubject,
                        message: messageText,
                        read: false,
                        sentAt: serverTimestamp(),
                    }),
                )

                await Promise.all(messagePromises)

                setSuccessMessage(`Message sent to ${studentsInSection.length} students in section ${selectedSection}`)
            }

            // Reset form and view
            setMessageText("")
            setMessageSubject("")
            setSelectedRecipient(null)
            setSelectedSection("")
            setMessageType("individual")
            setComposingMessage(false)
            setActiveTab("sent")

            // Clear success message after 5 seconds
            setTimeout(() => {
                setSuccessMessage("")
            }, 5000)

            fetchMessages()
        } catch (error) {
            console.error("Error sending message:", error)
            setErrorMessage("Error sending message. Please try again.")
        }
    }

    const markAsRead = async (messageId) => {
        try {
            const messageRef = doc(db, "messages", messageId)
            await updateDoc(messageRef, {
                read: true,
            })

            // Update local state
            setMessages(messages.map((msg) => (msg.id === messageId ? { ...msg, read: true } : msg)))
        } catch (error) {
            console.error("Error marking message as read:", error)
        }
    }

    const handleViewMessage = (message) => {
        setViewingMessage(message)
        if (!message.read && message.recipientId === currentUser.uid) {
            markAsRead(message.id)
        }
    }

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return "Just now"

        const date = timestamp.toDate()
        const now = new Date()
        const diff = Math.floor((now - date) / 1000) // difference in seconds

        if (diff < 60) return "Just now"
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
        if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`

        return date.toLocaleDateString()
    }

    const filteredMessages = messages.filter(
        (msg) =>
            msg.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.recipientName.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    const getUserIdentifier = (user) => {
        if (user.role === "student") {
            return `Student ID: ${user.studentId || "N/A"}`
        } else if (user.role === "teacher") {
            return `Teacher ID: ${user.teacherId || "N/A"}`
        }
        return ""
    }

    // Render the message composition form
    const renderComposeForm = () => {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <Edit className="h-5 w-5 text-indigo-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-800">Compose Message</h2>
                    </div>
                    <button
                        onClick={() => {
                            setComposingMessage(false)
                            setErrorMessage("")
                        }}
                        className="text-gray-400 hover:text-gray-600 flex items-center"
                    >
                        <ChevronLeft className="h-5 w-5 mr-1" /> Back
                    </button>
                </div>

                {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                        <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
                        <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                        {successMessage}
                    </div>
                )}

                <div className="space-y-4">
                    {/* Message Type Selection - Only for teachers */}
                    {currentUserData?.role === "teacher" && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Message Type:</label>
                            <div className="flex space-x-4">
                                <label
                                    className={`flex items-center p-3 rounded-lg border cursor-pointer ${messageType === "individual"
                                            ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500"
                                            : "bg-white border-gray-200 hover:bg-gray-50"
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="messageType"
                                        value="individual"
                                        checked={messageType === "individual"}
                                        onChange={() => {
                                            setMessageType("individual")
                                            setSelectedSection("")
                                        }}
                                        className="sr-only"
                                    />
                                    <User className="h-5 w-5 text-indigo-600 mr-2" />
                                    <span>Individual Student</span>
                                </label>

                                <label
                                    className={`flex items-center p-3 rounded-lg border cursor-pointer ${messageType === "group"
                                            ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500"
                                            : "bg-white border-gray-200 hover:bg-gray-50"
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="messageType"
                                        value="group"
                                        checked={messageType === "group"}
                                        onChange={() => {
                                            setMessageType("group")
                                            setSelectedRecipient(null)
                                            setRecipientSearchTerm("")
                                        }}
                                        className="sr-only"
                                    />
                                    <Users className="h-5 w-5 text-indigo-600 mr-2" />
                                    <span>Section (Group)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Recipient Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>

                        {/* For teachers sending to a section */}
                        {currentUserData?.role === "teacher" && messageType === "group" && (
                            <div className="space-y-2">
                                <div className="relative">
                                    <select
                                        value={selectedSection}
                                        onChange={(e) => setSelectedSection(e.target.value)}
                                        className="block w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                                    >
                                        <option value="">Select a section...</option>
                                        {sections.map((section) => (
                                            <option key={section} value={section}>
                                                {section}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <School className="h-4 w-4 text-gray-400" />
                                    </div>
                                </div>

                                {loadingSections && (
                                    <div className="flex items-center text-gray-500 text-sm">
                                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Loading sections...
                                    </div>
                                )}

                                {selectedSection && (
                                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                        <div className="flex items-center">
                                            <Users className="h-5 w-5 text-indigo-500 mr-2" />
                                            <div>
                                                <p className="font-medium text-gray-800">Section: {selectedSection}</p>
                                                <p className="text-xs text-gray-500">All students in this section will receive this message</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* For individual recipients (teachers to student or student to teacher) */}
                        {(messageType === "individual" || currentUserData?.role === "student") && (
                            <>
                                {selectedRecipient ? (
                                    <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                                                {selectedRecipient.profileImage ? (
                                                    <img
                                                        src={selectedRecipient.profileImage || "/placeholder.svg"}
                                                        alt={selectedRecipient.name}
                                                        className="h-10 w-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <User className="h-5 w-5 text-indigo-500" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">{selectedRecipient.name}</p>
                                                <p className="text-xs text-gray-500">{getUserIdentifier(selectedRecipient)}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedRecipient(null)} className="text-gray-400 hover:text-red-500">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <div className="flex items-center text-sm text-gray-500 mr-2">
                                                <Filter className="h-4 w-4 mr-1" /> Search by:
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setSearchBy("name")}
                                                className={`px-3 py-1 text-sm rounded-full ${searchBy === "name"
                                                        ? "bg-indigo-100 text-indigo-700"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                            >
                                                Name
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setSearchBy("email")}
                                                className={`px-3 py-1 text-sm rounded-full ${searchBy === "email"
                                                        ? "bg-indigo-100 text-indigo-700"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                            >
                                                Email
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setSearchBy("id")}
                                                className={`px-3 py-1 text-sm rounded-full ${searchBy === "id"
                                                        ? "bg-indigo-100 text-indigo-700"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {currentUserData?.role === "teacher" ? "Student ID" : "Teacher ID"}
                                            </button>
                                        </div>

                                        <div className="relative" ref={searchInputRef}>
                                            <input
                                                type="text"
                                                value={recipientSearchTerm}
                                                onChange={(e) => setRecipientSearchTerm(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                onFocus={() => recipientSearchTerm.trim().length >= 2 && setShowPredictions(true)}
                                                placeholder={`Search for ${currentUserData?.role === "teacher" ? "students" : "teachers"} by ${searchBy}...`}
                                                className="block w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                                <Search className="h-4 w-4 text-gray-400" />
                                            </div>
                                            {searchingRecipients && (
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                                    <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                                                </div>
                                            )}

                                            {showPredictions && predictedUsers.length > 0 && (
                                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                    <ul className="py-1">
                                                        {predictedUsers.map((user, index) => {
                                                            const displayField =
                                                                searchBy === "email"
                                                                    ? user.email
                                                                    : searchBy === "id"
                                                                        ? currentUserData?.role === "teacher"
                                                                            ? user.studentId
                                                                            : user.teacherId
                                                                        : user.name

                                                            const searchTermLower = recipientSearchTerm.toLowerCase()
                                                            const displayFieldLower = displayField.toLowerCase()
                                                            const startIndex = displayFieldLower.indexOf(searchTermLower)

                                                            let beforeMatch = ""
                                                            let match = ""
                                                            let afterMatch = ""

                                                            if (startIndex >= 0) {
                                                                beforeMatch = displayField.substring(0, startIndex)
                                                                match = displayField.substring(startIndex, startIndex + searchTermLower.length)
                                                                afterMatch = displayField.substring(startIndex + searchTermLower.length)
                                                            } else {
                                                                match = displayField // Fallback if no match found
                                                            }

                                                            return (
                                                                <li
                                                                    key={user.uid}
                                                                    onClick={() => {
                                                                        setSelectedRecipient(user)
                                                                        setShowPredictions(false)
                                                                        setRecipientSearchTerm("")
                                                                    }}
                                                                    className={`px-4 py-2 cursor-pointer flex items-center ${index === highlightedIndex ? "bg-indigo-50" : "hover:bg-gray-50"
                                                                        }`}
                                                                >
                                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 flex-shrink-0">
                                                                        {user.profileImage ? (
                                                                            <img
                                                                                src={user.profileImage || "/placeholder.svg"}
                                                                                alt={user.name}
                                                                                className="h-8 w-8 rounded-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <User className="h-4 w-4 text-indigo-500" />
                                                                        )}
                                                                    </div>
                                                                    <div className="overflow-hidden">
                                                                        <p className="font-medium text-gray-800 truncate">{user.name}</p>
                                                                        <p className="text-xs text-gray-500 truncate">
                                                                            {searchBy === "name" ? (
                                                                                getUserIdentifier(user)
                                                                            ) : (
                                                                                <>
                                                                                    {beforeMatch}
                                                                                    <span className="font-bold text-indigo-600">{match}</span>
                                                                                    {afterMatch}
                                                                                </>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </li>
                                                            )
                                                        })}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {recipients.length > 0 && (
                                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-h-60 overflow-y-auto">
                                                <ul className="divide-y divide-gray-100">
                                                    {recipients.map((recipient) => (
                                                        <li
                                                            key={recipient.uid}
                                                            onClick={() => setSelectedRecipient(recipient)}
                                                            className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                                                        >
                                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                                                                {recipient.profileImage ? (
                                                                    <img
                                                                        src={recipient.profileImage || "/placeholder.svg"}
                                                                        alt={recipient.name}
                                                                        className="h-10 w-10 rounded-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <User className="h-5 w-5 text-indigo-500" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-800">{recipient.name}</p>
                                                                <div className="flex items-center text-xs text-gray-500">
                                                                    <span className="mr-2">{recipient.email}</span>
                                                                    <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                                                                        {getUserIdentifier(recipient)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {recipientSearchTerm && recipients.length === 0 && !searchingRecipients && (
                                            <div className="text-sm text-gray-500 p-2">No recipients found. Try a different search term.</div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                        <input
                            type="text"
                            value={messageSubject}
                            onChange={(e) => setMessageSubject(e.target.value)}
                            placeholder="Enter subject"
                            className="block w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
                        <textarea
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Enter your message here..."
                            rows={6}
                            className="block w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={sendMessage}
                            disabled={
                                !messageText.trim() ||
                                !messageSubject.trim() ||
                                (messageType === "individual" && !selectedRecipient) ||
                                (messageType === "group" && !selectedSection)
                            }
                            className={`inline-flex items-center px-4 py-2 rounded-lg text-white ${!messageText.trim() ||
                                    !messageSubject.trim() ||
                                    (messageType === "individual" && !selectedRecipient) ||
                                    (messageType === "group" && !selectedSection)
                                    ? "bg-gray-300 cursor-not-allowed"
                                    : "bg-indigo-600 hover:bg-indigo-700"
                                }`}
                        >
                            <Send className="h-4 w-4 mr-2" /> Send Message
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Render the message viewing interface
    const renderMessageView = () => {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setViewingMessage(null)}
                            className="flex items-center text-gray-500 hover:text-indigo-600"
                        >
                            <ChevronLeft className="h-5 w-5 mr-1" /> Back to {activeTab}
                        </button>
                    </div>

                    <h1 className="text-xl font-bold text-gray-800 mb-3">{viewingMessage.subject}</h1>

                    <div className="flex items-start space-x-3 mb-6">
                        <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                {viewingMessage.senderProfileImage ? (
                                    <img
                                        src={viewingMessage.senderProfileImage || "/placeholder.svg"}
                                        alt={viewingMessage.senderName}
                                        className="h-10 w-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <User className="h-5 w-5 text-indigo-500" />
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="font-medium text-gray-800">
                                {viewingMessage.senderName}
                                <span className="text-sm font-normal text-gray-500 ml-2">
                                    ({viewingMessage.senderRole === "student" ? "Student" : "Teacher"})
                                </span>
                            </p>
                            <p className="text-sm text-gray-500">To: {viewingMessage.recipientName}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {viewingMessage.sentAt ? formatTimestamp(viewingMessage.sentAt) : "Just now"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="prose max-w-none">
                        <p className="whitespace-pre-wrap text-gray-700">{viewingMessage.message}</p>
                    </div>

                    {viewingMessage.senderId !== currentUser.uid && (
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => {
                                    setComposingMessage(true)
                                    setSelectedRecipient({
                                        uid: viewingMessage.senderId,
                                        name: viewingMessage.senderName,
                                        role: viewingMessage.senderRole,
                                        profileImage: viewingMessage.senderProfileImage || "",
                                    })
                                    setMessageSubject(`Re: ${viewingMessage.subject}`)
                                }}
                                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                                <ScrollText className="h-4 w-4 mr-2" /> Reply
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Render the message list
    const renderMessageList = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
                    <p className="text-gray-500">Loading messages...</p>
                </div>
            )
        }

        if (filteredMessages.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Mail className="h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">No messages found</h3>
                    <p className="text-gray-500 max-w-md">
                        {activeTab === "inbox"
                            ? "Your inbox is empty. Messages from teachers and students will appear here."
                            : "You haven't sent any messages yet."}
                    </p>
                </div>
            )
        }

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <ul className="divide-y divide-gray-200">
                    {filteredMessages.map((message) => (
                        <li
                            key={message.id}
                            onClick={() => handleViewMessage(message)}
                            className={`p-4 sm:px-6 hover:bg-gray-50 cursor-pointer transition-colors ${!message.read && message.recipientId === currentUser.uid ? "bg-indigo-50" : ""
                                }`}
                        >
                            <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                        {activeTab === "inbox" ? (
                                            message.senderProfileImage ? (
                                                <img
                                                    src={message.senderProfileImage || "/placeholder.svg"}
                                                    alt={message.senderName}
                                                    className="h-10 w-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <User className="h-5 w-5 text-indigo-500" />
                                            )
                                        ) : message.recipientProfileImage ? (
                                            <img
                                                src={message.recipientProfileImage || "/placeholder.svg"}
                                                alt={message.recipientName}
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <User className="h-5 w-5 text-indigo-500" />
                                        )}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between">
                                        <p
                                            className={`text-sm font-medium ${!message.read && message.recipientId === currentUser.uid ? "text-indigo-700" : "text-gray-900"
                                                }`}
                                        >
                                            {activeTab === "inbox" ? message.senderName : message.recipientName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {message.sentAt ? formatTimestamp(message.sentAt) : "Just now"}
                                        </p>
                                    </div>
                                    <p
                                        className={`text-sm ${!message.read && message.recipientId === currentUser.uid
                                                ? "font-medium text-gray-900"
                                                : "text-gray-700"
                                            }`}
                                    >
                                        {message.subject}
                                    </p>
                                    <p className="text-sm text-gray-500 truncate mt-1">{message.message}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {successMessage && (
                <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
                    <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                    {successMessage}
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center">
                    <MessageSquare className="h-6 w-6 text-indigo-600 mr-3" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Messages</h1>
                </div>

                {!composingMessage && !viewingMessage && (
                    <div className="mt-4 sm:mt-0">
                        <button
                            onClick={() => setComposingMessage(true)}
                            className="inline-flex items-center px-4 py-2 sm:mr-11 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            <Edit className="h-4 w-4 mr-2" /> Compose
                        </button>
                    </div>
                )}
            </div>

            {!composingMessage && !viewingMessage && (
                <div className="mb-6">
                    <div className="flex flex-wrap gap-2 mb-4">
                        <button
                            onClick={() => setActiveTab("inbox")}
                            className={`inline-flex items-center px-4 py-2 rounded-lg ${activeTab === "inbox" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                        >
                            <Inbox className="h-4 w-4 mr-2" /> Inbox
                        </button>
                        <button
                            onClick={() => setActiveTab("sent")}
                            className={`inline-flex items-center px-4 py-2 rounded-lg ${activeTab === "sent" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                        >
                            <ScrollText className="h-4 w-4 mr-2" /> Sent
                        </button>
                    </div>

                    <div className="relative max-w-md">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search messages..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                    </div>
                </div>
            )}

            {composingMessage ? renderComposeForm() : viewingMessage ? renderMessageView() : renderMessageList()}
        </div>
    )
}