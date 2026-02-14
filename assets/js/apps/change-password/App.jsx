import React, { useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { IconEye, IconEyeOff, IconCheck, IconX, IconLoader2, IconLock } from '@tabler/icons-react';
import { createDebugLogger } from '../../utils/debug';

const logger = createDebugLogger('ChangePassword');

const PASSWORD_RULES = [
    { test: (p) => p.length >= 8, label: 'Alespoň 8 znaků' },
    { test: (p) => /[A-Z]/.test(p), label: 'Alespoň 1 velké písmeno' },
    { test: (p) => /[a-z]/.test(p), label: 'Alespoň 1 malé písmeno' },
    { test: (p) => /[0-9]/.test(p), label: 'Alespoň 1 číslice' },
    { test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p), label: 'Alespoň 1 speciální znak' },
];

function validatePassword(password) {
    return PASSWORD_RULES.map(rule => ({
        ...rule,
        passed: rule.test(password),
    }));
}

const PasswordInput = memo(function PasswordInput({ id, label, value, onChange, disabled, error }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="form__group">
            <label htmlFor={id} className="form__label form__label--required">{label}</label>
            <div className="form__input-wrapper">
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={`form__input form__input--with-icon${error ? ' form__input--error' : ''}`}
                    autoComplete="off"
                />
                <button
                    type="button"
                    className={`form__input-icon form__input-icon--toggle${visible ? ' is-visible' : ''}`}
                    onClick={() => setVisible(v => !v)}
                    tabIndex={-1}
                    aria-label={visible ? 'Skrýt heslo' : 'Zobrazit heslo'}
                >
                    {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
            </div>
            {error && <p className="form__help form__help--error">{error}</p>}
        </div>
    );
});

const PasswordStrength = memo(function PasswordStrength({ password }) {
    if (!password) return null;

    const results = validatePassword(password);
    const passedCount = results.filter(r => r.passed).length;

    return (
        <div className="mt-2 space-y-1">
            <div className="flex gap-1 mb-2">
                {results.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                            i < passedCount
                                ? passedCount <= 2 ? 'bg-red-500' : passedCount <= 4 ? 'bg-yellow-500' : 'bg-green-500'
                                : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                    />
                ))}
            </div>
            <ul className="space-y-0.5">
                {results.map((rule, i) => (
                    <li key={i} className={`flex items-center gap-1.5 text-xs ${
                        rule.passed
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                    }`}>
                        {rule.passed
                            ? <IconCheck size={12} />
                            : <IconX size={12} />
                        }
                        {rule.label}
                    </li>
                ))}
            </ul>
        </div>
    );
});

export default function App() {
    const [isOpen, setIsOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [formData, setFormData] = useState({
        Stare_Heslo: '',
        Nove_Heslo: '',
        Nove_Heslo_Potvrzeni: '',
    });

    const resetForm = () => {
        setFormData({ Stare_Heslo: '', Nove_Heslo: '', Nove_Heslo_Potvrzeni: '' });
        setFieldErrors({});
        setError('');
        setSuccess('');
    };

    const handleOpen = () => {
        resetForm();
        setIsOpen(true);
        logger.lifecycle('Password change modal opened');
    };

    const handleClose = () => {
        if (submitting) return;
        setIsOpen(false);
        resetForm();
        logger.lifecycle('Password change modal closed');
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setFieldErrors(prev => ({ ...prev, [field]: '' }));
        setError('');
    };

    const validate = () => {
        const errors = {};

        if (!formData.Stare_Heslo) {
            errors.Stare_Heslo = 'Zadejte současné heslo';
        }
        if (!formData.Nove_Heslo) {
            errors.Nove_Heslo = 'Zadejte nové heslo';
        } else {
            const rules = validatePassword(formData.Nove_Heslo);
            if (rules.some(r => !r.passed)) {
                errors.Nove_Heslo = 'Nové heslo nesplňuje všechny požadavky';
            }
        }
        if (!formData.Nove_Heslo_Potvrzeni) {
            errors.Nove_Heslo_Potvrzeni = 'Potvrďte nové heslo';
        } else if (formData.Nove_Heslo !== formData.Nove_Heslo_Potvrzeni) {
            errors.Nove_Heslo_Potvrzeni = 'Hesla se neshodují';
        }

        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const errors = validate();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setSubmitting(true);
        setError('');
        logger.api('POST', '/api/insyz/update-password', { fields: Object.keys(formData) });

        try {
            const response = await fetch('/api/insyz/update-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await response.json();
            logger.api('POST', '/api/insyz/update-password', null, { status: response.status });

            if (!response.ok) {
                throw new Error(result.error || 'Nastala neočekávaná chyba');
            }

            setSuccess('Heslo bylo úspěšně změněno');
            setFormData({ Stare_Heslo: '', Nove_Heslo: '', Nove_Heslo_Potvrzeni: '' });
            setFieldErrors({});
            logger.lifecycle('Password changed successfully');

            setTimeout(() => {
                setIsOpen(false);
                setSuccess('');
            }, 2000);

        } catch (err) {
            logger.error('Password change failed', err);
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button className="btn btn--secondary" onClick={handleOpen}>
                Změnit
            </button>

            {isOpen && createPortal(
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
                    onClick={handleBackdropClick}
                >
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <IconLock size={20} className="text-blue-600 dark:text-blue-400" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Změna hesla
                                </h3>
                            </div>
                            <button
                                onClick={handleClose}
                                disabled={submitting}
                                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSubmit}>
                            <div className="p-4 space-y-4">
                                {error && (
                                    <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                                    </div>
                                )}
                                {success && (
                                    <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                                        <div className="flex items-center gap-2">
                                            <IconCheck size={16} className="text-green-600 dark:text-green-400" />
                                            <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
                                        </div>
                                    </div>
                                )}

                                {!success && (
                                    <>
                                        <PasswordInput
                                            id="stare_heslo"
                                            label="Současné heslo"
                                            value={formData.Stare_Heslo}
                                            onChange={(v) => handleChange('Stare_Heslo', v)}
                                            disabled={submitting}
                                            error={fieldErrors.Stare_Heslo}
                                        />

                                        <PasswordInput
                                            id="nove_heslo"
                                            label="Nové heslo"
                                            value={formData.Nove_Heslo}
                                            onChange={(v) => handleChange('Nove_Heslo', v)}
                                            disabled={submitting}
                                            error={fieldErrors.Nove_Heslo}
                                        />
                                        <PasswordStrength password={formData.Nove_Heslo} />

                                        <PasswordInput
                                            id="nove_heslo_potvrzeni"
                                            label="Potvrzení nového hesla"
                                            value={formData.Nove_Heslo_Potvrzeni}
                                            onChange={(v) => handleChange('Nove_Heslo_Potvrzeni', v)}
                                            disabled={submitting}
                                            error={fieldErrors.Nove_Heslo_Potvrzeni}
                                        />
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            {!success && (
                                <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        type="button"
                                        className="btn btn--secondary"
                                        onClick={handleClose}
                                        disabled={submitting}
                                    >
                                        Zrušit
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn--primary"
                                        disabled={submitting}
                                    >
                                        {submitting && <IconLoader2 size={16} className="animate-spin mr-1" />}
                                        {submitting ? 'Ukládám...' : 'Uložit heslo'}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
