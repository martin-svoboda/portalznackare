import React, {useEffect, useState} from 'react';
import {ReportProvedeniSummary} from '../../../components/prikazy/ReportProvedeniSummary';
import {Loader} from '@components/shared';

/**
 * Lazy panel pro rozklik řádku v admin výpisu hlášení. Při mountu (= rozkliknutí)
 * načte detail hlášení z admin endpointu a zobrazí souhrn z ULOŽENÉ kalkulace
 * (obsah karty „Hlášení příkazu"). Bez sazeb a přepočtu.
 *
 * @param {number} reportId - ID hlášení (admin), tj. řádek.original.id
 */
export const ReportCompensationPanel = ({reportId}) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        fetch(`/admin/api/reports/${reportId}`)
            .then(res => {
                if (!res.ok) throw new Error('Načtení detailu selhalo');
                return res.json();
            })
            .then(data => {
                if (active) setDetail(data);
            })
            .catch(() => {
                if (active) setError('Nepodařilo se načíst detail hlášení');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [reportId]);

    if (loading) {
        return <div className="py-4"><Loader/></div>;
    }
    if (error) {
        return <div className="alert alert--danger">{error}</div>;
    }
    if (!detail) {
        return null;
    }

    return (
        <ReportProvedeniSummary
            state={detail.state}
            znackari={detail.znackari}
            calculation={detail.calculation}
            presmerovani={detail.dataA?.Presmerovani_Vyplat}
            datumProvedeni={detail.dataA?.Datum_Provedeni}
            castADokoncena={detail.dataA?.Cast_A_Dokoncena || false}
            castBDokoncena={detail.dataB?.Cast_B_Dokoncena || false}
            showAll={true}
        />
    );
};
