import { useState, useRef, useEffect } from 'react';
import { Usb, Send, Trash2, Wifi, AlertTriangle, Power, Settings, Download } from 'lucide-react';

export default function WifiConfig() {
  const [isConnected, setIsConnected] = useState(false);
  const [command, setCommand] = useState('');
  const [response, setResponse] = useState('ESP32 Serial Interface Ready...\n');
  const [isConnecting, setIsConnecting] = useState(false);
  const [baudRate, setBaudRate] = useState(115200);
  const [showDriverInstructions, setShowDriverInstructions] = useState(false);
  
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);

  useEffect(() => {
    // Check if Web Serial API is supported
    if (!('serial' in navigator)) {
      setResponse(prev => prev + '❌ Web Serial API not supported in this browser\n');
    }

    // Cleanup on unmount
    return () => {
      if (portRef.current && portRef.current.readable) {
        disconnect();
      }
    };
  }, []);

  const connect = async () => {
    try {
      setIsConnecting(true);
      
      // Request a port and open the connection
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: baudRate });
      
      portRef.current = port;
      setIsConnected(true);
      
      // Set up the text decoder and encoder
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      readerRef.current = textDecoder.readable.getReader();
      
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      writerRef.current = textEncoder.writable.getWriter();
      
      setResponse(prev => prev + `✅ Connected to ESP32 at ${baudRate} baud\n`);
      
      // Start reading from the serial port
      readFromPort();
      
    } catch (error) {
      setResponse(prev => prev + `❌ Connection failed: ${error.message}\n`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      
      if (writerRef.current) {
        await writerRef.current.close();
        writerRef.current = null;
      }
      
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
      
      setIsConnected(false);
      setResponse(prev => prev + '🔌 Disconnected from ESP32\n');
    } catch (error) {
      setResponse(prev => prev + `❌ Disconnect error: ${error.message}\n`);
    }
  };

  const readFromPort = async () => {
    try {
      while (readerRef.current) {
        const { value, done } = await readerRef.current.read();
        if (done) break;
        
        setResponse(prev => prev + value);
      }
    } catch (error) {
      if (error.name !== 'NetworkError') {
        setResponse(prev => prev + `❌ Read error: ${error.message}\n`);
      }
    }
  };

  const sendCommand = async () => {
    if (!command.trim() || !isConnected || !writerRef.current) return;
    
    try {
      const commandToSend = command + '\n';
      await writerRef.current.write(commandToSend);
      setResponse(prev => prev + `> ${command}\n`);
      setCommand('');
    } catch (error) {
      setResponse(prev => prev + `❌ Send error: ${error.message}\n`);
    }
  };

  const clearResponse = () => {
    setResponse('ESP32 Serial Interface Ready...\n');
  };

  const insertQuickCommand = (cmd) => {
    setCommand(cmd);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      sendCommand();
    }
  };

  return (
    <div className="w-full mx-auto px-2 sm:px-4 md:px-8">
      <div className="w-full bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
          <div className="flex items-center gap-3">
            <Usb className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">PEMSS Wifi Configuration</h1>
              <p className="text-slate-300 text-sm">Serial communication tool</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {/* Browser Warning */}
          {!('serial' in navigator) && (
            <div className="bg-amber-50 border border-amber-200 p-4 mb-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800">Browser Compatibility</h3>
                <p className="text-amber-700 text-sm">
                  This interface requires a Chromium-based browser (Chrome, Edge, Opera) with Web Serial API support.
                </p>
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="font-medium text-slate-700">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {isConnected && (
                <span className="text-slate-500 text-sm">@ {baudRate} baud</span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <select 
                value={baudRate} 
                onChange={(e) => setBaudRate(Number(e.target.value))}
                disabled={isConnected}
                className="px-3 py-1 border border-slate-300 rounded text-sm disabled:bg-slate-100"
              >
                <option value={9600}>9600</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
                <option value={460800}>460800</option>
              </select>
              
              <button
                onClick={isConnected ? disconnect : connect}
                disabled={isConnecting || !('serial' in navigator)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  isConnected 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-slate-400'
                }`}
              >
                <Power className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>

          {/* Command Input Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-800">Command Input</h2>
            </div>
            
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`Enter your commands here...
Example:
AT+GMR
WiFi.begin("SSID", "password")
Serial.println("Hello ESP32")

Press Ctrl+Enter to send`}
              className="w-full h-32 p-4 border border-slate-300 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
            />
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={sendCommand}
                disabled={!command.trim() || !isConnected}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Command
              </button>
              
              <button
                onClick={() => setCommand('')}
                className="px-4 py-2 bg-slate-500 text-white rounded-lg font-medium hover:bg-slate-600 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>

          {/* Response Section */}
          <div className="bg-slate-900 rounded-lg overflow-hidden">
            <div className="bg-slate-800 px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-white font-medium text-sm">Serial Output</span>
              </div>
              <button
                onClick={clearResponse}
                className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600 transition-all"
              >
                Clear Log
              </button>
            </div>
            
            <div className="p-4 h-64 overflow-y-auto bg-black">
              <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {response}
              </pre>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 text-sm text-slate-600 bg-slate-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Instructions:</h3>
            <ul className="space-y-1">
              <li>• Click "Connect" to establish serial connection with your PEMSS device</li>
              <li>• Use the textarea to enter commands or code snippets</li>
              <li>• Press "Send Command" or Ctrl+Enter to transmit data</li>
              <li>• Monitor responses in the serial output window</li>
            </ul>
            <div className="mt-4">
              <button
                onClick={() => setShowDriverInstructions(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors text-sm"
              >
                Download USB Driver
              </button>
            </div>
          </div>

          {/* Driver Instructions Modal */}
          {showDriverInstructions && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">USB Driver Installation</h2>
                  <button
                    onClick={() => setShowDriverInstructions(false)}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label="Close"
                  >
                    <span className="sr-only">Close</span>
                    ×
                  </button>
                </div>
                <div className="px-6 py-6">
                  <div className="bg-blue-50 p-4 rounded-full mx-auto mb-4 w-20 h-20 flex items-center justify-center">
                    <Download className="h-10 w-10 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">USB Driver Installation</h3>
                  <div className="text-left mb-6">
                    <p className="text-gray-600 mb-3">
                      To use the NFC scanner with your computer, you need to install the appropriate USB drivers:
                    </p>
                    <ol className="list-decimal pl-5 text-gray-600 space-y-2">
                      <li>Download the driver by clicking the zip download button below.</li>
                      <li>Extract the zip file, then run either <b>CP210xVCPInstaller_x64.exe</b> or <b>CP210xVCPInstaller_x86.exe</b> depending on your computer's architecture (64-bit or 32-bit).</li>
                      <li>Wait for the driver installation to complete.</li>
                      <li>Restart your browser if needed.</li>
                    </ol>
                    <p className="text-gray-600 mt-3">
                      After installing the drivers, click "Continue" to proceed with connecting your device.
                    </p>
                  </div>
                  <div className="flex gap-3 mb-4">
                    <a
                      href="/drivers/CP210x_Windows_Drivers.zip"
                      download
                      className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors text-center"
                    >
                      Download Zip Driver and Install
                    </a>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDriverInstructions(false)}
                      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}