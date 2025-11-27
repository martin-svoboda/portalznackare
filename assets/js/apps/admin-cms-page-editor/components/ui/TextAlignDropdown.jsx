import React, { useState, useRef, useEffect } from 'react';
import { IconAlignLeft, IconAlignCenter, IconAlignRight, IconAlignJustified, IconCheck } from '@tabler/icons-react';

/**
 * Text Align Dropdown
 * Left, Center, Right, Justify
 */
const TextAlignDropdown = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const alignments = [
    { type: 'left', label: 'Zarovnat vlevo', icon: IconAlignLeft },
    { type: 'center', label: 'Na střed', icon: IconAlignCenter },
    { type: 'right', label: 'Zarovnat vpravo', icon: IconAlignRight },
    { type: 'justify', label: 'Do bloku', icon: IconAlignJustified },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAlignSelect = (type) => {
    editor.chain().focus().setTextAlign(type).run();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        title="Zarovnání textu"
      >
        <IconAlignLeft size={18} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 min-w-[200px]">
          {alignments.map((align) => {
            const Icon = align.icon;
            const isActive = editor?.isActive({ textAlign: align.type });

            return (
              <button
                key={align.type}
                type="button"
                onClick={() => handleAlignSelect(align.type)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
              >
                <Icon size={18} />
                <span className="flex-1">{align.label}</span>
                {isActive && (
                  <IconCheck size={16} className="text-blue-600 dark:text-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TextAlignDropdown;
