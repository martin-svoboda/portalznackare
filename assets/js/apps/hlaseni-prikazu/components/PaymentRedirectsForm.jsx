import React from 'react';
import { IconUsers, IconInfoCircle } from '@tabler/icons-react';

export const PaymentRedirectsForm = ({
    Presmerovani_Vyplat,
    onPresmerovanivyplatChange,
    teamMembers = [],
    currentUser,
    isLeader,
    disabled = false
}) => {
    const redirects = Presmerovani_Vyplat || {};

    // Členi, kteří jsou cílem přesměrování (nemohou sami přesměrovávat)
    const redirectTargets = new Set(Object.values(redirects).map(String));
    // Členi, kteří přesměrovávají (nemohou být cílem)
    const redirectSources = new Set(Object.keys(redirects).map(String));

    const handleRedirectChange = (memberIntAdr, redirectToIntAdr) => {
        const updated = { ...redirects };

        if (redirectToIntAdr && redirectToIntAdr !== memberIntAdr) {
            updated[memberIntAdr] = redirectToIntAdr;
        } else {
            delete updated[memberIntAdr];
        }

        onPresmerovanivyplatChange(updated);
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
                        const memberIntAdr = String(member.INT_ADR);
                        const isCurrentUser = currentUser && member.INT_ADR == currentUser.INT_ADR;
                        // Člen je cílem přesměrování → nemůže sám přesměrovávat
                        const isTarget = redirectTargets.has(memberIntAdr);

                        // Dostupní příjemci: ne on sám, ne ten kdo již přesměrovává
                        const availableTargets = teamMembers.filter(m => {
                            const targetIntAdr = String(m.INT_ADR);
                            if (targetIntAdr === memberIntAdr) return false; // ne sám na sebe
                            if (redirectSources.has(targetIntAdr)) return false; // ten kdo přesměrovává nemůže být cílem
                            return true;
                        });

                        return (
                            <div key={member.INT_ADR} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                <div>
                                    <span className="font-medium">{member.name || member.Znackar}</span>
                                    {isCurrentUser && <span className="text-sm text-blue-600 ml-2">(Vy)</span>}
                                    {!isCurrentUser && <span className="text-sm text-gray-600 ml-2">({member.INT_ADR})</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Přesměrovat na:</span>
                                    <select
                                        className="form__select w-48"
                                        value={redirects[member.INT_ADR] || ''}
                                        onChange={(e) => handleRedirectChange(member.INT_ADR, e.target.value)}
                                        disabled={disabled || isTarget}
                                        title={isTarget ? 'Tento člen je příjemcem přesměrování a nemůže dále přesměrovávat' : ''}
                                    >
                                        <option value="">-- Bez přesměrování --</option>
                                        {availableTargets.map((targetMember) => (
                                            <option key={targetMember.INT_ADR} value={targetMember.INT_ADR}>
                                                {targetMember.name || targetMember.Znackar}
                                            </option>
                                        ))}
                                    </select>
                                    {isTarget && (
                                        <span className="text-xs text-amber-600" title="Příjemce přesměrování">příjemce</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {Object.keys(Presmerovani_Vyplat || {}).length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">Aktivní přesměrování:</h4>
                        <div className="space-y-1">
                            {Object.entries(Presmerovani_Vyplat || {}).map(([fromIntAdr, toIntAdr]) => {
                                const fromMember = teamMembers.find(m => m.INT_ADR == fromIntAdr);
                                const toMember = teamMembers.find(m => m.INT_ADR == toIntAdr);
                                
                                if (!fromMember || !toMember) return null;
                                
                                return (
                                    <div key={fromIntAdr} className="text-sm text-blue-700">
                                        {fromMember.name || fromMember.Znackar} → {toMember.name || toMember.Znackar}
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