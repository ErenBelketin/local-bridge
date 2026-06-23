package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"io/fs"
	"log"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

//go:embed public
var embeddedPublic embed.FS

type Item struct {
	ID               string `json:"id"`
	Type             string `json:"type"`
	Title            string `json:"title"`
	Content          string `json:"content"`
	Color            string `json:"color"`
	Timestamp        string `json:"timestamp"`
	FileName         string `json:"fileName,omitempty"`
	FileSize         int64  `json:"fileSize,omitempty"`
	FileType         string `json:"fileType,omitempty"`
	LinkTitle        string `json:"linkTitle,omitempty"`
	LinkDescription  string `json:"linkDescription,omitempty"`
	LinkImage        string `json:"linkImage,omitempty"`
	UpdatedTimestamp string `json:"updatedTimestamp,omitempty"`
}

type LinkMetadata struct {
	Title       string
	Description string
	Image       string
}

const port = 3000

var (
	baseDir     string
	dbFile      string
	uploadsDir  string
	dbMutex     sync.Mutex
	clients     = make(map[chan string]bool)
	clientMutex sync.Mutex
)

func init() {
	// Seed random number generator
	rand.Seed(time.Now().UnixNano())

	// Get base directory of the executable
	exePath, err := os.Executable()
	if err != nil {
		baseDir = "."
	} else {
		baseDir = filepath.Dir(exePath)
	}

	dbFile = filepath.Join(baseDir, "db.json")
	uploadsDir = filepath.Join(baseDir, "uploads")
}

func main() {
	// Initialize directories and database file
	if err := initStorage(); err != nil {
		log.Fatalf("Storage initialization failed: %v", err)
	}

	mux := http.NewServeMux()

	// API Endpoints
	mux.HandleFunc("/api/info", infoHandler)
	mux.HandleFunc("/api/events", eventsHandler)
	mux.HandleFunc("/api/items", itemsHandler)
	mux.HandleFunc("/api/items/", itemsHandler)
	mux.HandleFunc("/api/upload", uploadHandler)

	// File downloads static route
	mux.Handle("/files/", http.StripPrefix("/files/", http.FileServer(http.Dir(uploadsDir))))

	// SPA / Public site static route
	publicFS := getPublicFileSystem()
	mux.Handle("/", http.FileServer(publicFS))

	// Get local IPs for terminal message
	ips := getLocalIPs()

	fmt.Println("==================================================")
	fmt.Println("🚀 LOCAL-BRIDGE SERVER STARTED SUCCESSFULLY (GO)!")
	fmt.Printf("💻 Local Access: http://localhost:%d\n", port)
	fmt.Println("📱 Scan QR code on local devices to connect:")
	for _, ip := range ips {
		fmt.Printf("   👉 http://%s:%d\n", ip, port)
	}
	fmt.Println("==================================================")

	// Start server with CORS middleware
	log.Fatal(http.ListenAndServe(fmt.Sprintf("0.0.0.0:%d", port), corsMiddleware(mux)))
}

// Initialize directory and database file
func initStorage() error {
	if _, err := os.Stat(uploadsDir); os.IsNotExist(err) {
		if err := os.MkdirAll(uploadsDir, 0755); err != nil {
			return err
		}
	}

	if _, err := os.Stat(dbFile); os.IsNotExist(err) {
		if err := os.WriteFile(dbFile, []byte("[]"), 0644); err != nil {
			return err
		}
	}
	return nil
}

// Get public directory file system (falls back to embedded)
func getPublicFileSystem() http.FileSystem {
	localPublicPath := filepath.Join(baseDir, "public")
	if _, err := os.Stat(localPublicPath); err == nil {
		log.Println("[Local-Bridge] Serving public files from local directory:", localPublicPath)
		return http.Dir(localPublicPath)
	}

	log.Println("[Local-Bridge] Serving public files from embedded assets")
	subFS, err := fs.Sub(embeddedPublic, "public")
	if err != nil {
		log.Fatalf("Failed to resolve embedded public sub-filesystem: %v", err)
	}
	return http.FS(subFS)
}

// CORS Middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Get local IPv4 addresses (non-loopback)
func getLocalIPs() []string {
	var ips []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return ips
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			ip = ip.To4()
			if ip == nil {
				continue
			}
			ips = append(ips, ip.String())
		}
	}
	return ips
}

// Read database file
func readDB() ([]Item, error) {
	dbMutex.Lock()
	defer dbMutex.Unlock()

	data, err := os.ReadFile(dbFile)
	if err != nil {
		return nil, err
	}

	var items []Item
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

// Write database file
func writeDB(items []Item) error {
	dbMutex.Lock()
	defer dbMutex.Unlock()

	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(dbFile, data, 0644)
}

// Helper to generate a random alphanumeric string
func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

// SSE Connection Endpoint
func eventsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	fmt.Fprintf(w, ": keep-alive\n\n")
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	clientChan := make(chan string, 10)
	clientMutex.Lock()
	clients[clientChan] = true
	clientMutex.Unlock()

	defer func() {
		clientMutex.Lock()
		delete(clients, clientChan)
		clientMutex.Unlock()
		close(clientChan)
	}()

	notify := r.Context().Done()
	for {
		select {
		case <-notify:
			return
		case msg := <-clientChan:
			fmt.Fprint(w, msg)
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}
		}
	}
}

// Broadcast to SSE clients
func broadcast(action string, data interface{}) {
	payload := map[string]interface{}{
		"action": action,
	}
	if action == "add" || action == "update" {
		payload["item"] = data
	} else if action == "delete" {
		payload["id"] = data
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return
	}

	sseMessage := fmt.Sprintf("data: %s\n\n", string(jsonBytes))

	clientMutex.Lock()
	defer clientMutex.Unlock()
	for ch := range clients {
		select {
		case ch <- sseMessage:
		default:
			// Non-blocking write: skip slow/dead clients
		}
	}
}

// Info API Endpoint
func infoHandler(w http.ResponseWriter, r *http.Request) {
	ips := getLocalIPs()

	clientMutex.Lock()
	activeConn := len(clients)
	clientMutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"port":              port,
		"ips":               ips,
		"activeConnections": activeConn,
	})
}

// Items API Router (/api/items and /api/items/{id})
func itemsHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/api/items" || r.URL.Path == "/api/items/" {
		if r.Method == http.MethodGet {
			getItemsHandler(w, r)
		} else if r.Method == http.MethodPost {
			addTextOrLinkHandler(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	id := parts[3]

	if r.Method == http.MethodPut {
		updateItemHandler(w, r, id)
	} else if r.Method == http.MethodDelete {
		deleteItemHandler(w, r, id)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// Get Items Handler
func getItemsHandler(w http.ResponseWriter, r *http.Request) {
	items, err := readDB()
	if err != nil {
		items = []Item{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// Add Text/Link Item Handler
func addTextOrLinkHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Type    string `json:"type"`
		Content string `json:"content"`
		Color   string `json:"color"`
		Title   string `json:"title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	// Detect if it is a link
	isLink := req.Type == "link"
	if !isLink {
		urlRegex := regexp.MustCompile(`(?i)^(https?://)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$`)
		isLink = urlRegex.MatchString(content)
	}

	itemType := "text"
	if isLink {
		itemType = "link"
	}

	color := req.Color
	if color == "" {
		color = "#2563eb"
	}

	itemID := fmt.Sprintf("item-%d-%s", time.Now().UnixNano()/int64(time.Millisecond), randomString(9))
	newItem := Item{
		ID:        itemID,
		Type:      itemType,
		Title:     req.Title,
		Content:   content,
		Color:     color,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	if isLink {
		metadata := scrapeLinkMetadata(content)
		if metadata != nil {
			newItem.LinkTitle = metadata.Title
			newItem.LinkDescription = metadata.Description
			newItem.LinkImage = metadata.Image
		}
	}

	items, err := readDB()
	if err != nil {
		items = []Item{}
	}

	items = append([]Item{newItem}, items...)

	if err := writeDB(items); err != nil {
		http.Error(w, "Failed to update storage", http.StatusInternalServerError)
		return
	}

	broadcast("add", newItem)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newItem)
}

// Update Item Handler
func updateItemHandler(w http.ResponseWriter, r *http.Request, id string) {
	var req struct {
		Content *string `json:"content"`
		Title   *string `json:"title"`
		Color   *string `json:"color"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	items, err := readDB()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	index := -1
	for i, item := range items {
		if item.ID == id {
			index = i
			break
		}
	}

	if index == -1 {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	item := &items[index]

	if req.Content != nil {
		item.Content = strings.TrimSpace(*req.Content)
	}
	if req.Color != nil {
		item.Color = *req.Color
	}

	if item.Type == "link" {
		if req.Title != nil {
			item.Title = *req.Title
		} else if req.Content != nil {
			item.Title = item.Content
		}

		metadata := scrapeLinkMetadata(item.Content)
		if metadata != nil {
			item.LinkTitle = metadata.Title
			item.LinkDescription = metadata.Description
			item.LinkImage = metadata.Image
		}
	}

	item.UpdatedTimestamp = time.Now().UTC().Format(time.RFC3339)

	if err := writeDB(items); err != nil {
		http.Error(w, "Failed to update storage", http.StatusInternalServerError)
		return
	}

	broadcast("update", *item)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

// Delete Item Handler
func deleteItemHandler(w http.ResponseWriter, r *http.Request, id string) {
	items, err := readDB()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	index := -1
	var itemToDelete Item
	for i, item := range items {
		if item.ID == id {
			index = i
			itemToDelete = item
			break
		}
	}

	if index == -1 {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	// Delete from uploads if type is file
	if itemToDelete.Type == "file" {
		fileName := filepath.Base(itemToDelete.Content)
		filePath := filepath.Join(uploadsDir, fileName)
		_ = os.Remove(filePath) // Remove file, ignore errors if it doesn't exist
	}

	// Remove item from database list
	items = append(items[:index], items[index+1:]...)

	if err := writeDB(items); err != nil {
		http.Error(w, "Failed to update storage", http.StatusInternalServerError)
		return
	}

	broadcast("delete", id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"deletedId": id,
	})
}

// Upload File Handler
func uploadHandler(w http.ResponseWriter, r *http.Request) {
	// Limit max multipart memory size (500MB)
	r.Body = http.MaxBytesReader(w, r.Body, 500*1024*1024)
	if err := r.ParseMultipartForm(500 * 1024 * 1024); err != nil {
		http.Error(w, "File size limit exceeded or bad request", http.StatusBadRequest)
		return
	}

	form := r.MultipartForm
	files := form.File["files"]
	if len(files) == 0 {
		http.Error(w, "No files uploaded", http.StatusBadRequest)
		return
	}

	colors := form.Value["colors"]
	colorDefault := r.FormValue("color")
	if colorDefault == "" {
		colorDefault = "#2563eb"
	}

	items, err := readDB()
	if err != nil {
		items = []Item{}
	}

	var addedItems []Item

	for i, fileHeader := range files {
		fileColor := colorDefault
		if i < len(colors) && colors[i] != "" {
			fileColor = colors[i]
		}

		file, err := fileHeader.Open()
		if err != nil {
			continue
		}
		defer file.Close()

		// Generate unique name
		originalName := fileHeader.Filename
		ext := filepath.Ext(originalName)
		nameWithoutExt := strings.TrimSuffix(originalName, ext)
		uniqueSuffix := fmt.Sprintf("%d-%d", time.Now().UnixNano()/int64(time.Millisecond), rand.Intn(1e9))
		safeName := fmt.Sprintf("%s-%s%s", nameWithoutExt, uniqueSuffix, ext)

		// Save to uploads folder
		outPath := filepath.Join(uploadsDir, safeName)
		outFile, err := os.Create(outPath)
		if err != nil {
			continue
		}
		defer outFile.Close()

		if _, err = io.Copy(outFile, file); err != nil {
			continue
		}

		timestamp := time.Now().UTC().Format(time.RFC3339)
		itemID := fmt.Sprintf("file-%d-%s", time.Now().UnixNano()/int64(time.Millisecond), randomString(9))
		newItem := Item{
			ID:        itemID,
			Type:      "file",
			Title:     originalName,
			Content:   fmt.Sprintf("/files/%s", safeName),
			FileName:  originalName,
			FileSize:  fileHeader.Size,
			FileType:  fileHeader.Header.Get("Content-Type"),
			Color:     fileColor,
			Timestamp: timestamp,
		}

		items = append([]Item{newItem}, items...)
		addedItems = append(addedItems, newItem)
	}

	if err := writeDB(items); err != nil {
		http.Error(w, "Failed to update storage", http.StatusInternalServerError)
		return
	}

	for _, item := range addedItems {
		broadcast("add", item)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(addedItems)
}

// Meta tags HTML parser helpers
func extractTitleTag(htmlContent string) string {
	re := regexp.MustCompile(`(?i)<title[^>]*>(.*?)</title>`)
	match := re.FindStringSubmatch(htmlContent)
	if len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}

func extractMetaTag(htmlContent string, name string) string {
	metaRegex := regexp.MustCompile(`(?i)<meta\s+[^>]*>`)
	tags := metaRegex.FindAllString(htmlContent, -1)

	nameRegex := regexp.MustCompile(fmt.Sprintf(`(?i)(property|name)=["']%s["']`, regexp.QuoteMeta(name)))
	contentRegex := regexp.MustCompile(`(?i)content=["'](.*?)["']`)

	for _, tag := range tags {
		if nameRegex.MatchString(tag) {
			match := contentRegex.FindStringSubmatch(tag)
			if len(match) > 1 {
				return match[1]
			}
		}
	}
	return ""
}

// Scrape link metadata
func scrapeLinkMetadata(targetURL string) *LinkMetadata {
	targetURL = strings.TrimSpace(targetURL)
	if !regexp.MustCompile(`(?i)^https?://`).MatchString(targetURL) {
		targetURL = "http://" + targetURL
	}

	client := &http.Client{
		Timeout: 3 * time.Second,
	}

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	// Limit reader to 1MB to protect memory
	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return nil
	}

	htmlContent := string(bodyBytes)

	title := extractMetaTag(htmlContent, "og:title")
	if title == "" {
		title = extractMetaTag(htmlContent, "title")
	}
	if title == "" {
		title = extractTitleTag(htmlContent)
	}
	if title == "" {
		title = targetURL
	}

	description := extractMetaTag(htmlContent, "og:description")
	if description == "" {
		description = extractMetaTag(htmlContent, "description")
	}

	image := extractMetaTag(htmlContent, "og:image")
	if image == "" {
		image = extractMetaTag(htmlContent, "twitter:image")
	}

	if image != "" && !regexp.MustCompile(`(?i)^https?://`).MatchString(image) {
		base, err := url.Parse(targetURL)
		if err == nil {
			ref, err := url.Parse(image)
			if err == nil {
				image = base.ResolveReference(ref).String()
			}
		}
	}

	return &LinkMetadata{
		Title:       html.UnescapeString(title),
		Description: html.UnescapeString(description),
		Image:       image,
	}
}
