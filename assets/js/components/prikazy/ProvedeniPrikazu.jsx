import React, {useEffect, useState} from 'react';
import {
    IconCheck,
    IconEdit,
    IconEye,
    IconPlus,
    IconAlertTriangle,
    IconUser,
    IconCalendar, IconCrown
} from '@tabler/icons-react';
import {api} from '../../utils/api';
import {log} from '../../utils/debug';
import {StateBadge} from "@utils/stateBadge";

export const ProvedeniPrikazu = ({prikazId, head, currentUser, isLeader}) => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Načítání dat reportu pro aktuálního uživatele a všechny členy skupiny
    useEffect(() => {
        if (!currentUser?.intAdr || !prikazId || !head) {
            setLoading(false);
            return;
        }

        log.info('Načítání hlášení', {prikazId, intAdr: currentUser.intAdr});
        setLoading(true);
        setError(null);

        const loadReports = async () => {
            try {
                // Načtení jediného reportu pro celý příkaz
                const report = await api.prikazy.report(prikazId);

                // Kontrola, zda jsme dostali skutečná data hlášení nebo jen null/prázdnou odpověď
                if (report && report.id && !(report.id_zp && Object.keys(report).length === 1)) {
                    setReportData(report);
                    log.info('Hlášení načteno', report);
                } else {
                    setReportData(null);
                    log.info('Hlášení ještě neexistuje');
                }

                // Už nepotřebujeme - je jen jeden report
            } catch (err) {
                log.error('Nepodařilo se načíst hlášení', err);
                setError('Nepodařilo se načíst hlášení');
            } finally {
                setLoading(false);
            }
        };

        loadReports();
    }, [currentUser?.intAdr, prikazId, head, isLeader]);

    const handleHlaseni = (action) => {
        const url = `/prikaz/${prikazId}/hlaseni`;
        log.info('Přechod na hlášení', {action, url});
        window.location.href = url;
    };

    const getActionButton = () => {
        if (!reportData) {
            return (
                <button
                    className="btn btn--primary"
                    onClick={() => handleHlaseni('create')}
                >
                    <IconPlus size={16} className="mr-2"/>
                    Podat hlášení
                </button>
            );
        }

        if (reportData.state !== 'draft' && reportData.state !== 'rejected' ) {
            return (
                <button
                    className="btn btn--secondary"
                    onClick={() => handleHlaseni('view')}
                >
                    <IconEye size={16} className="mr-2"/>
                    Zobrazit hlášení
                </button>
            );
        }

        return (
            <button
                className="btn btn--primary"
                onClick={() => handleHlaseni('edit')}
            >
                <IconEdit size={16} className="mr-2"/>
                Upravit hlášení
            </button>
        );
    };

    const getCompletionSummary = (report) => {
        if (!report?.data_a && !report?.data_b) return null;

        const partACompleted = report.data_a?.Cast_A_Dokoncena || false;
        const partBCompleted = report.data_b?.Cast_B_Dokoncena || false;

        return (
            <>
                <span className={`badge badge--sm ${partACompleted ? 'badge--success' : 'badge--danger'}`}>
                    Část A: {partACompleted ? 'Dokončeno' : 'Nedokončeno'}
                </span>
                <span className={`badge badge--sm ${partBCompleted ? 'badge--success' : 'badge--danger'}`}>
                    Část B: {partBCompleted ? 'Dokončeno' : 'Nedokončeno'}
                </span>
            </>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Hlášení příkazu</h3>
                <div className="text-sm text-gray-600">Načítání...</div>
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Hlášení příkazu</h3>
                {getActionButton()}
            </div>

            {error && (
                <div className="alert alert--danger mb-4">
                    <div className="alert__content">
                        <div className="alert__body">
                            <IconAlertTriangle size={16} className="mr-2"/>
                            {error}
                        </div>
                    </div>
                </div>
            )}

            {reportData ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                        <StateBadge state={reportData.state}/>
                        {getCompletionSummary(reportData)}

                        <div className="space-y-2">
                            <span className="text-sm text-gray-600">Provedení:</span>
                            {reportData.data_a?.Datum_Provedeni && (
                                <span className="text-sm">
                                    {new Date(reportData.data_a.Datum_Provedeni).toLocaleDateString('cs-CZ')}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {reportData.znackari && reportData.znackari.length > 0 && (
                            <>
                                {reportData.znackari.map((znackar, i) => (
                                    <div
                                        key={i}
                                        className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border dark:border-gray-700 text-sm">

                                        {/* Detaily kalkulace pro daného značkaře */}
                                        {(currentUser.intAdr == znackar.INT_ADR || isLeader) && reportData.calculation && reportData.calculation[znackar.INT_ADR] ? (
                                            <>
                                                <div
                                                    className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 flex gap-4 items-center">
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-bold">{znackar.Znackar}</span>
                                                        {znackar.Je_Vedouci && (
                                                            <IconCrown
                                                                size={18}
                                                                color="#ffd700"
                                                                title="Vedoucí"
                                                                aria-label="Vedoucí"
                                                            />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <strong>Celkem: {reportData.calculation[znackar.INT_ADR].Celkem_Kc || 0} Kč</strong>
                                                    </div>

                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    <div>
                                                        <strong>Čas
                                                            práce:</strong> {reportData.calculation[znackar.INT_ADR].Cas_Prace_Celkem || 0} h
                                                    </div>
                                                    <div>
                                                        <strong>Náhrada
                                                            práce:</strong> {reportData.calculation[znackar.INT_ADR].Nahrada_Prace || 0} Kč
                                                    </div>
                                                    <div>
                                                        <strong>Jízdné:</strong> {reportData.calculation[znackar.INT_ADR].Jizdne_Celkem || 0} Kč
                                                        {reportData.calculation[znackar.INT_ADR].Zvysena_Sazba && (
                                                            <span className="badge badge--light badge--warning">
                                                                    Zvýšené
                                                                </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <strong>Stravné:</strong> {reportData.calculation[znackar.INT_ADR].Stravne || 0} Kč
                                                    </div>
                                                    <div>
                                                        <strong>Noclezné:</strong> {reportData.calculation[znackar.INT_ADR].Noclezne_Celkem || 0} Kč
                                                    </div>
                                                    <div>
                                                        <strong>Vedlejší
                                                            výdaje:</strong> {reportData.calculation[znackar.INT_ADR].Vedlejsi_Vydaje_Celkem || 0} Kč
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold">{znackar.Znackar}</span>
                                                {znackar.Je_Vedouci && (
                                                    <IconCrown
                                                        size={18}
                                                        color="#ffd700"
                                                        title="Vedoucí"
                                                        aria-label="Vedoucí"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-gray-600">
                    Hlášení ještě nebylo vytvořeno
                </div>
            )}
        </>
    );
};