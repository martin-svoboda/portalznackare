import React, { useMemo } from 'react';
import {
    IconCalculator,
    IconCar,
    IconClock,
    IconBed,
    IconReceipt,
    IconArrowRight,
} from '@tabler/icons-react';

export const CompensationSummary = ({ formData, compensation, priceList, compact = false, priceListLoading = false, priceListError = null }) => {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK'
        }).format(amount || 0);
    };

    const calculateWorkHours = () => {
        if (!formData.travelSegments || formData.travelSegments.length === 0) return 0;

        let earliestStart = null;
        let latestEnd = null;

        formData.travelSegments.forEach(segment => {
            if (segment.startTime && segment.endTime) {
                const startTime = new Date(`1970-01-01T${segment.startTime}:00`);
                const endTime = new Date(`1970-01-01T${segment.endTime}:00`);

                if (!earliestStart || startTime < earliestStart) {
                    earliestStart = startTime;
                }
                if (!latestEnd || endTime > latestEnd) {
                    latestEnd = endTime;
                }
            }
        });

        if (earliestStart && latestEnd) {
            const diffMs = latestEnd - earliestStart;
            return diffMs / (1000 * 60 * 60); // Convert to hours
        }

        return 0;
    };

    const workHours = calculateWorkHours();

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
    
    // Debug information - show in development
    if (process.env.NODE_ENV === 'development') {
        console.log('CompensationSummary - priceList:', priceList);
        console.log('CompensationSummary - compensation:', compensation);
    }

    if (!compensation) {
        return (
            <div className="alert alert--warning">
                Kompenzace nejsou k dispozici.
            </div>
        );
    }

    // Compact mode for sidebar
    if (compact) {
        return (
            <div className="space-y-3">
                <div className="flex justify-between">
                    <span className="text-sm font-medium">Práce celkem</span>
                    <span className="text-sm">{workHours.toFixed(1)} h</span>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">
                            Jízdné
                            {priceList && (
                                <span className="text-xs text-gray-500 ml-1">
                                    ({formData.higherKmRate ? priceList.jizdneZvysene || 0 : priceList.jizdne || 0} Kč/km)
                                </span>
                            )}
                        </span>
                        <span className="text-sm">{formatCurrency(compensation.transport)}</span>
                    </div>
                    {/* Details for transport costs */}
                    {formData.travelSegments.map((segment, index) => {
                        if (!segment || !segment.transportType) return null;

                        let detail = "";
                        if (segment.transportType === "AUV" || segment.transportType === "AUV-Z") {
                            if (segment.kilometers > 0) {
                                detail = `${segment.startPlace} - ${segment.endPlace}: ${segment.kilometers} km`;
                            }
                        } else if (segment.transportType === "veřejná doprava" && segment.ticketCosts > 0) {
                            detail = `${segment.startPlace} - ${segment.endPlace}: Jízdenky ${formatCurrency(segment.ticketCosts)}`;
                        }

                        if (detail) {
                            return (
                                <div key={segment.id} className="text-xs text-gray-600 ml-4">
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
                        <span className="text-sm">{formatCurrency(compensation.meals)}</span>
                    </div>
                    {workHours > 0 && (
                        <div className="text-xs text-gray-600 ml-4">
                            Za {workHours.toFixed(1)} hodin práce
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">Náhrada za práci</span>
                        <span className="text-sm">{formatCurrency(compensation.work)}</span>
                    </div>
                    {workHours > 0 && (
                        <div className="text-xs text-gray-600 ml-4">
                            Za {workHours.toFixed(1)} hodin práce
                        </div>
                    )}
                </div>

                {compensation.accommodation > 0 && (
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Ubytování</span>
                            <span className="text-sm">{formatCurrency(compensation.accommodation)}</span>
                        </div>
                        {formData.accommodations.map(acc => (
                            <div key={acc.id} className="text-xs text-gray-600 ml-4">
                                {acc.facility}, {acc.place}: {formatCurrency(acc.amount)}
                            </div>
                        ))}
                    </div>
                )}

                {compensation.additional > 0 && (
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Ostatní výdaje</span>
                            <span className="text-sm">{formatCurrency(compensation.additional)}</span>
                        </div>
                        {formData.additionalExpenses.map(exp => (
                            <div key={exp.id} className="text-xs text-gray-600 ml-4">
                                {exp.description}: {formatCurrency(exp.amount)}
                            </div>
                        ))}
                    </div>
                )}

                <hr className="my-3" />
                <div className="flex justify-between">
                    <span className="font-semibold">Celkem k vyplacení</span>
                    <span className="font-semibold text-lg text-blue-600">
                        {formatCurrency(compensation.total)}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Work overview */}
            <div className="card">
                <div className="card__content">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold">Přehled práce</h4>
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            <IconClock size={14} />
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
                                {compensation.appliedTariff
                                    ? `${compensation.appliedTariff.dobaOd}-${compensation.appliedTariff.dobaDo}h`
                                    : "Není stanoven"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

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
                                {formData.travelSegments.map((segment, index) => {
                                    if (!segment || !segment.transportType) return null;

                                    let amount = 0;
                                    let unit = "";
                                    let rate = 0;
                                    let costs = 0;

                                    if (segment.transportType === "AUV" || segment.transportType === "AUV-Z") {
                                        amount = segment.kilometers || 0;
                                        unit = "km";
                                        rate = formData.higherKmRate ? priceList.jizdneZvysene || 0 : priceList.jizdne || 0;
                                        costs = amount * rate;
                                    } else if (segment.transportType === "veřejná doprava") {
                                        costs = segment.ticketCosts || 0;
                                        unit = "Kč";
                                    }

                                    return (
                                        <tr key={segment.id}>
                                            <td>Segment {index + 1}</td>
                                            <td>
                                                <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                                    {segment.transportType}
                                                </span>
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
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Other costs */}
            {(formData.accommodations.length > 0 || formData.additionalExpenses.length > 0) && (
                <div className="card">
                    <div className="card__content">
                        <h4 className="text-lg font-semibold mb-4">Ostatní náklady</h4>

                        {formData.accommodations.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <IconBed size={16} />
                                    <span className="font-medium">Nocležné</span>
                                </div>
                                {formData.accommodations.map(acc => (
                                    <div key={acc.id} className="mb-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm">
                                                {acc.facility}, {acc.place}
                                            </span>
                                            <span className="font-medium">{formatCurrency(acc.amount)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {formData.additionalExpenses.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <IconReceipt size={16} />
                                    <span className="font-medium">Vedlejší výdaje</span>
                                </div>
                                {formData.additionalExpenses.map(exp => (
                                    <div key={exp.id} className="mb-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm">{exp.description}</span>
                                            <span className="font-medium">{formatCurrency(exp.amount)}</span>
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
                            <span className="font-medium">{formatCurrency(compensation.transport)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Stravné</span>
                            <span className="font-medium">{formatCurrency(compensation.meals)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Náhrada za práci</span>
                            <span className="font-medium">{formatCurrency(compensation.work)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Nocležné</span>
                            <span className="font-medium">{formatCurrency(compensation.accommodation)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Vedlejší výdaje</span>
                            <span className="font-medium">{formatCurrency(compensation.additional)}</span>
                        </div>
                        <hr className="my-3" />
                        <div className="flex justify-between">
                            <span className="text-lg font-bold">Celkem</span>
                            <span className="text-lg font-bold">{formatCurrency(compensation.total)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary details */}
            <div className="card">
                <div className="card__content">
                    <h5 className="font-semibold mb-3">Souhrn pro kontrolu</h5>
                    
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between">
                                <span className="text-sm font-medium">Jízdné</span>
                                <span className="text-sm">{formatCurrency(compensation.transport)}</span>
                            </div>
                            {/* Details for transport costs */}
                            {formData.travelSegments.map((segment, index) => {
                                if (!segment || !segment.transportType) return null;

                                let detail = "";
                                if (segment.transportType === "AUV" || segment.transportType === "AUV-Z") {
                                    if (segment.kilometers > 0) {
                                        detail = `${segment.startPlace} - ${segment.endPlace}: ${segment.kilometers} km`;
                                    }
                                } else if (segment.transportType === "veřejná doprava" && segment.ticketCosts > 0) {
                                    detail = `${segment.startPlace} - ${segment.endPlace}: Jízdenky ${formatCurrency(segment.ticketCosts)}`;
                                }

                                if (detail) {
                                    return (
                                        <div key={segment.id} className="text-xs text-gray-600 ml-4">
                                            {detail}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>

                        <div>
                            <div className="flex justify-between">
                                <span className="text-sm font-medium">Stravné</span>
                                <span className="text-sm">{formatCurrency(compensation.meals)}</span>
                            </div>
                            {workHours > 0 && (
                                <div className="text-xs text-gray-600 ml-4">
                                    Za {workHours.toFixed(1)} hodin práce
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between">
                                <span className="text-sm font-medium">Náhrada za práci</span>
                                <span className="text-sm">{formatCurrency(compensation.work)}</span>
                            </div>
                            {workHours > 0 && (
                                <div className="text-xs text-gray-600 ml-4">
                                    Za {workHours.toFixed(1)} hodin práce
                                </div>
                            )}
                        </div>

                        {compensation.accommodation > 0 && (
                            <div>
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium">Ubytování</span>
                                    <span className="text-sm">{formatCurrency(compensation.accommodation)}</span>
                                </div>
                                {formData.accommodations.map(acc => (
                                    <div key={acc.id} className="text-xs text-gray-600 ml-4">
                                        {acc.facility}, {acc.place}: {formatCurrency(acc.amount)}
                                    </div>
                                ))}
                            </div>
                        )}

                        {compensation.additional > 0 && (
                            <div>
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium">Ostatní výdaje</span>
                                    <span className="text-sm">{formatCurrency(compensation.additional)}</span>
                                </div>
                                {formData.additionalExpenses.map(exp => (
                                    <div key={exp.id} className="text-xs text-gray-600 ml-4">
                                        {exp.description}: {formatCurrency(exp.amount)}
                                    </div>
                                ))}
                            </div>
                        )}

                        <hr />
                        <div className="flex justify-between">
                            <span className="font-semibold">Celkem k vyplacení</span>
                            <span className="font-semibold text-lg text-blue-600">
                                {formatCurrency(compensation.total)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};