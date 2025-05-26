"use client"

export default function DesignSection({
  certificateSize,
  backgroundColor,
  backgroundImage,
  backgroundProps,
  borderStyle,
  showRulers,
  showGrid,
  isWhiteLines,
  gridSize,
  updateCertificateSize,
  setBackgroundColor,
  handleBackgroundUpload,
  setBackgroundProps,
  setBorderStyle,
  setShowRulers,
  setShowGrid,
  setIsWhiteLines,
  setGridSize,
  setGridColor,
  setRulerColor,
  saveToHistory,
}) {
  return (
    <>
      {/* Certificate Size */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Certificate Size</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-sm mb-1">Width (px)</label>
            <input
              type="number"
              value={certificateSize.width}
              onChange={(e) =>
                updateCertificateSize({
                  width: Number(e.target.value),
                })
              }
              className="w-full p-2 border rounded"
              min="500"
              max="2000"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Height (px)</label>
            <input
              type="number"
              value={certificateSize.height}
              onChange={(e) =>
                updateCertificateSize({
                  height: Number(e.target.value),
                })
              }
              className="w-full p-2 border rounded"
              min="500"
              max="2000"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Orientation</label>
          <select
            value={certificateSize.orientation}
            onChange={(e) => updateCertificateSize({ orientation: e.target.value })}
            className="w-full p-2 border rounded"
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </div>
      </div>

      {/* Background */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Background</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-sm mb-1">Color</label>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => {
                setBackgroundColor(e.target.value)
                saveToHistory()
              }}
              className="w-full h-10 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Image</label>
            <input type="file" onChange={handleBackgroundUpload} className="text-sm w-full" accept="image/*" />
          </div>
        </div>

        {backgroundImage && (
          <>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="block text-sm mb-1">Blur</label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={backgroundProps.blur}
                  onChange={(e) => {
                    setBackgroundProps({
                      ...backgroundProps,
                      blur: Number(e.target.value),
                    })
                    saveToHistory()
                  }}
                  className="w-full"
                />
                <span className="text-xs">{backgroundProps.blur}px</span>
              </div>
              <div>
                <label className="block text-sm mb-1">Opacity</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={backgroundProps.opacity}
                  onChange={(e) => {
                    setBackgroundProps({
                      ...backgroundProps,
                      opacity: Number(e.target.value),
                    })
                    saveToHistory()
                  }}
                  className="w-full"
                />
                <span className="text-xs">{Math.round(backgroundProps.opacity * 100)}%</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Border Styling */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Border</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-sm mb-1">Color</label>
            <input
              type="color"
              value={borderStyle.color}
              onChange={(e) => {
                setBorderStyle({
                  ...borderStyle,
                  color: e.target.value,
                })
                saveToHistory()
              }}
              className="w-full h-10 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Width</label>
            <input
              type="range"
              min="0"
              max="20"
              value={borderStyle.width}
              onChange={(e) => {
                setBorderStyle({
                  ...borderStyle,
                  width: Number(e.target.value),
                })
                saveToHistory()
              }}
              className="w-full"
            />
            <span className="text-xs">{borderStyle.width}px</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm mb-1">Style</label>
            <select
              value={borderStyle.style}
              onChange={(e) => {
                setBorderStyle({
                  ...borderStyle,
                  style: e.target.value,
                })
                saveToHistory()
              }}
              className="w-full p-2 border rounded"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Radius</label>
            <input
              type="range"
              min="0"
              max="50"
              value={borderStyle.radius}
              onChange={(e) => {
                setBorderStyle({
                  ...borderStyle,
                  radius: Number(e.target.value),
                })
                saveToHistory()
              }}
              className="w-full"
            />
            <span className="text-xs">{borderStyle.radius}px</span>
          </div>
        </div>
      </div>

      {/* Ruler and Grid Settings */}
      <div className="mb-6 border p-3 rounded bg-white">
        <h3 className="font-medium mb-2">Alignment Tools</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm">Show Rulers</label>
            <input
              type="checkbox"
              checked={showRulers}
              onChange={(e) => setShowRulers(e.target.checked)}
              className="ml-2"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Show Grid</label>
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="ml-2"
            />
          </div>
          {/* Color toggle checkbox */}
          <div className="flex items-center justify-between">
            <label htmlFor="lineColorToggle" className="text-sm">
              White Lines
            </label>
            <input
              type="checkbox"
              id="lineColorToggle"
              checked={isWhiteLines}
              onChange={(e) => {
                const checked = e.target.checked
                setIsWhiteLines(checked)
                setGridColor(checked ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)")
                setRulerColor(checked ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.3)")
              }}
              className="ml-2"
            />
          </div>
          {showGrid && (
            <div>
              <label className="block text-sm mb-1">Grid Size</label>
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-xs">{gridSize}px</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
