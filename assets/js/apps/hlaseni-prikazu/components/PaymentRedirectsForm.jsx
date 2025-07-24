import React from 'react';
import { IconUsers, IconInfoCircle } from '@tabler/icons-react';

export const PaymentRedirectsForm = ({
    paymentRedirects,
    onPaymentRedirectsChange,
    teamMembers = [],
    currentUser,
    isLeader,
    disabled = false
}) => {
    const handleRedirectChange = (memberIntAdr, redirectToIntAdr) => {
        const updated = { ...paymentRedirects };
        
        if (redirectToIntAdr && redirectToIntAdr !== memberIntAdr) {
            updated[memberIntAdr] = redirectToIntAdr;
        } else {
            delete updated[memberIntAdr];
        }
        
        onPaymentRedirectsChange(updated);
    };

    // Show payment redirects only for leaders with team members
    if (!isLeader || !teamMembers || teamMembers.length <= 1) {
        return null;
    }

    return (
        <div className="card">
            <div className="card__header">
                <div className="flex items-center gap-2">
                    <IconUsers size={20} />
                    <h3 className="card__title">Přesměrování plateb</h3>
                </div>
            </div>
            <div className="card__content">
                <div className="alert alert--info mb-4">
                    <div className="flex items-start gap-2">
                        <IconInfoCircle size={16} className="mt-0.5" />
                        <div>
                            <p>Můžete přesměrovat náhrady jiných členů týmu na sebe nebo na jiného člena.</p>
                            <p className="text-sm mt-1">Pokud není nastaven redirect, bude náhrada vyplacena přímo členovi.</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {teamMembers.map((member) => {
                        // Skip current user - they can't redirect to themselves
                        if (currentUser && member.int_adr === currentUser.INT_ADR) {
                            return null;
                        }

                        return (
                            <div key={member.int_adr} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                <div>
                                    <span className="font-medium">{member.name}</span>
                                    <span className="text-sm text-gray-600 ml-2">({member.int_adr})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Přesměrovat na:</span>
                                    <select
                                        className="form__select w-48"
                                        value={paymentRedirects[member.int_adr] || ''}
                                        onChange={(e) => handleRedirectChange(member.int_adr, e.target.value)}
                                        disabled={disabled}
                                    >
                                        <option value="">-- Bez přesměrování --</option>
                                        {teamMembers
                                            .filter(m => m.int_adr !== member.int_adr) // Can't redirect to self
                                            .map((targetMember) => (
                                                <option key={targetMember.int_adr} value={targetMember.int_adr}>
                                                    {targetMember.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {Object.keys(paymentRedirects).length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">Aktivní přesměrování:</h4>
                        <div className="space-y-1">
                            {Object.entries(paymentRedirects).map(([fromIntAdr, toIntAdr]) => {
                                const fromMember = teamMembers.find(m => m.int_adr === fromIntAdr);
                                const toMember = teamMembers.find(m => m.int_adr === toIntAdr);
                                
                                if (!fromMember || !toMember) return null;
                                
                                return (
                                    <div key={fromIntAdr} className="text-sm text-blue-700">
                                        {fromMember.name} → {toMember.name}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};