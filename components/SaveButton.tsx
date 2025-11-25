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
        className="p-2 sm:p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all"
        title="Save Project"
      >
        <Save size={16} className="sm:w-5 sm:h-5" />
      </button>

      {/* Save Dialog - Rendered as Portal */}
      {mounted && isOpen && createPortal(
        <>
          {/* Dialog without backdrop */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
            <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200/80 w-full max-w-md overflow-hidden pointer-events-auto">
              <div className="absolute left-0 top-0 bottom-0 w-1 border-l-4 border-l-gray-400" />
              <div className="p-6 pl-7">
                <div className="flex items-start gap-4 mb-5">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Save className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h2 className="text-base font-semibold text-gray-900 mb-1">
                      {currentProjectName && saveMode === 'saveAs' ? 'Save As New Project' : 'Save Project'}
                    </h2>
                    {currentProjectName && saveMode === 'saveAs' && (
                      <p className="text-sm text-gray-600">
                        Current: <span className="font-medium">{currentProjectName}</span>
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Save progress status */}
                {loading && saveStatus && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                      <p className="text-sm text-gray-700">{saveStatus}</p>
                    </div>
                  </div>
                )}
                
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={saveMode === 'saveAs' ? "New project name" : "Project name"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 text-sm mb-4"
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
                      className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors text-sm"
                    >
                      Update "{currentProjectName}"
                    </button>
                    <button
                      onClick={() => setSaveMode('saveAs')}
                      className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors text-sm"
                    >
                      Save as New
                    </button>
                  </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave(saveMode === 'saveAs')}
                    disabled={loading || (saveMode === 'saveAs' && !projectName.trim())}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saveMode === 'saveAs' ? 'Save As' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
