import { useState, useRef, useCallback } from 'react';

const useLongPress = ({ onLongPress, onClick, threshold = 500 }) => {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const timeoutRef = useRef(null);
    const targetRef = useRef(null);

    const start = useCallback(
        (event) => {
            // Only handle left click or touch
            if (event.type === 'mousedown' && event.button !== 0) return;

            // Prevent default context menu on long press if needed, 
            // but usually we just want to track the press.
            // event.persist(); // React 16-, not needed in 17+

            setLongPressTriggered(false);
            targetRef.current = event.target;

            timeoutRef.current = setTimeout(() => {
                setLongPressTriggered(true);
                onLongPress(event);
            }, threshold);
        },
        [onLongPress, threshold]
    );

    const clear = useCallback(
        (event, shouldTriggerClick = true) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            // If it wasn't a long press, and we should trigger click
            if (shouldTriggerClick && !longPressTriggered && onClick) {
                // Ensure we are still on the same target
                // (Simple check, might need more robust check for touch movement)
                onClick(event);
            }

            setLongPressTriggered(false);
            targetRef.current = null;
        },
        [onClick, longPressTriggered]
    );

    return {
        onMouseDown: (e) => start(e),
        onTouchStart: (e) => start(e),
        onMouseUp: (e) => clear(e),
        onMouseLeave: (e) => clear(e, false),
        onTouchEnd: (e) => {
            if (longPressTriggered && e.cancelable) {
                e.preventDefault();
            }
            clear(e);
        },
        // If user scrolls, cancel the long press
        onTouchMove: (e) => clear(e, false),
    };
};

export default useLongPress;
