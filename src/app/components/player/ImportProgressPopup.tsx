"use client";

import React, { useEffect, useState } from 'react';

type UploadItem = {
  name: string;
  status: 'pending' | 'done' | 'error';
  error?: string;
};

type Props = {
  active: boolean;
  total: number;
  processed: number;
  currentFile?: string;
  items: UploadItem[];
};

const ImportProgressPopup: React.FC<Props> = ({ active, total, processed, currentFile, items }) => {
  // local mount/animation state so we can animate exit before unmounting
  const [mounted, setMounted] = useState<boolean>(active);
  const [visible, setVisible] = useState<boolean>(active);

  useEffect(() => {
    if (active) {
      setMounted(true);
      // schedule visible on next frame so transition can run
      requestAnimationFrame(() => setVisible(true));
      return;
    }

    // start exit animation then unmount
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [active]);

  if (!mounted) return null;

  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      {/* Dark backdrop similar to drag/drop overlay */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden
      />

      <div className="relative pointer-events-auto w-full max-w-2xl mx-4">
        <div className={`rounded-xl p-4 bg-white/6 border border-white/10 backdrop-blur-md shadow-lg transform transition-all duration-300 ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Importing files</h3>
              <p className="text-sm text-white/70 mt-1">{processed} of {total} files processed</p>
            </div>
            <div className="text-sm text-white/60">{percent}%</div>
          </div>

          <div className="mt-3">
            <div className="w-full h-2 rounded bg-white/10 overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-emerald-400 to-emerald-600 transition-all duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            {currentFile && (
              <div className="mt-2 text-sm text-white/80">Processing: {currentFile}</div>
            )}
          </div>

          <div className="mt-3 max-h-36 overflow-y-auto custom-scrollbar-auto">
            <ul className="space-y-2">
              {items.slice(-10).reverse().map((it, idx) => (
                <li
                  key={`${it.name}-${idx}`}
                  className={`flex items-center justify-between text-sm transform transition-all duration-200 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
                  style={{ transitionDelay: `${idx * 45}ms` }}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${it.status === 'done' ? 'bg-emerald-400' : it.status === 'pending' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                    <div className="text-white/85 truncate max-w-[60%]">{it.name}</div>
                  </div>
                  {it.status === 'error' && (
                    <div className="text-rose-300 text-xs ml-2">{it.error}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProgressPopup;
