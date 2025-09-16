import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, Loader2 } from 'lucide-react';
import { usePopup } from './PopupNotification';

interface SaveButtonProps {
  onSave: (projectName: string, saveAs?: boolean) => Promise<void>;
  isConnected: boolean;
  currentProjectName?: string;
  isDirty?: boolean;
}

export default function SaveButton({ onSave, isConnected, currentProjectName, isDirty }: SaveButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveMode, setSaveMode] = useState<'save' | 'saveAs'>('save');
  const [mounted, setMounted] = useState(false);
  const { showPopup } = usePopup();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    // If we have a current project and it's not dirty, show options
    if (currentProjectName && !isDirty) {
      setSaveMode('saveAs');
      setProjectName('');
      setIsOpen(true);
    } else if (currentProjectName) {
      // If we have a current project and it's dirty, quick save
      setLoading(true);
      try {
        await onSave(currentProjectName, false);
      } catch (error) {
        console.error('Save error:', error);
      } finally {
        setLoading(false);
      }
    } else {
      // No current project, show dialog
      setSaveMode('save');
      setProjectName('');
      setIsOpen(true);
    }
  };

  const handleSave = async (forceNewName: boolean = false) => {
    const nameToUse = forceNewName || saveMode === 'saveAs' ? projectName : (currentProjectName || projectName);
    if (!nameToUse.trim()) return;
    
    setLoading(true);
    try {
      await onSave(nameToUse, forceNewName || saveMode === 'saveAs');
      setIsOpen(false);
      setProjectName('');
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all"
        title="Save Project"
      >
        <Save size={20} />
      </button>

      {/* Save Dialog - Rendered as Portal */}
      {mounted && isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dialog */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999]">
            <div className="bg-white rounded-lg shadow-xl p-6 w-96 border border-gray-200">
              <h2 className="text-xl font-bold mb-4">
                {currentProjectName && saveMode === 'saveAs' ? 'Save As New Project' : 'Save Project'}
              </h2>
              
              {currentProjectName && saveMode === 'saveAs' && (
                <div className="mb-4 text-sm text-gray-600">
                  Current project: <span className="font-medium">{currentProjectName}</span>
                </div>
              )}
              
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={saveMode === 'saveAs' ? "New project name" : "Project name"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              
              {currentProjectName && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => handleSave(false)}
                    className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
                  >
                    Update "{currentProjectName}"
                  </button>
                  <button
                    onClick={() => setSaveMode('saveAs')}
                    className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
                  >
                    Save as New
                  </button>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(saveMode === 'saveAs')}
                  disabled={loading || (saveMode === 'saveAs' && !projectName.trim())}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saveMode === 'saveAs' ? 'Save As' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
