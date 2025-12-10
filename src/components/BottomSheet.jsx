import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const BottomSheet = ({ isOpen, onClose, title, actions = [] }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setVisible(false), 300); // Wait for animation
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:hidden">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className={`relative w-full bg-white rounded-t-2xl shadow-xl transform transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
            >
                {/* Handle bar for visual cue */}
                <div className="flex justify-center pt-3 pb-1" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>

                {/* Header */}
                {title && (
                    <div className="px-6 py-4 border-b border-gray-100 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 truncate">{title}</h3>
                    </div>
                )}

                {/* Actions */}
                <div className="p-4 space-y-3 pb-8">
                    {actions.map((action, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                action.onClick();
                                onClose();
                            }}
                            className={`w-full py-3.5 rounded-xl font-medium text-lg transition-colors flex items-center justify-center gap-2
                                ${action.danger
                                    ? 'bg-red-50 text-red-600 active:bg-red-100'
                                    : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                                }`}
                        >
                            {action.icon && <action.icon className="w-5 h-5" />}
                            {action.label}
                        </button>
                    ))}

                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium text-lg active:bg-gray-50 mt-2"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BottomSheet;
