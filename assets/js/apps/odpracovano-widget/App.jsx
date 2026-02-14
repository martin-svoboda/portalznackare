import React, { useState, useEffect, memo } from 'react';
import { IconShieldCheckFilled, IconShieldFilled } from '@tabler/icons-react';
import { createDebugLogger } from '../../utils/debug';

const logger = createDebugLogger('OdpracovanoWidget');

const MILNIKY = [50, 120, 250, 500];

/**
 * Spočítá celkový součet km a seřadí data sestupně
 */
function zpracujData(rawData) {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        return { roky: [], totalKm: 0 };
    }

    const roky = rawData
        .map(item => ({
            rok: parseInt(item.Rok_Cin, 10),
            km: parseFloat(item.Odpracovano) || 0
        }))
        .sort((a, b) => b.rok - a.rok);

    const totalKm = roky.reduce((sum, item) => sum + item.km, 0);

    return { roky, totalKm };
}

/**
 * Spočítá progress v rámci jednoho segmentu (0-1)
 */
function segmentProgress(totalKm, segStart, segEnd) {
    if (totalKm <= segStart) return 0;
    if (totalKm >= segEnd) return 1;
    return (totalKm - segStart) / (segEnd - segStart);
}

/**
 * Progress bar s milníky
 */
const ProgressBar = memo(function ProgressBar({ totalKm }) {
    // Segmenty: 0→50, 50→120, 120→250, 250→500
    const segments = MILNIKY.map((milestone, i) => {
        const start = i === 0 ? 0 : MILNIKY[i - 1];
        const end = milestone;
        const width = end - start; // relativní šířka segmentu
        const progress = segmentProgress(totalKm, start, end);
        const reached = totalKm >= end;

        return { start, end, width, progress, reached, milestone };
    });

    const totalWidth = MILNIKY[MILNIKY.length - 1]; // 500

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Celkem odpracováno
                </span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">
                    {totalKm.toFixed(1)} km
                </span>
            </div>

            {/* Řádek s bary a milníkovými koly - vertikálně na střed */}
            <div className="flex items-center w-full">
                {segments.map((seg) => (
                    <React.Fragment key={seg.milestone}>
                        {/* Bar segment */}
                        <div
                            className="h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 relative"
                            style={{ flex: seg.width / totalWidth }}
                        >
                            <div
                                className="h-full rounded-full bg-green-500 dark:bg-green-400 transition-all duration-500"
                                style={{ width: `${seg.progress * 100}%` }}
                            />
                        </div>

                        {/* Milníkové kolo */}
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 -mx-1 z-10 ${
                                seg.reached
                                    ? 'bg-green-500 border-green-600 dark:bg-green-500 dark:border-green-400'
                                    : 'bg-gray-200 border-gray-300 dark:bg-gray-600 dark:border-gray-500'
                            }`}
                        >
                            {seg.reached ? (
                                <IconShieldCheckFilled size={18} className="text-white" />
                            ) : (
                                <IconShieldFilled size={18} className="text-gray-400 dark:text-gray-400" />
                            )}
                        </div>
                    </React.Fragment>
                ))}
            </div>

            {/* Popisky pod milníky - samostatný řádek */}
            <div className="flex w-full">
                {segments.map((seg) => (
                    <React.Fragment key={seg.milestone}>
                        <div style={{ flex: seg.width / totalWidth }} />
                        <div className="flex-shrink-0 -mx-1 w-8 text-center">
                            <span className={`text-xs font-medium whitespace-nowrap ${
                                seg.reached
                                    ? 'text-green-700 dark:text-green-400'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}>
                                {seg.milestone}
                            </span>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
});

/**
 * Tabulka km po rocích
 */
const TabulkaRoku = memo(function TabulkaRoku({ roky, totalKm }) {
    return (
        <table className="table mt-4">
            <thead>
                <tr>
                    <th>Rok</th>
                    <th className="text-right">Odpracováno (km)</th>
                </tr>
            </thead>
            <tbody>
                {roky.map(item => (
                    <tr key={item.rok}>
                        <td>{item.rok}</td>
                        <td className="text-right">{item.km.toFixed(1)}</td>
                    </tr>
                ))}
                <tr className="font-bold">
                    <td>Celkem</td>
                    <td className="text-right">{totalKm.toFixed(1)}</td>
                </tr>
            </tbody>
        </table>
    );
});

/**
 * Hlavní komponenta widgetu
 */
function App({ container }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const showTable = container?.dataset?.showTable === 'true';
    const shouldFetch = container?.dataset?.fetch === 'true';

    useEffect(() => {
        // Data z Twig atributu
        const inlineData = container?.dataset?.odpracovano;
        if (inlineData) {
            try {
                const parsed = JSON.parse(inlineData);
                const result = zpracujData(parsed);
                logger.lifecycle('Data loaded from attribute', result);
                setData(result);
            } catch (e) {
                logger.error('Failed to parse inline data', e);
                setError('Chyba při zpracování dat.');
            }
            return;
        }

        // Fetch z API
        if (shouldFetch) {
            setLoading(true);
            logger.api('GET', '/api/insyz/user');

            fetch('/api/insyz/user')
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(json => {
                    const odpracovano = json[1] || [];
                    const result = zpracujData(odpracovano);
                    logger.api('GET', '/api/insyz/user', null, result);
                    setData(result);
                })
                .catch(e => {
                    logger.error('Failed to fetch user data', e);
                    setError('Nepodařilo se načíst data.');
                })
                .finally(() => setLoading(false));
        }
    }, []);

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
                Načítám data...
            </div>
        );
    }

    if (error) {
        return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
    }

    if (!data) {
        return null;
    }

    return (
        <div>
            <ProgressBar totalKm={data.totalKm} />
            {showTable && data.roky.length > 0 && (
                <TabulkaRoku roky={data.roky} totalKm={data.totalKm} />
            )}
        </div>
    );
}

export default memo(App);
