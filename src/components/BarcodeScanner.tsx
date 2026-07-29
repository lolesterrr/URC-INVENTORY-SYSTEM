/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, ScanLine, Tag, Check, HelpCircle, Laptop, User, MapPin, RefreshCw } from 'lucide-react';
import { HardwareAsset, UserRole } from '../types.js';

interface BarcodeScannerProps {
  hardware: HardwareAsset[];
  currentUserRole: UserRole;
  onUpdateHardware: (item: HardwareAsset) => Promise<void>;
}

export default function BarcodeScanner({
  hardware,
  currentUserRole,
  onUpdateHardware
}: BarcodeScannerProps) {
  const [selectedMockId, setSelectedMockId] = useState('');
  const [scannedItem, setScannedItem] = useState<HardwareAsset | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanMessage, setScanMessage] = useState('Position an URC asset barcode label within the lens frame.');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Field editing state for scanned item
  const [status, setStatus] = useState<'In Use' | 'In Stock' | 'Maintenance' | 'Retired'>('In Stock');
  const [assignee, setAssignee] = useState('');
  const [location, setLocation] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load editing state when scanned item changes
  useEffect(() => {
    if (scannedItem) {
      setStatus(scannedItem.status);
      setAssignee(scannedItem.assignee);
      setLocation(scannedItem.location);
    }
  }, [scannedItem]);

  // Turn on mock/real camera stream
  const startCamera = async () => {
    setCameraActive(true);
    setScanMessage('Calibrating hardware focus... Laser active.');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      }
    } catch (err) {
      // Browser didn't support or permission blocked, which is completely expected in iframe sandboxes
      console.log('Camera streaming declined or restricted, loading simulated overlay.');
    }
    
    // Auto simulated scan delay
    setTimeout(() => {
      setScanMessage('Laser aligned. Ready. Select a mock item or type an asset ID below to trigger a mock scan.');
    }, 1500);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    setScanMessage('Position an URC asset barcode label within the lens frame.');
  };

  // Run mock scanner trigger
  const triggerScan = () => {
    if (!selectedMockId) {
      setScanMessage('Please select an asset to scan first.');
      return;
    }

    setScanMessage('Scanning barcode...');
    setTimeout(() => {
      const match = hardware.find(h => h.id === selectedMockId);
      if (match) {
        setScannedItem(match);
        setScanMessage(`Scan Successful! Decoded ID: ${match.id}. Status loaded below.`);
      } else {
        setScanMessage('Decoded raw barcode, but no matching URC Hardware Asset was found in the database.');
        setScannedItem(null);
      }
    }, 800);
  };

  // Apply quick updates from scanner interface
  const handleApplyQuickUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedItem) return;
    
    if (currentUserRole === UserRole.VIEWER) {
      alert('Access Denied: Viewers cannot save updates.');
      return;
    }

    setIsUpdating(true);
    try {
      const updated: HardwareAsset = {
        ...scannedItem,
        status,
        assignee: assignee || 'N/A',
        location: location || 'HQ, Kampala'
      };
      await onUpdateHardware(updated);
      setScannedItem(updated);
      setScanMessage(`Successfully saved deployment updates for URC asset ${updated.id}.`);
    } catch (err) {
      console.error(err);
      setScanMessage('An error occurred while updating the asset.');
    } finally {
      setIsUpdating(false);
    }
  };

  const renderSimpleBarcodeStripes = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const bars = [];
    for (let i = 0; i < 22; i++) {
      const width = ((hash + i) % 3 === 0) ? 'w-1' : 'w-0.5';
      bars.push(<div key={i} className={`h-8 bg-slate-900 ${width} mr-0.5`}></div>);
    }
    return (
      <div className="flex flex-col items-center p-2 bg-white rounded border border-slate-200">
        <div className="flex items-center justify-center bg-white">{bars}</div>
        <span className="text-[8px] font-mono font-bold tracking-wider text-slate-500 mt-1">{id}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      
      {/* Informational Header */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ScanLine className="h-4.5 w-4.5 text-yellow-500" />
          Field Barcode Scanning & Quick Dispatch Terminal
        </h2>
        <p className="text-[11px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
          Designed specifically for URC field technicians deploying, repairing, or auditing hardware assets across regional railway stations. Select or input barcode tags to instantly view maintenance logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        
        {/* Left: Interactive Scan Terminal */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase font-mono">Digital Scan Lens</h3>
            <span className="text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded font-extrabold text-slate-500">
              {cameraActive ? 'LASER_ON' : 'STANDBY'}
            </span>
          </div>

          {/* Simulated Scanner Viewport */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                {/* Visual Scanning Guides */}
                <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]"></div>
                <div className="absolute top-3 left-3 h-3 w-3 border-t-2 border-l-2 border-emerald-400"></div>
                <div className="absolute top-3 right-3 h-3 w-3 border-t-2 border-r-2 border-emerald-400"></div>
                <div className="absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2 border-emerald-400"></div>
                <div className="absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2 border-emerald-400"></div>
              </>
            ) : (
              <div className="flex flex-col items-center text-center p-4 space-y-2">
                <div className="p-2.5 bg-slate-900 rounded-full text-slate-500 border border-slate-800">
                  <Camera className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Lens Off</p>
                <p className="text-[10px] text-slate-500 max-w-[180px]">Enable camera feed or proceed with simulated scanner presets below.</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">System Feedback</p>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug">{scanMessage}</p>
            </div>

            {/* Scanning Controls */}
            <div className="flex gap-2">
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-xs transition-colors flex items-center justify-center gap-1.5 font-mono uppercase"
                >
                  <Camera className="h-3.5 w-3.5" />
                  ACTIVATE SCANNER
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="flex-1 bg-red-150 hover:bg-red-200 text-red-700 font-bold py-1.5 px-3 rounded text-xs transition-colors flex items-center justify-center gap-1.5 font-mono uppercase"
                >
                  DISCONNECT LENS
                </button>
              )}
            </div>

            {/* Simulation Block */}
            <div className="pt-2.5 border-t border-slate-100 space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 flex items-center gap-1 font-mono uppercase">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                Simulate scan input manually
              </h4>
              <div className="flex gap-2">
                <select
                  value={selectedMockId}
                  onChange={(e) => setSelectedMockId(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">-- Select Hardware ID --</option>
                  {hardware.map(h => (
                    <option key={h.id} value={h.id}>{h.id} — {h.name}</option>
                  ))}
                </select>
                <button
                  onClick={triggerScan}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors font-mono uppercase whitespace-nowrap"
                >
                  SCAN
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Right: Asset Metadata & Dispatch Details */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase font-mono">Decoded Asset Passport</h3>
            <span className="text-[9px] font-mono bg-yellow-100 text-yellow-850 font-bold px-1.5 py-0.5 rounded uppercase">
              {scannedItem ? `PASSPORT_LOADED` : 'NO_ASSET_SCANNED'}
            </span>
          </div>

          {scannedItem ? (
            <div className="space-y-3 animate-fade-in">
              
              {/* Asset passport card */}
              <div className="p-3 bg-slate-50 rounded border border-slate-100 space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Laptop className="h-3 w-3" />
                      <span className="text-[10px] font-mono font-bold text-slate-800">{scannedItem.id}</span>
                    </div>
                    <h4 className="text-[13px] font-bold text-slate-900">{scannedItem.assetName || scannedItem.name}</h4>
                  </div>
                  <div>
                    {renderSimpleBarcodeStripes(scannedItem.id)}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Category</span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">{scannedItem.category || 'Hardware'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Department</span>
                    <span className="font-bold text-slate-800">{scannedItem.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">User / Assignee</span>
                    <span className="font-bold text-slate-800">{scannedItem.user || scannedItem.assignee}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Location</span>
                    <span className="font-semibold text-slate-700">{scannedItem.location}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Model</span>
                    <span className="font-semibold text-slate-700">{scannedItem.model || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Serial No. / Tag</span>
                    <span className="font-mono text-slate-700">{scannedItem.serialNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Engraved Number</span>
                    <span className="font-mono text-slate-700">{scannedItem.engravedNumber || 'N/A'}</span>
                  </div>

                  {/* Network / Switch / Router Unique Fields */}
                  {scannedItem.ipAddress && (
                    <div>
                      <span className="text-slate-400 font-mono block uppercase text-[8.5px]">IP Address</span>
                      <span className="font-mono font-bold text-blue-700">{scannedItem.ipAddress}</span>
                    </div>
                  )}
                  {scannedItem.portCount && (
                    <div>
                      <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Port Count / Interface</span>
                      <span className="font-semibold text-slate-700">{scannedItem.portCount}</span>
                    </div>
                  )}
                  {scannedItem.firmwareVersion && (
                    <div>
                      <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Firmware / OS</span>
                      <span className="font-mono text-slate-700">{scannedItem.firmwareVersion}</span>
                    </div>
                  )}

                  {/* Server Unique Fields */}
                  {scannedItem.serverRole && (
                    <div>
                      <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Server Role</span>
                      <span className="font-semibold text-slate-700">{scannedItem.serverRole}</span>
                    </div>
                  )}
                  {scannedItem.cpuCores && (
                    <div>
                      <span className="text-slate-400 font-mono block uppercase text-[8.5px]">CPU Cores</span>
                      <span className="font-mono text-slate-700">{scannedItem.cpuCores}</span>
                    </div>
                  )}

                  {/* Printer Unique Fields */}
                  {scannedItem.printTechnology && (
                    <div>
                      <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Print Technology</span>
                      <span className="font-semibold text-slate-700">{scannedItem.printTechnology}</span>
                    </div>
                  )}
                  {scannedItem.connectionType && (
                    <div>
                      <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Connection Type</span>
                      <span className="font-semibold text-slate-700">{scannedItem.connectionType}</span>
                    </div>
                  )}

                  {/* Standard Computer / Default Fields */}
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">OS / Firmware</span>
                    <span className="font-semibold text-slate-700">{scannedItem.operatingSystem || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">RAM</span>
                    <span className="font-mono text-slate-700">{scannedItem.ram || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono block uppercase text-[8.5px]">HARDDISK / Storage</span>
                    <span className="font-mono text-slate-700">{scannedItem.hardDisk || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Quick Update Form */}
              <form onSubmit={handleApplyQuickUpdate} className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 border-b border-slate-100 pb-1 uppercase font-mono">Quick Dispatch Update</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase font-mono">Deployment Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none"
                    >
                      <option value="In Use">In Use</option>
                      <option value="In Stock">In Stock</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase font-mono">Deploy / Hand Over To</label>
                    <div className="relative mt-1">
                      <User className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Assignee staff name"
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        className="w-full pl-7 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase font-mono">Regional Office / Station Location</label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Tororo Station House"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-7 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50/50 p-2.5 rounded border border-yellow-100/50 text-[10px] text-slate-500 leading-normal font-medium">
                  Field technicians can perform quick status overrides. Data deletions are restricted inside the quick dispatch terminal.
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isUpdating || currentUserRole === UserRole.VIEWER}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 font-mono uppercase"
                  >
                    {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5 text-yellow-500 stroke-[3px]" />}
                    SAVE PASSPORT CHANGES
                  </button>
                </div>

              </form>

            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center p-4 bg-slate-50 rounded border border-dashed border-slate-200 text-slate-400">
              <ScanLine className="h-8 w-8 text-slate-300 stroke-[1.5] mb-1.5" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide font-mono">Scan Pending</p>
              <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">Scanned asset metadata will populate input fields here automatically.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
