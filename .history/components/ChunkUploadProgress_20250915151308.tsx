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
        <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full pointer-events-auto">
          <h3 className="text-lg font-semibold mb-4">
            {isDownload ? 'Loading' : 'Saving'} {projectName}
          </h3>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
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
