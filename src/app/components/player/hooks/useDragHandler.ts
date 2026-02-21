import { useCallback, useEffect, useState } from 'react';
import { PopupPositions } from '../types';

export const useDragHandler = () => {
  const [popupPositions, setPopupPositions] = useState<PopupPositions>({
    playlist: { x: 16, y: 96 },
    equalizer: { x: 16, y: 96 },
    sleepTimer: { x: 16, y: 96 },
    lyrics: { x: 600, y: 96 },
    visualizer: { x: 16, y: 96 }
  });

  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((popupId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragging(popupId);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    // Only prevent default for mouse events, not touch events
    if (e.type === 'mousedown') {
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;

    const newX = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));

    setPopupPositions(prev => ({
      ...prev,
      [dragging]: { x: newX, y: newY }
    }));
  }, [dragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      // Use non-passive event listeners for drag functionality
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Set proper initial position for lyrics popup after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPopupPositions(prev => ({
        ...prev,
        lyrics: { x: Math.max(16, window.innerWidth - 416), y: 96 }
      }));
    }
  }, []);

  return {
    popupPositions,
    handleMouseDown
  };
};
