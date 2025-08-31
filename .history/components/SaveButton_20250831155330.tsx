import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface SaveButtonProps {
  onSave: (projectName: string) => Promise<void>;
  isConnected: boolean;
}

export default function SaveButton({ onSave, isConnected }: SaveButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!projectName.trim()) return;
    
    setLoading(true);
    try {
      await onSave(projectName);
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

      {/* Save Dialog */}
      {isOpen && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Save Project</h2>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !projectName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
