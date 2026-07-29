/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, Search, Filter, Download, Printer, Tag, Eye, Info, X, Check, Laptop, ShieldAlert, RefreshCw
} from 'lucide-react';
import { HardwareAsset, SoftwareLicense, ServerComponent, UserRole, URC_DEPARTMENTS } from '../types';

interface InventoryTablesProps {
  hardware: HardwareAsset[];
  software: SoftwareLicense[];
  serverComponents: ServerComponent[];
  currentUserRole: UserRole;
  userEmail: string;
  onAddHardware: (item: HardwareAsset) => Promise<void>;
  onUpdateHardware: (item: HardwareAsset) => Promise<void>;
  onDeleteHardware: (id: string) => Promise<void>;
  onAddSoftware: (item: SoftwareLicense) => Promise<void>;
  onUpdateSoftware: (item: SoftwareLicense) => Promise<void>;
  onDeleteSoftware: (id: string) => Promise<void>;
  onAddServerComponent: (item: ServerComponent) => Promise<void>;
  onUpdateServerComponent: (item: ServerComponent) => Promise<void>;
  onDeleteServerComponent: (id: string) => Promise<void>;
  selectedSubTab: 'hardware' | 'software' | 'servers';
  setSelectedSubTab: (tab: 'hardware' | 'software' | 'servers') => void;
}

export default function InventoryTables({
  hardware,
  software,
  serverComponents,
  currentUserRole,
  userEmail,
  onAddHardware,
  onUpdateHardware,
  onDeleteHardware,
  onAddSoftware,
  onUpdateSoftware,
  onDeleteSoftware,
  onAddServerComponent,
  onUpdateServerComponent,
  onDeleteServerComponent,
  selectedSubTab,
  setSelectedSubTab
}: InventoryTablesProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal forms states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'add' | 'edit'>('add');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form Field States
  // Hardware fields
  const [hwId, setHwId] = useState('');
  const [hwUser, setHwUser] = useState('');
  const [hwDepartment, setHwDepartment] = useState('INFORMATION COMMUNICATION AND TECHNOLOGY');
  const [hwAssetName, setHwAssetName] = useState('');
  const [hwYearOfPurchase, setHwYearOfPurchase] = useState('');
  const [hwLocation, setHwLocation] = useState('');
  const [hwModel, setHwModel] = useState('');
  const [hwSerial, setHwSerial] = useState('');
  const [hwEngraved, setHwEngraved] = useState('');
  const [hwOS, setHwOS] = useState('');
  const [hwRam, setHwRam] = useState('');
  const [hwHardDisk, setHwHardDisk] = useState('');
  const [hwStatus, setHwStatus] = useState<string>('In Stock');
  const [hwCategory, setHwCategory] = useState<'Laptop' | 'Desktop' | 'Switch' | 'Router' | 'Server' | 'Printer' | 'Other'>('Laptop');
  const [hwCost, setHwCost] = useState(0);

  // Device-type unique fields
  const [hwIpAddress, setHwIpAddress] = useState('');
  const [hwPortCount, setHwPortCount] = useState('');
  const [hwFirmwareVersion, setHwFirmwareVersion] = useState('');
  const [hwServerRole, setHwServerRole] = useState('');
  const [hwCpuCores, setHwCpuCores] = useState('');
  const [hwConnectionType, setHwConnectionType] = useState('');
  const [hwPrintTechnology, setHwPrintTechnology] = useState('');

  // Selected device category tab in Hardware Register
  const [hwTab, setHwTab] = useState<'All' | 'Laptop' | 'Desktop' | 'Network' | 'Server' | 'Printer'>('All');

  // Software fields
  const [swId, setSwId] = useState('');
  const [swName, setSwName] = useState('');
  const [swCategory, setSwCategory] = useState<'Operating System' | 'GIS' | 'Office' | 'Engineering' | 'Database' | 'Security'>('Office');
  const [swDepartment, setSwDepartment] = useState('INFORMATION COMMUNICATION AND TECHNOLOGY');
  const [swKey, setSwKey] = useState('');
  const [swSeats, setSwSeats] = useState(1);
  const [swActiveSeats, setSwActiveSeats] = useState(0);
  const [swExpiry, setSwExpiry] = useState('');
  const [swCostSub, setSwCostSub] = useState(0);
  const [swVendor, setSwVendor] = useState('');
  const [swStatusField, setSwStatusField] = useState<string>('Active');

  // Filter department state
  const [departmentFilter, setDepartmentFilter] = useState('All');

  // Server fields
  const [srvId, setSrvId] = useState('');
  const [srvServer, setSrvServer] = useState('');
  const [srvPart, setSrvPart] = useState('');
  const [srvSerial, setSrvSerial] = useState('');
  const [srvCategory, setSrvCategory] = useState<'RAM' | 'Storage' | 'CPU' | 'Power Supply' | 'NIC'>('RAM');
  const [srvStatus, setSrvStatus] = useState<string>('Active');
  const [srvQty, setSrvQty] = useState(1);
  const [srvReorder, setSrvReorder] = useState(1);

  // Barcode and Analysis view popups
  const [selectedBarcodeId, setSelectedBarcodeId] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'hardware' | 'software' | 'server';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExecuteDelete = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeleting(true);
    try {
      if (deleteConfirmTarget.type === 'hardware') {
        await onDeleteHardware(deleteConfirmTarget.id);
      } else if (deleteConfirmTarget.type === 'software') {
        await onDeleteSoftware(deleteConfirmTarget.id);
      } else if (deleteConfirmTarget.type === 'server') {
        await onDeleteServerComponent(deleteConfirmTarget.id);
      }
      setDeleteConfirmTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete asset.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Permission guards
  const canModifyAll = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.IT_MANAGER;
  const canDelete = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.IT_MANAGER;
  const canUpdateStatusOnly = currentUserRole === UserRole.TECHNICIAN;

  // Handle opening modal for Add
  const handleOpenAddModal = () => {
    if (currentUserRole === UserRole.VIEWER || canUpdateStatusOnly) {
      alert(`Access Denied: Your active role (${currentUserRole}) does not permit adding new assets.`);
      return;
    }
    setModalAction('add');
    setEditingItemId(null);
    
    // Reset all form values with realistic defaults
    setHwId(`HW-${Math.floor(Math.random() * 900) + 100}`);
    setHwUser('');
    setHwDepartment('INFORMATION COMMUNICATION AND TECHNOLOGY');
    setHwAssetName('');
    setHwYearOfPurchase(new Date().getFullYear().toString());
    setHwLocation('HQ, Kampala');
    setHwModel('');
    setHwSerial(`URC-HW-${Math.floor(Math.random() * 9000) + 1000}`);
    setHwEngraved(`URC-ENG-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`);
    setHwOS('Windows 11 Pro 64-bit');
    setHwRam('16 GB DDR4');
    setHwHardDisk('512 GB NVMe SSD');
    setHwStatus('In Stock');
    setHwCategory('Desktop');
    setHwCost(3500000);

    setHwIpAddress('');
    setHwPortCount('');
    setHwFirmwareVersion('');
    setHwServerRole('');
    setHwCpuCores('');
    setHwConnectionType('');
    setHwPrintTechnology('');

    setSwId(`SW-${Math.floor(Math.random() * 900) + 100}`);
    setSwName('');
    setSwCategory('Office');
    setSwDepartment('INFORMATION COMMUNICATION AND TECHNOLOGY');
    setSwKey(`O365-URC-${Math.floor(Math.random() * 9000)}-${Math.floor(Math.random() * 9000)}`);
    setSwSeats(100);
    setSwActiveSeats(0);
    setSwExpiry(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setSwCostSub(1200);
    setSwVendor('Microsoft East Africa');
    setSwStatusField('Active');

    setSrvId(`SC-${Math.floor(Math.random() * 900) + 100}`);
    setSrvServer('Kampala Main DC - Server 1');
    setSrvPart('');
    setSrvSerial(`SN-${Math.floor(Math.random() * 90000)}`);
    setSrvCategory('RAM');
    setSrvStatus('Active');
    setSrvQty(4);
    setSrvReorder(2);

    setIsModalOpen(true);
  };

  // Handle Edit Action
  const handleOpenEditModal = (item: any) => {
    if (currentUserRole === UserRole.VIEWER) {
      alert("Access Denied: Viewers cannot make edits.");
      return;
    }
    setModalAction('edit');
    setEditingItemId(item.id);

    if (selectedSubTab === 'hardware') {
      const hw = item as HardwareAsset;
      setHwId(hw.id);
      setHwUser(hw.user || hw.assignee || '');
      setHwDepartment(hw.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY');
      setHwAssetName(hw.assetName || hw.name || '');
      setHwYearOfPurchase(hw.yearOfPurchase || '');
      setHwLocation(hw.location || '');
      setHwModel(hw.model || '');
      setHwSerial(hw.serialNumber || '');
      setHwEngraved(hw.engravedNumber || '');
      setHwOS(hw.operatingSystem || '');
      setHwRam(hw.ram || '');
      setHwHardDisk(hw.hardDisk || '');
      setHwStatus(hw.status || 'In Stock');
      setHwCategory(hw.category || 'Laptop');
      setHwCost(hw.cost || 0);

      setHwIpAddress(hw.ipAddress || '');
      setHwPortCount(hw.portCount || '');
      setHwFirmwareVersion(hw.firmwareVersion || '');
      setHwServerRole(hw.serverRole || '');
      setHwCpuCores(hw.cpuCores || '');
      setHwConnectionType(hw.connectionType || '');
      setHwPrintTechnology(hw.printTechnology || '');
    } else if (selectedSubTab === 'software') {
      const sw = item as SoftwareLicense;
      setSwId(sw.id);
      setSwName(sw.name);
      setSwCategory(sw.category);
      setSwDepartment(sw.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY');
      setSwKey(sw.licenseKey);
      setSwSeats(sw.seatCapacity);
      setSwActiveSeats(sw.activeSeats);
      setSwExpiry(sw.expiryDate);
      setSwCostSub(sw.subscriptionCost);
      setSwVendor(sw.vendor);
      setSwStatusField(sw.status);
    } else {
      const srv = item as ServerComponent;
      setSrvId(srv.id);
      setSrvServer(srv.serverName);
      setSrvPart(srv.partName);
      setSrvSerial(srv.serialNumber);
      setSrvCategory(srv.category);
      setSrvStatus(srv.status);
      setSrvQty(srv.quantity);
      setSrvReorder(srv.reorderLevel);
    }
    setIsModalOpen(true);
  };

  // Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedSubTab === 'hardware') {
        const item: HardwareAsset = {
          id: hwId,
          user: hwUser || 'Unassigned',
          assetName: hwAssetName || 'Unnamed Asset',
          yearOfPurchase: hwYearOfPurchase || new Date().getFullYear().toString(),
          location: hwLocation || 'HQ, Kampala',
          model: hwModel || 'Standard Model',
          serialNumber: hwSerial || 'N/A',
          engravedNumber: hwEngraved || 'N/A',
          operatingSystem: hwOS || 'N/A',
          ram: hwRam || 'N/A',
          hardDisk: hwHardDisk || 'N/A',
          status: hwStatus,
          department: hwDepartment,
          ipAddress: hwIpAddress,
          portCount: hwPortCount,
          firmwareVersion: hwFirmwareVersion,
          serverRole: hwServerRole,
          cpuCores: hwCpuCores,
          connectionType: hwConnectionType,
          printTechnology: hwPrintTechnology,
          name: hwAssetName,
          assignee: hwUser,
          category: hwCategory,
          cost: Number(hwCost) || 0,
          stockLevel: 1,
          reorderLevel: 0
        };
        if (modalAction === 'add') {
          await onAddHardware(item);
        } else {
          await onUpdateHardware(item);
        }
      } else if (selectedSubTab === 'software') {
        const item: SoftwareLicense = {
          id: swId,
          name: swName,
          category: swCategory,
          department: swDepartment,
          licenseKey: swKey,
          seatCapacity: Number(swSeats),
          activeSeats: Number(swActiveSeats),
          expiryDate: swExpiry,
          subscriptionCost: Number(swCostSub),
          vendor: swVendor,
          status: swStatusField,
        };
        if (modalAction === 'add') {
          await onAddSoftware(item);
        } else {
          await onUpdateSoftware(item);
        }
      } else {
        const item: ServerComponent = {
          id: srvId,
          serverName: srvServer,
          partName: srvPart,
          serialNumber: srvSerial,
          category: srvCategory,
          status: srvStatus,
          quantity: Number(srvQty),
          reorderLevel: Number(srvReorder),
        };
        if (modalAction === 'add') {
          await onAddServerComponent(item);
        } else {
          await onUpdateServerComponent(item);
        }
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Validation error');
    }
  };

  // CSV Export implementation - exports whatever device table/filter is currently selected
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let fileName = `URC_${selectedSubTab}_Inventory.csv`;

    if (selectedSubTab === 'hardware') {
      fileName = `URC_Hardware_${hwTab}_Register.csv`;

      if (hwTab === 'Network') {
        headers = [
          'Asset ID',
          'Device Name',
          'Department',
          'Type',
          'Model',
          'Management IP',
          'Port Capacity',
          'Firmware / OS',
          'Serial No.',
          'Rack / Room Location',
          'Status'
        ];
        rows = filteredHardware.map(h => [
          h.id || '',
          h.assetName || h.name || '',
          h.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY',
          h.category || 'Switch',
          h.model || 'N/A',
          h.ipAddress || '10.100.1.1',
          h.portCount || '24 Gigabit Ports',
          h.firmwareVersion || h.operatingSystem || 'IOS-XE v17',
          h.serialNumber || '',
          h.location || '',
          h.status || ''
        ]);
      } else if (hwTab === 'Server') {
        headers = [
          'Asset ID',
          'Server Name',
          'Department',
          'Model',
          'Server Role',
          'IP Address',
          'CPU Cores',
          'RAM',
          'Storage Array',
          'OS / Hypervisor',
          'DC Location',
          'Status'
        ];
        rows = filteredHardware.map(h => [
          h.id || '',
          h.assetName || h.name || '',
          h.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY',
          h.model || 'Dell PowerEdge',
          h.serverRole || 'Database & Core DC',
          h.ipAddress || '10.100.2.10',
          h.cpuCores || '32 Cores',
          h.ram || '128 GB',
          h.hardDisk || '4TB RAID-10',
          h.operatingSystem || 'VMware ESXi 8.0',
          h.location || '',
          h.status || ''
        ]);
      } else if (hwTab === 'Printer') {
        headers = [
          'Asset ID',
          'Printer Name',
          'Department',
          'Model',
          'Print Technology',
          'Connection Type',
          'IP Address',
          'Serial No.',
          'Office Location',
          'Status'
        ];
        rows = filteredHardware.map(h => [
          h.id || '',
          h.assetName || h.name || '',
          h.department || 'PROCUREMENT',
          h.model || 'LaserJet',
          h.printTechnology || 'LaserJet Monochrome',
          h.connectionType || 'Gigabit Network IP',
          h.ipAddress || '10.100.4.50',
          h.serialNumber || '',
          h.location || '',
          h.status || ''
        ]);
      } else {
        // Laptop, Desktop, or All Hardware
        headers = [
          'Asset ID',
          'User / Assignee',
          'Department',
          'Asset Name',
          'Category',
          'Year of Purchase',
          'Location',
          'Model',
          'Serial Number / Service Tag',
          'Engraved Number',
          'Operating System',
          'RAM',
          'HARDDISK / Storage',
          'Status'
        ];
        rows = filteredHardware.map(h => [
          h.id || '',
          h.user || h.assignee || '',
          h.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY',
          h.assetName || h.name || '',
          h.category || '',
          h.yearOfPurchase || '',
          h.location || '',
          h.model || '',
          h.serialNumber || '',
          h.engravedNumber || '',
          h.operatingSystem || '',
          h.ram || '',
          h.hardDisk || '',
          h.status || ''
        ]);
      }
    } else if (selectedSubTab === 'software') {
      fileName = `URC_Software_Licenses.csv`;
      headers = [
        'License ID', 
        'License Name', 
        'Category', 
        'Department', 
        'License Key', 
        'Seat Capacity', 
        'Allocated Seats', 
        'Expiry Date', 
        'Cost (UGX)', 
        'Vendor', 
        'Status'
      ];
      rows = filteredSoftware.map(s => [
        s.id || '',
        s.name || '',
        s.category || '',
        s.department || '',
        s.licenseKey || '',
        (s.seatCapacity || 0).toString(),
        (s.activeSeats || 0).toString(),
        s.expiryDate || '',
        (s.subscriptionCost || 0).toString(),
        s.vendor || '',
        s.status || ''
      ]);
    } else {
      fileName = `URC_Server_Spares.csv`;
      headers = [
        'ID', 
        'Server Name', 
        'Component Part', 
        'Serial No', 
        'Category', 
        'Status', 
        'Quantity', 
        'Reorder Level'
      ];
      rows = filteredServers.map(sc => [
        sc.id || '',
        sc.serverName || '',
        sc.partName || '',
        sc.serialNumber || '',
        sc.category || '',
        sc.status || '',
        (sc.quantity || 0).toString(),
        (sc.reorderLevel || 0).toString()
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Triggers professional styled browser print, saving perfectly as PDF
  const handleTriggerPrint = () => {
    window.print();
  };

  // AI Diagnostic Analysis via backend
  const handleRunAiAnalysis = async (item: any) => {
    setIsAnalyzing(true);
    setAiAnalysisResult(null);
    try {
      const response = await fetch(`/api/copilot/analyze/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.analysis) {
        setAiAnalysisResult(data.analysis);
      } else {
        setAiAnalysisResult('AI service unavailable. Check log trace.');
      }
    } catch (err: any) {
      setAiAnalysisResult(`Failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filtering lists
  const filteredHardware = hardware.filter(h => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (h.assetName || h.name || '').toLowerCase().includes(q) ||
      (h.user || h.assignee || '').toLowerCase().includes(q) ||
      (h.id || '').toLowerCase().includes(q) ||
      (h.serialNumber || '').toLowerCase().includes(q) ||
      (h.engravedNumber || '').toLowerCase().includes(q) ||
      (h.model || '').toLowerCase().includes(q) ||
      (h.location || '').toLowerCase().includes(q) ||
      (h.operatingSystem || '').toLowerCase().includes(q) ||
      (h.ipAddress || '').toLowerCase().includes(q) ||
      (h.firmwareVersion || '').toLowerCase().includes(q) ||
      (h.serverRole || '').toLowerCase().includes(q) ||
      (h.ram || '').toLowerCase().includes(q) ||
      (h.hardDisk || '').toLowerCase().includes(q) ||
      (h.department || '').toLowerCase().includes(q) ||
      (h.yearOfPurchase || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'All' || h.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || h.status === statusFilter;
    const matchesDepartment = departmentFilter === 'All' || h.department === departmentFilter;

    let matchesTab = true;
    if (hwTab === 'Laptop') matchesTab = h.category === 'Laptop';
    else if (hwTab === 'Desktop') matchesTab = h.category === 'Desktop';
    else if (hwTab === 'Network') matchesTab = h.category === 'Switch' || h.category === 'Router';
    else if (hwTab === 'Server') matchesTab = h.category === 'Server';
    else if (hwTab === 'Printer') matchesTab = h.category === 'Printer';

    return matchesSearch && matchesCategory && matchesStatus && matchesDepartment && matchesTab;
  });

  const filteredSoftware = software.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
                          s.name.toLowerCase().includes(q) || 
                          s.id.toLowerCase().includes(q) ||
                          s.vendor.toLowerCase().includes(q) ||
                          (s.department || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    const matchesDepartment = departmentFilter === 'All' || s.department === departmentFilter;
    return matchesSearch && matchesCategory && matchesStatus && matchesDepartment;
  });

  const filteredServers = serverComponents.filter(sc => {
    const matchesSearch = sc.partName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          sc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sc.serverName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || sc.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || sc.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Simple Barcode generator representation
  const renderBarcode = (id: string) => {
    // Generate simple dynamic pattern lines based on string characters
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const barsCount = 28;
    const bars = [];
    for (let i = 0; i < barsCount; i++) {
      const width = ((hash + i) % 3 === 0) ? 'w-1' : ((hash + i) % 5 === 0) ? 'w-2' : 'w-0.5';
      const gap = ((hash + i) % 4 === 0) ? 'mr-0.5' : 'mr-1';
      bars.push(<div key={i} className={`h-12 bg-slate-900 ${width} ${gap}`}></div>);
    }
    return (
      <div className="flex flex-col items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm max-w-[240px]">
        <div className="flex items-center justify-center p-1 bg-white mb-2">
          {bars}
        </div>
        <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-slate-700">{id}</span>
        <span className="text-[9px] text-slate-400 font-medium mt-1 font-sans">URC IT ASSET PASS</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      
      {/* Tab Select & Search Header */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        
        {/* Sub tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 pb-2">
          <div className="flex gap-6">
            <button
              onClick={() => { setSelectedSubTab('hardware'); setSearchQuery(''); setCategoryFilter('All'); setStatusFilter('All'); }}
              className={`text-sm font-bold pb-1.5 transition-colors border-b-2 font-mono uppercase tracking-wider ${
                selectedSubTab === 'hardware' 
                  ? 'border-slate-900 text-slate-900 font-extrabold' 
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Hardware Register
            </button>
            <button
              onClick={() => { setSelectedSubTab('software'); setSearchQuery(''); setCategoryFilter('All'); setStatusFilter('All'); }}
              className={`text-sm font-bold pb-1.5 transition-colors border-b-2 font-mono uppercase tracking-wider ${
                selectedSubTab === 'software' 
                  ? 'border-slate-900 text-slate-900 font-extrabold' 
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Software Licenses
            </button>
            <button
              onClick={() => { setSelectedSubTab('servers'); setSearchQuery(''); setCategoryFilter('All'); setStatusFilter('All'); }}
              className={`text-sm font-bold pb-1.5 transition-colors border-b-2 font-mono uppercase tracking-wider ${
                selectedSubTab === 'servers' 
                  ? 'border-slate-900 text-slate-900 font-extrabold' 
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Server Spares
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 border border-slate-350 text-slate-700 text-xs rounded hover:bg-slate-50 flex items-center gap-1.5 font-semibold transition-colors font-mono"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              CSV EXPORT
            </button>
            <button
              onClick={handleTriggerPrint}
              className="px-3 py-1.5 border border-slate-350 text-slate-700 text-xs rounded hover:bg-slate-50 flex items-center gap-1.5 font-semibold transition-colors font-mono"
            >
              <Printer className="h-3.5 w-3.5 text-slate-400" />
              PRINT PDF
            </button>
            <button
              onClick={handleOpenAddModal}
              disabled={currentUserRole === UserRole.VIEWER || canUpdateStatusOnly}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 font-mono"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3px]" />
              NEW ASSET
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Filter register...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 focus:bg-white transition-all text-slate-700"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 focus:bg-white transition-all text-slate-650 cursor-pointer"
            >
              <option value="All">All Categories</option>
              {selectedSubTab === 'hardware' && (
                <>
                  <option value="Laptop">Laptop</option>
                  <option value="Desktop">Desktop</option>
                  <option value="Switch">Switch</option>
                  <option value="Router">Router</option>
                  <option value="Server">Server</option>
                  <option value="Printer">Printer</option>
                  <option value="Other">Other</option>
                </>
              )}
              {selectedSubTab === 'software' && (
                <>
                  <option value="Operating System">Operating System</option>
                  <option value="GIS">GIS</option>
                  <option value="Office">Office</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Database">Database</option>
                  <option value="Security">Security</option>
                </>
              )}
              {selectedSubTab === 'servers' && (
                <>
                  <option value="RAM">RAM</option>
                  <option value="Storage">Storage</option>
                  <option value="CPU">CPU</option>
                  <option value="Power Supply">Power Supply</option>
                  <option value="NIC">NIC</option>
                </>
              )}
            </select>
          </div>

          <div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-slate-700 font-semibold cursor-pointer"
            >
              <option value="All">All Departments</option>
              {URC_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 focus:bg-white transition-all text-slate-650 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              {selectedSubTab === 'hardware' && (
                <>
                  <option value="In Use">In Use</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Retired">Retired</option>
                </>
              )}
              {selectedSubTab === 'software' && (
                <>
                  <option value="Active">Active</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                </>
              )}
              {selectedSubTab === 'servers' && (
                <>
                  <option value="Active">Active</option>
                  <option value="Faulty">Faulty</option>
                  <option value="Spare">Spare</option>
                </>
              )}
            </select>
          </div>
        </div>

      </div>

      {/* Tables Display */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Hardware table */}
        {selectedSubTab === 'hardware' && (
          <div>
            {/* Category device filter sub-tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-3 bg-slate-50 border-b border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mr-2">
                Device Register:
              </span>
              {[
                { id: 'All', label: 'All Hardware', count: hardware.length },
                { id: 'Laptop', label: 'Laptops', count: hardware.filter(h => h.category === 'Laptop').length },
                { id: 'Desktop', label: 'Desktops', count: hardware.filter(h => h.category === 'Desktop').length },
                { id: 'Network', label: 'Switches & Routers', count: hardware.filter(h => h.category === 'Switch' || h.category === 'Router').length },
                { id: 'Server', label: 'Servers', count: hardware.filter(h => h.category === 'Server').length },
                { id: 'Printer', label: 'Printers & Peripherals', count: hardware.filter(h => h.category === 'Printer').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setHwTab(tab.id as any)}
                  className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1.5 ${
                    hwTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono ${
                    hwTab === tab.id ? 'bg-slate-700 text-amber-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {/* NETWORK DEVICES TABLE */}
              {hwTab === 'Network' && (
                <table className="w-full border-collapse text-left min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      <th className="px-3 py-2.5">Asset ID</th>
                      <th className="px-3 py-2.5">Device Name</th>
                      <th className="px-3 py-2.5">Department</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Model</th>
                      <th className="px-3 py-2.5">Management IP</th>
                      <th className="px-3 py-2.5">Port Capacity</th>
                      <th className="px-3 py-2.5">Firmware / OS</th>
                      <th className="px-3 py-2.5">Serial No.</th>
                      <th className="px-3 py-2.5">Rack / Room Location</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-[11px] text-slate-600 font-semibold">
                    {filteredHardware.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">{h.id}</td>
                        <td className="px-3 py-2 text-slate-900 font-bold">{h.assetName || h.name}</td>
                        <td className="px-3 py-2 text-slate-800 font-semibold whitespace-nowrap">{h.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide bg-blue-100 text-blue-800">
                            {h.category || 'Switch'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{h.model || 'N/A'}</td>
                        <td className="px-3 py-2 font-mono text-blue-700 font-bold whitespace-nowrap">{h.ipAddress || '10.100.1.1'}</td>
                        <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">{h.portCount || '24 Gigabit Ports'}</td>
                        <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{h.firmwareVersion || h.operatingSystem || 'IOS-XE v17'}</td>
                        <td className="px-3 py-2 font-mono text-slate-500 font-medium whitespace-nowrap">{h.serialNumber}</td>
                        <td className="px-3 py-2 text-slate-600 font-medium whitespace-nowrap">{h.location}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide ${
                            h.status === 'In Use' ? 'bg-green-100 text-green-700' :
                            h.status === 'In Stock' ? 'bg-blue-100 text-blue-700' :
                            h.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                          <button onClick={() => setSelectedBarcodeId(h.id)} title="Show Barcode & Pass" className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"><Tag className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleRunAiAnalysis(h)} title="AI Predictive Diagnosis" className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"><Laptop className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleOpenEditModal(h)} className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteConfirmTarget({ type: 'hardware', id: h.id, name: h.assetName || h.name || h.id })} disabled={!canDelete} title="Delete Network Switch/Router" className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                    {filteredHardware.length === 0 && (
                      <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">No network switches or routers found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* SERVERS TABLE */}
              {hwTab === 'Server' && (
                <table className="w-full border-collapse text-left min-w-[1050px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      <th className="px-3 py-2.5">Asset ID</th>
                      <th className="px-3 py-2.5">Server Name</th>
                      <th className="px-3 py-2.5">Department</th>
                      <th className="px-3 py-2.5">Model</th>
                      <th className="px-3 py-2.5">Server Role</th>
                      <th className="px-3 py-2.5">IP Address</th>
                      <th className="px-3 py-2.5">CPU Cores</th>
                      <th className="px-3 py-2.5">RAM</th>
                      <th className="px-3 py-2.5">Storage Array</th>
                      <th className="px-3 py-2.5">OS / Hypervisor</th>
                      <th className="px-3 py-2.5">DC Location</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-[11px] text-slate-600 font-semibold">
                    {filteredHardware.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">{h.id}</td>
                        <td className="px-3 py-2 text-slate-900 font-bold">{h.assetName || h.name}</td>
                        <td className="px-3 py-2 text-slate-800 font-semibold whitespace-nowrap">{h.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY'}</td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{h.model || 'Dell PowerEdge'}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{h.serverRole || 'Database & Core DC'}</td>
                        <td className="px-3 py-2 font-mono text-blue-700 font-bold whitespace-nowrap">{h.ipAddress || '10.100.2.10'}</td>
                        <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{h.cpuCores || '32 Cores'}</td>
                        <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{h.ram || '128 GB'}</td>
                        <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{h.hardDisk || '4TB RAID-10'}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{h.operatingSystem || 'VMware ESXi 8.0'}</td>
                        <td className="px-3 py-2 text-slate-600 font-medium whitespace-nowrap">{h.location}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide ${
                            h.status === 'In Use' ? 'bg-green-100 text-green-700' :
                            h.status === 'In Stock' ? 'bg-blue-100 text-blue-700' :
                            h.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                          <button onClick={() => setSelectedBarcodeId(h.id)} title="Show Barcode & Pass" className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"><Tag className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleRunAiAnalysis(h)} title="AI Predictive Diagnosis" className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"><Laptop className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleOpenEditModal(h)} className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteConfirmTarget({ type: 'hardware', id: h.id, name: h.assetName || h.name || h.id })} disabled={!canDelete} title="Delete Server Asset" className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                    {filteredHardware.length === 0 && (
                      <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-400">No servers registered.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* PRINTERS TABLE */}
              {hwTab === 'Printer' && (
                <table className="w-full border-collapse text-left min-w-[950px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      <th className="px-3 py-2.5">Asset ID</th>
                      <th className="px-3 py-2.5">Printer Name</th>
                      <th className="px-3 py-2.5">Department</th>
                      <th className="px-3 py-2.5">Model</th>
                      <th className="px-3 py-2.5">Print Technology</th>
                      <th className="px-3 py-2.5">Connection Type</th>
                      <th className="px-3 py-2.5">IP Address</th>
                      <th className="px-3 py-2.5">Serial No.</th>
                      <th className="px-3 py-2.5">Office Location</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-[11px] text-slate-600 font-semibold">
                    {filteredHardware.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">{h.id}</td>
                        <td className="px-3 py-2 text-slate-900 font-bold">{h.assetName || h.name}</td>
                        <td className="px-3 py-2 text-slate-800 font-semibold whitespace-nowrap">{h.department || 'PROCUREMENT'}</td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{h.model || 'LaserJet'}</td>
                        <td className="px-3 py-2 text-slate-800 font-medium whitespace-nowrap">{h.printTechnology || 'LaserJet Monochrome'}</td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{h.connectionType || 'Gigabit Network IP'}</td>
                        <td className="px-3 py-2 font-mono text-blue-700 font-bold whitespace-nowrap">{h.ipAddress || '10.100.4.50'}</td>
                        <td className="px-3 py-2 font-mono text-slate-500 font-medium whitespace-nowrap">{h.serialNumber}</td>
                        <td className="px-3 py-2 text-slate-600 font-medium whitespace-nowrap">{h.location}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide ${
                            h.status === 'In Use' ? 'bg-green-100 text-green-700' :
                            h.status === 'In Stock' ? 'bg-blue-100 text-blue-700' :
                            h.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                          <button onClick={() => setSelectedBarcodeId(h.id)} title="Show Barcode & Pass" className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"><Tag className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleRunAiAnalysis(h)} title="AI Predictive Diagnosis" className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"><Laptop className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleOpenEditModal(h)} className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteConfirmTarget({ type: 'hardware', id: h.id, name: h.assetName || h.name || h.id })} disabled={!canDelete} title="Delete Hardware Asset" className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                    {filteredHardware.length === 0 && (
                      <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">No printers registered.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* LAPTOPS, DESKTOPS, AND ALL HARDWARE TABLE */}
              {(hwTab === 'Laptop' || hwTab === 'Desktop' || hwTab === 'All') && (
                <table className="w-full border-collapse text-left min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      <th className="px-3 py-2.5">Asset ID</th>
                      {hwTab === 'All' && <th className="px-3 py-2.5">Category</th>}
                      <th className="px-3 py-2.5">Department</th>
                      <th className="px-3 py-2.5">User / Assignee</th>
                      <th className="px-3 py-2.5">Asset Name</th>
                      <th className="px-3 py-2.5">Year</th>
                      <th className="px-3 py-2.5">Location</th>
                      <th className="px-3 py-2.5">Model</th>
                      <th className="px-3 py-2.5">S/N / Service Tag</th>
                      <th className="px-3 py-2.5">Engraved No.</th>
                      <th className="px-3 py-2.5">OS / Details</th>
                      <th className="px-3 py-2.5">RAM</th>
                      <th className="px-3 py-2.5">Storage</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-[11px] text-slate-600 font-semibold">
                    {filteredHardware.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">{h.id}</td>
                        {hwTab === 'All' && (
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide bg-slate-100 text-slate-700">
                              {h.category || 'Hardware'}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2 text-slate-800 font-semibold whitespace-nowrap">{h.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY'}</td>
                        <td className="px-3 py-2 text-slate-800 font-bold whitespace-nowrap">{h.user || h.assignee}</td>
                        <td className="px-3 py-2 text-slate-900 font-bold">{h.assetName || h.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{h.yearOfPurchase || 'N/A'}</td>
                        <td className="px-3 py-2 text-slate-600 font-medium whitespace-nowrap">{h.location}</td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{h.model || 'N/A'}</td>
                        <td className="px-3 py-2 font-mono text-slate-500 font-medium whitespace-nowrap">{h.serialNumber}</td>
                        <td className="px-3 py-2 font-mono text-slate-500 font-medium whitespace-nowrap">{h.engravedNumber || 'N/A'}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{h.operatingSystem || h.firmwareVersion || 'N/A'}</td>
                        <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{h.ram || 'N/A'}</td>
                        <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{h.hardDisk || 'N/A'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide ${
                            h.status === 'In Use' ? 'bg-green-100 text-green-700' :
                            h.status === 'In Stock' ? 'bg-blue-100 text-blue-700' :
                            h.status === 'Maintenance' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                          <button onClick={() => setSelectedBarcodeId(h.id)} title="Show Barcode & Pass" className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"><Tag className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleRunAiAnalysis(h)} title="AI Predictive Diagnosis" className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"><Laptop className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleOpenEditModal(h)} className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteConfirmTarget({ type: 'hardware', id: h.id, name: h.assetName || h.name || h.id })} disabled={!canDelete} title="Delete Hardware Asset" className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                    {filteredHardware.length === 0 && (
                      <tr><td colSpan={15} className="px-4 py-8 text-center text-slate-400">No hardware items matching selected query found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Software Table */}
        {selectedSubTab === 'software' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">License Title</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Vendor</th>
                  <th className="px-4 py-2.5">License Key</th>
                  <th className="px-4 py-2.5">Seats Allocation</th>
                  <th className="px-4 py-2.5">Expiry Date</th>
                  <th className="px-4 py-2.5">Annual Cost</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-[12px] text-slate-600 font-semibold">
                {filteredSoftware.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 font-mono font-bold text-slate-900">{s.id}</td>
                    <td className="px-4 py-2 text-slate-800">{s.name}</td>
                    <td className="px-4 py-2 text-slate-800 font-semibold whitespace-nowrap">{s.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY'}</td>
                    <td className="px-4 py-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-550 font-medium">{s.vendor}</td>
                    <td className="px-4 py-2 font-mono text-slate-500 font-medium">{s.licenseKey}</td>
                    <td className="px-4 py-2 text-slate-800">
                      {s.activeSeats} / <span className="text-slate-400 font-normal">{s.seatCapacity}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-500 font-medium">{s.expiryDate}</td>
                    <td className="px-4 py-2 text-slate-800 font-medium">UGX {Number(s.subscriptionCost || 0).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide ${
                        s.status === 'Active' ? 'bg-green-100 text-green-700' :
                        s.status === 'Expiring Soon' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleRunAiAnalysis(s)}
                        title="AI License Diagnostic"
                        className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"
                      >
                        <Laptop className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(s)}
                        disabled={currentUserRole === UserRole.VIEWER || canUpdateStatusOnly}
                        className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors disabled:opacity-30"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmTarget({ type: 'software', id: s.id, name: s.name || s.id })}
                        disabled={!canDelete}
                        title="Delete Software License"
                        className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSoftware.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                      No software license matches filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Server Components Table */}
        {selectedSubTab === 'servers' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  <th className="px-4 py-2.5">Part ID</th>
                  <th className="px-4 py-2.5">Server Node</th>
                  <th className="px-4 py-2.5">Part Name</th>
                  <th className="px-4 py-2.5">S/N</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Quantity</th>
                  <th className="px-4 py-2.5">Reorder Level</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-[12px] text-slate-600 font-semibold">
                {filteredServers.map((sc) => (
                  <tr key={sc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 font-mono font-bold text-slate-900">{sc.id}</td>
                    <td className="px-4 py-2 text-slate-800">{sc.serverName}</td>
                    <td className="px-4 py-2 text-slate-700">{sc.partName}</td>
                    <td className="px-4 py-2 font-mono text-slate-500 font-medium">{sc.serialNumber}</td>
                    <td className="px-4 py-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide">
                        {sc.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide ${
                        sc.status === 'Active' ? 'bg-green-100 text-green-700' :
                        sc.status === 'Spare' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {sc.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-800 font-bold">{sc.quantity}</td>
                    <td className="px-4 py-2 text-slate-400 font-medium">{sc.reorderLevel}</td>
                    <td className="px-4 py-2 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleRunAiAnalysis(sc)}
                        title="AI Server Diagnosis"
                        className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"
                      >
                        <Laptop className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(sc)}
                        className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmTarget({ type: 'server', id: sc.id, name: sc.partName || sc.id })}
                        disabled={!canDelete}
                        title="Delete Server Component"
                        className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredServers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No components match filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Barcode Pass View Popup Modal */}
      {selectedBarcodeId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full border border-slate-200 shadow-md space-y-3 relative">
            <button
              onClick={() => setSelectedBarcodeId(null)}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">IT Hardware Asset Passport</h3>
              <p className="text-[11px] text-slate-400 mt-1">Uganda Railways Corporation internal ID tag.</p>
            </div>
            
            <div className="flex justify-center py-2 bg-slate-50 border border-slate-100 rounded">
              {renderBarcode(selectedBarcodeId)}
            </div>

            <p className="text-[10px] text-slate-400 text-center leading-normal">
              Scan barcode physically or search ID to view maintenance metrics.
            </p>
            
            <button
              onClick={() => setSelectedBarcodeId(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 rounded text-xs transition-colors font-mono uppercase"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* AI Diagnostic Diagnostic Popup Modal */}
      {aiAnalysisResult && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-5 max-w-lg w-full border border-slate-200 shadow-md space-y-3 relative">
            <button
              onClick={() => setAiAnalysisResult(null)}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-150">
              <Laptop className="h-4.5 w-4.5 text-yellow-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">URC AI Predictive Diagnostics</h3>
            </div>

            <div className="text-[11px] text-slate-700 leading-relaxed font-sans bg-slate-50 p-3 rounded max-h-[280px] overflow-y-auto whitespace-pre-line border border-slate-150">
              {aiAnalysisResult}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setAiAnalysisResult(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors font-mono uppercase"
              >
                Close Diagnosis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Loader for AI Diagnostics */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-5 flex flex-col items-center gap-3 shadow-md max-w-xs text-center border border-slate-200">
            <RefreshCw className="h-6 w-6 text-yellow-500 animate-spin" />
            <h4 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Predicting Diagnostics...</h4>
            <p className="text-[11px] text-slate-400">Querying server-side Gemini API for URC hardware metrics...</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 max-w-md w-full border border-slate-200 shadow-xl space-y-4 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setDeleteConfirmTarget(null)}
              disabled={isDeleting}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-900 font-mono">Confirm Asset Deletion</h3>
                <p className="text-[11px] text-slate-500">Action requires authorization & logs to audit history</p>
              </div>
            </div>

            <div className="bg-red-50/60 border border-red-200 rounded-lg p-3.5 space-y-2">
              <p className="text-xs text-slate-700 font-medium">
                Are you sure you want to permanently delete this {deleteConfirmTarget.type === 'hardware' ? 'hardware asset' : deleteConfirmTarget.type === 'software' ? 'software license' : 'server spare component'}?
              </p>
              <div className="bg-white p-2.5 rounded border border-red-200 text-xs font-mono font-bold text-slate-800">
                <span className="text-slate-400 font-normal">Asset Tag / Name: </span>
                <span className="text-red-700">{deleteConfirmTarget.name}</span> <span className="text-slate-400">({deleteConfirmTarget.id})</span>
              </div>
              <p className="text-[10px] text-red-600 font-bold uppercase tracking-wide">
                Warning: This item will be removed permanently from inventory registers.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs uppercase tracking-wider font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs uppercase tracking-wider font-mono shadow transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Main Asset Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 max-w-lg w-full border border-slate-200 shadow-md relative my-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-150 flex items-center gap-2 uppercase font-mono">
              <Plus className="h-4 w-4 text-yellow-600" />
              {modalAction === 'add' ? 'Add New' : 'Modify'} {selectedSubTab === 'hardware' ? 'Hardware Asset' : selectedSubTab === 'software' ? 'Software License' : 'Datacenter Part'}
            </h3>

            <form onSubmit={handleSubmitForm} className="space-y-3">
              
              {/* HARDWARE FORM FIELDS */}
              {selectedSubTab === 'hardware' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Asset ID (e.g. HW-101)</label>
                    <input
                      type="text"
                      disabled={modalAction === 'edit'}
                      value={hwId}
                      onChange={(e) => setHwId(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Device Category</label>
                    <select
                      value={hwCategory}
                      onChange={(e) => setHwCategory(e.target.value as any)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    >
                      <option value="Laptop">Laptop</option>
                      <option value="Desktop">Desktop</option>
                      <option value="Switch">Switch</option>
                      <option value="Router">Router</option>
                      <option value="Server">Server</option>
                      <option value="Printer">Printer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                    <label className="block text-[10px] font-bold text-amber-900 uppercase font-mono mb-1">
                      Department (Quick Select)
                    </label>
                    <select
                      value={hwDepartment}
                      onChange={(e) => setHwDepartment(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      required
                    >
                      {URC_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* NETWORK SWITCH / ROUTER SPECIFIC FIELDS */}
                  {(hwCategory === 'Switch' || hwCategory === 'Router') && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Device Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Cisco Catalyst 9300 Switch"
                          value={hwAssetName}
                          onChange={(e) => setHwAssetName(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Owner / Assignee</label>
                        <input
                          type="text"
                          placeholder="e.g. Server Room Core Network"
                          value={hwUser}
                          onChange={(e) => setHwUser(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Model</label>
                        <input
                          type="text"
                          placeholder="e.g. Catalyst 9300 48-Port"
                          value={hwModel}
                          onChange={(e) => setHwModel(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Management IP Address</label>
                        <input
                          type="text"
                          placeholder="e.g. 10.100.1.1"
                          value={hwIpAddress}
                          onChange={(e) => setHwIpAddress(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Port Count / Capacity</label>
                        <input
                          type="text"
                          placeholder="e.g. 48 GbE PoE+ / 4x 10G SFP+"
                          value={hwPortCount}
                          onChange={(e) => setHwPortCount(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Firmware / OS Version</label>
                        <input
                          type="text"
                          placeholder="e.g. Cisco IOS-XE 17.6"
                          value={hwFirmwareVersion}
                          onChange={(e) => setHwFirmwareVersion(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </>
                  )}

                  {/* SERVER SPECIFIC FIELDS */}
                  {hwCategory === 'Server' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Server Name</label>
                        <input
                          type="text"
                          placeholder="e.g. PowerEdge R750 DB Host"
                          value={hwAssetName}
                          onChange={(e) => setHwAssetName(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Server Role / Function</label>
                        <input
                          type="text"
                          placeholder="e.g. Active Directory & ERP Database"
                          value={hwServerRole}
                          onChange={(e) => setHwServerRole(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Model</label>
                        <input
                          type="text"
                          placeholder="e.g. PowerEdge R750"
                          value={hwModel}
                          onChange={(e) => setHwModel(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">IP Address</label>
                        <input
                          type="text"
                          placeholder="e.g. 10.100.2.10"
                          value={hwIpAddress}
                          onChange={(e) => setHwIpAddress(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">CPU Cores</label>
                        <input
                          type="text"
                          placeholder="e.g. 32 Cores (Dual Xeon)"
                          value={hwCpuCores}
                          onChange={(e) => setHwCpuCores(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">RAM Capacity</label>
                        <input
                          type="text"
                          placeholder="e.g. 128 GB ECC DDR4"
                          value={hwRam}
                          onChange={(e) => setHwRam(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Storage Array</label>
                        <input
                          type="text"
                          placeholder="e.g. 4TB RAID-10 NVMe"
                          value={hwHardDisk}
                          onChange={(e) => setHwHardDisk(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">OS / Hypervisor</label>
                        <input
                          type="text"
                          placeholder="e.g. VMware ESXi 8.0 / Windows Server 2022"
                          value={hwOS}
                          onChange={(e) => setHwOS(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </>
                  )}

                  {/* PRINTER SPECIFIC FIELDS */}
                  {hwCategory === 'Printer' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Printer Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HP LaserJet Enterprise Printer"
                          value={hwAssetName}
                          onChange={(e) => setHwAssetName(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Department / Office</label>
                        <input
                          type="text"
                          placeholder="e.g. Finance & Procurement Office"
                          value={hwUser}
                          onChange={(e) => setHwUser(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Model</label>
                        <input
                          type="text"
                          placeholder="e.g. LaserJet M608dn"
                          value={hwModel}
                          onChange={(e) => setHwModel(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Print Technology</label>
                        <input
                          type="text"
                          placeholder="e.g. Monochrome LaserJet / Color InkJet"
                          value={hwPrintTechnology}
                          onChange={(e) => setHwPrintTechnology(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Connection Type</label>
                        <input
                          type="text"
                          placeholder="e.g. Gigabit Ethernet IP / USB 2.0"
                          value={hwConnectionType}
                          onChange={(e) => setHwConnectionType(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">IP Address</label>
                        <input
                          type="text"
                          placeholder="e.g. 10.100.4.50"
                          value={hwIpAddress}
                          onChange={(e) => setHwIpAddress(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </>
                  )}

                  {/* STANDARD LAPTOP / DESKTOP / OTHER FIELDS */}
                  {hwCategory !== 'Switch' && hwCategory !== 'Router' && hwCategory !== 'Server' && hwCategory !== 'Printer' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Asset Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Dell Latitude 5430 Laptop"
                          value={hwAssetName}
                          onChange={(e) => setHwAssetName(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">User / Assignee</label>
                        <input
                          type="text"
                          placeholder="e.g. Martha Aturinda"
                          value={hwUser}
                          onChange={(e) => setHwUser(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Model</label>
                        <input
                          type="text"
                          placeholder="e.g. Latitude 5430"
                          value={hwModel}
                          onChange={(e) => setHwModel(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Operating System</label>
                        <input
                          type="text"
                          placeholder="e.g. Windows 11 Pro 64-bit"
                          value={hwOS}
                          onChange={(e) => setHwOS(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">RAM</label>
                        <input
                          type="text"
                          placeholder="e.g. 16 GB DDR4"
                          value={hwRam}
                          onChange={(e) => setHwRam(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">HARDDISK / SSD</label>
                        <input
                          type="text"
                          placeholder="e.g. 512 GB NVMe SSD"
                          value={hwHardDisk}
                          onChange={(e) => setHwHardDisk(e.target.value)}
                          className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* SHARED HARDWARE FIELDS */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Year of Purchase</label>
                    <input
                      type="text"
                      placeholder="e.g. 2024"
                      value={hwYearOfPurchase}
                      onChange={(e) => setHwYearOfPurchase(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Location / Station</label>
                    <input
                      type="text"
                      placeholder="e.g. HQ, Kampala / DC Rack 04"
                      value={hwLocation}
                      onChange={(e) => setHwLocation(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Serial Number / Tag</label>
                    <input
                      type="text"
                      placeholder="e.g. URC-HW-DL-001"
                      value={hwSerial}
                      onChange={(e) => setHwSerial(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Engraved Tag Number</label>
                    <input
                      type="text"
                      placeholder="e.g. URC-ENG-2024-001"
                      value={hwEngraved}
                      onChange={(e) => setHwEngraved(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Asset Status Description</label>
                    <input
                      type="text"
                      value={hwStatus}
                      onChange={(e) => setHwStatus(e.target.value)}
                      placeholder="e.g. In Use / In Stock / Under Repair / Faulty"
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* SOFTWARE LICENSE FORM FIELDS */}
              {selectedSubTab === 'software' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">License ID</label>
                    <input
                      type="text"
                      disabled={modalAction === 'edit'}
                      value={swId}
                      onChange={(e) => setSwId(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono disabled:opacity-50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">License Key</label>
                    <input
                      type="text"
                      value={swKey}
                      onChange={(e) => setSwKey(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">License / Subscription Title</label>
                    <input
                      type="text"
                      value={swName}
                      onChange={(e) => setSwName(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                    <label className="block text-[10px] font-bold text-amber-900 uppercase font-mono mb-1">
                      Department (Quick Select)
                    </label>
                    <select
                      value={swDepartment}
                      onChange={(e) => setSwDepartment(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      required
                    >
                      {URC_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Category</label>
                    <select
                      value={swCategory}
                      onChange={(e) => setSwCategory(e.target.value as any)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none"
                    >
                      <option value="Operating System">Operating System</option>
                      <option value="GIS">GIS</option>
                      <option value="Office">Office</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Database">Database</option>
                      <option value="Security">Security</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Vendor / Partner</label>
                    <input
                      type="text"
                      value={swVendor}
                      onChange={(e) => setSwVendor(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Total Capacity (Seats)</label>
                    <input
                      type="number"
                      value={swSeats}
                      onChange={(e) => setSwSeats(Number(e.target.value))}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Active / Allocated Seats</label>
                    <input
                      type="number"
                      value={swActiveSeats}
                      onChange={(e) => setSwActiveSeats(Number(e.target.value))}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Annual Subscription Cost (UGX)</label>
                    <input
                      type="number"
                      value={swCostSub}
                      onChange={(e) => setSwCostSub(Number(e.target.value))}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Expiry Date</label>
                    <input
                      type="date"
                      value={swExpiry}
                      onChange={(e) => setSwExpiry(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Status Description</label>
                    <input
                      type="text"
                      value={swStatusField}
                      onChange={(e) => setSwStatusField(e.target.value)}
                      placeholder="e.g. Active / Expiring Soon / Pending Renewal"
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* SERVER COMPONENT FORM FIELDS */}
              {selectedSubTab === 'servers' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Part ID</label>
                    <input
                      type="text"
                      disabled={modalAction === 'edit'}
                      value={srvId}
                      onChange={(e) => setSrvId(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono disabled:opacity-50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Component Serial No.</label>
                    <input
                      type="text"
                      value={srvSerial}
                      onChange={(e) => setSrvSerial(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Datacenter Server Node / Rack location</label>
                    <input
                      type="text"
                      placeholder="e.g. Kampala Main DC - Server Rack 4"
                      value={srvServer}
                      onChange={(e) => setSrvServer(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Part Name / Specification</label>
                    <input
                      type="text"
                      placeholder="e.g. Dell 750W Hot-Plug redundant PSU"
                      value={srvPart}
                      onChange={(e) => setSrvPart(e.target.value)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Category</label>
                    <select
                      value={srvCategory}
                      onChange={(e) => setSrvCategory(e.target.value as any)}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none"
                    >
                      <option value="RAM">RAM</option>
                      <option value="Storage">Storage</option>
                      <option value="CPU">CPU</option>
                      <option value="Power Supply">Power Supply</option>
                      <option value="NIC">NIC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Operational Status Description</label>
                    <input
                      type="text"
                      value={srvStatus}
                      onChange={(e) => setSrvStatus(e.target.value)}
                      placeholder="e.g. Active / Faulty / Spare in DC Rack"
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Available Quantity</label>
                    <input
                      type="number"
                      value={srvQty}
                      onChange={(e) => setSrvQty(Number(e.target.value))}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Reorder Alert Level</label>
                    <input
                      type="number"
                      value={srvReorder}
                      onChange={(e) => setSrvReorder(Number(e.target.value))}
                      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      min="0"
                    />
                  </div>
                </div>
              )}

              {/* Security Warning Notice */}
              <div className="bg-slate-50 p-3 rounded-lg flex items-start gap-2.5 border border-slate-100 text-[10px] text-slate-500 leading-normal">
                <Info className="h-4 w-4 text-slate-400 shrink-0" />
                <p>
                  Saving this form records an audit stamp containing your logged identity (<span className="font-mono font-bold text-slate-700">{userEmail}</span>) as an authorized <span className="font-bold text-amber-600">{currentUserRole}</span> transaction.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-350 text-slate-650 font-bold px-3 py-1.5 rounded text-xs transition-colors font-mono uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded text-xs transition-colors font-mono uppercase"
                >
                  {modalAction === 'add' ? 'Save Entry' : 'Apply Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
