/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { 
  UserRole, HardwareAsset, SoftwareLicense, ServerComponent, Alert, AuditLog 
} from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to JSON DB file
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'inventory.json');

// Ensure database directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Default Mock Data
const INITIAL_DB = {
  hardware: [
    {
      id: 'HW-001',
      user: 'Martha Aturinda (Chief IT Officer)',
      assetName: 'Dell Latitude 5430 Laptop',
      yearOfPurchase: '2024',
      location: 'HQ, Kampala',
      model: 'Latitude 5430',
      serialNumber: 'URC-HW-DL-001',
      engravedNumber: 'URC-ENG-2024-001',
      operatingSystem: 'Windows 11 Pro 64-bit',
      ram: '16 GB DDR4',
      hardDisk: '512 GB NVMe SSD',
      status: 'In Use',
      department: 'INFORMATION COMMUNICATION AND TECHNOLOGY',
      name: 'Dell Latitude 5430 Laptop',
      assignee: 'Martha Aturinda (Chief IT Officer)',
      category: 'Laptop',
      cost: 4500000,
      stockLevel: 1,
      reorderLevel: 0
    },
    {
      id: 'HW-002',
      user: 'N/A (Server Room Core)',
      assetName: 'Cisco Catalyst 9300 Switch',
      yearOfPurchase: '2023',
      location: 'Kampala Main DC - Rack 04',
      model: 'Catalyst 9300 48-Port',
      serialNumber: 'URC-HW-CS-102',
      engravedNumber: 'URC-ENG-2023-089',
      operatingSystem: 'Cisco IOS-XE 17.6',
      ram: '16 GB Unified',
      hardDisk: '16 GB Flash',
      status: 'In Use',
      department: 'INFORMATION COMMUNICATION AND TECHNOLOGY',
      name: 'Cisco Catalyst 9300 Switch',
      assignee: 'N/A (Server Room Core)',
      category: 'Switch',
      ipAddress: '10.100.1.1',
      portCount: '48 Gigabit PoE+ / 4x 10G SFP+',
      firmwareVersion: '17.06.03a',
      cost: 16500000,
      stockLevel: 1,
      reorderLevel: 0
    },
    {
      id: 'HW-003',
      user: 'Unassigned (IT Pool)',
      assetName: 'HP LaserJet Enterprise Printer',
      yearOfPurchase: '2025',
      location: 'HQ, Kampala',
      model: 'LaserJet M608dn',
      serialNumber: 'URC-HW-HP-204',
      engravedNumber: 'URC-ENG-2025-012',
      operatingSystem: 'HP FutureSmart Firmware 5',
      ram: '1.5 GB',
      hardDisk: '500 GB Encrypted Drive',
      status: 'In Stock',
      department: 'PROCUREMENT',
      name: 'HP LaserJet Enterprise Printer',
      assignee: 'Unassigned (IT Pool)',
      category: 'Printer',
      printTechnology: 'Monochrome LaserJet',
      connectionType: 'Gigabit Ethernet / USB 2.0',
      ipAddress: '10.100.4.50',
      cost: 2800000,
      stockLevel: 5,
      reorderLevel: 2
    },
    {
      id: 'HW-004',
      user: 'Finance Team (Under Maintenance)',
      assetName: 'Lenovo ThinkCentre M70q Desktop',
      yearOfPurchase: '2024',
      location: 'Nalukolongo Workshop',
      model: 'ThinkCentre M70q Gen 3',
      serialNumber: 'URC-HW-LN-045',
      engravedNumber: 'URC-ENG-2024-114',
      operatingSystem: 'Windows 10 Enterprise LTSC',
      ram: '8 GB DDR4',
      hardDisk: '256 GB NVMe SSD',
      status: 'Maintenance',
      department: 'FINANCE DEPARTMENT',
      name: 'Lenovo ThinkCentre M70q Desktop',
      assignee: 'Finance Team (Under Maintenance)',
      category: 'Desktop',
      cost: 3500000,
      stockLevel: 1,
      reorderLevel: 0
    },
    {
      id: 'HW-005',
      user: 'Station Superintendent',
      assetName: 'Ubiquiti UniFi Gateway Router',
      yearOfPurchase: '2025',
      location: 'Tororo Station Office',
      model: 'UniFi Gateway Pro',
      serialNumber: 'URC-HW-UB-901',
      engravedNumber: 'URC-ENG-2025-205',
      operatingSystem: 'UniFi OS v3.2',
      ram: '256 MB DDR3',
      hardDisk: '128 MB Flash',
      status: 'In Stock',
      department: 'OPERATIONS DEPARTMENT',
      name: 'Ubiquiti UniFi Gateway Router',
      assignee: 'Station Superintendent',
      category: 'Router',
      ipAddress: '192.168.10.1',
      portCount: '4x WAN/LAN GbE RJ45',
      firmwareVersion: 'v3.2.12',
      cost: 950000,
      stockLevel: 1,
      reorderLevel: 3
    }
  ] as HardwareAsset[],
  software: [
    {
      id: 'SW-001',
      name: 'Windows 11 Enterprise LTSC',
      category: 'Operating System',
      licenseKey: 'W11-URC-KEYS-2026-AX89',
      seatCapacity: 250,
      activeSeats: 215,
      expiryDate: '2028-12-31',
      subscriptionCost: 12500000,
      vendor: 'Microsoft East Africa',
      status: 'Active'
    },
    {
      id: 'SW-002',
      name: 'ArcGIS Desktop Standard',
      category: 'GIS',
      licenseKey: 'GIS-URC-MAP-9876-QW12',
      seatCapacity: 15,
      activeSeats: 12,
      expiryDate: '2026-08-10', // Expiring soon in our timeline of July 2026!
      subscriptionCost: 45000000,
      vendor: 'Esri Uganda',
      status: 'Expiring Soon'
    },
    {
      id: 'SW-003',
      name: 'Oracle Database Standard',
      category: 'Database',
      licenseKey: 'ORC-URC-DB-5544-TR71',
      seatCapacity: 5,
      activeSeats: 5,
      expiryDate: '2026-07-01', // Expired!
      subscriptionCost: 68000000,
      vendor: 'Oracle Uganda',
      status: 'Expired'
    },
    {
      id: 'SW-004',
      name: 'Microsoft Office 365 E5',
      category: 'Office',
      licenseKey: 'O365-URC-CLD-8822-PL50',
      seatCapacity: 300,
      activeSeats: 295,
      expiryDate: '2027-03-15',
      subscriptionCost: 25000000,
      vendor: 'Microsoft East Africa',
      status: 'Active'
    }
  ] as SoftwareLicense[],
  serverComponents: [
    {
      id: 'SC-001',
      serverName: 'Kampala Main DC - Server 1',
      partName: 'Samsung 32GB DDR4 RDIMM',
      serialNumber: 'SN-RAM-SS-001',
      category: 'RAM',
      status: 'Active',
      quantity: 8,
      reorderLevel: 4
    },
    {
      id: 'SC-002',
      serverName: 'Gulu Station Backup Node',
      partName: 'Seagate Exos 12TB SATA Enterprise HDD',
      serialNumber: 'SN-HD-SG-992',
      category: 'Storage',
      status: 'Faulty',
      quantity: 1,
      reorderLevel: 2
    },
    {
      id: 'SC-003',
      serverName: 'Kampala Main DC - Server 2',
      partName: 'Intel Xeon Gold 6248R 3.0GHz',
      serialNumber: 'SN-CPU-IX-102',
      category: 'CPU',
      status: 'Active',
      quantity: 2,
      reorderLevel: 1
    },
    {
      id: 'SC-004',
      serverName: 'Nalukolongo Workshop Node',
      partName: 'Dell 750W Hot-Plug PSU',
      serialNumber: 'SN-PS-DL-402',
      category: 'Power Supply',
      status: 'Spare',
      quantity: 3,
      reorderLevel: 5
    }
  ] as ServerComponent[],
  alerts: [] as Alert[],
  auditLogs: [
    {
      id: 'LOG-001',
      user: 'kajjabwangulester@gmail.com',
      role: 'Admin',
      action: 'System Init',
      details: 'Uganda Railways Corporation IT Inventory System initialized successfully with sample data.',
      timestamp: new Date().toISOString()
    }
  ] as AuditLog[]
};

// Database state
let db = { ...INITIAL_DB };

// Load DB from File
const loadDb = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(fileContent);
    } else {
      saveDb();
    }
  } catch (err) {
    console.error('Failed to load local DB:', err);
  }
};

// Save DB to File
const saveDb = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save local DB:', err);
  }
};

// Lazy initialization of Gemini API
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Helper to log audit actions
const logAudit = (user: string, role: string, action: string, details: string) => {
  const newLog: AuditLog = {
    id: `LOG-${Date.now().toString().slice(-5)}`,
    user,
    role,
    action,
    details,
    timestamp: new Date().toISOString()
  };
  db.auditLogs.unshift(newLog);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500); // keep last 500
  }
  saveDb();
};

// Run automated reorder and expiration checks to populate Alerts
const runAlertChecks = () => {
  const currentAlerts: Alert[] = [];
  const currentDate = new Date('2026-07-14'); // Target timeline date

  // 1. Hardware low stock levels (reorder level checks)
  db.hardware.forEach(hw => {
    if (hw.stockLevel <= hw.reorderLevel && hw.reorderLevel > 0) {
      currentAlerts.push({
        id: `ALT-HW-${hw.id}-${Date.now().toString().slice(-4)}`,
        type: 'low_stock',
        title: `Low Hardware Stock: ${hw.name}`,
        message: `Stock level for ${hw.name} is currently ${hw.stockLevel} units. Reorder level is set at ${hw.reorderLevel} units.`,
        timestamp: new Date().toISOString(),
        itemType: 'hardware',
        itemId: hw.id,
        emailSent: true,
        emailTo: 'it-manager@urc.go.ug',
        status: 'unread'
      });
    }
  });

  // 2. Software expiration check
  db.software.forEach(sw => {
    const expDate = new Date(sw.expiryDate);
    const diffTime = expDate.getTime() - currentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      currentAlerts.push({
        id: `ALT-SW-${sw.id}-${Date.now().toString().slice(-4)}`,
        type: 'license_expiry',
        title: `EXPIRED License: ${sw.name}`,
        message: `The license for ${sw.name} expired on ${sw.expiryDate} (expired by ${Math.abs(diffDays)} days). Active seats: ${sw.activeSeats}/${sw.seatCapacity}.`,
        timestamp: new Date().toISOString(),
        itemType: 'software',
        itemId: sw.id,
        emailSent: true,
        emailTo: 'it-manager@urc.go.ug',
        status: 'unread'
      });
    } else if (diffDays <= 30) {
      currentAlerts.push({
        id: `ALT-SW-${sw.id}-${Date.now().toString().slice(-4)}`,
        type: 'license_expiry',
        title: `Expiring License Alert: ${sw.name}`,
        message: `The license for ${sw.name} expires on ${sw.expiryDate} (expires in ${diffDays} days). Plan renewal immediately.`,
        timestamp: new Date().toISOString(),
        itemType: 'software',
        itemId: sw.id,
        emailSent: true,
        emailTo: 'it-manager@urc.go.ug',
        status: 'unread'
      });
    }
  });

  // 3. Server Components low stock
  db.serverComponents.forEach(sc => {
    if (sc.quantity <= sc.reorderLevel) {
      currentAlerts.push({
        id: `ALT-SC-${sc.id}-${Date.now().toString().slice(-4)}`,
        type: 'low_stock',
        title: `Low Server Component: ${sc.partName}`,
        message: `Quantity of component "${sc.partName}" for server "${sc.serverName}" is currently ${sc.quantity} units (Reorder limit: ${sc.reorderLevel}).`,
        timestamp: new Date().toISOString(),
        itemType: 'server',
        itemId: sc.id,
        emailSent: true,
        emailTo: 'it-technician@urc.go.ug',
        status: 'unread'
      });
    } else if (sc.status === 'Faulty') {
      currentAlerts.push({
        id: `ALT-SC-FLT-${sc.id}-${Date.now().toString().slice(-4)}`,
        type: 'maintenance',
        title: `Faulty Component Detected: ${sc.partName}`,
        message: `The ${sc.partName} on server ${sc.serverName} has been flagged as "Faulty". Maintenance/replacement is required.`,
        timestamp: new Date().toISOString(),
        itemType: 'server',
        itemId: sc.id,
        emailSent: true,
        emailTo: 'it-technician@urc.go.ug',
        status: 'unread'
      });
    }
  });

  // Update DB alerts list
  // Only add alerts if they don't already exist for this item + alert type combination (or update them)
  currentAlerts.forEach(newAlert => {
    const exists = db.alerts.some(a => a.itemId === newAlert.itemId && a.type === newAlert.type && a.status === 'unread');
    if (!exists) {
      db.alerts.unshift(newAlert);
    }
  });

  saveDb();
};

// Load existing DB initially and run alert checks
loadDb();
runAlertChecks();

// --- API ROUTES ---

// Dashboard Analytics API
app.get('/api/analytics', (req, res) => {
  const hardwareCount = db.hardware.length;
  const hardwareValue = db.hardware.reduce((acc, h) => acc + h.cost, 0);
  
  const activeLicenses = db.software.filter(s => s.status === 'Active' || s.status === 'Expiring Soon').length;
  const licenseCost = db.software.reduce((acc, s) => acc + s.subscriptionCost, 0);
  
  const serverComponents = db.serverComponents.reduce((acc, s) => acc + s.quantity, 0);
  
  const lowStockAlertCount = db.alerts.filter(a => a.type === 'low_stock' && a.status === 'unread').length;
  const expiringLicensesCount = db.alerts.filter(a => a.type === 'license_expiry' && a.status === 'unread').length;

  res.json({
    totalHardwareCount: hardwareCount,
    totalHardwareValue: hardwareValue,
    totalActiveLicenses: activeLicenses,
    totalLicenseCost: licenseCost,
    totalServerComponents: serverComponents,
    lowStockAlertCount,
    expiringLicensesCount,
    categoryHardwareBreakdown: db.hardware.reduce((acc: any, h) => {
      acc[h.category] = (acc[h.category] || 0) + 1;
      return acc;
    }, {}),
    softwareStatusBreakdown: db.software.reduce((acc: any, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {}),
    serverComponentCategoryBreakdown: db.serverComponents.reduce((acc: any, sc) => {
      acc[sc.category] = (acc[sc.category] || 0) + sc.quantity;
      return acc;
    }, {})
  });
});

// Hardware API
app.get('/api/hardware', (req, res) => {
  res.json(db.hardware);
});

app.post('/api/hardware', (req, res) => {
  const userHeader = req.headers['x-user-email'] as string || 'anonymous';
  const roleHeader = req.headers['x-user-role'] as string || 'Viewer';

  if (roleHeader === 'Viewer') {
    return res.status(403).json({ error: 'Permission denied. Viewers cannot add assets.' });
  }

  const raw = req.body;
  if (!raw.id) {
    return res.status(400).json({ error: 'Asset ID is required.' });
  }

  const assetName = raw.assetName || raw.name || 'Unnamed Asset';
  const user = raw.user || raw.assignee || 'Unassigned';
  const model = raw.model || '';

  const detectCategory = (nameStr: string, modelStr: string): 'Laptop' | 'Desktop' | 'Switch' | 'Router' | 'Server' | 'Printer' | 'Other' => {
    const text = `${nameStr} ${modelStr}`.toLowerCase();
    if (text.includes('switch') || text.includes('catalyst')) return 'Switch';
    if (text.includes('router') || text.includes('unifi') || text.includes('gateway') || text.includes('access point')) return 'Router';
    if (text.includes('server') || text.includes('poweredge') || text.includes('proliant')) return 'Server';
    if (text.includes('printer') || text.includes('laserjet') || text.includes('inkjet') || text.includes('epson')) return 'Printer';
    if (text.includes('desktop') || text.includes('thinkcentre') || text.includes('optiplex') || text.includes('workstation')) return 'Desktop';
    if (text.includes('laptop') || text.includes('latitude') || text.includes('thinkpad') || text.includes('macbook') || text.includes('notebook')) return 'Laptop';
    return 'Desktop';
  };

  const category = raw.category && raw.category !== 'Laptop' ? raw.category : (raw.category || detectCategory(assetName, model));

  const asset: HardwareAsset = {
    id: raw.id,
    user: user,
    assetName: assetName,
    yearOfPurchase: raw.yearOfPurchase || new Date().getFullYear().toString(),
    location: raw.location || 'HQ, Kampala',
    model: model || 'Standard Model',
    serialNumber: raw.serialNumber || 'N/A',
    engravedNumber: raw.engravedNumber || 'N/A',
    operatingSystem: raw.operatingSystem || 'N/A',
    ram: raw.ram || 'N/A',
    hardDisk: raw.hardDisk || 'N/A',
    status: raw.status || 'In Stock',
    department: raw.department || 'INFORMATION COMMUNICATION AND TECHNOLOGY',
    ipAddress: raw.ipAddress || '',
    portCount: raw.portCount || '',
    firmwareVersion: raw.firmwareVersion || '',
    serverRole: raw.serverRole || '',
    cpuCores: raw.cpuCores || '',
    connectionType: raw.connectionType || '',
    printTechnology: raw.printTechnology || '',
    name: assetName,
    assignee: user,
    category: category,
    cost: Number(raw.cost) || 0,
    stockLevel: Number(raw.stockLevel) || 1,
    reorderLevel: Number(raw.reorderLevel) || 0,
    dateAcquired: raw.dateAcquired || new Date().toISOString().split('T')[0]
  };

  if (db.hardware.some(h => h.id === asset.id)) {
    return res.status(400).json({ error: 'Asset with this ID already exists.' });
  }

  db.hardware.push(asset);
  logAudit(userHeader, roleHeader, 'Create Hardware', `Added hardware asset ${asset.assetName} (${asset.id}).`);
  runAlertChecks();
  res.status(201).json(asset);
});

app.put('/api/hardware/:id', (req, res) => {
  const userHeader = req.headers['x-user-email'] as string || 'anonymous';
  const roleHeader = req.headers['x-user-role'] as string || 'Viewer';

  if (roleHeader === 'Viewer') {
    return res.status(403).json({ error: 'Permission denied. Viewers cannot edit assets.' });
  }

  const { id } = req.params;
  const index = db.hardware.findIndex(h => h.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Asset not found.' });
  }

  const raw = req.body;
  const existing = db.hardware[index];

  const assetName = raw.assetName || raw.name || existing.assetName || existing.name || 'Unnamed Asset';
  const user = raw.user || raw.assignee || existing.user || existing.assignee || 'Unassigned';

  const updated: HardwareAsset = {
    ...existing,
    ...raw,
    assetName,
    user,
    name: assetName,
    assignee: user,
  };

  db.hardware[index] = updated;
  logAudit(userHeader, roleHeader, 'Update Hardware', `Updated hardware asset ${updated.assetName} (${id}). Status: ${updated.status}.`);
  runAlertChecks();
  res.json(updated);
});

app.delete('/api/hardware/:id', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  if (role !== 'Admin' && role !== 'IT Manager') {
    return res.status(403).json({ error: 'Permission denied. Only Administrators and IT Managers can delete assets.' });
  }

  const { id } = req.params;
  const index = db.hardware.findIndex(h => h.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Asset not found.' });
  }

  const deleted = db.hardware.splice(index, 1)[0];
  logAudit(user, role, 'Delete Hardware', `Deleted hardware asset ${deleted.name} (${id}).`);
  runAlertChecks();
  res.json({ success: true, deletedId: id });
});

// Software API
app.get('/api/software', (req, res) => {
  res.json(db.software);
});

app.post('/api/software', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  if (role === 'Viewer' || role === 'Technician') {
    return res.status(403).json({ error: 'Permission denied. You cannot create software licenses.' });
  }

  const license: SoftwareLicense = req.body;
  if (!license.id || !license.name) {
    return res.status(400).json({ error: 'License ID and Name are required.' });
  }

  if (db.software.some(s => s.id === license.id)) {
    return res.status(400).json({ error: 'License with this ID already exists.' });
  }

  db.software.push(license);
  logAudit(user, role, 'Create Software', `Registered software license ${license.name} (${license.id}) with ${license.seatCapacity} seats.`);
  runAlertChecks();
  res.status(201).json(license);
});

app.put('/api/software/:id', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  if (role === 'Viewer' || role === 'Technician') {
    return res.status(403).json({ error: 'Permission denied. You cannot edit software licenses.' });
  }

  const { id } = req.params;
  const index = db.software.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'License not found.' });
  }

  const updated = { ...db.software[index], ...req.body };
  db.software[index] = updated;
  logAudit(user, role, 'Update Software', `Updated software license ${updated.name} (${id}). Seat allocation: ${updated.activeSeats}/${updated.seatCapacity}.`);
  runAlertChecks();
  res.json(updated);
});

app.delete('/api/software/:id', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  if (role !== 'Admin' && role !== 'IT Manager') {
    return res.status(403).json({ error: 'Permission denied. Only Administrators and IT Managers can delete licenses.' });
  }

  const { id } = req.params;
  const index = db.software.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'License not found.' });
  }

  const deleted = db.software.splice(index, 1)[0];
  logAudit(user, role, 'Delete Software', `Deleted software license ${deleted.name} (${id}).`);
  runAlertChecks();
  res.json({ success: true, deletedId: id });
});

// Server Components API
app.get('/api/server-components', (req, res) => {
  res.json(db.serverComponents);
});

app.post('/api/server-components', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  if (role === 'Viewer') {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  const comp: ServerComponent = req.body;
  if (!comp.id || !comp.partName || !comp.serverName) {
    return res.status(400).json({ error: 'Component ID, Server Name, and Part Name are required.' });
  }

  if (db.serverComponents.some(sc => sc.id === comp.id)) {
    return res.status(400).json({ error: 'Component ID already exists.' });
  }

  db.serverComponents.push(comp);
  logAudit(user, role, 'Create Component', `Added component ${comp.partName} to server ${comp.serverName}.`);
  runAlertChecks();
  res.status(201).json(comp);
});

app.put('/api/server-components/:id', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  if (role === 'Viewer') {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  const { id } = req.params;
  const index = db.serverComponents.findIndex(sc => sc.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Component not found.' });
  }

  const updated = { ...db.serverComponents[index], ...req.body };
  db.serverComponents[index] = updated;
  logAudit(user, role, 'Update Component', `Updated component ${updated.partName} on ${updated.serverName}. Status: ${updated.status}.`);
  runAlertChecks();
  res.json(updated);
});

app.delete('/api/server-components/:id', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  if (role !== 'Admin' && role !== 'IT Manager') {
    return res.status(403).json({ error: 'Permission denied. Only Administrators and IT Managers can delete server parts.' });
  }

  const { id } = req.params;
  const index = db.serverComponents.findIndex(sc => sc.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Component not found.' });
  }

  const deleted = db.serverComponents.splice(index, 1)[0];
  logAudit(user, role, 'Delete Component', `Deleted component ${deleted.partName} (${id}) from ${deleted.serverName}.`);
  runAlertChecks();
  res.json({ success: true, deletedId: id });
});

// Alerts API
app.get('/api/alerts', (req, res) => {
  res.json(db.alerts);
});

app.post('/api/alerts/resolve/:id', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  if (role === 'Viewer') {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  const { id } = req.params;
  const alertIndex = db.alerts.findIndex(a => a.id === id);
  if (alertIndex === -1) {
    return res.status(404).json({ error: 'Alert not found.' });
  }

  db.alerts[alertIndex].status = 'resolved';
  logAudit(user, role, 'Resolve Alert', `Resolved alert: "${db.alerts[alertIndex].title}"`);
  saveDb();
  res.json(db.alerts[alertIndex]);
});

app.post('/api/alerts/check-triggers', (req, res) => {
  const user = req.headers['x-user-email'] as string || 'anonymous';
  const role = req.headers['x-user-role'] as string || 'Viewer';

  runAlertChecks();
  logAudit(user, role, 'Audit Check', `Manually triggered automated inventory scans and stock checks.`);
  res.json({ success: true, message: 'Stock levels scanned. Automated email warnings logged in the outbox.' });
});

// Audit Logs API
app.get('/api/audit-logs', (req, res) => {
  res.json(db.auditLogs);
});

// AI Copilot Query using @google/genai
app.post('/api/copilot/query', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const aiClient = getGeminiClient();
  if (!aiClient) {
    // Graceful mocked response if Gemini API Key is missing
    return res.json({
      reply: `[Demo Mode / API Key Not Configured] I can see your URC IT Inventory has:
- ${db.hardware.length} Hardware Assets (Value: $${db.hardware.reduce((a,c)=>a+c.cost, 0)})
- ${db.software.length} Registered Licenses (Total Cost: $${db.software.reduce((a,c)=>a+c.subscriptionCost, 0)})
- ${db.serverComponents.length} Server Core Components

Here is an analysis based on your query "${prompt}":
1. **Low Stock alert**: Ubiquiti AP AC Pro is at 1 unit (reorder is 3). I recommend ordering 5 units for Tororo Station.
2. **Oracle Database License**: Expired on 2026-07-01. Plan a renewal of Oracle Uganda immediately to avoid technical downtime.
3. **Hardware Maintenance**: Dell Latitude 5430 (${db.hardware[0].serialNumber}) is active under the Chief IT Officer.

*Please configure the GEMINI_API_KEY in the Secrets menu to unlock real-time intelligence queries.*`
    });
  }

  try {
    const systemContext = `
You are the "URC IT Intelligent Copilot", an AI assistant specialized in analyzing the IT assets of Uganda Railways Corporation.
Here is the current real-time state of the database:
Hardware Inventory:
${JSON.stringify(db.hardware, null, 2)}

Software Licenses:
${JSON.stringify(db.software, null, 2)}

Server Components:
${JSON.stringify(db.serverComponents, null, 2)}

Active Alerts:
${JSON.stringify(db.alerts.filter(a => a.status === 'unread'), null, 2)}

Guidelines:
- Provide high-quality, practical advice on procurement, reorder recommendations, and licensing.
- Use professional tone reflecting a senior Uganda Railways IT systems engineer.
- Be concise and focus on optimization and cost efficiency.
`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemContext,
        temperature: 0.7,
      }
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Gemini Copilot Error:', error);
    res.status(500).json({ error: 'AI processing failed', details: error.message });
  }
});

// Analyze Hardware / Component specifically
app.post('/api/copilot/analyze/:id', async (req, res) => {
  const { id } = req.params;
  const hw = db.hardware.find(h => h.id === id) || db.serverComponents.find(sc => sc.id === id) || db.software.find(s => s.id === id);
  if (!hw) {
    return res.status(404).json({ error: 'Item not found for analysis.' });
  }

  const aiClient = getGeminiClient();
  if (!aiClient) {
    return res.json({
      analysis: `### [Demo Mode] Preventive Maintenance Recommendation for ${('name' in hw) ? hw.name : ('partName' in hw) ? hw.partName : 'Asset'} (${id})
- **Item Summary**: Status is currently **${hw.status}** located at **${('location' in hw) ? hw.location : ('serverName' in hw) ? hw.serverName : 'URC HQ'}**.
- **Assessment**: Recommended routine hardware thermal dust-blow, thermal paste re-application, and network bandwidth test in Kampala central loop.
- **Risk Level**: Low. Monitor logs weekly. Configure Gemini API key for dynamic AI analytics.`
    });
  }

  try {
    const prompt = `Generate a formal preventative maintenance recommendation, diagnostic plan, and risk level assessment for this asset of Uganda Railways Corporation:
${JSON.stringify(hw, null, 2)}
Include steps to prolong the lifespan of this IT asset. Keep it under 250 words.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an IT infrastructure specialist at Uganda Railways Corporation. Write highly specialized and professional tech recommendations.',
        temperature: 0.4
      }
    });

    res.json({ analysis: response.text });
  } catch (error: any) {
    res.status(500).json({ error: 'AI analysis failed', details: error.message });
  }
});

// Serve static assets in production or delegate to Vite in dev
const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support React router single page routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`URC IT Inventory Server is listening on http://0.0.0.0:${PORT}`);
  });
};

startServer();
