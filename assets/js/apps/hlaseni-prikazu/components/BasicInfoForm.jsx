import React from 'react';
import {IconCalendar} from '@tabler/icons-react';

export const BasicInfoForm = ({
                                  Datum_Provedeni,
                                  Zvysena_Sazba,
                                  onExecutionDateChange,
                                  disabled = false
                              }) => {
    return (
        <div className="card">
            <div className="card__header">
                <div className="flex items-center gap-2">
                    <IconCalendar size={20}/>
                    <h3 className="card__title">Základní údaje</h3>
                </div>
            </div>
            <div className="card__content">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Execution date */}
                    <div>
                        <label className="form__label">Datum provedení *</label>
                        <input
                            type="date"
                            className="form__input"
                            value={Datum_Provedeni ? Datum_Provedeni.toISOString().split('T')[0] : ''}
                            onChange={(e) => onExecutionDateChange(new Date(e.target.value))}
                            disabled={disabled}
                            required
                        />
                    </div>
                </div>

                {/* Higher km rate - READ ONLY display */}
                {Zvysena_Sazba && (
                    <div className="alert alert--info mt-4">
                        <p>Pro tento příkaz je nastavena vyšší sazba za km</p>
                    </div>
                )}
            </div>
        </div>
    );
};