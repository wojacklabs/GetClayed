import React from 'react';
import { createPortal } from 'react-dom';

interface ChunkUploadProgressProps {
  isOpen: boolean;
  currentChunk: number;
  totalChunks: number;
  percentage: number;
  projectName: string;
  isDownload?: boolean;
}

export function ChunkUploadProgress({ 
  isOpen, 
  currentChunk, 
  totalChunks, 
  percentage,
  projectName,
  isDownload = false
}: ChunkUploadProgressProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      {/* Dialog without backdrop */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-md w-full pointer-events-auto">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            {isDownload ? `Loading ${projectName} project` : `Saving ${projectName} project`}
          </h3>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-lg h-2 mb-3 overflow-hidden">
            <div 
              className="bg-gray-900 h-2 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          <p className="text-center text-sm text-gray-600">
            {percentage.toFixed(0)}%
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}
