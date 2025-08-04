import React from 'react';
import { IconCrown } from '@tabler/icons-react';
import { PrikazStavBadge } from './PrikazStavBadge';
import { PrikazTypeIcon } from './PrikazTypeIcon';

const formatKm = (km) => km ? parseFloat(km).toFixed(1) : '0';

const Member = ({ name, isLeader }) => {
    if (!name?.trim()) return null;
    
    return (
        <div className="flex items-center gap-1">
            <span className={isLeader ? 'font-bold' : 'font-normal'}>
                {name}
            </span>
            {isLeader && (
                <IconCrown 
                    size={18} 
                    color="#ffd700" 
                    title="Vedoucí" 
                    aria-label="Vedoucí"
                />
            )}
        </div>
    );
};

export const PrikazHead = ({ head, simple = false }) => {
    // Pokud head není dostupný, vrátíme prázdný div
    if (!head) {
        return <div></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-8 items-start">
                {/* Ikona typu příkazu */}
                <div className="flex flex-col gap-2">
                    <PrikazTypeIcon type={head.Druh_ZP} size={66} />
                </div>
                
                {/* Základní info */}
                <div className="flex flex-col gap-1">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {head.Druh_ZP_Naz}
                    </div>
                    {!simple && <PrikazStavBadge stav={head.Stav_ZP_Naz} />}
                </div>
                
                {/* KKZ a ZO */}
                {!simple && (
                    <div className="flex flex-col gap-2">
                        <div className="text-sm">
                            KKZ: <span className="font-bold">{head.Nazev_KKZ}</span>
                        </div>
                        <div className="text-sm">
                            ZO: <span className="font-bold">{head.Nazev_ZO}</span>
                        </div>
                    </div>
                )}
                
                {/* Značkaři */}
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map(i => (
                        <Member
                            key={i}
                            name={head[`Znackar${i}`]}
                            isLeader={head[`Je_Vedouci${i}`] === "1"}
                        />
                    ))}
                </div>
                
                {/* Trvání a počet členů */}
                <div className="flex flex-col gap-1">
                    <div className="text-sm">
                        Předpokládané trvání cesty: <span className="font-bold">{head.Doba}</span> den/dnů
                    </div>
                    <div className="text-sm">
                        pro <span className="font-bold">{head.Pocet_clenu}</span> člennou skupinu
                    </div>
                    {head.ZvysenaSazba === "1" && (
                        <span className="badge badge--warning badge--light mt-1">
                            Zvýšená sazba
                        </span>
                    )}
                </div>
            </div>
            
            {/* Popis činnosti */}
            {!simple && head.Poznamka_ZP && (
                <>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                    <div className="space-y-1">
                        <div className="text-base font-bold">Popis činnosti</div>
                        <div className="whitespace-pre-line">
                            {head.Poznamka_ZP}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};