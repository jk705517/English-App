import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { mockVideos } from '../data/mockData';

// 交互式填空组件
const ClozeInput = ({ originalWord }) => {
    const [value, setValue] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle', 'correct', 'error'
    const inputRef = useRef(null);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const userInput = value.trim();
            const correctWord = originalWord.replace(/[.,!?;:]/g, ''); // 移除标点符号

            if (userInput.toLowerCase() === correctWord.toLowerCase()) {
                setStatus('correct');
            } else {
                setStatus('error');
                // 抖动动画后重置
                setTimeout(() => setStatus('idle'), 500);
            }
        }
    };

    // 根据单词长度计算输入框宽度
    const inputWidth = Math.max(originalWord.length, 4);

    if (status === 'correct') {
        return <span className="text-green-600 font-medium mx-1">{originalWord}</span>;
    }

    return (
        <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`inline-block mx-1 px-1 bg-transparent border-b-2 outline-none transition-all duration-200 ${status === 'error'
                    ? 'border-red-500 text-red-500 animate-shake'
                    : 'border-gray-400 text-gray-700 focus:border-indigo-500'
                }`}
            style={{ width: `${inputWidth}ch` }}
            placeholder="___"
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

    // Cloze 模式：智能挖空算法
    const renderClozeText = (text, vocabList = []) => {
        const words = text.split(' ');

        // 创建词汇表的小写版本用于匹配
        const vocabWords = vocabList.map(v => v.word.toLowerCase());

        return words.map((word, idx) => {
            // 移除标点符号用于判断
            const cleanWord = word.replace(/[.,!?;:]/g, '');
            const wordLower = cleanWord.toLowerCase();

            let shouldBlur = false;

            // 规则 A：重点词汇强制挖空
            if (vocabWords.includes(wordLower)) {
                shouldBlur = true;
            }
            // 规则 C：短词永不挖空
            else if (cleanWord.length <= 3) {
                shouldBlur = false;
            }
            // 规则 B：长词 20% 概率挖空
            else if (cleanWord.length > 4) {
                shouldBlur = Math.random() < 0.2;
            }

            if (shouldBlur) {
                return (
                    <ClozeInput key={idx} originalWord={word} />
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
                    </div>
                </div>

                {/* 字幕列表 */}
                <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                    {videoData.transcript?.map((item, index) => {
                        const nextItem = videoData.transcript[index + 1];
                        const isActive = currentTime >= item.start && (!nextItem || currentTime < nextItem.start);

                        // 自动滚动到当前高亮行
                        if (isActive && transcriptRefs.current[index]) {
                            transcriptRefs.current[index].scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }

                        return (
                            <div
                                key={index}
                                ref={(el) => transcriptRefs.current[index] = el}
                                onClick={() => handleSeek(item.start)}
                                className={`p-3 md:p-4 rounded-lg cursor-pointer transition-all duration-200 border-l-4 ${isActive
                                    ? 'bg-indigo-100 border-indigo-600 shadow-sm'
                                    : 'hover:bg-gray-50 text-gray-600 border-transparent'
                                    }`}
                            >
                                {/* 英文部分 - 根据模式显示 */}
                                {mode === 'cloze' ? (
                                    <p className={`text-base font-medium leading-relaxed mb-1 ${isActive ? 'text-indigo-700 font-bold' : 'text-gray-900'}`}>
                                        {renderClozeText(item.text, videoData.vocab)}
                                    </p>
                                ) : (
                                    <p
                                        className={`text-base font-medium leading-relaxed mb-1 ${mode === 'cn'
                                                ? 'bg-gray-200 select-none text-transparent transition-all duration-300 hover:bg-transparent hover:text-gray-700 rounded px-1'
                                                : isActive
                                                    ? 'text-indigo-700 font-bold'
                                                    : 'text-gray-900'
                                            }`}
                                    >
                                        {item.text}
                                    </p>
                                )}

                                {/* 中文部分 - 根据模式显示 */}
                                <p
                                    className={`text-sm font-normal mt-1 ${mode === 'en'
                                            ? 'bg-gray-200 select-none text-transparent transition-all duration-300 hover:bg-transparent hover:text-gray-700 rounded px-1'
                                            : isActive
                                                ? 'text-indigo-600'
                                                : 'text-gray-600'
                                        }`}
                                >
                                    {item.cn}
                                </p>
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