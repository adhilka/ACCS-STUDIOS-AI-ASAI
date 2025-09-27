import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    top: `${y}px`,
    left: `${x}px`,
    position: 'absolute',
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-base-300 rounded-md shadow-lg py-1 w-48 border border-base-100"
    >
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <button
              onClick={() => {
                item.action();
                onClose();
              }}
              disabled={item.disabled}
              className="w-full text-left px-4 py-1.5 text-sm text-base-content hover:bg-primary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-neutral flex items-center gap-3"
            >
              {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
              <span className="flex-grow">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContextMenu;
