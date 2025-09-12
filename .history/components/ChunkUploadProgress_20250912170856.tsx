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
        <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full pointer-events-auto">
          <h3 className="text-lg font-semibold mb-4">
            {isDownload ? 'Loading' : 'Uploading'} Large Project: {projectName}
          </h3>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              {isDownload 
                ? `Downloading ${totalChunks} chunks from Arweave...`
                : `Your project exceeds 100KB and is being split into ${totalChunks} chunks. You'll need to sign ${totalChunks} transactions.`
              }
            </p>
            <p className="text-sm font-medium text-gray-800">
              Current chunk: {currentChunk} of {totalChunks}
            </p>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          <p className="text-center text-sm text-gray-600">
            {percentage.toFixed(0)}% complete
          </p>
          
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-800">
              ⚠️ Please approve each transaction in your wallet.
              Do not close this window until all chunks are uploaded.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
