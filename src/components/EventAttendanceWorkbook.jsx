import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';

export default function EventAttendanceWorkbook({ 
  eventData, 
  onWorkbookCreated = null, 
  showDownloadButton = true,
  initialAttendees = []
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [workbookBlob, setWorkbookBlob] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, creating, success, error
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Creates a new attendance workbook for the event
   * @param {Object} eventData The event data
   * @returns {Object} XLSX workbook object
   */
  const createNewAttendanceWorkbook = (eventData) => {
    try {
      const workbook = XLSX.utils.book_new();

      // Create "Event Attendees" sheet
      const headers = ["Name", "Email", "Registration Date", "Status", "Notes"];
      
      // Start with headers row
      const attendeesData = [headers];
      
      // Add any initial attendees if provided
      if (initialAttendees && initialAttendees.length > 0) {
        initialAttendees.forEach(attendee => {
          attendeesData.push([
            attendee.name || '',
            attendee.email || '',
            attendee.registeredDate || '',
            attendee.status || 'Registered',
            attendee.notes || ''
          ]);
        });
      }
      
      const attendeesWs = XLSX.utils.aoa_to_sheet(attendeesData);

      // Set column widths for attendees sheet
      const attendeesColWidths = [
        { wch: 50 }, // Name
        { wch: 50 }, // Email
        { wch: 50 }, // Registration Date
        { wch: 50 }, // Status
        { wch: 50 }, // Notes
      ];
      attendeesWs["!cols"] = attendeesColWidths;

      // Add the attendees worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, attendeesWs, "Event Attendees");

      // Create "Event Details" sheet
      const detailsWs = XLSX.utils.aoa_to_sheet([
        ["Title", eventData.title || ""],
        ["Description", eventData.description || ""],
        ["Date", eventData.date || ""],
        ["Time", eventData.time || ""],
        ["Location", eventData.location || ""],
        ["Category", eventData.category || ""],
        ["Capacity", eventData.capacity || ""],
        ["Created By", eventData.createdBy || ""],
        ["Created At", eventData.createdAt || ""],
        ["Public Event", eventData.isPublic ? "No" : "Yes"],
        ["Live Event", eventData.isLive ? "No" : "Yes"],
      ]);

      // Set column widths for details sheet
      const detailsColWidths = [
        { wch: 15 }, // Detail name
        { wch: 50 }, // Detail value
      ];
      detailsWs["!cols"] = detailsColWidths;

      // Add the details worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, detailsWs, "Event Details");

      return workbook;
    } catch (error) {
      console.error("Error creating attendance workbook:", error);
      throw new Error(`Failed to create attendance workbook: ${error.message}`);
    }
  };

  /**
   * Handle creating and downloading the workbook
   */
  const handleCreateWorkbook = async () => {
    if (!eventData) {
      setStatus('error');
      setErrorMessage('Event data is required to create a workbook');
      return;
    }

    setIsCreating(true);
    setStatus('creating');
    
    try {
      // Create the workbook
      const workbook = createNewAttendanceWorkbook(eventData);
      
      // Convert to array buffer
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      // Convert to Blob
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      
      // Save the blob
      setWorkbookBlob(blob);
      setStatus('success');
      
      // Call callback if provided
      if (onWorkbookCreated) {
        onWorkbookCreated({
          workbook,
          blob,
          fileName: `${eventData.title.replace(/\s+/g, "_")}_attendees.xlsx`
        });
      }
    } catch (error) {
      console.error("Error creating workbook:", error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to create attendance workbook');
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle downloading the workbook
   */
  const handleDownloadWorkbook = () => {
    if (!workbookBlob) return;
    
    // Create a safe filename
    const fileName = `${eventData.title.replace(/\s+/g, "_")}_attendees.xlsx`;
    
    // Create a download link and trigger download
    const url = URL.createObjectURL(workbookBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Add attendee to the workbook
   * @param {Object} attendeeData Attendee data to add
   * @returns {Object} Updated workbook blob and workbook object
   */
  const addAttendeeToWorkbook = (attendeeData) => {
    if (!workbookBlob) {
      throw new Error('Workbook must be created first');
    }

    return new Promise((resolve, reject) => {
      // Read the existing workbook
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the attendees worksheet
          const worksheet = workbook.Sheets["Event Attendees"];
          
          // Prepare the new attendee data
          const newAttendee = [
            attendeeData.name || '',
            attendeeData.email || '',
            attendeeData.registeredDate || new Date().toISOString().split('T')[0],
            attendeeData.status || 'Registered',
            attendeeData.notes || ''
          ];
          
          // Convert the sheet to JSON with headers
          const rawData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          });
          
          // Check if user is already registered by email
          let existingUserIndex = -1;
          for (let i = 1; i < rawData.length; i++) {
            if (rawData[i][1] === attendeeData.email) {
              existingUserIndex = i;
              break;
            }
          }
          
          if (existingUserIndex !== -1) {
            // Update existing user data
            rawData[existingUserIndex] = newAttendee;
          } else {
            // Add new user after the headers
            rawData.push(newAttendee);
          }
          
          // Create a new worksheet from the modified rawData
          const newWorksheet = XLSX.utils.aoa_to_sheet(rawData);
          workbook.Sheets["Event Attendees"] = newWorksheet;
          
          // Convert to array buffer
          const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "array",
          });
          
          // Convert to Blob
          const newBlob = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          
          // Update state
          setWorkbookBlob(newBlob);
          
          // Return the updated data
          resolve({
            workbook,
            blob: newBlob,
            fileName: `${eventData.title.replace(/\s+/g, "_")}_attendees.xlsx`
          });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(workbookBlob);
    });
  };

  return (
    <div className="flex flex-col space-y-4">
      {status === 'error' && (
        <div className="p-4 bg-red-50 text-red-800 rounded-md flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error creating workbook</p>
            <p className="text-sm mt-1">{errorMessage}</p>
          </div>
        </div>
      )}
      
      {status === 'success' && (
        <div className="p-4 bg-green-50 text-green-800 rounded-md flex items-start gap-3">
          <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Workbook created successfully</p>
          </div>
        </div>
      )}
      
      <div className="flex space-x-2">
        {(!workbookBlob || status === 'idle') && (
          <button
            onClick={handleCreateWorkbook}
            disabled={isCreating || !eventData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Attendance Workbook'
            )}
          </button>
        )}
        
        {showDownloadButton && workbookBlob && (
          <button
            onClick={handleDownloadWorkbook}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Workbook
          </button>
        )}
      </div>
    </div>
  );
}