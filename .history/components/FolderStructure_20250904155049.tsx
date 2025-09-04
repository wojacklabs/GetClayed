import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderPlus, FileText, MoreVertical, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { getUserFolderStructure } from '../lib/clayStorageService';
import { queryCache } from '../lib/queryCache';
import { getLocalFolders, addLocalFolder, removeLocalFolder, renameLocalFolder } from '../lib/localFolderService';

interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FolderNode[];
  projectId?: string; // For files
  tags?: Record<string, string>; // For files
}

interface FolderStructureProps {
  walletAddress: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectMove: (projectId: string, folderPath: string) => void;
  onProjectDelete: (projectId: string) => void;
  onFolderCreate: (folderPath: string) => void;
  onFolderDelete: (folderPath: string) => void;
  currentFolder: string;
}

export default function FolderStructure({ 
  walletAddress, 
  onProjectSelect, 
  onProjectMove,
  onProjectDelete,
  onFolderCreate,
  onFolderDelete,
  currentFolder 
}: FolderStructureProps) {
  const [folderTree, setFolderTree] = useState<FolderNode>({
    id: 'root',
    name: 'My Projects',
    type: 'folder',
    children: []
  });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FolderNode } | null>(null);
  const [renamingItem, setRenamingItem] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{
    id: string;
    name: string;
    folderPath: string;
    timestamp: number;
  }>>([]);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Fetch projects when wallet address changes
  const fetchProjects = async () => {
    if (!walletAddress) {
      setProjects([]);
      return;
    }
    
    setLoading(true);
    try {
      // Check cache first
      const cacheKey = `projects-${walletAddress}`;
      const cached = queryCache.get<typeof projects>(cacheKey);
      
      if (cached) {
        setProjects(cached);
      } else {
        const result = await getUserFolderStructure(walletAddress);
        setProjects(result.projects);
        
        // Cache for 30 seconds
        queryCache.set(cacheKey, result.projects, 30000);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchProjects();
  }, [walletAddress]);

  // Build folder tree from projects and local folders
  useEffect(() => {
    const tree: FolderNode = {
      id: 'root',
      name: 'My Projects',
      type: 'folder',
      children: []
    };

    const folderMap = new Map<string, FolderNode>();
    folderMap.set('root', tree);

    // First, create all local folders
    if (walletAddress) {
      const localFolders = getLocalFolders(walletAddress);
      localFolders.forEach(folderPath => {
        const parts = folderPath.split('/').filter(Boolean);
        let currentPath = '';
        let parentNode = tree;

        parts.forEach(part => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          
          if (!folderMap.has(currentPath)) {
            const newFolder: FolderNode = {
              id: currentPath,
              name: part,
              type: 'folder',
              children: []
            };
            
            parentNode.children!.push(newFolder);
            folderMap.set(currentPath, newFolder);
          }
          
          parentNode = folderMap.get(currentPath)!;
        });
      });
    }

    // Then, create folders from projects
    projects.forEach(project => {
      const folderPath = project.folderPath === '/' ? '' : project.folderPath.replace(/^\//, '');
      if (folderPath) {
        const parts = folderPath.split('/').filter(Boolean);
        let currentPath = '';
        let parent = tree;

        parts.forEach(part => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!folderMap.has(currentPath)) {
            const folder: FolderNode = {
              id: currentPath,
              name: part,
              type: 'folder',
              children: []
            };
            parent.children!.push(folder);
            folderMap.set(currentPath, folder);
          }
          parent = folderMap.get(currentPath)!;
        });
      }
    });

    // Add files to folders
    projects.forEach(project => {
      const folderPath = project.folderPath === '/' ? '' : project.folderPath.replace(/^\//, '');
      const parent = folderPath ? folderMap.get(folderPath) || tree : tree;
      
      parent.children!.push({
        id: project.id,
        name: project.name,
        type: 'file',
        projectId: project.id
      });
    });

    setFolderTree(tree);
  }, [projects, walletAddress, forceUpdate]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, item: FolderNode) => {
    if (item.type === 'file') {
      setDraggingItem(item.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragOver = (e: React.DragEvent, item: FolderNode) => {
    if (item.type === 'folder' && draggingItem) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverFolder(item.id);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, folder: FolderNode) => {
    e.preventDefault();
    if (draggingItem && folder.type === 'folder') {
      const newPath = folder.id === 'root' ? '' : folder.id;
      onProjectMove(draggingItem, newPath);
    }
    setDraggingItem(null);
    setDragOverFolder(null);
  };

  const handleContextMenu = (e: React.MouseEvent, item: FolderNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleCreateFolder = (parentId: string) => {
    const folderName = prompt('New folder name:');
    if (folderName) {
      const path = parentId === 'root' ? folderName : `${parentId}/${folderName}`;
      
      // Save to local storage immediately
      if (walletAddress) {
        addLocalFolder(walletAddress, path);
      }
      
      onFolderCreate(path);
      
      // Force re-render to show new folder immediately
      setForceUpdate(prev => prev + 1);
    }
    setContextMenu(null);
  };

  const handleDelete = (item: FolderNode) => {
    if (confirm(`Delete ${item.name}?`)) {
      if (item.type === 'folder') {
        // Remove from local storage
        if (walletAddress) {
          removeLocalFolder(walletAddress, item.id);
        }
        onFolderDelete(item.id);
        // Force re-render
        setForceUpdate(prev => prev + 1);
      } else if (item.type === 'file' && item.projectId) {
        onProjectDelete(item.projectId);
        // Clear cache to refresh
        queryCache.delete(`projects-${walletAddress}`);
        fetchProjects();
      }
    }
    setContextMenu(null);
  };

  const handleRename = (item: FolderNode) => {
    setRenamingItem(item.id);
    setNewName(item.name);
    setContextMenu(null);
  };

  const renderNode = (node: FolderNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedItem === node.id;
    const isDragOver = dragOverFolder === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1 hover:bg-gray-100 cursor-pointer select-none ${
            isSelected ? 'bg-blue-100' : ''
          } ${isDragOver ? 'bg-blue-50 border-2 border-blue-300' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.id);
            } else {
              setSelectedItem(node.id);
              onProjectSelect(node.projectId!);
            }
          }}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          draggable={node.type === 'file'}
        >
          {node.type === 'folder' && (
            <>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Folder size={16} className="text-blue-500" />
            </>
          )}
          {node.type === 'file' && (
            <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 2C0 0.895431 0.895431 0 2 0H9L14 5V16C14 17.1046 13.1046 18 12 18H2C0.895431 18 0 17.1046 0 16V2Z" fill="#9CA3AF"/>
              <path d="M9 0L14 5H11C9.89543 5 9 4.10457 9 3V0Z" fill="#6B7280"/>
            </svg>
          )}
          
          {renamingItem === node.id ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => setRenamingItem(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Handle rename
                  setRenamingItem(null);
                }
                if (e.key === 'Escape') {
                  setRenamingItem(null);
                }
              }}
              className="px-1 py-0 text-sm border border-blue-400 rounded"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm">{node.name}</span>
          )}
        </div>
        
        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderFolderGrid = () => {
    const folders = folderTree.children?.filter(item => item.type === 'folder') || [];
    const files = folderTree.children?.filter(item => item.type === 'file') || [];
    
    return (
      <div className="flex gap-6">
        {/* Folders */}
        {folders.map(folder => (
          <div
            key={folder.id}
            className={`flex flex-col items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors ${
              selectedItem === folder.id ? 'bg-blue-100' : ''
            } ${dragOverFolder === folder.id ? 'bg-blue-50 ring-2 ring-blue-300' : ''}`}
            onClick={() => {
              setSelectedItem(folder.id);
              toggleFolder(folder.id);
            }}
            onDragOver={(e) => handleDragOver(e, folder)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder)}
            onContextMenu={(e) => handleContextMenu(e, folder)}
          >
            <div className="mb-1">
              <svg width="48" height="38" viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 8C0 3.58172 3.58172 0 8 0H26.7639C28.5215 0 30.2135 0.632141 31.5279 1.78885L35.7082 5.57771C37.0226 6.73442 38.7146 7.36656 40.4721 7.36656H72C76.4183 7.36656 80 10.9483 80 15.3666V56C80 60.4183 76.4183 64 72 64H8C3.58172 64 0 60.4183 0 56V8Z" fill="#5EBBF2"/>
                <path d="M0 20C0 15.5817 3.58172 12 8 12H72C76.4183 12 80 15.5817 80 20V56C80 60.4183 76.4183 64 72 64H8C3.58172 64 0 60.4183 0 56V20Z" fill="#7FC8F5"/>
              </svg>
            </div>
            {renamingItem === folder.id ? (
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => setRenamingItem(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setRenamingItem(null);
                  }
                  if (e.key === 'Escape') {
                    setRenamingItem(null);
                  }
                }}
                className="px-2 py-1 text-sm border border-blue-400 rounded text-center"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm text-gray-700 text-center max-w-[100px] truncate">
                {folder.name}
              </span>
            )}
          </div>
        ))}
        
        {/* Files */}
        {files.map(file => (
          <div
            key={file.id}
            className={`flex flex-col items-center cursor-pointer p-3 rounded-lg hover:bg-gray-100 transition-colors ${
              selectedItem === file.id ? 'bg-blue-100' : ''
            }`}
            onClick={() => {
              setSelectedItem(file.id);
              onProjectSelect(file.projectId!);
            }}
            onDragStart={(e) => handleDragStart(e, file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
            draggable
          >
            <div className="mb-2">
              <svg width="56" height="72" viewBox="0 0 56 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 8C0 3.58172 3.58172 0 8 0H36L56 20V64C56 68.4183 52.4183 72 48 72H8C3.58172 72 0 68.4183 0 64V8Z" fill="#E5E7EB"/>
                <path d="M36 0L56 20H44C39.5817 20 36 16.4183 36 12V0Z" fill="#D1D5DB"/>
                <rect x="10" y="32" width="36" height="2" rx="1" fill="#6B7280"/>
                <rect x="10" y="40" width="36" height="2" rx="1" fill="#6B7280"/>
                <rect x="10" y="48" width="24" height="2" rx="1" fill="#6B7280"/>
              </svg>
            </div>
            {renamingItem === file.id ? (
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => setRenamingItem(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setRenamingItem(null);
                  }
                  if (e.key === 'Escape') {
                    setRenamingItem(null);
                  }
                }}
                className="px-2 py-1 text-sm border border-blue-400 rounded text-center"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm text-gray-700 text-center max-w-[100px] truncate">
                {file.name}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="relative bg-gray-50 border-b border-gray-200">
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-100">
        <h3 className="text-xs font-medium text-gray-700">Projects</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              queryCache.delete(`projects-${walletAddress}`);
              fetchProjects();
            }}
            className={`p-0.5 hover:bg-gray-100 rounded ${loading ? 'animate-spin' : ''}`}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => handleCreateFolder('root')}
            className="p-0.5 hover:bg-gray-100 rounded"
            title="New Folder"
          >
            <FolderPlus size={12} />
          </button>
        </div>
      </div>
      
      <div className="flex items-start justify-center py-4 px-2 overflow-x-auto">
        {renderFolderGrid()}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.item.type === 'folder' && (
            <button
              onClick={() => handleCreateFolder(contextMenu.item.id)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 w-full text-left text-sm"
            >
              <FolderPlus size={14} />
              New Folder
            </button>
          )}
          <button
            onClick={() => handleRename(contextMenu.item)}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 w-full text-left text-sm"
          >
            <Edit2 size={14} />
            Rename
          </button>
          {contextMenu.item.id !== 'root' && (
            <button
              onClick={() => handleDelete(contextMenu.item)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 w-full text-left text-sm text-red-600"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
