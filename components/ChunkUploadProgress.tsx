import React from 'react';
import { createPortal } from 'react-dom';

export interface ChunkStatus {
  index: number;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  txId?: string;
  error?: string;
}

interface ChunkUploadProgressProps {
  isOpen: boolean;
  currentChunk: number;
  totalChunks: number;
  percentage: number;
  projectName: string;
  isDownload?: boolean;
  chunkStatuses?: ChunkStatus[]; // FIX: Added detailed chunk status tracking
}

export function ChunkUploadProgress({ 
  isOpen, 
  currentChunk, 
  totalChunks, 
  percentage,
  projectName,
  isDownload = false,
  chunkStatuses = []
}: ChunkUploadProgressProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  const getStatusIcon = (status: ChunkStatus['status']) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'uploading':
        return '↻';
      case 'failed':
        return '✗';
      default:
        return '○';
    }
  };

  const getStatusColor = (status: ChunkStatus['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'uploading':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-400';
    }
  };

  return createPortal(
    <>
      {/* Dialog without backdrop */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-md w-full pointer-events-auto max-h-[80vh] overflow-y-auto">
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
          
          <p className="text-center text-sm text-gray-600 mb-4">
            {percentage.toFixed(0)}%
          </p>

          {/* FIX: Detailed chunk status display */}
          {chunkStatuses.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">
                Chunk {currentChunk} of {totalChunks}
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {chunkStatuses.map((chunk) => (
                  <div 
                    key={chunk.index}
                    className="flex items-center text-xs"
                  >
                    <span className={`mr-2 ${getStatusColor(chunk.status)}`}>
                      {getStatusIcon(chunk.status)}
                    </span>
                    <span className="text-gray-600">
                      Chunk {chunk.index + 1}
                    </span>
                    {chunk.status === 'success' && chunk.txId && (
                      <span className="ml-auto text-gray-400 truncate max-w-[120px]">
                        {chunk.txId.substring(0, 8)}...
                      </span>
                    )}
                    {chunk.status === 'failed' && (
                      <span className="ml-auto text-red-500 text-xs">
                        Failed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
