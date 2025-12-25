import React, { useMemo } from 'react';

const IntensiveSentencePanel = ({
    sentence,
    onPlaySentence,
    onPauseSentence,
    onPrevSentence,
    onNextSentence,
    isPlaying
}) => {
    if (!sentence) return null;

    const { text, cn, analysis } = sentence;

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

                // Simple case-insensitive split
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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-4">
            {/* Main Sentence Area */}
            <div className="mb-6">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 leading-relaxed">
                    {highlightedText}
                </h3>
                <p className="text-base md:text-lg text-gray-600 mb-4">
                    {cn}
                </p>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={isPlaying ? onPauseSentence : onPlaySentence}
                        className={`
                            inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all
                            ${isPlaying
                                ? 'bg-violet-100 text-violet-500 hover:bg-violet-200'
                                : 'bg-violet-400 text-white hover:bg-violet-400 hover:shadow-md'
                            }
                        `}
                    >
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            {isPlaying ? (
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            ) : (
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            )}
                        </svg>
                        {isPlaying ? '暂停播放' : '播放本句'}
                    </button>

                    <button
                        onClick={onPrevSentence}
                        className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        上一句
                    </button>

                    <button
                        onClick={onNextSentence}
                        className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    >
                        下一句
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Analysis Content */}
            {analysis && (
                <div className="space-y-6 border-t pt-6">
                    {/* Syntax */}
                    {analysis.syntax && (
                        <div>
                            <h4 className="flex items-center text-sm font-bold text-violet-500 uppercase tracking-wider mb-2">
                                <span className="w-1 h-4 bg-violet-400 rounded-full mr-2"></span>
                                语法结构
                            </h4>
                            <p className="text-gray-700 bg-violet-50/50 p-3 rounded-lg text-sm md:text-base leading-relaxed">
                                {analysis.syntax}
                            </p>
                        </div>
                    )}

                    {/* Expressions */}
                    {analysis.expressions && analysis.expressions.length > 0 && (
                        <div>
                            <h4 className="flex items-center text-sm font-bold text-violet-500 uppercase tracking-wider mb-3">
                                <span className="w-1 h-4 bg-pink-500 rounded-full mr-2"></span>
                                地道表达
                            </h4>
                            <div className="grid gap-4">
                                {analysis.expressions.map((exp, idx) => (
                                    <div key={idx} className="bg-pink-50/30 p-4 rounded-lg border border-pink-100">
                                        <div className="flex flex-wrap items-baseline gap-2 mb-2">
                                            <span className="font-bold text-pink-700 text-lg">{exp.phrase}</span>
                                            <span className="text-gray-600 text-sm">{exp.explanation}</span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <p className="text-gray-800">{exp.example_en}</p>
                                            <p className="text-gray-500">{exp.example_cn}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Phonetics */}
                    {analysis.phonetics && (
                        <div>
                            <h4 className="flex items-center text-sm font-bold text-violet-500 uppercase tracking-wider mb-2">
                                <span className="w-1 h-4 bg-teal-500 rounded-full mr-2"></span>
                                发音提示
                            </h4>
                            <p className="text-gray-700 bg-teal-50/50 p-3 rounded-lg text-sm md:text-base">
                                {analysis.phonetics}
                            </p>
                        </div>
                    )}

                    {/* Context */}
                    {analysis.context && (
                        <div>
                            <h4 className="flex items-center text-sm font-bold text-violet-500 uppercase tracking-wider mb-2">
                                <span className="w-1 h-4 bg-amber-500 rounded-full mr-2"></span>
                                语境 / 背景
                            </h4>
                            <p className="text-gray-700 bg-amber-50/50 p-3 rounded-lg text-sm md:text-base">
                                {analysis.context}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Empty State for Analysis */}
            {(!analysis || (!analysis.syntax && (!analysis.expressions || analysis.expressions.length === 0) && !analysis.phonetics && !analysis.context)) && (
                <div className="border-t pt-6 text-center text-gray-400 text-sm italic">
                    暂无精读解析数据
                </div>
            )}
        </div>
    );
};

export default IntensiveSentencePanel;
