import React, { useState, useCallback, useMemo } from 'react';
import { JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { 
    IconSend, 
    IconDownload, 
    IconTrash,
    IconAlertTriangle,
    IconCheck,
    IconPlus,
    IconMinus,
    IconPackage
} from '@tabler/icons-react';

const App = ({ endpoints }) => {
    const [selectedEndpoint, setSelectedEndpoint] = useState('');
    const [params, setParams] = useState([{ key: '', value: '' }]);
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [batchLoading, setBatchLoading] = useState(false);
    const [error, setError] = useState(null);

    // Získat aktuální endpoint objekt
    const currentEndpoint = useMemo(() => {
        return endpoints.find(ep => ep.path === selectedEndpoint) || null;
    }, [selectedEndpoint, endpoints]);

    // Handler pro změnu endpointu
    const handleEndpointChange = useCallback((e) => {
        const value = e.target.value;
        setSelectedEndpoint(value);
        setParams([{ key: '', value: '' }]);
        setResponse(null);
        setError(null);
    }, []);

    // Přidat nový řádek parametrů
    const addParam = useCallback(() => {
        setParams(prev => [...prev, { key: '', value: '' }]);
    }, []);

    // Odstranit řádek parametrů
    const removeParam = useCallback((index) => {
        setParams(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Změnit parametr
    const updateParam = useCallback((index, field, value) => {
        setParams(prev => prev.map((param, i) => 
            i === index ? { ...param, [field]: value } : param
        ));
    }, []);

    // Převést parametry na JSON objekt
    const paramsToJson = useCallback(() => {
        const json = {};
        params.forEach(param => {
            if (param.key.trim()) {
                // Pokusit se parsovat hodnotu jako JSON, jinak použít jako string
                try {
                    json[param.key] = JSON.parse(param.value);
                } catch {
                    json[param.key] = param.value;
                }
            }
        });
        return json;
    }, [params]);

    // Odeslání požadavku
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!currentEndpoint) return;

        setLoading(true);
        setError(null);
        
        try {
            // Převést parametry na JSON
            const bodyData = paramsToJson();

            // Sestavit URL - nahradit path parametry hodnotami z JSON
            let url = currentEndpoint.path;
            const usedParams = [];
            
            const pathParams = url.match(/\{(\w+)\}/g);
            if (pathParams) {
                pathParams.forEach(param => {
                    const key = param.slice(1, -1); // odstranit {}
                    if (bodyData[key]) {
                        url = url.replace(param, bodyData[key]);
                        usedParams.push(key);
                    }
                });
            }

            // Pro GET requesty přidat zbývající parametry jako query parametry
            if (currentEndpoint.method === 'GET') {
                const queryParams = new URLSearchParams();
                
                Object.keys(bodyData).forEach(key => {
                    if (!usedParams.includes(key)) {
                        queryParams.append(key, bodyData[key]);
                    }
                });
                
                if (queryParams.toString()) {
                    url += url.includes('?') ? '&' + queryParams.toString() : '?' + queryParams.toString();
                }
            }

            // Přidat raw=1 parametr pro získání surových dat
            url += url.includes('?') ? '&raw=1' : '?raw=1';

            const options = {
                method: currentEndpoint.method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            if (currentEndpoint.method !== 'GET') {
                options.body = JSON.stringify(bodyData);
            }

            const res = await fetch(url, options);
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || `HTTP ${res.status}`);
            }
            
            setResponse(data);
            
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentEndpoint, paramsToJson]);

    // Export dat
    const handleExport = useCallback(async () => {
        if (!response || !currentEndpoint) return;

        try {
            // Odeslat data na export endpoint
            const exportData = {
                endpoint: currentEndpoint.path,
                response: response,
                params: paramsToJson()
            };

            const res = await fetch('/api/insyz/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(exportData)
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || `Export selhal: ${res.status}`);
            }

            // Zobrazit zprávu o úspěšném uložení
            alert(`✅ ${result.message}\n\nSoubor: ${result.filename}\nCesta: ${result.path}`);

        } catch (err) {
            setError(`Export selhal: ${err.message}`);
        }
    }, [response, currentEndpoint, paramsToJson]);

    // Hromadný export příkazů s detaily
    const handleBatchExport = useCallback(async () => {
        if (!response || !currentEndpoint || !Array.isArray(response)) return;

        setBatchLoading(true);
        setError(null);

        try {
            // Získat rok z parametrů (pro určení názvu souboru)
            const yearParam = params.find(p => p.key.toLowerCase().includes('year') || p.key === 'year');
            const year = yearParam ? yearParam.value : new Date().getFullYear();

            const batchData = {
                prikazy: response,
                year: year
            };

            const res = await fetch('/api/insyz/export/batch-prikazy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(batchData)
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || `HTTP ${res.status}`);
            }

            // Zobrazit výsledek
            alert(`✅ ${result.message}\n\nExportováno:\n${result.exported.join('\n')}\n\nMetadata: ${result.metadata_file}`);

        } catch (err) {
            setError(`Hromadný export selhal: ${err.message}`);
        } finally {
            setBatchLoading(false);
        }
    }, [response, currentEndpoint, params]);

    // Vymazat vše
    const handleClear = useCallback(() => {
        setParams([{ key: '', value: '' }]);
        setResponse(null);
        setError(null);
    }, []);

    return (
        <div className="insyz-tester">
            {/* Formulář nahoře */}
            <div className="card">
                <h2 className="text-lg font-semibold mb-4">API Tester</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Výběr endpointu */}
                    <div className="form-group">
                        <label htmlFor="endpoint" className="form-label">
                            Endpoint
                        </label>
                        <select
                            id="endpoint"
                            value={selectedEndpoint}
                            onChange={handleEndpointChange}
                            className="form-select"
                            required
                        >
                            <option value="">-- Vyberte endpoint --</option>
                            {endpoints.map((ep, idx) => (
                                <option key={idx} value={ep.path}>
                                    {ep.method} {ep.path}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Parametry */}
                    {currentEndpoint && (
                        <div className="form-group">
                            <label className="form-label">
                                Parametry
                            </label>
                            <div className="space-y-3">
                                {params.map((param, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="Název parametru"
                                            value={param.key}
                                            onChange={(e) => updateParam(index, 'key', e.target.value)}
                                            className="form-input flex-1"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Hodnota"
                                            value={param.value}
                                            onChange={(e) => updateParam(index, 'value', e.target.value)}
                                            className="form-input flex-1"
                                        />
                                        {params.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeParam(index)}
                                                className="btn btn--sm btn--danger"
                                            >
                                                <IconMinus size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addParam}
                                    className="btn btn--sm btn--outline"
                                >
                                    <IconPlus size={14} />
                                    Přidat parametr
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tlačítka */}
                    {currentEndpoint && (
                        <div className="flex gap-2 pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn--primary"
                            >
                                <IconSend size={16} />
                                {loading ? 'Odesílám...' : 'Odeslat'}
                            </button>
                            
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={!response}
                                className="btn btn--secondary"
                            >
                                <IconDownload size={16} />
                                Exportovat
                            </button>
                            
                            {/* Tlačítko pro hromadný export příkazů */}
                            {response && Array.isArray(response) && currentEndpoint.path.includes('/prikazy') && (
                                <button
                                    type="button"
                                    onClick={handleBatchExport}
                                    disabled={batchLoading}
                                    className="btn btn--warning"
                                >
                                    <IconPackage size={16} />
                                    {batchLoading ? 'Exportuji detaily...' : 'Exportovat detaily'}
                                </button>
                            )}
                            
                            <button
                                type="button"
                                onClick={handleClear}
                                className="btn btn--outline"
                            >
                                <IconTrash size={16} />
                                Vymazat
                            </button>
                        </div>
                    )}
                </form>
            </div>

            {/* Odpověď serveru dole */}
            <div className="card min-h-[400px]">
                <h2 className="text-lg font-semibold mb-4">Odpověď serveru</h2>
                
                {error && (
                    <div className="alert alert--danger">
                        <IconAlertTriangle size={20} />
                        <span>{error}</span>
                    </div>
                )}
                
                {response && !error && (
                    <>
                        <div className="alert alert--success">
                            <IconCheck size={20} />
                            <span>Požadavek byl úspěšně zpracován</span>
                        </div>
                        
                        <div className="border rounded p-4 bg-gray-50 dark:bg-gray-900 overflow-auto max-h-[600px]">
                            <JsonView 
                                data={response}
                                shouldInitiallyExpand={(level) => level < 2}
                            />
                        </div>
                    </>
                )}
                
                {!response && !error && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p>Vyberte endpoint a odešlete požadavek pro zobrazení odpovědi.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(App);