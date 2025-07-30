import React, { useEffect, useState } from 'react';
import {
    IconCheck,
    IconEdit,
    IconEye,
    IconPlus,
    IconAlertTriangle,
    IconUser,
    IconCalendar
} from '@tabler/icons-react';
import { api } from '../../utils/api';
import { log } from '../../utils/debug';

export const ProvedeniPrikazu = ({ prikazId, head, currentUser, isLeader }) => {
    const [reportData, setReportData] = useState(null);
    const [allReports, setAllReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Načítání dat reportu pro aktuálního uživatele a všechny členy skupiny
    useEffect(() => {
        if (!currentUser?.intAdr || !prikazId || !head) {
            setLoading(false);
            return;
        }

        log.info('Loading reports', { prikazId, intAdr: currentUser.intAdr });
        setLoading(true);
        setError(null);

        const loadReports = async () => {
            try {
                // Načtení reportu pro aktuálního uživatele
                try {
                    const userReport = await api.prikazy.report(prikazId, currentUser.intAdr);
                    
                    if (userReport?.data) {
                        setReportData(userReport.data);
                    }
                } catch (err) {
                    log.info('User report does not exist yet');
                    setReportData(null);
                }

                // Načtení reportů pro všechny členy skupiny (pouze pro vedoucí)
                if (isLeader) {
                    const teamReports = [];
                    
                    // Získání INT_ADR všech členů týmu z hlavičky
                    for (let i = 1; i <= 3; i++) {
                        const memberIntAdr = head[`INT_ADR_${i}`];
                        const memberName = head[`Jmeno_${i}`];
                        
                        // Důležité: přeskočit aktuálního uživatele (vedoucího), jeho hlášení už máme
                        if (memberIntAdr && memberIntAdr !== currentUser.intAdr) {
                            try {
                                log.info(`Loading report for team member ${memberName}`, { intAdr: memberIntAdr });
                                const memberReport = await api.prikazy.report(prikazId, memberIntAdr);
                                if (memberReport?.data) {
                                    teamReports.push({
                                        ...memberReport.data,
                                        jmeno: memberName || `Člen ${i}`,
                                        int_adr: memberIntAdr
                                    });
                                }
                            } catch (err) {
                                log.info(`Member ${memberName} (${memberIntAdr}) report does not exist`);
                            }
                        }
                    }
                    
                    setAllReports(teamReports);
                    log.info('Loaded team reports', teamReports);
                }
            } catch (err) {
                log.error('Failed to load reports', err);
                setError('Nepodařilo se načíst hlášení');
            } finally {
                setLoading(false);
            }
        };

        loadReports();
    }, [currentUser?.intAdr, prikazId, head, isLeader]);

    const handleHlaseni = (action) => {
        const url = `/prikaz/${prikazId}/hlaseni`;
        log.info('Navigate to hlaseni', { action, url });
        window.location.href = url;
    };

    const getStatusBadge = (state) => {
        switch (state) {
            case 'send':
                return (
                    <span className="badge badge--success">
                        <IconCheck size={14} className="mr-1" />
                        Odesláno
                    </span>
                );
            case 'draft':
                return (
                    <span className="badge badge--warning">
                        <IconEdit size={14} className="mr-1" />
                        Rozepsáno
                    </span>
                );
            default:
                return <span className="badge badge--secondary">Neznámý stav</span>;
        }
    };

    const getActionButton = () => {
        if (!reportData) {
            return (
                <button
                    className="btn btn--primary"
                    onClick={() => handleHlaseni('create')}
                >
                    <IconPlus size={16} className="mr-2" />
                    Podat hlášení
                </button>
            );
        }

        if (reportData.state === 'send') {
            return (
                <button
                    className="btn btn--secondary"
                    onClick={() => handleHlaseni('view')}
                >
                    <IconEye size={16} className="mr-2" />
                    Zobrazit hlášení
                </button>
            );
        }

        return (
            <button
                className="btn btn--primary"
                onClick={() => handleHlaseni('edit')}
            >
                <IconEdit size={16} className="mr-2" />
                Upravit hlášení
            </button>
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Neuvedeno';
        try {
            return new Date(dateString).toLocaleDateString('cs-CZ', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Neplatné datum';
        }
    };

    const getCompletionSummary = (report) => {
        if (!report?.data_a && !report?.data_b) return null;

        const partACompleted = report.data_a?.partACompleted || false;
        const partBCompleted = report.data_b?.partBCompleted || false;

        return (
            <div className="flex gap-2">
                <span className={`badge badge--sm ${partACompleted ? 'badge--success' : 'badge--danger'}`}>
                    Část A: {partACompleted ? 'Dokončeno' : 'Nedokončeno'}
                </span>
                <span className={`badge badge--sm ${partBCompleted ? 'badge--success' : 'badge--danger'}`}>
                    Část B: {partBCompleted ? 'Dokončeno' : 'Nedokončeno'}
                </span>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Provedení příkazu</h3>
                <div className="text-sm text-gray-600">Načítání...</div>
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Provedení příkazu</h3>
                {getActionButton()}
            </div>

            {error && (
                <div className="alert alert--danger mb-4">
                    <div className="alert__content">
                        <div className="alert__body">
                            <IconAlertTriangle size={16} className="mr-2" />
                            {error}
                        </div>
                    </div>
                </div>
            )}

            {reportData ? (
                <div className="space-y-4">
                    <h4 className="font-semibold">Vaše hlášení</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <div className="space-y-2">
                                {getStatusBadge(reportData.state)}
                                {getCompletionSummary(reportData)}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm text-gray-600">Provedení:</div>
                            {reportData.data_a?.executionDate && (
                                <div className="text-sm">
                                    {new Date(reportData.data_a.executionDate).toLocaleDateString('cs-CZ')}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Vedoucí:</span>
                                <span className={`badge badge--sm ${reportData.je_vedouci ? 'badge--info' : 'badge--secondary'}`}>
                                    {reportData.je_vedouci ? 'Ano' : 'Ne'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {reportData.data_a?.travelSegments && reportData.data_a.travelSegments.length > 0 && (
                                <>
                                    <div className="text-sm text-gray-600">Segmenty dopravy:</div>
                                    <div className="text-sm">
                                        {reportData.data_a.travelSegments.map((segment, i) => (
                                            <div key={i}>
                                                {segment.startPlace} – {segment.endPlace}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            {reportData.data_a?.accommodations && (
                                <div className="flex gap-2">
                                    <span className="text-sm text-gray-600">Nocí ubytování:</span>
                                    <span className="text-sm">{reportData.data_a.accommodations.length}</span>
                                </div>
                            )}
                            {reportData.data_a?.additionalExpenses && (
                                <div className="flex gap-2">
                                    <span className="text-sm text-gray-600">Dodatečné výdaje:</span>
                                    <span className="text-sm">{reportData.data_a.additionalExpenses.length} položek</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-gray-600">
                    Vaše hlášení ještě nebylo vytvořeno
                </div>
            )}

            {/* Přehled hlášení ostatních členů skupiny */}
            {isLeader && allReports.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold mb-4">Hlášení ostatních členů skupiny</h4>
                    <div className="space-y-3">
                        {allReports.map((report, index) => (
                            <div key={report.id || index} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <IconUser size={16} />
                                        <span className="text-sm font-medium">{report.jmeno}</span>
                                        {report.je_vedouci && (
                                            <span className="badge badge--sm badge--info">Vedoucí</span>
                                        )}
                                    </div>
                                    {getStatusBadge(report.state)}
                                </div>

                                <div className="mt-2 space-y-1">
                                    {getCompletionSummary(report)}
                                    
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                                        {report.data_a?.executionDate && (
                                            <div className="flex items-center gap-1">
                                                <IconCalendar size={14} />
                                                Datum: {new Date(report.data_a.executionDate).toLocaleDateString('cs-CZ')}
                                            </div>
                                        )}
                                        {report.date_send && (
                                            <div>
                                                Odesláno: {formatDate(report.date_send)}
                                            </div>
                                        )}
                                    </div>

                                    {report.data_a?.travelSegments && report.data_a.travelSegments.length > 0 && (
                                        <div className="text-sm text-gray-600 mt-2">
                                            Trasa: {report.data_a.travelSegments[0].startPlace} → {report.data_a.travelSegments[report.data_a.travelSegments.length - 1].endPlace}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};