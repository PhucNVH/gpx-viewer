import { useState, useCallback, useRef, useEffect } from 'react'
import { FileUpload } from './components/FileUpload'
import { MapView } from './components/MapView'
import { TrackList } from './components/TrackList'
import { ElevationChart } from './components/ElevationChart'
import { MatchControls } from './components/MatchControls'
import { MatchSummary } from './components/MatchSummary'

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const [isChartMaximized, setIsChartMaximized] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  
  // Maximized chart panel state
  const [chartPanelSize, setChartPanelSize] = useState({ width: 800, height: 400 })
  const [chartPanelPos, setChartPanelPos] = useState({ x: 100, y: 100 })
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, panelX: 0, panelY: 0 })
  
  const MIN_SIDEBAR_WIDTH = 280
  const MAX_SIDEBAR_WIDTH = 600
  const MIN_PANEL_WIDTH = 400
  const MIN_PANEL_HEIGHT = 250

  // Sidebar resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const newWidth = e.clientX
    if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
      setSidebarWidth(newWidth)
    }
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Panel drag handlers
  const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingPanel(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: chartPanelPos.x,
      panelY: chartPanelPos.y,
    }
  }, [chartPanelPos])

  const handlePanelDrag = useCallback((e: MouseEvent) => {
    if (!isDraggingPanel) return
    
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y
    
    setChartPanelPos({
      x: Math.max(0, dragStartRef.current.panelX + deltaX),
      y: Math.max(0, dragStartRef.current.panelY + deltaY),
    })
  }, [isDraggingPanel])

  const handlePanelDragEnd = useCallback(() => {
    setIsDraggingPanel(false)
  }, [])

  useEffect(() => {
    if (isDraggingPanel) {
      document.addEventListener('mousemove', handlePanelDrag)
      document.addEventListener('mouseup', handlePanelDragEnd)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
    
    return () => {
      document.removeEventListener('mousemove', handlePanelDrag)
      document.removeEventListener('mouseup', handlePanelDragEnd)
      if (!isResizingPanel) {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDraggingPanel, handlePanelDrag, handlePanelDragEnd, isResizingPanel])

  // Panel resize handlers
  const handlePanelResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingPanel(true)
    setResizeDirection(direction)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: chartPanelSize.width,
      height: chartPanelSize.height,
      panelX: chartPanelPos.x,
      panelY: chartPanelPos.y,
    }
  }, [chartPanelSize, chartPanelPos])

  const handlePanelResize = useCallback((e: MouseEvent) => {
    if (!isResizingPanel || !resizeDirection) return
    
    const deltaX = e.clientX - resizeStartRef.current.x
    const deltaY = e.clientY - resizeStartRef.current.y
    
    let newWidth = resizeStartRef.current.width
    let newHeight = resizeStartRef.current.height
    let newX = resizeStartRef.current.panelX
    let newY = resizeStartRef.current.panelY
    
    if (resizeDirection.includes('e')) {
      newWidth = Math.max(MIN_PANEL_WIDTH, resizeStartRef.current.width + deltaX)
    }
    if (resizeDirection.includes('w')) {
      const widthDelta = -deltaX
      newWidth = Math.max(MIN_PANEL_WIDTH, resizeStartRef.current.width + widthDelta)
      if (newWidth > MIN_PANEL_WIDTH) {
        newX = resizeStartRef.current.panelX + deltaX
      }
    }
    if (resizeDirection.includes('s')) {
      newHeight = Math.max(MIN_PANEL_HEIGHT, resizeStartRef.current.height + deltaY)
    }
    if (resizeDirection.includes('n')) {
      const heightDelta = -deltaY
      newHeight = Math.max(MIN_PANEL_HEIGHT, resizeStartRef.current.height + heightDelta)
      if (newHeight > MIN_PANEL_HEIGHT) {
        newY = resizeStartRef.current.panelY + deltaY
      }
    }
    
    setChartPanelSize({ width: newWidth, height: newHeight })
    setChartPanelPos({ x: Math.max(0, newX), y: Math.max(0, newY) })
  }, [isResizingPanel, resizeDirection])

  const handlePanelResizeEnd = useCallback(() => {
    setIsResizingPanel(false)
    setResizeDirection(null)
  }, [])

  useEffect(() => {
    if (isResizingPanel) {
      document.addEventListener('mousemove', handlePanelResize)
      document.addEventListener('mouseup', handlePanelResizeEnd)
      document.body.style.userSelect = 'none'
    }
    
    return () => {
      document.removeEventListener('mousemove', handlePanelResize)
      document.removeEventListener('mouseup', handlePanelResizeEnd)
      if (!isDraggingPanel) {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizingPanel, handlePanelResize, handlePanelResizeEnd, isDraggingPanel])

  const toggleChartMaximized = useCallback(() => {
    setIsChartMaximized(prev => !prev)
  }, [])

  // Center panel when first opened
  useEffect(() => {
    if (isChartMaximized) {
      const centerX = Math.max(0, (window.innerWidth - sidebarWidth - chartPanelSize.width) / 2 + sidebarWidth)
      const centerY = Math.max(0, (window.innerHeight - chartPanelSize.height) / 2)
      setChartPanelPos({ x: centerX, y: centerY })
    }
  }, [isChartMaximized, sidebarWidth, chartPanelSize.width, chartPanelSize.height])

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        ref={sidebarRef}
        className="flex-shrink-0 bg-surface-900 border-r border-surface-800 flex flex-col relative z-[1001]"
        style={{ width: sidebarWidth }}
      >
        {/* Header */}
        <header className="p-4 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-accent-500 to-accent-600">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-surface-50">GPX Viewer</h1>
              <p className="text-xs text-surface-500">Visualize your tracks</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* File Upload */}
          <section>
            <FileUpload />
          </section>

          {/* Track List */}
          <section>
            <TrackList />
          </section>

          {/* Segment Matching Controls */}
          <section>
            <MatchControls />
          </section>

          {/* Matching Summary */}
          <section>
            <MatchSummary />
          </section>
        </div>

        {/* Elevation Chart (always visible at bottom) */}
        <div className="border-t border-surface-800 p-4 bg-surface-900/80 backdrop-blur">
          <ElevationChart onToggleMaximize={toggleChartMaximized} />
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`
            absolute top-0 right-0 w-1 h-full cursor-col-resize
            transition-colors duration-150 hover:bg-accent-500/50
            ${isResizing ? 'bg-accent-500' : 'bg-transparent'}
          `}
        >
          {/* Visual grip indicator */}
          <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1 h-16 flex flex-col items-center justify-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
            <div className="w-0.5 h-0.5 rounded-full bg-surface-400" />
            <div className="w-0.5 h-0.5 rounded-full bg-surface-400" />
            <div className="w-0.5 h-0.5 rounded-full bg-surface-400" />
          </div>
        </div>
      </aside>

      {/* Map */}
      <main className="flex-1 relative">
        <MapView />
        
        {/* Map Overlay Info */}
        <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-900/80 backdrop-blur border border-surface-700">
          <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
          <span className="text-xs text-surface-300">OpenStreetMap</span>
        </div>

        {/* Maximized Chart Floating Panel */}
        {isChartMaximized && (
          <div
            className="fixed z-[2000] bg-surface-900/70 backdrop-blur-md rounded-xl border border-surface-600/50 shadow-2xl overflow-hidden"
            style={{
              left: chartPanelPos.x,
              top: chartPanelPos.y,
              width: chartPanelSize.width,
              height: chartPanelSize.height,
            }}
          >
            {/* Drag handle (title bar) */}
            <div
              onMouseDown={handlePanelDragStart}
              className="flex items-center justify-between px-4 py-2 bg-surface-800/50 border-b border-surface-700/50 cursor-grab active:cursor-grabbing"
            >
              <span className="text-sm font-medium text-surface-300">Elevation Profile</span>
              <button
                onClick={toggleChartMaximized}
                className="p-1.5 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Chart content */}
            <div className="p-4 h-[calc(100%-44px)]">
              <ElevationChart isMaximized onToggleMaximize={toggleChartMaximized} />
            </div>

            {/* Resize handles */}
            {/* Corners */}
            <div
              onMouseDown={(e) => handlePanelResizeStart(e, 'nw')}
              className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
            />
            <div
              onMouseDown={(e) => handlePanelResizeStart(e, 'ne')}
              className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
            />
            <div
              onMouseDown={(e) => handlePanelResizeStart(e, 'sw')}
              className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
            />
            <div
              onMouseDown={(e) => handlePanelResizeStart(e, 'se')}
              className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
            />
            {/* Edges */}
            <div
              onMouseDown={(e) => handlePanelResizeStart(e, 'n')}
              className="absolute top-0 left-3 right-3 h-1 cursor-n-resize"
            />
            <div
              onMouseDown={(e) => handlePanelResizeStart(e, 's')}
              className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize"
            />
            <div
              onMouseDown={(e) => handlePanelResizeStart(e, 'w')}
              className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize"
            />
            <div
              onMouseDown={(e) => handlePanelResizeStart(e, 'e')}
              className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize"
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
