import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, setDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Image,
  FileText,
  Tag,
  FileSpreadsheet,
  Globe,
  CalendarPlus,
  Key,
  Radio,
  Building,
  Users2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";

export default function CreateEvent() {
  const { currentUser, userRole, currentUserData } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    category: "academic",
    capacity: "",
    image: null,
    isPublic: true,
    isLive: true,
    eventCode: uuidv4().substring(0, 8).toUpperCase(),
    branch: "",
    organization: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [excelGenerated, setExcelGenerated] = useState(false);

  // Branch options
  const branches = [
    "ICCT Antipolo Branch",
    "ICCT Binangonan Branch",
    "ICCT San Mateo Branch",
    "ICCT Cogeo Branch",
    "ICCT Taytay Branch",
    "ICCT Cainta Main Campus",
    "ICCT Angono Branch",
    "ICCT Sumulong Branch",
  ];

  // Organization options
  const organizations = [
    "Computer Explorer Society", "CISCO Student Associatio", "CBA Club", "JPIA Chapter", "Criminology Society", "Educator's Society", "English Club", "Math Club", 
    "Engineering Students Society", "IECEP Chapter", "ICPEP Chapter", "Masscom Society", "Phychology Society", "Societas Hotelianos", "Lakbay", 
    "Medical Technology Society", "TECH-VOC Student Organization", "Taekwondo Club", "Sibol Theatrical Dance Group", "Yin Yang Dance Group","Blue Dragon Varsity Player",
    "Rhythm and Voice Chorale"
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Reset branch and organization when switching to public
    if (name === "isPublic" && checked) {
      setFormData((prev) => ({
        ...prev,
        branch: "",
        organization: "",
      }));
    }
  };

  const regenerateEventCode = () => {
    setFormData((prev) => ({
      ...prev,
      eventCode: uuidv4().substring(0, 8).toUpperCase(),
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to generate Excel file with event data
  const generateExcelFile = async (eventData) => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Create "Event Attendees" sheet
      const attendeesWs = XLSX.utils.aoa_to_sheet([
        ["Name", "Email", "Registration Date", "Status", "Notes"],
        // Empty rows for future attendees
      ]);

      // Set column widths for attendees sheet
      const attendeesColWidths = [
        { wch: 25 }, // Name
        { wch: 30 }, // Email
        { wch: 20 }, // Registration Date
        { wch: 15 }, // Status
        { wch: 30 }, // Notes
      ];
      attendeesWs["!cols"] = attendeesColWidths;

      // Add the attendees worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, attendeesWs, "Event Attendees");

      // Create "Event Details" sheet with branch and organization info
      const detailsData = [
        ["Title", eventData.title || ""],
        ["Description", eventData.description || ""],
        ["Date", eventData.date || ""],
        ["Time", eventData.time || ""],
        ["Location", eventData.location || ""],
        ["Category", eventData.category || ""],
        ["Capacity", eventData.capacity ? eventData.capacity.toString() : ""],
        ["Event Code", eventData.eventCode || ""],
        ["Live Event", eventData.isLive || "Yes"],
        ["Created By", currentUser.email],
        ["Created At", new Date().toLocaleString()],
        ["Public Event", eventData.isPublic ? "Yes" : "No"],
      ];

      // Add branch and organization info for private events
      if (!eventData.isPublic) {
        detailsData.push(["Branch", eventData.branch || "All branches"]);
        detailsData.push(["Organization", eventData.organization || "All organizations"]);
      }

      const detailsWs = XLSX.utils.aoa_to_sheet(detailsData);

      // Set column widths for details sheet
      const detailsColWidths = [
        { wch: 15 }, // Detail name
        { wch: 50 }, // Detail value
      ];
      detailsWs["!cols"] = detailsColWidths;

      // Add the details worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, detailsWs, "Event Details");

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const excelFile = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Upload Excel file to Firebase Storage
      // Store in a public folder if the event is public
      const storageFolder = eventData.isPublic
        ? "public/events"
        : `${currentUser.uid}/event_data`;

      const standardFileName = `${eventData.title.replace(
        /\s+/g,
        "_"
      )}_attendees.xlsx`;
      const excelFilePath = `${storageFolder}/${standardFileName}`;
      const excelRef = ref(storage, excelFilePath);

      await uploadBytes(excelRef, excelFile);
      const excelUrl = await getDownloadURL(excelRef);

      // Save the Excel file reference to Firestore files collection
      await addDoc(collection(db, "files"), {
        name: standardFileName,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: excelFile.size,
        path: excelFilePath,
        downloadURL: excelUrl,
        userId: currentUser.uid,
        userName: currentUser.email,
        folder: storageFolder,
        isPublic: eventData.isPublic,
        uploadedAt: new Date().toISOString(),
        sharedWith: [],
        relatedEventId: eventData.id, // Reference to the event this file belongs to
      });

      // Return the Excel file URL
      return excelUrl;
    } catch (error) {
      console.error("Error generating Excel file:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      setError("You must be logged in to create an event");
      return;
    }

    // Updated validation for private events - only require either branch OR organization
    if (!formData.isPublic && !formData.branch && !formData.organization) {
      setError("Please select either a branch or an organization for private events");
      return;
    }

    try {
      setLoading(true);
      setError("");

      let imageUrl = null;

      // Upload image if provided
      if (formData.image) {
        // Store in a public folder if the event is public
        const storageFolder = formData.isPublic
          ? "public/events"
          : `${currentUser.uid}/events`;
        const imagePath = `${storageFolder}/${Date.now()}_${
          formData.image.name
        }`;
        const imageRef = ref(storage, imagePath);

        await uploadBytes(imageRef, formData.image);
        imageUrl = await getDownloadURL(imageRef);
      }

      // Create event document with an explicit ID to make permissions easier to manage
      const eventId = doc(collection(db, "events")).id;

      const formatTimeWithAMPM = (time24) => {
        if (!time24) return "";
        
        const [hours24, minutes] = time24.split(':');
        const hours = parseInt(hours24, 10);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        
        return `${hours12}:${minutes} ${period}`;
      };

      // Create event document with permissions metadata and branch/organization info
      const eventData = {
        id: eventId,
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formatTimeWithAMPM(formData.time),
        location: formData.location,
        category: formData.category,
        capacity: Number.parseInt(formData.capacity),
        attendees: 0,
        isPublic: formData.isPublic,
        isLive: formData.isLive,
        eventCode: formData.eventCode,
        registrarId: currentUser.uid,
        registrarEmail: currentUserData.email,
        registrarName: currentUserData.name,
        createdAt: new Date().toISOString(),
        image: imageUrl,
        // Add branch and organization for private events (can be null for either)
        ...((!formData.isPublic) && {
          branch: formData.branch || null, // null means all branches
          organization: formData.organization || null, // null means all organizations
        })
      };

      // Add event to Firestore with the specified ID
      await setDoc(doc(db, "events", eventId), eventData);

      // Generate and upload Excel file
      const excelUrl = await generateExcelFile(eventData);

      // Store event permissions in a separate collection for easier query and security
      const permissionData = {
        eventId: eventId,
        ownerId: currentUser.uid,
        isPublic: formData.isPublic,
        editors: [currentUser.uid], // Only creator can edit
        viewers: formData.isPublic ? ["*"] : [currentUser.uid], // Public events can be viewed by anyone
        createdAt: new Date().toISOString(),
      };

      // Add branch and organization restrictions for private events
      if (!formData.isPublic) {
        permissionData.branch = formData.branch || null;
        permissionData.organization = formData.organization || null;
      }

      await setDoc(doc(db, "eventPermissions", eventId), permissionData);

      // Update event with Excel file URL
      await addDoc(collection(db, "eventDocuments"), {
        eventId: eventId,
        documentType: "attendeeSheet",
        fileUrl: excelUrl,
        fileName: `${eventData.title.replace(/\s+/g, "_")}_attendees.xlsx`,
        isPublic: formData.isPublic,
        createdAt: new Date().toISOString(),
      });

      setExcelGenerated(true);

      // Redirect to manage events page
      navigate(`/${userRole}/manage-events`);
    } catch (error) {
      setError("Failed to create event. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get visibility description
  const getVisibilityDescription = () => {
    if (formData.isPublic) {
      return "This event will be visible to everyone";
    }
    
    if (formData.branch && formData.organization) {
      return `${formData.organization} members in ${formData.branch}`;
    } else if (formData.branch && !formData.organization) {
      return `all members of ${formData.branch}`;
    } else if (!formData.branch && formData.organization) {
      return `all ${formData.organization} members across all branches`;
    } else {
      return "Please select either a branch or an organization";
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center space-x-3">
        <CalendarPlus className="h-6 w-6 text-indigo-600" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Create New Event
        </h1>
      </div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {excelGenerated && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Event created successfully! An Excel file has been generated and saved
          to your file manager.
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter event title"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex">
                  <input
                    type="text"
                    name="eventCode"
                    value={formData.eventCode}
                    onChange={handleChange}
                    readOnly
                    className="pl-10 flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={regenerateEventCode}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-r-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                This code can be used for accessing the event.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Time
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  required
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter event location"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Tag className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="academic">Academic</option>
                  <option value="sports">Sports</option>
                  <option value="cultural">Cultural</option>
                  <option value="workshop">Workshop</option>
                  <option value="seminar">Seminar</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacity
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  required
                  min="1"
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Maximum number of attendees"
                />
              </div>
            </div>

            {/* Updated Live Event Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Live Event
              </label>
              <div className="flex space-x-4 items-center">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="isLiveYes"
                    name="isLive"
                    value="true"
                    checked={formData.isLive === true}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isLive: e.target.value === "true",
                      }))
                    }
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label
                    htmlFor="isLiveYes"
                    className="ml-2 text-sm text-gray-700"
                  >
                    Yes
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="isLiveNo"
                    name="isLive"
                    value="false"
                    checked={formData.isLive === false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isLive: e.target.value === "true",
                      }))
                    }
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label
                    htmlFor="isLiveNo"
                    className="ml-2 text-sm text-gray-700"
                  >
                    No
                  </label>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Select 'Yes' if this event will be show in public-view
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Description
            </label>
            <div className="relative">
              <div className="absolute top-0 left-0 pl-3 pt-3 flex items-start pointer-events-none">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter event description"
              ></textarea>
            </div>
          </div>

          {/* Event Visibility Section */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Event Visibility</h3>
            
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="isPublic"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label
                htmlFor="isPublic"
                className="ml-2 flex items-center text-sm text-gray-700"
              >
                <Globe className="h-4 w-4 mr-1 text-gray-500" />
                Make this event public (visible to everyone)
              </label>
            </div>

            {/* Branch and Organization Selection for Private Events */}
            {!formData.isPublic && (
              <div className="space-y-4 pl-6 border-l-2 border-indigo-200">
                <p className="text-sm text-gray-600 mb-3">
                  Configure who can see this private event (select either branch, organization, or both):
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Branch (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      name="branch"
                      value={formData.branch}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All branches</option>
                      {branches.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to include all branches
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Organization (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Users2 className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      name="organization"
                      value={formData.organization}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All organizations</option>
                      {organizations.map((org) => (
                        <option key={org} value={org}>
                          {org}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to include all organizations
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Visibility:</strong> This event will be visible to{' '}
                    {getVisibilityDescription()}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Image
            </label>
            <div className="mt-1 flex items-center">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Image className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {imagePreview && (
              <div className="mt-2">
                <img
                  src={imagePreview || "/placeholder.svg"}
                  alt="Preview"
                  className="h-32 w-auto object-cover rounded-md"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 p-3 bg-gray-50 rounded-md">
            <FileSpreadsheet className="h-5 w-5 text-gray-500" />
            <span>
              An Excel file will be automatically generated and saved to your
              file manager for tracking attendees.
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-white font-medium py-2 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
            >
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}