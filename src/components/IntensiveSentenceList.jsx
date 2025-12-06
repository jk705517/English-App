import React, { useEffect, useRef } from 'react';

const IntensiveSentenceList = ({
    transcript,
    currentIndex,
    onSelectSentence
}) => {
    const activeRef = useRef(null);

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

    return (
        <div className="space-y-1">
            {transcript.map((item, index) => {
                const isActive = index === currentIndex;
                const hasAnalysis = item.analysis && (
                    item.analysis.syntax ||
                    (item.analysis.expressions && item.analysis.expressions.length > 0) ||
                    item.analysis.phonetics ||
                    item.analysis.context
                );

                return (
                    <div
                        key={index}
                        ref={isActive ? activeRef : null}
                        onClick={() => onSelectSentence(index)}
                        className={`
                            group flex items-start p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4
                            ${isActive
                                ? 'bg-indigo-50 border-indigo-500 shadow-sm'
                                : 'bg-white border-transparent hover:bg-gray-50'
                            }
                        `}
                    >
                        {/* Index */}
                        <span className={`
                            text-xs font-mono mr-3 mt-1 w-6 text-right shrink-0
                            ${isActive ? 'text-indigo-500 font-bold' : 'text-gray-400'}
                        `}>
                            {index + 1}
                        </span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className={`
                                    text-sm md:text-base font-medium truncate pr-2
                                    ${isActive ? 'text-indigo-900' : 'text-gray-700 group-hover:text-gray-900'}
                                `}>
                                    {item.text}
                                </p>
                                {hasAnalysis && (
                                    <span
                                        className={`
                                            shrink-0 px-1.5 py-0.5 text-[10px] rounded border font-medium
                                            ${isActive
                                                ? 'bg-indigo-100 text-indigo-600 border-indigo-200'
                                                : 'bg-gray-100 text-gray-500 border-gray-200'
                                            }
                                        `}
                                        title="包含精读解析"
                                    >
                                        精
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default IntensiveSentenceList;
