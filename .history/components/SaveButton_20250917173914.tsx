import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, Loader2 } from 'lucide-react';
import { usePopup } from './PopupNotification';

interface SaveButtonProps {
  onSave: (projectName: string, saveAs?: boolean, onProgress?: (status: string) => void) => Promise<void>;
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
  const [saveStatus, setSaveStatus] = useState<string>('');
  const { showPopup } = usePopup();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = async () => {
    if (!isConnected) {
      showPopup('Please connect your wallet first', 'error');
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
      setSaveStatus('');
      try {
        await onSave(currentProjectName, false, (status) => setSaveStatus(status));
        showPopup('Project saved successfully!', 'success');
      } catch (error) {
        console.error('Save error:', error);
      } finally {
        setLoading(false);
        setSaveStatus('');
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
    setSaveStatus('');
    try {
      await onSave(nameToUse, forceNewName || saveMode === 'saveAs', (status) => setSaveStatus(status));
      setIsOpen(false);
      setProjectName('');
      setSaveStatus('');
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setLoading(false);
      setSaveStatus('');
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
          {/* Dialog without backdrop */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999]">
            <div className="bg-white rounded-lg shadow-lg p-6 w-96 border border-gray-200">
              <h2 className="text-lg font-medium mb-4 text-gray-800">
                {currentProjectName && saveMode === 'saveAs' ? 'Save As New Project' : 'Save Project'}
              </h2>
              
              {currentProjectName && saveMode === 'saveAs' && (
                <div className="mb-4 text-sm text-gray-600">
                  Current project: <span className="font-medium">{currentProjectName}</span>
                </div>
              )}
              
              {/* Payment notice for new projects */}
              {(!currentProjectName || saveMode === 'saveAs') && !loading && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Note:</span> First-time project uploads over 90KB require a 0.1 IRYS service fee.
                  </p>
                </div>
              )}
              
              {/* Save progress status */}
              {loading && saveStatus && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <p className="text-sm text-blue-700">{saveStatus}</p>
                  </div>
                </div>
              )}
              
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={saveMode === 'saveAs' ? "New project name" : "Project name"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                autoFocus
                disabled={loading}
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
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(saveMode === 'saveAs')}
                  disabled={loading || (saveMode === 'saveAs' && !projectName.trim())}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
