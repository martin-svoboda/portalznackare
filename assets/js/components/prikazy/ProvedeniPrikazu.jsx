import React, {useEffect, useState} from 'react';
import {
    IconCheck,
    IconEdit,
    IconEye,
    IconPlus,
    IconAlertTriangle,
    IconUser,
    IconCalendar
} from '@tabler/icons-react';
import {api} from '../../utils/api';
import {log} from '../../utils/debug';
import {StateBadge} from "@utils/stateBadge";
import {ReportProvedeniSummary} from './ReportProvedeniSummary';

export const ProvedeniPrikazu = ({prikazId, head, currentUser, isLeader, isAdmin = false}) => {
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
                    Vyplnit hlášení
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
                <ReportProvedeniSummary
                    state={reportData.state}
                    znackari={reportData.znackari}
                    calculation={reportData.calculation}
                    presmerovani={reportData.data_a?.Presmerovani_Vyplat}
                    datumProvedeni={reportData.data_a?.Datum_Provedeni}
                    castADokoncena={reportData.data_a?.Cast_A_Dokoncena || false}
                    castBDokoncena={reportData.data_b?.Cast_B_Dokoncena || false}
                    showAll={isLeader || isAdmin}
                    currentUserIntAdr={currentUser?.intAdr}
                />
            ) : (
                <div className="text-gray-600">
                    Hlášení ještě nebylo vytvořeno
                </div>
            )}
        </>
    );
};