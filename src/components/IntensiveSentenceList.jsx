import React, { useEffect, useRef, useState } from 'react';
import IntensiveCard from './IntensiveCard';

const IntensiveSentenceList = ({
    transcript,
    currentIndex,
    visitedSet,
    onSelectSentence,
    // Favorite props
    favoriteSentenceIds = [],
    onToggleFavorite
}) => {
    const activeRef = useRef(null);
    const [showChinese, setShowChinese] = useState(true);

    // Auto-scroll to active item
    useEffect(() => {
        if (activeRef.current) {
            activeRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentIndex]);

    if (!transcript || transcript.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400">
                暂无字幕数据
            </div>
        );
    }

    const visitedCount = visitedSet ? visitedSet.size : 0;
    const totalCount = transcript.length;
    const progressPercentage = Math.min(100, (visitedCount / totalCount) * 100);

    return (
        <div className="space-y-6">
            {/* Header: Progress & Toggle */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">
                            精读模式 · 第 {currentIndex + 1} 句 / 共 {totalCount} 句
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5">
                            已精读 {visitedCount} 句
                        </span>
                    </div>

                    <button
                        onClick={() => setShowChinese(!showChinese)}
                        className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                            ${showChinese ? 'bg-indigo-600' : 'bg-gray-200'}
                        `}
                    >
                        <span
                            className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${showChinese ? 'translate-x-6' : 'translate-x-1'}
                            `}
                        />
                        <span className="sr-only">显示中文</span>
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            </div>

            {/* List of Cards */}
            <div className="space-y-4 pb-20">
                {transcript.map((item, index) => {
                    const isActive = index === currentIndex;
                    const isVisited = visitedSet ? visitedSet.has(index) : false;
                    const isFavorite = item.id !== undefined && favoriteSentenceIds.includes(item.id);

                    return (
                        <div key={index} ref={isActive ? activeRef : null}>
                            <IntensiveCard
                                index={index}
                                sentence={item}
                                isActive={isActive}
                                isVisited={isVisited}
                                showChinese={showChinese}
                                onSelect={onSelectSentence}
                                isFavorite={isFavorite}
                                onToggleFavorite={onToggleFavorite}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default IntensiveSentenceList;
