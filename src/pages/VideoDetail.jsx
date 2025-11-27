import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { mockVideos } from '../data/mockData';
import HighlightedText from '../components/HighlightedText';
import FloatingControls from '../components/FloatingControls';
import DictationInput from '../components/DictationInput';

// 交互式填空组件
const ClozeInput = ({ originalWord, onFocus, onBlur }) => {
    const [value, setValue] = useState('');
    const [status, setStatus] = useState('idle');

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const cleanWord = originalWord.replace(/[.,!?;:]/g, '');
            if (value.trim().toLowerCase() === cleanWord.toLowerCase()) {
                setStatus('correct');
            } else {
                setStatus('error');
                setTimeout(() => setStatus('idle'), 500);
            }
        }
    };

    if (status === 'correct') {
        return <span className="text-green-600 font-medium mx-1">{originalWord}</span>;
    }

    return (
        <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            style={{ width: `${Math.max(originalWord.length * 0.65, 2.5)}em` }}
            className={`inline-block text-center font-medium rounded mx-1 px-1 align-baseline bg-gray-100 text-indigo-600 border-none outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors ${status === 'error' ? 'animate-shake text-red-500 bg-red-50' : ''
                }`}
        />
    );
};

const VideoDetail = () => {
    const { id } = useParams();
    const playerRef = useRef(null);
    const transcriptRefs = useRef([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoData, setVideoData] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const [clozeCache, setClozeCache] = useState({});

    // 从 localStorage 读取用户上次选择的模式，如果没有则默认为 'dual'
    const [mode, setMode] = useState(() => {
        return localStorage.getItem('studyMode') || 'dual';
    });

    // 管理"已学"状态 - 从 localStorage 读取
    const [isLearned, setIsLearned] = useState(() => {
        const learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        return learnedIds.includes(parseInt(id));
    });

    // 管理"收藏"状态 - 从 localStorage 读取
    const [isFavorite, setIsFavorite] = useState(() => {
        const favoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        return favoriteIds.includes(parseInt(id));
    });

    // 听写模式统计
    const [dictationStats, setDictationStats] = useState({
        correct: 0,
        wrong: 0,
        skipped: 0
    });

    // 听写模式：当前正在听写的句子索引
    const [dictationIndex, setDictationIndex] = useState(0);

    // 听写模式：追踪当前句是否已播放过
    const [hasPlayedCurrent, setHasPlayedCurrent] = useState(false);

    // 初始化数据
    useEffect(() => {
        const video = mockVideos.find(v => v.id === parseInt(id));
        if (video) {
            setVideoData(video);
        }

        // 每次切换视频时，重新检查该视频的学习状态和收藏状态
        const learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        setIsLearned(learnedIds.includes(parseInt(id)));

        const favoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        setIsFavorite(favoriteIds.includes(parseInt(id)));
    }, [id]);

    // 监听 mode 变化，自动保存到 localStorage
    useEffect(() => {
        localStorage.setItem('studyMode', mode);

        // 切换到听写模式时，暂停视频并跳到第一句
        if (mode === 'dictation' && videoData?.transcript) {
            console.log('🎯 切换到听写模式');
            console.log('📍 第一句时间:', videoData.transcript[0].start);

            // 立即停止播放
            setIsPlaying(false);

            // 重置所有听写相关状态
            setDictationIndex(0);
            setDictationStats({ correct: 0, wrong: 0, skipped: 0 });
            setHasPlayedCurrent(false);

            // 强制更新 currentTime 为第一句的时间
            setCurrentTime(videoData.transcript[0].start);

            // 延迟执行跳转，确保状态已更新
            const timer = setTimeout(() => {
                if (playerRef.current) {
                    console.log('🔄 执行视频跳转到:', videoData.transcript[0].start);
                    playerRef.current.seekTo(videoData.transcript[0].start, 'seconds');
                    console.log('✅ 跳转完成');
                }
            }, 200);

            return () => clearTimeout(timer);
        }
    }, [mode, videoData]);

    // 【修复 2】计算并缓存挖空结果，只在 videoData 变化时执行一次
    useEffect(() => {
        if (!videoData?.transcript || !videoData?.vocab) return;

        const vocabWords = videoData.vocab.map(v => v.word.toLowerCase());
        const cache = {};

        videoData.transcript.forEach((item, lineIndex) => {
            const words = item.text.split(' ');
            cache[lineIndex] = words.map((word) => {
                const cleanWord = word.replace(/[.,!?;:]/g, '');
                const wordLower = cleanWord.toLowerCase();

                if (vocabWords.includes(wordLower)) return true;
                if (cleanWord.length <= 3) return false;
                if (cleanWord.length > 4) return Math.random() < 0.2;
                return false;
            });
        });

        setClozeCache(cache);
    }, [videoData]);

    // 【修复】听写模式下禁用自动滚动
    useEffect(() => {
        if (isUserScrolling || !videoData?.transcript || mode === 'dictation') return;

        const activeIndex = videoData.transcript.findIndex((item, index) => {
            const nextItem = videoData.transcript[index + 1];
            return currentTime >= item.start && (!nextItem || currentTime < nextItem.start);
        });

        if (activeIndex !== -1 && transcriptRefs.current[activeIndex]) {
            transcriptRefs.current[activeIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentTime, isUserScrolling, videoData, mode]);

    const handleToggleLearned = () => {
        const newState = !isLearned;
        setIsLearned(newState);

        // 更新 localStorage
        const learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        if (newState) {
            if (!learnedIds.includes(parseInt(id))) {
                learnedIds.push(parseInt(id));
            }
        } else {
            const index = learnedIds.indexOf(parseInt(id));
            if (index > -1) {
                learnedIds.splice(index, 1);
            }
        }
        localStorage.setItem('learnedVideoIds', JSON.stringify(learnedIds));
    };

    const handleToggleFavorite = () => {
        const newState = !isFavorite;
        setIsFavorite(newState);

        // 更新 localStorage
        const favoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        if (newState) {
            if (!favoriteIds.includes(parseInt(id))) {
                favoriteIds.push(parseInt(id));
            }
        } else {
            const index = favoriteIds.indexOf(parseInt(id));
            if (index > -1) {
                favoriteIds.splice(index, 1);
            }
        }
        localStorage.setItem('favoriteVideoIds', JSON.stringify(favoriteIds));
    };

    const handleProgress = (state) => {
        setCurrentTime(state.playedSeconds);

        if (!videoData?.transcript || !isLooping) return;

        const activeIndex = videoData.transcript.findIndex((item, index) => {
            const nextItem = videoData.transcript[index + 1];
            return state.playedSeconds >= item.start && (!nextItem || state.playedSeconds < nextItem.start);
        });

        if (activeIndex !== -1) {
            const currentSub = videoData.transcript[activeIndex];
            const nextSub = videoData.transcript[activeIndex + 1];

            if (nextSub && state.playedSeconds >= nextSub.start) {
                playerRef.current?.seekTo(currentSub.start);
            }
        }
    };

    const handleSeek = (time) => {
        playerRef.current?.seekTo(time);
        if (mode !== 'dictation') {
            setIsPlaying(true);
        }
    };

    const renderClozeText = (text, lineIndex) => {
        const words = text.split(' ');
        const clozePattern = clozeCache[lineIndex] || [];

        return (
            <span>
                {words.map((word, i) => {
                    const shouldCloze = clozePattern[i];
                    if (shouldCloze) {
                        return (
                            <ClozeInput
                                key={i}
                                originalWord={word}
                                onFocus={() => setIsUserScrolling(true)}
                                onBlur={() => setIsUserScrolling(false)}
                            />
                        );
                    }
                    return <span key={i}>{word} </span>;
                })}
            </span>
        );
    };

    // 听写模式：跳到下一句
    const handleNextDictation = () => {
        if (!videoData?.transcript) return;

        const nextIndex = dictationIndex + 1;
        if (nextIndex < videoData.transcript.length) {
            setDictationIndex(nextIndex);
            setHasPlayedCurrent(false); // 重置新句子的播放状态
            playerRef.current?.seekTo(videoData.transcript[nextIndex].start);
            setIsPlaying(false); // 暂停等待用户输入
        }
    };

    if (!videoData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-gray-600">视频加载中...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* 左侧：视频、标题、词汇 */}
            <div className="w-full md:w-3/5 flex flex-col">
                <div className="p-3 md:p-6 flex-shrink-0">
                    {/* 返回按钮 */}
                    <Link
                        to="/"
                        className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium mb-3 md:mb-4 group"
                    >
                        <svg className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        ← 返回首页
                    </Link>

                    {/* 标题 */}
                    <h1 className="text-xl md:text-3xl font-bold mb-2 md:mb-3">{videoData.title}</h1>

                    {/* 元数据 */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600 mb-4 md:mb-6">
                        <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            {videoData.author}
                        </span>
                        <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            {videoData.duration}
                        </span>
                        <span className="flex items-center">{videoData.level}</span>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                            {videoData.category}
                        </span>
                    </div>

                    {/* 视频播放器 */}
                    <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl" style={{ paddingTop: '56.25%' }}>
                        <ReactPlayer
                            ref={playerRef}
                            url={videoData.videoUrl}
                            playing={isPlaying}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onProgress={handleProgress}
                            controls
                            width="100%"
                            height="100%"
                            style={{ position: 'absolute', top: 0, left: 0 }}
                            config={{
                                youtube: {
                                    playerVars: { showinfo: 1 }
                                },
                                file: {
                                    attributes: {
                                        controlsList: 'nodownload'
                                    }
                                }
                            }}
                        />
                    </div>

                    {/* 重点词汇 - 只在电脑端显示 */}
                    <div className="hidden md:block mt-6 p-6 bg-white rounded-xl shadow-sm">
                        <h3 className="text-xl font-bold mb-4">重点词汇</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {videoData.vocab?.map((item, index) => (
                                <div key={index} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                    <div className="flex items-end mb-2">
                                        <span className="text-lg font-bold text-indigo-700 mr-2">{item.word}</span>
                                        <span className="text-sm text-gray-500">{item.type}</span>
                                    </div>
                                    <p className="text-gray-600 font-medium">{item.meaning}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 字幕区域 - 独立滚动 */}
            <div className="flex-1 bg-white border-t md:border-t-0 md:border-l flex flex-col overflow-y-auto pb-20">
                <div className="sticky top-0 z-10 p-3 md:p-4 border-b bg-white flex items-center justify-between">
                    <h2 className="text-base md:text-lg font-bold flex items-center">
                        📖 字幕
                    </h2>

                    {/* 磨砂玻璃风格多模式工具栏 */}
                    <div className="flex gap-1 md:gap-2 bg-gray-50 p-1 rounded-full">
                        <button
                            onClick={() => setMode('dual')}
                            className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${mode === 'dual'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            双语
                        </button>
                        <button
                            onClick={() => setMode('en')}
                            className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${mode === 'en'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            英
                        </button>
                        <button
                            onClick={() => setMode('cn')}
                            className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${mode === 'cn'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            中
                        </button>
                        <button
                            onClick={() => setMode('cloze')}
                            className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${mode === 'cloze'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            挖空
                        </button>
                        <button
                            onClick={() => setMode('dictation')}
                            className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${mode === 'dictation'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            听写
                        </button>
                    </div>
                </div>

                {/* 听写模式统计面板 */}
                {mode === 'dictation' && (
                    <div className="mx-3 mt-3 md:mx-4 md:mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg shadow-sm">
                        <div className="flex justify-around">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{dictationStats.correct}</div>
                                <div className="text-xs text-gray-600">答对</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">{dictationStats.wrong}</div>
                                <div className="text-xs text-gray-600">答错</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-600">{dictationStats.skipped}</div>
                                <div className="text-xs text-gray-600">跳过</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {dictationStats.correct + dictationStats.wrong + dictationStats.skipped > 0
                                        ? Math.round((dictationStats.correct / (dictationStats.correct + dictationStats.wrong + dictationStats.skipped)) * 100)
                                        : 0}%
                                </div>
                                <div className="text-xs text-gray-600">正确率</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 字幕列表 */}
                <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                    {mode === 'dictation' ? (
                        /* 听写模式：只显示当前句 */
                        <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                            <DictationInput
                                correctAnswer={videoData.transcript[dictationIndex]?.text || ''}
                                currentIndex={dictationIndex}
                                totalCount={videoData.transcript.length}
                                onCorrect={() => {
                                    console.log('答对了！');
                                    setDictationStats(prev => ({ ...prev, correct: prev.correct + 1 }));
                                    // 1.5秒后自动跳到下一句
                                    setTimeout(() => {
                                        handleNextDictation();
                                    }, 1500);
                                }}
                                onWrong={() => {
                                    setDictationStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
                                }}
                                onSkip={() => {
                                    console.log('跳过当前句');
                                    setDictationStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
                                    handleNextDictation();
                                }}
                                onReplay={() => {
                                    // 重播当前句子
                                    const currentSubtitle = videoData.transcript[dictationIndex];
                                    playerRef.current?.seekTo(currentSubtitle.start);
                                    setIsPlaying(true);
                                    setHasPlayedCurrent(true); // 标记已播放

                                    // 自动暂停在句尾
                                    const nextSubtitle = videoData.transcript[dictationIndex + 1];
                                    if (nextSubtitle) {
                                        setTimeout(() => {
                                            setIsPlaying(false);
                                        }, (nextSubtitle.start - currentSubtitle.start) * 1000);
                                    }
                                }}
                                hasPlayed={hasPlayedCurrent}
                            />

                            {/* 中文翻译（可折叠） */}
                            <details className="mt-4">
                                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 font-medium">
                                    💡 显示中文翻译
                                </summary>
                                <p className="mt-2 text-gray-700 pl-4">{videoData.transcript[dictationIndex]?.cn}</p>
                            </details>
                        </div>
                    ) : (
                        /* 其他模式：显示所有字幕 */
                        videoData.transcript?.map((item, index) => {
                            const nextItem = videoData.transcript[index + 1];
                            const isActive = currentTime >= item.start && (!nextItem || currentTime < nextItem.start);

                            return (
                                <div
                                    key={index}
                                    ref={(el) => transcriptRefs.current[index] = el}
                                    onClick={() => handleSeek(item.start)}
                                    className={`relative pl-6 pr-4 py-3 rounded-lg cursor-pointer transition-colors duration-200 ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    {/* 蓝色指示条 */}
                                    <div
                                        className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg transition-opacity duration-200 ${isActive ? 'bg-indigo-600 opacity-100' : 'opacity-0'
                                            }`}
                                    />

                                    {/* 文字内容 */}
                                    <div className="flex-1">
                                        {/* 英文 */}
                                        <div className="text-base font-medium text-gray-900 leading-loose mb-1">
                                            {mode === 'cloze' ? (
                                                renderClozeText(item.text, index)
                                            ) : (
                                                mode === 'cn' ? null : (
                                                    <HighlightedText
                                                        text={item.text}
                                                        highlights={item.highlights || []}
                                                    />
                                                )
                                            )}
                                        </div>

                                        {/* 中文 */}
                                        <div className={`text-sm transition-all duration-300 ${mode === 'en'
                                            ? 'blur-sm bg-gray-200 text-transparent select-none hover:blur-0 hover:bg-transparent hover:text-gray-600'
                                            : 'text-gray-600'
                                            }`}>
                                            {item.cn}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* 重点词汇 - 只在手机端显示，放在字幕列表底部 */}
                    <div className="md:hidden mt-6 p-4 bg-indigo-50 rounded-lg">
                        <h3 className="text-lg font-bold mb-3 text-indigo-900">重点词汇</h3>
                        <div className="space-y-3">
                            {videoData.vocab?.map((item, index) => (
                                <div key={index} className="p-3 bg-white rounded-lg border border-indigo-100">
                                    <div className="flex items-end mb-1">
                                        <span className="text-base font-bold text-indigo-700 mr-2">{item.word}</span>
                                        <span className="text-xs text-gray-500">{item.type}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium">{item.meaning}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 浮动控制按钮 */}
            <FloatingControls
                isLooping={isLooping}
                onToggleLoop={() => setIsLooping(!isLooping)}
                isFavorited={isFavorite}
                onToggleFavorite={handleToggleFavorite}
                isLearned={isLearned}
                onToggleLearned={handleToggleLearned}
            />
        </div>
    );
};

export default VideoDetail;