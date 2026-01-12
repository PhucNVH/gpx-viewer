# GPX Viewer

A frontend-only GPS application that allows users to upload GPX files, visualize tracks on a map, and view elevation charts.

## Features

- **GPX File Upload**: Drag-and-drop or click to upload one or multiple `.gpx` files
- **Interactive Map**: Display GPX tracks on an OpenStreetMap-based map with dark theme
- **Multi-track Support**: Load multiple tracks with unique colors and visibility toggles
- **Elevation Chart**: View elevation profile for selected track with distance on X-axis
- **No Backend Required**: All processing happens in the browser

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Leaflet + React-Leaflet (mapping)
- Recharts (charts)
- Zustand (state management)
- @tmcw/togeojson (GPX parsing)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Usage

1. Open the app in your browser
2. Drag and drop GPX files onto the upload area, or click to browse
3. View your tracks on the map - each track gets a unique color
4. Click on a track (in the list or on the map) to select it
5. View the elevation profile for the selected track at the bottom of the sidebar
6. Toggle track visibility using the eye icon
7. Remove tracks using the X button

## License

MIT
