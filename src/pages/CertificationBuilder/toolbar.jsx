import {
  Undo,
  Redo,
  Grid,
  Calendar,
  Loader2,
  Save,
  Download,
  FileImage,
  FileIcon as FilePdf,
  ChevronLeft,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function Toolbar({
  historyIndex,
  historyLength,
  currentDesignName,
  showRulers,
  showGrid,
  saveStatus,
  selectedEvent,
  userEvents,
  isLoadingEvents,
  handleUndo,
  handleRedo,
  setCurrentDesignName,
  setShowRulers,
  setShowGrid,
  saveCurrentDesign,
  handleEventSelect,
  exportAsImage,
  exportAsPDF,
}) {
  const navigate = useNavigate()

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="w-fit inline-flex items-center px-4 py-2 bg-white border border-gray-300 shadow-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-2.5"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to List events
      </button>

      <div className="w-full bg-white border-b pb-2 mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <Undo size={18} />
          </button>
          <button
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            onClick={handleRedo}
            disabled={historyIndex >= historyLength - 1}
            title="Redo"
          >
            <Redo size={18} />
          </button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <input
            type="text"
            value={currentDesignName}
            onChange={(e) => setCurrentDesignName(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
            placeholder="Design name"
          />
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button
            className={`p-2 rounded ${showRulers ? "bg-blue-100" : "hover:bg-gray-100"}`}
            onClick={() => setShowRulers(!showRulers)}
            title="Toggle Rulers"
          >
            <Grid size={18} />
          </button>
          <button
            className={`p-2 rounded ${showGrid ? "bg-blue-100" : "hover:bg-gray-100"}`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid"
          >
            <Grid size={18} className="rotate-45" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Event Selector Dropdown */}
          <div className="relative">
            <select
              className="px-3 py-1 bg-white border rounded text-sm appearance-none pr-8"
              value={selectedEvent?.id || ""}
              onChange={(e) => handleEventSelect(e.target.value)}
              disabled={isLoadingEvents}
            >
              <option value="">Select an event</option>
              {userEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
              {isLoadingEvents ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveCurrentDesign}
            className={`p-2 rounded-lg ${
              saveStatus === "saving" ? "bg-blue-200" : saveStatus === "saved" ? "bg-green-200" : "hover:bg-gray-200"
            }`}
            title="Save design (choose public/private)"
          >
            {saveStatus === "saving" ? (
              <span className="text-blue-700">Saving...</span>
            ) : saveStatus === "saved" ? (
              <span className="text-green-700">Saved!</span>
            ) : (
              <Save size={20} />
            )}
          </button>
          <div className="dropdown relative group">
            <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center gap-1">
              <Download size={16} />
              <span>Export</span>
            </button>
            <div className="dropdown-menu absolute right-0 mt-1 bg-white shadow-lg rounded-md border p-1 hidden group-hover:block z-10">
              <button
                className="w-full px-3 py-1 text-left hover:bg-gray-100 rounded flex items-center gap-2"
                onClick={exportAsImage}
              >
                <FileImage size={16} />
                <span>Export as PNG</span>
              </button>
              <button
                className="w-full px-3 py-1 text-left hover:bg-gray-100 rounded flex items-center gap-2"
                onClick={exportAsPDF}
              >
                <FilePdf size={16} />
                <span>Export as PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
