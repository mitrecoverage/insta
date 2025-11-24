import React, { useState, useCallback } from 'react';
import { Upload, Download, FileText, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

const CSVToGPXConverter = () => {
  const [file, setFile] = useState(null);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pointCount, setPointCount] = useState(0);

  // Convert knots to meters per second
  const knotsToMps = (knots) => knots * 0.514444;

  // Parse timestamp and convert to UTC
  const parseTimestamp = (timestampStr) => {
    try {
      const dt = new Date(timestampStr);
      // Format as ISO string with Z suffix, keeping 3 decimal places for milliseconds
      return dt.toISOString().replace(/\.(\d{3})\d*Z$/, '.$1Z');
    } catch (e) {
      throw new Error(`Invalid timestamp format: ${timestampStr}`);
    }
  };

  // Create GPX XML structure
  const createGPXXML = (points) => {
    let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="csv_to_gpx_converter_web" xmlns="http://www.topografix.com/GPX/1/1">
<trk>
<trkseg>`;

    points.forEach(point => {
      gpxContent += `
<trkpt lat="${point.latitude}" lon="${point.longitude}">
<ele>${point.hdg_true}</ele>
<time>${point.timestamp}</time>
<cog>${point.cog}</cog>
<hdg_true>${point.hdg_true}</hdg_true>
<heel>${point.heel}</heel>
<trim>${point.trim}</trim>
</trkpt>`;
    });

    gpxContent += `
</trkseg>
</trk>
</gpx>`;

    return gpxContent;
  };

  // Parse CSV content
  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must contain header and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const expectedColumns = ['timestamp', 'latitude', 'longitude', 'sog_kts', 'cog', 'hdg_true', 'heel', 'trim'];
    
    // Check for required columns
    const missingColumns = expectedColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`CSV missing required columns: ${missingColumns.join(', ')}`);
    }

    const points = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length !== headers.length) continue;

      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      try {
        // Validate and convert data
        const point = {
          timestamp: parseTimestamp(row.timestamp),
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
          sog_kts: parseFloat(row.sog_kts),
          cog: parseFloat(row.cog),
          hdg_true: parseFloat(row.hdg_true),
          heel: parseFloat(row.heel),
          trim: parseFloat(row.trim)
        };

        // Validate coordinates
        if (isNaN(point.latitude) || isNaN(point.longitude)) {
          console.warn(`Skipping row ${i + 1}: Invalid coordinates`);
          continue;
        }

        points.push(point);
      } catch (e) {
        console.warn(`Skipping row ${i + 1}: ${e.message}`);
      }
    }

    if (points.length === 0) {
      throw new Error('No valid data points found in CSV file');
    }

    return points;
  };

  // Handle file upload
  const handleFileUpload = useCallback((event) => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setResult(null);
      setError(null);
      setPointCount(0);
    }
  }, []);

  // Convert CSV to GPX
  const convertToGPX = useCallback(async () => {
    if (!file) return;

    setConverting(true);
    setError(null);
    setResult(null);

    try {
      const csvText = await file.text();
      const points = parseCSV(csvText);
      const gpxXML = createGPXXML(points);
      
      // Create blob and download URL
      const blob = new Blob([gpxXML], { type: 'application/gpx+xml' });
      const url = URL.createObjectURL(blob);
      
      const outputFilename = file.name.replace(/\.csv$/i, '_converted.gpx');
      
      setResult({
        url,
        filename: outputFilename,
        content: gpxXML
      });
      setPointCount(points.length);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setConverting(false);
    }
  }, [file]);

  // Download GPX file
  const downloadGPX = useCallback(() => {
    if (!result) return;
    
    const link = document.createElement('a');
    link.href = result.url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [result]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <MapPin className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">CSV to GPX Converter</h1>
          </div>
          <p className="text-lg text-gray-600">
            Convert marine navigation CSV data to GPX format for GPS devices and mapping applications
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          {/* Upload Section */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Upload CSV File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csvFile"
              />
              <label htmlFor="csvFile" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="text-lg font-medium text-gray-900 mb-2">
                  Choose CSV file or drag and drop
                </div>
                <div className="text-sm text-gray-500">
                  File must contain: timestamp, latitude, longitude, sog_kts, cog, hdg_true, heel, trim
                </div>
              </label>
            </div>
            
            {file && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center">
                <FileText className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm text-blue-800">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>

          {/* Convert Button */}
          <div className="flex justify-center mb-8">
            <button
              onClick={convertToGPX}
              disabled={!file || converting}
              className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {converting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Converting...
                </div>
              ) : (
                'Convert to GPX'
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-red-800">Conversion Error</div>
                <div className="text-sm text-red-700 mt-1">{error}</div>
              </div>
            </div>
          )}

          {/* Success and Download */}
          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <div className="text-green-800">
                  <div className="font-medium">Conversion Successful!</div>
                  <div className="text-sm mt-1">
                    Converted {pointCount} data points to GPX format
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={downloadGPX}
                  className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download {result.filename}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">CSV Format Requirements</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Required Columns</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><code className="bg-gray-100 px-2 py-1 rounded">timestamp</code> - ISO 8601 format with timezone</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">latitude</code> - Decimal degrees</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">longitude</code> - Decimal degrees</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">sog_kts</code> - Speed over ground (knots)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">cog</code> - Course over ground (degrees)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">hdg_true</code> - True heading (degrees)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">heel</code> - Heel angle (degrees)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">trim</code> - Trim angle (degrees)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Example Data</h3>
              <div className="bg-gray-50 p-4 rounded-lg text-xs font-mono">
                <div>timestamp,latitude,longitude,sog_kts,cog,hdg_true,heel,trim</div>
                <div>2025-11-20T08:07:30.060+0400,25.1234,55.5678,8.5,180.0,175.2,5.1,2.3</div>
                <div>2025-11-20T08:07:31.060+0400,25.1235,55.5679,8.6,181.0,176.1,5.2,2.4</div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">About GPX Output</h3>
            <p className="text-sm text-blue-700">
              The converted GPX file will contain track points with timestamps in UTC, 
              position data, and marine-specific extensions including course over ground, 
              true heading, heel, and trim angles. The elevation field is populated with 
              heading data for Insta360 compatibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVToGPXConverter;