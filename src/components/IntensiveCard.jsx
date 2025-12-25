import React, { useMemo, useState } from 'react';

const IntensiveCard = ({
    index,
    sentence,
    isActive,
    isVisited,
    showExplanations,
    onSelect,
    // Favorite props
    isFavorite = false,
    onToggleFavorite,
    // Notebook props
    onAddToNotebook
}) => {
    const [showAllExpressions, setShowAllExpressions] = useState(false);

    if (!sentence) return null;

    const { text, cn, analysis } = sentence;

    // Handle favorite click
    const handleFavoriteClick = (e) => {
        e.stopPropagation();
        if (onToggleFavorite && sentence.id !== undefined) {
            onToggleFavorite(sentence.id);
        }
    };

    // Highlight phrases in the text
    const highlightedText = useMemo(() => {
        if (!analysis?.expressions || analysis.expressions.length === 0) {
            return text;
        }

        let parts = [{ text, isPhrase: false }];

        analysis.expressions.forEach(exp => {
            const phrase = exp.phrase;
            if (!phrase) return;

            const newParts = [];
            parts.forEach(part => {
                if (part.isPhrase) {
                    newParts.push(part);
                    return;
                }

                const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const split = part.text.split(regex);

                split.forEach(s => {
                    if (s === '') return;
                    if (s.toLowerCase() === phrase.toLowerCase()) {
                        newParts.push({ text: s, isPhrase: true });
                    } else {
                        newParts.push({ text: s, isPhrase: false });
                    }
                });
            });
            parts = newParts;
        });

        return parts.map((part, i) =>
            part.isPhrase ? (
                <span key={i} className="text-violet-500 font-bold bg-violet-50 px-1 rounded">
                    {part.text}
                </span>
            ) : (
                <span key={i}>{part.text}</span>
            )
        );
    }, [text, analysis]);

    const hasAnalysis = analysis && (
        (analysis.syntax && analysis.syntax.trim() !== '') ||
        (analysis.expressions && analysis.expressions.length > 0) ||
        (analysis.phonetics && analysis.phonetics.trim() !== '') ||
        (analysis.context && analysis.context.trim() !== '')
    );

    return (
        <div
            onClick={() => onSelect(index)}
            className={`
                relative p-4 md:p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer scroll-mt-24
                ${isActive
                    ? 'bg-white border-violet-500 shadow-lg ring-4 ring-violet-50/50'
                    : 'bg-white border-gray-100 hover:border-violet-200 hover:shadow-md'
                }
            `}
        >
            {/* Header: Index & Visited Status & Action Buttons */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={`
                        font-mono text-sm font-bold px-2 py-0.5 rounded
                        ${isActive ? 'bg-violet-100 text-violet-500' : 'bg-gray-100 text-gray-500'}
                    `}>
                        #{index + 1}
                    </span>
                    {isVisited && (
                        <span className="flex items-center text-green-500 text-xs font-medium bg-green-50 px-1.5 py-0.5 rounded-full">
                            <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            已学
                        </span>
                    )}
                </div>
                {/* Action Buttons - grouped together */}
                <div className="flex items-center gap-1">
                    {/* Favorite Button */}
                    {onToggleFavorite && sentence.id !== undefined && (
                        <button
                            onClick={handleFavoriteClick}
                            className={`p-1.5 rounded-full transition-colors ${isFavorite
                                ? 'text-yellow-500 hover:bg-yellow-100'
                                : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                                }`}
                            title={isFavorite ? "取消收藏" : "收藏句子"}
                        >
                            <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </button>
                    )}
                    {/* Add to Notebook Button */}
                    {onAddToNotebook && sentence.id !== undefined && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToNotebook(sentence.id);
                            }}
                            className="p-1.5 rounded-full transition-colors text-gray-300 hover:text-violet-500 hover:bg-violet-50"
                            title="加入本子"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Sentence */}
            <div className="mb-4">
                <h3 className={`text-lg md:text-xl font-bold leading-relaxed mb-2 ${isActive ? 'text-gray-900' : 'text-gray-800'}`}>
                    {highlightedText}
                </h3>
                <p className="text-base text-gray-600 leading-relaxed">
                    {cn}
                </p>
            </div>

            {/* Analysis Content - 3 cases */}
            {/* Case 1: Toggle ON + has analysis -> show analysis */}
            {showExplanations && hasAnalysis && (
                <div className={`space-y-4 pt-4 border-t ${isActive ? 'border-violet-100' : 'border-gray-100'}`}>

                    {/* Syntax */}
                    {analysis.syntax && (
                        <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-1 h-3 bg-violet-400 rounded-full"></span>
                                <span className="font-bold text-violet-500">语法结构</span>
                            </div>
                            <p className="text-gray-700 bg-violet-50/50 p-2.5 rounded-lg leading-relaxed">
                                {analysis.syntax}
                            </p>
                        </div>
                    )}

                    {/* Expressions */}
                    {analysis.expressions && analysis.expressions.length > 0 && (
                        <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-1 h-3 bg-pink-500 rounded-full"></span>
                                <span className="font-bold text-violet-500">地道表达</span>
                            </div>
                            <div className="space-y-3">
                                {analysis.expressions.slice(0, showAllExpressions ? undefined : 1).map((exp, idx) => (
                                    <div key={idx} className="bg-pink-50/30 p-3 rounded-lg border border-pink-100">
                                        <div className="flex flex-wrap items-baseline gap-2 mb-1">
                                            <span className="font-bold text-pink-700 text-base">{exp.phrase}</span>
                                            <span className="text-gray-600 text-xs">{exp.explanation}</span>
                                        </div>
                                        <div className="space-y-0.5 text-gray-800">
                                            <p>{exp.example_en}</p>
                                            <p className="text-gray-500 text-xs">{exp.example_cn}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {analysis.expressions.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAllExpressions(!showAllExpressions);
                                    }}
                                    className="mt-2 text-xs font-medium text-pink-600 hover:text-pink-700 flex items-center"
                                >
                                    {showAllExpressions ? '收起' : `展开更多 (${analysis.expressions.length - 1})`}
                                    <svg className={`w-3 h-3 ml-0.5 transform transition-transform ${showAllExpressions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Phonetics */}
                    {analysis.phonetics && (
                        <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-base">🎧</span>
                                <span className="font-bold text-violet-500">发音提示</span>
                            </div>
                            <p className="text-gray-700 bg-teal-50/50 p-2.5 rounded-lg leading-relaxed">
                                {analysis.phonetics}
                            </p>
                        </div>
                    )}

                    {/* Context */}
                    {analysis.context && (
                        <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-base">💡</span>
                                <span className="font-bold text-violet-500">背景知识</span>
                            </div>
                            <p className="text-gray-700 bg-amber-50/50 p-2.5 rounded-lg leading-relaxed">
                                {analysis.context}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Case 2: Toggle ON + no analysis -> show hint only */}
            {showExplanations && !hasAnalysis && (
                <p className="mt-3 text-sm text-gray-400">
                    本句暂未提供精读讲解，你仍然可以点击本句进行跟读 / 精听。
                </p>
            )}

            {/* Case 3: Toggle OFF -> show nothing extra */}
        </div>
    );
};

export default IntensiveCard;
