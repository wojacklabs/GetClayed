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
      setError('Irys 초기화 실패');
    }
  };
  
  const handleSave = async () => {
    if (!irysUploader || !projectName.trim()) {
      setError('프로젝트 이름을 입력해주세요');
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
      
      setSuccess(`프로젝트가 성공적으로 저장되었습니다! ID: ${transactionId}`);
      
      // Reset form
      setProjectName('');
      setDescription('');
      setFolder('');
      setTags('');
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || '저장 중 오류가 발생했습니다');
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
        setError('저장된 프로젝트가 없습니다');
      }
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message || '프로젝트 목록을 불러오는 중 오류가 발생했습니다');
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
      setSuccess('프로젝트를 성공적으로 불러왔습니다!');
      setIsOpen(false);
    } catch (err: any) {
      console.error('Load project error:', err);
      setError(err.message || '프로젝트를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMintNFT = async () => {
    if (!irysUploader || !embeddedWallet || !projectName.trim()) {
      setError('프로젝트 이름을 입력해주세요');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // First, save the project to Irys
      const author = user?.email?.address || embeddedWallet.address || 'anonymous';
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      
      const project = serializeClayProject(
        clays,
        projectName,
        description,
        author,
        tagArray
      );
      
      const projectId = await uploadClayProject(
        irysUploader,
        project,
        folder.trim() || undefined
      );
      
      // Create and upload metadata
      const metadata = createClayNFTMetadata(
        projectName,
        description,
        author,
        projectId
      );
      
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], 'metadata.json');
      
      const metadataReceipt = await uploadToIrys(
        irysUploader,
        metadataFile,
        [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'App-Name', value: 'GetClayed' },
          { name: 'Data-Type', value: 'nft-metadata' }
        ]
      );
      
      // Mint NFT
      const provider = await embeddedWallet.getEthereumProvider();
      const ethersProvider = new ethers.providers.Web3Provider(provider);
      const signer = ethersProvider.getSigner();
      
      const nftContract = new ClayNFTContract(ethersProvider);
      const tx = await nftContract.mintClayNFT(
        signer,
        embeddedWallet.address,
        `https://gateway.irys.xyz/${metadataReceipt.id}`
      );
      
      await tx.wait();
      
      setSuccess(`NFT가 성공적으로 발행되었습니다! 프로젝트 ID: ${projectId}`);
      
      // Reset form
      setProjectName('');
      setDescription('');
      setFolder('');
      setTags('');
    } catch (err: any) {
      console.error('Mint error:', err);
      setError(err.message || 'NFT 발행 중 오류가 발생했습니다');
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
      setSuccess('0.1 IRYS가 충전되었습니다');
    } catch (err: any) {
      setError(err.message || '충전 중 오류가 발생했습니다');
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
        <span className="hidden sm:inline">저장/불러오기</span>
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">클레이 프로젝트 관리</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {/* Balance Display */}
            <div className="mb-4 p-3 bg-gray-700 rounded-lg flex justify-between items-center">
              <span className="text-sm text-gray-300">Irys 잔액: {irysBalance} IRYS</span>
              <button
                onClick={handleFundNode}
                disabled={loading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
              >
                0.1 IRYS 충전
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
                저장
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
                불러오기
              </button>
              <button
                onClick={() => setActiveTab('mint')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'mint' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Tag className="w-4 h-4 inline mr-2" />
                NFT 발행
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
                    프로젝트 이름 *
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="나의 클레이 작품"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    설명
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="작품에 대한 설명을 입력하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    폴더
                  </label>
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="예: sculptures, animals"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    태그 (쉼표로 구분)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="예: 동물, 추상, 컬러풀"
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
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Irys에 저장
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
                    <p className="text-gray-400 mt-2">프로젝트 목록을 불러오는 중...</p>
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
                          <p>작성자: {project.tags['Author']}</p>
                          <p>생성일: {new Date(parseInt(project.tags['Created-At'])).toLocaleDateString()}</p>
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
                    저장된 프로젝트가 없습니다
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'mint' && (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-600 bg-opacity-20 border border-yellow-600 rounded-lg text-yellow-400">
                  <p className="text-sm">
                    NFT 발행 시 0.1 IRYS 토큰이 필요합니다. 
                    프로젝트가 Irys에 저장되고 NFT 메타데이터가 생성됩니다.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    NFT 이름 *
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="나의 클레이 NFT"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    설명
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="NFT에 대한 설명을 입력하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    폴더
                  </label>
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="예: nft-collection"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    태그 (쉼표로 구분)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="예: nft, 3d, clay"
                  />
                </div>
                
                <button
                  onClick={handleMintNFT}
                  disabled={loading || !projectName.trim()}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      NFT 발행 중...
                    </>
                  ) : (
                    <>
                      <Tag className="w-5 h-5" />
                      NFT 발행 (0.1 IRYS)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
