import React, { useState, useRef, useEffect } from 'react';
import { IconHeading, IconH1, IconH2, IconH3, IconH4, IconCheck } from '@tabler/icons-react';

/**
 * Heading Dropdown Menu
 * Allows selecting heading levels (H1-H4) or normal text
 */
const HeadingDropdownMenu = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const headings = [
    { level: 0, label: 'Normální text', icon: null },
    { level: 1, label: 'Nadpis 1', icon: IconH1 },
    { level: 2, label: 'Nadpis 2', icon: IconH2 },
    { level: 3, label: 'Nadpis 3', icon: IconH3 },
    { level: 4, label: 'Nadpis 4', icon: IconH4 },
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

  const handleHeadingSelect = (level) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    setIsOpen(false);
  };

  const getCurrentHeading = () => {
    for (const h of headings) {
      if (h.level === 0) continue;
      if (editor?.isActive('heading', { level: h.level })) {
        return h;
      }
    }
    return headings[0]; // Normal text
  };

  const currentHeading = getCurrentHeading();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        title="Nadpisy"
      >
        <IconHeading size={18} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 min-w-[200px]">
          {headings.map((heading) => {
            const Icon = heading.icon;
            const isActive = heading.level === 0
              ? !editor?.isActive('heading')
              : editor?.isActive('heading', { level: heading.level });

            return (
              <button
                key={heading.level}
                type="button"
                onClick={() => handleHeadingSelect(heading.level)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
              >
                {Icon && <Icon size={18} />}
                {!Icon && <span className="w-[18px]" />}
                <span className="flex-1">{heading.label}</span>
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

export default HeadingDropdownMenu;
