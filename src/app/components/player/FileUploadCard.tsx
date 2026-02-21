import React from 'react';

interface FileUploadCardProps {
    onUploadClick: () => void;
    isDragOver: boolean;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
}

export const FileUploadCard: React.FC<FileUploadCardProps> = ({
    onUploadClick,
    isDragOver,
    onDragOver,
    onDragLeave,
    onDrop
}) => {
    return (
        <div className="flex justify-center w-full px-4 mt-4 lg:mt-8 mb-8 lg:mb-16">
            <div
                className={`w-full max-w-lg mx-auto h-64 sm:h-72 rounded-[24px] border border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer ${isDragOver
                    ? 'border-white bg-white/10 scale-105'
                    : 'border-white/30 hover:border-white/50 hover:bg-white/5 hover:scale-102'
                    }`}
                style={{
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)' // Softened shadow to match theme
                }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={onUploadClick}
            >
                <div className="text-center space-y-4 p-8">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg sm:text-xl font-medium text-white mb-2">Upload Your Music</h3>
                        <p className="text-white/60 text-sm sm:text-base mb-2">Drag & drop audio files here</p>
                        <p className="text-white/40 text-xs">or click to browse your files</p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white/30 text-xs pt-2">
                        <span>Supports MP3, WAV, FLAC, and more</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
