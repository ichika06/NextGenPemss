"use client"

import { useState } from "react"
import { createCustomTemplate } from "./certificate-templates"
import { Save, X } from "lucide-react"

export default function CustomTemplateForm({ onSave, onCancel }) {
  const [templateName, setTemplateName] = useState("My Custom Template")
  const [backgroundColor, setBackgroundColor] = useState("#ffffff")
  const [borderColor, setBorderColor] = useState("#333333")

  const handleSubmit = (e) => {
    e.preventDefault()

    // Create a basic template with some default elements
    const template = createCustomTemplate(
      templateName,
      [
        {
          id: "title",
          type: "text",
          content: "Custom Certificate",
          x: 50,
          y: 15,
          fontSize: 32,
          fontFamily: "sans-serif",
          color: borderColor,
          fontWeight: "bold",
          textAlign: "center",
          width: 300,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 10,
        },
        {
          id: "recipient-name",
          type: "text",
          content: "{ userName }",
          x: 50,
          y: 40,
          fontSize: 28,
          fontFamily: "sans-serif",
          color: "#000000",
          fontWeight: "bold",
          textAlign: "center",
          width: 400,
          rotation: 0,
          opacity: 1,
          isDragging: false,
          isVisible: true,
          zIndex: 12,
        },
        {
          id: "accomplishment",
          type: "text",
          content: "for participating in { title }",
          x: 50,
          y: 50,
          fontSize: 18,
          fontFamily: "sans-serif",
          color: "#555555",
          fontWeight: "normal",
          textAlign: "center",
          width: 400,
          rotation: 0,
          opacity: 1,
          isDragging: false,
          isVisible: true,
          zIndex: 13,
        },
        {
          id: "date",
          type: "text",
          content: "{ date }",
          x: 50,
          y: 65,
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "#555555",
          fontWeight: "normal",
          textAlign: "center",
          width: 200,
          rotation: 0,
          opacity: 1,
          isDragging: false,
          isVisible: true,
          zIndex: 14,
        },
        {
          id: "signature-line",
          type: "shape",
          shapeType: "rectangle",
          color: borderColor,
          x: 30,
          y: 80,
          width: 150,
          height: 2,
          rotation: 0,
          opacity: 1,
          isDragging: false,
          isVisible: true,
          zIndex: 15,
        },
      ],
      backgroundColor,
      borderColor,
    )

    onSave(template)
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border">
      <h3 className="font-medium text-lg mb-4">Create Custom Template</h3>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm mb-1">Template Name</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1">Background Color</label>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="w-full h-10 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Border Color</label>
            <input
              type="color"
              value={borderColor}
              onChange={(e) => setBorderColor(e.target.value)}
              className="w-full h-10 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded flex items-center gap-1">
            <X size={16} />
            <span>Cancel</span>
          </button>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
          >
            <Save size={16} />
            <span>Save Template</span>
          </button>
        </div>
      </form>
    </div>
  )
}
