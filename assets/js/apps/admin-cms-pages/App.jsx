import React, {useState, useEffect, useMemo, createContext, useContext} from 'react';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable,
} from '@tanstack/react-table';
import {
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {restrictToVerticalAxis} from '@dnd-kit/modifiers';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {
    IconEdit,
    IconTrash,
    IconEye,
    IconRestore,
    IconPlus,
    IconCheck,
    IconX,
    IconGripVertical
} from '@tabler/icons-react';
import {createDebugLogger} from '@utils/debug';

const logger = createDebugLogger('AdminCmsPages');

const columnHelper = createColumnHelper();

// Context for passing drag handle props
const DragHandleContext = createContext(null);

// Helper: Flatten tree structure with depth information
function flattenTree(pages, depth = 0) {
    const result = [];

    for (const page of pages) {
        result.push({...page, depth});

        if (page.children && page.children.length > 0) {
            result.push(...flattenTree(page.children, depth + 1));
        }
    }

    return result;
}

// DraggableRow component
const DraggableRow = ({row, children}) => {
    const {transform, transition, setNodeRef, isDragging, attributes, listeners} = useSortable({
        id: row.original.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 1 : 0,
        position: 'relative',
    };

    return (
        <DragHandleContext.Provider value={{attributes, listeners}}>
            <tr ref={setNodeRef} style={style} className={row.original.status === 'deleted' ? 'opacity-50' : ''}>
                {children}
            </tr>
        </DragHandleContext.Provider>
    );
};

// DragHandle component
const DragHandle = () => {
    const dragHandleProps = useContext(DragHandleContext);

    if (!dragHandleProps) return null;

    const {attributes, listeners} = dragHandleProps;

    return (
        <button
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            {...attributes}
            {...listeners}
        >
            <IconGripVertical size={16} className="text-gray-400"/>
        </button>
    );
};

// Editable Sort Order Cell
const EditableSortOrderCell = ({getValue, row, column, table}) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);

    // Sync with external changes
    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const onChange = (e) => {
        setValue(e.target.value);
    };

    const onBlur = () => {
        table.options.meta?.updateData(row.index, column.id, parseInt(value));
    };

    return (
        <input
            type="number"
            value={value ?? 0}
            onChange={onChange}
            onBlur={onBlur}
            className="form__input form__input--sm w-16 text-center"
            min="0"
        />
    );
};

function App() {
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [columnFilters, setColumnFilters] = useState([]);
    const [contentTypes, setContentTypes] = useState([]);

    // Fetch pages from API (tree structure)
    const fetchPages = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/admin/api/cms/pages`);
            const data = await response.json();

            // Build tree structure from flat data
            const pageMap = new Map();
            const rootPages = [];

            // First pass: create map
            data.forEach(page => {
                pageMap.set(page.id, {...page, children: []});
            });

            // Second pass: build tree
            data.forEach(page => {
                const pageWithChildren = pageMap.get(page.id);
                if (page.parent_id && pageMap.has(page.parent_id)) {
                    pageMap.get(page.parent_id).children.push(pageWithChildren);
                } else {
                    rootPages.push(pageWithChildren);
                }
            });

            // Sort by sort_order at each level
            const sortPages = (pages) => {
                pages.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                pages.forEach(page => {
                    if (page.children.length > 0) {
                        sortPages(page.children);
                    }
                });
            };
            sortPages(rootPages);

            // Flatten tree with depth
            const flatPages = flattenTree(rootPages);
            setPages(flatPages);

            logger.api('GET', '/admin/api/cms/pages', {}, flatPages);
        } catch (error) {
            logger.error('Failed to fetch pages', error);
            console.error('Failed to fetch pages:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPages();
    }, []);

    // Load content types
    useEffect(() => {
        fetch('/admin/api/cms/content-types')
            .then(res => res.json())
            .then(types => {
                setContentTypes(types);
                logger.lifecycle('Content types loaded', {types});
            })
            .catch(error => {
                logger.error('Failed to load content types', error);
            });
    }, []);

    // Delete page
    const handleDelete = async (pageId) => {
        if (!confirm('Opravdu chcete smazat tuto stránku?')) return;

        try {
            const response = await fetch(`/admin/api/cms/pages/${pageId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchPages();
                logger.lifecycle('Page deleted', {pageId});
            }
        } catch (error) {
            logger.error('Failed to delete page', error);
            console.error('Failed to delete page:', error);
        }
    };

    // Restore page
    const handleRestore = async (pageId) => {
        try {
            const response = await fetch(`/admin/api/cms/pages/${pageId}/restore`, {
                method: 'PATCH',
            });

            if (response.ok) {
                fetchPages();
                logger.lifecycle('Page restored', {pageId});
            }
        } catch (error) {
            logger.error('Failed to restore page', error);
            console.error('Failed to restore page:', error);
        }
    };

    // Publish/Archive toggle
    const handleStatusToggle = async (page) => {
        const endpoint = page.status === 'published' ? 'archive' : 'publish';

        try {
            const response = await fetch(`/admin/api/cms/pages/${page.id}/${endpoint}`, {
                method: 'PATCH',
            });

            if (response.ok) {
                fetchPages();
                logger.lifecycle(`Page ${endpoint}d`, {pageId: page.id});
            }
        } catch (error) {
            logger.error(`Failed to ${endpoint} page`, error);
            console.error(`Failed to ${endpoint} page:`, error);
        }
    };

    // Update sort order (called from editable cell onBlur)
    const handleSortOrderChange = async (pageId, newSortOrder) => {
        const payload = {sort_order: parseInt(newSortOrder)};
        logger.api('PATCH', `/admin/api/cms/pages/${pageId}/sort-order`, payload);

        try {
            const response = await fetch(`/admin/api/cms/pages/${pageId}/sort-order`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            logger.api('PATCH', `/admin/api/cms/pages/${pageId}/sort-order`, payload, data);

            if (response.ok) {
                fetchPages();
                logger.lifecycle('Sort order updated', {pageId, newSortOrder, responseData: data});
            } else {
                alert('Chyba při změně pořadí: ' + (data.error || 'Neznámá chyba'));
                logger.error('Failed to update sort order', data);
            }
        } catch (error) {
            logger.error('Failed to update sort order', error);
            alert('Chyba při změně pořadí: ' + error.message);
            console.error('Failed to update sort order:', error);
        }
    };

    // Handle drag end
    const handleDragEnd = async (event) => {
        const {active, over} = event;

        if (!over || active.id === over.id) return;

        const activeIndex = pages.findIndex(p => p.id === active.id);
        const overIndex = pages.findIndex(p => p.id === over.id);

        if (activeIndex === -1 || overIndex === -1) return;

        const activePage = pages[activeIndex];
        const overPage = pages[overIndex];

        // Only allow reordering within same parent
        if (activePage.parent_id !== overPage.parent_id) {
            alert('Můžete přesouvat pouze stránky na stejné úrovni (stejný parent)');
            return;
        }

        // Reorder locally for immediate feedback
        const newPages = arrayMove(pages, activeIndex, overIndex);
        setPages(newPages);

        // Update sort order on server
        await handleSortOrderChange(activePage.id, overPage.sort_order);
    };

    // DnD sensors
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {})
    );

    // Table columns
    const columns = useMemo(() => [
        columnHelper.accessor('id', {
            header: '',
            size: 20,
            enableColumnFilter: false,
            cell: info => <small>{info.getValue()}</small>,
        }),
        columnHelper.display({
            id: 'drag-handle',
            header: '',
            size: 40,
            cell: () => <DragHandle/>,
        }),
        columnHelper.accessor('sort_order', {
            header: 'Pořadí',
            size: 50,
            enableColumnFilter: false,
            cell: (props) => <EditableSortOrderCell {...props} />,
        }),

        columnHelper.accessor('title', {
            header: 'Název',
            size: 250,
            cell: info => {
                const depth = info.row.original.depth || 0;

                return (
                    <div className="flex flex-col">
                        <span
                            className="font-medium text-gray-900 dark:text-gray-100"
                            style={{paddingLeft: `${depth * 1.5}rem`}}
                        >
                            {depth > 0 && (
                                <span className="text-gray-400 dark:text-gray-600 mr-2">
                                    └─
                                </span>
                            )}
                            {info.getValue()}
                        </span>
                        <span
                            className="text-xs text-gray-500 dark:text-gray-400"
                            style={{paddingLeft: `${depth * 1.5}rem`}}
                        >
                            /{info.row.original.slug}
                        </span>
                    </div>
                );
            },
        }),
        columnHelper.accessor('content_type', {
            header: 'Typ',
            size: 100,
            cell: info => {
                const typeValue = info.getValue();
                const typeData = contentTypes.find(t => t.value === typeValue);
                const label = typeData?.label || typeValue;

                const colors = {
                    page: 'badge--primary',
                    metodika: 'badge--success',
                    napoveda: 'badge--info',
                };
                const className = colors[typeValue] || 'badge--gray';

                return <span className={`badge ${className}`}>{label}</span>;
            },
            filterFn: 'equals',
        }),
        columnHelper.accessor('status', {
            header: 'Stav',
            size: 100,
            cell: info => {
                const statuses = {
                    draft: {label: 'Koncept', className: 'badge--gray'},
                    published: {label: 'Publikováno', className: 'badge--success'},
                    archived: {label: 'Archivováno', className: 'badge--orange'},
                    deleted: {label: 'Smazáno', className: 'badge--danger'},
                };
                const status = statuses[info.getValue()] || statuses.draft;
                return <span className={`badge ${status.className}`}>{status.label}</span>;
            },
            filterFn: 'equals',
        }),
        columnHelper.accessor('updated_at', {
            header: 'Upraveno',
            size: 100,
            enableColumnFilter: false,
            cell: info => new Date(info.getValue()).toLocaleString('cs-CZ'),
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Akce',
            size: 200,
            cell: info => {
                const page = info.row.original;
                const isDeleted = page.status === 'deleted';

                if (isDeleted) {
                    return (
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleRestore(page.id)}
                                className="btn btn--sm btn--success"
                                title="Obnovit"
                            >
                                <IconRestore size={16}/>
                            </button>
                        </div>
                    );
                }

                return (
                    <div className="flex gap-2">
                        <button
                            onClick={() => window.location.href = page.url_path || `/${page.slug}`}
                            className="btn btn--sm btn--secondary"
                            title="Zobrazit"
                        >
                            <IconEye size={16}/>
                        </button>
                        <a
                            href={`/admin/cms/edit/${page.id}`}
                            className="btn btn--sm btn--primary"
                            title="Upravit"
                        >
                            <IconEdit size={16}/>
                        </a>
                        <button
                            onClick={() => handleStatusToggle(page)}
                            className={`btn btn--sm ${page.status === 'published' ? 'btn--warning' : 'btn--success'}`}
                            title={page.status === 'published' ? 'Archivovat' : 'Publikovat'}
                        >
                            {page.status === 'published' ? <IconX size={16}/> : <IconCheck size={16}/>}
                        </button>
                        <button
                            onClick={() => handleDelete(page.id)}
                            className="btn btn--sm btn--danger"
                            title="Smazat"
                        >
                            <IconTrash size={16}/>
                        </button>
                    </div>
                );
            },
        }),
    ], [contentTypes]);

    const table = useReactTable({
        data: pages,
        columns,
        state: {
            columnFilters,
        },
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getRowId: (row) => row.id,
        meta: {
            updateData: (rowIndex, columnId, value) => {
                logger.custom('updateData called', {rowIndex, columnId, value});

                // Get page ID before state update
                const pageId = pages[rowIndex]?.id;
                if (!pageId) {
                    logger.error('Page not found at rowIndex', {rowIndex, pagesLength: pages.length});
                    return;
                }

                // Optimistically update local state
                setPages(old =>
                    old.map((row, index) => {
                        if (index === rowIndex) {
                            return {
                                ...old[rowIndex],
                                [columnId]: value,
                            };
                        }
                        return row;
                    })
                );

                // Then update server
                if (columnId === 'sort_order') {
                    handleSortOrderChange(pageId, value);
                }
            },
        },
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-600 dark:text-gray-400">Načítání...</div>
            </div>
        );
    }

    return (
        <div>
            {/* Table with DnD */}
            <DndContext
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
                sensors={sensors}
            >
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <a
                            href="/admin/cms/edit"
                            className="btn btn--primary btn--sm"
                        >
                            <IconPlus size={16}/>
                            Nová stránka
                        </a>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            style={{width: header.getSize()}}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div>
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                                    {header.column.getCanFilter() && (
                                                        <div className="mt-1">
                                                            <Filter column={header.column}/>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                            </thead>
                            <tbody>
                            <SortableContext
                                items={pages.map(p => p.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {table.getRowModel().rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length} className="text-center py-8 text-gray-500">
                                            Žádné stránky nenalezeny
                                        </td>
                                    </tr>
                                ) : (
                                    table.getRowModel().rows.map(row => (
                                        <DraggableRow key={row.id} row={row}>
                                            {row.getVisibleCells().map(cell => (
                                                <td key={cell.id}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </DraggableRow>
                                    ))
                                )}
                            </SortableContext>
                            </tbody>
                        </table>
                    </div>

                    {/* Stats */}
                    <div
                        className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                        Celkem: {pages.length} stránek
                    </div>
                </div>
            </DndContext>
        </div>
    )
        ;
}

// Filter component
function Filter({column}) {
    const columnFilterValue = column.getFilterValue();

    // Render select for content_type and status
    if (column.id === 'content_type') {
        return (
            <select
                value={columnFilterValue ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                className="form__select form__select--sm w-full"
            >
                <option value="">Vše</option>
                <option value="page">Stránka</option>
                <option value="metodika">Metodika</option>
                <option value="napoveda">Nápověda</option>
            </select>
        );
    }

    if (column.id === 'status') {
        return (
            <select
                value={columnFilterValue ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                className="form__select form__select--sm w-full"
            >
                <option value="">Vše</option>
                <option value="draft">Koncept</option>
                <option value="published">Publikováno</option>
                <option value="archived">Archivováno</option>
                <option value="deleted">Smazáno</option>
            </select>
        );
    }

    // Default text filter
    return (
        <input
            type="text"
            value={columnFilterValue ?? ''}
            onChange={(e) => column.setFilterValue(e.target.value)}
            placeholder="Hledat..."
            className="form__input form__input--sm w-full"
        />
    );
}

export default App;
