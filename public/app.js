document.addEventListener('DOMContentLoaded', () => {
  // --- App State ---
  let items = [];
  let serverInfo = { port: 3000, ips: [], activeConnections: 1 };
  let activeTab = 'textTab';
  let activeFilter = 'all';
  let selectedColor = '#2563eb'; // Default blue
  let qrCodeInstance = null;
  let sseSource = null;
  let selectedFiles = [];

  // --- DOM Elements ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const colorDots = document.querySelectorAll('.color-dot');
  
  const textForm = document.getElementById('textForm');
  const textInput = document.getElementById('textInput');
  const linkForm = document.getElementById('linkForm');
  const linkInput = document.getElementById('linkInput');
  const linkTitleInput = document.getElementById('linkTitleInput');
  
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const uploadProgressContainer = document.getElementById('uploadProgressContainer');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const progressPercentage = document.getElementById('progressPercentage');
  const selectedFilesList = document.getElementById('selectedFilesList');
  const uploadBtn = document.getElementById('uploadBtn');
  
  const searchInput = document.getElementById('searchInput');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const itemsGrid = document.getElementById('itemsGrid');
  const emptyState = document.getElementById('emptyState');
  
  const ipSelect = document.getElementById('ipSelect');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const clientCount = document.getElementById('clientCount');
  const totalItemsCount = document.getElementById('totalItemsCount');
  const statusBadge = document.getElementById('statusBadge');
  const headerConnectionText = document.getElementById('headerConnectionText');
  const themeToggle = document.getElementById('themeToggle');
  
  const previewModal = document.getElementById('previewModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalFooter = document.getElementById('modalFooter');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const toastContainer = document.getElementById('toastContainer');

  // --- Init & Theme Configuration ---
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }

  themeToggle.addEventListener('click', () => {
    if (document.body.classList.contains('dark-mode')) {
      document.body.classList.replace('dark-mode', 'light-mode');
      themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
      localStorage.setItem('theme', 'light');
      showToast('Aydınlık tema aktif', 'info');
    } else {
      document.body.classList.replace('light-mode', 'dark-mode');
      themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
      localStorage.setItem('theme', 'dark');
      showToast('Karanlık tema aktif', 'info');
    }
    // Redraw QR if color palette changes
    generateQR();
  });

  // --- Tabs Navigation ---
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const paneId = btn.dataset.tab;
      document.getElementById(paneId).classList.add('active');
      activeTab = paneId;
    });
  });

  // --- Color Selection ---
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const parent = dot.closest('.color-dots');
      parent.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      selectedColor = dot.dataset.color;
    });
  });

  // --- Fetch & Sync ---
  async function fetchServerInfo() {
    try {
      const res = await fetch('/api/info');
      serverInfo = await res.json();
      updateServerUI();
    } catch (err) {
      console.error('Failed to fetch server info:', err);
    }
  }

  async function fetchItems() {
    try {
      const res = await fetch('/api/items');
      items = await res.json();
      renderItems();
    } catch (err) {
      console.error('Failed to fetch items:', err);
      showToast('Veriler yüklenemedi!', 'error');
    }
  }

  function updateServerUI() {
    // Populate IP list
    const originalValue = ipSelect.value;
    ipSelect.innerHTML = '';
    
    // Add localhost
    const localOption = document.createElement('option');
    localOption.value = `http://localhost:${serverInfo.port}`;
    localOption.textContent = `localhost:${serverInfo.port}`;
    ipSelect.appendChild(localOption);

    // Add actual local network IPs
    serverInfo.ips.forEach(ip => {
      const option = document.createElement('option');
      option.value = `http://${ip}:${serverInfo.port}`;
      option.textContent = `${ip}:${serverInfo.port}`;
      ipSelect.appendChild(option);
    });

    // Select the first real local network IP as default on PC, so QR is scannable
    if (!originalValue && serverInfo.ips.length > 0) {
      ipSelect.value = `http://${serverInfo.ips[0]}:${serverInfo.port}`;
    } else if (originalValue) {
      ipSelect.value = originalValue;
    }

    clientCount.textContent = `${serverInfo.activeConnections} aktif cihaz`;
    if (serverInfo.activeConnections > 1) {
      headerConnectionText.innerHTML = `<span class="badge badge-success">${serverInfo.activeConnections} Cihaz Bağlı</span>`;
    } else {
      headerConnectionText.textContent = 'Arama bekleniyor... Telefonunuzdan bağlanın';
    }

    generateQR();
  }

  function generateQR() {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    
    const selectedUrl = ipSelect.value || window.location.origin;
    
    // Ensure dark/light modes match QR color scheme for premium aesthetics
    const isDark = document.body.classList.contains('dark-mode');
    const colorDark = "#0a0a0f"; // Very dark purple/black
    const colorLight = "#ffffff";

    try {
      if (typeof QRCode !== 'undefined') {
        qrCodeInstance = new QRCode(qrContainer, {
          text: selectedUrl,
          width: 140,
          height: 140,
          colorDark: colorDark,
          colorLight: colorLight,
          correctLevel: QRCode.CorrectLevel.H
        });
      } else {
        qrContainer.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-secondary); font-size: 0.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> QR Kod oluşturulamadı (Kitaplık yüklenemedi)</div>';
      }
    } catch (err) {
      console.error('QR code generation failed:', err);
    }
  }

  ipSelect.addEventListener('change', () => {
    generateQR();
  });

  copyUrlBtn.addEventListener('click', () => {
    const url = ipSelect.value;
    copyToClipboard(url, 'Bağlantı adresi kopyalandı!');
  });

  // --- Real-time Sync (Server-Sent Events) ---
  function setupSSE() {
    if (sseSource) {
      sseSource.close();
    }

    sseSource = new EventSource('/api/events');

    sseSource.onopen = () => {
      statusBadge.innerHTML = '<span class="pulse-dot"></span> Bağlı';
      statusBadge.className = 'stat-value';
    };

    sseSource.onerror = (err) => {
      console.error('SSE Connection lost, retrying...', err);
      statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Bağlantı Yok';
      statusBadge.className = 'stat-value text-danger';
      // Attempt reconnect after 5 seconds
      setTimeout(setupSSE, 5000);
    };

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'add') {
          // Check if item is already in list to avoid duplicates
          if (!items.find(i => i.id === data.item.id)) {
            items.unshift(data.item);
            renderItems();
            
            // Show toast if the window is not active or item added from another client
            showToast(`Yeni ${data.item.type === 'file' ? 'dosya' : data.item.type === 'link' ? 'bağlantı' : 'metin'} eklendi!`, 'success');
            
            // Fetch server stats for connection changes
            fetchServerInfo();
          }
        } else if (data.action === 'delete') {
          if (items.find(i => i.id === data.id)) {
            items = items.filter(i => i.id !== data.id);
            renderItems();
            showToast('Öge silindi.', 'info');
            fetchServerInfo();
          }
        } else if (data.action === 'update') {
          const index = items.findIndex(i => i.id === data.item.id);
          if (index !== -1) {
            items[index] = data.item;
            renderItems();
            showToast('Paylaşım güncellendi.', 'success');
          }
        }
      } catch (err) {
        console.error('Error handling SSE message:', err);
      }
    };
  }

  // --- Form Submissions ---
  textForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = textInput.value.trim();
    if (!content) return;

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          content,
          color: selectedColor
        })
      });

      if (res.ok) {
        textInput.value = '';
      } else {
        showToast('Gönderme başarısız!', 'error');
      }
    } catch (err) {
      showToast('Sunucu hatası!', 'error');
    }
  });

  linkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = linkInput.value.trim();
    const title = linkTitleInput.value.trim();
    if (!content) return;

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'link',
          content,
          title: title || content,
          color: selectedColor
        })
      });

      if (res.ok) {
        linkInput.value = '';
        linkTitleInput.value = '';
      } else {
        showToast('Gönderme başarısız!', 'error');
      }
    } catch (err) {
      showToast('Sunucu hatası!', 'error');
    }
  });

  // --- File Upload Logic with XMLHttpRequest Progress Tracker ---
  function uploadFiles(items) {
    if (items.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const file = item.file || item; // Support both raw File and queue object { file, color }
      const color = item.color || selectedColor; // Use file-specific color or general selectedColor

      formData.append('files', file);
      formData.append('colors', color);
    }
    formData.append('color', selectedColor);

    // Show Progress Bar
    uploadProgressContainer.classList.remove('hidden');
    uploadProgressBar.style.width = '0%';
    progressPercentage.textContent = '0%';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        // Optimize rendering using requestAnimationFrame
        requestAnimationFrame(() => {
          uploadProgressBar.style.width = percentComplete + '%';
          progressPercentage.textContent = percentComplete + '%';
        });
      }
    };

    xhr.onload = () => {
      uploadProgressContainer.classList.add('hidden');
      if (xhr.status === 201) {
        showToast('Dosyalar başarıyla yüklendi!', 'success');
        selectedFiles = []; // Clear local files queue
        updateSelectedFilesUI();
      } else {
        showToast('Dosya yükleme hatası!', 'error');
      }
    };

    xhr.onerror = () => {
      uploadProgressContainer.classList.add('hidden');
      showToast('Dosya yüklenirken sunucu hatası oluştu!', 'error');
    };

    xhr.send(formData);
  }

  // --- Selected Files Queue Management ---
  function updateSelectedFilesUI() {
    selectedFilesList.innerHTML = '';
    if (selectedFiles.length === 0) {
      selectedFilesList.classList.add('hidden');
      uploadBtn.disabled = true;
      return;
    }

    selectedFilesList.classList.remove('hidden');
    uploadBtn.disabled = false;

    const availableColors = ['#2563eb', '#7c3aed', '#0d9488', '#16a34a', '#ca8a04', '#dc2626'];

    selectedFiles.forEach((fileObj, index) => {
      const file = fileObj.file;
      const item = document.createElement('div');
      item.className = 'selected-file-item';

      const fileInfo = document.createElement('div');
      fileInfo.className = 'selected-file-name';
      
      const fileIconClass = getFileIcon(file.type || '', file.name || '');
      fileInfo.innerHTML = `<i class="${fileIconClass}"></i> <span>${file.name} (${formatBytes(file.size)})</span>`;

      // Controls container (color dots + remove button)
      const controls = document.createElement('div');
      controls.className = 'selected-file-controls';

      // Mini Color Picker
      const miniDotsContainer = document.createElement('div');
      miniDotsContainer.className = 'mini-color-dots';

      availableColors.forEach(col => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'mini-color-dot';
        if (fileObj.color === col) dot.classList.add('active');
        dot.style.backgroundColor = col;
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          fileObj.color = col;
          updateSelectedFilesUI();
        });
        miniDotsContainer.appendChild(dot);
      });
      controls.appendChild(miniDotsContainer);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'selected-file-remove';
      removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      removeBtn.title = 'Kaldır';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        updateSelectedFilesUI();
      });
      controls.appendChild(removeBtn);

      item.appendChild(fileInfo);
      item.appendChild(controls);
      selectedFilesList.appendChild(item);
    });
  }

  // Dropzone Events
  dropZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', () => {
    for (let i = 0; i < fileInput.files.length; i++) {
      selectedFiles.push({ file: fileInput.files[i], color: selectedColor });
    }
    updateSelectedFilesUI();
    fileInput.value = ''; // Reset so the same file can be re-selected if removed
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    for (let i = 0; i < files.length; i++) {
      selectedFiles.push({ file: files[i], color: selectedColor });
    }
    updateSelectedFilesUI();
  });

  // Send files button trigger
  uploadBtn.addEventListener('click', () => {
    if (selectedFiles.length > 0) {
      uploadFiles(selectedFiles);
    }
  });

  // --- Keyboard Shortcuts & Global Paste (Ctrl+V) ---
  document.addEventListener('paste', (e) => {
    // Avoid hijacking paste if the user is typing inside an active input field
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
      return;
    }

    const itemsPasted = e.clipboardData.items;
    const filesToUpload = [];
    let textToShare = null;

    for (let i = 0; i < itemsPasted.length; i++) {
      const item = itemsPasted[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) filesToUpload.push(file);
      } else if (item.kind === 'string' && item.type === 'text/plain') {
        item.getAsString((str) => {
          // If files are also pasted (e.g. some systems paste both), skip text
          if (filesToUpload.length > 0) return;
          
          textToShare = str.trim();
          if (textToShare) {
            // Auto submit pasted link or text
            const isUrl = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/.test(textToShare);
            const bodyPayload = isUrl 
              ? { type: 'link', content: textToShare, title: textToShare, color: selectedColor }
              : { type: 'text', content: textToShare, color: selectedColor };
              
            fetch('/api/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyPayload)
            })
            .then(res => {
              if (res.ok) {
                showToast('Pano içeriği otomatik paylaşıldı!', 'success');
              }
            });
          }
        });
      }
    }

    if (filesToUpload.length > 0) {
      uploadFiles(filesToUpload);
    }
  });

  // --- Search & Filters ---
  searchInput.addEventListener('input', () => {
    renderItems();
  });

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderItems();
    });
  });

  // --- Rendering engine ---
  function renderItems() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    
    // Filter items
    const filtered = items.filter(item => {
      // Type Filter
      if (activeFilter !== 'all' && item.type !== activeFilter) {
        return false;
      }
      // Search Filter
      if (searchQuery) {
        const matchesContent = item.content && item.content.toLowerCase().includes(searchQuery);
        const matchesTitle = item.title && item.title.toLowerCase().includes(searchQuery);
        const matchesFileName = item.fileName && item.fileName.toLowerCase().includes(searchQuery);
        return matchesContent || matchesTitle || matchesFileName;
      }
      return true;
    });

    totalItemsCount.textContent = `${items.length} öge`;

    if (filtered.length === 0) {
      itemsGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    
    // Optimize rendering by using a DocumentFragment to avoid reflows
    const fragment = document.createDocumentFragment();

    filtered.forEach(item => {
      const card = createCardDOM(item);
      fragment.appendChild(card);
    });

    itemsGrid.innerHTML = '';
    itemsGrid.appendChild(fragment);
  }

  function createCardDOM(item) {
    const card = document.createElement('article');
    card.className = 'share-card';
    card.dataset.id = item.id;
    
    // Card Accent strip
    const accent = document.createElement('div');
    accent.className = 'card-accent';
    accent.style.backgroundColor = item.color || '#2563eb';
    card.appendChild(accent);

    // Meta details
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    
    const typeLabel = document.createElement('span');
    typeLabel.className = 'card-type';
    const relativeTime = getRelativeTime(item.timestamp);
    
    const timeLabel = document.createElement('span');
    timeLabel.className = 'card-time';
    timeLabel.textContent = relativeTime;

    let contentContainer = document.createElement('div');
    contentContainer.className = 'card-content';

    let actionsContainer = document.createElement('div');
    actionsContainer.className = 'card-actions';

    // Build specialized card layouts based on type
    if (item.type === 'text') {
      typeLabel.innerHTML = `<i class="fa-solid fa-align-left" style="color: ${item.color}"></i> Metin`;
      
      const textPreview = document.createElement('div');
      textPreview.className = 'text-preview';
      textPreview.textContent = item.content;
      contentContainer.appendChild(textPreview);

      // Check if text is long to display "Read more" inline
      const lines = item.content.split('\n').length;
      if (item.content.length > 250 || lines > 5) {
        const readMoreBtn = document.createElement('button');
        readMoreBtn.className = 'btn-readmore';
        readMoreBtn.innerHTML = 'Detayı Gör <i class="fa-solid fa-chevron-down"></i>';
        readMoreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openPreviewModal(item);
        });
        contentContainer.appendChild(readMoreBtn);
      }

      // Action: Copy text
      const copyBtn = document.createElement('button');
      copyBtn.className = 'card-btn card-btn-primary';
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Kopyala';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.content, 'Metin panoya kopyalandı!');
      });
      actionsContainer.appendChild(copyBtn);

    } else if (item.type === 'link') {
      typeLabel.innerHTML = `<i class="fa-solid fa-link" style="color: ${item.color}"></i> Bağlantı`;
      
      const linkBox = document.createElement('div');
      linkBox.className = 'link-content-box';

      // 1. Rich Thumbnail Image (from Open Graph)
      if (item.linkImage) {
        const imgArea = document.createElement('div');
        imgArea.className = 'link-image-area';
        const img = document.createElement('img');
        img.src = item.linkImage;
        img.alt = item.linkTitle || item.title || item.content;
        img.loading = 'lazy';
        img.onerror = () => imgArea.remove(); // Hide if image fails to load
        imgArea.appendChild(img);
        linkBox.appendChild(imgArea);
      }

      // 2. Title (Rich Page Title or Custom Title)
      const title = document.createElement('h4');
      title.className = 'link-title';
      title.textContent = item.linkTitle || item.title || item.content;
      linkBox.appendChild(title);

      // 3. Rich Description (from Open Graph description meta)
      if (item.linkDescription) {
        const desc = document.createElement('p');
        desc.className = 'link-desc';
        desc.textContent = item.linkDescription;
        linkBox.appendChild(desc);
      }

      // 4. URL Host Name
      const urlText = document.createElement('span');
      urlText.className = 'link-url';
      let displayUrl = item.content;
      try {
        const urlObj = new URL(item.content);
        displayUrl = urlObj.hostname;
      } catch(_) {}
      urlText.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> ${displayUrl}`;
      linkBox.appendChild(urlText);
      
      contentContainer.appendChild(linkBox);

      // Action: Launch Link Card Button
      const launchBtn = document.createElement('a');
      launchBtn.href = item.content;
      launchBtn.target = '_blank';
      launchBtn.rel = 'noopener noreferrer';
      launchBtn.className = 'link-launch-card';
      launchBtn.innerHTML = '<span>Bağlantıyı Aç</span> <i class="fa-solid fa-arrow-right"></i>';
      launchBtn.addEventListener('click', (e) => e.stopPropagation());
      contentContainer.appendChild(launchBtn);

      // Action: Copy Link
      const copyBtn = document.createElement('button');
      copyBtn.className = 'card-btn card-btn-primary';
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Bağlantıyı Kopyala';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.content, 'Bağlantı kopyalandı!');
      });
      actionsContainer.appendChild(copyBtn);

    } else if (item.type === 'file') {
      typeLabel.innerHTML = `<i class="fa-solid fa-file" style="color: ${item.color}"></i> Dosya`;
      
      const fileBox = document.createElement('div');
      fileBox.className = 'file-card-box';

      const previewArea = document.createElement('div');
      previewArea.className = 'file-preview-area';

      // Check if image for thumbnail preview
      const isImg = item.fileType && item.fileType.startsWith('image/');
      if (isImg) {
        const img = document.createElement('img');
        img.src = item.content;
        img.alt = item.fileName;
        img.className = 'file-preview-image';
        img.loading = 'lazy'; // Lazy load cards images to save client CPU/network bandwidth
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          openPreviewModal(item);
        });
        previewArea.appendChild(img);
      } else {
        const genericPreview = document.createElement('div');
        genericPreview.className = 'file-preview-generic';
        const iconClass = getFileIcon(item.fileType || '', item.fileName || '');
        
        // Custom background colors for different extensions
        let fileColor = item.color || '#2563eb';
        genericPreview.innerHTML = `<i class="${iconClass}" style="color: ${fileColor}"></i><span>.${item.fileName.split('.').pop()}</span>`;
        previewArea.appendChild(genericPreview);
      }
      fileBox.appendChild(previewArea);

      const metaInfo = document.createElement('div');
      metaInfo.className = 'file-meta-info';

      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = item.fileName;
      name.title = item.fileName;
      metaInfo.appendChild(name);

      const size = document.createElement('div');
      size.className = 'file-size';
      size.textContent = formatBytes(item.fileSize);
      metaInfo.appendChild(size);

      fileBox.appendChild(metaInfo);
      contentContainer.appendChild(fileBox);

      // Action: Download File
      const downloadBtn = document.createElement('a');
      downloadBtn.href = item.content;
      downloadBtn.download = item.fileName;
      downloadBtn.className = 'card-btn card-btn-primary';
      downloadBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i> İndir';
      downloadBtn.addEventListener('click', (e) => e.stopPropagation());
      actionsContainer.appendChild(downloadBtn);
    }

    meta.appendChild(typeLabel);
    meta.appendChild(timeLabel);
    card.appendChild(meta);
    card.appendChild(contentContainer);

    // Action: Edit (only for text and link types)
    if (item.type === 'text' || item.type === 'link') {
      const editBtn = document.createElement('button');
      editBtn.className = 'card-btn';
      editBtn.title = 'Düzenle';
      editBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i>';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (card.classList.contains('editing')) return;
        card.classList.add('editing');
        
        contentContainer.style.display = 'none';
        actionsContainer.style.display = 'none';
        
        const editContainer = document.createElement('div');
        editContainer.className = 'edit-container';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'edit-textarea';
        textarea.value = item.content;
        textarea.addEventListener('click', (ev) => ev.stopPropagation());
        editContainer.appendChild(textarea);
        
        const editActions = document.createElement('div');
        editActions.className = 'edit-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'card-btn';
        cancelBtn.textContent = 'İptal';
        cancelBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          card.classList.remove('editing');
          editContainer.remove();
          contentContainer.style.display = '';
          actionsContainer.style.display = '';
        });
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'card-btn card-btn-primary';
        saveBtn.textContent = 'Kaydet';
        saveBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const newContent = textarea.value.trim();
          if (!newContent) {
            showToast('İçerik boş olamaz!', 'error');
            return;
          }
          
          try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Kaydediliyor...';
            
            const res = await fetch(`/api/items/${item.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: newContent })
            });
            
            if (res.ok) {
              card.classList.remove('editing');
              editContainer.remove();
              contentContainer.style.display = '';
              actionsContainer.style.display = '';
            } else {
              showToast('Güncelleme başarısız!', 'error');
              saveBtn.disabled = false;
              saveBtn.textContent = 'Kaydet';
            }
          } catch (err) {
            showToast('Sunucu hatası!', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Kaydet';
          }
        });
        
        editActions.appendChild(cancelBtn);
        editActions.appendChild(saveBtn);
        editContainer.appendChild(editActions);
        
        card.insertBefore(editContainer, actionsContainer);
        textarea.focus();
      });
      actionsContainer.appendChild(editBtn);
    }

    // Delete Button (Available on all cards)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-btn card-btn-danger';
    deleteBtn.title = 'Sil';
    deleteBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(item.id);
    });
    actionsContainer.appendChild(deleteBtn);
    
    card.appendChild(actionsContainer);

    // Card click opens detail modal (for text viewing or image preview)
    card.addEventListener('click', () => {
      openPreviewModal(item);
    });

    return card;
  }

  // Delete Action
  async function deleteItem(id) {
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        showToast('Öge silinemedi!', 'error');
      }
    } catch (err) {
      showToast('Sunucu bağlantı hatası!', 'error');
    }
  }

  // --- Modal Previews ---
  function openPreviewModal(item) {
    modalTitle.textContent = item.type === 'file' ? 'Dosya Önizleme' : item.type === 'link' ? 'Bağlantı Detayı' : 'Metin Paylaşımı';
    modalBody.innerHTML = '';
    modalFooter.innerHTML = '';

    if (item.type === 'text') {
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.wordBreak = 'break-word';
      pre.style.fontFamily = 'inherit';
      pre.textContent = item.content;
      modalBody.appendChild(pre);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-primary';
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Tümünü Kopyala';
      copyBtn.addEventListener('click', () => {
        copyToClipboard(item.content, 'Metin panoya kopyalandı!');
      });
      modalFooter.appendChild(copyBtn);

    } else if (item.type === 'link') {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '14px';

      const h3 = document.createElement('h3');
      h3.textContent = item.title || item.content;
      container.appendChild(h3);

      const code = document.createElement('code');
      code.style.display = 'block';
      code.style.padding = '10px';
      code.style.backgroundColor = 'var(--bg-tertiary)';
      code.style.border = '1px solid var(--border-color)';
      code.style.borderRadius = '6px';
      code.style.wordBreak = 'break-all';
      code.textContent = item.content;
      container.appendChild(code);

      modalBody.appendChild(container);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-icon';
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
      copyBtn.title = 'Kopyala';
      copyBtn.style.borderRadius = '8px';
      copyBtn.addEventListener('click', () => {
        copyToClipboard(item.content, 'Bağlantı kopyalandı!');
      });
      modalFooter.appendChild(copyBtn);

      const openBtn = document.createElement('a');
      openBtn.href = item.content;
      openBtn.target = '_blank';
      openBtn.className = 'btn btn-primary';
      openBtn.innerHTML = 'Bağlantıyı Yeni Sekmede Aç <i class="fa-solid fa-arrow-up-right-from-square"></i>';
      modalFooter.appendChild(openBtn);

    } else if (item.type === 'file') {
      const isImg = item.fileType && item.fileType.startsWith('image/');
      const isVideo = item.fileType && item.fileType.startsWith('video/');
      const isAudio = item.fileType && item.fileType.startsWith('audio/');

      if (isImg) {
        const img = document.createElement('img');
        img.src = item.content;
        img.alt = item.fileName;
        img.addEventListener('click', (e) => {
          if (img.classList.contains('zoomed')) {
            img.classList.remove('zoomed');
            img.style.transform = 'none';
          } else {
            const rect = img.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xPercent = (x / rect.width) * 100;
            const yPercent = (y / rect.height) * 100;
            
            img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
            img.style.transform = 'scale(2.5)';
            img.classList.add('zoomed');
          }
        });
        modalBody.appendChild(img);
      } else if (isVideo) {
        const video = document.createElement('video');
        video.src = item.content;
        video.controls = true;
        video.autoplay = true;
        video.style.width = '100%';
        video.style.borderRadius = '8px';
        modalBody.appendChild(video);
      } else if (isAudio) {
        const audio = document.createElement('audio');
        audio.src = item.content;
        audio.controls = true;
        audio.autoplay = true;
        audio.style.width = '100%';
        modalBody.appendChild(audio);
      } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'file-preview-generic';
        wrapper.style.padding = '40px 0';
        const iconClass = getFileIcon(item.fileType || '', item.fileName || '');
        wrapper.innerHTML = `<i class="${iconClass}" style="font-size: 4.5rem; color: ${item.color || '#2563eb'}; margin-bottom: 16px;"></i><h3 style="word-break: break-all;">${item.fileName}</h3><p style="color: var(--text-muted); margin-top: 8px;">${formatBytes(item.fileSize)} - ${item.fileType || 'Bilinmeyen Dosya Türü'}</p>`;
        modalBody.appendChild(wrapper);
      }

      const downloadBtn = document.createElement('a');
      downloadBtn.href = item.content;
      downloadBtn.download = item.fileName;
      downloadBtn.className = 'btn btn-primary';
      downloadBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Dosyayı İndir';
      modalFooter.appendChild(downloadBtn);
    }

    previewModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
  }

  function closeModal() {
    // Stop playing audio/video when closing modal
    const video = modalBody.querySelector('video');
    const audio = modalBody.querySelector('audio');
    if (video) video.pause();
    if (audio) audio.pause();

    previewModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  modalCloseBtn.addEventListener('click', closeModal);
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closeModal();
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // --- Helper Functions ---
  
  // Custom Toast Notifier
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    
    toast.innerHTML = `<i class="fa-solid ${icon} toast-icon"></i><span class="toast-message">${message}</span>`;
    toastContainer.appendChild(toast);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 3000);
  }

  // Format File Size
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Get extension-based FontAwesome icon
  function getFileIcon(type, filename) {
    if (type.startsWith('image/')) return 'fa-regular fa-image';
    if (type.startsWith('video/')) return 'fa-regular fa-file-video';
    if (type.startsWith('audio/')) return 'fa-regular fa-file-audio';
    if (type.includes('pdf')) return 'fa-regular fa-file-pdf';
    if (type.includes('word') || type.includes('officedocument.wordprocessingml')) return 'fa-regular fa-file-word';
    if (type.includes('excel') || type.includes('officedocument.spreadsheetml')) return 'fa-regular fa-file-excel';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('7z') || type.includes('compressed')) return 'fa-regular fa-file-zipper';
    
    const ext = filename.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'fa-regular fa-image';
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return 'fa-regular fa-file-video';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'fa-regular fa-file-audio';
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return 'fa-regular fa-file-zipper';
    if (['txt', 'md', 'json', 'js', 'html', 'css', 'py', 'c', 'cpp'].includes(ext)) return 'fa-regular fa-file-code';
    if (['pdf'].includes(ext)) return 'fa-regular fa-file-pdf';
    
    return 'fa-regular fa-file';
  }

  // Relative Time formatter
  function getRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    
    if (diffSec < 10) return 'Şimdi';
    if (diffSec < 60) return `${diffSec} saniye önce`;
    if (diffMin < 60) return `${diffMin} dakika önce`;
    if (diffHr < 24) return `${diffHr} saat önce`;
    
    // Fallback to local locale date string
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // Clipboard Copier with secure fail-safe fallback
  function copyToClipboard(text, successMsg = 'Kopyalandı!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast(successMsg, 'success'))
        .catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast(successMsg, 'success');
      } else {
        showToast('Kopyalama başarısız!', 'error');
      }
    } catch (err) {
      showToast('Kopyalama desteklenmiyor!', 'error');
    }
    document.body.removeChild(textArea);
  }

  // --- Boot App ---
  fetchServerInfo();
  fetchItems();
  setupSSE();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    });
  }
});
