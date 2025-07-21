import React from 'react';
import { IconBrush, IconTool, IconSignLeft, IconHammer } from '@tabler/icons-react';

export function PrikazTypeIcon({ type, size = 28 }) {
    const getIcon = () => {
        const iconSize = Math.round(size * 0.6); // 60% velikosti kontejneru
        switch (type) {
            case 'O': // Obnova – štětec
                return <IconBrush size={iconSize} />;
            case 'N': // Nová – nářadí
                return <IconTool size={iconSize} />;
            case 'S': // Směrovky/rozcestníky – směrovka
                return <IconSignLeft size={iconSize} />;
            default: // Default: kladivo
                return <IconHammer size={iconSize} />;
        }
    };

    return (
        <div 
            className="inline-flex items-center justify-center rounded-md border-2 bg-white"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderColor: 'var(--color-kct-green, #2d7d20)',
                color: 'var(--color-kct-green, #2d7d20)',
            }}
        >
            {getIcon()}
        </div>
    );
}