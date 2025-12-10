import { useState, useRef, useCallback } from 'react';

const useLongPress = ({ onLongPress, onClick, threshold = 500 }) => {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const timeoutRef = useRef(null);
    const targetRef = useRef(null);
    const startPosRef = useRef({ x: 0, y: 0 });
    const isMovingRef = useRef(false);

    const start = useCallback(
        (event) => {
            // Only handle left click or touch
            if (event.type === 'mousedown' && event.button !== 0) return;

            setLongPressTriggered(false);
            isMovingRef.current = false;
            targetRef.current = event.target;

            if (event.type === 'touchstart') {
                startPosRef.current = {
                    x: event.touches[0].clientX,
                    y: event.touches[0].clientY
                };
            }

            timeoutRef.current = setTimeout(() => {
                if (!isMovingRef.current) {
                    setLongPressTriggered(true);
                    onLongPress(event);
                }
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

            // If it wasn't a long press, and we didn't move too much, and we should trigger click
            if (shouldTriggerClick && !longPressTriggered && !isMovingRef.current && onClick) {
                onClick(event);
            }

            setLongPressTriggered(false);
            isMovingRef.current = false;
            targetRef.current = null;
        },
        [onClick, longPressTriggered]
    );

    const handleMove = useCallback((event) => {
        if (event.type === 'touchmove') {
            const moveX = Math.abs(event.touches[0].clientX - startPosRef.current.x);
            const moveY = Math.abs(event.touches[0].clientY - startPosRef.current.y);

            // If moved more than 10px, consider it a scroll/move
            if (moveX > 10 || moveY > 10) {
                isMovingRef.current = true;
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            }
        }
    }, []);

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
        onTouchMove: handleMove,
    };
};

export default useLongPress;
