import { ResizablePopup } from './ResizablePopup';

interface SleepTimerPopupProps {
  show: boolean;
  position: { x: number; y: number };
  sleepTimer: number;
  isTimerActive: boolean; // New prop to indicate if timer is active
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onSetTimer: (minutes: number) => void;
  onCancelTimer: () => void;
  showVisualization?: boolean;
}

export const SleepTimerPopup: React.FC<SleepTimerPopupProps> = ({
  show,
  position,
  sleepTimer,
  isTimerActive,
  onClose,
  onMouseDown,
  onSetTimer,
  onCancelTimer,
  showVisualization = false
}) => {
  if (!show) return null;

  return (
    <ResizablePopup
      show={show}
      position={position}
      onClose={onClose}
      onMouseDown={onMouseDown}
      title="Sleep Timer"
      minWidth={320}
      minHeight={380}
      maxWidth={420}
      maxHeight={450}
      showVisualization={showVisualization}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 15, label: '15m' },
            { value: 30, label: '30m' },
            { value: 45, label: '45m' },
            { value: 60, label: '60m' },
            { value: 90, label: '90m' },
            { value: 120, label: '120m' },
          ].map(({ value, label }) => (
            <button
              key={label}
              onClick={() => {
                onSetTimer(value);
                onClose();
              }}
              className="p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-200 text-sm"
            >
              {label}
            </button>
          ))}
        </div>
        {isTimerActive && (
          <div className="text-center">
            <p className="text-white/70 text-sm mb-2">
              Timer set for {
                sleepTimer >= 60
                  ? `${Math.floor(sleepTimer / 60)} hour${Math.floor(sleepTimer / 60) !== 1 ? 's' : ''}${sleepTimer % 60 > 0 ? ` ${sleepTimer % 60} minute${sleepTimer % 60 !== 1 ? 's' : ''}` : ''}`
                  : sleepTimer >= 1
                    ? `${sleepTimer} minute${sleepTimer !== 1 ? 's' : ''}`
                    : 'less than 1 minute'
              }
            </p>
            <button
              onClick={() => {
                onCancelTimer();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200 text-sm"
            >
              Cancel Timer
            </button>
          </div>
        )}
      </div>
    </ResizablePopup>
  );
};
