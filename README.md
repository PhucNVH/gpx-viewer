# GPX Viewer

A powerful, feature-rich GPS track visualization application built with React. Upload GPX files, visualize tracks on an interactive map, analyze elevation profiles, compare routes, and find matching segments between different activities.

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)

## ✨ Features

### Track Management
- **GPX File Upload**: Drag-and-drop or click to upload single or multiple `.gpx` files
- **Multi-track Support**: Load and manage multiple tracks simultaneously with unique colors
- **Track Visibility**: Toggle individual track visibility on the map
- **Persistent Storage**: Tracks are stored in MinIO/S3-compatible storage with metadata cached locally

### Interactive Map
- **OpenStreetMap Integration**: Beautiful dark-themed map powered by Leaflet
- **Auto-fit Bounds**: Map automatically adjusts to show all visible tracks
- **Track Layers**: Each track rendered as a colored polyline with smooth paths
- **Hover Interaction**: Real-time position marker synced with elevation chart

### Elevation Analysis
- **Interactive Elevation Chart**: View elevation profile with distance on X-axis using Recharts
- **Biometric Data**: Display heart rate (HR) and cadence data when available in GPX
- **Segment Selection**: Click to select start/end points and analyze segments
- **Segment Statistics**: View distance, elevation gain/loss, net elevation, and slope metrics
- **Maximizable Panel**: Pop out elevation chart into a draggable, resizable floating panel

### Route Matching
- **Segment Detection**: Automatically find where different tracks share the same path
- **Direction-Aware**: Only matches segments traveling in the same direction
- **Configurable Tolerance**: Adjustable delta distance (50m - 1000m) for matching precision
- **Matched Segment Visualization**: Highlighted overlays showing shared route sections
- **Comparison View**: Side-by-side elevation comparison of matched segments

### User Interface
- **Resizable Sidebar**: Adjustable width sidebar with drag handle
- **Dark Theme**: Modern, eye-friendly dark UI design
- **Responsive Controls**: Intuitive controls for all features

## 🧮 Algorithms

### Haversine Formula
Calculates the great-circle distance between two points on Earth given their latitude and longitude:
```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1-a))
d = R × c
```
Used for accurate distance calculations between GPS coordinates.

### Spatial Grid Indexing
A grid-based spatial index for O(1) average-case nearest-neighbor lookups:
- Divides geographic space into cells (configurable size, default ~500m)
- Points are indexed by grid cell key `(floor(lng/cellSize), floor(lat/cellSize))`
- Nearest-neighbor search only checks adjacent cells within search radius
- Dramatically improves segment matching performance for large tracks

### Douglas-Peucker Line Simplification
Reduces the number of points in a polyline while preserving its shape:
- Recursively finds the point with maximum perpendicular distance from the line
- Points within tolerance (~1.5m) are removed
- Produces smooth, simplified paths for matched segment visualization

### Moving Average Smoothing
Applies a windowed average to polyline coordinates:
- Configurable window size (default: 5 points)
- Preserves start/end points for accuracy
- Combined with Douglas-Peucker for optimal path representation

### Bearing Calculation
Computes the initial bearing (direction) between two geographic points:
```
θ = atan2(sin(Δlon) × cos(lat2), cos(lat1) × sin(lat2) − sin(lat1) × cos(lat2) × cos(Δlon))
```
Used for:
- Direction-aware segment matching (only same-direction matches)
- Compass direction labels (N, NE, E, SE, S, SW, W, NW)

### Segment Matching Algorithm
Multi-pass algorithm to find shared route sections between tracks:

1. **Point Sampling**: Sample every Nth point for efficiency
2. **Spatial Lookup**: Use grid index to find nearby points within delta tolerance
3. **Bearing Filtering**: Only match points traveling in similar direction (±45°)
4. **Segment Grouping**: Group consecutive matches with gap tolerance
5. **Segment Merging**: 
   - Sequential merge: combine segments within 250m
   - Overlap merge: combine segments sharing >20% points
   - Direction validation: prevent merging opposite-direction segments
6. **Path Smoothing**: Apply smoothing + simplification for clean visualization

### Web Worker Offloading
Segment matching calculations run in a dedicated Web Worker:
- Keeps UI responsive during heavy computations
- Falls back to `requestIdleCallback` when workers unavailable
- Debounced recalculation (150ms) prevents excessive updates

## 🛠 Tech Stack

### Frontend Framework
| Technology | Purpose |
|------------|---------|
| **React 18** | UI component library with hooks |
| **TypeScript** | Type-safe JavaScript |
| **Vite** | Fast build tool and dev server |

### Styling
| Technology | Purpose |
|------------|---------|
| **Tailwind CSS** | Utility-first CSS framework |
| **PostCSS** | CSS processing |
| **Autoprefixer** | CSS vendor prefixing |

### Mapping
| Technology | Purpose |
|------------|---------|
| **Leaflet** | Interactive map library |
| **React-Leaflet** | React components for Leaflet |

### Data Visualization
| Technology | Purpose |
|------------|---------|
| **Recharts** | Composable charting library for elevation profiles |

### State Management
| Technology | Purpose |
|------------|---------|
| **Zustand** | Lightweight state management with persistence |

### GPX Processing
| Technology | Purpose |
|------------|---------|
| **@tmcw/togeojson** | Convert GPX to GeoJSON format |
| **DOMParser** | Native XML parsing for GPX extensions |

### Storage
| Technology | Purpose |
|------------|---------|
| **AWS SDK (S3 Client)** | MinIO/S3-compatible object storage |
| **LocalStorage** | Track metadata persistence |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- (Optional) MinIO server for persistent GPX storage

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd gpx-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Configuration

For MinIO storage, configure the following in `src/config/storage.ts`:
- `endpoint`: MinIO server URL
- `accessKeyId`: Access key
- `secretAccessKey`: Secret key
- `bucket`: Bucket name for GPX files

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 Usage

### Basic Workflow
1. **Upload Tracks**: Drag and drop GPX files or click the upload area
2. **View on Map**: Tracks appear on the map with unique colors
3. **Select Track**: Click a track in the sidebar to select it
4. **Analyze Elevation**: View elevation profile in the bottom panel
5. **Measure Segments**: Enable segment mode to measure specific sections

### Segment Matching
1. Load multiple tracks that share common routes
2. Enable "Segment Matching" in the controls
3. Adjust the delta (tolerance) slider as needed
4. View matched segments highlighted on the map
5. Click a matched segment to compare elevation profiles

### Elevation Chart Features
- **Hover**: See current position on map and elevation details
- **Click**: Set segment start/end points (when segment mode enabled)
- **Toggle Data**: Show/hide heart rate and cadence graphs
- **Maximize**: Pop out chart into a floating, resizable panel

## 📁 Project Structure

```
src/
├── components/
│   ├── ElevationChart/    # Elevation visualization components
│   ├── MapView/           # Map and overlay components
│   ├── FileUpload.tsx     # GPX file upload handler
│   ├── TrackList.tsx      # Track management list
│   ├── MatchControls.tsx  # Segment matching controls
│   └── MatchSummary.tsx   # Matched segments summary
├── hooks/
│   └── useSegmentMatcherWorker.ts  # Web Worker integration
├── services/
│   └── storageService.ts  # MinIO/S3 storage operations
├── store/
│   └── useTrackStore.ts   # Zustand state management
├── utils/
│   ├── gpxParser.ts       # GPX parsing with extensions
│   ├── distance.ts        # Haversine distance calculation
│   ├── segmentMatcher.ts  # Route matching algorithm
│   ├── spatialIndex.ts    # Spatial grid for fast lookups
│   ├── colorGenerator.ts  # Track color assignment
│   └── elevation.ts       # Elevation utilities
├── workers/
│   └── segmentMatcher.worker.ts  # Background processing
├── types/
│   └── index.ts           # TypeScript type definitions
└── config/
    └── storage.ts         # Storage configuration
```

## 📄 License

MIT
