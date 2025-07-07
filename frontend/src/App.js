import React, { useState } from 'react';
import './App.css'; 

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState(null);
  // MODIFIED: State to store an array of detected colors
  const [detectedColors, setDetectedColors] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files ? event.target.files[0] : null;

    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setCaption(null);          // Clear previous caption
      setDetectedColors([]);     // MODIFIED: Clear previous detected colors
      setError(null);            // Clear previous error
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption(null);
      setDetectedColors([]);     // MODIFIED: Clear previous detected colors
      setError("Please select a valid image file (PNG, JPG, GIF).");
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Please select an image first.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:8080/upload_image', { // Ensure port is correct
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to get caption.");
      }

      const data = await response.json();
      setCaption(data.caption);
      // MODIFIED: Set the array of detected colors
      setDetectedColors(data.detected_colors || []); 

    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error("Error submitting image:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card">
        <h1 className="title">
          <span className="gradient-text">AI Image Captioner</span>
        </h1>
        <p className="description">
          Upload an image to get a detailed description, including key color information.
        </p>

        <div className="upload-section">
          <label htmlFor="file-upload" className="upload-label">
            Upload Image
          </label>
          <div className="upload-area" onClick={() => document.getElementById('file-upload').click()}>
            <div className="upload-content">
              <svg className="upload-icon" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="upload-text">
                <p>or drag and drop</p>
              </div>
              <p className="upload-info">PNG, JPG, GIF up to 10MB</p>
            </div>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="file-input-hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {previewUrl && (
          <div className="image-preview-section">
            <h3 className="image-preview-heading">Image Preview:</h3>
            <img src={previewUrl} alt="Preview" className="image-preview" />
          </div>
        )}

        {error && (
          <div className="error-message" role="alert">
            <strong>Error!</strong>
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedFile || loading}
          className={`generate-button ${(!selectedFile || loading) ? 'generate-button-disabled' : ''}`}
        >
          {loading ? (
            <span className="loading-spinner-container">
              <svg className="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            'Generate Caption'
          )}
        </button>

        {/* Display both the general caption AND the detected colors information */}
        {(caption || detectedColors.length > 0) && (
          <div className="caption-display">
            {caption && (
              <>
                <h3 className="caption-heading">Generated Caption:</h3>
                <p className="caption-text">"{caption}"</p>
              </>
            )}
            {detectedColors.length > 0 && ( // Display detected colors if available
              <p className="caption-text dominant-color-info">
                <strong>Detected Colors:</strong> {detectedColors.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;