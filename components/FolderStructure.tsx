import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, Suspense } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderPlus, FileText, MoreVertical, Trash2, Edit2, RefreshCw, Loader2 } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { getUserFolderStructure } from '../lib/clayStorageService';
import { queryCache } from '../lib/queryCache';
import { getLocalFolders, addLocalFolder, removeLocalFolder, renameLocalFolder } from '../lib/localFolderService';
import { uploadFolderStructure, downloadFolderStructure, syncFolderStructure } from '../lib/folderUploadService';
import { usePopup } from './PopupNotification';
import { AnimatedClayLogo } from './AnimatedClayLogo';

interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FolderNode[];
  projectId?: string; // For files - actual project ID (clay-xxx format)
  transactionId?: string; // For files - transaction ID for opening projects
  tags?: Record<string, string>; // For files
}

interface FolderStructureProps {
  walletAddress: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectMove: (projectId: string, folderPath: string) => void;
  onProjectDelete: (projectId: string) => void;
  onFolderCreate: (folderPath: string) => void;
  onFolderDelete: (folderPath: string) => Promise<void>;
  onProjectRename: (projectId: string, newName: string) => void;
  onAddToLibrary?: (projectId: string) => void;
  onRemoveFromLibrary?: (projectId: string) => void;
  onListOnMarketplace?: (projectId: string, projectName: string) => void;
  currentFolder: string;
  onFolderChange?: (folderPath: string) => void;
}

export interface FolderStructureHandle {
  refreshProjects: () => void;
}

const FolderStructure = forwardRef<FolderStructureHandle, FolderStructureProps>(({ 
  walletAddress, 
  onProjectSelect, 
  onProjectMove,
  onProjectDelete,
  onFolderCreate,
  onFolderDelete,
  onProjectRename,
  onAddToLibrary,
  onRemoveFromLibrary,
  onListOnMarketplace,
  currentFolder,
  onFolderChange
}, ref) => {
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
  const [uploadingFolders, setUploadingFolders] = useState<Set<string>>(new Set());
  const [pendingFolders, setPendingFolders] = useState<Set<string>>(new Set());
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const { showPopup } = usePopup();
  const [projects, setProjects] = useState<Array<{
    id: string;
    projectId: string;
    name: string;
    folderPath: string;
    timestamp: number;
  }>>([]);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [currentPath, setCurrentPath] = useState<string>('root');
  
  // Notify parent when folder changes
  useEffect(() => {
    if (onFolderChange) {
      onFolderChange(currentPath === 'root' ? '' : currentPath);
    }
  }, [currentPath, onFolderChange]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalParentId, setFolderModalParentId] = useState<string>('');
  const [folderModalName, setFolderModalName] = useState('');

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
  }, [walletAddress, forceUpdate]);
  
  // Expose refresh method to parent components
  useImperativeHandle(ref, () => ({
    refreshProjects: () => {
      queryCache.delete(`projects-${walletAddress}`);
      setForceUpdate(prev => prev + 1);
    }
  }), [walletAddress]);

  // Build folder tree from projects and local folders
  // Load and sync folder structure from blockchain
  const loadAndSyncFolders = async () => {
    if (!walletAddress) return;
    
    try {
      // First sync with blockchain
      await syncFolderStructure(walletAddress);
      
      // Then download folder structure
      const cloudFolders = await downloadFolderStructure(walletAddress);
      
      // Merge with local folders
      const localFolders = getLocalFolders(walletAddress);
      const allFolders = new Set([...cloudFolders, ...localFolders]);
      
      // Update local storage with merged folders
      allFolders.forEach(folder => addLocalFolder(walletAddress, folder));
      
      // Clear pending folders that are now confirmed
      setPendingFolders(new Set());
    } catch (error) {
      console.error('Failed to sync folder structure:', error);
    }
  };

  useEffect(() => {
    loadAndSyncFolders();
  }, [walletAddress]);

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
        id: project.projectId || project.id, // Use actual project ID as node ID
        name: project.name,
        type: 'file',
        projectId: project.projectId || project.id, // Actual project ID for deletion
        transactionId: project.id // Transaction ID for opening projects
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

  // Navigate into a folder
  const navigateToFolder = (folderId: string) => {
    // folderId is already the full path from root
    console.log('Navigating to folder:', folderId);
    setCurrentPath(folderId);
  };

  // Navigate to parent folder
  const navigateToParent = () => {
    if (currentPath === 'root') return;
    
    // Find parent folder path
    const pathParts = currentPath.split('/');
    pathParts.pop();
    const parentPath = pathParts.length > 0 ? pathParts.join('/') : 'root';
    setCurrentPath(parentPath);
  };

  // Get current folder node
  const getCurrentFolderNode = (): FolderNode => {
    if (currentPath === 'root') return folderTree;
    
    const pathParts = currentPath.split('/');
    let currentNode = folderTree;
    
    console.log('getCurrentFolderNode - currentPath:', currentPath, 'pathParts:', pathParts);
    
    // For multi-level paths, we need to traverse from root
    let accumulatedPath = '';
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      
      console.log('Looking for child with id:', accumulatedPath, 'in node:', currentNode);
      console.log('Available children:', currentNode.children?.map(c => ({ id: c.id, name: c.name })));
      
      const found = currentNode.children?.find(child => child.id === accumulatedPath);
      console.log('Found:', found);
      
      if (found && found.type === 'folder') {
        currentNode = found;
        // Ensure the folder has children array
        if (!currentNode.children) {
          currentNode.children = [];
        }
      } else {
        console.log('Could not find folder:', accumulatedPath);
        break;
      }
    }
    
    console.log('Final currentNode:', currentNode);
    return currentNode;
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

  const handleCreateFolder = async (parentId: string) => {
    setFolderModalParentId(parentId);
    setFolderModalName('');
    setShowFolderModal(true);
    setContextMenu(null);
  };

  const handleCreateFolderConfirm = async () => {
    const folderName = folderModalName.trim();
    const parentId = folderModalParentId;
    
    if (folderName && walletAddress) {
      const path = parentId === 'root' ? folderName : `${parentId}/${folderName}`;
      
      // Save to local storage immediately
      addLocalFolder(walletAddress, path);
      
      // Mark folder as uploading
      setUploadingFolders(prev => new Set(prev).add(path));
      
      onFolderCreate(path);
      
      // Force re-render to show new folder immediately
      setForceUpdate(prev => prev + 1);
      
      try {
        // Get all folders and upload to blockchain
        const allFolders = getLocalFolders(walletAddress);
        await uploadFolderStructure(walletAddress, allFolders, (status) => {
          if (status === 'verifying') {
            // Move from uploading to pending
            setUploadingFolders(prev => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
            setPendingFolders(prev => new Set(prev).add(path));
          } else if (status === 'complete') {
            // Remove from pending
            setPendingFolders(prev => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
            showPopup('Folder created successfully', 'success');
          } else if (status === 'error') {
            setUploadingFolders(prev => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
            showPopup('Failed to save folder to cloud', 'error');
          }
        });
      } catch (error) {
        console.error('Failed to upload folder structure:', error);
        setUploadingFolders(prev => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
      
      // Close modal
      setShowFolderModal(false);
      setFolderModalName('');
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<FolderNode | null>(null);

  const handleDelete = async (item: FolderNode) => {
    setDeleteItem(item);
    setShowDeleteModal(true);
    setContextMenu(null);
  };

  const handleDeleteConfirm = async () => {
    if (deleteItem && walletAddress) {
      const item = deleteItem;
      if (item.type === 'folder' && walletAddress) {
        // Mark folder and its contents as deleting
        setDeletingItems(prev => new Set(prev).add(item.id));
        
        // Close modal immediately
        setShowDeleteModal(false);
        setDeleteItem(null);
        
        try {
          // Call the delete handler which will delete all contents
          await onFolderDelete(item.id);
          
          // All project deletions uploaded, now update folder structure
          showPopup('Folder contents deleted, updating structure...', 'info');
          
          // Remove from local storage only after successful deletion
          removeLocalFolder(walletAddress, item.id);
          
          // Upload updated folder structure
          const allFolders = getLocalFolders(walletAddress);
          await uploadFolderStructure(walletAddress, allFolders, (status) => {
            if (status === 'complete') {
              showPopup('Folder structure updated, refreshing...', 'success');
            } else if (status === 'error') {
              // Re-add to local storage on error
              addLocalFolder(walletAddress, item.id);
              throw new Error('Failed to update folder structure');
            }
          });
          
          // Clear cache and refresh
          queryCache.delete(`projects-${walletAddress}`);
          await fetchProjects();
          
          // Force re-render
          setForceUpdate(prev => prev + 1);
          
          // Remove from deleting state after everything succeeds
          setDeletingItems(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        } catch (error) {
          console.error('Failed to delete folder:', error);
          setDeletingItems(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          showPopup('Failed to delete folder', 'error');
        }
      } else if (item.type === 'file' && item.projectId) {
        // Mark as deleting
        setDeletingItems(prev => new Set(prev).add(item.projectId!));
        
        // Close modal immediately
        setShowDeleteModal(false);
        setDeleteItem(null);
        
        try {
          // Wait for deletion marker upload to complete
          await onProjectDelete(item.projectId);
          
          // Upload completed, show success
          showPopup(`${item.name} deletion uploaded, refreshing...`, 'success');
          
          // Clear cache and refresh
          queryCache.delete(`projects-${walletAddress}`);
          
          // Keep showing loading state while querying
          await fetchProjects();
          
          // Remove from deleting state after query succeeds
          setDeletingItems(prev => {
            const next = new Set(prev);
            next.delete(item.projectId!);
            return next;
          });
        } catch (error) {
          // Remove from deleting state on error
          setDeletingItems(prev => {
            const next = new Set(prev);
            next.delete(item.projectId!);
            return next;
          });
          showPopup('Failed to delete project', 'error');
        }
      }
    }
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
    const isUploading = uploadingFolders.has(node.id);
    const isPending = pendingFolders.has(node.id);
    const isDeleting = deletingItems.has(node.type === 'file' ? node.projectId || node.id : node.id);

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1 hover:bg-gray-100 cursor-pointer select-none ${
            isSelected ? 'bg-blue-100' : ''
          } ${isDragOver ? 'bg-blue-50 border-2 border-blue-300' : ''} ${
            isUploading || isPending ? 'opacity-60' : ''
          } ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.id);
            } else {
              setSelectedItem(node.id);
              onProjectSelect(node.transactionId || node.id); // Use transaction ID for opening projects
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
              {isUploading ? (
                <Loader2 size={14} className="text-blue-500 flex-shrink-0 animate-spin" />
              ) : (
                <Folder size={14} className="text-blue-500 flex-shrink-0" />
              )}
            </>
          )}
          {node.type === 'file' && (
            <svg width="12" height="16" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
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
            <>
              <span className="text-sm truncate" title={node.name}>{node.name}</span>
              {isDeleting && (
                <span className="ml-auto text-xs text-gray-500">Deleting...</span>
              )}
            </>
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
    const currentNode = getCurrentFolderNode();
    const folders = currentNode.children?.filter(item => item.type === 'folder') || [];
    const files = currentNode.children?.filter(item => item.type === 'file') || [];
    
    // Show empty state if no files or folders
    const isEmpty = folders.length === 0 && files.length === 0 && currentPath === 'root';
    
    if (isEmpty) {
      return null; // Empty state handled in parent
    }
    
    return (
      <div className="flex gap-3 min-w-max px-2">
        {/* Parent folder navigation (if not in root) */}
        {currentPath !== 'root' && (
          <div
            className="flex flex-col items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={navigateToParent}
          >
            <div className="mb-1">
              <svg width="36" height="29" viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 8C0 3.58172 3.58172 0 8 0H26.7639C28.5215 0 30.2135 0.632141 31.5279 1.78885L35.7082 5.57771C37.0226 6.73442 38.7146 7.36656 40.4721 7.36656H72C76.4183 7.36656 80 10.9483 80 15.3666V56C80 60.4183 76.4183 64 72 64H8C3.58172 64 0 60.4183 0 56V8Z" fill="#9CA3AF"/>
                <path d="M0 20C0 15.5817 3.58172 12 8 12H72C76.4183 12 80 15.5817 80 20V56C80 60.4183 76.4183 64 72 64H8C3.58172 64 0 60.4183 0 56V20Z" fill="#D1D5DB"/>
                <text x="40" y="40" textAnchor="middle" fontSize="20" fill="#4B5563">...</text>
              </svg>
            </div>
            <span className="text-xs text-gray-700 text-center w-16 truncate">...</span>
          </div>
        )}
        
        {/* Folders */}
        {folders.map(folder => (
          <div
            key={folder.id}
            className={`flex flex-col items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors ${
              selectedItem === folder.id ? 'bg-blue-100' : ''
            } ${dragOverFolder === folder.id ? 'bg-blue-50 ring-2 ring-blue-300' : ''}`}
            onClick={() => {
              setSelectedItem(folder.id);
              navigateToFolder(folder.id);
            }}
            onDragOver={(e) => handleDragOver(e, folder)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder)}
            onContextMenu={(e) => handleContextMenu(e, folder)}
          >
            <div className="mb-1">
              <svg width="36" height="29" viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                className="px-1 py-0.5 text-xs border border-blue-400 rounded text-center"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs text-gray-700 text-center w-16 truncate" title={folder.name}>
                {folder.name}
              </span>
            )}
          </div>
        ))}
        
        {/* Files */}
        {files.map(file => (
          <div
            key={file.id}
            className={`flex flex-col items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors ${
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
            <div className="mb-1">
              <svg width="26" height="33" viewBox="0 0 56 72" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                onBlur={() => {
                  if (newName && newName !== file.name && file.projectId) {
                    onProjectRename(file.projectId, newName);
                  }
                  setRenamingItem(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (newName && newName !== file.name && file.projectId) {
                      onProjectRename(file.projectId, newName);
                    }
                    setRenamingItem(null);
                  }
                  if (e.key === 'Escape') {
                    setRenamingItem(null);
                    setNewName(file.name);
                  }
                }}
                className="px-1 py-0.5 text-xs border border-blue-400 rounded text-center"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs text-gray-700 text-center w-16 truncate" title={file.name}>
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
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        {/* Home Logo and Breadcrumb navigation */}
        <div className="flex items-center gap-3 text-sm text-gray-700">
          {/* Home Logo */}
          <button
            onClick={() => window.location.href = '/'}
            className="block hover:opacity-80 transition-opacity flex-shrink-0"
            title="Home"
          >
            <div className="w-8 h-8">
              <Canvas
                camera={{ position: [0, 0, 2], fov: 50 }}
                style={{ background: 'transparent' }}
              >
                <Suspense fallback={null}>
                  <ambientLight intensity={0.5} />
                  <directionalLight position={[5, 5, 5]} intensity={0.5} />
                  <AnimatedClayLogo />
                </Suspense>
              </Canvas>
            </div>
          </button>
          
          {/* Breadcrumb */}
          <button
            onClick={() => setCurrentPath('root')}
            className={`hover:text-blue-600 cursor-pointer ${currentPath === 'root' ? 'font-medium' : ''}`}
          >
            My Projects
          </button>
          {currentPath !== 'root' && currentPath.split('/').map((part, index, arr) => {
            const path = arr.slice(0, index + 1).join('/');
            // Find the folder node by traversing the tree
            let node = folderTree;
            let folderName = part;
            for (let i = 0; i <= index; i++) {
              const found = node.children?.find(c => c.id === arr[i]);
              if (found && found.type === 'folder') {
                node = found;
                if (i === index) {
                  folderName = found.name;
                }
              }
            }
            const isLast = index === arr.length - 1;
            return (
              <React.Fragment key={path}>
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => setCurrentPath(path)}
                  className={`hover:text-blue-600 cursor-pointer ${isLast ? 'font-medium' : ''}`}
                >
                  {folderName}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              queryCache.delete(`projects-${walletAddress}`);
              fetchProjects();
            }}
            className={`p-1 hover:bg-gray-100 rounded ${loading ? 'animate-spin' : ''}`}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => handleCreateFolder(currentPath)}
            className="p-1 hover:bg-gray-100 rounded"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        {(() => {
          const currentNode = getCurrentFolderNode();
          const folders = currentNode.children?.filter(item => item.type === 'folder') || [];
          const files = currentNode.children?.filter(item => item.type === 'file') || [];
          const isEmpty = folders.length === 0 && files.length === 0 && currentPath === 'root';
          
          if (isEmpty) {
            return (
              <div className="flex justify-center items-center h-16 w-full">
                <p className="text-xs text-gray-400">No files or folders</p>
              </div>
            );
          }
          
          return (
            <div className="inline-flex items-start py-4 min-w-0">
              {renderFolderGrid()}
            </div>
          );
        })()}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200/80 rounded-xl shadow-2xl py-1.5 z-50"
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
          {contextMenu.item.type === 'file' && onAddToLibrary && contextMenu.item.projectId && (
            <button
              onClick={() => {
                onAddToLibrary(contextMenu.item.projectId!);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 w-full text-left text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              Add to Library
            </button>
          )}
          {contextMenu.item.type === 'file' && onListOnMarketplace && contextMenu.item.projectId && (
            <button
              onClick={() => {
                onListOnMarketplace(contextMenu.item.projectId!, contextMenu.item.name);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 w-full text-left text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              List on Marketplace
            </button>
          )}
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
      
      {/* Create Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200/80 w-full max-w-md overflow-hidden pointer-events-auto">
            <div className="absolute left-0 top-0 bottom-0 w-1 border-l-4 border-l-gray-400" />
            <div className="p-6 pl-7">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">New Folder</h3>
                  <p className="text-sm text-gray-600 mb-4">Enter a name for your new folder</p>
                  <input
                    type="text"
                    value={folderModalName}
                    onChange={(e) => setFolderModalName(e.target.value)}
                    placeholder="Enter folder name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && folderModalName.trim()) {
                        handleCreateFolderConfirm();
                      } else if (e.key === 'Escape') {
                        setShowFolderModal(false);
                        setFolderModalName('');
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowFolderModal(false);
                    setFolderModalName('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolderConfirm}
                  disabled={!folderModalName.trim()}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteItem && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200/80 w-full max-w-md overflow-hidden pointer-events-auto">
            <div className="absolute left-0 top-0 bottom-0 w-1 border-l-4 border-l-red-500" />
            <div className="p-6 pl-7">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Delete {deleteItem.type === 'folder' ? 'Folder' : 'File'}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Delete "{deleteItem.name}"?
                    {deleteItem.type === 'folder' && ' This will also delete all contents inside.'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteItem(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FolderStructure.displayName = 'FolderStructure';

export default FolderStructure;
