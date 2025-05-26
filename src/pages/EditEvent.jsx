/**
 * Component for editing event data.
 * Retrieves event details, allows editing and saving changes, managing attendees, and NFC registration.
 * @returns JSX element for the EditEvent component.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import {
  Save,
  ArrowLeft,
  FileSpreadsheet,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Users,
  Info,
  X,
  Calendar,
  Clock,
  MapPin,
  Tag,
  User,
  Globe,
  Lock,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import NFCRegistration from "../components/RegisterEvent/CurrentNFCRegistration";
import { useAlert } from "../components/AlertProvider";

export default function EditEvent() {
  const { eventId } = useParams();
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  const [event, setEvent] = useState(null);
  const [] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [, setFileData] = useState(null);
  const [worksheetData, setWorksheetData] = useState([]);
  const [editedData, setEditedData] = useState([]);
  const [fileName, setFileName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [activeTab, setActiveTab] = useState("attendees");
  const [eventDetails, setEventDetails] = useState({
    Title: "",
    Description: "",
    Date: "",
    Time: "",
    Location: "",
    Category: "",
    Capacity: "",
    "Created By": "",
    "Created At": "",
    "Public Event": "",
  });
  const [originalEventDetails, setOriginalEventDetails] = useState({});
  const [showNFCModal, setShowNFCModal] = useState(false);


  // Fetch event and file data
  useEffect(() => {
    async function fetchEventData() {
      if (!currentUser) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);

        // Get event details
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
          setError("Event not found");
          setLoading(false);
          return;
        }

        const eventData = eventSnap.data();

        // Verify user is the registrar
        if (eventData.registrarId !== currentUser.uid && userRole !== "admin") {
          setError("You don't have permission to edit this event");
          setLoading(false);
          return;
        }

        setEvent(eventData);

        const formatTimeWithAMPM = (time24) => {
          if (!time24) return "";
          
          const [hours24, minutes] = time24.split(':');
          const hours = parseInt(hours24, 10);
          const period = hours >= 12 ? 'PM' : 'AM';
          const hours12 = hours % 12 || 12;
          
          return `${hours12}:${minutes} ${period}`;
        };

        // Set up event details form data
        const details = {
          Title: eventData.title || "",
          Description: eventData.description || "",
          Date: eventData.date || "",
          Time: eventData.time ? formatTimeWithAMPM(eventData.time) : "",
          Location: eventData.location || "",
          Category: eventData.category || "",
          Capacity: eventData.capacity ? eventData.capacity.toString() : "",
          "Created By": eventData.createdBy || currentUser.email,
          "Created At": eventData.createdAt || new Date().toLocaleString(),
          "Public Event": eventData.isPublic ? "Yes" : "No",
        };

        setEventDetails(details);
        setOriginalEventDetails(details);

        // Get event documents
        const docsRef = collection(db, "eventDocuments");
        const docsQuery = query(docsRef, where("eventId", "==", eventId));
        const docsSnapshot = await getDocs(docsQuery);

        // Find attendance sheet document
        const attendeeSheet = docsSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .find((doc) => doc.documentType === "attendeeSheet");

        if (!attendeeSheet || !attendeeSheet.fileUrl) {
          // No attendance sheet found, but don't show error - user can create one
          setLoading(false);
          return;
        }

        setFileName(attendeeSheet.fileName || "attendees.xlsx");

        try {
          // Download the file from Firebase Storage
          const response = await fetch(attendeeSheet.fileUrl);
          const fileBlob = await response.blob();

          // Read the Excel file
          const fileReader = new FileReader();
          fileReader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: "array" });

              // Get attendees sheet
              const attendeesSheetName =
                workbook.SheetNames.find((name) =>
                  name.toLowerCase().includes("attendee")
                ) || workbook.SheetNames[0];
              const attendeesWorksheet = workbook.Sheets[attendeesSheetName];

              // Convert attendees to JSON
              const jsonData = XLSX.utils.sheet_to_json(attendeesWorksheet);

              // Try to get event details sheet if it exists
              const detailsSheetName = workbook.SheetNames.find((name) =>
                name.toLowerCase().includes("details")
              );

              if (detailsSheetName) {
                const detailsWorksheet = workbook.Sheets[detailsSheetName];
                const detailsData = XLSX.utils.sheet_to_json(detailsWorksheet, {
                  header: ["key", "value"],
                });

                // Convert details data to a more usable format
                const formattedDetails = {};
                detailsData.forEach((row) => {
                  if (row.key && row.value !== undefined) {
                    formattedDetails[row.key] = row.value;
                  }
                });

                // Only update if there are valid details
                if (Object.keys(formattedDetails).length > 0) {
                  setEventDetails((prevDetails) => ({
                    ...prevDetails,
                    ...formattedDetails,
                  }));
                  setOriginalEventDetails((prevDetails) => ({
                    ...prevDetails,
                    ...formattedDetails,
                  }));
                }
              }

              setFileData(fileBlob);
              setWorksheetData(jsonData);
              setEditedData(jsonData);
            } catch (err) {
              console.error("Error reading Excel file:", err);
              setError(
                "Failed to read attendance data. The file might be corrupted."
              );
            }
          };

          fileReader.readAsArrayBuffer(fileBlob);
        } catch (err) {
          console.error("Error downloading file:", err);
          setError("Failed to download attendance sheet. Please try again.");
        }
      } catch (err) {
        console.error("Error fetching event data:", err);
        setError("Failed to load event data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchEventData();
  }, [eventId, currentUser, navigate, userRole]);

  const convertTo24HourFormat = (timeWithAMPM) => {
    if (!timeWithAMPM) return "";
    
    // Extract hours, minutes, and period (AM/PM)
    const [timePart, period] = timeWithAMPM.split(' ');
    const [hours, minutes] = timePart.split(':');
    
    let hours24 = parseInt(hours, 10);
    
    // Convert to 24-hour format
    if (period === 'PM' && hours24 < 12) {
      hours24 += 12;
    } else if (period === 'AM' && hours24 === 12) {
      hours24 = 0;
    }
    
    // Format hours as two digits
    const formattedHours = hours24.toString().padStart(2, '0');
    
    return `${formattedHours}:${minutes}`;
  };

  // Handle event detail change
  const handleDetailChange = (field, value) => {
    setEventDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Get the collection name based on attendance count

  // Get the field name based on attendance count

  // Handle saving changes
  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Create a workbook
      const workbook = XLSX.utils.book_new();

      // Handle attendees data - create a sheet even if empty
      let attendeesWorksheet;
      if (editedData.length === 0) {
        // Create empty sheet with headers
        attendeesWorksheet = XLSX.utils.aoa_to_sheet([
          ["Name", "Email", "Registration Date", "Status", "Notes"],
        ]);
      } else {
        // Convert attendees data to Excel as before
        attendeesWorksheet = XLSX.utils.json_to_sheet(editedData);
      }

      // Convert event details to Excel format
      const detailsData = Object.entries(eventDetails).map(([key, value]) => [
        key,
        value,
      ]);
      const detailsWorksheet = XLSX.utils.aoa_to_sheet(detailsData);

      // Set column widths for details sheet
      const detailsColWidths = [
        { wch: 15 }, // Detail name
        { wch: 50 }, // Detail value
      ];
      detailsWorksheet["!cols"] = detailsColWidths;

      // Get the correct name for the attendee sheet based on count
      const sheetName =
        editedData.length === 1 ? "Event Attendee" : "Event Attendees";

      // Add sheets to workbook
      XLSX.utils.book_append_sheet(workbook, attendeesWorksheet, sheetName);
      XLSX.utils.book_append_sheet(workbook, detailsWorksheet, "Event Details");

      // Convert to array buffer
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      // Convert to Blob
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Get the event document to get the title (for standardized filename)
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);
      const eventData = eventSnap.data();

      // Create a standardized filename based on event title and attendee count
      const filePrefix = editedData.length === 1 ? "attendee" : "attendees";
      const standardFileName = `${eventData.title.replace(
        /\s+/g,
        "_"
      )}_${filePrefix}.xlsx`;

      // Determine the storage folder based on whether the event is public
      const storageFolder = eventData.isPublic
        ? "public/events"
        : `${currentUser.uid}/event_data`;
      const standardFilePath = `${storageFolder}/${standardFileName}`;

      // Always upload to Firebase Storage using this standard path
      const fileRef = ref(storage, standardFilePath);
      await uploadBytes(fileRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(fileRef);

      // Update the event in Firestore with all the attendee data
      const updatedEventData = {
        title: eventDetails.Title,
        description: eventDetails.Description,
        date: eventDetails.Date,
        time: eventDetails.Time ? convertTo24HourFormat(eventDetails.Time) : "",
        location: eventDetails.Location,
        category: eventDetails.Category,
        capacity: eventDetails.Capacity
          ? Number.parseInt(eventDetails.Capacity)
          : null,
        isPublic: eventDetails["Public Event"] === "Yes",
        lastUpdated: new Date().toISOString(),
        attendanceCount: editedData.length,
      };

      // Update the main events collection
      await updateDoc(eventRef, updatedEventData);

      // Also update the attendees count field (make sure it's consistent with editedData)
      await updateDoc(eventRef, {
        attendees: editedData.length,
      });

      // Get the document reference from Firestore for the attendee sheet
      const docsRef = collection(db, "eventDocuments");
      const docsQuery = query(
        docsRef,
        where("eventId", "==", eventId),
        where("documentType", "==", "attendeeSheet")
      );
      const docsSnapshot = await getDocs(docsQuery);

      if (!docsSnapshot.empty) {
        // Update existing document reference
        const docRef = docsSnapshot.docs[0].ref;
        await updateDoc(docRef, {
          fileUrl: downloadURL,
          fileName: standardFileName,
          updatedAt: new Date().toISOString(),
          documentType: "attendeeSheet",
          attendanceCount: editedData.length,
        });
      } else {
        // Create new document reference if it doesn't exist
        await addDoc(collection(db, "eventDocuments"), {
          eventId: eventId,
          documentType: "attendeeSheet",
          fileUrl: downloadURL,
          fileName: standardFileName,
          isPublic: eventData.isPublic,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attendanceCount: editedData.length,
        });
      }

      // Find any existing file records for this event
      const filesRef = collection(db, "files");
      const filesQuery = query(
        filesRef,
        where("relatedEventId", "==", eventId)
      );
      const filesSnapshot = await getDocs(filesQuery);

      // Get any existing file records that match our attendance sheet pattern
      const attendanceFileDoc = filesSnapshot.docs.find((doc) => {
        const data = doc.data();
        return data.name.includes("attendee");
      });

      if (attendanceFileDoc) {
        // Update the existing file record
        await updateDoc(attendanceFileDoc.ref, {
          name: standardFileName,
          path: standardFilePath,
          downloadURL: downloadURL,
          size: blob.size,
          updatedAt: new Date().toISOString(),
          fileType: "attendance_sheet",
          attendanceCount: editedData.length,
        });
      } else {
        // Create a new file record
        await addDoc(collection(db, "files"), {
          name: standardFileName,
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: blob.size,
          path: standardFilePath,
          downloadURL: downloadURL,
          userId: currentUser.uid,
          userName: currentUser.email,
          folder: storageFolder,
          isPublic: eventData.isPublic,
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sharedWith: [],
          relatedEventId: eventId,
          fileType: "attendance_sheet",
          attendanceCount: editedData.length,
        });
      }

      // Update eventAttendees collection to match the Excel data
      // First, get existing attendees for this event
      const attendeesRef = collection(db, "eventAttendees");
      const attendeesQuery = query(
        attendeesRef,
        where("eventId", "==", eventId)
      );
      const attendeesSnapshot = await getDocs(attendeesQuery);

      // Create a map of existing attendees by email for easy lookup
      const existingAttendees = {};
      attendeesSnapshot.forEach((doc) => {
        const data = doc.data();
        existingAttendees[data.userEmail] = {
          id: doc.id,
          ...data,
        };
      });

      // Create a set of emails in the current edited data for quick lookup
      const currentEmailsSet = new Set(
        editedData.map((attendee) => attendee.Email)
      );

      // Process each existing attendee - DELETE those not in editedData
      for (const email in existingAttendees) {
        if (!currentEmailsSet.has(email)) {
          // This attendee was deleted in the UI, remove from Firestore
          await deleteDoc(
            doc(db, "eventAttendees", existingAttendees[email].id)
          );
        }
      }

      // Process each attendee in editedData - UPDATE or CREATE
      for (const attendee of editedData) {
        const email = attendee.Email;

        if (!email) continue; // Skip entries with no email

        if (existingAttendees[email]) {
          // Update existing attendee
          await updateDoc(
            doc(db, "eventAttendees", existingAttendees[email].id),
            {
              userName: attendee.Name || "",
              status: attendee.Status || "Registered",
              notes: attendee.Notes || "",
              lastUpdated: new Date().toISOString(),
            }
          );
        } else {
          // Add new attendee
          await addDoc(collection(db, "eventAttendees"), {
            eventId: eventId,
            userId: "", // May be empty for manually added attendees
            userEmail: email,
            userName: attendee.Name || "",
            registeredAt:
              attendee["Registration Date"] || new Date().toISOString(),
            status: attendee.Status || "Registered",
            notes: attendee.Notes || "",
            registeredViaNFC: false,
            registeredByUserId: currentUser.uid,
            registeredByEmail: currentUser.email,
          });
        }
      }

      setFileName(standardFileName);
      
      if(fileName){
        showAlert({
          icon: "success",
          header: "Edit Event",
          description: "Event data saved successfully!",
          variant: "success",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#086d3f",
          descriptionColor: "#086d3f",
          borderColor: "#086d3f",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        });
      }else{
        showAlert({
          icon: "error",
          header: "Edit Event",
          description: "Event data saved successfully!",
          variant: "error",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#9c0505",
          descriptionColor: "#9c0505",
          borderColor: "#9c0505",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        });
      }
      
      // Update local state
      setFileData(blob);
      
      setOriginalEventDetails({ ...eventDetails });
    } catch (err) {
      console.error("Error saving changes:", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle field change
  const handleDataChange = (index, field, value) => {
    const updatedData = [...editedData];
    updatedData[index][field] = value;
    setEditedData(updatedData);
  };

  // Function to determine the dashboard route based on user role
  const getRoute = (userRole) => {
    switch (userRole) {
      case "admin":
        return "/admin/manage-events";
      case "registrar":
        return "/registrar/manage-events";
      case "teacher":
        return "/teacher/manage-events";
      case "student":
        return "/student/manage-events";
      default:
        return "/events";
    }
  };

  const handleNFCRegistration = () => {
    setShowNFCModal(true);
  };

  // Then add this to close the modal
  const handleCloseNFCModal = () => {
    setShowNFCModal(false);
  };

  // Add this to handle successful registration
  const handleNFCSuccess = () => {
    setShowNFCModal(false);
    setSuccess("Attendee registered successfully via NFC!");
  };

  // Delete a row
  const handleDeleteRow = (index) => {
    const updatedData = [...editedData];
    updatedData.splice(index, 1);
    setEditedData(updatedData);
  };

  // Filter data based on search term
  const filteredData = editedData.filter((row) => {
    if (!searchTerm) return true;

    // Search in all fields
    return Object.values(row).some((value) =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Sort data
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue < bValue) {
      return sortConfig.direction === "ascending" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === "ascending" ? 1 : -1;
    }
    return 0;
  });

  // Confirmation dialog for discarding changes
  const handleNavigateBack = () => {
    // Check if there are unsaved changes in attendees or event details
    const attendeesChanged =
      JSON.stringify(worksheetData) !== JSON.stringify(editedData);
    const detailsChanged =
      JSON.stringify(originalEventDetails) !== JSON.stringify(eventDetails);

    if (attendeesChanged || detailsChanged) {
      setShowConfirmation(true);
    } else {
      navigate(getRoute(userRole));
    }
  };

  // Get icon for event detail field
  const getDetailIcon = (field) => {
    switch (field) {
      case "Title":
        return <FileText className="h-5 w-5 text-[#0093cb]" />;
      case "Date":
        return <Calendar className="h-5 w-5 text-[#0093cb]" />;
      case "Time":
        return <Clock className="h-5 w-5 text-[#0093cb]" />;
      case "Location":
        return <MapPin className="h-5 w-5 text-[#0093cb]" />;
      case "Category":
        return <Tag className="h-5 w-5 text-[#0093cb]" />;
      case "Created By":
        return <User className="h-5 w-5 text-[#0093cb]" />;
      case "Public Event":
        return eventDetails[field] === "Yes" ? (
          <Globe className="h-5 w-5 text-[#0093cb]" />
        ) : (
          <Lock className="h-5 w-5 text-gray-500" />
        );
      default:
        return <Info className="h-5 w-5 text-[#0093cb]" />;
    }
  };

  // Get the appropriate header text based on attendance count
  const getAttendeeHeader = () => {
    return editedData.length === 0
      ? "No Attendees"
      : editedData.length === 1
      ? "Attendee"
      : "Attendees";
  };

  return (
    <div className="p-4 md:p-6 bg-[#f5ffff] min-h-screen">
      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="glass-card rounded-[1rem] p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[#172b4d]">
                Unsaved Changes
              </h3>
              <button
                onClick={() => setShowConfirmation(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-[#fffae6] border-l-4 border-[#ffab00] p-4 mb-5 rounded-md">
              <p className="text-[#5e6c84]">
                You have unsaved changes. Are you sure you want to leave this
                page?
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 border border-[#e0e6ed] rounded-[0.5rem] text-[#5e6c84] hover:bg-gray-50 transition-all duration-300 font-medium hover:shadow-md"
              >
                Cancel
              </button>
              <button
                onClick={() => navigate(getRoute(userRole))}
                className="px-4 py-2 btn-danger-gradient text-white rounded-[0.5rem] font-medium"
              >
                Leave Page
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 animate-slideIn">
        <div className="flex items-center">
          <button
            onClick={handleNavigateBack}
            className="mr-4 text-[#0093cb] hover:text-[#005acd] focus:outline-none focus:ring-2 focus:ring-[#0093cb] rounded-full p-2 bg-white shadow-sm transition-all duration-300 transform hover:scale-105"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-[#172b4d]">
            Edit Event Data
          </h1>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2.5 rounded-[0.5rem] text-sm font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg btn-gradient"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Notification area */}
      {error && (
        <div className="bg-[#ffebe6] border-l-4 border-[#ff5630] p-4 mb-6 rounded-lg flex items-start shadow-sm animate-fadeIn">
          <AlertCircle className="h-5 w-5 text-[#ff5630] mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-[#5e6c84]">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-[#e3fcef] border-l-4 border-[#36b37e] p-4 mb-6 rounded-lg flex items-start shadow-sm animate-fadeIn">
          <CheckCircle className="h-5 w-5 text-[#36b37e] mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-[#5e6c84]">{success}</div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="glass-card rounded-[1rem] shadow-sm overflow-hidden mb-6 border border-[#e0e6ed] hover-lift animate-fadeIn"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex border-b relative">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-6 py-4 flex items-center font-medium transition-colors relative ${
              activeTab === "details"
                ? "text-[#0093cb]"
                : "text-[#5e6c84] hover:text-[#172b4d]"
            }`}
            style={{ fontFamily: "'Open Sans', sans-serif" }}
          >
            <FileText
              className={`h-5 w-5 mr-2 ${
                activeTab === "details" ? "text-[#0093cb]" : "text-[#5e6c84]"
              }`}
            />
            Event Details
            {activeTab === "details" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#0093cb]"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("attendees")}
            className={`px-6 py-4 flex items-center font-medium transition-colors relative ${
              activeTab === "attendees"
                ? "text-[#0093cb]"
                : "text-[#5e6c84] hover:text-[#172b4d]"
            }`}
            style={{ fontFamily: "'Open Sans', sans-serif" }}
          >
            <Users
              className={`h-5 w-5 mr-2 ${
                activeTab === "attendees" ? "text-[#0093cb]" : "text-[#5e6c84]"
              }`}
            />
            {getAttendeeHeader()}
            {activeTab === "attendees" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#0093cb]"></span>
            )}
          </button>
        </div>
      </div>

      {/* Event Details Tab */}
      {activeTab === "details" && (
        <div
          className="glass-card rounded-[1rem] shadow-sm overflow-hidden border border-[#e0e6ed] hover-lift animate-fadeIn"
          style={{ animationDelay: "0.2s" }}
        >
          <div className=" p-5 border-b flex items-center">
            <FileText className="h-5 w-5 mr-3 text-[#0093cb]" />
            <div className="text-lg font-medium text-[#172b4d]">
              {event?.title
                ? `Event Details - ${event.title}`
                : "Loading event..."}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 text-[#0093cb] animate-spin mb-3" />
                <div className="text-[#5e6c84]">Loading event details...</div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(eventDetails).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col animate-fadeIn"
                    style={{
                      animationDelay: `${
                        0.1 * Object.keys(eventDetails).indexOf(key)
                      }s`,
                    }}
                  >
                    <label
                      className="text-sm font-medium text-[#172b4d] mb-2 flex items-center"
                      style={{ fontFamily: "'Open Sans', sans-serif" }}
                    >
                      {getDetailIcon(key)}
                      <span className="ml-2">{key}</span>
                    </label>
                    {key === "Description" ? (
                      <textarea
                        value={value || ""}
                        onChange={(e) =>
                          handleDetailChange(key, e.target.value)
                        }
                        className="p-3 border border-[#e0e6ed] rounded-[0.5rem] w-full focus:ring-2 focus:ring-[#0093cb] focus:border-[#0093cb] transition-colors input-animated"
                        rows={4}
                        disabled={key === "Created By" || key === "Created At"}
                      />
                    ) : key === "Public Event" ? (
                      <select
                        value={value || ""}
                        onChange={(e) =>
                          handleDetailChange(key, e.target.value)
                        }
                        className="p-3 border border-[#e0e6ed] rounded-[0.5rem] w-full focus:ring-2 focus:ring-[#0093cb] focus:border-[#0093cb] transition-colors input-animated"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    ) : key === "Date" ? (
                      <input
                        type="date"
                        value={value || ""}
                        onChange={(e) =>
                          handleDetailChange(key, e.target.value)
                        }
                        className="p-3 border border-[#e0e6ed] rounded-[0.5rem] w-full focus:ring-2 focus:ring-[#0093cb] focus:border-[#0093cb] transition-colors input-animated"
                        disabled={key === "Created By" || key === "Created At"}
                      />
                    ) : key === "Time" ? (
                      <input
                        type="text"
                        value={value || ""}
                        onChange={(e) =>
                          handleDetailChange(key, e.target.value)
                        }
                        className="p-3 border border-[#e0e6ed] rounded-[0.5rem] w-full focus:ring-2 focus:ring-[#0093cb] focus:border-[#0093cb] transition-colors input-animated"
                        disabled={key === "Created By" || key === "Created At"}
                      />
                    ) : (
                      <input
                        type="text"
                        value={value || ""}
                        onChange={(e) =>
                          handleDetailChange(key, e.target.value)
                        }
                        className="p-3 border border-[#e0e6ed] rounded-[0.5rem] w-full focus:ring-2 focus:ring-[#0093cb] focus:border-[#0093cb] transition-colors input-animated"
                        disabled={key === "Created By" || key === "Created At"}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendees Tab */}
      {activeTab === "attendees" && (
        <div
          className="glass-card rounded-[1rem] shadow-sm overflow-hidden border border-[#e0e6ed] hover-lift animate-fadeIn mb-6"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="p-5 border-b flex items-center justify-between">
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-3 text-[#0093cb]" />
              <div className="text-lg font-medium text-[#172b4d]">
                {getAttendeeHeader()}
              </div>
            </div>
            <div className="flex items-center">
              {fileName && (
                <div className="flex items-center text-sm text-[#5e6c84] mr-4">
                  <FileSpreadsheet className="h-4 w-4 mr-1 text-[#0093cb]" />
                  <span>{fileName}</span>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 text-[#0093cb] animate-spin mb-3" />
                <div className="text-[#5e6c84]">Loading attendance data...</div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6">
                {/* Search and Add Row */}
                <div className="flex justify-between mb-6 flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px] relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-[#5e6c84]" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search attendees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 p-3 border border-[#e0e6ed] rounded-[0.5rem] w-full focus:ring-2 focus:ring-[#0093cb] focus:border-[#0093cb] transition-colors input-animated"
                    />
                  </div>
                  <button
                    onClick={handleNFCRegistration}
                    className="px-4 py-2.5 rounded-[0.5rem] text-white flex items-center font-medium transition-all duration-300 shadow-md btn-gradient whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    NFC Registration
                  </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border border-[#e0e6ed]">
                  {editedData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <Users className="h-10 w-10 text-[#0093cb] mb-4" />
                      <h3 className="text-lg font-medium text-[#172b4d] mb-2">
                        No Attendees Yet
                      </h3>
                      <p className="text-[#5e6c84] max-w-md mb-4">
                        This event doesn't have any attendees yet. Add your
                        first attendee by clicking the "Add Attendee" button
                        above.
                      </p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-[#e0e6ed]">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(editedData[0]).map((column) => (
                            <th
                              key={column}
                              onClick={() => requestSort(column)}
                              className="px-4 py-3.5 text-left text-sm font-medium text-[#172b4d] cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center">
                                {column}
                                {sortConfig.key === column && (
                                  <span className="ml-1 text-[#0093cb]">
                                    {sortConfig.direction === "ascending" ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-3.5 text-right text-sm font-medium text-[#172b4d]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-[#e0e6ed]">
                        {sortedData.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="hover:bg-gray-50 transition-colors animate-fadeIn"
                            style={{
                              animationDelay: `${0.05 * rowIndex}s`,
                            }}
                          >
                            {Object.entries(row).map(
                              ([column, value], colIndex) => (
                                <td
                                  key={`${rowIndex}-${colIndex}`}
                                  className="px-4 py-3 text-sm text-[#172b4d]"
                                >
                                  <input
                                    type="text"
                                    value={value || ""}
                                    onChange={(e) =>
                                      handleDataChange(
                                        rowIndex,
                                        column,
                                        e.target.value
                                      )
                                    }
                                    className="p-2 border border-[#e0e6ed] rounded-md w-full focus:ring-2 focus:ring-[#0093cb] focus:border-[#0093cb] transition-colors input-animated"
                                  />
                                </td>
                              )
                            )}
                            <td className="px-4 py-3 text-sm text-right">
                              <button
                                onClick={() => handleDeleteRow(rowIndex)}
                                className="p-2 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                aria-label="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Pagination or summary could go here */}
              <div className="p-4 bg-gray-50 border-t border-[#e0e6ed] text-sm text-[#5e6c84] flex justify-between items-center">
                <div>
                  Total: {editedData.length}{" "}
                  {editedData.length === 1 ? "attendee" : "attendees"}
                </div>
                <div className="text-right">
                  {searchTerm && filteredData.length !== editedData.length && (
                    <span>
                      Showing {filteredData.length} of {editedData.length}{" "}
                      attendees
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {showNFCModal && (
        <div className="w-full container mx-auto p-6 max-w-4xl">
          <NFCRegistration
            eventId={eventId}
            onClose={handleCloseNFCModal}
            onSuccess={handleNFCSuccess}
          />
        </div>
      )}
    </div>
  );
}
