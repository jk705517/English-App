import { Volume2 } from 'lucide-react';

/**
 * TTS 发音函数 - 使用 Azure TTS API
 */
const speak = async (text, lang = 'en-US') => {
    try {
        const accent = lang === 'en-GB' ? 'uk' : 'us';
        const url = `https://api.biubiuenglish.com/api/tts?text=${encodeURIComponent(text)}&accent=${accent}`;

        const audio = new Audio(url);
        audio.play();
    } catch (error) {
        console.error('TTS 播放失败:', error);
    }
};

/**
 * 词汇复习卡片组件
 * @param {object} vocab - 词汇对象 { id, word, type, ipa_us, ipa_uk, meaning, examples, collocations, videoId }
 * @param {boolean} isFlipped - 是否已翻面
 * @param {function} onFlip - 翻面回调
 * @param {boolean} canReveal - v1.1: 是否允许翻面（冷却期后为 true）
 * @param {function} onGoToVideo - v1.1: 去原视频回调
 * @param {Array} sentences - v1.3: 句子列表
 * @param {boolean} sentencesVisible - v1.3: 句子是否展开
 * @param {boolean} sentencesLoading - v1.3: 句子加载中
 * @param {function} onToggleSentences - v1.3: 切换句子展示
 */
const VocabReviewCard = ({
    vocab,
    isFlipped,
    onFlip,
    canReveal = true,
    onGoToVideo,
    sentences = [],
    sentencesVisible = false,
    sentencesLoading = false,
    onToggleSentences
}) => {
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
                    <h2 className="text-4xl md:text-5xl font-bold text-violet-500 mb-4">
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
                                    className="p-1.5 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors"
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
                                    className="p-1.5 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors"
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
                        <h2 className="text-2xl md:text-3xl font-bold text-violet-500 mb-2">
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
                        <div className="pt-4">
                            <h3 className="text-sm font-medium text-gray-400 mb-2">常见搭配</h3>
                            <div className="flex flex-wrap gap-2">
                                {collocations.slice(0, 4).map((col, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1.5 bg-violet-50 text-violet-500 text-sm rounded-full border border-violet-100"
                                    >
                                        {col}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* v1.3: 句子展示区域 */}
                    {sentencesVisible && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                            <h3 className="text-sm font-medium text-gray-400 mb-2">所在句子</h3>
                            {sentencesLoading ? (
                                <p className="text-sm text-gray-400">正在从视频中加载句子...</p>
                            ) : !sentences || sentences.length === 0 ? (
                                <p className="text-sm text-gray-400">暂时找不到这个词在原视频中的句子。</p>
                            ) : (
                                sentences.slice(0, 3).map((s) => (
                                    <div
                                        key={s.id}
                                        className="p-3 rounded-lg bg-gray-50 border border-gray-100"
                                    >
                                        <p className="text-gray-900 leading-relaxed text-sm">{s.en}</p>
                                        {s.cn && (
                                            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                                                {s.cn}
                                            </p>
                                        )}
                                        {typeof s.index === 'number' && (
                                            <p className="mt-1 text-[11px] text-gray-400">
                                                第 {s.index + 1} 句
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* 底部按钮区域 - 只保留"去原视频" */}
                    <div className="mt-4 pt-4 border-t">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onGoToVideo) {
                                    onGoToVideo();
                                }
                            }}
                            className="w-full py-2 text-sm text-white bg-violet-400 rounded-lg hover:bg-violet-400 transition-colors"
                        >
                            去原视频看词汇
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VocabReviewCard;
