import React, {useMemo, useCallback, useEffect} from 'react';
import {
    IconCalculator,
    IconCar,
    IconClock,
    IconBed,
    IconReceipt,
    IconArrowRight,
} from '@tabler/icons-react';
import {
    calculateCompensation,
    calculateCompensationForAllMembers,
    extractTeamMembers,
    isUserLeader
} from '../utils/compensationCalculator';

// Member compensation detail component for compact mode
const MemberCompensationDetail = ({
                                      member,
                                      memberCompensation,
                                      formData,
                                      priceList,
                                      formatCurrency,
                                      showMemberName = false
                                  }) => {
    if (!memberCompensation) return null;

    const workHours = memberCompensation.Hodin_Celkem || 0;

    return (
        <div className="space-y-2">
            {showMemberName && (
                <h5 className="font-bold text-sm text-gray-700">{member?.name || member?.Znackar || member?.INT_ADR}</h5>
            )}

            <div className="flex justify-between">
                <span className="text-sm font-medium">Práce celkem</span>
                <span className="text-sm">{workHours.toFixed(1)} h</span>
            </div>

            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="text-sm font-medium">
                        Jízdné
                        {/* Zobrazit konkrétní použitou sazbu pouze pokud je řidičem nějaké auto cesty */}
                        {priceList && (() => {
                            // Zkontrolovat zda je řidičem nějaké auto cesty
                            const isDriverOfAnyCar = formData.Skupiny_Cest?.some(group => 
                                group.Ridic === member?.INT_ADR && 
                                group.Cesty?.some(s => s.Druh_Dopravy === "AUV" || s.Druh_Dopravy === "AUV-Z")
                            );
                            
                            if (!isDriverOfAnyCar) return null;
                            
                            // Zjistit zda má člen zvýšenou sazbu
                            const hasHigherRate = formData.Skupiny_Cest?.some(group => 
                                group.Ridic === member?.INT_ADR && 
                                group.Ma_Zvysenou_Sazbu &&
                                group.Cesty?.some(s => s.Druh_Dopravy === "AUV" || s.Druh_Dopravy === "AUV-Z")
                            );
                            const rate = hasHigherRate ? priceList.jizdneZvysene : priceList.jizdne;
                            return (
                                <span className="text-xs text-gray-500 ml-1">
                                    ({rate || 0} Kč/km)
                                </span>
                            );
                        })()}
                    </span>
                    <span className="text-sm">{formatCurrency(memberCompensation?.Jizdne || 0)}</span>
                </div>
                {/* Badge zvýšené sazby pod názvem */}
                {formData.Skupiny_Cest?.some(group => 
                    group.Ridic === member?.INT_ADR && 
                    group.Ma_Zvysenou_Sazbu &&
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
                    const isDriver = group.Ridic === member?.INT_ADR;
                    
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
                            <div key={segment.id || index} className="text-xs text-gray-600 ml-4">
                                {detail}
                            </div>
                        );
                    }
                    return null;
                })}
            </div>

            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="text-sm font-medium">Stravné</span>
                    <span className="text-sm">{formatCurrency(memberCompensation?.Stravne || 0)}</span>
                </div>
            </div>

            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="text-sm font-medium">Náhrada za práci</span>
                    <span className="text-sm">{formatCurrency(memberCompensation?.Nahrada_Prace || 0)}</span>
                </div>
            </div>

            {(memberCompensation?.Naklady_Ubytovani || 0) > 0 && (
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">Ubytování</span>
                        <span className="text-sm">{formatCurrency(memberCompensation?.Naklady_Ubytovani || 0)}</span>
                    </div>
                </div>
            )}

            {(memberCompensation?.Vedlejsi_Vydaje || 0) > 0 && (
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">Ostatní výdaje</span>
                        <span className="text-sm">{formatCurrency(memberCompensation?.Vedlejsi_Vydaje || 0)}</span>
                    </div>
                </div>
            )}

            <div className="flex justify-between">
                <span className="font-semibold">Celkem</span>
                <span className="font-semibold text-lg text-blue-600">
                    {formatCurrency(memberCompensation?.celkem || 0)}
                </span>
            </div>
        </div>
    );
};

export const CompensationSummary = ({
                                        formData,
                                        priceList,
                                        compact = false,
                                        priceListLoading = false,
                                        priceListError = null,
                                        currentUser,
                                        isLeader,
                                        teamMembers,
                                        head
                                    }) => {
    // ALL HOOKS MUST BE AT THE TOP - React Error #310 fix

    // Debug logging for Error #310 identification
    useEffect(() => {
        console.log('CompensationSummary debug:', {
            hasFormData: !!formData,
            hasPriceList: !!priceList,
            hasCurrentUser: !!currentUser,
            isLeader,
            teamMembersCount: teamMembers?.length || 0,
            compact,
            formDataKeys: formData ? Object.keys(formData) : [],
            priceListKeys: priceList ? Object.keys(priceList) : []
        });
    }, [formData, priceList, currentUser, isLeader, teamMembers, compact]);

    // Create stable calculator functions
    const calculateForAllMembers = useCallback((formData, priceList, teamMembers) => {
        return calculateCompensationForAllMembers(formData, priceList, teamMembers);
    }, []);

    const calculateForSingleUser = useCallback((formData, priceList, userIntAdr) => {
        return calculateCompensation(formData, priceList, userIntAdr);
    }, []);

    // Calculate compensation using proper calculator functions
    const compensation = useMemo(() => {
        try {
            console.log('Calculating compensation...', {
                hasPriceList: !!priceList,
                isLeader,
                teamMembersLength: teamMembers?.length || 0,
                hasCurrentUser: !!currentUser
            });

            if (!priceList) {
                console.log('No price list, returning null');
                return null;
            }

            if (isLeader && teamMembers && teamMembers.length > 0) {
                console.log('Calculating for team members...');
                // Leader view - show all team members
                const result = calculateForAllMembers(formData, priceList, teamMembers);
                console.log('Team calculation result:', result);
                return result;
            } else if (currentUser) {
                console.log('Calculating for single user...', currentUser.INT_ADR);
                // Member view - show only own compensation
                const singleCompensation = calculateForSingleUser(
                    formData,
                    priceList,
                    currentUser.INT_ADR
                );

                console.log('Single compensation result:', singleCompensation);

                // Vrátit ve formátu {INT_ADR: compensation} pro konzistenci
                const result = singleCompensation ? {[currentUser.INT_ADR]: singleCompensation} : null;
                console.log('Formatted result:', result);
                return result;
            }

            console.log('No conditions met, returning null');
            return null;
        } catch (error) {
            console.error('Error in compensation calculation:', error);
            return null;
        }
    }, [formData, priceList, isLeader, teamMembers, currentUser, calculateForAllMembers, calculateForSingleUser]);

    // Pro zobrazení celkových hodin - pokud je compensation objekt podle INT_ADR, vezmi první hodnotu
    const workHours = useMemo(() => {
        if (!compensation) return 0;
        if (typeof compensation === 'object' && !Array.isArray(compensation)) {
            const firstCompensation = Object.values(compensation)[0];
            return firstCompensation?.Hodin_Celkem || 0;
        }
        return 0;
    }, [compensation]);

    // Pro single view použít první dostupnou kompenzaci
    const singleCompensation = useMemo(() => {
        if (!compensation) return null;
        const firstKey = Object.keys(compensation)[0];
        return compensation[firstKey] || null;
    }, [compensation]);

    // Determine which members to show based on permissions
    const membersToShow = useMemo(() => {
        if (!teamMembers || teamMembers.length === 0) {
            return currentUser ? [currentUser] : [];
        }

        return teamMembers.filter(member =>
            member.INT_ADR === currentUser?.INT_ADR || isLeader
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
    if (priceListLoading) {
        return (
            <div className="alert alert--info">
                Načítání ceníku pro výpočet kompenzací...
            </div>
        );
    }

    // Show error state
    if (priceListError) {
        return (
            <div className="alert alert--warning">
                {priceListError}
            </div>
        );
    }

    // Show missing price list
    if (!priceList) {
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

    // Handle both single compensation and team compensations
    // Compensation je nyní vždy objekt indexovaný podle INT_ADR
    const isTeamView = isLeader && compensation && Object.keys(compensation).length > 1;
    const teamCompensations = compensation;

    // Compact mode for sidebar - unified view using MemberCompensationDetail
    if (compact) {
        const showMultipleMembers = membersToShow.length > 1;

        return (
            <div className="space-y-4">
                {membersToShow.map((member, index) => (
                    <div key={member.INT_ADR}>
                        <MemberCompensationDetail
                            member={member}
                            memberCompensation={memberCompensations[member.INT_ADR]}
                            formData={formData}
                            priceList={priceList}
                            formatCurrency={formatCurrency}
                            showMemberName={showMultipleMembers}
                        />
                        {showMultipleMembers && index < membersToShow.length - 1 && (
                            <hr className="my-4 border-gray-300"/>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // Full mode - detailed view
    return (
        <div className="space-y-6">
            {/* Work overview */}
            <div className="card">
                <div className="card__content">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold">Přehled práce</h4>
                        <div
                            className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            <IconClock size={14}/>
                            {workHours.toFixed(1)} hodin
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Celková doba práce</p>
                            <p className="font-medium">{workHours.toFixed(1)} hodin</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Od nejdřívějšího začátku do nejpozdějšího konce cesty
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Použitý tarif</p>
                            <p className="font-medium">
                                {singleCompensation?.appliedTariff
                                    ? `${singleCompensation.appliedTariff.dobaOd}-${singleCompensation.appliedTariff.dobaDo}h`
                                    : "Není stanoven"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Team view for leaders */}
            {isTeamView && teamCompensations && (
                <div className="card">
                    <div className="card__content">
                        <h4 className="text-lg font-semibold mb-4">Kompenzace pro tým</h4>
                        <div className="space-y-4">
                            {Object.entries(teamCompensations).map(([intAdr, memberComp]) => {
                                const member = teamMembers.find(m => m.INT_ADR === intAdr);
                                return (
                                    <div key={intAdr} className="border rounded-lg p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-medium">{member?.name || intAdr}</h5>
                                            <span className="font-bold text-blue-600">
                                                {formatCurrency(memberComp.celkem)}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>Doprava: {formatCurrency(memberComp.Jizdne)}</div>
                                            <div>Stravné: {formatCurrency(memberComp.Stravne)}</div>
                                            <div>Práce: {formatCurrency(memberComp.Nahrada_Prace)}</div>
                                            <div>Ubytování: {formatCurrency(memberComp.Naklady_Ubytovani)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Single member detailed view */}
            {!isTeamView && (
                <>
                    {/* Transport costs */}
                    <div className="card">
                        <div className="card__content">
                            <h4 className="text-lg font-semibold mb-4">Dopravní náklady</h4>

                            <div className="overflow-x-auto">
                                <table className="table">
                                    <thead>
                                    <tr>
                                        <th>Segment</th>
                                        <th>Typ dopravy</th>
                                        <th>Množství</th>
                                        <th>Sazba</th>
                                        <th>Náklady</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {formData.Skupiny_Cest?.flatMap((group, groupIndex) => 
                                        (group.Cesty || []).map((segment, segmentIndex) => {
                                            if (!segment || !segment.Druh_Dopravy) return null;

                                            let amount = 0;
                                            let unit = "";
                                            let rate = 0;
                                            let costs = 0;
                                            let showHigherRate = false;

                                            if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                                                amount = segment.Kilometry || 0;
                                                unit = "km";
                                                
                                                // Použít správnou sazbu podle skupiny - pouze pokud je current user řidičem
                                                const isCurrentUserDriver = group.Ridic === currentUser?.INT_ADR;
                                                showHigherRate = isCurrentUserDriver && group.Ma_Zvysenou_Sazbu;
                                                
                                                if (isCurrentUserDriver) {
                                                    rate = showHigherRate ? (priceList.jizdneZvysene || 0) : (priceList.jizdne || 0);
                                                    costs = amount * rate;
                                                } else {
                                                    // Pokud není řidičem, nezobrazovat náklady
                                                    rate = 0;
                                                    costs = 0;
                                                }
                                            } else if (segment.Druh_Dopravy === "V") {
                                                costs = segment.Naklady || 0;
                                                unit = "Kč";
                                            }

                                            return (
                                                <tr key={`${groupIndex}-${segmentIndex}`}>
                                                    <td>Segment {groupIndex + 1}-{segmentIndex + 1}</td>
                                                    <td>
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                                                {segment.Druh_Dopravy}
                                                            </span>
                                                            {showHigherRate && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                                    Zvýšená
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {amount > 0 ? `${amount} ${unit}` : "-"}
                                                    </td>
                                                    <td>
                                                        {rate > 0 ? formatCurrency(rate) : "-"}
                                                    </td>
                                                    <td className="font-medium">
                                                        {formatCurrency(costs)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) || []}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Other costs */}
                    {(formData.Noclezne.length > 0 || formData.Vedlejsi_Vydaje.length > 0) && (
                        <div className="card">
                            <div className="card__content">
                                <h4 className="text-lg font-semibold mb-4">Ostatní náklady</h4>

                                {formData.Noclezne.length > 0 && (
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <IconBed size={16}/>
                                            <span className="font-medium">Nocležné</span>
                                        </div>
                                        {formData.Noclezne.map(acc => (
                                            <div key={acc.id} className="mb-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm">
                                                        {acc.Zarizeni}, {acc.Misto}
                                                    </span>
                                                    <span className="font-medium">{formatCurrency(acc.Castka)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {formData.Vedlejsi_Vydaje.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <IconReceipt size={16}/>
                                            <span className="font-medium">Vedlejší výdaje</span>
                                        </div>
                                        {formData.Vedlejsi_Vydaje.map(exp => (
                                            <div key={exp.id} className="mb-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm">{exp.Polozka}</span>
                                                    <span className="font-medium">{formatCurrency(exp.Castka)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Total summary */}
                    <div className="card">
                        <div className="card__content">
                            <h4 className="text-lg font-semibold mb-4">Celkový souhrn kompenzací</h4>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span>Dopravní náklady</span>
                                    <span
                                        className="font-medium">{formatCurrency(singleCompensation?.Jizdne || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Stravné</span>
                                    <span
                                        className="font-medium">{formatCurrency(singleCompensation?.Stravne || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Náhrada za práci</span>
                                    <span
                                        className="font-medium">{formatCurrency(singleCompensation?.Nahrada_Prace || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Nocležné</span>
                                    <span
                                        className="font-medium">{formatCurrency(singleCompensation?.Naklady_Ubytovani || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Vedlejší výdaje</span>
                                    <span
                                        className="font-medium">{formatCurrency(singleCompensation?.Vedlejsi_Vydaje || 0)}</span>
                                </div>
                                <hr className="my-3"/>
                                <div className="flex justify-between">
                                    <span className="text-lg font-bold">Celkem</span>
                                    <span
                                        className="text-lg font-bold">{formatCurrency(singleCompensation?.celkem || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};