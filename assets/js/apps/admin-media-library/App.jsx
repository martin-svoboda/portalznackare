import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import FileGrid from '../../components/shared/media/FileGrid.jsx';
import FolderList from '../../components/shared/media/FolderList.jsx';
import UnifiedImageModal from '../../components/shared/UnifiedImageModal.jsx';
import Loader from '../../components/shared/Loader.jsx';
import { createDebugLogger } from '../../utils/debug.js';
import { IconSearch, IconFilter, IconRefresh } from '@tabler/icons-react';

const logger = createDebugLogger('MediaLibraryAdmin');

export default function MediaLibraryAdmin() {
    // State
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        usage: 'all', // all | used | unused
        type: 'all',  // all | images | pdfs | documents
        search: ''
    });

    // Modal state
    const [selectedFile, setSelectedFile] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('preview'); // preview | edit

    // Load folders on mount
    useEffect(() => {
        logger.lifecycle('Component mounted');
        loadFolders();
    }, []);

    // Load files when folder or filters change
    useEffect(() => {
        loadFiles();
    }, [selectedFolder, filters]);

    // Load folders from API
    const loadFolders = async () => {
        try {
            logger.api('GET', '/api/portal/files/folders');
            const response = await fetch('/api/portal/files/folders');
            const data = await response.json();

            if (data.success) {
                logger.custom('Loaded folders', data.folders);
                setFolders(data.folders);
            } else {
                logger.error('Failed to load folders', data.error);
            }
        } catch (error) {
            logger.error('Error loading folders', error);
        }
    };

    // Load files from API
    const loadFiles = async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            if (selectedFolder) params.append('folder', selectedFolder);
            if (filters.usage !== 'all') params.append('usage', filters.usage);
            if (filters.type !== 'all') params.append('type', filters.type);
            if (filters.search) params.append('search', filters.search);

            logger.api('GET', `/api/portal/files/library?${params}`);
            const response = await fetch(`/api/portal/files/library?${params}`);
            const data = await response.json();

            if (data.success) {
                logger.custom('Loaded files', { count: data.files.length });
                setFiles(data.files);
            } else {
                logger.error('Failed to load files', data.error);
            }
        } catch (error) {
            logger.error('Error loading files', error);
        } finally {
            setLoading(false);
        }
    };

    // Refresh data
    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadFolders(), loadFiles()]);
        setRefreshing(false);
        logger.lifecycle('Data refreshed');
    };

    // Handle folder selection
    const handleFolderSelect = (folderName) => {
        logger.state('selectedFolder', selectedFolder, folderName);
        setSelectedFolder(folderName);
    };

    // Handle filter change
    const handleFilterChange = (filterName, value) => {
        logger.state(`filter.${filterName}`, filters[filterName], value);
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    // Handle preview
    const handlePreview = (file) => {
        logger.lifecycle('Opening preview', { fileId: file.id, fileName: file.fileName });
        setSelectedFile(file);
        setModalMode('preview');
        setModalOpen(true);
    };

    // Handle edit
    const handleEdit = (file) => {
        logger.lifecycle('Opening editor', { fileId: file.id, fileName: file.fileName });
        setSelectedFile(file);
        setModalMode('edit');
        setModalOpen(true);
    };

    // Handle copy URL
    const handleCopyUrl = async (file) => {
        try {
            await navigator.clipboard.writeText(window.location.origin + file.url);
            logger.lifecycle('URL copied', { fileId: file.id, url: file.url });
            // TODO: Show toast notification
            alert('URL zkopírována do schránky');
        } catch (error) {
            logger.error('Failed to copy URL', error);
            alert('Nepodařilo se zkopírovat URL');
        }
    };

    // Handle delete
    const handleDelete = async (file) => {
        if (!confirm(`Opravdu chcete smazat soubor "${file.fileName}"?`)) {
            return;
        }

        try {
            logger.api('DELETE', `/api/portal/files/${file.id}`);
            const response = await fetch(`/api/portal/files/${file.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: true }) // Admin override
            });

            const data = await response.json();

            if (data.success) {
                logger.lifecycle('File deleted', { fileId: file.id });
                // Reload files
                await loadFiles();
                // TODO: Show toast notification
                alert(data.message || 'Soubor byl smazán');
            } else {
                logger.error('Failed to delete file', data.error);
                alert(data.error || 'Nepodařilo se smazat soubor');
            }
        } catch (error) {
            logger.error('Error deleting file', error);
            alert('Chyba při mazání souboru');
        }
    };

    // Handle modal close
    const handleModalClose = () => {
        setModalOpen(false);
        setSelectedFile(null);
        setModalMode('preview');
    };

    // Handle file save from editor
    const handleFileSave = async (editedFile) => {
        logger.lifecycle('File saved from editor', { fileId: editedFile.id });
        setModalOpen(false);
        await loadFiles(); // Reload to get updated file
    };

    return (
        <div className="page">
            <div className="page__header">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Správa médií
                    </h1>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <IconRefresh size={18} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Načítám...' : 'Obnovit'}
                    </button>
                </div>
            </div>

            <div className="page__content">
                <div className="grid grid-cols-12 gap-4">
                    {/* Sidebar - Folders */}
                    <div className="col-span-12 md:col-span-3 lg:col-span-2">
                        <div className="card p-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                Složky
                            </h2>
                            <FolderList
                                folders={folders}
                                selectedFolder={selectedFolder}
                                onFolderSelect={handleFolderSelect}
                                showCounts={true}
                            />

                            {/* Usage filter */}
                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Použití
                                </h3>
                                <div className="space-y-1">
                                    {[
                                        { value: 'all', label: 'Všechny' },
                                        { value: 'used', label: 'Použité' },
                                        { value: 'unused', label: 'Nepoužité' }
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleFilterChange('usage', option.value)}
                                            className={`
                                                w-full text-left px-3 py-1.5 text-sm rounded
                                                ${filters.usage === option.value
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                }
                                            `}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main area - Files */}
                    <div className="col-span-12 md:col-span-9 lg:col-span-10">
                        <div className="card p-4">
                            {/* Filters bar */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                {/* Search */}
                                <div className="flex-1 relative">
                                    <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Hledat soubory..."
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Type filter */}
                                <div className="sm:w-48">
                                    <select
                                        value={filters.type}
                                        onChange={(e) => handleFilterChange('type', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">Všechny typy</option>
                                        <option value="images">Obrázky</option>
                                        <option value="pdfs">PDF</option>
                                        <option value="documents">Dokumenty</option>
                                    </select>
                                </div>
                            </div>

                            {/* Files count */}
                            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                                {loading ? 'Načítám...' : `Zobrazeno ${files.length} souborů`}
                            </div>

                            {/* Files grid */}
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader />
                                </div>
                            ) : files.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    Žádné soubory
                                </div>
                            ) : (
                                <FileGrid
                                    files={files}
                                    onPreview={handlePreview}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onCopyUrl={handleCopyUrl}
                                    gridCols={4}
                                    showActions={true}
                                    actionsMode="inline"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            {selectedFile && modalOpen && (
                <UnifiedImageModal
                    isOpen={modalOpen}
                    onClose={handleModalClose}
                    file={selectedFile}
                    mode={modalMode}
                    onSave={handleFileSave}
                />
            )}
        </div>
    );
}
