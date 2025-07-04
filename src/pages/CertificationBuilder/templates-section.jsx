import { useState } from "react"
import { Plus } from "lucide-react"
import CustomTemplateForm from "./customtemplateform"

export default function TemplatesSection({
  templates,
  savedDesigns,
  applyTemplate,
  loadDesign,
  deleteDesignFromFirestore,
  addCustomTemplate,
}) {
  const [showCustomTemplateForm, setShowCustomTemplateForm] = useState(false)

  const handleSaveCustomTemplate = (template) => {
    addCustomTemplate(template)
    setShowCustomTemplateForm(false)
  }

  return (
    <>
      {/* Preset Templates */}
      <div className="mb-6 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium dark:text-zinc-100">Quick Templates</h3>
          <button
            className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 flex items-center gap-1 text-sm"
            onClick={() => setShowCustomTemplateForm(true)}
          >
            <Plus size={16} />
            <span>Add Custom</span>
          </button>
        </div>

        {showCustomTemplateForm ? (
          <CustomTemplateForm onSave={handleSaveCustomTemplate} onCancel={() => setShowCustomTemplateForm(false)} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {templates.map((template) => (
              <button
                key={template.name}
                className="p-3 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-900 flex flex-col items-center"
                onClick={() => applyTemplate(template)}
              >
                <div
                  className="w-full h-16 mb-2 rounded"
                  style={{
                    backgroundColor: template.background,
                    borderWidth: "4px",
                    borderStyle: "solid",
                    borderColor: template.border,
                  }}
                ></div>
                <span className="text-sm dark:text-zinc-100">{template.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Saved Designs */}
      <div className="mb-6">
        <h3 className="font-medium mb-2 dark:text-zinc-100">Saved Designs</h3>
        {savedDesigns.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400">No saved designs yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {savedDesigns.map((design) => (
              <div key={design.id} className="border dark:border-zinc-700 rounded-lg p-3 bg-white dark:bg-zinc-800 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium dark:text-zinc-100">{design.name}</h4>
                    <div className="flex items-center mt-1">
                      {design.isPublic ? (
                        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-2 py-0.5 rounded-full">Public</span>
                      ) : (
                        <span className="text-xs bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 px-2 py-0.5 rounded-full">Private</span>
                      )}
                      {!design.isOwner && (
                        <span className="text-xs text-gray-500 dark:text-zinc-400 ml-2">by {design.userName || "Anonymous"}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex">
                    <button
                      onClick={() => loadDesign(design)}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded mr-1 hover:bg-blue-600"
                    >
                      Load
                    </button>
                    {design.isOwner && (
                      <button
                        onClick={() => deleteDesignFromFirestore(design.id, design.name)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className="h-20 w-full rounded border dark:border-zinc-700 flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: design.backgroundColor || "#ffffff" }}
                  onClick={() => loadDesign(design)}
                >
                  {design.backgroundImage ? (
                    <div
                      className="w-full h-full bg-cover bg-center rounded"
                      style={{ backgroundImage: `url(${design.backgroundImage})` }}
                    ></div>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-zinc-500">Preview</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
