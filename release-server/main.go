package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type UpdateInfo struct {
	Version  string `json:"version"`
	Notes    string `json:"notes,omitempty"`
	Date     string `json:"date"`
	Platform string `json:"platform"`
	Arch     string `json:"arch"`
	URL      string `json:"url"`
	Sig      string `json:"sig"`
	Sig2     string `json:"sig2,omitempty"`
}

type UpdateResponse struct {
	// Tauri v1 format
	URL      string `json:"url,omitempty"`
	Version  string `json:"version,omitempty"`
	Notes    string `json:"notes,omitempty"`
	Date     string `json:"date,omitempty"`
	Sig      string `json:"sig,omitempty"`

	// Tauri v2 format
	Manifest *UpdateManifest `json:"manifest,omitempty"`
}

type UpdateManifest struct {
	Version  string            `json:"version"`
	Notes    string            `json:"notes,omitempty"`
	Date     string            `json:"date,omitempty"`
	Platforms map[string]*PlatformInfo `json:"platforms"`
}

type PlatformInfo struct {
	Signature string `json:"signature"`
	URL       string `json:"url"`
}

var (
	releaseDir   string
	currentVersion string
	publicKey    string
)

func init() {
	releaseDir = os.Getenv("RELEASE_DIR")
	if releaseDir == "" {
		releaseDir = "./releases"
	}

	currentVersion = os.Getenv("CURRENT_VERSION")
	if currentVersion == "" {
		currentVersion = "1.0.0"
	}

	publicKey = os.Getenv("UPDATE_PUBLIC_KEY")
	if publicKey == "" {
		publicKey = "dW50cnVzdGVkIGZvciBkZXZlbG9wbWVudCwgbm90IHByb2R1Y3Rpb24="
	}

	// Create release directory if not exists
	os.MkdirAll(releaseDir, 0755)
}

func main() {
	http.HandleFunc("/", handleRoot)
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/update/", handleUpdate)
	http.HandleFunc("/releases/", handleReleases)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Release server starting on port %s", port)
	log.Printf("Release directory: %s", releaseDir)
	log.Printf("Current version: %s", currentVersion)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"service": "TermVault Update Server",
		"version": "1.0.0",
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
	})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	// Parse path: /update/{target}/{arch}/{current_version}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/update/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	target := parts[0] // windows, linux, macos
	arch := parts[1]   // x86_64, aarch64
	currentVersion := parts[2]

	log.Printf("Update check: target=%s arch=%s current=%s", target, arch, currentVersion)

	// Check if update is available
	latestVersion := getLatestVersion(target, arch)
	if latestVersion == "" || latestVersion == currentVersion {
		http.Error(w, "No update available", http.StatusNoContent)
		return
	}

	// Get release info
	releaseInfo := getReleaseInfo(target, arch, latestVersion)
	if releaseInfo == nil {
		http.Error(w, "Release not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(releaseInfo)
}

func handleReleases(w http.ResponseWriter, r *http.Request) {
	// Serve release files
	filePath := filepath.Join(releaseDir, filepath.Base(r.URL.Path))
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	http.ServeFile(w, r, filePath)
}

func getLatestVersion(target, arch string) string {
	// In production, this would check a database or file system
	// For now, return the current version if a release exists
	pattern := filepath.Join(releaseDir, fmt.Sprintf("*%s*%s*", target, arch))
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		return ""
	}
	return currentVersion
}

func getReleaseInfo(target, arch, version string) *UpdateResponse {
	// Find the release file
	suffix := getSuffix(target)
	pattern := filepath.Join(releaseDir, fmt.Sprintf("*%s*%s*%s*", target, arch, version))
	matches, _ := filepath.Glob(pattern)

	if len(matches) == 0 {
		return nil
	}

	releaseFile := matches[0]
	sigFile := releaseFile + ".sig"

	// Read signature
	sig := ""
	if sigBytes, err := os.ReadFile(sigFile); err == nil {
		sig = string(sigBytes)
	}

	// Build download URL
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "https://releases.termvault.app"
	}

	fileName := filepath.Base(releaseFile)
	downloadURL := fmt.Sprintf("%s/releases/%s", baseURL, fileName)

	return &UpdateResponse{
		URL:     downloadURL,
		Version: version,
		Notes:   "Bug fixes and improvements",
		Date:    time.Now().UTC().Format(time.RFC3339),
		Sig:     sig,
	}
}

func getSuffix(target string) string {
	switch target {
	case "windows":
		return ".msi"
	case "macos":
		return ".dmg"
	case "linux":
		return ".deb"
	default:
		return ""
	}
}

// Helper to read file content
func readFile(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	content, err := io.ReadAll(f)
	if err != nil {
		return ""
	}
	return string(content)
}
