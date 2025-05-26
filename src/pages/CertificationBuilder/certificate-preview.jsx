"use client"

export default function CertificatePreview({
  certificateRef,
  backgroundColor,
  borderStyle,
  certificateSize,
  backgroundImage,
  backgroundProps,
  elements,
  selectedElement,
  showRulers,
  showGrid,
  gridSize,
  gridColor,
  rulerColor,
  mousePosition,
  handleCertificateMouseMove,
  handleMouseUp,
  handleCertificateClick,
  handleMouseDown,
  generateRulerTicks,
  parsePlaceholders,
  selectedEvent,
}) {
  return (
    <div className="flex-1 flex flex-col">
      <h2 className="text-2xl font-bold mb-4">Certificate Preview</h2>
      <div className="bg-gray-100 p-4 rounded-lg flex-1 flex items-center justify-center overflow-auto">
        <div className="relative">
          {/* Horizontal Ruler */}
          {showRulers && (
            <div
              className="absolute h-[30px] bg-white border-b border-r left-[30px] right-0 top-0 z-10"
              style={{
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {generateRulerTicks(certificateSize.width, true)}
            </div>
          )}

          {/* Vertical Ruler */}
          {showRulers && (
            <div
              className="absolute w-[30px] bg-white border-r border-b top-[30px] bottom-0 left-0 z-10"
              style={{
                boxShadow: "1px 0 3px rgba(0,0,0,0.1)",
              }}
            >
              {generateRulerTicks(certificateSize.height, false)}
            </div>
          )}

          {/* Ruler Corner */}
          {showRulers && (
            <div
              className="absolute w-[30px] h-[30px] bg-white border-r border-b left-0 top-0 z-20"
              style={{
                boxShadow: "1px 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div className="flex items-center justify-center h-full text-[10px] text-gray-500">0,0</div>
            </div>
          )}

          <div
            ref={certificateRef}
            className="relative shadow-xl overflow-hidden"
            data-certificate="true"
            style={{
              backgroundColor: backgroundColor,
              borderWidth: `${borderStyle.width}px`,
              borderStyle: borderStyle.style,
              borderColor: borderStyle.color,
              borderRadius: borderStyle.radius ? `${borderStyle.radius}px` : "0px",
              width: `${certificateSize.width}px`,
              height: `${certificateSize.height}px`,
              transform: `scale(${Math.min(1, 600 / certificateSize.width)})`,
              transformOrigin: "center",
              transition: "transform 0.2s ease",
              marginTop: showRulers ? "30px" : "0",
              marginLeft: showRulers ? "30px" : "0",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseMove={handleCertificateMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleCertificateClick}
          >
            {/* Background layer */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: backgroundColor,
                zIndex: 0,
              }}
            />

            {/* Background image with blur effect */}
            {backgroundImage && (
              <>
                {/* Blurred background layer */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: `blur(${backgroundProps.blur}px)`,
                    opacity: backgroundProps.opacity,
                    transform: "scale(1.1)", // Slightly scale up to avoid blur edges
                  }}
                  data-background-blur="true"
                ></div>

                {/* Original background for when blur is 0 */}
                {backgroundProps.blur === 0 && (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${backgroundImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      opacity: backgroundProps.opacity,
                      zIndex: 2,
                    }}
                  ></div>
                )}
              </>
            )}

            {/* Grid overlay */}
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none z-[2]"
                style={{
                  backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), 
                    linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
                  backgroundSize: `${gridSize}px ${gridSize}px`,
                  backgroundPosition: "0 0",
                }}
              />
            )}

            {/* Ruler lines */}
            {showRulers && (
              <>
                {/* Horizontal ruler line */}
                <div
                  className="absolute pointer-events-none z-[2]"
                  style={{
                    left: 0,
                    top: `${certificateSize.height / 2}px`,
                    width: "100%",
                    height: "1px",
                    backgroundColor: `${rulerColor}`,
                  }}
                />

                {/* Vertical ruler line */}
                <div
                  className="absolute pointer-events-none z-[2]"
                  style={{
                    left: `${certificateSize.width / 2}px`,
                    top: 0,
                    width: "1px",
                    height: "100%",
                    backgroundColor: `${rulerColor}`,
                  }}
                />
              </>
            )}

            {/* Content container - ensures content is above background */}
            <div className="absolute inset-0" style={{ zIndex: 3 }}>
              {elements
                .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                .map(
                  (element) =>
                    element.isVisible && (
                      <div
                        key={element.id}
                        className={`absolute cursor-move ${
                          selectedElement === element.id ? "ring-2 ring-blue-500" : ""
                        }`}
                        style={{
                          left: `${element.x}%`,
                          top: `${element.y}%`,
                          transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                          opacity: element.opacity,
                          userSelect: "none",
                          zIndex: element.zIndex || 0,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, element.id)}
                      >
                        {element.type === "text" ? (
                          <div
                            contentEditable={selectedElement === element.id}
                            suppressContentEditableWarning={true}
                            data-element-id={element.id}
                            onBlur={(e) => {
                              if (selectedElement === element.id) {
                                // This would be handled by the parent component
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && e.shiftKey) {
                                e.preventDefault()
                                document.execCommand("insertLineBreak")
                              }
                            }}
                            style={{
                              color: element.color,
                              fontSize: `${element.fontSize}px`,
                              fontFamily: element.fontFamily,
                              fontWeight: element.fontWeight,
                              textAlign: element.textAlign,
                              textShadow: element.shadow?.enabled
                                ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`
                                : "none",
                              width: element.width || "auto",
                              minWidth: "50px",
                              minHeight: "1.2em",
                              maxWidth: "960px",
                              padding: "30px",
                              border: selectedElement === element.id ? "1px dashed #3b82f6" : "none",
                              outline: "none",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              overflowWrap: "break-word",
                              resize: selectedElement === element.id ? "both" : "none",
                              overflow: "auto",
                              lineHeight: "1.3",
                              boxSizing: "border-box",
                            }}
                          >
                            {selectedEvent ? parsePlaceholders(element.content, selectedEvent) : element.content}
                          </div>
                        ) : element.type === "image" ? (
                          <img
                            src={element.content || "/placeholder.svg"}
                            alt="Element"
                            style={{
                              width: `${element.width}px`,
                              height: `${element.height}px`,
                              boxShadow: element.shadow?.enabled
                                ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`
                                : "none",
                              borderRadius: element.borderRadius ? `${element.borderRadius}px` : "0px",
                              border: element.border?.enabled
                                ? `${element.border.width}px ${element.border.style} ${element.border.color}`
                                : "none",
                            }}
                          />
                        ) : element.type === "signature" ? (
                          <img
                            src={element.content || "/placeholder.svg"}
                            alt="Signature"
                            style={{
                              width: `${element.width}px`,
                              height: `${element.height}px`,
                              boxShadow: element.shadow?.enabled
                                ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`
                                : "none",
                              borderRadius: element.borderRadius ? `${element.borderRadius}px` : "0px",
                              border: element.border?.enabled
                                ? `${element.border.width}px ${element.border.style} ${element.border.color}`
                                : "none",
                            }}
                          />
                        ) : element.type === "shape" ? (
                          <div
                            style={{
                              width: `${element.width}px`,
                              height: `${element.height}px`,
                              backgroundColor: element.color,
                              borderRadius:
                                element.shapeType === "circle"
                                  ? "50%"
                                  : element.shapeType === "rounded"
                                    ? "10px"
                                    : element.borderRadius
                                      ? `${element.borderRadius}px`
                                      : "0px",
                              boxShadow: element.shadow?.enabled
                                ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`
                                : "none",
                            }}
                          ></div>
                        ) : null}
                      </div>
                    ),
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
