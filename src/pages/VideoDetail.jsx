import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { supabase } from '../lib/supabase';
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

// 🆕 TTS 朗读函数
const speak = (text, lang = 'en-US') => {
    if (!window.speechSynthesis) return;

    // 取消之前的朗读
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // 稍微慢一点
    window.speechSynthesis.speak(utterance);
};

const VideoDetail = () => {
    const { id } = useParams();
    const playerRef = useRef(null);
    const transcriptRefs = useRef([]);
    const scrollTimeoutRef = useRef(null); // 🆕 添加滚动超时引用
    const [currentTime, setCurrentTime] = useState(0);
    const [videoData, setVideoData] = useState(null);
    const [allVideos, setAllVideos] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const [clozeCache, setClozeCache] = useState({});

    // 🆕 新增：跳转锁定标志，防止 onProgress 干扰
    const [isSeeking, setIsSeeking] = useState(false);

    // 🆕 新增：追踪播放速度
    const [playbackRate, setPlaybackRate] = useState(1);

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

    // Fetch video data from Supabase
    useEffect(() => {
        const fetchVideoData = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching video:', error);
            } else {
                console.log('Video data loaded:', data);
                setVideoData(data);
            }
        };

        fetchVideoData();

        // Check learned and favorite status
        const learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        setIsLearned(learnedIds.includes(parseInt(id)));

        const favoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        setIsFavorite(favoriteIds.includes(parseInt(id)));
    }, [id]);

    // Fetch all videos for navigation
    useEffect(() => {
        const fetchAllVideos = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('id, episode')
                .order('episode', { ascending: false });

            if (error) {
                console.error('Error fetching all videos:', error);
            } else {
                setAllVideos(data || []);
            }
        };

        fetchAllVideos();
    }, []);

    // 监听 mode 变化，自动保存到 localStorage
    useEffect(() => {
        localStorage.setItem('studyMode', mode);

        // 切换到听写模式时，暂停视频并跳到第一句
        if (mode === 'dictation' && videoData?.transcript) {
            console.log('🎯 切换到听写模式');
            const firstSentenceTime = videoData.transcript[0].start;
            console.log('📍 第一句时间:', firstSentenceTime);

            // 重置所有听写相关状态
            setDictationIndex(0);
            setDictationStats({ correct: 0, wrong: 0, skipped: 0 });
            setHasPlayedCurrent(false);

            // 🆕 开启跳转锁定
            setIsSeeking(true);

            // 第一步：立即暂停视频
            setIsPlaying(false);

            // 第二步：等待状态更新后跳转
            setTimeout(() => {
                if (playerRef.current) {
                    console.log('🔄 执行视频跳转到:', firstSentenceTime);
                    playerRef.current.seekTo(firstSentenceTime, 'seconds');

                    // 强制更新 currentTime
                    setCurrentTime(firstSentenceTime);
                }
            }, 50);

            // 第三步：确保暂停并解除锁定
            setTimeout(() => {
                console.log('⏸️ 强制暂停视频');
                setIsPlaying(false);

                // 尝试直接操作内部播放器
                if (playerRef.current?.getInternalPlayer) {
                    const player = playerRef.current.getInternalPlayer();
                    if (player && typeof player.pause === 'function') {
                        player.pause();
                    }
                }

                // 🆕 解除跳转锁定
                setTimeout(() => {
                    setIsSeeking(false);
                    console.log('✅ 跳转完成，锁定已解除');
                }, 200);
            }, 200);
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

    // 🆕 使用 ref 存储最新状态，避免 useEffect 闭包问题
    const dictationStateRef = useRef({ isPlaying: false, isSeeking: false, dictationIndex: 0 });

    // 同步更新 ref
    useEffect(() => {
        dictationStateRef.current = { isPlaying, isSeeking, dictationIndex };
    }, [isPlaying, isSeeking, dictationIndex]);

    // 🆕 听写模式：使用 timeupdate 事件精准检测播放位置
    useEffect(() => {
        if (mode !== 'dictation' || !videoData?.transcript) return;

        // 延迟获取 player，确保 ReactPlayer 已经挂载
        const setupListener = () => {
            const player = playerRef.current?.getInternalPlayer();
            if (!player || typeof player.addEventListener !== 'function') {
                // 如果还没准备好，稍后重试
                setTimeout(setupListener, 500);
                return null;
            }

            const handleTimeUpdate = () => {
                const { isPlaying: playing, isSeeking: seeking, dictationIndex: idx } = dictationStateRef.current;

                if (!playing || seeking) return;

                const currentVideoTime = player.currentTime;
                const currentSubtitle = videoData.transcript[idx];
                const nextSubtitle = videoData.transcript[idx + 1];

                // 🆕 如果播放到了下一句的开始时间前 0.3 秒，提前暂停
                // 这样可以避免播放到下一句的开头
                if (nextSubtitle && currentVideoTime >= nextSubtitle.start - 0.3) {
                    console.log('🛑 timeupdate: 自动暂停 at', currentVideoTime.toFixed(2), '下一句开始:', nextSubtitle.start);
                    player.pause();
                    setIsPlaying(false);
                }

                // 🆕 如果是最后一句，检测是否接近视频结尾
                if (!nextSubtitle && currentSubtitle) {
                    // 假设最后一句播放 5 秒后暂停
                    if (currentVideoTime >= currentSubtitle.start + 5) {
                        player.pause();
                        setIsPlaying(false);
                    }
                }
            };

            console.log('✅ timeupdate 监听器已添加');
            player.addEventListener('timeupdate', handleTimeUpdate);

            return () => {
                console.log('🗑️ timeupdate 监听器已移除');
                player.removeEventListener('timeupdate', handleTimeUpdate);
            };
        };

        const cleanup = setupListener();
        return () => {
            if (typeof cleanup === 'function') cleanup();
        };
    }, [mode, videoData]);

    // 🆕 监听用户滚动，5秒后恢复自动滚动
    useEffect(() => {
        if (!videoData?.transcript || mode === 'dictation') return;

        const subtitleContainer = document.querySelector('.flex-1.bg-white.border-t');
        if (!subtitleContainer) return;

        const handleScroll = () => {
            // 用户手动滚动，标记状态
            setIsUserScrolling(true);

            // 清除之前的定时器
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            // 5秒后恢复自动滚动
            scrollTimeoutRef.current = setTimeout(() => {
                setIsUserScrolling(false);
            }, 5000);
        };

        subtitleContainer.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            subtitleContainer.removeEventListener('scroll', handleScroll);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [videoData, mode]);

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

    // 🆕 修复：handleProgress 增加保护逻辑
    const handleProgress = (state) => {
        // 如果正在跳转中，忽略进度更新
        if (isSeeking) {
            return;
        }

        // 听写模式下且视频暂停时，不更新 currentTime
        if (mode === 'dictation' && !isPlaying) {
            return;
        }

        setCurrentTime(state.playedSeconds);

        // 单句循环逻辑（非听写模式）
        if (!videoData?.transcript || !isLooping || mode === 'dictation') return;

        // 找到当前播放位置对应的字幕索引
        let activeIndex = -1;
        for (let i = 0; i < videoData.transcript.length; i++) {
            const item = videoData.transcript[i];
            const nextItem = videoData.transcript[i + 1];
            if (state.playedSeconds >= item.start && (!nextItem || state.playedSeconds < nextItem.start)) {
                activeIndex = i;
                break;
            }
        }

        // 🆕 修复：检测是否即将播放到下一句，提前跳回
        if (activeIndex !== -1) {
            const currentSub = videoData.transcript[activeIndex];
            const nextSub = videoData.transcript[activeIndex + 1];

            // 如果有下一句，且当前时间接近下一句开始（提前 0.3 秒跳回）
            if (nextSub && state.playedSeconds >= nextSub.start - 0.3) {
                console.log('🔁 单句循环: 跳回', currentSub.start);
                playerRef.current?.seekTo(currentSub.start, 'seconds');
            }
        }
    };

    // 🆕 修复：handleSeek 添加跳转锁定
    const handleSeek = (time) => {
        // 开启跳转锁定
        setIsSeeking(true);

        // 先同步更新 currentTime
        setCurrentTime(time);

        // 执行跳转
        playerRef.current?.seekTo(time, 'seconds');

        if (mode !== 'dictation') {
            // 稍等一下再开始播放，确保跳转完成
            setTimeout(() => {
                setIsPlaying(true);
                // 解除锁定
                setTimeout(() => {
                    setIsSeeking(false);
                }, 200);
            }, 100);
        } else {
            // 听写模式下直接解除锁定
            setTimeout(() => {
                setIsSeeking(false);
            }, 300);
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
            // 🆕 开启跳转锁定
            setIsSeeking(true);

            setDictationIndex(nextIndex);
            setHasPlayedCurrent(false); // 重置新句子的播放状态

            const nextTime = videoData.transcript[nextIndex].start;
            setCurrentTime(nextTime); // 同步更新 currentTime
            playerRef.current?.seekTo(nextTime, 'seconds');
            setIsPlaying(false); // 暂停等待用户输入

            // 🆕 解除跳转锁定
            setTimeout(() => {
                setIsSeeking(false);
            }, 300);
        }
    };

    // 🆕 听写模式：重播当前句（优化版）
    const handleReplayDictation = () => {
        if (!videoData?.transcript) return;

        const currentSubtitle = videoData.transcript[dictationIndex];
        const nextSubtitle = videoData.transcript[dictationIndex + 1];

        // 开启跳转锁定
        setIsSeeking(true);

        // 跳转到当前句开始
        playerRef.current?.seekTo(currentSubtitle.start, 'seconds');

        // 稍等一下再开始播放
        setTimeout(() => {
            setIsSeeking(false);
            setIsPlaying(true);
            setHasPlayedCurrent(true); // 标记已播放
            // 🆕 不再使用 setTimeout 暂停，改为在 handleProgress 中检测
        }, 100);
    };

    if (!videoData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-gray-600">视频加载中...</div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* 左侧：视频、标题、词汇 */}
            <div className="w-full md:w-3/5 flex flex-col overflow-y-auto">
                <div className="p-3 md:p-6 flex-shrink-0">
                    {/* 上一期/下一期导航 */}
                    <div className="flex gap-3 mb-3 md:mb-4">
                        {allVideos.findIndex(v => v.id === parseInt(id)) > 0 && (
                            <Link
                                to={`/video/${allVideos[allVideos.findIndex(v => v.id === parseInt(id)) - 1].id}`}
                                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                上一期
                            </Link>
                        )}
                        {allVideos.findIndex(v => v.id === parseInt(id)) < allVideos.length - 1 && (
                            <Link
                                to={`/video/${allVideos[allVideos.findIndex(v => v.id === parseInt(id)) + 1].id}`}
                                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                            >
                                下一期
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        )}
                    </div>

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
                    <div className="sticky top-0 z-20 md:relative bg-black rounded-xl overflow-hidden shadow-2xl" style={{ paddingTop: '56.25%' }}>
                        <ReactPlayer
                            ref={playerRef}
                            url={videoData.video_url}
                            playing={isPlaying}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onProgress={handleProgress}
                            progressInterval={100}
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
                                        controlsList: 'nodownload',
                                        playsInline: true,  // React 驼峰命名
                                        'webkit-playsinline': 'true',  // iOS Safari
                                        'x5-video-player-type': 'h5',  // 微信浏览器
                                        'x5-video-player-fullscreen': 'false',  // 微信浏览器防止全屏
                                        'x5-playsinline': 'true'  // 腾讯系浏览器
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
                                <div key={index} data-vocab-word={item.word} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 transition-all duration-200">
                                    <div className="flex items-end mb-2">
                                        <span className="text-lg font-bold text-indigo-700 mr-2">{item.word}</span>
                                        <span className="text-sm text-gray-500">{item.type}</span>
                                    </div>

                                    {/* 音标展示 */}
                                    {(item.ipa_us || item.ipa_uk) && (
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2 font-mono">
                                            {item.ipa_us && (
                                                <div className="flex items-center gap-1 whitespace-nowrap">
                                                    <span className="text-gray-400">US</span>
                                                    <span>/{item.ipa_us}/</span>
                                                    <button
                                                        onClick={() => speak(item.word, 'en-US')}
                                                        className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                                                        title="美式发音"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                            {item.ipa_uk && (
                                                <div className="flex items-center gap-1 whitespace-nowrap">
                                                    <span className="text-gray-400">UK</span>
                                                    <span>/{item.ipa_uk}/</span>
                                                    <button
                                                        onClick={() => speak(item.word, 'en-GB')}
                                                        className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                                                        title="英式发音"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-gray-600 font-medium mb-3">{item.meaning}</p>

                                    {/* 例句展示 */}
                                    {item.examples && item.examples.length > 0 && (
                                        <div className="mb-3 space-y-2">
                                            {item.examples.map((ex, i) => (
                                                <div key={i} className="text-sm">
                                                    <p className="text-gray-800">{ex.en}</p>
                                                    <p className="text-gray-500 text-xs">{ex.cn}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 搭配展示 */}
                                    {item.collocations && item.collocations.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {item.collocations.map((col, i) => (
                                                <span key={i} className="px-2 py-1 bg-white text-indigo-600 text-xs rounded border border-indigo-100">
                                                    {col}
                                                </span>
                                            ))}
                                        </div>
                                    )}
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
                                onReplay={handleReplayDictation}
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
                                    className={`relative pl-10 pr-4 py-3 rounded-lg cursor-pointer transition-colors duration-200 ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    {/* 🆕 字幕行编号 */}
                                    <span className={`absolute left-2 top-3 text-xs font-medium ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                                        {index + 1}
                                    </span>

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
                                                        highlights={videoData.vocab || []}
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
                                <div key={index} data-vocab-word={item.word} className="p-3 bg-white rounded-lg border border-indigo-100 transition-all duration-200">
                                    <div className="flex items-end mb-1">
                                        <span className="text-base font-bold text-indigo-700 mr-2">{item.word}</span>
                                        <span className="text-xs text-gray-500">{item.type}</span>
                                    </div>

                                    {/* 手机端音标展示 */}
                                    {(item.ipa_us || item.ipa_uk) && (
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-1.5 font-mono">
                                            {item.ipa_us && (
                                                <div className="flex items-center gap-1 whitespace-nowrap">
                                                    <span className="text-gray-400">US</span>
                                                    <span>/{item.ipa_us}/</span>
                                                    <button
                                                        onClick={() => speak(item.word, 'en-US')}
                                                        className="p-0.5 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                            {item.ipa_uk && (
                                                <div className="flex items-center gap-1 whitespace-nowrap">
                                                    <span className="text-gray-400">UK</span>
                                                    <span>/{item.ipa_uk}/</span>
                                                    <button
                                                        onClick={() => speak(item.word, 'en-GB')}
                                                        className="p-0.5 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-sm text-gray-600 font-medium mb-2">{item.meaning}</p>

                                    {/* 手机端例句 */}
                                    {item.examples && item.examples.length > 0 && (
                                        <div className="mb-2 space-y-2 border-t border-indigo-50 pt-2">
                                            {item.examples.map((ex, i) => (
                                                <div key={i} className="text-xs">
                                                    <p className="text-gray-800 mb-0.5">{ex.en}</p>
                                                    <p className="text-gray-500">{ex.cn}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 手机端搭配 */}
                                    {item.collocations && item.collocations.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {item.collocations.map((col, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded">
                                                    {col}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 浮动控制按钮 */}
            <FloatingControls
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
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