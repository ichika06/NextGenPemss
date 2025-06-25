/**
 * Component for managing files and folders in a file manager interface.
 * @param {{boolean}} sharedWithUsers - Flag to indicate if files are shared with the current user.
 * @returns A file manager interface with options to upload, delete, share files, create folders, and view events.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase/config";
import {
  Trash2,
  Upload,
  Download,
  FileText,
  Search,
  FolderPlus,
  Folder,
  ChevronLeft,
  Share2,
  FileEdit,
  CheckCircle,
  Calendar,
  Users,
  Tag,
  MapPin,
  Grid,
  List,
  X,
  AlertCircle,
  Home,
  Plus,
  Clock,
  ExternalLink,
  ImageIcon,
  Music,
  Video,
  FileIcon as FilePdf,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  FileQuestion,
  BellRing,
  FolderOpen
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import CountdownDisplay from "../components/CountingDisplay";
import { LoadingAnimation } from "../components/LoadingAnimation";

const FileManager = ({ sharedWithUsers = false }) => {
  const { currentUser, userRole } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("");
  const [folderHistory, setFolderHistory] = useState([]);
  const [folders, setFolders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sortBy, setSortBy] = useState("dateDesc");
  const [viewMode, setViewMode] = useState("grid");
  const [showShareModal, setShowShareModal] = useState(false);
  const [fileToShare, setFileToShare] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsersToShare, setSelectedUsersToShare] = useState([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [fileToRename, setFileToRename] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [activeTab, setActiveTab] = useState("files");
  const [publicEvents, setPublicEvents] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch files and folders
  useEffect(() => {
    if (currentUser) {
      setIsLoading(true);
      fetchFilesAndFolders().finally(() => setIsLoading(false));
      fetchUsers();

      // Fetch public events when tab is selected
      if (activeTab === "events") {
        fetchPublicEvents();
      }
    }
  }, [currentUser, currentFolder, sharedWithUsers, activeTab]);

  const fetchUsers = async () => {
    if (userRole !== "admin" && userRole !== "registrar") return;

    try {
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((user) => user.id !== currentUser.uid); // Exclude current user

      setAvailableUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchPublicEvents = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      // Fetch events created by the current user that are public
      const eventsQuery = query(
        collection(db, "events"),
        where("registrarId", "==", currentUser.uid),
        where("isPublic", "==", true)
      );

      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        type: "event",
      }));

      setPublicEvents(eventsData);
    } catch (error) {
      console.error("Error fetching public events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilesAndFolders = async () => {
    if (!currentUser) return;

    try {
      // Initialize queries for files and folders
      let filesQuery;
      let foldersQuery;

      if (sharedWithUsers) {
        // Fetch files shared with the current user
        filesQuery = query(
          collection(db, "files"),
          where("sharedWith", "array-contains", currentUser.uid)
        );
      } else {
        // Fetch files owned by the current user in the current folder
        filesQuery = query(
          collection(db, "files"),
          where("userId", "==", currentUser.uid),
          where("folder", "==", currentFolder)
        );

        // Fetch folders owned by the current user that are direct children of the current folder
        foldersQuery = query(
          collection(db, "folders"),
          where("userId", "==", currentUser.uid),
          where("parent", "==", currentFolder)
        );

        // Fetch folders
        const foldersSnapshot = await getDocs(foldersQuery);
        const foldersData = foldersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          isFolder: true,
        }));
        setFolders(foldersData);
      }

      // Fetch files
      const filesSnapshot = await getDocs(filesQuery);
      const filesData = filesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        isFolder: false,
      }));
      setFiles(filesData);
    } catch (error) {
      console.error("Error fetching files and folders:", error);
    }
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split(".").pop().toLowerCase();
        const timestamp = new Date().getTime();
        const fileName = `${file.name.split(".")[0]
          }_${timestamp}.${fileExtension}`;
        const filePath = currentFolder
          ? `${currentUser.uid}/${currentFolder}/${fileName}`
          : `${currentUser.uid}/${fileName}`;

        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        // Monitor upload progress
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Upload failed:", error);
            setIsUploading(false);
          },
          async () => {
            // Upload completed, get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // Save file metadata to Firestore
            await addDoc(collection(db, "files"), {
              name: file.name,
              type: file.type,
              size: file.size,
              path: filePath,
              downloadURL: downloadURL,
              userId: currentUser.uid,
              userName: currentUser.email,
              folder: currentFolder,
              uploadedAt: serverTimestamp(),
              sharedWith: [],
            });

            // If this is the last file, reset upload state and refresh the file list
            if (i === files.length - 1) {
              setIsUploading(false);
              setUploadProgress(0);
              fetchFilesAndFolders();
            }
          }
        );
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setIsUploading(false);
    }
  };

  // Delete file or folder
  const handleDelete = async (item) => {
    try {
      if (item.isFolder) {
        // Delete folder from Firestore
        await deleteDoc(doc(db, "folders", item.id));

        // Delete all files and subfolders inside this folder (recursive deletion would be better)
        // This is a simplified approach
        const filesInFolder = query(
          collection(db, "files"),
          where("userId", "==", currentUser.uid),
          where("folder", "==", item.id)
        );
        const filesSnapshot = await getDocs(filesInFolder);

        for (const fileDoc of filesSnapshot.docs) {
          const filePath = fileDoc.data().path;
          const fileRef = ref(storage, filePath);
          await deleteObject(fileRef);
          await deleteDoc(fileDoc.ref);
        }
      } else {
        // Delete file from Storage
        const fileRef = ref(storage, item.path);
        await deleteObject(fileRef);

        // Delete file metadata from Firestore
        await deleteDoc(doc(db, "files", item.id));
      }

      // Refresh the list
      fetchFilesAndFolders();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  // Create a new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert("Please enter a folder name");
      return;
    }

    try {
      await addDoc(collection(db, "folders"), {
        name: newFolderName,
        userId: currentUser.uid,
        userName: currentUser.email,
        createdAt: serverTimestamp(),
        parent: currentFolder,
      });

      // Reset and refresh
      setNewFolderName("");
      setShowNewFolderInput(false);
      fetchFilesAndFolders();
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  // Navigate into a folder
  const handleFolderClick = (folder) => {
    setFolderHistory([...folderHistory, currentFolder]);
    setCurrentFolder(folder.id);
  };

  // Navigate back to parent folder
  const handleBackClick = () => {
    if (folderHistory.length > 0) {
      const prevFolder = folderHistory[folderHistory.length - 1];
      setCurrentFolder(prevFolder);
      setFolderHistory(folderHistory.slice(0, -1));
    } else if (currentFolder) {
      setCurrentFolder("");
    }
  };

  // Navigate to root folder
  const handleHomeClick = () => {
    setCurrentFolder("");
    setFolderHistory([]);
  };

  // Share a file with other users
  const handleShareFile = (file) => {
    setFileToShare(file);
    setSelectedUsersToShare([]);
    setShowShareModal(true);
  };

  const handleConfirmShare = async () => {
    if (!fileToShare || selectedUsersToShare.length === 0) return;

    try {
      const fileRef = doc(db, "files", fileToShare.id);
      await updateDoc(fileRef, {
        sharedWith: [
          ...(fileToShare.sharedWith || []),
          ...selectedUsersToShare,
        ],
      });

      setShowShareModal(false);
      fetchFilesAndFolders();
    } catch (error) {
      console.error("Error sharing file:", error);
    }
  };

  // Handle file/folder selection
  const toggleSelectItem = (item) => {
    if (selectedFiles.some((f) => f.id === item.id)) {
      setSelectedFiles(selectedFiles.filter((f) => f.id !== item.id));
    } else {
      setSelectedFiles([...selectedFiles, item]);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;

    setItemToDelete({ isBulk: true, count: selectedFiles.length });
    setShowDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    try {
      for (const item of selectedFiles) {
        await handleDelete(item);
      }
      setSelectedFiles([]);
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Error performing bulk delete:", error);
    }
  };

  // Handle file renaming
  const startRenaming = (file) => {
    setIsRenaming(true);
    setFileToRename(file);
    setNewFileName(file.name);
  };

  const handleRename = async () => {
    if (!fileToRename || !newFileName.trim()) return;

    try {
      const fileRef = doc(db, "files", fileToRename.id);
      await updateDoc(fileRef, {
        name: newFileName,
      });

      setIsRenaming(false);
      setFileToRename(null);
      setNewFileName("");
      fetchFilesAndFolders();
    } catch (error) {
      console.error("Error renaming file:", error);
    }
  };

  // View event details
  const handleViewEvent = (eventId) => {
    navigate(`/events/${eventId}`);
  };

  // Sort and filter files/folders
  const getSortedItems = () => {
    const allItems = [...folders, ...files];

    // Filter by search query if any
    const filteredItems = searchQuery
      ? allItems.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      : allItems;

    // Sort items
    return filteredItems.sort((a, b) => {
      // Always put folders before files
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      switch (sortBy) {
        case "nameAsc":
          return a.name.localeCompare(b.name);
        case "nameDesc":
          return b.name.localeCompare(a.name);
        case "dateAsc":
          return (
            (a.uploadedAt || a.createdAt)?.seconds -
            (b.uploadedAt || b.createdAt)?.seconds
          );
        case "dateDesc":
        default:
          return (
            (b.uploadedAt || b.createdAt)?.seconds -
            (a.uploadedAt || a.createdAt)?.seconds
          );
      }
    });
  };

  // Sort public events
  const getSortedEvents = () => {
    const filteredEvents = searchQuery
      ? publicEvents.filter((event) =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      : publicEvents;

    return filteredEvents.sort((a, b) => {
      switch (sortBy) {
        case "nameAsc":
          return a.title.localeCompare(b.title);
        case "nameDesc":
          return b.title.localeCompare(a.title);
        case "dateAsc":
          return new Date(a.date) - new Date(b.date);
        case "dateDesc":
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Get file icon based on type
  const getFileIcon = (file) => {
    const type = file.type || "";
    const name = file.name || "";
    const extension = name.split(".").pop().toLowerCase();

    // Check by MIME type first
    if (type.includes("image"))
      return <ImageIcon className="h-10 w-10 text-purple-500" />;
    if (type.includes("pdf"))
      return <FilePdf className="h-10 w-10 text-red-500" />;
    if (type.includes("word") || type.includes("document"))
      return <FileText className="h-10 w-10 text-blue-500" />;
    if (type.includes("excel") || type.includes("sheet"))
      return <FileSpreadsheet className="h-10 w-10 text-green-500" />;
    if (type.includes("video"))
      return <Video className="h-10 w-10 text-pink-500" />;
    if (type.includes("audio"))
      return <Music className="h-10 w-10 text-yellow-500" />;

    // Then check by extension
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension))
      return <ImageIcon className="h-10 w-10 text-purple-500" />;
    if (["pdf"].includes(extension))
      return <FilePdf className="h-10 w-10 text-red-500" />;
    if (["doc", "docx", "txt", "rtf"].includes(extension))
      return <FileText className="h-10 w-10 text-blue-500" />;
    if (["xls", "xlsx", "csv"].includes(extension))
      return <FileSpreadsheet className="h-10 w-10 text-green-500" />;
    if (["mp4", "avi", "mov", "wmv", "webm"].includes(extension))
      return <Video className="h-10 w-10 text-pink-500" />;
    if (["mp3", "wav", "ogg", "flac"].includes(extension))
      return <Music className="h-10 w-10 text-yellow-500" />;
    if (["zip", "rar", "7z", "tar", "gz"].includes(extension))
      return <FileArchive className="h-10 w-10 text-amber-500" />;
    if (
      ["html", "css", "js", "jsx", "ts", "tsx", "json", "php", "py"].includes(
        extension
      )
    )
      return <FileCode className="h-10 w-10 text-emerald-500" />;

    // Default file icon
    return <FileQuestion className="h-10 w-10 text-gray-400" />;
  };

  // Get breadcrumb path
  const getBreadcrumbPath = () => {
    if (!currentFolder) return [{ name: "Home", id: "" }];

    // This is a simplified approach - ideally you would fetch folder names from Firestore
    const path = [{ name: "Home", id: "" }];

    // Add current folder
    const currentFolderData = folders.find((f) => f.id === currentFolder);
    if (currentFolderData) {
      path.push({ name: currentFolderData.name, id: currentFolder });
    } else {
      path.push({ name: "Current Folder", id: currentFolder });
    }

    return path;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center mb-6">
          <Folder className="h-6 w-6 text-indigo-600 dark:text-indigo-300 mr-3" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">File Manager</h1>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden mx-4 sm:mx-6 lg:mx-8">
          {/* Header with tabs */}
          <div className="border-b border-gray-200 dark:border-zinc-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 py-4">
              <div className="flex items-center space-x-4">
                <FolderOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 sm:mb-0">
                  {sharedWithUsers ? "Files Shared With Me" : "My Files"}
                </h2>
              </div>

              {!sharedWithUsers && (
                <div className="flex space-x-1 bg-gray-100 dark:bg-zinc-900 p-1 rounded-lg">
                  <button
                    onClick={() => setActiveTab("files")}
                    className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "files"
                        ? "bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                  >
                    <FileText className="h-4 w-4 inline mr-1.5" /> Files
                  </button>
                  <button
                    onClick={() => setActiveTab("events")}
                    className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "events"
                        ? "bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-1.5" /> Public Events
                  </button>
                </div>
              )}
            </div>
          </div>

          {activeTab === "files" && (
            <div className="p-4 sm:p-6">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                {/* Navigation and breadcrumbs */}
                {!sharedWithUsers && (
                  <div className="flex items-center space-x-1 bg-gray-50 dark:bg-zinc-900 p-1 rounded-lg">
                    <button
                      onClick={handleHomeClick}
                      className="p-2 rounded-md hover:bg-gray-200 text-gray-600 transition-colors"
                      title="Go to root folder"
                    >
                      <Home className="h-5 w-5" />
                    </button>

                    <button
                      onClick={handleBackClick}
                      className={`p-2 rounded-md transition-colors ${!currentFolder && folderHistory.length === 0
                        ? "text-gray-300 cursor-not-allowed"
                        : "hover:bg-gray-200 text-gray-600"
                        }`}
                      disabled={!currentFolder && folderHistory.length === 0}
                      title="Go back"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="flex items-center overflow-x-auto whitespace-nowrap px-2 py-1">
                      {getBreadcrumbPath().map((item, index, array) => (
                        <div key={item.id} className="flex items-center">
                          <button
                            onClick={() => {
                              if (index === 0) {
                                handleHomeClick();
                              } else {
                                // This is simplified - you would need to reconstruct the folder history
                                setCurrentFolder(item.id);
                              }
                            }}
                            className="text-sm hover:text-indigo-600 transition-colors"
                          >
                            {item.name}
                          </button>
                          {index < array.length - 1 && (
                            <ChevronLeft className="h-4 w-4 mx-1 rotate-180 text-gray-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="relative w-full sm:w-64 md:w-80">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>
              </div>

              {/* Actions toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-gray-50 dark:bg-gray-600 p-3 rounded-lg">
                {/* Left side actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {!sharedWithUsers && (
                    <>
                      <button
                        onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                        className="flex items-center px-3 py-2 bg-white border dark:bg-gray-600 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 rounded-lg text-sm font-medium transition-colors"
                      >
                        <FolderPlus className="h-4 w-4 mr-1.5 text-indigo-500" />
                        New Folder
                      </button>

                      <label className="flex items-center px-3 py-2 btn-primary text-white rounded-lg cursor-pointer text-sm font-medium transition-colors">
                        <Upload className="h-4 w-4 mr-1.5" />
                        Upload Files
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </>
                  )}

                  {selectedFiles.length > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center px-3 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete Selected ({selectedFiles.length})
                    </button>
                  )}
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-2 ">
                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400
      ${viewMode === "grid"
                          ? "bg-indigo-50 dark:bg-indigo-900 text-indigo-600"
                          : "bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
                        }`}
                      title="Grid view"
                      aria-label="Grid view"
                      type="button"
                    >
                      <Grid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400
      ${viewMode === "list"
                          ? "bg-indigo-50 dark:bg-indigo-900 text-indigo-600"
                          : "bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
                        }`}
                      title="List view"
                      aria-label="List view"
                      type="button"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="p-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="dateDesc">Newest First</option>
                    <option value="dateAsc">Oldest First</option>
                    <option value="nameAsc">Name (A-Z)</option>
                    <option value="nameDesc">Name (Z-A)</option>
                  </select>
                </div>
              </div>

              {/* New folder input */}
              {showNewFolderInput && !sharedWithUsers && (
                <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <Folder className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Enter folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateFolder}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewFolderInput(false)}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Upload progress */}
              {isUploading && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700 flex items-center">
                      <Upload className="h-4 w-4 mr-1.5" /> Uploading files...
                    </span>
                    <span className="text-sm font-medium text-blue-700">
                      {Math.round(uploadProgress)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-100 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Files and folders content */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <LoadingAnimation
                    type="spinner"
                    size="md"
                    variant="primary"
                    text="Loading your file, please wait..."
                  />
                </div>
              ) : getSortedItems().length > 0 ? (
                <div
                  className={`
                ${viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                    : "divide-y divide-gray-200"
                  }
              `}
                >
                  {getSortedItems().map((item) => (
                    <div
                      key={item.id}
                      className={`
                        ${viewMode === "grid"
                          ? "border border-gray-200 dark:border-zinc-700 rounded-lg p-4 hover:border-indigo-300 dark:hover:border-indigo-400 hover:shadow-md transition-all"
                          : "py-4 px-3 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
                        }
                        ${selectedFiles.some((f) => f.id === item.id)
                          ? "bg-indigo-50 dark:bg-zinc-900 border-indigo-300 dark:border-indigo-400"
                          : ""
                        }
                        relative group
                      `}
                    >
                      {/* Selection checkbox */}
                      <div
                        className={`${viewMode === "grid"
                          ? "absolute top-2 left-2"
                          : "absolute left-0 top-1/2 transform -translate-y-1/2"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.some((f) => f.id === item.id)}
                          onChange={() => toggleSelectItem(item)}
                          className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Item content */}
                      <div
                        className={`
                    ${viewMode === "grid"
                          ? "flex flex-col items-center pt-4"
                          : "flex items-center pl-6"
                        }
                  `}
                      >
                        {/* File/folder icon */}
                        <div
                          className={`
                        ${viewMode === "grid" ? "mb-3" : "mr-4"}
                        ${item.isFolder ? "text-yellow-500" : ""}
                      `}
                          onClick={() =>
                            item.isFolder ? handleFolderClick(item) : null
                          }
                        >
                          {item.isFolder ? (
                            <Folder
                              className={`${viewMode === "grid" ? "h-16 w-16" : "h-10 w-10"
                                } text-yellow-500`}
                            />
                          ) : (
                            getFileIcon(item)
                          )}
                        </div>

                        {/* File/folder details */}
                        <div
                          className={`
                      ${viewMode === "grid" ? "w-full text-center" : "flex-grow"
                          }
                    `}
                        >
                          {isRenaming && fileToRename?.id === item.id ? (
                            <div className="flex items-center mb-1">
                              <input
                                type="text"
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                className="p-1 border border-gray-300 rounded text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                              />
                              <button
                                onClick={handleRename}
                                className="ml-1 text-green-500 p-1 rounded-full hover:bg-green-50"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              className={`font-medium truncate cursor-pointer ${viewMode === "grid" ? "text-center mb-1" : ""
                                } ${item.isFolder
                                ? "text-yellow-700 hover:text-yellow-900"
                                : "text-gray-700 hover:text-gray-900"
                              }`}
                              onClick={() =>
                                item.isFolder ? handleFolderClick(item) : null
                              }
                              title={item.name}
                            >
                              {item.name}
                            </div>
                          )}

                          <div
                            className={`text-xs text-gray-500 ${viewMode === "grid"
                              ? "text-center"
                              : "flex flex-wrap gap-x-4"
                              }`}
                          >
                            <span className="inline-flex items-center">
                              {item.isFolder ? "Folder" : formatFileSize(item.size)}
                            </span>

                            <span className="inline-flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(item.uploadedAt || item.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Actions buttons */}
                        <div
                          className={`
                        ${viewMode === "grid"
                            ? "mt-3 flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            : "flex space-x-1 ml-2"
                          }
                      `}
                        >
                          {!item.isFolder && (
                            <a
                              href={item.downloadURL}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          )}

                          {!sharedWithUsers && !item.isFolder && (
                            <button
                              onClick={() => startRenaming(item)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                              title="Rename"
                            >
                              <FileEdit className="h-4 w-4" />
                            </button>
                          )}

                          {!sharedWithUsers &&
                            (userRole === "admin" || userRole === "registrar") &&
                            !item.isFolder && (
                              <button
                                onClick={() => handleShareFile(item)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                title="Share"
                              >
                                <Share2 className="h-4 w-4" />
                              </button>
                            )}

                          {!sharedWithUsers && (
                            <button
                              onClick={() => {
                                setItemToDelete(item);
                                setShowDeleteModal(true);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-700 mb-4">
                    {searchQuery ? (
                      <Search className="h-8 w-8 text-gray-400" />
                    ) : sharedWithUsers ? (
                      <Share2 className="h-8 w-8 text-gray-400" />
                    ) : (
                      <FileText className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No files found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                    {searchQuery
                      ? "No files or folders match your search query. Try a different search term."
                      : sharedWithUsers
                        ? "No files have been shared with you yet."
                        : "Upload files or create folders to get started."}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <X className="h-4 w-4 mr-1.5" /> Clear Search
                    </button>
                  )}
                  {!searchQuery && !sharedWithUsers && (
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                      <button
                        onClick={() => setShowNewFolderInput(true)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <FolderPlus className="h-4 w-4 mr-1.5" /> Create Folder
                      </button>
                      <label className="inline-flex items-center px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 transition-colors cursor-pointer">
                        <Upload className="h-4 w-4 mr-1.5" /> Upload Files
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Public Events Tab */}
          {activeTab === "events" && (
            <div className="p-4 sm:p-6 ">
              <div className="flex flex-col gap-4 mb-6 ">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    My Public Events
                  </h3>

                  <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search events..."
                      className="pl-9 w-full md:w-80 h-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="dateDesc">Newest First</option>
                    <option value="dateAsc">Oldest First</option>
                    <option value="nameAsc">Title (A-Z)</option>
                    <option value="nameDesc">Title (Z-A)</option>
                  </select>
                </div>
              </div>

              {/* Events grid */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <LoadingAnimation
                    type="spinner"
                    size="md"
                    variant="primary"
                    text="Loading public events, please wait..."
                  />
                </div>
              ) : getSortedEvents().length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getSortedEvents().map((event) => (
                    <div
                      key={event.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md hover:border-indigo-200 group"
                    >
                      {event.image ? (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={event.image || "/placeholder.svg"}
                            alt={event.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                      ) : (
                        <div className="h-48 bg-gradient-to-r from-indigo-50 to-blue-50 flex items-center justify-center">
                          <Calendar className="h-12 w-12 text-indigo-300" />
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            <Tag className="h-3 w-3 mr-1" />
                            {event.category?.charAt(0).toUpperCase() +
                              event.category?.slice(1) || "General"}
                          </span>

                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            <Users className="h-3 w-3 mr-1" />
                            {event.attendees || 0} / {event.capacity || "∞"}
                          </span>
                        </div>

                        <h2 className="text-xl font-semibold line-clamp-1 group-hover:text-indigo-600 transition-colors">
                          {event.title}
                        </h2>

                        <div className="space-y-3 mt-3">
                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar className="h-4 w-4 mr-2 flex-shrink-0 text-indigo-400" />
                            <span>{new Date(event.date).toLocaleDateString()}</span>
                          </div>

                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-indigo-400" />
                            <span className="truncate">
                              {event.location || "No location specified"}
                            </span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <BellRing className="h-4 w-4 mr-2 text-indigo-500" />
                            <CountdownDisplay
                              eventDate={event.date}
                              eventTime={event.time}
                              showSeconds={true}
                              expiredText="Not Available"
                            />
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                            {event.description || "No description available"}
                          </p>
                        </div>

                        <div className="mt-4">
                          <button
                            onClick={() => handleViewEvent(event.id)}
                            className="w-full btn-primary text-white font-medium py-2 px-4 rounded-lg text-sm transition duration-150 ease-in-out flex items-center justify-center"
                          >
                            <ExternalLink className="h-4 w-4 mr-1.5" /> View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Calendar className="h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Events Found</h3>
                    {searchQuery ? (
                      <p className="text-gray-600 mb-6">
                        No events match your search for "{searchQuery}"
                      </p>
                    ) : (
                      <p className="text-gray-600 mb-6">
                        You don't have any public events yet
                      </p>
                    )}
                    {searchQuery ? (
                      <button
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => setSearchQuery("")}
                      >
                        Clear Search
                      </button>
                    ) : (
                      <button
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        onClick={() => navigate("/registrar/create-event")}
                      >
                        <Plus className="h-4 w-4 inline mr-1.5" /> Create Event
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Share modal */}
          {showShareModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center mb-4">
                  <Share2 className="h-5 w-5 text-indigo-500 mr-2" />
                  <h3 className="text-lg font-semibold">Share with Users</h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Select users to share "{fileToShare?.name}" with:
                </p>

                <div className="max-h-60 overflow-y-auto mb-4 border rounded-lg divide-y">
                  {availableUsers.length > 0 ? (
                    availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center p-3 hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          id={`user-${user.id}`}
                          checked={selectedUsersToShare.includes(user.id)}
                          onChange={() => {
                            if (selectedUsersToShare.includes(user.id)) {
                              setSelectedUsersToShare(
                                selectedUsersToShare.filter((id) => id !== user.id)
                              );
                            } else {
                              setSelectedUsersToShare([
                                ...selectedUsersToShare,
                                user.id,
                              ]);
                            }
                          }}
                          className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 mr-3"
                        />
                        <label
                          htmlFor={`user-${user.id}`}
                          className="flex-grow cursor-pointer"
                        >
                          <div className="font-medium">
                            {user.displayName || user.name || "User"}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No users available
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmShare}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
                    disabled={selectedUsersToShare.length === 0}
                  >
                    <Share2 className="h-4 w-4 mr-1.5" />
                    Share with {selectedUsersToShare.length} user
                    {selectedUsersToShare.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Confirm Deletion</h3>
                </div>

                <p className="text-center text-gray-600 mb-6">
                  {itemToDelete?.isBulk
                    ? `Are you sure you want to delete ${itemToDelete.count} selected items? This action cannot be undone.`
                    : `Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`}
                </p>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-center gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setItemToDelete(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={
                      itemToDelete?.isBulk
                        ? confirmBulkDelete
                        : () => handleDelete(itemToDelete)
                    }
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileManager;
