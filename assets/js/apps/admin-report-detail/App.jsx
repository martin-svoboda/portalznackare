import React, {useState, useEffect} from 'react';
import {IconArrowLeft, IconRefresh, IconSend2} from '@tabler/icons-react';
import {CompensationSummary} from '../hlaseni-prikazu/components/CompensationSummary';
import {PartBSummary} from '../hlaseni-prikazu/components/PartBSummary';
import {StateBadge, getStateLabel} from '../../utils/stateBadge';
import {Loader} from "@components/shared";

const App = () => {
    const [activeTab, setActiveTab] = useState('info');
    const [loading, setLoading] = useState(true);
    const [reportDetail, setReportDetail] = useState(null);

    // Získat ID hlášení z URL nebo data attributu
    const container = document.querySelector('[data-app="admin-report-detail"]');
    const reportId = container?.dataset?.reportId;

    useEffect(() => {
        if (reportId) {
            loadReportDetail();
        }
    }, [reportId]);

    const loadReportDetail = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/admin/api/reports/${reportId}`);
            const data = await response.json();
            setReportDetail(data);
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
                    <div>
                        <CompensationSummary
                            formData={reportDetail.dataA}
                            calculation={reportDetail.calculation}
                            teamMembers={reportDetail.znackari}
                            readOnly={true}
                        />
                    </div>
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
            </div>
        </div>
    );
};

export default App;