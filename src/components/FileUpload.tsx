import { useCallback, useState } from 'react'
import { useTrackStore } from '../store/useTrackStore'
import { parseGpxFiles } from '../utils/gpxParser'

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const addTracks = useTrackStore((state) => state.addTracks)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const gpxFiles = Array.from(files).filter(
      (file) => file.name.toLowerCase().endsWith('.gpx')
    )
    
    if (gpxFiles.length === 0) return
    
    setIsLoading(true)
    try {
      const tracks = await parseGpxFiles(gpxFiles)
      if (tracks.length > 0) {
        addTracks(tracks)
      }
    } catch (error) {
      console.error('Failed to parse GPX files:', error)
    } finally {
      setIsLoading(false)
    }
  }, [addTracks])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }, [handleFiles])

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative border-2 border-dashed rounded-xl p-6
        transition-all duration-200 ease-out
        ${isDragging 
          ? 'border-accent-400 bg-accent-500/10 scale-[1.02]' 
          : 'border-surface-700 hover:border-surface-500 bg-surface-900/50'
        }
      `}
    >
      <input
        type="file"
        accept=".gpx"
        multiple
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isLoading}
      />
      
      <div className="flex flex-col items-center gap-3 pointer-events-none">
        <div className={`
          p-3 rounded-full transition-colors duration-200
          ${isDragging ? 'bg-accent-500/20' : 'bg-surface-800'}
        `}>
          <svg
            className={`w-6 h-6 transition-colors duration-200 ${isDragging ? 'text-accent-400' : 'text-surface-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-surface-300">Processing...</span>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-surface-200">
              Drop GPX files here
            </p>
            <p className="text-xs text-surface-500">
              or click to browse
            </p>
          </>
        )}
      </div>
    </div>
  )
}
