import { Volume2 } from 'lucide-react';

/**
 * TTS 朗读函数
 */
const speak = (text, lang = 'en-US') => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
};

/**
 * 词汇复习卡片组件
 * @param {object} vocab - 词汇对象 { id, word, type, ipa_us, ipa_uk, meaning, examples, collocations, videoId }
 * @param {boolean} isFlipped - 是否已翻面
 * @param {function} onFlip - 翻面回调
 * @param {boolean} canReveal - v1.1: 是否允许翻面（冷却期后为 true）
 * @param {function} onGoToVideo - v1.1: 去原视频回调
 */
const VocabReviewCard = ({ vocab, isFlipped, onFlip, canReveal = true, onGoToVideo }) => {
    if (!vocab) return null;

    const { word, type, ipa_us, ipa_uk, meaning, examples, collocations } = vocab;

    // 处理 meaning：可能是 string 或 string[]
    const meaningList = Array.isArray(meaning) ? meaning : [meaning];

    // v1.1: 点击卡片时需要检查 canReveal
    const handleCardClick = () => {
        if (!canReveal) return; // 冷却期内不允许翻面
        onFlip();
    };

    return (
        <div
            onClick={handleCardClick}
            className={`w-[90%] max-w-md mx-auto bg-white rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl min-h-[320px] md:min-h-[400px] flex flex-col ${canReveal ? 'cursor-pointer transform hover:scale-[1.02]' : 'cursor-default'
                }`}
        >
            {/* 正面：只显示英文信息 */}
            {!isFlipped ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    {/* 单词 */}
                    <h2 className="text-4xl md:text-5xl font-bold text-indigo-700 mb-4">
                        {word}
                    </h2>

                    {/* 音标 */}
                    <div className="flex flex-col gap-2 mb-3">
                        {ipa_us && (
                            <div className="flex items-center justify-center gap-2 text-gray-500">
                                <span className="text-xs text-gray-400">US</span>
                                <span className="font-mono text-lg">/{ipa_us}/</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        speak(word, 'en-US');
                                    }}
                                    className="p-1.5 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                                    title="美式发音"
                                >
                                    <Volume2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        {ipa_uk && (
                            <div className="flex items-center justify-center gap-2 text-gray-500">
                                <span className="text-xs text-gray-400">UK</span>
                                <span className="font-mono text-lg">/{ipa_uk}/</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        speak(word, 'en-GB');
                                    }}
                                    className="p-1.5 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                                    title="英式发音"
                                >
                                    <Volume2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 词性 */}
                    {type && (
                        <span className="text-sm text-gray-400 mt-2">{type}</span>
                    )}

                    {/* v1.1: 口语化提示文案 */}
                    <p className="mt-8 text-sm text-gray-400">
                        先在心里说一遍中文意思，再点卡片看答案 👀
                    </p>
                </div>
            ) : (
                /* 背面：显示完整信息 */
                <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                    {/* 顶部：单词 + 音标 + 词性 */}
                    <div className="text-center border-b pb-4 mb-4">
                        <h2 className="text-2xl md:text-3xl font-bold text-indigo-700 mb-2">
                            {word}
                        </h2>
                        <div className="flex items-center justify-center gap-4 text-sm text-gray-500 flex-wrap">
                            {ipa_us && (
                                <span className="font-mono">US /{ipa_us}/</span>
                            )}
                            {ipa_uk && (
                                <span className="font-mono">UK /{ipa_uk}/</span>
                            )}
                            {type && (
                                <span className="text-gray-400">{type}</span>
                            )}
                        </div>
                    </div>

                    {/* 中文释义 */}
                    <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-400 mb-2">释义</h3>
                        {meaningList.length === 1 ? (
                            <p className="text-lg text-gray-800 font-medium">{meaningList[0]}</p>
                        ) : (
                            <ul className="list-disc list-inside space-y-1">
                                {meaningList.slice(0, 2).map((m, i) => (
                                    <li key={i} className="text-lg text-gray-800">{m}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* 例句 */}
                    {examples && examples.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-gray-400 mb-2">例句</h3>
                            <div className="space-y-2">
                                {examples.slice(0, 1).map((ex, i) => (
                                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-gray-800 leading-relaxed">{ex.en}</p>
                                        <p className="text-gray-500 text-sm mt-1">{ex.cn}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 搭配 */}
                    {collocations && collocations.length > 0 && (
                        <div className="mt-auto pt-4">
                            <h3 className="text-sm font-medium text-gray-400 mb-2">常见搭配</h3>
                            <div className="flex flex-wrap gap-2">
                                {collocations.slice(0, 4).map((col, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-sm rounded-full border border-indigo-100"
                                    >
                                        {col}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 底部按钮区域 */}
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                        {/* 查看所在句子 - v1.1: 保持占位，暂不实现 */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('view sentences TODO');
                            }}
                            className="flex-1 py-2 text-sm text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                        >
                            查看所在句子（即将上线）
                        </button>
                        {/* 去原视频 - v1.1: 已打通跳转 */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onGoToVideo) {
                                    onGoToVideo();
                                }
                            }}
                            className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            去原视频
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VocabReviewCard;
