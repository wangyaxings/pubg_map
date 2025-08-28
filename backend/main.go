package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

// Hexagram represents a hexagram with its data
type Hexagram struct {
	Number              int     `json:"number"`
	Name                string  `json:"name"`
	Symbol              string  `json:"symbol"`
	GuaCi               string  `json:"gua_ci"`
	GuaCiTranslation    string  `json:"gua_ci_translation"`
	GuaCiCommentary     string  `json:"gua_ci_commentary"`
	TuanCi              string  `json:"tuan_ci"`
	TuanCiTranslation   string  `json:"tuan_ci_translation"`
	TuanCiCommentary    string  `json:"tuan_ci_commentary"`
	DaXiangCi           string  `json:"da_xiang_ci"`
	DaXiangTranslation  string  `json:"da_xiang_translation"`
	DaXiangCommentary   string  `json:"da_xiang_commentary"`
	InnerTrigram        string  `json:"inner_trigram"`
	OuterTrigram        string  `json:"outer_trigram"`
	X                   float64 `json:"x"`
	Y                   float64 `json:"y"`
	Image               *string `json:"image,omitempty"`
}

// Line represents a line (yao) of a hexagram
type Line struct {
	ID                    int    `json:"id"`
	HexNum                int    `json:"hex_num"`
	Position              string `json:"position"`
	YaoCi                 string `json:"yao_ci"`
	YaoTranslation        string `json:"yao_translation"`
	YaoCommentary         string `json:"yao_commentary"`
	SmallXiangCi          string `json:"small_xiang_ci"`
	SmallXiangTranslation string `json:"small_xiang_translation"`
	SmallXiangCommentary  string `json:"small_xiang_commentary"`
}

// HexagramWithLines represents a hexagram with all its lines
type HexagramWithLines struct {
	Hexagram Hexagram `json:"hexagram"`
	Lines    []Line   `json:"lines"`
}

// MapMarker represents a marker on the map
type MapMarker struct {
	ID        int     `json:"id"`
	Number    int     `json:"number"`
	Name      string  `json:"name"`
	Symbol    string  `json:"symbol"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Image     *string `json:"image,omitempty"`
	Hexagram  Hexagram `json:"hexagram"`
}

// AddMarkerRequest represents the request to add a new marker
type AddMarkerRequest struct {
	HexagramNumber int     `json:"hexagram_number"`
	X              float64 `json:"x"`
	Y              float64 `json:"y"`
}

var db *sql.DB

func main() {
	// Initialize database
	var err error
	dbPath := "../../zhouyi.db"

	// Check if database file exists
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		log.Printf("Database file not found at: %s", dbPath)
		log.Fatal("Database file not found. Please run zhouyi.py first to generate the database.")
	}

	log.Printf("Found database at: %s", dbPath)

	db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	// Test database connection
	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	log.Println("Database connection successful")

	// Create user_markers table if it doesn't exist
	createUserMarkersTable()

	// Initialize Gin router
	r := gin.Default()

	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(config))

	// Serve static files
	r.Static("/static", "./static")
	r.StaticFile("/", "./static/index.html")

	// API routes
	api := r.Group("/api")
	{
		api.GET("/hexagrams", getHexagrams)
		api.GET("/hexagrams/search", searchHexagrams)
		api.GET("/hexagrams/:id", getHexagram)
		api.GET("/markers", getMarkers)
		api.POST("/markers", addMarker)
		api.PUT("/markers/:id", updateMarker)
		api.DELETE("/markers/:id", deleteMarker)
		api.POST("/upload-image", uploadImage)
	}

	// Create static directory if it doesn't exist
	if err := os.MkdirAll("./static", 0755); err != nil {
		log.Fatal(err)
	}

	log.Println("Server starting on :8080")
	r.Run(":8080")
}

// createUserMarkersTable creates the user_markers table if it doesn't exist
func createUserMarkersTable() {
	query := `
	CREATE TABLE IF NOT EXISTS user_markers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hexagram_number INTEGER NOT NULL,
		x REAL NOT NULL,
		y REAL NOT NULL,
		image TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (hexagram_number) REFERENCES Hexagrams(number)
	)
	`

	_, err := db.Exec(query)
	if err != nil {
		log.Fatal("Failed to create user_markers table:", err)
	}

	log.Println("User markers table created/verified successfully")
}

func getHexagrams(c *gin.Context) {
	rows, err := db.Query(`
		SELECT number, name, symbol, gua_ci, gua_ci_translation, gua_ci_commentary,
		       tuan_ci, tuan_ci_translation, tuan_ci_commentary,
		       da_xiang_ci, da_xiang_translation, da_xiang_commentary,
		       inner_trigram, outer_trigram
		FROM Hexagrams
		ORDER BY number
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var hexagrams []Hexagram
	for rows.Next() {
		var h Hexagram
		err := rows.Scan(
			&h.Number, &h.Name, &h.Symbol, &h.GuaCi, &h.GuaCiTranslation, &h.GuaCiCommentary,
			&h.TuanCi, &h.TuanCiTranslation, &h.TuanCiCommentary,
			&h.DaXiangCi, &h.DaXiangTranslation, &h.DaXiangCommentary,
			&h.InnerTrigram, &h.OuterTrigram,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		hexagrams = append(hexagrams, h)
	}

	c.JSON(http.StatusOK, hexagrams)
}

func searchHexagrams(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	// Search by name, symbol, or number
	searchQuery := `
		SELECT number, name, symbol, gua_ci, gua_ci_translation, gua_ci_commentary,
		       tuan_ci, tuan_ci_translation, tuan_ci_commentary,
		       da_xiang_ci, da_xiang_translation, da_xiang_commentary,
		       inner_trigram, outer_trigram
		FROM Hexagrams
		WHERE name LIKE ? OR symbol LIKE ? OR CAST(number AS TEXT) LIKE ?
		ORDER BY number
		LIMIT 20
	`

	searchTerm := "%" + query + "%"
	rows, err := db.Query(searchQuery, searchTerm, searchTerm, searchTerm)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var hexagrams []Hexagram
	for rows.Next() {
		var h Hexagram
		err := rows.Scan(
			&h.Number, &h.Name, &h.Symbol, &h.GuaCi, &h.GuaCiTranslation, &h.GuaCiCommentary,
			&h.TuanCi, &h.TuanCiTranslation, &h.TuanCiCommentary,
			&h.DaXiangCi, &h.DaXiangTranslation, &h.DaXiangCommentary,
			&h.InnerTrigram, &h.OuterTrigram,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		hexagrams = append(hexagrams, h)
	}

	c.JSON(http.StatusOK, hexagrams)
}

func getHexagram(c *gin.Context) {
	id := c.Param("id")

	// Get hexagram
	var h Hexagram
	err := db.QueryRow(`
		SELECT number, name, symbol, gua_ci, gua_ci_translation, gua_ci_commentary,
		       tuan_ci, tuan_ci_translation, tuan_ci_commentary,
		       da_xiang_ci, da_xiang_translation, da_xiang_commentary,
		       inner_trigram, outer_trigram
		FROM Hexagrams
		WHERE number = ?
	`, id).Scan(
		&h.Number, &h.Name, &h.Symbol, &h.GuaCi, &h.GuaCiTranslation, &h.GuaCiCommentary,
		&h.TuanCi, &h.TuanCiTranslation, &h.TuanCiCommentary,
		&h.DaXiangCi, &h.DaXiangTranslation, &h.DaXiangCommentary,
		&h.InnerTrigram, &h.OuterTrigram,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hexagram not found"})
		return
	}

	// Get lines
	rows, err := db.Query(`
		SELECT id, hex_num, position, yao_ci, yao_translation, yao_commentary,
		       small_xiang_ci, small_xiang_translation, small_xiang_commentary
		FROM Lines
		WHERE hex_num = ?
		ORDER BY position
	`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var lines []Line
	for rows.Next() {
		var l Line
		err := rows.Scan(
			&l.ID, &l.HexNum, &l.Position, &l.YaoCi, &l.YaoTranslation, &l.YaoCommentary,
			&l.SmallXiangCi, &l.SmallXiangTranslation, &l.SmallXiangCommentary,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		lines = append(lines, l)
	}

	result := HexagramWithLines{
		Hexagram: h,
		Lines:    lines,
	}

	c.JSON(http.StatusOK, result)
}

func getMarkers(c *gin.Context) {
	// Get user-added markers from database
	rows, err := db.Query(`
		SELECT um.id, um.hexagram_number, um.x, um.y, um.image,
		       h.name, h.symbol, h.gua_ci, h.gua_ci_translation, h.gua_ci_commentary,
		       h.tuan_ci, h.tuan_ci_translation, h.tuan_ci_commentary,
		       h.da_xiang_ci, h.da_xiang_translation, h.da_xiang_commentary,
		       h.inner_trigram, h.outer_trigram
		FROM user_markers um
		JOIN Hexagrams h ON um.hexagram_number = h.number
		ORDER BY um.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var markers []MapMarker
	for rows.Next() {
		var marker MapMarker
		var h Hexagram
		var nullImage sql.NullString
		err := rows.Scan(
			&marker.ID, &marker.Number, &marker.X, &marker.Y, &nullImage,
			&h.Name, &h.Symbol, &h.GuaCi, &h.GuaCiTranslation, &h.GuaCiCommentary,
			&h.TuanCi, &h.TuanCiTranslation, &h.TuanCiCommentary,
			&h.DaXiangCi, &h.DaXiangTranslation, &h.DaXiangCommentary,
			&h.InnerTrigram, &h.OuterTrigram,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Handle nullable image field
		if nullImage.Valid {
			marker.Image = &nullImage.String
		} else {
			marker.Image = nil
		}

		marker.Name = h.Name
		marker.Symbol = h.Symbol
		marker.Hexagram = h
		marker.Hexagram.Number = marker.Number
		marker.Hexagram.X = marker.X
		marker.Hexagram.Y = marker.Y
		marker.Hexagram.Image = marker.Image

		markers = append(markers, marker)
	}

	c.JSON(http.StatusOK, markers)
}

func addMarker(c *gin.Context) {
	var req AddMarkerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate hexagram exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM Hexagrams WHERE number = ?)", req.HexagramNumber).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hexagram not found"})
		return
	}

	// Insert new marker
	result, err := db.Exec(`
		INSERT INTO user_markers (hexagram_number, x, y)
		VALUES (?, ?, ?)
	`, req.HexagramNumber, req.X, req.Y)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get the created marker
	var marker MapMarker
	var h Hexagram
	var nullImage sql.NullString
	err = db.QueryRow(`
		SELECT um.id, um.hexagram_number, um.x, um.y, um.image,
		       h.name, h.symbol, h.gua_ci, h.gua_ci_translation, h.gua_ci_commentary,
		       h.tuan_ci, h.tuan_ci_translation, h.tuan_ci_commentary,
		       h.da_xiang_ci, h.da_xiang_translation, h.da_xiang_commentary,
		       h.inner_trigram, h.outer_trigram
		FROM user_markers um
		JOIN Hexagrams h ON um.hexagram_number = h.number
		WHERE um.id = ?
	`, id).Scan(
		&marker.ID, &marker.Number, &marker.X, &marker.Y, &nullImage,
		&h.Name, &h.Symbol, &h.GuaCi, &h.GuaCiTranslation, &h.GuaCiCommentary,
		&h.TuanCi, &h.TuanCiTranslation, &h.TuanCiCommentary,
		&h.DaXiangCi, &h.DaXiangTranslation, &h.DaXiangCommentary,
		&h.InnerTrigram, &h.OuterTrigram,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Handle nullable image field
	if nullImage.Valid {
		marker.Image = &nullImage.String
	} else {
		marker.Image = nil
	}

	marker.Name = h.Name
	marker.Symbol = h.Symbol
	marker.Hexagram = h
	marker.Hexagram.Number = marker.Number
	marker.Hexagram.X = marker.X
	marker.Hexagram.Y = marker.Y
	marker.Hexagram.Image = marker.Image

	c.JSON(http.StatusCreated, marker)
}

func updateMarker(c *gin.Context) {
	id := c.Param("id")
	var marker MapMarker
	if err := c.ShouldBindJSON(&marker); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update marker coordinates
	_, err := db.Exec(`
		UPDATE user_markers
		SET x = ?, y = ?, image = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, marker.X, marker.Y, marker.Image, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Marker updated successfully"})
}

func deleteMarker(c *gin.Context) {
	id := c.Param("id")

	// Delete marker
	result, err := db.Exec("DELETE FROM user_markers WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Marker not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Marker deleted successfully"})
}

func uploadImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No image file provided"})
		return
	}

	// Create uploads directory if it doesn't exist
	uploadDir := "./static/uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Save file
	filename := filepath.Join(uploadDir, file.Filename)
	if err := c.SaveUploadedFile(file, filename); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Image uploaded successfully",
		"url":     "/static/uploads/" + file.Filename,
	})
}
