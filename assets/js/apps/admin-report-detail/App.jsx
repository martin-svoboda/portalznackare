import React, {useState, useEffect} from 'react';
import {IconArrowLeft, IconRefresh, IconSend2, IconCopy, IconExternalLink, IconFileCode} from '@tabler/icons-react';
import {CompensationSummary} from '../hlaseni-prikazu/components/CompensationSummary';
import {PartBSummary} from '../hlaseni-prikazu/components/PartBSummary';
import {AppProvider} from '../hlaseni-prikazu/contexts/AppContext';
import {parseTariffRatesFromAPI, calculateExecutionDate} from '../hlaseni-prikazu/utils/compensationCalculator';
import {StateBadge, getStateLabel} from '../../utils/stateBadge';
import {api} from '../../utils/api';
import {log} from '../../utils/debug';
import {Loader} from "@components/shared";

const App = () => {
    const [activeTab, setActiveTab] = useState('info');
    const [loading, setLoading] = useState(true);
    const [reportDetail, setReportDetail] = useState(null);
    const [tariffRates, setTariffRates] = useState(null);
    const [copied, setCopied] = useState(false);
    const [xml, setXml] = useState(null);
    const [xmlLoading, setXmlLoading] = useState(false);
    const [xmlError, setXmlError] = useState(null);
    const [xmlCopied, setXmlCopied] = useState(false);

    // Získat ID hlášení z URL nebo data attributu
    const container = document.querySelector('[data-app="admin-report-detail"]');
    const reportId = container?.dataset?.reportId;
    const xmlUrl = `/admin/api/reports/${reportId}/xml`;

    const loadXml = async () => {
        setXmlLoading(true);
        setXmlError(null);
        try {
            const response = await fetch(xmlUrl);
            if (!response.ok) {
                let msg = 'Nepodařilo se vygenerovat XML';
                try {
                    const err = await response.json();
                    if (err?.error) msg = err.error;
                } catch (e) { /* odpověď není JSON */ }
                throw new Error(msg);
            }
            setXml(await response.text());
        } catch (error) {
            log.error('Chyba při načítání XML', error);
            setXmlError(error.message || 'Chyba při načítání XML');
        } finally {
            setXmlLoading(false);
        }
    };

    const copyXml = async () => {
        if (!xml) return;
        try {
            await navigator.clipboard.writeText(xml);
            setXmlCopied(true);
            setTimeout(() => setXmlCopied(false), 2000);
        } catch (e) {
            alert('Nepodařilo se zkopírovat XML');
        }
    };

    // Lazy načtení XML při prvním otevření tabu
    useEffect(() => {
        if (activeTab === 'xml' && xml === null && !xmlLoading && !xmlError) {
            loadXml();
        }
    }, [activeTab]);

    const copyNahledUrl = async () => {
        if (!reportDetail?.nahledUrl) return;
        try {
            await navigator.clipboard.writeText(reportDetail.nahledUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            alert('Nepodařilo se zkopírovat. Odkaz:\n' + reportDetail.nahledUrl);
        }
    };

    useEffect(() => {
        if (reportId) {
            loadReportDetail();
        }
    }, [reportId]);

    const loadReportDetail = async () => {
        setLoading(true);
        // Invalidovat dříve načtené XML – po obnovení dat se přegeneruje
        setXml(null);
        setXmlError(null);
        try {
            const response = await fetch(`/admin/api/reports/${reportId}`);
            const data = await response.json();
            setReportDetail(data);

            // Načíst sazby pro datum provedení - CompensationSummary je potřebuje
            // z kontextu pro zobrazení detailů náhrad (i v readOnly režimu)
            try {
                const executionDate = calculateExecutionDate(data.dataA);
                const dateParam = (executionDate || new Date()).toISOString().split('T')[0];
                const priceResponse = await api.insyz.sazby(dateParam);
                setTariffRates(parseTariffRatesFromAPI(priceResponse));
            } catch (error) {
                log.error('Chyba při načítání ceníku', error);
            }
        } catch (error) {
            console.error('Chyba při načítání detailu hlášení:', error);
        } finally {
            setLoading(false);
        }
    };

    const changeState = async (newState) => {
        if (!confirm(`Jste si jisti změnou stavu na "${getStateLabel(newState)}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/admin/api/reports/${reportId}/state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({state: newState}),
            });

            if (response.ok) {
                alert('Stav byl úspěšně změněn');
                loadReportDetail();
            } else {
                alert('Chyba při změně stavu');
            }
        } catch (error) {
            console.error('Chyba při změně stavu:', error);
            alert('Chyba při změně stavu');
        }
    };

    const sendToInsyz = async () => {
        if (!confirm('Jste si jisti odesláním do INSYZ?')) {
            return;
        }

        try {
            const response = await fetch(`/admin/api/reports/${reportId}/state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({state: 'send'}),
            });

            if (response.ok) {
                alert('Hlášení bylo odesláno do INSYZ');
                loadReportDetail();
            } else {
                alert('Chyba při odesílání do INSYZ');
            }
        } catch (error) {
            console.error('Chyba při odesílání do INSYZ:', error);
            alert('Chyba při odesílání do INSYZ');
        }
    };


    if (loading) {
        return (
            <div className="card">
                <Loader/>
            </div>
        );
    }

    if (!reportDetail) {
        return (
            <div className="text-center py-8">
                <p className="text-red-600">Hlášení nenalezeno</p>
                <a href="/admin/hlaseni" className="btn btn--primary mt-4">
                    <IconArrowLeft size={16}/>
                    Zpět na seznam
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex-layout flex-layout--between flex-layout--wrap">
                <div>
                    <h1 className="page-title">Detail hlášení {reportDetail.cisloZp}</h1>
                </div>
                <button
                    onClick={loadReportDetail}
                    className="btn btn--secondary"
                    disabled={loading}
                >
                    <IconRefresh size={16}/>
                    Obnovit
                </button>
            </div>

            {/* Tab navigation */}
            <div className="tabs">
                <button
                    className={`tabs__item tabs__link ${activeTab === 'info' ? 'tabs__link--active' : ''}`}
                    onClick={() => setActiveTab('info')}
                >
                    Základní info
                </button>
                <button
                    className={`tabs__item tabs__link ${activeTab === 'compensation' ? 'tabs__link--active' : ''}`}
                    onClick={() => setActiveTab('compensation')}
                >
                    Část A & Kalkulace
                </button>
                <button
                    className={`tabs__item tabs__link ${activeTab === 'partb' ? 'tabs__link--active' : ''}`}
                    onClick={() => setActiveTab('partb')}
                >
                    Část B
                </button>
                <button
                    className={`tabs__item tabs__link ${activeTab === 'history' ? 'tabs__link--active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    Historie
                </button>
                <button
                    className={`tabs__item tabs__link ${activeTab === 'xml' ? 'tabs__link--active' : ''}`}
                    onClick={() => setActiveTab('xml')}
                >
                    XML pro INSYZ
                </button>
            </div>

            <div className="tab-content">
                {/* Základní info */}
                {activeTab === 'info' && (
                    <div className="card">
                        <div className="card__content">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <strong>ID hlášení:</strong> {reportDetail.id}
                                    </div>
                                    <div>
                                        <strong>Číslo ZP:</strong> {reportDetail.cisloZp}
                                    </div>
                                    <div>
                                        <strong>Stav:</strong> <StateBadge state={reportDetail.state} />
                                    </div>
                                    <div>
                                        <strong>Vytvořeno:</strong> {new Date(reportDetail.dateCreated).toLocaleString('cs-CZ')}
                                    </div>
                                    <div>
                                        <strong>Aktualizováno:</strong> {new Date(reportDetail.dateUpdated).toLocaleString('cs-CZ')}
                                    </div>
                                    {reportDetail.dateSend && (
                                        <div>
                                            <strong>Odesláno:</strong> {new Date(reportDetail.dateSend).toLocaleString('cs-CZ')}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <strong>Značkaři:</strong>
                                    <ul className="mt-2 space-y-1">
                                        {(reportDetail.znackari || []).map((znackar, index) => (
                                            <li key={index} className="flex items-center gap-2">
                                                <span>{znackar.Znackar || znackar.name}</span>
                                                {znackar.Je_Vedouci && (
                                                    <span className="badge badge--primary">Vedoucí</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Náhled pro INSYZ */}
                                {reportDetail.nahledUrl && (
                                    <div className="border-t pt-4">
                                        <strong>Náhled pro INSYZ (read-only):</strong>
                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={reportDetail.nahledUrl}
                                                onFocus={e => e.target.select()}
                                                className="form__input flex-1 text-xs font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={copyNahledUrl}
                                                className="btn btn--secondary btn--sm"
                                                title="Kopírovat odkaz"
                                            >
                                                <IconCopy size={16} />
                                                {copied ? 'Zkopírováno' : 'Kopírovat'}
                                            </button>
                                            <a
                                                href={reportDetail.nahledUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn--secondary btn--sm"
                                                title="Otevřít náhled v nové záložce"
                                            >
                                                <IconExternalLink size={16} />
                                                Otevřít
                                            </a>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Bezpečný odkaz na kompletní hlášení pro správce INSYZ. Funguje i bez přihlášení.
                                        </p>
                                    </div>
                                )}

                                {/* Akce */}
                                <div className="border-t pt-4">
                                    <div className="flex gap-2">
                                        <select
                                            className="form__select max-w-md"
                                            value={reportDetail.state}
                                            onChange={e => changeState(e.target.value)}
                                        >
                                            <option value="draft">{getStateLabel('draft')}</option>
                                            <option value="send">{getStateLabel('send')}</option>
                                            <option value="submitted">{getStateLabel('submitted')}</option>
                                            <option value="approved">{getStateLabel('approved')}</option>
                                            <option value="rejected">{getStateLabel('rejected')}</option>
                                        </select>
                                        <button
                                            onClick={sendToInsyz}
                                            className="btn btn--primary"
                                        >
                                            <IconSend2 size={16}/>
                                            Odeslat do INSYZ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Část A & Kalkulace */}
                {activeTab === 'compensation' && (
                    <AppProvider initialData={{
                        usersDetails: {},
                        tariffRates,
                        teamMembers: reportDetail.znackari || [],
                        currentUser: null,
                        isLeader: true, // Admin vidí kompenzace všech členů týmu
                    }}>
                        <CompensationSummary
                            formData={reportDetail.dataA}
                            calculation={reportDetail.calculation}
                            readOnly={true}
                        />
                    </AppProvider>
                )}

                {/* Část B */}
                {activeTab === 'partb' && (
                    <div>
                        <PartBSummary formData={reportDetail.dataB}/>
                    </div>
                )}

                {/* Historie */}
                {activeTab === 'history' && (
                    <div className="card">
                        <div className="card__content">
                            {reportDetail.history && reportDetail.history.length > 0 ? (
                                <table className="table">
                                    <thead>
                                    <tr>
                                        <th>Čas a uživatel</th>
                                        <th>Akce</th>
                                        <th>Stav</th>
                                        <th>Data</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {[...reportDetail.history].reverse().map((entry, index) => (
                                        <tr key={index}>
                                            <td>
                                                {new Date(entry.timestamp).toLocaleString('cs-CZ')}<br/><code>{entry.user}</code>
                                            </td>
                                            <td><code>{entry.action}</code><br/>{entry.details || ''}</td>
                                            <td><StateBadge state={entry.state} /></td>
                                            <td>
                                                <pre className="text-xs max-w-md overflow-y-auto">
                                                    {JSON.stringify(entry.data, null, 2)}
                                                </pre>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    Žádná historie nenalezena
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* XML pro INSYZ */}
                {activeTab === 'xml' && (
                    <div className="card">
                        <div className="card__content">
                            <div className="flex items-center gap-2 mb-4 flex-wrap">
                                <button
                                    type="button"
                                    onClick={copyXml}
                                    className="btn btn--secondary btn--sm"
                                    disabled={!xml || xmlLoading}
                                    title="Kopírovat XML"
                                >
                                    <IconCopy size={16}/>
                                    {xmlCopied ? 'Zkopírováno' : 'Kopírovat XML'}
                                </button>
                                <a
                                    href={xmlUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn--secondary btn--sm"
                                    title="Otevřít XML v nové záložce"
                                >
                                    <IconExternalLink size={16}/>
                                    Otevřít raw
                                </a>
                                <button
                                    type="button"
                                    onClick={loadXml}
                                    className="btn btn--secondary btn--sm"
                                    disabled={xmlLoading}
                                    title="Znovu vygenerovat XML"
                                >
                                    <IconRefresh size={16}/>
                                    Obnovit
                                </button>
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                <IconFileCode size={14} className="inline mr-1"/>
                                Náhled XML generovaného z aktuálních dat hlášení – stejná struktura, jaká se odesílá do INSYZ.
                            </p>

                            {xmlLoading ? (
                                <Loader/>
                            ) : xmlError ? (
                                <div className="alert alert--danger">{xmlError}</div>
                            ) : xml ? (
                                <pre className="text-xs bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-md p-3 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
                                    {xml}
                                </pre>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;