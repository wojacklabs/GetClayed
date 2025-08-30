import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderPlus, File, MoreVertical, Trash2, Edit2 } from 'lucide-react';

interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FolderNode[];
  projectId?: string; // For files
  tags?: Record<string, string>; // For files
}

interface FolderStructureProps {
  projects: Array<{ id: string; tags: Record<string, string> }>;
  onProjectSelect: (projectId: string) => void;
  onProjectMove: (projectId: string, folderPath: string) => void;
  onFolderCreate: (folderPath: string) => void;
  onFolderDelete: (folderPath: string) => void;
  currentFolder: string;
}

export default function FolderStructure({ 
  projects, 
  onProjectSelect, 
  onProjectMove,
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

  // Build folder tree from projects
  useEffect(() => {
    const tree: FolderNode = {
      id: 'root',
      name: 'My Projects',
      type: 'folder',
      children: []
    };

    const folderMap = new Map<string, FolderNode>();
    folderMap.set('root', tree);

    // Create all folders
    projects.forEach(project => {
      const folderPath = project.tags['Folder'] || '';
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
      const folderPath = project.tags['Folder'] || '';
      const parent = folderPath ? folderMap.get(folderPath) || tree : tree;
      
      parent.children!.push({
        id: project.id,
        name: project.tags['Name'] || project.id,
        type: 'file',
        projectId: project.id,
        tags: project.tags
      });
    });

    setFolderTree(tree);
  }, [projects]);

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
      onFolderCreate(path);
    }
    setContextMenu(null);
  };

  const handleDelete = (item: FolderNode) => {
    if (confirm(`Delete ${item.name}?`)) {
      if (item.type === 'folder') {
        onFolderDelete(item.id);
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
              <Folder size={16} className="text-blue-600" />
            </>
          )}
          {node.type === 'file' && <File size={16} className="text-gray-600" />}
          
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

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="relative bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">Projects</h3>
        <button
          onClick={() => handleCreateFolder('root')}
          className="p-1 hover:bg-gray-100 rounded"
          title="New Folder"
        >
          <FolderPlus size={16} />
        </button>
      </div>
      
      <div className="max-h-60 overflow-y-auto">
        {renderNode(folderTree)}
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
