import React, {useMemo, useCallback, useEffect} from 'react';
import {
    calculateCompensation,
    calculateCompensationForAllMembers
} from '../utils/compensationCalculator';
import {log} from '../../../utils/debug';

// Member compensation detail component for compact mode
const MemberCompensationDetail = ({
                                      member,
                                      memberCompensation,
                                      formData,
                                      tariffRates,
                                      formatCurrency,
                                      showMemberName = false,
                                      compact = false,
                                      teamMembers = []
                                  }) => {
    if (!memberCompensation) return null;

    const workHours = memberCompensation.Cas_Prace_Celkem || 0;

    const textSize = compact ? "text-sm" : "text-base";
    const smallTextSize = compact ? "text-xs" : "text-sm";
    const blockStyle = compact ? "space-y-1" : "space-y-2 mb-2 border-b border-gray-200 dark:border-gray-700 pb-3";

    return (
        <div className="space-y-2">
            {showMemberName && (
                <h5 className={`font-bold ${textSize}`}>{member?.name || member?.Znackar || member?.INT_ADR}</h5>
            )}

            <div className={blockStyle}>
                <div className="flex justify-between">
                    <span className={`${textSize} font-medium`}>Práce celkem</span>
                    <span className={textSize}>{workHours.toFixed(1)} h</span>
                </div>
                {!compact && (
                    memberCompensation.Cas_Prace && memberCompensation.Cas_Prace.length > 0 ?
                        memberCompensation.Cas_Prace.map((den, index) => {
                            if (!den) return <span key={index} className="text-red-500 font-bold">Žádný počátek a konec cesty - nelze vypočítat</span>;

                            return (
                                <div key={index}
                                     className={`${smallTextSize} text-muted ml-4 flex justify-between`}>
                                    <div>
                                        <span><strong>{den.Datum ? new Date(den.Datum).toLocaleDateString('cs-CZ') :
                                            <span className="text-red-500">chybí datum</span>}</strong></span>
                                        <span> od <strong>{den.Od ||
                                            <span className="text-red-500">chybí čas</span>}</strong></span>
                                        <span> do <strong>{den.Do ||
                                            <span className="text-red-500">chybí čas</span>}</strong></span>
                                    </div>
                                    <span>{den.Cas} h</span>
                                </div>
                            );
                        }) :
                        <span className={`${smallTextSize} text-red-500 ml-4 font-bold`}>Žádný počátek a konec cesty - nelze vypočítat</span>
                )}
            </div>

            <div className={blockStyle}>
                <div className="flex justify-between">
                    <span className={`${textSize} font-medium`}>
                        Jízdné
                        {/* Zobrazit konkrétní použitou sazbu pouze pokud je řidičem nějaké auto cesty */}
                        {tariffRates && (() => {
                            // Zkontrolovat zda je řidičem nějaké auto cesty
                            const isDriverOfAnyCar = formData.Skupiny_Cest?.some(group =>
                                group.Ridic == member?.INT_ADR &&
                                group.Cesty?.some(s => s.Druh_Dopravy === "AUV" || s.Druh_Dopravy === "AUV-Z")
                            );

                            if (!isDriverOfAnyCar) return null;

                            // Zjistit zda je člen hlavním řidičem (dostane zvýšenou sazbu)
                            const hasHigherRate = formData.Hlavni_Ridic == member?.INT_ADR &&
                                formData.Skupiny_Cest?.some(group =>
                                    group.Ridic == member?.INT_ADR &&
                                    group.Cesty?.some(s => s.Druh_Dopravy === "AUV" || s.Druh_Dopravy === "AUV-Z")
                                );
                            const rate = hasHigherRate ? tariffRates.jizdneZvysene : tariffRates.jizdne;
                            return (
                                <span className={`${smallTextSize} text-muted ml-1`}>
                                    ({rate || 0} Kč/km)
                                </span>
                            );
                        })()}
                    </span>
                    <span className={textSize}>{formatCurrency(memberCompensation?.Jizdne_Celkem || 0)}</span>
                </div>
                {/* Badge zvýšené sazby pod názvem */}
                {formData.Hlavni_Ridic == member?.INT_ADR &&
                    formData.Skupiny_Cest?.some(group =>
                        group.Ridic == member?.INT_ADR &&
                        group.Cesty?.some(s => s.Druh_Dopravy === "AUV" || s.Druh_Dopravy === "AUV-Z")
                    ) && (
                        <div className="ml-4">
                        <span className="badge badge--warning badge--light">
                            Zvýšená sazba
                        </span>
                        </div>
                    )}
                {/* Details for transport costs for this member */}
                {(formData.Skupiny_Cest?.flatMap(group => {
                    // Check if member is involved in this group
                    const isParticipant = group.Cestujci?.includes(member?.INT_ADR);
                    const isDriver = group.Ridic == member?.INT_ADR;

                    // V kompaktním zobrazení - pouze cesty kde je řidič nebo cestující
                    // V detailním zobrazení - všechny cesty kde je jakkoliv označen
                    if (compact && !isParticipant && !isDriver) {
                        return [];
                    }

                    // Filter segments based on transport type and member role
                    return (group.Cesty || []).map(segment => {
                        if (!segment || !segment.Druh_Dopravy) return null;

                        // Pro auto cesty - řidič nebo spolucestující (v nekompaktním zobrazení)
                        if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                            if (!isDriver && compact) return null;  // V kompaktním zobrazení pouze řidič
                            if (!isDriver && !isParticipant) return null;  // V nekompaktním musí být alespoň spolucestující
                            return {...segment, isDriver: isDriver, SPZ: group.SPZ};
                        }

                        // Pro ostatní cesty (V, P, K) - pokud je cestujícím
                        if (isParticipant) {
                            return {...segment, isDriver: false};
                        }

                        return null;
                    }).filter(Boolean);
                }) || []).map((segment, index) => {
                    if (!segment || !segment.Druh_Dopravy) return null;

                    let detail = "";
                    if (compact) {
                        detail = `${segment.Misto_Odjezdu || '?'} – ${segment.Misto_Prijezdu || '?'}`;
                    } else {
                        const mistoOdjezdu = segment.Misto_Odjezdu ?
                            `<strong>${segment.Misto_Odjezdu}</strong>` :
                            '<span class="text-red-500 font-bold">chybí místo</span>';
                        const casOdjezdu = segment.Cas_Odjezdu ?
                            `<strong>${segment.Cas_Odjezdu}</strong>` :
                            '<span class="text-red-500 font-bold">chybí čas</span>';
                        const mistoPrijezdu = segment.Misto_Prijezdu ?
                            `<strong>${segment.Misto_Prijezdu}</strong>` :
                            '<span class="text-red-500 font-bold">chybí místo</span>';
                        const casPrijezdu = segment.Cas_Prijezdu ?
                            `<strong>${segment.Cas_Prijezdu}</strong>` :
                            '<span class="text-red-500 font-bold">chybí čas</span>';
                        const datum = segment.Datum ?
                            `<strong>${new Date(segment.Datum).toLocaleDateString('cs-CZ')}</strong>` :
                            '<span class="text-red-500 font-bold">chybí datum</span>';

                        detail = `${datum} z ${mistoOdjezdu} v ${casOdjezdu} do ${mistoPrijezdu} v ${casPrijezdu}`;
                    }

                    if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                        if (compact) {
                            detail = `${detail}: Autem ${segment.Kilometry} km`;
                        } else {
                            const kilometry = segment.Kilometry ?
                                `<strong>${segment.Kilometry || 0} km</strong>` :
                                '<span class="text-red-500 font-bold">chybí kilometry</span>';
                            const ridic = segment.isDriver ?
                                `řidič SPZ: <strong>${segment.SPZ ||
                                <span className="text-red-500 font-bold">chybí</span>}</strong>` :
                                'spolujezdec';

                            detail = `${detail}: Autem ${kilometry} jako ${ridic}`;
                        }
                    } else if (segment.Druh_Dopravy === "V") {
                        const naklady = member?.INT_ADR && segment.Naklady && segment.Naklady[member.INT_ADR] > 0 ? segment.Naklady[member.INT_ADR] : 0;
                        detail = `${detail}: Jízdné <strong>${formatCurrency(naklady)}</strong>`;

                        if (!compact && naklady == 0) {
                            detail = `${detail} <span class="text-red-500 font-bold">bez nákaladů</span>`;
                        }

                        if (!compact) {
                            const prilohy = segment.Prilohy && segment.Prilohy.length > 0 ?
                                '<span class="text-green-600">(✓ doklad)</span>' :
                                '<span class="text-orange-500">(⚠ chybí doklad)</span>'

                            detail = `${detail} ${prilohy}`;
                        }
                    } else if (segment.Druh_Dopravy === "P") {
                        detail = `${detail}: Pěšky`;
                    } else if (segment.Druh_Dopravy === "K") {
                        detail = `${detail}: Na kole`;
                    }

                    if (detail) {
                        return (
                            <div key={segment.id || index}
                                 className={`${smallTextSize} text-muted ml-4 ${segment.Druh_Dopravy === "AUV" && !segment.isDriver ? "opacity-65" : ""}`}
                                 dangerouslySetInnerHTML={{__html: detail}}
                            />
                        );
                    }
                    return null;
                })}
            </div>

            <div className={blockStyle}>
                <div className="flex justify-between">
                    <span className={`${textSize} font-medium`}>
                        Stravné
                    </span>
                    <span className={textSize}>{formatCurrency(memberCompensation?.Stravne || 0)}</span>
                </div>
                {!compact && memberCompensation?.Cas_Prace_Celkem > 0 && (
                    <div className={`${smallTextSize} text-muted ml-4`}>
                        Celkem <strong>{memberCompensation.Cas_Prace_Celkem || 0} hodin</strong> práce:
                        {!compact && tariffRates && memberCompensation?.Stravne && (() => {
                            // Najít tarif podle uplatněné výše stravného
                            const tarif = tariffRates.stravneTariffs.find(t =>
                                parseFloat(t.Stravne) === memberCompensation.Stravne
                            );

                            if (tarif) {
                                return (
                                    <span className={`${smallTextSize} text-muted ml-1`}>
                                        {`Uplatněn tarif za ${tarif.Trvani_Od} – ${tarif.Trvani_Do} hodin`}
                                    </span>
                                );
                            }
                            return <span className="text-red-500 font-bold">Chybý údaje k výpočtu</span>;
                        })()}
                    </div>
                )}
            </div>

            <div className={blockStyle}>
                <div className="flex justify-between">
                    <span className={`${textSize} font-medium`}>
                        Náhrada za práci
                    </span>
                    <span className={textSize}>{formatCurrency(memberCompensation?.Nahrada_Prace || 0)}</span>
                </div>
                {!compact && memberCompensation?.Cas_Prace_Celkem > 0 && (
                    <div className={`${smallTextSize} text-muted ml-4`}>
                        Celkem <strong>{memberCompensation.Cas_Prace_Celkem || 0} hodin</strong> práce:
                        {!compact && tariffRates && memberCompensation?.Stravne && (() => {
                            // Najít tarif podle uplatněné výše stravného
                            const tarif = tariffRates.nahradyTariffs.find(t =>
                                parseFloat(t.Nahrada) === memberCompensation.Nahrada_Prace
                            );

                            if (tarif) {
                                return (
                                    <span className={`${smallTextSize} text-muted ml-1`}>
                                        {`Uplatněn tarif za ${tarif.Trvani_Od} – ${tarif.Trvani_Do} hodin`}
                                    </span>
                                );
                            }
                            return <span className="text-red-500 font-bold">Chybý údaje k výpočtu</span>;
                        })()}
                    </div>
                )}
            </div>

            {(memberCompensation?.Noclezne_Celkem || 0) > 0 && (
                <div className={blockStyle}>
                    <div className="flex justify-between">
                        <span className={`${textSize} font-medium`}>Ubytování</span>
                        <span className={textSize}>{formatCurrency(memberCompensation?.Noclezne_Celkem || 0)}</span>
                    </div>
                    {!compact && formData?.Noclezne && formData.Noclezne.length > 0 && (
                        <div className="space-y-1">
                            {formData.Noclezne.filter(noc => noc.Zaplatil == member?.INT_ADR).map((noc, index) => (
                                <div key={noc.id || index} className={`${smallTextSize} text-muted ml-4`}>
                                    <div dangerouslySetInnerHTML={{
                                        __html: `
                                        ${noc.Datum ? new Date(noc.Datum).toLocaleDateString('cs-CZ') : '<span class="text-red-500 font-bold">chybí datum</span>'}:
                                        ${noc.Zarizeni || '<span class="text-red-500 font-bold">chybí zařízení</span>'} 
                                        v ${noc.Misto || '<span class="text-red-500 font-bold">chybí místo</span>'}
                                        za <strong>${formatCurrency(noc.Castka || 0)}</strong>
                                        ${noc.Prilohy && noc.Prilohy.length > 0 ?
                                            `<span class="text-green-600">(✓ doklad)</span>` :
                                            '<span class="text-orange-500">(⚠ chybí doklad)</span>'}
                                    `
                                    }}/>
                                </div>
                            ))}
                            {formData.Noclezne.filter(noc => noc.Zaplatil == member?.INT_ADR).length === 0 && (
                                <div className={`${smallTextSize} text-red-500 ml-4`}>
                                    Žádné ubytování nebylo zaplaceno tímto členem
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {(memberCompensation?.Vedlejsi_Vydaje_Celkem || 0) > 0 && (
                <div className={blockStyle}>
                    <div className="flex justify-between">
                        <span className={`${textSize} font-medium`}>Ostatní výdaje</span>
                        <span
                            className={textSize}>{formatCurrency(memberCompensation?.Vedlejsi_Vydaje_Celkem || 0)}</span>
                    </div>
                    {!compact && formData?.Vedlejsi_Vydaje && formData.Vedlejsi_Vydaje.length > 0 && (
                        <div className="space-y-1">
                            {formData.Vedlejsi_Vydaje.filter(vydaj => vydaj.Zaplatil == member?.INT_ADR).map((vydaj, index) => (
                                <div key={vydaj.id || index} className={`${smallTextSize} text-muted ml-4`}>
                                    <div dangerouslySetInnerHTML={{
                                        __html: `
                                        ${vydaj.Datum ? new Date(vydaj.Datum).toLocaleDateString('cs-CZ') : '<span class="text-red-500 font-bold">chybí datum</span>'}:
                                        ${vydaj.Polozka || '<span class="text-red-500 font-bold">chybí popis položky</span>'}
                                        za <strong>${formatCurrency(vydaj.Castka || 0)}</strong>
                                        ${vydaj.Prilohy && vydaj.Prilohy.length > 0 ?
                                            `<span class="text-green-600">(✓ doklad)</span>` :
                                            '<span class="text-orange-500">(⚠ chybí doklad)</span>'}
                                    `
                                    }}/>
                                </div>
                            ))}
                            {formData.Vedlejsi_Vydaje.filter(vydaj => vydaj.Zaplatil == member?.INT_ADR).length === 0 && (
                                <div className={`${smallTextSize} text-red-500 ml-4`}>
                                    Žádné ostatní výdaje nebyly zaplaceny tímto členem
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className={blockStyle}>
                <div className="flex justify-between">
                    <span className={`font-semibold ${textSize}`}>Celkem</span>
                    <span className={`font-semibold ${compact ? 'text-base' : 'text-lg'} text-blue-500`}>
                    {formatCurrency(memberCompensation?.Celkem_Kc || 0)}
                </span>
                </div>
                { formData.Presmerovani_Vyplat && member && formData.Presmerovani_Vyplat[member.INT_ADR] !== undefined && (
                    <div className={`${smallTextSize} text-muted ml-4`}>
                        Přesměrovat na <strong>{(() => {
                            const targetIntAdr = formData.Presmerovani_Vyplat[member.INT_ADR];
                            // Najít jméno značkaře podle INT_ADR
                            const targetMember = teamMembers?.find(m => m.INT_ADR == targetIntAdr);
                            return targetMember?.name || targetMember?.Znackar || targetIntAdr;
                        })()}</strong>
                    </div>
                )}
            </div>
        </div>
    );
};

export const CompensationSummary = ({
                                        formData,
                                        tariffRates,
                                        calculation,
                                        compact = false,
                                        tariffRatesLoading = false,
                                        tariffRatesError = null,
                                        currentUser,
                                        isLeader,
                                        teamMembers,
                                        readOnly = false,
                                    }) => {
    // ALL HOOKS MUST BE AT THE TOP - React Error #310 fix


    // Create stable calculator functions
    const calculateForAllMembers = useCallback((formData, tariffRates, teamMembers) => {
        return calculateCompensationForAllMembers(formData, tariffRates, teamMembers);
    }, []);

    const calculateForSingleUser = useCallback((formData, tariffRates, userIntAdr) => {
        return calculateCompensation(formData, tariffRates, userIntAdr);
    }, []);

    // Calculate compensation using proper calculator functions
    const compensation = useMemo(() => {
        try {
            // V readOnly módu použít předaná uložená data
            if (readOnly && calculation) {
                return calculation;
            }

            // V editovatelném módu počítat dynamicky
            if (!tariffRates) {
                return null;
            }

            if (isLeader && teamMembers && teamMembers.length > 0) {
                // Leader view - show all team members
                const result = calculateForAllMembers(formData, tariffRates, teamMembers);
                return result;
            } else if (currentUser) {
                // Member view - show only own compensation
                const singleCompensation = calculateForSingleUser(
                    formData,
                    tariffRates,
                    currentUser.INT_ADR
                );

                // Vrátit ve formátu {INT_ADR: compensation} pro konzistenci
                const result = singleCompensation ? {[currentUser.INT_ADR]: singleCompensation} : null;
                return result;
            }

            return null;
        } catch (error) {
            log.error('Error in compensation calculation', error);
            return null;
        }
    }, [readOnly, calculation, formData, tariffRates, isLeader, teamMembers, currentUser, calculateForAllMembers, calculateForSingleUser]);


    // Determine which members to show based on permissions
    const membersToShow = useMemo(() => {
        if (!teamMembers || teamMembers.length === 0) {
            return currentUser ? [currentUser] : [];
        }

        return teamMembers.filter(member =>
            member.INT_ADR == currentUser?.INT_ADR || isLeader
        );
    }, [teamMembers, currentUser, isLeader]);

    // Use already calculated compensations - no need to recalculate here
    const memberCompensations = useMemo(() => {
        if (!compensation) return {};

        const results = {};

        for (const member of membersToShow) {
            // Použít již vypočítanou kompenzaci pokud existuje
            if (compensation[member.INT_ADR]) {
                results[member.INT_ADR] = compensation[member.INT_ADR];
            }
        }

        return results;
    }, [membersToShow, compensation]);

    // Helper function for currency formatting
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK'
        }).format(amount || 0);
    };

    // EARLY RETURNS AFTER ALL HOOKS

    // Show loading state
    if (tariffRatesLoading) {
        return (
            <div className="alert alert--info">
                Načítání ceníku pro výpočet kompenzací...
            </div>
        );
    }

    // Show error state
    if (tariffRatesError) {
        return (
            <div className="alert alert--warning">
                {tariffRatesError}
            </div>
        );
    }

    // Show missing tariff rates
    if (!tariffRates) {
        return (
            <div className="alert alert--warning">
                Ceník není k dispozici pro výpočet kompenzací.
            </div>
        );
    }

    if (!compensation) {
        return (
            <div className="alert alert--warning">
                Kompenzace nejsou k dispozici.
            </div>
        );
    }


    // Unified view - jedna komponenta pro oba módy
    const showMultipleMembers = membersToShow.length > 1;

    return (
        <div className="space-y-4">
            {membersToShow.map((member, index) => (
                <div key={member.INT_ADR}>
                    <MemberCompensationDetail
                        member={member}
                        memberCompensation={memberCompensations[member.INT_ADR]}
                        formData={formData}
                        tariffRates={tariffRates}
                        formatCurrency={formatCurrency}
                        showMemberName={showMultipleMembers}
                        compact={compact}
                        teamMembers={teamMembers}
                    />
                    {showMultipleMembers && index < membersToShow.length - 1 && (
                        <hr className={`my-4 border-gray-300 ${compact ? '' : 'border-b-2'}`}/>
                    )}
                </div>
            ))}
        </div>
    );
};