import React from 'react';
import {
    IconCheck,
    IconCashBanknote,
    IconSignRight,
    IconSend
} from '@tabler/icons-react';
import { Loader } from '../../../components/shared/Loader';

export const StepNavigation = ({
    activeStep,
    onStepChange,
    partACompleted,
    partBCompleted,
    head,
    saving,
    status
}) => {
    // Step configuration
    const steps = [
        {
            label: 'Část A - Vyúčtování',
            description: partACompleted ? 'Doprava a výdaje' : 'Doprava a výdaje',
            icon: <IconCashBanknote size={18}/>,
            completed: partACompleted
        },
        {
            label: head?.Druh_ZP === "O" ? 'Část B - Stavy TIM' : 'Část B - Hlášení o činnosti',
            description: head?.Druh_ZP === "O" ? 'Stav informačních míst' : 'Hlášení značkařské činnosti',
            icon: <IconSignRight size={18}/>,
            completed: partBCompleted
        },
        {
            label: 'Odeslání',
            description: 'Kontrola a odeslání',
            icon: <IconSend size={18}/>,
            completed: false
        }
    ];

    return (
        <div className="stepper">
            {steps.map((step, index) => (
                <div
                    key={index}
                    className={`stepper__step ${index === activeStep ? 'stepper__step--active' : ''} ${step.completed ? 'stepper__step--completed' : ''}`}
                    onClick={() => onStepChange(index)}
                >
                    <div className="stepper__icon">
                        {step.completed ? <IconCheck size={18}/> : step.icon}
                    </div>
                    <div className="stepper__content">
                        <div className="stepper__label">{step.label}</div>
                        <div className="stepper__description">
                            {step.description}
                            {!step.completed && index < activeStep && (
                                <span className="badge badge--danger badge--light">
                                    Nedokončeno
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            
            {/* Final submission indicator */}
            <div
                key="send"
                className={`!flex-none stepper__step ${'send' === status ? 'stepper__step--active' : ''} ${'submitted' === status ? 'stepper__step--completed' : ''}`}
            >
                <div className="stepper__icon">
                    {saving ? <Loader size={'small'} color={'white'} center={false}/> : <IconCheck size={18}/>}
                </div>
            </div>
        </div>
    );
};