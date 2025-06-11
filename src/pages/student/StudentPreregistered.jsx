import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  BookOpen,
  BadgeIcon as IdCard,
  Info,
} from "lucide-react";

export default function StudentPreRegistration({
  eventId,
  onClose,
  onSuccess,
}) {
  const { currentUser } = useAuth();
  const [event, setEvent] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Fetch event and student data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch event data
        const eventDoc = await getDoc(doc(db, "events", eventId));
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

        // Fetch student data
        if (currentUser) {
          const studentDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (studentDoc.exists()) {
            setStudent(studentDoc.data());

            // Check if student is already pre-registered
            const preRegDoc = await getDoc(
              doc(db, "usersPreRegistered", `${currentUser.uid}_${eventId}`)
            );
            if (preRegDoc.exists()) {
              setAlreadyRegistered(true);
            }
          } else {
            setError("Student profile not found");
          }
        } else {
          setError("You must be logged in to pre-register");
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again.");
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, currentUser]);

  const handlePreRegister = async () => {
    if (!currentUser || !student || !event) return;

    try {
      setRegistering(true);
      setError("");

      // Check if the event is full
      if (event.attendees >= event.capacity) {
        setError("Sorry, this event is fully booked");
        setRegistering(false);
        return;
      }

      // Create pre-registration record with combined ID format (userId_eventId)
      const registrationId = `${currentUser.uid}_${eventId}`;

      const registrationData = {
        studentId: student.studentId || "",
        name: student.displayName || student.name || "",
        email: student.email || "",
        course: student.course || "",
        profileImage: student.profileImage || "",
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        eventId: eventId,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        status: "pre-registered",
        eventProfile: event.image,
      };

      // Add registration to the new usersPreRegistered collection
      await setDoc(
        doc(db, "usersPreRegistered", registrationId),
        registrationData
      );

      // Update the event's pre-registration count if it exists
      try {
        await updateDoc(doc(db, "events", eventId), {
          preRegisteredCount: (event.preRegisteredCount || 0) + 1,
        });
      } catch (err) {
        console.error("Error updating preRegisteredCount:", err);
        // Continue with the process even if this update fails
      }

      setSuccess(true);
      setRegistering(false);

      // Call the success callback after a short delay to show the success message
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      console.error("Error pre-registering:", err);
      setError("Failed to pre-register. Please try again.");
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto text-center">
        <div className="relative w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6">
          <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-75"></div>
          <div className="relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-purple-600" />
          </div>
        </div>
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
          Loading Event
        </h3>
        <p className="text-sm sm:text-base text-gray-500">
          Please wait while we fetch the event details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto">
        <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-3 text-gray-900">
          Unable to Register
        </h2>
        <p className="text-sm sm:text-base text-gray-600 text-center mb-6 px-2">
          {error}
        </p>
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 sm:px-5 sm:py-3 bg-gray-100 rounded-lg text-gray-800 font-medium hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-green-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-3 text-gray-900">
          Registration Confirmed!
        </h2>
        <p className="text-sm sm:text-base text-gray-600 text-center mb-2 px-2">
          You've been successfully pre-registered for:
        </p>
        <p className="text-purple-600 font-medium text-base sm:text-lg text-center mb-4 sm:mb-6 px-2">
          {event?.title}
        </p>

        <div className="bg-purple-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-start sm:items-center">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 mt-0.5 sm:mt-0 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {new Date(event?.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700">{event?.time}</p>
            </div>
            <div className="flex items-start sm:items-center">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 mt-0.5 sm:mt-0 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {event?.location}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 sm:px-5 sm:py-3 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (alreadyRegistered) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-purple-100 rounded-full flex items-center justify-center">
          <UserCheck className="h-8 w-8 sm:h-10 sm:w-10 text-purple-600" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-3 text-gray-900">
          Already Registered
        </h2>
        <p className="text-sm sm:text-base text-gray-600 text-center mb-4 sm:mb-6 px-2">
          You're already pre-registered for this event. We look forward to
          seeing you there!
        </p>

        <div className="bg-purple-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <h3 className="font-medium text-purple-800 mb-2 sm:mb-3 text-sm sm:text-base">
            {event?.title}
          </h3>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-start sm:items-center">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 mt-0.5 sm:mt-0 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {new Date(event?.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700">{event?.time}</p>
            </div>
            <div className="flex items-start sm:items-center">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 mt-0.5 sm:mt-0 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {event?.location}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 sm:px-5 sm:py-3 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 w-full max-w-sm sm:max-w-md lg:max-w-2xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center text-gray-900">
        Pre-Register for Event
      </h2>

      {event && (
        <div className="mb-4 sm:mb-6 bg-purple-50 rounded-lg p-4 sm:p-5 border border-purple-100">
          <h3 className="font-semibold text-base sm:text-lg text-purple-800 mb-2 sm:mb-3">
            {event.title}
          </h3>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-start sm:items-center">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 mt-0.5 sm:mt-0 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {new Date(event.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700">{event.time}</p>
            </div>
            <div className="flex items-start sm:items-center">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mr-2 sm:mr-3 mt-0.5 sm:mt-0 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {event.location}
              </p>
            </div>
          </div>
        </div>
      )}

      {student && (
        <div className="bg-gray-50 rounded-lg p-4 sm:p-5 mb-4 sm:mb-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3 sm:mb-4 text-sm sm:text-base">
            Your Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 font-medium">Name</p>
                <p className="text-xs sm:text-sm text-gray-800 truncate">
                  {student.displayName || student.name || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                <IdCard className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 font-medium">Student ID</p>
                <p className="text-xs sm:text-sm text-gray-800 truncate">
                  {student.studentId || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 font-medium">Course</p>
                <p className="text-xs sm:text-sm text-gray-800 truncate">
                  {student.course || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-xs sm:text-sm text-gray-800 truncate">
                  {student.email || "Not provided"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 flex items-start">
        <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
        <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
          By pre-registering, you'll be added to the event's attendance list.
          You'll still need to check in at the event using QR code or NFC.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <button
          onClick={onClose}
          className="order-2 sm:order-1 px-4 py-2.5 sm:px-5 sm:py-3 bg-gray-100 rounded-lg text-gray-800 font-medium hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 sm:w-1/2 text-sm sm:text-base"
        >
          Cancel
        </button>
        <button
          onClick={handlePreRegister}
          disabled={registering}
          className={`order-1 sm:order-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg text-white font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 flex justify-center items-center sm:w-1/2 text-sm sm:text-base ${
            registering
              ? "bg-purple-400 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {registering ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Processing...
            </>
          ) : (
            "Pre-Register"
          )}
        </button>
      </div>
    </div>
  );
}