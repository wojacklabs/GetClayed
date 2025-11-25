import React from 'react';
import { createPortal } from 'react-dom';
import { Upload, Download } from 'lucide-react';

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
  chunkStatuses?: ChunkStatus[];
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
        return 'text-emerald-600';
      case 'uploading':
        return 'text-gray-600 animate-spin';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-300';
    }
  };

  const IconComponent = isDownload ? Download : Upload;

  return createPortal(
    <>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
        <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200/80 max-w-md w-full overflow-hidden pointer-events-auto max-h-[80vh]">
          <div className="absolute left-0 top-0 bottom-0 w-1 border-l-4 border-l-gray-400" />
          <div className="p-6 pl-7">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <IconComponent className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {isDownload ? 'Loading Project' : 'Saving Project'}
                </h3>
                <p className="text-sm text-gray-600 truncate">{projectName}</p>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
              <div 
                className="bg-gray-900 h-2 transition-all duration-300 rounded-full"
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            <p className="text-center text-sm font-medium text-gray-900 mb-1">
              {percentage.toFixed(0)}%
            </p>
            <p className="text-center text-xs text-gray-500">
              {currentChunk} of {totalChunks} chunks
            </p>

            {/* Detailed chunk status display */}
            {chunkStatuses.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
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
                        <span className="ml-auto text-gray-400 truncate max-w-[120px] font-mono">
                          {chunk.txId.substring(0, 8)}...
                        </span>
                      )}
                      {chunk.status === 'failed' && (
                        <span className="ml-auto text-red-500">
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
      </div>
    </>,
    document.body
  );
}
