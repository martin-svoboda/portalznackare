import React, {useState, useEffect} from 'react';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import {IconEye, IconRefresh} from '@tabler/icons-react';
import {StateBadge, getStateLabel} from '../../utils/stateBadge';
import {Loader} from "@components/shared";

const columnHelper = createColumnHelper();

const App = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    // Načítání dat
    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            const response = await fetch('/admin/api/reports');
            const data = await response.json();
            setReports(data);
        } catch (error) {
            console.error('Chyba při načítání hlášení:', error);
        } finally {
            setLoading(false);
        }
    };

    // Definice sloupců
    const columns = [
        columnHelper.accessor('id', {
            header: 'ID',
            size: 80,
        }),
        columnHelper.accessor('cisloZp', {
            header: 'Číslo ZP',
            size: 120,
            filterFn: 'includesString',
        }),
        columnHelper.accessor('znackari', {
            header: 'Značkaři',
            size: 200,
            cell: info => {
                const znackari = info.getValue() || [];
                return znackari.map(z => z.Znackar || z.name).join(', ');
            },
            filterFn: 'includesString',
        }),
        columnHelper.accessor('state', {
            header: 'Stav',
            size: 100,
            cell: info => <StateBadge state={info.getValue()}/>,
            filterFn: (row, columnId, value) => {
                if (value === 'all') return true;
                return row.getValue(columnId) === value;
            },
        }),
        columnHelper.accessor('dateUpdated', {
            header: 'Datum aktualizace',
            size: 150,
            cell: info => {
                const date = info.getValue();
                return date ? new Date(date).toLocaleString('cs-CZ') : '-';
            },
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Akce',
            size: 100,
            cell: info => (
                <a
                    href={`/admin/hlaseni/${info.row.original.id}`}
                    className="btn btn--sm btn--primary"
                    title="Zobrazit detail"
                >
                    <IconEye size={16}/>
                    Detail
                </a>
            ),
        }),
    ];

    const table = useReactTable({
        data: reports,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    if (loading) {
        return (
            <div className="card">
                <Loader/>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}


            {/* Filtry */}
            <div className="card">
                <div className="card__content">
                    <div className="flex-layout flex-layout--between flex-layout--wrap">

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="form__label">Číslo ZP</label>
                                <input
                                    type="text"
                                    className="form__input"
                                    placeholder="Vyhledat podle čísla ZP..."
                                    value={table.getColumn('cisloZp')?.getFilterValue() ?? ''}
                                    onChange={e => table.getColumn('cisloZp')?.setFilterValue(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form__label">Značkaři</label>
                                <input
                                    type="text"
                                    className="form__input"
                                    placeholder="Vyhledat podle značkařů..."
                                    value={table.getColumn('znackari')?.getFilterValue() ?? ''}
                                    onChange={e => table.getColumn('znackari')?.setFilterValue(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form__label">Stav</label>
                                <select
                                    className="form__select"
                                    value={table.getColumn('state')?.getFilterValue() ?? 'all'}
                                    onChange={e => table.getColumn('state')?.setFilterValue(e.target.value === 'all' ? undefined : e.target.value)}
                                >
                                    <option value="all">Všechny stavy</option>
                                    <option value="draft">{getStateLabel('draft')}</option>
                                    <option value="send">{getStateLabel('send')}</option>
                                    <option value="submitted">{getStateLabel('submitted')}</option>
                                    <option value="approved">{getStateLabel('approved')}</option>
                                    <option value="rejected">{getStateLabel('rejected')}</option>
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={loadReports}
                            className="btn btn--secondary"
                            disabled={loading}
                        >
                            <IconRefresh size={16}/>
                            Obnovit
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabulka */}
            <div className="card">
                <div className="card__content">
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th key={header.id} style={{width: header.column.getSize()}}>
                                            {header.isPlaceholder ? null : (
                                                <div
                                                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    {{
                                                        asc: ' ↑',
                                                        desc: ' ↓',
                                                    }[header.column.getIsSorted()] ?? null}
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                            </thead>
                            <tbody>
                            {table.getRowModel().rows.map(row => (
                                <tr key={row.id}>
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {table.getRowModel().rows.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            Žádná hlášení nenalezena
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;