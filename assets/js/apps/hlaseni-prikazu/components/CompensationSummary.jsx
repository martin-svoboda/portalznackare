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
                                      compact = false
                                  }) => {
    if (!memberCompensation) return null;

    const workHours = memberCompensation.Cas_Prace_Celkem || 0;

    const textSize = compact ? "text-sm" : "text-base";
    const smallTextSize = compact ? "text-xs" : "text-sm";
    const blockStyle = compact ? "space-y-1" : "space-y-2 mb-2 border-b border-gray-200 dark:border-gray-700 pb-3";

    console.log(memberCompensation);
    console.log(formData);

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
                            if (!den ) return <span key={index} className="text-red-500">Žádný počátek a konec cesty - nelze vypočítat</span>;

                            return (
                                <div key={index}
                                     className={`${smallTextSize} text-muted ml-4 flex justify-between`}>
                                    <div>
                                    <span>{den.Datum ? new Date(den.Datum).toLocaleDateString('cs-CZ') : <span className="text-red-500">chybí datum</span>}</span>
                                    <span> od {den.Od || <span className="text-red-500">chybí čas</span>}</span>
                                    <span> do {den.Do || <span className="text-red-500">chybí čas</span>}</span>
                                    </div>
                                    <span>{den.Cas} h</span>
                                </div>
                            );
                        }) : 
                        <span className={`${smallTextSize} text-red-500 ml-4`}>Žádný počátek a konec cesty - nelze vypočítat</span>
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

                    if (!isParticipant && !isDriver) {
                        return [];
                    }

                    // Filter segments based on transport type and member role
                    return (group.Cesty || []).filter(segment => {
                        if (!segment || !segment.Druh_Dopravy) return false;

                        // Pro auto cesty - pouze pokud je řidičem
                        if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                            return isDriver;
                        }

                        // Pro ostatní cesty (V, P, K) - pokud je cestujícím
                        return isParticipant;
                    });
                }) || []).map((segment, index) => {
                    if (!segment || !segment.Druh_Dopravy) return null;

                    let detail = "";
                    if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                        if (segment.Kilometry > 0) {
                            detail = `${segment.Misto_Odjezdu} - ${segment.Misto_Prijezdu}: Autem ${segment.Kilometry} km`;
                        }
                    } else if (segment.Druh_Dopravy === "V" && segment.Naklady > 0) {
                        detail = `${segment.Misto_Odjezdu} - ${segment.Misto_Prijezdu}: Jízdenky ${formatCurrency(segment.Naklady)}`;
                    }

                    if (detail) {
                        return (
                            <div key={segment.id || index} className={`${smallTextSize} text-muted ml-4`}>
                                {detail}
                            </div>
                        );
                    }
                    return null;
                })}
            </div>

            <div className={blockStyle}>
                <div className="flex justify-between">
                    <span className={`${textSize} font-medium`}>Stravné</span>
                    <span className={textSize}>{formatCurrency(memberCompensation?.Stravne || 0)}</span>
                </div>
            </div>

            <div className={blockStyle}>
                <div className="flex justify-between">
                    <span className={`${textSize} font-medium`}>Náhrada za práci</span>
                    <span className={textSize}>{formatCurrency(memberCompensation?.Nahrada_Prace || 0)}</span>
                </div>
            </div>

            {(memberCompensation?.Noclezne_Celkem || 0) > 0 && (
                <div className={blockStyle}>
                    <div className="flex justify-between">
                        <span className={`${textSize} font-medium`}>Ubytování</span>
                        <span className={textSize}>{formatCurrency(memberCompensation?.Noclezne_Celkem || 0)}</span>
                    </div>
                </div>
            )}

            {(memberCompensation?.Vedlejsi_Vydaje_Celkem || 0) > 0 && (
                <div className={blockStyle}>
                    <div className="flex justify-between">
                        <span className={`${textSize} font-medium`}>Ostatní výdaje</span>
                        <span
                            className={textSize}>{formatCurrency(memberCompensation?.Vedlejsi_Vydaje_Celkem || 0)}</span>
                    </div>
                </div>
            )}

            <div className="flex justify-between">
                <span className={`font-semibold ${textSize}`}>Celkem</span>
                <span className={`font-semibold ${compact ? 'text-base' : 'text-lg'} text-blue-500`}>
                    {formatCurrency(memberCompensation?.Celkem_Kc || 0)}
                </span>
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
                    />
                    {showMultipleMembers && index < membersToShow.length - 1 && (
                        <hr className={`my-4 border-gray-300 ${ compact ? '' : 'border-b-2' }`}/>
                    )}
                </div>
            ))}
        </div>
    );
};