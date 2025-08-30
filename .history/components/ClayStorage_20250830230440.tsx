import { useState, useEffect, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Upload, Download, Save, FolderOpen, FileDown, FileUp, Loader2, AlertCircle } from 'lucide-react';
import { createIrysUploader, fundNode, getBalance } from '../lib/irys';
import { 
  serializeClayProject, 
  uploadClayProject, 
  downloadClayProject, 
  queryClayProjects,
  restoreClayObjects,
  ClayProject
} from '../lib/clayStorageService';
import {
  exportToGLB,
  importFromGLB,
  downloadGLB,
  uploadGLBToIrys,
  downloadGLBFromIrys,
  queryGLBProjects
} from '../lib/glbService';

interface ClayStorageProps {
  clays: any[];
  onLoadClays: (clays: any[]) => void;
}

export default function ClayStorage({ clays, onLoadClays }: ClayStorageProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'save' | 'load' | 'glb'>('save');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Save form state
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const [tags, setTags] = useState('');
  
  // Load state
  const [projects, setProjects] = useState<Array<{ id: string; tags: Record<string, string> }>>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  
  // Irys state
  const [irysUploader, setIrysUploader] = useState<any>(null);
  const [irysBalance, setIrysBalance] = useState<string>('0');
  
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  
  // Initialize Irys
  useEffect(() => {
    if (ready && authenticated && embeddedWallet) {
      initializeIrys();
    }
  }, [ready, authenticated, embeddedWallet]);
  
  const initializeIrys = async () => {
    try {
      const provider = await embeddedWallet!.getEthereumProvider();
      const uploader = await createIrysUploader(provider);
      setIrysUploader(uploader);
      
      // Get balance
      const balance = await getBalance(uploader);
      setIrysBalance(balance.toString());
    } catch (err) {
      console.error('Failed to initialize Irys:', err);
      setError('Failed to initialize Irys');
    }
  };
  
  const handleSave = async () => {
    if (!irysUploader || !projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const author = user?.email?.address || embeddedWallet?.address || 'anonymous';
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      
      const project = serializeClayProject(
        clays,
        projectName,
        description,
        author,
        tagArray
      );
      
      const transactionId = await uploadClayProject(
        irysUploader,
        project,
        folder.trim() || undefined
      );
      
      setSuccess(`Project saved successfully! ID: ${transactionId}`);
      
      // Reset form
      setProjectName('');
      setDescription('');
      setFolder('');
      setTags('');
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Error occurred while saving');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const author = user?.email?.address || embeddedWallet?.address;
      const results = await queryClayProjects(author);
      setProjects(results);
      
      if (results.length === 0) {
        setError('No saved projects found');
      }
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message || 'Error occurred while loading project list');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLoadProject = async (projectId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const project = await downloadClayProject(projectId);
      const restoredClays = restoreClayObjects(project);
      onLoadClays(restoredClays);
      setSuccess('Project loaded successfully!');
      setIsOpen(false);
    } catch (err: any) {
      console.error('Load project error:', err);
      setError(err.message || 'Error occurred while loading project');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportGLB = async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const author = user?.email?.address || embeddedWallet?.address || 'anonymous';
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      
      const glbBlob = await exportToGLB(clays, {
        name: projectName,
        description,
        author,
        tags: tagArray
      });
      
      // Download locally
      downloadGLB(glbBlob, projectName);
      
      // Upload to Irys if authenticated
      if (irysUploader) {
        const metadata = {
          id: '',
          name: projectName,
          description,
          author,
          createdAt: Date.now(),
          tags: tagArray
        };
        
        const transactionId = await uploadGLBToIrys(
          irysUploader,
          glbBlob,
          metadata,
          folder.trim() || undefined
        );
        
        setSuccess(`GLB file downloaded and uploaded to Irys! ID: ${transactionId}`);
      } else {
        setSuccess('GLB file downloaded!');
      }
      
      // Reset form
      setProjectName('');
      setDescription('');
      setFolder('');
      setTags('');
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Error occurred while exporting GLB');
    } finally {
      setLoading(false);
    }
  };
  
  const handleImportGLB = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { clays: importedClays } = await importFromGLB(file);
      onLoadClays(importedClays);
      setSuccess('GLB file loaded successfully!');
      setIsOpen(false);
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Error occurred while importing GLB');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLoadGLB = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const author = user?.email?.address || embeddedWallet?.address;
      const results = await queryGLBProjects(author);
      setProjects(results);
      
      if (results.length === 0) {
        setError('No saved GLB projects found');
      }
    } catch (err: any) {
      console.error('Load GLB error:', err);
      setError(err.message || 'GLB Error occurred while loading project list');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLoadGLBProject = async (projectId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const glbBlob = await downloadGLBFromIrys(projectId);
      const file = new File([glbBlob], 'project.glb', { type: 'model/gltf-binary' });
      const { clays: importedClays } = await importFromGLB(file);
      onLoadClays(importedClays);
      setSuccess('GLB Project loaded successfully!');
      setIsOpen(false);
    } catch (err: any) {
      console.error('Load GLB project error:', err);
      setError(err.message || 'GLB Error occurred while loading project');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFundNode = async () => {
    if (!irysUploader) return;
    
    setLoading(true);
    try {
      await fundNode(irysUploader, '0.1');
      const balance = await getBalance(irysUploader);
      setIrysBalance(balance.toString());
      setSuccess('0.1 IRYS funded successfully');
    } catch (err: any) {
      setError(err.message || 'Error occurred while funding');
    } finally {
      setLoading(false);
    }
  };
  
  if (!ready || !authenticated) {
    return null;
  }
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
      >
        <Save className="w-5 h-5" />
        <span className="hidden sm:inline">Save/Load</span>
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Clay Project Management</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {/* Balance Display */}
            <div className="mb-4 p-3 bg-gray-700 rounded-lg flex justify-between items-center">
              <span className="text-sm text-gray-300">Irys Balance: {irysBalance} IRYS</span>
              <button
                onClick={handleFundNode}
                disabled={loading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
              >
                Fund 0.1 IRYS
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('save')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'save' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Save
              </button>
              <button
                onClick={() => {
                  setActiveTab('load');
                  handleLoad();
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'load' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Download className="w-4 h-4 inline mr-2" />
                Load
              </button>
              <button
                onClick={() => {
                  setActiveTab('glb');
                  if (authenticated) handleLoadGLB();
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'glb' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <FileDown className="w-4 h-4 inline mr-2" />
                GLB 내보내기
              </button>
            </div>
            
            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-600 bg-opacity-20 border border-red-600 rounded-lg text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-600 bg-opacity-20 border border-green-600 rounded-lg text-green-400">
                {success}
              </div>
            )}
            
            {/* Content */}
            {activeTab === 'save' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="My Clay Creation"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="Enter a description for your creation"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Folder
                  </label>
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. sculptures, animals"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. animal, abstract, colorful"
                  />
                </div>
                
                <button
                  onClick={handleSave}
                  disabled={loading || !projectName.trim()}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Save to Irys
                    </>
                  )}
                </button>
              </div>
            )}
            
            {activeTab === 'load' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                    <p className="text-gray-400 mt-2">Loading project list...</p>
                  </div>
                ) : projects.length > 0 ? (
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer transition-colors"
                        onClick={() => handleLoadProject(project.id)}
                      >
                        <h3 className="font-medium text-white">
                          {project.tags['Project-Name'] || 'Untitled'}
                        </h3>
                        <div className="text-sm text-gray-400 mt-1">
                          <p>Author: {project.tags['Author']}</p>
                          <p>Created: {new Date(parseInt(project.tags['Created-At'])).toLocaleDateString()}</p>
                          {project.tags['Folder'] && (
                            <p className="flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" />
                              {project.tags['Folder']}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No saved projects found
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'glb' && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-600 bg-opacity-20 border border-blue-600 rounded-lg text-blue-400">
                  <p className="text-sm">
                    Export to GLB format for use in Blender, Unity, Unreal Engine, and more.
                    When logged in, files are automatically uploaded to Irys.
                  </p>
                </div>
                
                {/* Import GLB */}
                <div className="p-4 bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Import GLB File</h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".glb"
                    onChange={handleImportGLB}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FileUp className="w-5 h-5" />
                    Select GLB File
                  </button>
                </div>
                
                {/* Export GLB */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-300">Export to GLB</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="My Clay Creation"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      rows={3}
                      placeholder="Enter a description for your creation"
                    />
                  </div>
                  
                  {authenticated && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Folder
                        </label>
                        <input
                          type="text"
                          value={folder}
                          onChange={(e) => setFolder(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                          placeholder="e.g. glb-exports"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Tags (comma separated)
                        </label>
                        <input
                          type="text"
                          value={tags}
                          onChange={(e) => setTags(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                          placeholder="e.g. glb, 3d, blender"
                        />
                      </div>
                    </>
                  )}
                  
                  <button
                    onClick={handleExportGLB}
                    disabled={loading || !projectName.trim()}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FileDown className="w-5 h-5" />
                        Export to GLB
                      </>
                    )}
                  </button>
                </div>
                
                {/* GLB Projects List */}
                {authenticated && projects.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Saved GLB Projects</h3>
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer transition-colors"
                        onClick={() => handleLoadGLBProject(project.id)}
                      >
                        <h3 className="font-medium text-white">
                          {project.tags['Project-Name'] || 'Untitled'}
                        </h3>
                        <div className="text-sm text-gray-400 mt-1">
                          <p>Author: {project.tags['Author']}</p>
                          <p>Created: {new Date(parseInt(project.tags['Created-At'])).toLocaleDateString()}</p>
                          {project.tags['Folder'] && (
                            <p className="flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" />
                              {project.tags['Folder']}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
