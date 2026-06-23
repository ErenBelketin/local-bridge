const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const os = require('os');

const PORT = 3000;
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;

const DB_FILE = path.join(baseDir, 'db.json');
const UPLOADS_DIR = path.join(baseDir, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize directories and database file
async function initStorage() {
  try {
    if (!existsSync(UPLOADS_DIR)) {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
    if (!existsSync(PUBLIC_DIR)) {
      await fs.mkdir(PUBLIC_DIR, { recursive: true });
    }
    if (!existsSync(DB_FILE)) {
      await fs.writeFile(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Storage initialization failed:', error);
  }
}

// Load / Save DB helpers
async function readDB() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function writeDB(data) {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write database:', error);
  }
}

// Get local network IPv4 addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// --- Open Graph Metadata Parser for Smart Link Previews ---
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getTitle(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function getMetaTag(html, name) {
  const metaRegex = /<meta\s+[^>]*>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const hasTarget = new RegExp(`(property|name)=["']${name}["']`, 'i').test(tag);
    if (hasTarget) {
      const content = tag.match(/content=["'](.*?)["']/i);
      if (content) return decodeHtmlEntities(content[1].trim());
    }
  }
  return null;
}

async function scrapeLinkMetadata(url) {
  try {
    let targetUrl = url.trim();
    // Prepend protocol if missing
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout limit

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();

    const title = getMetaTag(html, 'og:title') || getMetaTag(html, 'title') || getTitle(html) || url;
    const description = getMetaTag(html, 'og:description') || getMetaTag(html, 'description') || '';
    let image = getMetaTag(html, 'og:image') || getMetaTag(html, 'twitter:image') || '';

    // Convert relative image URLs to absolute ones
    if (image && !image.startsWith('http')) {
      const urlObj = new URL(targetUrl);
      image = new URL(image, urlObj.origin).href;
    }

    return {
      title,
      description,
      image
    };
  } catch (error) {
    console.error('Metadata scraping failed for:', url, error.message);
    return null;
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use('/files', express.static(UPLOADS_DIR));

let clients = [];

// Broadcast data to all connected SSE clients
function broadcast(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => client.res.write(message));
}

// SSE Connection Endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(': keep-alive\n\n');

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// API: Get items
app.get('/api/items', async (req, res) => {
  const items = await readDB();
  res.json(items);
});

// API: Add text/link item
app.post('/api/items', async (req, res) => {
  const { type, content, color, title } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const items = await readDB();
  const isLink = type === 'link' || /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/i.test(content.trim());
  
  const newItem = {
    id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    type: isLink ? 'link' : 'text',
    title: title || '',
    content: content.trim(),
    color: color || '#2563eb',
    timestamp: new Date().toISOString()
  };

  // Fetch Open Graph rich details on backend side if it's a URL
  if (isLink) {
    const metadata = await scrapeLinkMetadata(newItem.content);
    if (metadata) {
      newItem.linkTitle = metadata.title;
      newItem.linkDescription = metadata.description;
      newItem.linkImage = metadata.image;
    }
  }

  items.unshift(newItem); // Add to the top
  await writeDB(items);

  res.status(201).json(newItem);
  broadcast({ action: 'add', item: newItem });
});

// API: Upload file item
app.post('/api/upload', upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const items = await readDB();
  const addedItems = [];

  // Parse colors array from request body
  let colors = req.body.colors;
  if (!colors) {
    colors = [];
  } else if (!Array.isArray(colors)) {
    colors = [colors];
  }

  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const fileColor = colors[i] || req.body.color || '#2563eb';
    const decodedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    const newItem = {
      id: 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'file',
      title: decodedOriginalName,
      content: `/files/${file.filename}`, // Download path
      fileName: decodedOriginalName,
      fileSize: file.size,
      fileType: file.mimetype,
      color: fileColor,
      timestamp: new Date().toISOString()
    };
    items.unshift(newItem);
    addedItems.push(newItem);
  }

  await writeDB(items);

  res.status(201).json(addedItems);
  addedItems.forEach(item => {
    broadcast({ action: 'add', item });
  });
});

// API: Update item (Live Note Editing)
app.put('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const { content, title, color } = req.body;
  
  const items = await readDB();
  const index = items.findIndex(item => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const originalItem = items[index];
  
  // Update content
  if (content !== undefined) {
    originalItem.content = content.trim();
  }
  if (color !== undefined) {
    originalItem.color = color;
  }

  // Handle link changes: if URL changed, scrape new metadata
  if (originalItem.type === 'link') {
    originalItem.title = title || originalItem.content;
    const metadata = await scrapeLinkMetadata(originalItem.content);
    if (metadata) {
      originalItem.linkTitle = metadata.title;
      originalItem.linkDescription = metadata.description;
      originalItem.linkImage = metadata.image;
    }
  }

  originalItem.updatedTimestamp = new Date().toISOString();
  await writeDB(items);

  res.json(originalItem);
  broadcast({ action: 'update', item: originalItem });
});

// API: Delete item
app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const items = await readDB();
  const itemToDelete = items.find(item => item.id === id);

  if (!itemToDelete) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // If file, delete it from disk
  if (itemToDelete.type === 'file') {
    try {
      const fileName = path.basename(itemToDelete.content);
      const filePath = path.join(UPLOADS_DIR, fileName);
      await fs.unlink(filePath);
    } catch (err) {
      console.error(`Failed to delete file from disk: ${itemToDelete.content}`, err);
    }
  }

  const updatedItems = items.filter(item => item.id !== id);
  await writeDB(updatedItems);

  res.json({ success: true, deletedId: id });
  broadcast({ action: 'delete', id });
});

// API: Get Info (IP list and server configuration)
app.get('/api/info', (req, res) => {
  const ips = getLocalIPs();
  res.json({
    port: PORT,
    ips: ips,
    activeConnections: clients.length
  });
});

// Run storage initialization and listen inside async wrapper (CommonJS compliance)
(async () => {
  await initStorage();
  
  app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log('==================================================');
    console.log('🚀 LOCAL-BRIDGE SERVER STARTED SUCCESSFULLY!');
    console.log(`💻 Local Access: http://localhost:${PORT}`);
    console.log('📱 Scan QR code on local devices to connect:');
    ips.forEach(ip => {
      console.log(`   👉 http://${ip}:${PORT}`);
    });
    console.log('==================================================');
  });
})();
