"use client"

import {
  Type,
  ImageIcon,
  Square,
  FilePenLineIcon as Signature,
  Eye,
  Copy,
  Trash2,
  Check,
  X,
  Mail,
  Loader2,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react"

export default function ElementsSection({
  elements,
  selectedElement,
  signaturePadRef,
  isDrawing,
  signatureData,
  selectedEvent,
  eventAttendees,
  selectedAttendees,
  emailStatus,
  sendingMultiple,
  sendProgress,
  recipientEmail,
  emailMessage,
  isLoadingAttendees,
  addNewElement,
  setSelectedElement,
  toggleElementVisibility,
  duplicateElement,
  removeElement,
  startDrawing,
  draw,
  stopDrawing,
  clearSignature,
  addSignature,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleFileUpload,
  setSelectedAttendees,
  sendCertificatesToMultipleAttendees,
  setRecipientEmail,
  setEmailMessage,
  sendCertificateEmailFn,
  updateElement,
  moveElementLayer,
}) {
  return (
    <>
      {/* Add New Elements */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Add Elements</h3>
        <div className="flex flex-wrap gap-2">
          <button
            className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => addNewElement("text")}
          >
            <Type size={16} />
            <span>Add Text</span>
          </button>
          <button
            className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => addNewElement("image")}
          >
            <ImageIcon size={16} />
            <span>Add Image</span>
          </button>
          <button
            className="flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            onClick={() => addNewElement("shape")}
          >
            <Square size={16} />
            <span>Add Shape</span>
          </button>
        </div>
      </div>

      {/* Placeholder Helper */}
      <div className="mb-6 border p-3 rounded bg-white">
        <h3 className="font-medium mb-2">Event & Attendee Data Placeholders</h3>
        <p className="text-sm mb-2">You can use placeholders in text elements to automatically insert data:</p>

        <div className="mb-3">
          <h4 className="text-sm font-medium mb-1">Event Placeholders:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ title }"}</code> - Event title
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ description }"}</code> - Event description
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ date }"}</code> - Event date
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ time }"}</code> - Event time
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ location }"}</code> - Event location
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ registrarName }"}</code> - Organizer name
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-medium mb-1">Attendee Placeholders:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ userName }"}</code> - Attendee's name
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ email }"}</code> - Attendee's email
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ userId }"}</code> - Attendee's ID
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <code className="font-mono">{"{ phone }"}</code> - Attendee's phone (if available)
            </div>
          </div>
        </div>

        <p className="text-sm mt-3">
          <span className="font-medium">Example:</span>{" "}
          <span className="font-mono">
            This certificate is awarded to {"{ userName }"} for attending {"{ title }"} on {"{ date }"}
          </span>
        </p>
        <p className="text-sm mt-1 text-gray-600">
          When sending to multiple attendees, these placeholders will be automatically replaced with each attendee's
          information.
        </p>
      </div>

      {/* Event Data Elements */}
      {selectedEvent && (
        <div className="mb-6 border p-3 rounded bg-white">
          <h3 className="font-medium mb-2">Add Event Data</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
              onClick={() => {
                addNewElement("text")
                const newElementId = `element-${Date.now()}`
                updateElement(newElementId, { content: "{ title }" })
              }}
            >
              Add Event Title
            </button>
            <button
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
              onClick={() => {
                addNewElement("text")
                const newElementId = `element-${Date.now()}`
                updateElement(newElementId, { content: "{ description }" })
              }}
            >
              Add Description
            </button>
            <button
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
              onClick={() => {
                addNewElement("text")
                const newElementId = `element-${Date.now()}`
                updateElement(newElementId, { content: "{ date }" })
              }}
            >
              Add Date
            </button>
            <button
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
              onClick={() => {
                addNewElement("text")
                const newElementId = `element-${Date.now()}`
                updateElement(newElementId, { content: "{ location }" })
              }}
            >
              Add Location
            </button>
            <button
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
              onClick={() => {
                addNewElement("text")
                const newElementId = `element-${Date.now()}`
                updateElement(newElementId, { content: "{ userName }" })
              }}
            >
              Add Attendee Name
            </button>
            <button
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm col-span-2"
              onClick={() => {
                addNewElement("text")
                const newElementId = `element-${Date.now()}`
                updateElement(newElementId, {
                  content:
                    "This is to certify that [Attendee Name] participated in { title } held at { location } on { date }",
                })
              }}
            >
              Add Certificate Text
            </button>
            <button
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm col-span-2"
              onClick={() => {
                addNewElement("text")
                const newElementId = `element-${Date.now()}`
                updateElement(newElementId, {
                  content:
                    "This is to certify that { userName } participated in { title } held at { location } on { date }",
                  fontSize: 18,
                  fontFamily: "serif",
                  color: "#333333",
                  textAlign: "center",
                })
              }}
            >
              Add Certificate Text with Attendee Name
            </button>
          </div>
        </div>
      )}

      {/* Signature Pad */}
      <div className="mb-6 border p-3 rounded bg-white">
        <h3 className="font-medium mb-2">Add Signature</h3>
        <div className="border rounded mb-2 bg-gray-50">
          <canvas
            ref={signaturePadRef}
            className="w-full h-36 cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>
        <div className="flex gap-2 mb-2">
          <button
            className="flex-1 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm flex items-center justify-center gap-1"
            onClick={clearSignature}
          >
            <X size={14} />
            <span>Clear</span>
          </button>
          <button
            className="flex-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center justify-center gap-1 disabled:bg-blue-300 disabled:cursor-not-allowed"
            onClick={addSignature}
            disabled={!signatureData}
          >
            <Check size={14} />
            <span>Add to Certificate</span>
          </button>
        </div>

        {/* Upload Signature Option */}
        <div className="mt-3 border-t pt-3">
          <label className="block text-sm mb-2">Or Upload Signature Image</label>
          <input type="file" onChange={handleFileUpload} className="text-sm w-full" accept="image/*" />
          <div className="text-xs text-gray-500 mt-1">Transparent PNG files work best for signatures</div>
        </div>
      </div>

      {/* Email Certificate */}
      <div className="mb-6 border p-3 rounded bg-white">
        <h3 className="font-medium mb-2">Send Certificate by Email</h3>
        <div className="space-y-3">
          {selectedEvent ? (
            <>
              {eventAttendees.length > 0 ? (
                <>
                  <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-3">
                    <h4 className="font-medium text-sm mb-2">Event Attendees</h4>
                    <div className="max-h-40 overflow-y-auto">
                      {eventAttendees.map((attendee) => (
                        <div key={attendee.id} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            id={`attendee-${attendee.id}`}
                            checked={selectedAttendees.includes(attendee.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAttendees([...selectedAttendees, attendee.id])
                              } else {
                                setSelectedAttendees(selectedAttendees.filter((id) => id !== attendee.id))
                              }
                            }}
                            className="mr-2"
                          />
                          <label htmlFor={`attendee-${attendee.id}`} className="text-sm flex-1">
                            {attendee.userName} ({attendee.email})
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800"
                        onClick={() => setSelectedAttendees(eventAttendees.map((a) => a.id))}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800"
                        onClick={() => setSelectedAttendees([])}
                      >
                        Deselect All
                      </button>
                    </div>
                    <div className="mt-3">
                      <button
                        className={`w-full px-3 py-2 ${
                          emailStatus === "error"
                            ? "bg-red-100 text-red-700"
                            : emailStatus === "sent"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-500 hover:bg-blue-600 text-white"
                        } rounded text-sm flex items-center justify-center gap-1`}
                        onClick={sendCertificatesToMultipleAttendees}
                        disabled={emailStatus === "sending" || sendingMultiple || selectedAttendees.length === 0}
                      >
                        {sendingMultiple ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>
                              Sending {sendProgress.current}/{sendProgress.total}...
                            </span>
                          </>
                        ) : emailStatus === "sent" ? (
                          <>
                            <Check size={16} />
                            <span>Certificates Sent!</span>
                          </>
                        ) : emailStatus === "error" ? (
                          <>
                            <X size={16} />
                            <span>Error Sending</span>
                          </>
                        ) : (
                          <>
                            <Mail size={16} />
                            <span>Send to Selected Attendees ({selectedAttendees.length})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <h4 className="font-medium text-sm mb-2">Or Send to a Single Email</h4>
                  </div>
                </>
              ) : isLoadingAttendees ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  <span>Loading attendees...</span>
                </div>
              ) : (
                <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-3 text-sm">
                  No attendees found for this event. You can still send to a single email below.
                </div>
              )}
            </>
          ) : (
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-3 text-sm">
              Select an event to see attendees or send to a single email below.
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="recipient@example.com"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Email Message (Optional)</label>
            <textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              className="w-full p-2 border rounded"
              rows={3}
              placeholder="Add a personal message to accompany the certificate..."
            ></textarea>
          </div>
          <button
            className={`w-full px-3 py-2 ${
              emailStatus === "error"
                ? "bg-red-100 text-red-700"
                : emailStatus === "sent"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
            } rounded text-sm flex items-center justify-center gap-1`}
            onClick={sendCertificateEmailFn}
            disabled={emailStatus === "sending" || sendingMultiple || !recipientEmail}
          >
            {emailStatus === "sending" && !sendingMultiple ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Sending...</span>
              </>
            ) : emailStatus === "sent" && !sendingMultiple ? (
              <>
                <Check size={16} />
                <span>Certificate Sent!</span>
              </>
            ) : emailStatus === "error" && !sendingMultiple ? (
              <>
                <X size={16} />
                <span>Error Sending</span>
              </>
            ) : (
              <>
                <Mail size={16} />
                <span>Send Certificate</span>
              </>
            )}
          </button>
          {emailStatus === "error" && (
            <p className="text-xs text-red-600 mt-1">There was an error sending the certificate. Please try again.</p>
          )}
        </div>
      </div>

      {/* Elements List */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Elements</h3>
        {elements.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {elements.map((element) => (
              <div
                key={element.id}
                className={`flex items-center justify-between p-2 rounded border ${
                  selectedElement === element.id ? "bg-blue-50 border-blue-300" : "bg-white"
                }`}
                onClick={() => setSelectedElement(element.id)}
              >
                <div className="flex items-center gap-2">
                  {element.type === "text" ? (
                    <Type size={14} />
                  ) : element.type === "image" ? (
                    <ImageIcon size={14} />
                  ) : element.type === "signature" ? (
                    <Signature size={14} />
                  ) : element.type === "shape" ? (
                    <Square size={14} />
                  ) : null}
                  <span className="text-sm truncate max-w-[120px]">
                    {element.type === "text" ? element.content : element.type}
                  </span>
                </div>
                <div className="flex items-center">
                  <button
                    className="p-1 text-blue-500 hover:text-blue-700 mr-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      const elementEdit = document.querySelector(`[data-element-id="${element.id}"]`)
                      if (elementEdit) {
                        setSelectedElement(element.id)
                        setTimeout(() => {
                          elementEdit.focus()
                        }, 100)
                      }
                    }}
                    title="Edit Text"
                  >
                    <Type size={14} />
                  </button>
                  <button
                    className="p-1 text-gray-500 hover:text-gray-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleElementVisibility(element.id)
                    }}
                    title={element.isVisible ? "Hide" : "Show"}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    className="p-1 text-gray-500 hover:text-gray-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      duplicateElement(element.id)
                    }}
                    title="Duplicate"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="p-1 text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeElement(element.id)
                    }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 bg-white rounded border">
            No elements added yet. Start by adding text, images, or shapes.
          </div>
        )}
      </div>

      {/* Selected Element Properties */}
      {selectedElement && (
        <div className="mb-6 border-t pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Edit Element</h3>
            <div className="flex items-center">
              <button
                className="p-1 text-gray-500 hover:text-gray-700 mr-1"
                onClick={() => moveElementLayer(selectedElement, "up")}
                title="Bring Forward"
              >
                <ChevronUp size={16} />
              </button>
              <button
                className="p-1 text-gray-500 hover:text-gray-700 mr-1"
                onClick={() => moveElementLayer(selectedElement, "down")}
                title="Send Backward"
              >
                <ChevronDown size={16} />
              </button>
              <button
                className="p-1 text-red-500 hover:text-red-700"
                onClick={() => removeElement(selectedElement)}
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {elements.find((el) => el.id === selectedElement)?.type === "text" ? (
            <>
              <div className="mb-2">
                <label className="block text-sm mb-1">Text Content</label>
                <textarea
                  value={elements.find((el) => el.id === selectedElement)?.content}
                  onChange={(e) => updateElement(selectedElement, { content: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.shiftKey) {
                      e.preventDefault()
                      const textarea = e.target
                      const start = textarea.selectionStart
                      const end = textarea.selectionEnd
                      const value = textarea.value
                      const newValue = value.substring(0, start) + "\n" + value.substring(end)
                      updateElement(selectedElement, { content: newValue })

                      // Set cursor position after the inserted newline
                      setTimeout(() => {
                        textarea.selectionStart = start + 1
                        textarea.selectionEnd = start + 1
                      }, 0)
                    }
                  }}
                  className="w-full p-2 border rounded font-mono"
                  style={{
                    fontFamily: elements.find((el) => el.id === selectedElement)?.fontFamily,
                    fontSize: "14px",
                    resize: "vertical",
                    minHeight: "80px",
                  }}
                  rows="4"
                />
                <p className="text-xs text-gray-500 mt-1">Press Shift+Enter to add a new line</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-sm mb-1">Font Size</label>
                  <input
                    type="range"
                    min="10"
                    max="72"
                    value={elements.find((el) => el.id === selectedElement)?.fontSize}
                    onChange={(e) => updateElement(selectedElement, { fontSize: Number(e.target.value) })}
                    className="w-full"
                  />
                  <span className="text-xs">{elements.find((el) => el.id === selectedElement)?.fontSize}px</span>
                </div>

                <div>
                  <label className="block text-sm mb-1">Color</label>
                  <input
                    type="color"
                    value={elements.find((el) => el.id === selectedElement)?.color}
                    onChange={(e) => updateElement(selectedElement, { color: e.target.value })}
                    className="w-full h-10 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-sm mb-1">Font Family</label>
                  <select
                    value={elements.find((el) => el.id === selectedElement)?.fontFamily}
                    onChange={(e) => updateElement(selectedElement, { fontFamily: e.target.value })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="sans-serif">Sans-serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="cursive">Cursive</option>
                    <option value="fantasy">Fantasy</option>
                    <option value="Rowdies">Rowdies</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Special Gothic Condensed One">Special Gothic Condensed One</option>
                    <option value="Big Shoulders">Big Shoulders</option>
                    <option value="Playwrite AU SA">Playwrite AU SA</option>
                    <option value="Playwrite RO">Playwrite RO</option>
                    <option value="Anton">Anton</option>
                    <option value="Lilita One">Lilita One</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1">Font Weight</label>
                  <select
                    value={elements.find((el) => el.id === selectedElement)?.fontWeight}
                    onChange={(e) => updateElement(selectedElement, { fontWeight: e.target.value })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="lighter">Lighter</option>
                  </select>
                </div>
              </div>

              <div className="mb-2">
                <label className="block text-sm mb-1">Text Width</label>
                <input
                  type="range"
                  min="100"
                  max="960"
                  value={elements.find((el) => el.id === selectedElement)?.width || 500}
                  onChange={(e) => updateElement(selectedElement, { width: Number(e.target.value) })}
                  className="w-full"
                />
                <span className="text-xs">{elements.find((el) => el.id === selectedElement)?.width || 500}px</span>
              </div>

              <div className="mb-2">
                <label className="block text-sm mb-1">Text Align</label>
                <div className="flex border rounded overflow-hidden">
                  <button
                    className={`flex-1 p-2 ${
                      elements.find((el) => el.id === selectedElement)?.textAlign === "left"
                        ? "bg-blue-100"
                        : "bg-white"
                    }`}
                    onClick={() => updateElement(selectedElement, { textAlign: "left" })}
                  >
                    <AlignLeft size={16} className="mx-auto" />
                  </button>
                  <button
                    className={`flex-1 p-2 ${
                      elements.find((el) => el.id === selectedElement)?.textAlign === "center"
                        ? "bg-blue-100"
                        : "bg-white"
                    }`}
                    onClick={() => updateElement(selectedElement, { textAlign: "center" })}
                  >
                    <AlignCenter size={16} className="mx-auto" />
                  </button>
                  <button
                    className={`flex-1 p-2 ${
                      elements.find((el) => el.id === selectedElement)?.textAlign === "right"
                        ? "bg-blue-100"
                        : "bg-white"
                    }`}
                    onClick={() => updateElement(selectedElement, { textAlign: "right" })}
                  >
                    <AlignRight size={16} className="mx-auto" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Width</label>
                  <input
                    type="range"
                    min="20"
                    max="300"
                    value={elements.find((el) => el.id === selectedElement)?.width}
                    onChange={(e) => updateElement(selectedElement, { width: Number(e.target.value) })}
                    className="w-full"
                  />
                  <span className="text-xs">{elements.find((el) => el.id === selectedElement)?.width}px</span>
                </div>

                <div>
                  <label className="block text-sm mb-1">Height</label>
                  <input
                    type="range"
                    min="20"
                    max="300"
                    value={elements.find((el) => el.id === selectedElement)?.height}
                    onChange={(e) => updateElement(selectedElement, { height: Number(e.target.value) })}
                    className="w-full"
                  />
                  <span className="text-xs">{elements.find((el) => el.id === selectedElement)?.height}px</span>
                </div>
              </div>

              {elements.find((el) => el.id === selectedElement)?.type === "image" && (
                <div className="mt-2">
                  <label className="block text-sm mb-1">Image URL</label>
                  <input
                    type="text"
                    value={elements.find((el) => el.id === selectedElement)?.content}
                    onChange={(e) => updateElement(selectedElement, { content: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="Enter image URL or upload"
                  />
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (e) => {
                          updateElement(selectedElement, { content: e.target.result })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="mt-1 text-sm w-full"
                    accept="image/*"
                  />

                  {/* Image Border Controls */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm">Border</label>
                      <input
                        type="checkbox"
                        checked={elements.find((el) => el.id === selectedElement)?.border?.enabled || false}
                        onChange={(e) => {
                          const element = elements.find((el) => el.id === selectedElement)
                          updateElement(selectedElement, {
                            border: {
                              ...(element.border || { width: 2, color: "#000000", style: "solid" }),
                              enabled: e.target.checked,
                            },
                          })
                        }}
                        className="ml-2"
                      />
                    </div>

                    {elements.find((el) => el.id === selectedElement)?.border?.enabled && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs mb-1">Color</label>
                          <input
                            type="color"
                            value={elements.find((el) => el.id === selectedElement)?.border?.color || "#000000"}
                            onChange={(e) => {
                              const element = elements.find((el) => el.id === selectedElement)
                              updateElement(selectedElement, {
                                border: { ...element.border, color: e.target.value },
                              })
                            }}
                            className="w-full h-8 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1">Width</label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={elements.find((el) => el.id === selectedElement)?.border?.width || 2}
                            onChange={(e) => {
                              const element = elements.find((el) => el.id === selectedElement)
                              updateElement(selectedElement, {
                                border: { ...element.border, width: Number(e.target.value) },
                              })
                            }}
                            className="w-full"
                          />
                          <span className="text-xs">
                            {elements.find((el) => el.id === selectedElement)?.border?.width || 2}px
                          </span>
                        </div>
                      </div>
                    )}

                    {elements.find((el) => el.id === selectedElement)?.border?.enabled && (
                      <div className="mt-2">
                        <label className="block text-xs mb-1">Style</label>
                        <select
                          value={elements.find((el) => el.id === selectedElement)?.border?.style || "solid"}
                          onChange={(e) => {
                            const element = elements.find((el) => el.id === selectedElement)
                            updateElement(selectedElement, {
                              border: { ...element.border, style: e.target.value },
                            })
                          }}
                          className="w-full p-1 border rounded text-xs"
                        >
                          <option value="solid">Solid</option>
                          <option value="dashed">Dashed</option>
                          <option value="dotted">Dotted</option>
                          <option value="double">Double</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Border Radius Control */}
                  <div className="mt-3">
                    <label className="block text-sm mb-1">Border Radius</label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={elements.find((el) => el.id === selectedElement)?.borderRadius || 0}
                      onChange={(e) => {
                        updateElement(selectedElement, {
                          borderRadius: Number(e.target.value),
                        })
                      }}
                      className="w-full"
                    />
                    <span className="text-xs">
                      {elements.find((el) => el.id === selectedElement)?.borderRadius || 0}px
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {elements.find((el) => el.id === selectedElement)?.type === "shape" && (
            <>
              <div className="mb-2">
                <label className="block text-sm mb-1">Shape Type</label>
                <select
                  value={elements.find((el) => el.id === selectedElement)?.shapeType || "rectangle"}
                  onChange={(e) => updateElement(selectedElement, { shapeType: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="rounded">Rounded Rectangle</option>
                  <option value="circle">Circle</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm mb-1">Color</label>
                <input
                  type="color"
                  value={elements.find((el) => el.id === selectedElement)?.color}
                  onChange={(e) => updateElement(selectedElement, { color: e.target.value })}
                  className="w-full h-10 cursor-pointer"
                />
              </div>
            </>
          )}

          {elements.find((el) => el.id === selectedElement)?.type === "signature" && (
            <div className="mt-2">
              {/* Image Border Controls */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm">Border</label>
                  <input
                    type="checkbox"
                    checked={elements.find((el) => el.id === selectedElement)?.border?.enabled || false}
                    onChange={(e) => {
                      const element = elements.find((el) => el.id === selectedElement)
                      updateElement(selectedElement, {
                        border: {
                          ...(element.border || { width: 2, color: "#000000", style: "solid" }),
                          enabled: e.target.checked,
                        },
                      })
                    }}
                    className="ml-2"
                  />
                </div>

                {elements.find((el) => el.id === selectedElement)?.border?.enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1">Color</label>
                      <input
                        type="color"
                        value={elements.find((el) => el.id === selectedElement)?.border?.color || "#000000"}
                        onChange={(e) => {
                          const element = elements.find((el) => el.id === selectedElement)
                          updateElement(selectedElement, {
                            border: { ...element.border, color: e.target.value },
                          })
                        }}
                        className="w-full h-8 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Width</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={elements.find((el) => el.id === selectedElement)?.border?.width || 2}
                        onChange={(e) => {
                          const element = elements.find((el) => el.id === selectedElement)
                          updateElement(selectedElement, {
                            border: { ...element.border, width: Number(e.target.value) },
                          })
                        }}
                        className="w-full"
                      />
                      <span className="text-xs">
                        {elements.find((el) => el.id === selectedElement)?.border?.width || 2}px
                      </span>
                    </div>
                  </div>
                )}

                {elements.find((el) => el.id === selectedElement)?.border?.enabled && (
                  <div className="mt-2">
                    <label className="block text-xs mb-1">Style</label>
                    <select
                      value={elements.find((el) => el.id === selectedElement)?.border?.style || "solid"}
                      onChange={(e) => {
                        const element = elements.find((el) => el.id === selectedElement)
                        updateElement(selectedElement, {
                          border: { ...element.border, style: e.target.value },
                        })
                      }}
                      className="w-full p-1 border rounded text-xs"
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                      <option value="double">Double</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Border Radius Control */}
              <div className="mt-3">
                <label className="block text-sm mb-1">Border Radius</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={elements.find((el) => el.id === selectedElement)?.borderRadius || 0}
                  onChange={(e) => {
                    updateElement(selectedElement, {
                      borderRadius: Number(e.target.value),
                    })
                  }}
                  className="w-full"
                />
                <span className="text-xs">{elements.find((el) => el.id === selectedElement)?.borderRadius || 0}px</span>
              </div>
            </div>
          )}

          {/* Common properties for all element types */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="block text-sm mb-1">Rotation</label>
              <input
                type="range"
                min="0"
                max="360"
                value={elements.find((el) => el.id === selectedElement)?.rotation || 0}
                onChange={(e) => updateElement(selectedElement, { rotation: Number(e.target.value) })}
                className="w-full"
              />
              <span className="text-xs">{elements.find((el) => el.id === selectedElement)?.rotation || 0}°</span>
            </div>

            <div>
              <label className="block text-sm mb-1">Opacity</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={elements.find((el) => el.id === selectedElement)?.opacity || 1}
                onChange={(e) => updateElement(selectedElement, { opacity: Number(e.target.value) })}
                className="w-full"
              />
              <span className="text-xs">
                {Math.round((elements.find((el) => el.id === selectedElement)?.opacity || 1) * 100)}%
              </span>
            </div>
          </div>

          {/* Shadow settings */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm">Shadow</label>
              <input
                type="checkbox"
                checked={elements.find((el) => el.id === selectedElement)?.shadow?.enabled || false}
                onChange={(e) => {
                  const element = elements.find((el) => el.id === selectedElement)
                  updateElement(selectedElement, {
                    shadow: {
                      ...(element.shadow || {
                        color: "rgba(0,0,0,0.3)",
                        blur: 5,
                        offsetX: 2,
                        offsetY: 2,
                      }),
                      enabled: e.target.checked,
                    },
                  })
                }}
                className="ml-2"
              />
            </div>

            {elements.find((el) => el.id === selectedElement)?.shadow?.enabled && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs mb-1">Color</label>
                  <input
                    type="color"
                    value={elements.find((el) => el.id === selectedElement)?.shadow?.color || "rgba(0,0,0,0.3)"}
                    onChange={(e) => {
                      const element = elements.find((el) => el.id === selectedElement)
                      updateElement(selectedElement, {
                        shadow: { ...element.shadow, color: e.target.value },
                      })
                    }}
                    className="w-full h-8 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Blur</label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={elements.find((el) => el.id === selectedElement)?.shadow?.blur || 5}
                    onChange={(e) => {
                      const element = elements.find((el) => el.id === selectedElement)
                      updateElement(selectedElement, {
                        shadow: { ...element.shadow, blur: Number(e.target.value) },
                      })
                    }}
                    className="w-full"
                  />
                  <span className="text-xs">
                    {elements.find((el) => el.id === selectedElement)?.shadow?.blur || 5}px
                  </span>
                </div>
                <div>
                  <label className="block text-xs mb-1">Offset X</label>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    value={elements.find((el) => el.id === selectedElement)?.shadow?.offsetX || 2}
                    onChange={(e) => {
                      const element = elements.find((el) => el.id === selectedElement)
                      updateElement(selectedElement, {
                        shadow: { ...element.shadow, offsetX: Number(e.target.value) },
                      })
                    }}
                    className="w-full"
                  />
                  <span className="text-xs">
                    {elements.find((el) => el.id === selectedElement)?.shadow?.offsetX || 2}px
                  </span>
                </div>
                <div>
                  <label className="block text-xs mb-1">Offset Y</label>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    value={elements.find((el) => el.id === selectedElement)?.shadow?.offsetY || 2}
                    onChange={(e) => {
                      const element = elements.find((el) => el.id === selectedElement)
                      updateElement(selectedElement, {
                        shadow: { ...element.shadow, offsetY: Number(e.target.value) },
                      })
                    }}
                    className="w-full"
                  />
                  <span className="text-xs">
                    {elements.find((el) => el.id === selectedElement)?.shadow?.offsetY || 2}px
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
