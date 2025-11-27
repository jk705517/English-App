import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { mockVideos } from '../data/mockData';
import HighlightedText from '../components/HighlightedText';

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

// 听写输入组件
const DictationInput = ({ correctText, onFocus, onBlur }) => {
    const [value, setValue] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle', 'correct', 'error'
    const [showAnswer, setShowAnswer] = useState(false);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            // 移除标点符号后比较
            const cleanCorrect = correctText.replace(/[.,!?;:'"]/g, '').toLowerCase().trim();
            const cleanInput = value.replace(/[.,!?;:'"]/g, '').toLowerCase().trim();

            if (cleanInput === cleanCorrect) {
                setStatus('correct');
            } else {
                setStatus('error');
                // 1秒后显示正确答案
                setTimeout(() => setShowAnswer(true), 1000);
            }
        }
    };

    if (status === 'correct') {
        return (
            <div className="text-green-600 font-medium">
                ✓ {correctText}
            </div>
        );
    }

    if (showAnswer) {
        return (
            <div>
                <div className="text-red-500 line-through mb-1">{value}</div>
                <div className="text-green-600 font-medium">正确答案：{correctText}</div>
            </div>
        );
    }

    return (
        <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="听完后在此输入整句..."
            className={`w-full px-3 py-2 rounded-lg border-2 font-medium transition-all ${status === 'error'
                ? 'border-red-300 bg-red-50 text-red-600 animate-shake'
                : 'border-gray-200 bg-gray-50 text-gray-800 focus:border-indigo-500 focus:bg-white'
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
    }, [mode]);

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

    // 【修复 1】将自动滚动逻辑移到独立的 useEffect
    useEffect(() => {
        if (isUserScrolling || !videoData?.transcript) return;

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
    }, [currentTime, isUserScrolling, videoData]);

    // 切换"已学/未学"状态
    const handleToggleLearned = () => {
        const videoId = parseInt(id);
        const learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');

        let updatedIds;
        if (learnedIds.includes(videoId)) {
            // 移除
            updatedIds = learnedIds.filter(id => id !== videoId);
            setIsLearned(false);
        } else {
            // 添加
            updatedIds = [...learnedIds, videoId];
            setIsLearned(true);
        }

        localStorage.setItem('learnedVideoIds', JSON.stringify(updatedIds));
    };

    // 切换"收藏/取消收藏"状态
    const handleToggleFavorite = () => {
        const videoId = parseInt(id);
        const favoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');

        let updatedIds;
        if (favoriteIds.includes(videoId)) {
            // 移除收藏
            updatedIds = favoriteIds.filter(id => id !== videoId);
            setIsFavorite(false);
        } else {
            // 添加收藏
            updatedIds = [...favoriteIds, videoId];
            setIsFavorite(true);
        }

        localStorage.setItem('favoriteVideoIds', JSON.stringify(updatedIds));
    };

    // 处理点击字幕跳转
    const handleSeek = (seconds) => {
        console.log("试图跳转到秒数:", seconds);
        if (playerRef.current) {
            playerRef.current.seekTo(seconds, 'seconds');
            setIsPlaying(true);
        } else {
            console.log("播放器实例未找到！");
        }
    };

    // 【修复 2】修改 renderClozeText 函数，从缓存读取挖空结果
    const renderClozeText = (text, lineIndex) => {
        const words = text.split(' ');
        const shouldBlurList = clozeCache[lineIndex] || [];

        return words.map((word, idx) => {
            const shouldBlur = shouldBlurList[idx];

            if (shouldBlur) {
                return (
                    <ClozeInput
                        key={idx}
                        originalWord={word}
                        onFocus={() => setIsUserScrolling(true)}
                        onBlur={() => setIsUserScrolling(false)}
                    />
                );
            }
            return <span key={idx}>{word} </span>;
        });
    };

    if (!videoData) return <div className="p-8">Loading...</div>;

    return (
        <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50">
            {/* 视频区域 - 手机端固定头部，电脑端左侧独立滚动 */}
            <div className="flex-shrink-0 z-10 bg-white md:w-3/5 md:overflow-y-auto md:h-full">
                <div className="p-4 md:p-6">
                    <div className="flex items-center justify-between mb-2 md:mb-4">
                        <Link to="/" className="text-gray-600 hover:text-blue-600 flex items-center text-sm md:text-base">
                            ← 返回首页
                        </Link>
                    </div>

                    <h1 className="text-lg md:text-2xl font-bold mb-3">{videoData.title}</h1>

                    {/* 视频播放器容器 */}
                    <div className="w-full aspect-video bg-black rounded-lg md:rounded-xl overflow-hidden shadow-lg" onContextMenu={(e) => e.preventDefault()}>
                        <ReactPlayer
                            ref={playerRef}
                            url={videoData.videoUrl}
                            width="100%"
                            height="100%"
                            controls={true}
                            playing={isPlaying}
                            playsinline={true}  // 关键：防止 iOS 自动全屏
                            progressInterval={50}  // 每50ms更新一次进度，提高响应速度
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onProgress={({ playedSeconds }) => {
                                setCurrentTime(playedSeconds);

                                // 单句循环逻辑 - 优化版（提前0.2s判断）
                                if (isLooping && videoData?.transcript && videoData.transcript.length > 0) {
                                    // 找到当前正在播放的字幕索引
                                    let currentIndex = -1;
                                    for (let i = 0; i < videoData.transcript.length; i++) {
                                        const item = videoData.transcript[i];
                                        const nextItem = videoData.transcript[i + 1];

                                        if (playedSeconds >= item.start && (!nextItem || playedSeconds < nextItem.start)) {
                                            currentIndex = i;
                                            break;
                                        }
                                    }

                                    // 如果找到了当前句，并且不是最后一句
                                    if (currentIndex !== -1 && currentIndex < videoData.transcript.length - 1) {
                                        const currentLine = videoData.transcript[currentIndex];
                                        const nextLine = videoData.transcript[currentIndex + 1];
                                        const endTime = nextLine.start;

                                        // 提前0.2秒判断，防止滑过
                                        if (playedSeconds >= endTime - 0.2) {
                                            playerRef.current?.seekTo(currentLine.start, 'seconds');
                                        }
                                    }
                                }
                            }}
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

                    {/* 操作工具栏 - 视频播放器正下方 */}
                    <div className="mt-4 flex items-center gap-3">
                        {/* 单句循环按钮 */}
                        <button
                            onClick={() => setIsLooping(!isLooping)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${isLooping
                                ? 'bg-purple-500 border-purple-500 text-white shadow-md'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-purple-400 hover:bg-purple-50'
                                }`}
                        >
                            🔁 单句循环
                        </button>

                        {/* 收藏按钮 */}
                        <button
                            onClick={handleToggleFavorite}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${isFavorite
                                ? 'bg-red-500 border-red-500 text-white shadow-md'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-red-400 hover:bg-red-50'
                                }`}
                        >
                            ❤️ 收藏
                        </button>

                        {/* 标记已学按钮 */}
                        <button
                            onClick={handleToggleLearned}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${isLearned
                                ? 'bg-green-500 border-green-500 text-white shadow-md'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-green-400 hover:bg-green-50'
                                }`}
                        >
                            ✅ 标记已学
                        </button>
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

                {/* 字幕列表 */}
                <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                    {videoData.transcript?.map((item, index) => {
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
                                {/* 蓝色指示条：absolute 绝对定位。它悬浮在 padding 区域内，不占位置，不会挤压文字 */}
                                <div
                                    className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg transition-opacity duration-200 ${isActive ? 'bg-indigo-600 opacity-100' : 'opacity-0'
                                        }`}
                                />

                                {/* 文字内容：位置被父级 padding 锁定，永远不会动 */}
                                <div className="flex-1">
                                    {/* 英文 */}
                                    <div className="text-base font-medium text-gray-900 leading-loose mb-1">
                                        {mode === 'cloze' ? (
                                            renderClozeText(item.text, index)
                                        ) : mode === 'dictation' ? (
                                            <DictationInput
                                                correctText={item.text}
                                                onFocus={() => setIsUserScrolling(true)}
                                                onBlur={() => setIsUserScrolling(false)}
                                            />
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
                    })}

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
        </div>
    );
};

export default VideoDetail;