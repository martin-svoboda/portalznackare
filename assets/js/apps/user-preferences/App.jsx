import React, {useState, useEffect} from 'react';
import {createDebugLogger} from '../../utils/debug';

const logger = createDebugLogger('UserPreferences');

export default function App() {
    const [preferences, setPreferences] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Načíst preference při mount
    useEffect(() => {
        logger.lifecycle('Component mounted');
        loadPreferences();

        // Poslouchej změny theme z globálního toggle tlačítka
        const handleThemeChange = () => {
            logger.lifecycle('Theme changed via global toggle, reloading preferences');
            // Malý delay aby se změna stihla uložit do DB
            setTimeout(() => {
                loadPreferences();
            }, 100);
        };

        // Custom event pro synchronizaci s globálním theme toggle
        window.addEventListener('themeChanged', handleThemeChange);

        return () => {
            window.removeEventListener('themeChanged', handleThemeChange);
        };
    }, []);

    const loadPreferences = async () => {
        try {
            logger.api('GET', '/api/portal/user/preferences');
            setLoading(true);
            setError('');

            const response = await fetch('/api/portal/user/preferences');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            logger.api('GET', '/api/portal/user/preferences', null, data);

            setPreferences(data.preferences || {});
        } catch (err) {
            logger.error('Failed to load preferences', err);
            setError('Nepodařilo se načíst preference: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updatePreference = async (key, value) => {
        try {
            logger.api('PUT', `/api/portal/user/preferences/${key}`, {value, type: typeof value});
            setSaving(true);
            setError('');

            const response = await fetch(`/api/portal/user/preferences/${key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({value})
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`HTTP ${response.status} response`, {text: errorText});
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            logger.api('PUT', `/api/portal/user/preferences/${key}`, {value, type: typeof value}, result);

            // Aktualizovat lokální state
            setPreferences(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    value: value
                }
            }));

            // Pro theme_mode okamžitě aplikovat změnu
            if (key === 'theme_mode') {
                // Použít globální funkci applyTheme z base template
                if (typeof window.applyTheme === 'function') {
                    window.applyTheme(value);
                } else {
                    // Fallback pokud globální funkce není dostupná
                    const html = document.documentElement;
                    html.classList.remove('light', 'dark');
                    let finalTheme = value;
                    if (value === 'auto') {
                        finalTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    }
                    if (finalTheme === 'dark') {
                        html.classList.add('dark');
                    }
                }
            }

        } catch (err) {
            logger.error(`Failed to update preference ${key}`, err);
            setError(`Nepodařilo se uložit ${key}: ` + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="form-field">
                <div className="form__help">Načítám preference...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="form-field">
                <div className="form__help form__help--error">
                    {error}
                </div>
                <button
                    onClick={loadPreferences}
                    className="btn btn--secondary btn--small"
                >
                    Zkusit znovu
                </button>
            </div>
        );
    }

    return (
        <div className="grid">
            {Object.entries(preferences).map(([key, config]) => (
                <PreferenceItem
                    key={key}
                    prefKey={key}
                    config={config}
                    onUpdate={updatePreference}
                    disabled={saving}
                />
            ))}
        </div>
    );
}

function PreferenceItem({prefKey, config, onUpdate, disabled}) {
    const {value, type, description, values, options, min, max, label, disabled: configDisabled} = config;

    // Kombinovat disabled ze stavu aplikace a z konfigurace
    const isDisabled = disabled || configDisabled;

    const renderControl = () => {
        switch (type) {
            case 'boolean':
                return (
                    <div className="form__check">
                        <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => onUpdate(prefKey, e.target.checked)}
                            disabled={isDisabled}
                            className="form__check__input"
                            id={`pref_${prefKey}`}
                        />
                        <label
                            htmlFor={`pref_${prefKey}`}
                            className="form__check__label"
                        >
                            {value ? 'Zapnuto' : 'Vypnuto'}
                        </label>
                    </div>
                );

            case 'string':
                if (values) {
                    return (
                        <select
                            value={value}
                            onChange={(e) => onUpdate(prefKey, e.target.value)}
                            disabled={isDisabled}
                            className="form__select"
                        >
                            {values.map(option => (
                                <option key={option} value={option}>
                                    {options ? (options[option] || option) : option}
                                </option>
                            ))}
                        </select>
                    );
                }
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onUpdate(prefKey, e.target.value)}
                        disabled={isDisabled}
                        className="form__input"
                    />
                );

            case 'integer':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onUpdate(prefKey, parseInt(e.target.value))}
                        min={min}
                        max={max}
                        disabled={isDisabled}
                        className="form__input form__input--small"
                    />
                );

            default:
                return <span className="form__help">Nepodporovaný typ: {type}</span>;
        }
    };

    return (
        <div className="profile-setting">
            <div className="profile-setting__info">
                <h4 className="profile-setting__title">{label || prefKey}</h4>
                <p className="profile-setting__desc">
                    {description}
                    {configDisabled && <em> (Toto nastavení nelze změnit)</em>}
                </p>
            </div>
            {renderControl()}
        </div>
    );
}