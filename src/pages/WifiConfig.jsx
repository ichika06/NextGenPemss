"use client"

import { useState, useRef, useEffect } from "react"
import {
  Usb,
  Send,
  Trash2,
  Wifi,
  AlertTriangle,
  Power,
  Settings,
  Download,
  Terminal,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Monitor,
  X,
  Copy,
  Save,
  FileText,
} from "lucide-react"

export default function WifiConfig() {
  const [isConnected, setIsConnected] = useState(false)
  const [command, setCommand] = useState("")
  const [response, setResponse] = useState("ESP32 Serial Interface Ready...\n")
  const [isConnecting, setIsConnecting] = useState(false)
  const [baudRate, setBaudRate] = useState(115200)
  const [showDriverInstructions, setShowDriverInstructions] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const portRef = useRef(null)
  const readerRef = useRef(null)
  const writerRef = useRef(null)
  const responseRef = useRef(null)

  useEffect(() => {
    // Check if Web Serial API is supported
    if (!("serial" in navigator)) {
      setResponse((prev) => prev + "❌ Web Serial API not supported in this browser\n")
    }

    // Auto-scroll response area
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight
    }

    // Cleanup on unmount
    return () => {
      if (portRef.current && portRef.current.readable) {
        disconnect()
      }
    }
  }, [response])

  const connect = async () => {
    try {
      setIsConnecting(true)
      setConnectionStatus("connecting")

      // Request a port and open the connection
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: baudRate })

      portRef.current = port
      setIsConnected(true)
      setConnectionStatus("connected")

      // Get device info if available
      const info = port.getInfo()
      setDeviceInfo({
        vendorId: info.usbVendorId,
        productId: info.usbProductId,
        baudRate: baudRate,
      })

      // Set up the text decoder and encoder
      const textDecoder = new TextDecoderStream()
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable)
      readerRef.current = textDecoder.readable.getReader()

      const textEncoder = new TextEncoderStream()
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable)
      writerRef.current = textEncoder.writable.getWriter()

      setResponse((prev) => prev + `✅ Connected to ESP32 at ${baudRate} baud\n`)
      setResponse(
        (prev) =>
          prev + `📱 Device Info: VID:${info.usbVendorId?.toString(16)} PID:${info.usbProductId?.toString(16)}\n`,
      )

      // Start reading from the serial port
      readFromPort()
    } catch (error) {
      setResponse((prev) => prev + `❌ Connection failed: ${error.message}\n`)
      setConnectionStatus("error")
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      setConnectionStatus("disconnecting")

      if (readerRef.current) {
        await readerRef.current.cancel()
        readerRef.current = null
      }

      if (writerRef.current) {
        await writerRef.current.close()
        writerRef.current = null
      }

      if (portRef.current) {
        await portRef.current.close()
        portRef.current = null
      }

      setIsConnected(false)
      setConnectionStatus("disconnected")
      setDeviceInfo(null)
      setResponse((prev) => prev + "🔌 Disconnected from ESP32\n")
    } catch (error) {
      setResponse((prev) => prev + `❌ Disconnect error: ${error.message}\n`)
      setConnectionStatus("error")
    }
  }

  const readFromPort = async () => {
    try {
      while (readerRef.current) {
        const { value, done } = await readerRef.current.read()
        if (done) break

        setResponse((prev) => prev + value)
      }
    } catch (error) {
      if (error.name !== "NetworkError") {
        setResponse((prev) => prev + `❌ Read error: ${error.message}\n`)
      }
    }
  }

  const sendCommand = async () => {
    if (!command.trim() || !isConnected || !writerRef.current) return

    try {
      const commandToSend = command + "\n"
      await writerRef.current.write(commandToSend)
      setResponse((prev) => prev + `> ${command}\n`)

      // Add to command history
      setCommandHistory((prev) => {
        const newHistory = [command, ...prev.filter((cmd) => cmd !== command)]
        return newHistory.slice(0, 20) // Keep last 20 commands
      })

      setCommand("")
      setHistoryIndex(-1)
    } catch (error) {
      setResponse((prev) => prev + `❌ Send error: ${error.message}\n`)
    }
  }

  const clearResponse = () => {
    setResponse("ESP32 Serial Interface Ready...\n")
  }

  const copyResponse = () => {
    navigator.clipboard.writeText(response)
  }

  const saveResponse = () => {
    const blob = new Blob([response], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `esp32-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      sendCommand()
    } else if (e.key === "ArrowUp" && commandHistory.length > 0) {
      e.preventDefault()
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
      setHistoryIndex(newIndex)
      setCommand(commandHistory[newIndex] || "")
    } else if (e.key === "ArrowDown" && commandHistory.length > 0) {
      e.preventDefault()
      const newIndex = Math.max(historyIndex - 1, -1)
      setHistoryIndex(newIndex)
      setCommand(newIndex >= 0 ? commandHistory[newIndex] : "")
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-600 bg-green-100"
      case "connecting":
      case "disconnecting":
        return "text-yellow-600 bg-yellow-100"
      case "error":
        return "text-red-600 bg-red-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <CheckCircle className="w-4 h-4" />
      case "connecting":
      case "disconnecting":
        return <RefreshCw className="w-4 h-4 animate-spin" />
      case "error":
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center">
            <div className="bg-indigo-100 p-3 rounded-xl mr-4">
              <Usb className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">PEMSS WiFi Configuration</h1>
              <p className="text-gray-600 mt-1">Serial communication interface for ESP32 devices</p>
            </div>
          </div>
        </div>

        {/* Browser Warning */}
        {!("serial" in navigator) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 p-2 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 text-lg">Browser Compatibility Required</h3>
                <p className="text-amber-700 mt-1">
                  This interface requires a Chromium-based browser (Chrome, Edge, Opera) with Web Serial API support.
                </p>
                <button
                  onClick={() => setShowDriverInstructions(true)}
                  className="mt-3 inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download USB Driver
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connection Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-800 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-indigo-600" />
                  Connection Settings
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Connection Status */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Connection Status</label>
                  <div
                    className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium ${getStatusColor()}`}
                  >
                    {getStatusIcon()}
                    <span className="ml-2 capitalize">{connectionStatus}</span>
                  </div>
                </div>

                {/* Device Info */}
                {deviceInfo && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Device Information</label>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Vendor ID:</span>
                        <span className="font-mono">0x{deviceInfo.vendorId?.toString(16)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Product ID:</span>
                        <span className="font-mono">0x{deviceInfo.productId?.toString(16)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Baud Rate:</span>
                        <span className="font-mono">{deviceInfo.baudRate}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Baud Rate Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Baud Rate</label>
                  <select
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    disabled={isConnected}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value={9600}>9600</option>
                    <option value={115200}>115200</option>
                    <option value={230400}>230400</option>
                    <option value={460800}>460800</option>
                  </select>
                </div>

                {/* Connection Button */}
                <button
                  onClick={isConnected ? disconnect : connect}
                  disabled={isConnecting || !("serial" in navigator)}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    isConnected
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-400"
                  }`}
                >
                  <Power className="w-5 h-5" />
                  {isConnecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>

            {/* Usage Instructions */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
              <div className="flex items-start gap-4">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-indigo-800 text-lg mb-3">Usage Instructions</h3>
                  <ul className="space-y-2 text-indigo-700">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Click "Connect" to establish serial connection with your PEMSS device
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Use the textarea to enter commands or code snippets
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Press "Send Command" or Ctrl+Enter to transmit data
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Monitor responses in the serial output window
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Use arrow keys (↑/↓) to navigate command history
                    </li>
                  </ul>
                  <div className="mt-4">
                    <button
                      onClick={() => setShowDriverInstructions(true)}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download USB Driver
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Command Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* Command Input */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-800 flex items-center">
                  <Terminal className="w-5 h-5 mr-2 text-indigo-600" />
                  Command Interface
                </h2>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Command Input</label>
                  <textarea
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={`Enter your commands here...
Examples:
• AT+GMR (Get firmware version)
• WiFi.begin("SSID", "password")
• Serial.println("Hello ESP32")

Press Ctrl+Enter to send
Use ↑/↓ arrows for command history`}
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={sendCommand}
                    disabled={!command.trim() || !isConnected}
                    className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Command
                  </button>

                  <button
                    onClick={() => setCommand("")}
                    className="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </button>

                  {commandHistory.length > 0 && (
                    <div className="text-sm text-gray-500 flex items-center">
                      <span>{commandHistory.length} commands in history</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Response Output */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h2 className="text-lg font-medium text-gray-800 flex items-center">
                    <Wifi className="w-5 h-5 mr-2 text-green-500" />
                    Serial Output
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={copyResponse}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-all"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </button>
                    <button
                      onClick={saveResponse}
                      className="inline-flex items-center px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-all"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </button>
                    <button
                      onClick={clearResponse}
                      className="inline-flex items-center px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-all"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 h-80 overflow-hidden">
                <div
                  ref={responseRef}
                  className="p-4 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                >
                  <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap leading-relaxed">{response}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Instructions Modal */}
        {showDriverInstructions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xl font-semibold text-gray-800">USB Driver Installation</h2>
                <button
                  onClick={() => setShowDriverInstructions(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-6">
                <div className="text-center mb-6">
                  <div className="bg-blue-100 p-4 rounded-full mx-auto mb-4 w-20 h-20 flex items-center justify-center">
                    <Download className="h-10 w-10 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Install USB Drivers</h3>
                  <p className="text-gray-600">Install the required drivers to communicate with your ESP32 device</p>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">Installation Steps:</h4>
                    <ol className="list-decimal pl-5 text-gray-600 space-y-2 text-sm">
                      <li>Download the driver package using the button below</li>
                      <li>
                        Extract the zip file and run{" "}
                        <code className="bg-gray-200 px-1 rounded">CP210xVCPInstaller_x64.exe</code> (64-bit) or{" "}
                        <code className="bg-gray-200 px-1 rounded">CP210xVCPInstaller_x86.exe</code> (32-bit)
                      </li>
                      <li>Follow the installation wizard</li>
                      <li>Restart your browser after installation</li>
                      <li>Connect your ESP32 device and try again</li>
                    </ol>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href="/drivers/CP210x_Windows_Drivers.zip"
                    download
                    className="flex-1 inline-flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Driver Package
                  </a>
                  <button
                    onClick={() => setShowDriverInstructions(false)}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}