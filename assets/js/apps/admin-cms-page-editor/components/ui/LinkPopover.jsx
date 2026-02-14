import React, { useState, useRef, useEffect } from 'react';
import { IconLink, IconLinkOff, IconExternalLink, IconCheck } from '@tabler/icons-react';

/**
 * LinkPopover - sdílená komponenta pro zadání URL odkazu
 * Používá se pro textové odkazy i obrázky
 *
 * @param {boolean} isOpen - Stav otevření popoveru
 * @param {function} onClose - Zavření popoveru
 * @param {function} onSubmit - Callback s { href, target } při potvrzení
 * @param {function} onRemove - Callback pro odstranění odkazu (null = nelze odstranit)
 * @param {string} initialHref - Počáteční URL
 * @param {string} initialTarget - Počáteční target (_blank nebo '')
 */
const LinkPopover = ({ isOpen, onClose, onSubmit, onRemove, initialHref = '', initialTarget = '' }) => {
    const [href, setHref] = useState(initialHref);
    const [openInNewTab, setOpenInNewTab] = useState(initialTarget === '_blank');
    const popoverRef = useRef(null);
    const inputRef = useRef(null);

    // Reset při otevření
    useEffect(() => {
        if (isOpen) {
            setHref(initialHref || '');
            setOpenInNewTab(initialTarget === '_blank');
            // Focus input po renderování
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialHref, initialTarget]);

    // Zavřít při kliknutí mimo
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleConfirm = () => {
        if (href.trim()) {
            onSubmit({
                href: href.trim(),
                target: openInNewTab ? '_blank' : '',
            });
        }
        onClose();
    };

    const handleRemove = () => {
        if (onRemove) {
            onRemove();
        }
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={popoverRef}
            className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-[320px]"
            onKeyDown={handleKeyDown}
        >
            <div className="flex items-center gap-2 mb-2">
                <IconLink size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={href}
                    onChange={(e) => setHref(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>

            <label className="flex items-center gap-2 mb-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input
                    type="checkbox"
                    checked={openInNewTab}
                    onChange={(e) => setOpenInNewTab(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <IconExternalLink size={14} className="text-gray-500 dark:text-gray-400" />
                Otevřít v novém okně
            </label>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!href.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <IconCheck size={14} />
                    Potvrdit
                </button>

                {onRemove && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                        <IconLinkOff size={14} />
                        Odebrat odkaz
                    </button>
                )}
            </div>
        </div>
    );
};

export default LinkPopover;
