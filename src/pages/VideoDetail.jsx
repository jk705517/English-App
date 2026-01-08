import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
// Note: ReactPlayer import removed - using native <video> element for custom controls
import { videoAPI, vocabOccurrencesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { progressService } from '../services/progressService';
import { favoritesService } from '../services/favoritesService';
import HighlightedText from '../components/HighlightedText';
import SubtitleItem from '../components/SubtitleItem';
import DictationInput from '../components/DictationInput';
import ClozeInput from '../components/ClozeInput';
import IntensiveSentencePanel from '../components/IntensiveSentencePanel';
import IntensiveSentenceList from '../components/IntensiveSentenceList';
import AddToNotebookDialog from '../components/AddToNotebookDialog';
import { generateClozeData } from '../utils/clozeGenerator';
import * as demoStorage from '../services/demoStorage';

// TTS 发音函数 - 使用 Azure TTS API
const speak = async (text, lang = 'en-US') => {
    try {
        // 将浏览器的 lang 参数转换为 API 的 accent 参数
        const accent = lang === 'en-GB' ? 'uk' : 'us';
        const url = `https://api.biubiuenglish.com/api/tts?text=${encodeURIComponent(text)}&accent=${accent}`;

        const audio = new Audio(url);
        audio.play();
    } catch (error) {
        console.error('TTS 播放失败:', error);
    }
};

// 难度等级转换为星星显示
const renderLevel = (level) => {
    const num = parseInt(level) || 0;
    return '⭐'.repeat(Math.min(Math.max(num, 0), 5));
};

// 字幕导航组件
const SubtitleTabs = ({ mode, setMode, onPrint, className = "", isMobileStyle = false }) => (
    <div className={`flex items-center justify-between ${isMobileStyle ? 'overflow-hidden' : ''} ${className}`}>
        <h2 className={`font-bold flex items-center shrink-0 ${isMobileStyle ? 'text-sm' : 'text-base md:text-lg'}`}>📖 字幕</h2>
        <div className={`flex items-center ${isMobileStyle ? 'flex-1 justify-end ml-2' : 'gap-1 md:gap-2'}`}>
            <div className={`flex bg-gray-50 p-1 rounded-full ${isMobileStyle ? 'gap-1' : 'gap-1 md:gap-2 overflow-x-auto'}`}>
                {['dual', 'en', 'cn', 'intensive', 'cloze', 'dictation'].map((m) => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`rounded-full font-medium transition-all duration-200 whitespace-nowrap ${isMobileStyle ? 'px-2 py-1 text-xs' : 'px-2 md:px-3 py-1 text-xs md:text-sm'} ${mode === m ? 'bg-violet-400 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {m === 'dual' ? '双语' : m === 'en' ? '英' : m === 'cn' ? '中' : m === 'intensive' ? '精读' : m === 'cloze' ? '挖空' : '听写'}
                    </button>
                ))}
            </div>
            {/* 分隔线 */}
            <div className={`h-6 w-px bg-gray-300 shrink-0 ${isMobileStyle ? 'mx-1.5' : 'mx-1'}`}></div>
            {/* 打印按钮 */}
            <button
                onClick={onPrint}
                className={`rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 ${isMobileStyle ? 'p-1.5' : 'p-2'}`}
                title="打印字幕"
            >
                <svg className={`${isMobileStyle ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
            </button>
        </div>
    </div>
);

const VideoDetail = ({ isDemo = false, demoEpisode = 29 }) => {
    const { episode: urlEpisode } = useParams();
    const episode = isDemo ? demoEpisode : urlEpisode;
    const location = useLocation();
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    // Demo 模式不需要真实用户，创建一个虚拟用户对象用于本地存储
    const user = isDemo ? { id: 'demo-user' } : authUser;

    // Parse query params for sentence/vocab navigation from Favorites page
    const searchParams = new URLSearchParams(location.search);
    const sentenceIdFromQuery = searchParams.get('sentenceId');
    const vocabIdFromQuery = searchParams.get('vocabId');
    const modeFromQuery = searchParams.get('mode');
    // New params for notebook navigation (index-based)
    const typeFromQuery = searchParams.get('type'); // 'sentence' | 'vocab'
    const indexFromQuery = searchParams.get('index');
    const playerRef = useRef(null);
    const playerContainerRef = useRef(null);
    const transcriptRefs = useRef([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoData, setVideoData] = useState(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [prevVideo, setPrevVideo] = useState(null);
    const [nextVideo, setNextVideo] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    // 视频循环 - 整支视频播放完从头循环
    const [isVideoLooping, setIsVideoLooping] = useState(false);
    // 单句循环 - 当前字幕句循环（与右侧悬浮按钮共用同一状态）
    const [isSentenceLooping, setIsSentenceLooping] = useState(false);
    // 单句暂停 - 每句结束自动暂停，方便跟读练习
    const [isSentencePauseEnabled, setIsSentencePauseEnabled] = useState(false);
    // 手机端更多设置面板状态
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [visitedSet, setVisitedSet] = useState(new Set()); // Track visited sentences in intensive mode
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
    // 绉诲姩绔細鏄惁鏄剧ず椤堕儴"缁х画鎾斁"灏忔潯锛堟殏鍋?鎾斁鍣ㄨ婊氬姩闅愯棌鏃讹級
    const [showMobileMiniBar, setShowMobileMiniBar] = useState(false);
    // 绉诲姩绔細鏆傚仠鍚庢槸鍚﹀凡婊氬姩锛堢敤浜庡欢杩熷垏鎹㈠皬绐楀彛妯″紡锛?
    const [hasScrolledAfterPause, setHasScrolledAfterPause] = useState(false);
    // 妫€娴嬫槸鍚︿负绉诲姩绔?
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1280);
    // 检测是否为手机端（< 768px，仅手机，用于固定播放器行为）
    const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    // 绉诲姩绔細鏄惁鍦ㄩ〉闈㈤《閮紙鐢ㄤ簬鏍囬鍖烘樉绀烘帶鍒讹級
    const [isAtTop, setIsAtTop] = useState(true);

    // 鎸栫┖妯″紡鐩稿叧鐘舵€?
    const [clozeData, setClozeData] = useState({});
    const [clozeResults, setClozeResults] = useState({}); // { `${lineIndex}-${clozeIndex}`: 'correct' | 'revealed' }
    const pausedByCloze = useRef(false);
    // 单句暂停：记录上次暂停的句子索引，避免同一句重复暂停
    const lastPausedSentenceIndex = useRef(-1);

    // 绉诲姩绔細鏄惁涓洪娆″姞杞斤紙淇濊瘉鍒濆杩涘叆椤甸潰鏃舵樉绀烘爣棰樺尯锛?
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isSeeking, setIsSeeking] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    // 倍速 - 从 localStorage 读取，默认 1.0
    const [playbackRate, setPlaybackRate] = useState(() => {
        const saved = localStorage.getItem('bbEnglish_playbackRate');
        return saved ? parseFloat(saved) : 1.0;
    });
    // 音量控制
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('bbEnglish_volume');
        return saved ? parseFloat(saved) : 1.0;
    });
    const [muted, setMuted] = useState(false);
    // 视频总时长
    const [duration, setDuration] = useState(0);
    // 全屏状态
    const [isFullscreen, setIsFullscreen] = useState(false);
    // 字幕叠加层开关
    const [showOverlaySubtitles, setShowOverlaySubtitles] = useState(false);
    // 控制条显示/隐藏
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef(null);
    // 倍速面板、音量面板的展开状态
    const [showSpeedPanel, setShowSpeedPanel] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    // Initialize mode: URL query param > localStorage > default 'dual'
    const [mode, setMode] = useState(() => modeFromQuery || localStorage.getItem('studyMode') || 'dual');
    const [isLearned, setIsLearned] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [dictationStats, setDictationStats] = useState({ correct: 0, wrong: 0, skipped: 0 });
    const [dictationIndex, setDictationIndex] = useState(0);
    const [hasPlayedCurrent, setHasPlayedCurrent] = useState(false);

    // 句子和词汇收藏状态
    const [favoriteSentenceIds, setFavoriteSentenceIds] = useState([]);
    const [favoriteVocabIds, setFavoriteVocabIds] = useState([]);

    // 本子弹窗状态
    const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
    const [notebookDialogItem, setNotebookDialogItem] = useState(null); // { itemType, itemId, videoId }

    // 打印弹窗状态
    const [showPrintDialog, setShowPrintDialog] = useState(false);

    // PC端键盘快捷键 - 播放器激活状态
    const [playerActive, setPlayerActive] = useState(false);

    // 词汇关联期数状态
    const [vocabOccurrences, setVocabOccurrences] = useState({});  // { word: { total, occurrences } }

    // 播放器容器实际高度（用于动态定位字幕导航栏）
    const [playerHeight, setPlayerHeight] = useState(0);

    // 妫€娴嬬Щ鍔ㄧ
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1280);
            setIsPhone(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // 根据模式设置单句循环的默认值
    useEffect(() => {
        // 双语、英、中模式不默认单句循环
        if (mode === 'dual' || mode === 'en' || mode === 'cn') {
            setIsSentenceLooping(false);
        }
        // 精读、挖空模式默认单句循环
        else if (mode === 'intensive' || mode === 'cloze') {
            setIsSentenceLooping(true);
        }
        // 听写模式(dictation)不在此处理，保持原有逻辑
    }, [mode]);

    // Ref for dictation state
    const dictationStateRef = useRef({ isPlaying: false, isSeeking: false, dictationIndex: 0 });
    useEffect(() => {
        dictationStateRef.current = { isPlaying, isSeeking, dictationIndex };
    }, [isPlaying, isSeeking, dictationIndex]);

    // 监听播放器容器高度变化（用于动态定位字幕导航栏）
    useEffect(() => {
        if (!playerContainerRef.current) return;

        const updateHeight = () => {
            if (playerContainerRef.current) {
                setPlayerHeight(playerContainerRef.current.offsetHeight);
            }
        };

        updateHeight();

        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(playerContainerRef.current);

        return () => resizeObserver.disconnect();
    }, [videoData, isMobile, isPhone]);

    // 防止浏览器在页面重新获得焦点时自动恢复播放（用于词汇查询等场景）
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // 页面隐藏时，如果正在播放则暂停
                if (isPlaying && playerRef.current) {
                    playerRef.current.pause();
                    setIsPlaying(false);
                }
            }
            // 注意：页面恢复可见时不自动恢复播放
            // 用户必须手动点击播放按钮才能继续
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isPlaying]);

    // Load learned status
    useEffect(() => {
        if (!videoData?.id) return;
        const loadLearnedStatus = async () => {
            if (isDemo) {
                // Demo 模式：从 localStorage 读取
                setIsLearned(demoStorage.isDemoLearned(videoData.id));
            } else {
                const learnedIds = await progressService.loadLearnedVideoIds(user);
                setIsLearned(learnedIds.includes(String(videoData.id)));
            }
        };
        loadLearnedStatus();
    }, [videoData?.id, user, isDemo]);

    // Load favorite status
    useEffect(() => {
        if (!videoData?.id) return;
        const loadFavoriteStatus = async () => {
            if (isDemo) {
                // Demo 模式：从 localStorage 读取
                const favorites = demoStorage.getDemoFavorites();
                setIsFavorite(favorites.videos.includes(String(videoData.id)));
            } else {
                const favoriteIds = await favoritesService.loadFavoriteVideoIds(user);
                setIsFavorite(favoriteIds.includes(Number(videoData.id)));
            }
        };
        loadFavoriteStatus();
    }, [videoData?.id, user, isDemo]);

    // Load sentence favorites (filtered by current video)
    useEffect(() => {
        if (!videoData?.id) return;
        if (!isDemo && !user) {
            console.log('📋 VideoDetail: No user or video, skipping sentence favorites load');
            return;
        }
        const loadSentenceFavorites = async () => {
            if (isDemo) {
                // Demo 模式：从 localStorage 读取
                const favorites = demoStorage.getDemoFavorites();
                // 过滤出当前视频的句子收藏
                const sentenceIds = favorites.sentences
                    .filter(s => String(s.videoId) === String(videoData.id))
                    .map(s => s.itemId);
                setFavoriteSentenceIds(sentenceIds);
            } else {
                console.log('📋 VideoDetail: Loading sentence favorites for video:', videoData.id, 'user:', user.id);
                const ids = await favoritesService.loadFavoriteSentenceIds(user, Number(videoData.id));
                console.log('📋 VideoDetail: Loaded sentence favorite IDs:', ids);
                setFavoriteSentenceIds(ids);
            }
        };
        loadSentenceFavorites();
    }, [user, videoData?.id, isDemo]);

    // Load vocab favorites (filtered by current video)
    useEffect(() => {
        if (!videoData?.id) return;
        if (!isDemo && !user) {
            console.log('📋 VideoDetail: No user or video, skipping vocab favorites load');
            return;
        }
        const loadVocabFavorites = async () => {
            if (isDemo) {
                // Demo 模式：从 localStorage 读取
                const favorites = demoStorage.getDemoFavorites();
                // 过滤出当前视频的词汇收藏
                const vocabIds = favorites.vocabs
                    .filter(v => String(v.videoId) === String(videoData.id))
                    .map(v => v.itemId);
                setFavoriteVocabIds(vocabIds);
            } else {
                console.log('📋 VideoDetail: Loading vocab favorites for video:', videoData.id, 'user:', user.id);
                const ids = await favoritesService.loadFavoriteVocabIds(user, Number(videoData.id));
                console.log('📋 VideoDetail: Loaded vocab favorite IDs:', ids);
                setFavoriteVocabIds(ids);
            }
        };
        loadVocabFavorites();
    }, [user, videoData?.id, isDemo]);

    // 加载所有词汇的出现记录
    const loadAllVocabOccurrences = async (vocabList, currentVideoId) => {
        if (!vocabList || vocabList.length === 0) return;

        const results = {};
        for (const vocab of vocabList) {
            if (!vocab.word) continue;
            try {
                const result = await vocabOccurrencesAPI.get(vocab.word, currentVideoId);
                if (result.total > 0) {
                    results[vocab.word.toLowerCase()] = result;
                }
            } catch (error) {
                console.error('加载词汇关联失败:', vocab.word, error);
            }
        }
        setVocabOccurrences(results);
    };

    // 自动加载词汇关联期数
    useEffect(() => {
        if (videoData?.vocab && videoData.vocab.length > 0) {
            loadAllVocabOccurrences(videoData.vocab, videoData.id);
        }
    }, [videoData?.vocab, videoData?.id]);

    // Fetch video data
    useEffect(() => {
        const fetchVideoData = async () => {
            try {
                const response = await videoAPI.getByEpisode(episode);
                if (response.success && response.data) {
                    setVideoData(response.data);
                    setPrevVideo(response.data.prevVideo);
                    setNextVideo(response.data.nextVideo);
                } else {
                    console.error('Error fetching video: API returned success:false');
                }
            } catch (error) {
                console.error('Error fetching video:', error);
            }
        };
        fetchVideoData();
    }, [episode]);

    // Handle navigation from Favorites page - scroll to specific sentence or vocab
    useEffect(() => {
        if (!videoData) return;

        // New: Handle index-based navigation from Notebooks page
        if (typeFromQuery && indexFromQuery !== null) {
            const idx = parseInt(indexFromQuery, 10);
            if (!isNaN(idx)) {
                if (typeFromQuery === 'sentence' && videoData.transcript?.[idx]) {
                    // Navigate to sentence by index
                    setActiveIndex(idx);
                    setTimeout(() => {
                        if (transcriptRefs.current[idx]) {
                            transcriptRefs.current[idx].scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }
                        // Seek video to sentence start time
                        const sentence = videoData.transcript[idx];
                        if (sentence && playerRef.current) {
                            playerRef.current.currentTime = sentence.start;
                        }
                    }, 300);
                    return; // Don't process other params
                } else if (typeFromQuery === 'vocab' && videoData.vocab?.[idx]) {
                    // Navigate to vocab by index
                    setTimeout(() => {
                        const vocabElement = document.querySelector(`[data-vocab-index="${idx}"]`);
                        if (vocabElement) {
                            vocabElement.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                            // Add highlight effect
                            vocabElement.classList.add('ring-2', 'ring-violet-400', 'ring-offset-2');
                            setTimeout(() => {
                                vocabElement.classList.remove('ring-2', 'ring-violet-400', 'ring-offset-2');
                            }, 3000);
                        }
                    }, 500);
                    return; // Don't process other params
                }
            }
        }

        // Handle sentence navigation (legacy - ID-based from Favorites)
        if (sentenceIdFromQuery) {
            const sentenceId = Number(sentenceIdFromQuery);
            const idx = videoData.transcript?.findIndex(s => s.id === sentenceId);
            if (idx >= 0) {
                // Set active index to highlight the sentence
                setActiveIndex(idx);
                // Scroll to the sentence after a short delay to ensure DOM is ready
                setTimeout(() => {
                    if (transcriptRefs.current[idx]) {
                        transcriptRefs.current[idx].scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                    // Seek video to sentence start time
                    const sentence = videoData.transcript[idx];
                    if (sentence && playerRef.current) {
                        playerRef.current.currentTime = sentence.start;
                    }
                }, 300);
            }
        }

        // Handle vocab navigation (legacy - ID-based from Favorites)
        if (vocabIdFromQuery) {
            const vocabId = Number(vocabIdFromQuery);
            // Scroll to vocab card after a short delay
            setTimeout(() => {
                const vocabElement = document.querySelector(`[data-vocab-id="${vocabId}"]`);
                if (vocabElement) {
                    vocabElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    // Add highlight effect
                    vocabElement.classList.add('ring-2', 'ring-violet-400', 'ring-offset-2');
                    setTimeout(() => {
                        vocabElement.classList.remove('ring-2', 'ring-violet-400', 'ring-offset-2');
                    }, 3000);
                }
            }, 500);
        }
    }, [videoData, sentenceIdFromQuery, vocabIdFromQuery, typeFromQuery, indexFromQuery]);

    // Handle scrollTo vocab navigation from other pages
    const [urlSearchParams] = useSearchParams();
    const scrollToParam = urlSearchParams.get('scrollTo');
    const vocabIndexParam = urlSearchParams.get('vocabIndex');

    useEffect(() => {
        if (scrollToParam === 'vocab' && vocabIndexParam !== null && videoData) {
            setTimeout(() => {
                const vocabElement = document.getElementById(`vocab-card-${vocabIndexParam}`);
                if (vocabElement) {
                    vocabElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    vocabElement.classList.add('ring-2', 'ring-violet-400');
                    setTimeout(() => {
                        vocabElement.classList.remove('ring-2', 'ring-violet-400');
                    }, 2000);
                }
            }, 500);
        }
    }, [scrollToParam, vocabIndexParam, videoData]);

    // Note: prevVideo and nextVideo are now fetched with the video data from the API

    // 绉诲姩绔細鐩戝惉婊氬姩锛屽垽鏂槸鍚︽樉绀?缁х画鎾斁"灏忔潯
    useEffect(() => {
        if (!isMobile) return;

        const handleScroll = () => {
            if (!playerContainerRef.current) return;

            // 妫€娴嬫槸鍚﹀湪椤甸潰椤堕儴锛堢敤浜庢爣棰樺尯鏄剧ず鎺у埗锛?
            setIsAtTop(window.scrollY <= 10);

            // 鏆傚仠鐘舵€佷笅锛岀敤鎴锋粴鍔ㄦ椂鎵嶆爣璁颁负"宸叉粴鍔?
            // 浣跨敤鏈湴鍙橀噺绔嬪嵆鍙嶆槧鏂扮姸鎬侊紝閬垮厤 React 闂寘闂
            let scrolledAfterPause = hasScrolledAfterPause;
            if (!isPlaying && !hasScrolledAfterPause) {
                setHasScrolledAfterPause(true);
                scrolledAfterPause = true;
            }

            const rect = playerContainerRef.current.getBoundingClientRect();
            const isPlayerHidden = rect.bottom < 60;

            // 鍙湁"鏆傚仠 + 宸叉粴鍔?+ 鎾斁鍣ㄩ殣钘?鎵嶆樉绀哄皬绐楀彛
            setShowMobileMiniBar(!isPlaying && scrolledAfterPause && isPlayerHidden);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        // 涓嶈鍒濆璋冪敤 handleScroll()锛岄伩鍏嶉〉闈㈠姞杞芥椂閿欒瑙﹀彂婊氬姩鏍囪

        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMobile, isPlaying, hasScrolledAfterPause]);

    // 棣栨鍔犺浇鍚庯紝涓€鏃︽湁浜や簰灏卞叧闂?isInitialLoad
    useEffect(() => {
        if (!isInitialLoad) return;
        if (isPlaying || hasScrolledAfterPause || showMobileMiniBar) {
            setIsInitialLoad(false);
        }
    }, [isPlaying, hasScrolledAfterPause, showMobileMiniBar, isInitialLoad]);

    // Save mode to localStorage and handle dictation mode switch
    useEffect(() => {
        localStorage.setItem('studyMode', mode);

        if (mode === 'dictation' && videoData?.transcript) {
            const firstSentenceTime = videoData.transcript[0].start;
            setDictationIndex(0);
            setDictationStats({ correct: 0, wrong: 0, skipped: 0 });
            setHasPlayedCurrent(false);
            setIsSeeking(true);
            setIsPlaying(false);

            setTimeout(() => {
                if (playerRef.current) {
                    playerRef.current.currentTime = firstSentenceTime;
                    setCurrentTime(firstSentenceTime);
                }
            }, 50);

            setTimeout(() => {
                setIsPlaying(false);
                if (playerRef.current?.pause) {
                    playerRef.current.pause();
                }
                setTimeout(() => setIsSeeking(false), 200);
            }, 200);
        }

        // 新增：挖空模式滚动到当前句子
        if (mode === 'cloze' && videoData?.transcript) {
            setTimeout(() => {
                const activeElement = document.querySelector('[data-subtitle-index="' + activeIndex + '"]');
                if (activeElement) {
                    activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [mode, videoData, activeIndex]);

    // Calculate cloze data
    useEffect(() => {
        if (!videoData?.transcript || !videoData?.vocab) return;
        const data = generateClozeData(videoData.transcript, videoData.vocab);
        setClozeData(data);
        setClozeResults({}); // Reset results on new video
    }, [videoData]);

    // Dictation mode timeupdate listener
    useEffect(() => {
        if (!videoData?.transcript || !playerRef.current) return;

        const player = playerRef.current;

        const handleTimeUpdate = () => {
            const { isPlaying: playing, isSeeking: seeking, dictationIndex: idx } = dictationStateRef.current;
            if (!playing || seeking) return;

            if (mode === 'dictation') {
                const currentVideoTime = player.currentTime;
                const nextSubtitle = videoData.transcript[idx + 1];
                const currentSubtitle = videoData.transcript[idx];

                if (nextSubtitle && currentVideoTime >= nextSubtitle.start - 0.3) {
                    player.pause();
                    setIsPlaying(false);
                }

                if (!nextSubtitle && currentSubtitle && currentVideoTime >= currentSubtitle.start + 5) {
                    player.pause();
                    setIsPlaying(false);
                }
            }
        };

        const handleWaiting = () => setIsBuffering(true);
        const handlePlaying = () => setIsBuffering(false);

        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('waiting', handleWaiting);
        player.addEventListener('playing', handlePlaying);

        return () => {
            player.removeEventListener('timeupdate', handleTimeUpdate);
            player.removeEventListener('waiting', handleWaiting);
            player.removeEventListener('playing', handlePlaying);
        };
    }, [mode, videoData]);

    // Handle video progress
    const handleProgress = useCallback((state) => {
        if (isSeeking) return;
        setCurrentTime(state.playedSeconds);

        if (!videoData?.transcript || mode === 'dictation') return;

        const newIndex = videoData.transcript.findIndex((item, idx) => {
            const nextItem = videoData.transcript[idx + 1];
            return state.playedSeconds >= item.start && (!nextItem || state.playedSeconds < nextItem.start);
        });

        // Intensive Mode Loop Logic - High Priority (单句循环)
        if (mode === 'intensive' && isSentenceLooping && activeIndex >= 0) {
            const currentSub = videoData.transcript[activeIndex];
            if (currentSub && state.playedSeconds >= currentSub.end - 0.1) {
                if (playerRef.current) {
                    playerRef.current.currentTime = currentSub.start;
                    playerRef.current.play();
                }
            }
            // Always mark current sentence as visited when playing in intensive mode
            if (!visitedSet.has(activeIndex)) {
                setVisitedSet(prev => new Set(prev).add(activeIndex));
            }
            return;
        }

        // 单句暂停逻辑：参考单句循环，用 nextSub.start - 0.3 检测时机
        if (isSentencePauseEnabled && !isSentenceLooping && activeIndex >= 0) {
            const currentSub = videoData.transcript[activeIndex];
            const nextSub = videoData.transcript[activeIndex + 1];

            // 与单句循环相同的检测条件：下一句开始前 0.3 秒
            if (nextSub &&
                state.playedSeconds >= nextSub.start - 0.3 &&
                lastPausedSentenceIndex.current !== activeIndex) {

                lastPausedSentenceIndex.current = activeIndex;

                if (playerRef.current) {
                    playerRef.current.pause();
                    playerRef.current.currentTime = nextSub.start;
                }
                setIsPlaying(false);
                setActiveIndex(activeIndex + 1);
                return;
            }

            // 处理最后一句（没有 nextSub 的情况）
            if (!nextSub && currentSub &&
                state.playedSeconds >= currentSub.end - 0.1 &&
                lastPausedSentenceIndex.current !== activeIndex) {

                lastPausedSentenceIndex.current = activeIndex;

                if (playerRef.current) {
                    playerRef.current.pause();
                }
                setIsPlaying(false);
                return;
            }
        }

        if (newIndex !== -1 && newIndex !== activeIndex) {


            setActiveIndex(newIndex);

            if (isAutoScrollEnabled && transcriptRefs.current[newIndex]) {
                transcriptRefs.current[newIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }

        // Single sentence loop (单句循环 - 所有模式通用)
        if (isSentenceLooping && activeIndex >= 0) {
            const currentSub = videoData.transcript[activeIndex];
            const nextSub = videoData.transcript[activeIndex + 1];

            // 精读模式已在上面处理
            if (mode === 'intensive' && isSentenceLooping) {
                return;
            }

            if (nextSub && state.playedSeconds >= nextSub.start - 0.3) {
                if (playerRef.current) {
                    playerRef.current.currentTime = currentSub.start;
                }
            }
        }
    }, [isSeeking, mode, videoData, activeIndex, isAutoScrollEnabled, isSentenceLooping, isSentencePauseEnabled]);

    // Handle seek
    const handleSeek = useCallback((time) => {
        setIsSeeking(true);
        setCurrentTime(time);
        lastPausedSentenceIndex.current = -1; // 重置单句暂停标记，允许重新触发

        // 🔧 修复单句循环点击问题：当开启单句循环时，点击字幕行需要更新 activeIndex
        // 这样循环目标会切换到被点击的句子，而不是停留在原来的句子
        if (isSentenceLooping && videoData?.transcript) {
            const targetIndex = videoData.transcript.findIndex((item, idx) => {
                const nextItem = videoData.transcript[idx + 1];
                return time >= item.start && (!nextItem || time < nextItem.start);
            });
            if (targetIndex !== -1 && targetIndex !== activeIndex) {
                setActiveIndex(targetIndex);
            }
        }

        if (playerRef.current) {
            playerRef.current.currentTime = time;
        }

        if (mode !== 'dictation') {
            setTimeout(() => {
                setIsPlaying(true);
                if (playerRef.current) playerRef.current.play();
                setTimeout(() => setIsSeeking(false), 200);
            }, 100);
        } else {
            setTimeout(() => setIsSeeking(false), 300);
        }
    }, [mode, isSentenceLooping, videoData, activeIndex]);

    // 词汇收藏切换 (moved before renderClozeText to fix initialization order)
    const handleToggleVocabFavorite = async (vocabId) => {
        // 防止 vocabId 为 undefined 导致所有卡片一起变色
        if (vocabId === undefined || vocabId === null) {
            console.warn('⚠️ handleToggleVocabFavorite: vocabId is missing! Please run migration script to add IDs to vocab data.');
            return;
        }
        // 使用字符串比较，确保类型一致
        const shouldBeFavorite = !favoriteVocabIds.some(fid => String(fid) === String(vocabId));

        if (isDemo) {
            // Demo 模式：保存到 localStorage
            if (shouldBeFavorite) {
                demoStorage.addDemoFavorite('vocab', String(vocabId), videoData.id);
            } else {
                demoStorage.removeDemoFavorite('vocab', String(vocabId));
            }
        } else {
            await favoritesService.toggleFavoriteVocab(user, vocabId, shouldBeFavorite, Number(videoData.id));
        }

        setFavoriteVocabIds((prev) =>
            shouldBeFavorite
                ? [...prev, vocabId]
                : prev.filter(fid => String(fid) !== String(vocabId))
        );
    };

    // Render cloze text
    const renderClozeText = useCallback((text, lineIndex) => {
        const segments = clozeData[lineIndex];
        if (!segments) return <span>{text}</span>;

        return (
            <span>
                {segments.map((segment, i) => {
                    if (segment.type === 'cloze') {
                        const key = `${lineIndex}-${i}`;
                        // 使用 vocabIndex 生成与 HighlightedText 一致的 vocabId 格式
                        const vocabId = segment.vocabIndex !== undefined
                            ? `${videoData.id}-vocab-${segment.vocabIndex}`
                            : `${videoData.id}-vocab-${segment.vocabInfo?.word || i}`;
                        return (
                            <ClozeInput
                                key={i}
                                answer={segment.content}
                                vocabInfo={segment.vocabInfo}
                                isMobile={isMobile}
                                isLoggedIn={!!user}
                                videoId={Number(videoData.id)}
                                vocabId={vocabId}
                                isFavorite={favoriteVocabIds.some(fid => String(fid) === String(vocabId))}
                                onToggleFavorite={() => handleToggleVocabFavorite(vocabId)}
                                onAddToNotebook={() => {
                                    if (!user && !isDemo) {
                                        alert('登录后才能使用本子功能');
                                        return;
                                    }
                                    setNotebookDialogItem({
                                        itemType: 'vocab',
                                        itemId: vocabId,
                                        videoId: Number(videoData.id)
                                    });
                                    setNotebookDialogOpen(true);
                                }}
                                onStartAnswer={() => {
                                    if (isPlaying) {
                                        if (playerRef.current) playerRef.current.pause();
                                        setIsPlaying(false);
                                        pausedByCloze.current = true;
                                    }
                                }}
                                onDone={(status) => {
                                    setClozeResults(prev => ({ ...prev, [key]: status }));
                                    if (status === 'correct' && pausedByCloze.current) {
                                        if (playerRef.current) playerRef.current.play();
                                        setIsPlaying(true);
                                        pausedByCloze.current = false;
                                    }
                                }}
                            />
                        );
                    }
                    return <span key={i}>{segment.content}</span>;
                })}
            </span>
        );
    }, [clozeData, isPlaying, videoData, isMobile, user, isDemo, favoriteVocabIds, handleToggleVocabFavorite]);

    // Dictation handlers
    const handleNextDictation = () => {
        if (!videoData?.transcript) return;
        const nextIndex = dictationIndex + 1;
        if (nextIndex < videoData.transcript.length) {
            setIsSeeking(true);
            setDictationIndex(nextIndex);
            setHasPlayedCurrent(false);
            const nextTime = videoData.transcript[nextIndex].start;
            setCurrentTime(nextTime);

            if (playerRef.current) {
                playerRef.current.currentTime = nextTime;
            }

            setIsPlaying(false);
            setTimeout(() => setIsSeeking(false), 300);
        }
    };

    const handleReplayDictation = () => {
        if (!videoData?.transcript) return;
        const currentSubtitle = videoData.transcript[dictationIndex];
        setIsSeeking(true);

        if (playerRef.current) {
            playerRef.current.currentTime = currentSubtitle.start;
        }

        setTimeout(() => {
            setIsSeeking(false);
            setIsPlaying(true);
            if (playerRef.current) playerRef.current.play();
            setHasPlayedCurrent(true);
        }, 100);
    };

    // Intensive mode handlers
    const handleIntensiveSelect = (index) => {
        if (!videoData?.transcript) return;
        const sentence = videoData.transcript[index];
        if (sentence) {
            // 1. Update activeIndex
            setActiveIndex(index);
            // 2. Set looping
            setIsSentenceLooping(true);
            // 3. Add to visited
            setVisitedSet(prev => new Set(prev).add(index));
            // 4. Seek and Play
            if (playerRef.current) {
                playerRef.current.currentTime = sentence.start + 0.05;
                playerRef.current.play();
            }
            setIsPlaying(true);
        }
    };

    const handleIntensivePlayCurrent = () => {
        const index = activeIndex >= 0 ? activeIndex : 0;
        if (videoData?.transcript[index]) {
            const sentence = videoData.transcript[index];
            // 濡傛灉 activeIndex 鏄? -1锛岄渶瑕佹洿鏂?
            if (activeIndex === -1) setActiveIndex(index);

            if (playerRef.current) {
                playerRef.current.currentTime = sentence.start + 0.05;
                playerRef.current.play();
            }
            setIsSentenceLooping(true);
            setIsPlaying(true);
        }
    };

    const handleIntensivePause = () => {
        setIsPlaying(false);
        if (playerRef.current) {
            playerRef.current.pause();
        }
        // 淇濇寔 isLooping = true锛岃繖鏍风敤鎴峰啀娆＄偣鍑绘挱鏀炬椂渚濈劧鏄惊鐜綋鍓嶅彞
    };

    const handleIntensivePrev = () => {
        const newIndex = Math.max(0, activeIndex - 1);
        handleIntensiveSelect(newIndex);
    };

    const handleIntensiveNext = () => {
        if (!videoData?.transcript) return;
        const newIndex = Math.min(videoData.transcript.length - 1, activeIndex + 1);
        handleIntensiveSelect(newIndex);
    };

    // Toggle handlers
    const handleToggleLearned = async () => {
        const newStatus = !isLearned;
        setIsLearned(newStatus);
        if (isDemo) {
            // Demo 模式：保存到 localStorage
            if (newStatus) {
                demoStorage.addDemoProgress(videoData.id);
            }
            // 注意：Demo 模式暂不支持取消已学（简化处理）
        } else {
            await progressService.toggleLearnedVideoId(user, Number(videoData.id), newStatus);
        }
    };

    const handleToggleFavorite = async () => {
        const newStatus = !isFavorite;
        setIsFavorite(newStatus);
        if (isDemo) {
            // Demo 模式：保存到 localStorage
            if (newStatus) {
                demoStorage.addDemoFavorite('video', String(videoData.id), videoData.id);
            } else {
                demoStorage.removeDemoFavorite('video', String(videoData.id));
            }
        } else {
            await favoritesService.toggleFavoriteVideoId(user, Number(videoData.id), newStatus);
        }
    };

    // 打印字幕
    const handlePrint = () => {
        setShowPrintDialog(true);
    };

    // 执行打印
    const executePrint = (format) => {
        setShowPrintDialog(false);

        if (!videoData?.transcript) return;

        // 生成打印内容
        let content = '';
        const title = videoData.title || '字幕';
        const author = videoData.author || '';
        const episode = videoData.episode || '';

        // 根据格式生成内容
        videoData.transcript.forEach((item, index) => {
            const lineNum = index + 1;
            if (format === 'dual') {
                content += `${lineNum}. ${item.text}\n   ${item.cn}\n\n`;
            } else if (format === 'en') {
                content += `${lineNum}. ${item.text}\n\n`;
            } else if (format === 'cn') {
                content += `${lineNum}. ${item.cn}\n\n`;
            }
        });

        // 创建打印窗口
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('请允许弹出窗口以使用打印功能');
            return;
        }

        const formatLabel = format === 'dual' ? '双语' : format === 'en' ? '英文' : '中文';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title} - ${formatLabel}字幕</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                        padding: 40px;
                        line-height: 1.8;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #4F46E5;
                    }
                    .header h1 {
                        font-size: 24px;
                        color: #1a1a1a;
                        margin-bottom: 8px;
                    }
                    .header .meta {
                        font-size: 14px;
                        color: #666;
                    }
                    .content {
                        white-space: pre-wrap;
                        font-size: 15px;
                    }
                    @media print {
                        body { padding: 20px; }
                        .header { margin-bottom: 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${title}</h1>
                    <div class="meta">
                        ${author ? `博主: ${author}` : ''}
                        ${episode ? ` · 第${episode}期` : ''}
                        · ${formatLabel}字幕
                    </div>
                </div>
                <div class="content">${content}</div>
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // 句子收藏切换
    const handleToggleSentenceFavorite = async (sentenceId) => {
        // 防止 sentenceId 为 undefined 导致问题
        if (sentenceId === undefined || sentenceId === null) {
            console.warn('⚠️ handleToggleSentenceFavorite: sentenceId is missing! Please run migration script to add IDs to transcript data.');
            return;
        }
        // 使用字符串比较，确保类型一致
        const shouldBeFavorite = !favoriteSentenceIds.some(fid => String(fid) === String(sentenceId));

        if (isDemo) {
            // Demo 模式：保存到 localStorage
            if (shouldBeFavorite) {
                demoStorage.addDemoFavorite('sentence', String(sentenceId), videoData.id);
            } else {
                demoStorage.removeDemoFavorite('sentence', String(sentenceId));
            }
        } else {
            await favoritesService.toggleFavoriteSentence(user, sentenceId, shouldBeFavorite, Number(videoData.id));
        }

        setFavoriteSentenceIds((prev) =>
            shouldBeFavorite
                ? [...prev, sentenceId]
                : prev.filter(fid => String(fid) !== String(sentenceId))
        );
    };



    // 绉诲姩绔細鐐瑰嚮"缁х画鎾斁"锛屾粴鍔ㄥ埌鎾斁鍣ㄥ苟缁х画鎾斁
    const handleMobileResume = () => {
        setShowMobileMiniBar(false);
        setHasScrolledAfterPause(false); // 閲嶇疆婊氬姩鏍囪
        // 婊氬姩鍒版挱鏀惧櫒浣嶇疆
        if (playerContainerRef.current) {
            playerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // 缁х画鎾斁锛堜粠褰撳墠鏃堕棿鐐癸級
        setTimeout(() => {
            setIsPlaying(true);
            if (playerRef.current) playerRef.current.play();
        }, 300);
    };

    // PC绔細杩斿洖鎾斁


    // Toggle play/pause
    const handleTogglePlay = useCallback(() => {
        if (isPlaying) {
            setIsPlaying(false);
            if (playerRef.current) playerRef.current.pause();
        } else {
            setIsPlaying(true);
            if (playerRef.current) playerRef.current.play();
        }
    }, [isPlaying]);

    // PC端键盘快捷键 - 空格键控制播放/暂停
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 只处理播放器激活状态下的空格键
            if (!playerActive) return;
            if (e.code !== 'Space' && e.key !== ' ') return;

            // 如果焦点在输入框内，不拦截空格
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                return;
            }

            e.preventDefault();
            handleTogglePlay();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [playerActive, handleTogglePlay]);

    // Change speed (for FloatingControls - cycles through speeds)
    const handleChangeSpeed = () => {
        const speeds = [0.4, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        const currentIndex = speeds.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % speeds.length;
        const newRate = speeds[nextIndex];
        handleSetPlaybackRate(newRate);
    };

    // 设置倍速（保存到 localStorage）
    const handleSetPlaybackRate = (rate) => {
        setPlaybackRate(rate);
        localStorage.setItem('bbEnglish_playbackRate', rate.toString());
        if (playerRef.current) {
            playerRef.current.playbackRate = rate;
        }
        setShowSpeedPanel(false);
    };

    // 格式化时间 mm:ss
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 进度条点击跳转
    const handleProgressClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const newTime = percent * duration;
        handleSeek(newTime);
    };

    // 音量变更
    const handleVolumeChange = (newVolume) => {
        setVolume(newVolume);
        setMuted(newVolume === 0);
        localStorage.setItem('bbEnglish_volume', newVolume.toString());
        if (playerRef.current) {
            playerRef.current.volume = newVolume;
            playerRef.current.muted = newVolume === 0;
        }
    };

    // 静音切换
    const handleToggleMute = () => {
        const newMuted = !muted;
        setMuted(newMuted);
        if (playerRef.current) {
            playerRef.current.muted = newMuted;
        }
    };

    // 全屏切换 - 兼容 iOS/Android
    const handleToggleFullscreen = async () => {
        const videoEl = playerRef.current;
        if (!videoEl) return;

        try {
            if (!isFullscreen) {
                // 进入全屏
                if (videoEl.requestFullscreen) {
                    await videoEl.requestFullscreen();
                } else if (videoEl.webkitEnterFullscreen) {
                    // iOS Safari
                    videoEl.webkitEnterFullscreen();
                } else if (videoEl.webkitRequestFullscreen) {
                    // Old Safari
                    videoEl.webkitRequestFullscreen();
                } else if (playerContainerRef.current?.requestFullscreen) {
                    // Fallback to container
                    await playerContainerRef.current.requestFullscreen();
                }
                setIsFullscreen(true);
            } else {
                // 退出全屏
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (videoEl.webkitExitFullscreen) {
                    videoEl.webkitExitFullscreen();
                }
                setIsFullscreen(false);
            }
        } catch (err) {
            console.warn('Fullscreen not supported:', err);
        }
    };

    // 监听全屏变化 - 兼容 webkit
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
            setIsFullscreen(isFS);
        };

        // 监听 video 元素的 webkitbeginfullscreen/webkitendfullscreen (iOS Safari)
        const videoEl = playerRef.current;
        const handleWebkitBeginFullscreen = () => setIsFullscreen(true);
        const handleWebkitEndFullscreen = () => setIsFullscreen(false);

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        if (videoEl) {
            videoEl.addEventListener('webkitbeginfullscreen', handleWebkitBeginFullscreen);
            videoEl.addEventListener('webkitendfullscreen', handleWebkitEndFullscreen);
        }

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            if (videoEl) {
                videoEl.removeEventListener('webkitbeginfullscreen', handleWebkitBeginFullscreen);
                videoEl.removeEventListener('webkitendfullscreen', handleWebkitEndFullscreen);
            }
        };
    }, [videoData]); // 依赖 videoData 确保 playerRef.current 已挂载

    // 控制条自动隐藏逻辑
    const resetControlsTimeout = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        // 2.5秒后自动隐藏（如果正在播放）
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
                setShowSpeedPanel(false);
                setShowVolumeSlider(false);
            }, 2500);
        }
    }, [isPlaying]);

    // 初始化音量和倍速到视频元素
    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.volume = volume;
            playerRef.current.playbackRate = playbackRate;
        }
    }, [videoData]); // 当视频数据加载完成时初始化

    // 视频结束处理（整视频循环优先级低于单句循环）
    const handleVideoEnded = () => {
        if (isVideoLooping && !isSentenceLooping) {
            // 整视频循环：从头播放
            if (playerRef.current) {
                playerRef.current.currentTime = 0;
                playerRef.current.play();
            }
        }
    };

    // 点击视频区域切换播放/暂停 + 显示控制条
    const handleVideoAreaClick = (e) => {
        // 避免点击控制条区域时触发
        if (e.target.closest('.custom-controls')) return;
        // 激活播放器（允许键盘快捷键）
        setPlayerActive(true);
        // 切换播放/暂停
        handleTogglePlay();
        // 显示控制条并重置隐藏计时器
        resetControlsTimeout();
    };

    // Loading state
    if (!videoData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-gray-600">视频加载中...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 xl:h-screen xl:flex xl:flex-row">
            {/* ========== 移动端：顶部"继续播放"小条 ========== */}
            {showMobileMiniBar && (
                <div
                    className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-violet-300 to-purple-600 px-4 py-3 cursor-pointer shadow-lg md:hidden"
                    onClick={handleMobileResume}
                >
                    <div className="flex items-center justify-center gap-2 text-white">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">继续播放</span>
                    </div>
                </div>
            )}

            {/* 左侧：视频、标题、词汇 */}
            <div className="w-full xl:w-3/5 xl:flex xl:flex-col xl:overflow-y-auto">

                {/* 标题区：移动端仅在"顶部 + 未播放 + 非小窗口模式"时显示，PC端始终显示 */}
                {(!isMobile || (!isPlaying && !showMobileMiniBar)) && (
                    <div className="p-3 md:p-6 flex-shrink-0">
                        {/* 上一期/下一期导航 - 按期数顺序，Demo模式隐藏 */}
                        {!isDemo && (
                            <div className="flex gap-2 mb-2 pt-2 md:pt-0">
                                {prevVideo && (
                                    <button
                                        onClick={() => navigate(`/episode/${prevVideo.episode}`)}
                                        className="px-3 py-1.5 bg-violet-100 text-violet-600 rounded-full text-sm font-medium hover:bg-violet-200 transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        上一期
                                    </button>
                                )}
                                {nextVideo && (
                                    <button
                                        onClick={() => navigate(`/episode/${nextVideo.episode}`)}
                                        className="px-3 py-1.5 bg-violet-500 text-white rounded-full text-sm font-medium hover:bg-violet-600 transition-colors flex items-center gap-1"
                                    >
                                        下一期
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* 标题区域 */}
                        <div className="flex items-start justify-between mb-2 md:mb-3">
                            <h1 className="text-xl md:text-3xl font-bold flex-1 mr-4">{videoData.title}</h1>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={handleToggleFavorite}
                                    className={`p-2 rounded-full transition-colors ${isFavorite ? 'bg-yellow-100 text-yellow-500 hover:bg-yellow-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                    title={isFavorite ? "取消收藏" : "收藏视频"}
                                >
                                    {isFavorite ? (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    onClick={handleToggleLearned}
                                    className={`p-2 rounded-full transition-colors ${isLearned ? 'bg-green-100 text-green-500 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                    title={isLearned ? "标记未学" : "标记已学"}
                                >
                                    {isLearned ? (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                </button>
                                {videoData.audio_url && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                const response = await fetch(videoData.audio_url);
                                                const blob = await response.blob();
                                                const url = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `BiuBiu英语_第${videoData.episode}期.mp3`;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                window.URL.revokeObjectURL(url);
                                            } catch (error) {
                                                console.error('下载失败:', error);
                                                // 降级方案：直接打开链接
                                                window.open(videoData.audio_url, '_blank');
                                            }
                                        }}
                                        className="p-2 rounded-full transition-colors bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                                        title="下载音频"
                                    >
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 元数据 */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600 mb-4 md:mb-6">
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/?author=${encodeURIComponent(videoData.author)}`);
                                }}
                                className="flex items-center cursor-pointer hover:text-purple-600 hover:underline transition-colors"
                            >
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                {videoData.author}
                            </span>
                            {videoData.youtube_url && (
                                <a
                                    href={videoData.youtube_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="跳转YouTube（需科学上网）"
                                    className="ml-1 inline-flex items-center text-red-500 hover:text-red-600 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                    </svg>
                                </a>
                            )}
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                {videoData.duration}
                            </span>
                            <span className="flex items-center">{renderLevel(videoData.level)}</span>
                            <span className="px-2 py-1 bg-violet-100 text-violet-500 rounded-full text-xs font-medium">
                                {videoData.category}
                            </span>
                        </div>
                    </div>
                )}


                {/* 移动端继续播放模式下显示退出按钮 */}


                {/* 视频播放器区域 */}
                <div className="px-3 md:px-6">
                    {/* 移动端（手机+平板）播放时的占位元素 */}
                    {isMobile && !isInitialLoad && (isPlaying || !hasScrolledAfterPause) && (
                        <div style={{ height: playerHeight + 50 }} className="w-full" />
                    )}
                    {/* 视频播放器 - 移动端播放时 fixed，PC端 sticky */}
                    <div
                        ref={playerContainerRef}
                        className={`
                            bg-white rounded-xl overflow-hidden shadow-2xl transition-all duration-300
                            ${isMobile && !isInitialLoad && (isPlaying || !hasScrolledAfterPause) ? 'fixed top-0 z-[80]' : ''}
                            ${isPhone && !isInitialLoad && (isPlaying || !hasScrolledAfterPause) ? 'left-3 right-3' : ''}
                            ${isMobile && !isPhone && !isInitialLoad && (isPlaying || !hasScrolledAfterPause) ? 'left-1/2 -translate-x-1/2 w-[50%] max-w-md' : ''}
                            ${!isMobile && isPlaying ? 'sticky top-0 z-40' : ''}
                        `}
                    >
                        <div
                            className="relative w-full"
                            style={{ paddingTop: '56.25%' }}
                            onClick={handleVideoAreaClick}
                            onMouseMove={resetControlsTimeout}
                            onTouchStart={resetControlsTimeout}
                        >
                            {isBuffering && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
                                    <div className="text-white font-bold flex flex-col items-center">
                                        <svg className="animate-spin h-8 w-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>缓冲中...</span>
                                    </div>
                                </div>
                            )}

                            {showOverlaySubtitles && activeIndex >= 0 && videoData.transcript?.[activeIndex] && (
                                <div className={`absolute left-0 right-0 z-10 flex justify-center pointer-events-none px-4 ${isMobile ? (showControls ? 'bottom-12' : 'bottom-4') : 'bottom-8'}`}>
                                    <div className="max-w-[90%] md:max-w-[85%] text-center">
                                        {mode === 'cn' ? (
                                            <p className="text-white text-[14px] md:text-[20px] leading-relaxed md:leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                {videoData.transcript[activeIndex]?.cn}
                                            </p>
                                        ) : mode === 'en' ? (
                                            <p className="text-white text-[15px] md:text-[22px] leading-relaxed md:leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                {videoData.transcript[activeIndex]?.text}
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-white text-[15px] md:text-[22px] leading-relaxed md:leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                    {videoData.transcript[activeIndex]?.text}
                                                </p>
                                                <p className="text-white/90 text-[13px] md:text-[18px] leading-relaxed md:leading-snug mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                    {videoData.transcript[activeIndex]?.cn}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 手机端更多设置按钮 - 右上角，仅在暂停时显示 */}
                            {!isPlaying && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMobileSettings(true);
                                    }}
                                    className="md:hidden absolute top-2 right-2 z-10 flex items-center justify-center rounded-full bg-black/40 text-white p-2 hover:bg-black/60 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="5" r="2" />
                                        <circle cx="12" cy="12" r="2" />
                                        <circle cx="12" cy="19" r="2" />
                                    </svg>
                                </button>
                            )}

                            {/* 手机端更多设置面板 - 底部弹窗 */}
                            {showMobileSettings && (
                                <>
                                    <div
                                        className="md:hidden fixed inset-0 bg-black/50 z-[100]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMobileSettings(false);
                                        }}
                                    />
                                    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[101] bg-gray-900 rounded-t-2xl py-4 px-4 max-h-[70vh] overflow-y-auto">
                                        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

                                        {/* 倍速设置 */}
                                        <div className="mb-6">
                                            <div className="text-white/70 text-sm mb-3">播放速度</div>
                                            <div className="flex flex-wrap gap-2">
                                                {[0.4, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                                                    <button
                                                        key={rate}
                                                        onClick={() => {
                                                            handleSetPlaybackRate(rate);
                                                            setShowMobileSettings(false);
                                                        }}
                                                        className={`px-4 py-2 rounded-lg text-sm transition-colors ${playbackRate === rate
                                                            ? 'bg-violet-400 text-white font-medium'
                                                            : 'bg-white/10 text-white hover:bg-white/20'
                                                            }`}
                                                    >
                                                        {rate === 1 ? '正常' : `${rate}x`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 视频循环开关 */}
                                        <div className="flex items-center justify-between py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-white text-sm">视频循环</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsVideoLooping(!isVideoLooping);
                                                }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isVideoLooping ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isVideoLooping ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {/* 画面字幕开关 */}
                                        <div className="flex items-center justify-between py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-white text-sm">画面字幕</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowOverlaySubtitles(!showOverlaySubtitles);
                                                }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showOverlaySubtitles ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showOverlaySubtitles ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            <video
                                ref={playerRef}
                                src={videoData.video_url}
                                className="absolute top-0 left-0 w-full h-full bg-black"
                                playsInline
                                webkit-playsinline="true"
                                x5-video-player-type="h5"
                                x5-playsinline="true"
                                preload="auto"
                                onContextMenu={(e) => e.preventDefault()}
                                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                                onPlay={() => {
                                    setIsPlaying(true);
                                    setHasScrolledAfterPause(false);
                                    resetControlsTimeout();
                                }}
                                onPause={() => {
                                    setIsPlaying(false);
                                    setShowControls(true);
                                }}
                                onEnded={handleVideoEnded}
                                onTimeUpdate={(e) => handleProgress({ playedSeconds: e.target.currentTime })}
                            />

                            {/* 自定义控制条 - 固定在视频底部 */}
                            <div
                                className={`custom-controls absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 md:px-4 py-1.5 md:py-3 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                                onClick={(e) => { e.stopPropagation(); setPlayerActive(true); }}
                            >
                                {/* 进度条 */}
                                <div
                                    className="w-full h-1.5 bg-white/30 rounded cursor-pointer mb-1 md:mb-3 group"
                                    onClick={handleProgressClick}
                                >
                                    <div
                                        className="h-full bg-violet-400 rounded relative"
                                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                    >
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>

                                {/* 控制按钮行 */}
                                <div className="flex items-center justify-between">
                                    {/* 左侧：播放/暂停 + 时间 */}
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <button
                                            onClick={handleTogglePlay}
                                            className="text-white p-1 hover:bg-white/20 rounded transition-colors"
                                        >
                                            {isPlaying ? (
                                                <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            )}
                                        </button>
                                        <span className="text-white text-xs md:text-sm tabular-nums">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </span>
                                    </div>

                                    {/* 右侧：倍速、字幕、音量、循环、全屏 */}
                                    <div className="flex items-center gap-1 md:gap-2">
                                        {/* 倍速按钮 - 手机端隐藏 */}
                                        <div className="hidden md:block relative">
                                            <button
                                                onClick={() => setShowSpeedPanel(!showSpeedPanel)}
                                                className="text-white text-xs md:text-sm px-2 py-1 hover:bg-white/20 rounded transition-colors"
                                            >
                                                {playbackRate === 1 ? '倍速' : `${playbackRate}x`}
                                            </button>

                                            {showSpeedPanel && (
                                                <>
                                                    {/* 移动端底部弹窗遮罩 */}
                                                    <div
                                                        className="md:hidden fixed inset-0 bg-black/50 z-40"
                                                        onClick={() => setShowSpeedPanel(false)}
                                                    />
                                                    {/* 移动端底部弹窗 */}
                                                    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl py-4 px-2 max-h-[50vh] overflow-y-auto">
                                                        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
                                                        <div className="text-center text-white/70 text-sm mb-3">选择播放速度</div>
                                                        <div className="flex flex-col gap-1">
                                                            {[0.4, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                                                                <button
                                                                    key={rate}
                                                                    onClick={() => handleSetPlaybackRate(rate)}
                                                                    className={`py-3 text-center text-base rounded-lg transition-colors ${playbackRate === rate
                                                                        ? 'text-violet-400 bg-violet-500/20 font-medium'
                                                                        : 'text-white hover:bg-white/10'
                                                                        }`}
                                                                >
                                                                    {rate === 1 ? '正常' : `${rate}x`}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {/* PC端右侧浮层 */}
                                                    <div className="hidden md:block absolute bottom-full mb-2 right-0 bg-gray-900/95 rounded-lg shadow-xl py-2 min-w-[80px] backdrop-blur">
                                                        {[0.4, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                                                            <button
                                                                key={rate}
                                                                onClick={() => handleSetPlaybackRate(rate)}
                                                                className={`block w-full px-4 py-1.5 text-left text-sm transition-colors ${playbackRate === rate
                                                                    ? 'text-violet-400 bg-violet-500/20'
                                                                    : 'text-white hover:bg-white/10'
                                                                    }`}
                                                            >
                                                                {rate === 1 ? '正常' : `${rate}x`}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* 字幕按钮 - 手机端隐藏 */}
                                        <button
                                            onClick={() => setShowOverlaySubtitles(!showOverlaySubtitles)}
                                            className={`hidden md:block p-1.5 rounded transition-colors ${showOverlaySubtitles ? 'text-violet-400 bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                            title={showOverlaySubtitles ? '关闭字幕' : '打开字幕'}
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" />
                                            </svg>
                                        </button>

                                        {/* 音量按钮 - 手机端隐藏 */}
                                        <div className="hidden md:block relative">
                                            <button
                                                onClick={() => {
                                                    if (isMobile) {
                                                        setShowVolumeSlider(!showVolumeSlider);
                                                    } else {
                                                        handleToggleMute();
                                                    }
                                                }}
                                                onMouseEnter={() => !isMobile && setShowVolumeSlider(true)}
                                                onMouseLeave={() => !isMobile && setShowVolumeSlider(false)}
                                                className="text-white p-1.5 hover:bg-white/10 rounded transition-colors"
                                            >
                                                {muted || volume === 0 ? (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                                                    </svg>
                                                ) : volume < 0.5 ? (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                                    </svg>
                                                )}
                                            </button>

                                            {showVolumeSlider && (
                                                <div
                                                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900/95 rounded-lg p-3 shadow-xl backdrop-blur"
                                                    onMouseEnter={() => !isMobile && setShowVolumeSlider(true)}
                                                    onMouseLeave={() => !isMobile && setShowVolumeSlider(false)}
                                                >
                                                    <div className="h-20 flex flex-col items-center">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.05"
                                                            value={muted ? 0 : volume}
                                                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                                            className="h-16 accent-violet-400 cursor-pointer"
                                                            style={{
                                                                writingMode: 'vertical-lr',
                                                                direction: 'rtl'
                                                            }}
                                                        />
                                                        <span className="text-white text-xs mt-1">
                                                            {Math.round((muted ? 0 : volume) * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 单句暂停按钮 */}
                                        <button
                                            onClick={() => setIsSentencePauseEnabled(!isSentencePauseEnabled)}
                                            className={`flex items-center gap-1 p-1.5 rounded transition-colors ${isSentencePauseEnabled ? 'text-violet-400 bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                            title={isSentencePauseEnabled ? '关闭单句暂停' : '开启单句暂停（每句结束自动暂停）'}
                                        >
                                            <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="5" y="4" width="4" height="16" rx="1" />
                                                <rect x="13" y="4" width="4" height="16" rx="1" />
                                                <circle cx="20" cy="6" r="3" />
                                            </svg>
                                            <span className="text-xs md:hidden">句停</span>
                                        </button>

                                        {/* 单句循环按钮 */}
                                        <button
                                            onClick={() => setIsSentenceLooping(!isSentenceLooping)}
                                            className={`flex items-center gap-1 p-1.5 rounded transition-colors ${isSentenceLooping ? 'text-violet-400 bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                            title={isSentenceLooping ? '关闭单句循环' : '开启单句循环'}
                                        >
                                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-xs md:hidden">单句</span>
                                        </button>

                                        {/* 手机端全屏按钮 */}
                                        <button
                                            onClick={handleToggleFullscreen}
                                            className="md:hidden text-white p-1.5 hover:bg-white/10 rounded transition-colors"
                                            title={isFullscreen ? '退出全屏' : '全屏'}
                                        >
                                            {isFullscreen ? (
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* 平板端全屏按钮（768-1279px） */}
                                        <button
                                            onClick={handleToggleFullscreen}
                                            className="hidden md:block xl:hidden text-white p-1.5 hover:bg-white/10 rounded transition-colors"
                                            title={isFullscreen ? '退出全屏' : '全屏'}
                                        >
                                            {isFullscreen ? (
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* 视频循环按钮 - 手机端隐藏 */}
                                        <button
                                            onClick={() => setIsVideoLooping(!isVideoLooping)}
                                            className={`hidden md:flex items-center gap-1 p-1.5 rounded transition-colors ${isVideoLooping ? 'text-violet-400 bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                            title={isVideoLooping ? '关闭视频循环' : '开启视频循环'}
                                        >
                                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                                            </svg>
                                            <span className="text-xs md:hidden">视频</span>
                                        </button>
                                        {/* 全屏按钮 */}
                                        {document.fullscreenEnabled && (
                                            <button
                                                onClick={handleToggleFullscreen}
                                                className="text-white p-1.5 hover:bg-white/10 rounded transition-colors"
                                                title={isFullscreen ? '退出全屏' : '全屏'}
                                            >
                                                {isFullscreen ? (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                                                    </svg>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 移动端：字幕导航条（独立于播放器，吸顶时紧贴播放器下方） */}
                {isMobile && (
                    <div
                        className={`
                            bg-white border-b border-t border-gray-200 px-2 py-2 transition-all duration-300 overflow-hidden
                            ${!isInitialLoad && (isPlaying || !hasScrolledAfterPause) ? 'fixed left-0 right-0 z-[79] shadow-sm' : 'relative'}
                        `}
                        style={!isInitialLoad && (isPlaying || !hasScrolledAfterPause) ? { top: playerHeight + 12 } : { marginTop: 12 }}
                    >
                        <SubtitleTabs mode={mode} setMode={setMode} onPrint={handlePrint} isMobileStyle={true} />
                    </div>
                )}

                {/* 重点词汇 - 只在电脑端且非迷你模式下显示 */}
                <div className="hidden xl:block p-6 pt-6">
                    <div className="p-6 bg-white rounded-xl shadow-sm">
                        <h3 className="text-xl font-bold mb-4">重点词汇</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {videoData.vocab?.map((item, index) => {
                                // Generate stable vocab ID (use existing or fallback)
                                const vocabId = item.id !== undefined && item.id !== null
                                    ? item.id
                                    : `${videoData.id}-vocab-${index}`;
                                return (
                                    <div key={vocabId} id={`vocab-card-${index}`} data-vocab-id={vocabId} data-vocab-index={index} data-vocab-word={item.word} className="relative p-4 bg-violet-50 rounded-lg border border-violet-100 transition-all duration-200">
                                        {/* 收藏按钮（右上角）*/}
                                        <button
                                            onClick={() => handleToggleVocabFavorite(vocabId)}
                                            className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${favoriteVocabIds.some(fid => String(fid) === String(vocabId))
                                                ? 'text-yellow-500 hover:bg-yellow-100'
                                                : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                                                }`}
                                            title={favoriteVocabIds.some(fid => String(fid) === String(vocabId)) ? "取消收藏" : "收藏词汇"}
                                        >
                                            <svg className="w-4 h-4" fill={favoriteVocabIds.some(fid => String(fid) === String(vocabId)) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                            </svg>
                                        </button>
                                        {/* 加入本子按钮 */}
                                        <button
                                            onClick={() => {
                                                if (!user && !isDemo) {
                                                    alert('登录后才能使用本子功能');
                                                    return;
                                                }
                                                setNotebookDialogItem({
                                                    itemType: 'vocab',
                                                    itemId: vocabId,
                                                    videoId: Number(videoData.id)
                                                });
                                                setNotebookDialogOpen(true);
                                            }}
                                            className="absolute top-2 right-8 p-1 rounded-full transition-colors text-gray-300 hover:text-violet-500 hover:bg-violet-50"
                                            title="加入本子"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                            </svg>
                                        </button>
                                        <div className="flex items-end mb-2">
                                            <span className="text-lg font-bold text-violet-500 mr-2">{item.word}</span>
                                            <span className="text-sm text-gray-500">{item.type}</span>
                                        </div>

                                        <div className="flex flex-col gap-1 mb-2">
                                            {item.ipa_us && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                    <span className="text-gray-400 w-4">US</span>
                                                    <span>/{item.ipa_us}/</span>
                                                    <button onClick={() => speak(item.word, 'en-US')} className="p-1 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors" title="美式发音">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                            {item.ipa_uk && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                    <span className="text-gray-400 w-4">UK</span>
                                                    <span>/{item.ipa_uk}/</span>
                                                    <button onClick={() => speak(item.word, 'en-GB')} className="p-1 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors" title="英式发音">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-gray-600 font-medium mb-3">{item.meaning}</p>

                                        {item.examples && item.examples.length > 0 && (
                                            <div className="mb-3 space-y-2">
                                                {item.examples.map((ex, i) => (
                                                    <div key={i} className="text-[15px]">
                                                        <p className="text-gray-800 leading-snug">{ex.en}</p>
                                                        <p className="text-gray-500 text-[14px] mt-0.5">{ex.cn}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {item.collocations && item.collocations.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {item.collocations.map((col, i) => (
                                                    <span key={i} className="px-2 py-1 bg-white text-violet-500 text-[13px] rounded border border-violet-100">
                                                        {col}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* 外部词典链接 */}
                                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-violet-100">
                                            <a
                                                href={`https://dict.youdao.com/result?word=${encodeURIComponent(item.word)}&lang=en`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-600 transition-colors"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                                </svg>
                                                有道词典
                                            </a>
                                            <span className="text-gray-300">|</span>
                                            <a
                                                href={`https://www.google.com/search?q=${encodeURIComponent(item.word)}+meaning`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-500 transition-colors"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                                                </svg>
                                                Google
                                            </a>
                                        </div>

                                        {/* 词汇关联期数 - 直接显示 */}
                                        {vocabOccurrences[item.word?.toLowerCase()]?.total > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <div className="text-sm flex flex-wrap items-center gap-2">
                                                    <span className="text-gray-500">📍 还出现在：</span>
                                                    {vocabOccurrences[item.word.toLowerCase()].occurrences.map((occ, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={`/episode/${occ.episode}?scrollTo=vocab&vocabIndex=${occ.vocab_index || 0}`}
                                                            className="text-violet-500 hover:text-violet-500 hover:underline"
                                                        >
                                                            第{occ.episode}期
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>

            {/* Right Side Container Start */}
            <div className="flex-1 bg-white border-t xl:border-t-0 xl:border-l flex flex-col relative" onClick={() => setPlayerActive(false)}>
                {/* PC Subtitle Tabs */}
                {!isMobile && (
                    <div className="sticky top-0 z-10 p-3 md:p-4 border-b bg-white">
                        <SubtitleTabs mode={mode} setMode={setMode} onPrint={handlePrint} />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto pb-32 md:pb-24">
                    {mode === 'cloze' && (
                        <div className="sticky top-0 z-10 bg-violet-50 border-b px-4 py-2 flex items-center justify-between text-sm text-violet-500">
                            <div className="flex items-center gap-4">
                                <span>
                                    <strong>进度：</strong>
                                    {Object.keys(clozeResults).length} / {Object.values(clozeData).flat().filter(s => s.type === 'cloze').length} 空
                                </span>
                                <span>
                                    <strong>正确率：</strong>
                                    {(() => {
                                        const results = Object.values(clozeResults);
                                        if (results.length === 0) return '0%';
                                        const correct = results.filter(r => r === 'correct').length;
                                        return Math.round((correct / results.length) * 100) + '%';
                                    })()}
                                </span>
                            </div>
                        </div>
                    )}
                    {mode === 'dictation' && (
                        <div className="mx-3 mt-3 md:mx-4 md:mt-4 bg-gradient-to-r from-violet-50 to-violet-50 p-4 rounded-lg shadow-sm">
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
                                    <div className="text-2xl font-bold text-violet-500">
                                        {dictationStats.correct + dictationStats.wrong + dictationStats.skipped > 0
                                            ? Math.round((dictationStats.correct / (dictationStats.correct + dictationStats.wrong + dictationStats.skipped)) * 100)
                                            : 0}%
                                    </div>
                                    <div className="text-xs text-gray-600">正确率</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                        {mode === 'dictation' ? (
                            <div className="bg-violet-50 p-6 rounded-lg border-2 border-violet-200">
                                <DictationInput
                                    correctAnswer={videoData.transcript[dictationIndex]?.text || ''}
                                    currentIndex={dictationIndex}
                                    totalCount={videoData.transcript.length}
                                    onCorrect={() => {
                                        setDictationStats(prev => ({ ...prev, correct: prev.correct + 1 }));
                                        setTimeout(() => handleNextDictation(), 1500);
                                    }}
                                    onWrong={() => {
                                        setDictationStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
                                    }}
                                    onSkip={() => {
                                        setDictationStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
                                        handleNextDictation();
                                    }}
                                    onReplay={handleReplayDictation}
                                    hasPlayed={hasPlayedCurrent}
                                />
                                <details className="mt-4">
                                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 font-medium">
                                        💡 显示中文翻译
                                    </summary>
                                    <p className="mt-2 text-gray-700 pl-4">{videoData.transcript[dictationIndex]?.cn}</p>
                                </details>
                            </div>
                        ) : mode === 'intensive' ? (
                            <>
                                <IntensiveSentenceList
                                    videoId={Number(videoData.id)}
                                    transcript={videoData.transcript}
                                    currentIndex={activeIndex}
                                    visitedSet={visitedSet}
                                    onSelectSentence={handleIntensiveSelect}
                                    favoriteSentenceIds={favoriteSentenceIds}
                                    onToggleFavorite={handleToggleSentenceFavorite}
                                    onAddToNotebook={(sentenceId) => {
                                        if (!user && !isDemo) {
                                            alert('登录后才能使用本子功能');
                                            return;
                                        }
                                        setNotebookDialogItem({
                                            itemType: 'sentence',
                                            itemId: sentenceId,
                                            videoId: Number(videoData.id)
                                        });
                                        setNotebookDialogOpen(true);
                                    }}
                                />
                            </>
                        ) : (
                            videoData.transcript.map((item, index) => {
                                const isActive = index === activeIndex;
                                // Generate stable sentence ID (use existing or fallback)
                                const sentenceId = item.id !== undefined && item.id !== null
                                    ? item.id
                                    : `${videoData.id}-${index}`;
                                return (
                                    <div key={index} ref={(el) => transcriptRefs.current[index] = el}>
                                        <SubtitleItem
                                            item={item}
                                            index={index}
                                            isActive={isActive}
                                            mode={mode}
                                            clozePattern={null}
                                            vocab={videoData.vocab}
                                            onSeek={handleSeek}
                                            playerRef={playerRef}
                                            renderClozeText={renderClozeText}
                                            onSetIsPlaying={setIsPlaying}
                                            isFavorite={favoriteSentenceIds.some(fid => String(fid) === String(sentenceId))}
                                            onToggleFavorite={handleToggleSentenceFavorite}
                                            videoId={Number(videoData.id)}
                                            favoriteVocabIds={favoriteVocabIds}
                                            onToggleVocabFavorite={handleToggleVocabFavorite}
                                            onAddVocabToNotebook={(vocabId) => {
                                                if (!user && !isDemo) {
                                                    alert('登录后才能使用本子功能');
                                                    return;
                                                }
                                                setNotebookDialogItem({
                                                    itemType: 'vocab',
                                                    itemId: vocabId,
                                                    videoId: Number(videoData.id)
                                                });
                                                setNotebookDialogOpen(true);
                                            }}
                                            isLoggedIn={!!user}
                                        />
                                    </div>
                                );
                            })
                        )}

                        {/* 重点词汇 - 只在手机端显示 */}
                        <div className="xl:hidden mt-6 p-4 bg-violet-50 rounded-lg">
                            <h3 className="text-lg font-bold mb-3 text-violet-500">重点词汇</h3>
                            <div className="space-y-3">
                                {videoData.vocab?.map((item, index) => {
                                    // Generate stable vocab ID (use existing or fallback)
                                    const vocabId = item.id !== undefined && item.id !== null
                                        ? item.id
                                        : `${videoData.id}-vocab-${index}`;
                                    return (
                                        <div key={vocabId} id={`vocab-card-${index}`} data-vocab-id={vocabId} data-vocab-index={index} data-vocab-word={item.word} className="relative p-3 bg-white rounded-lg border border-violet-100 transition-all duration-200">
                                            {/* 收藏按钮（右上角）*/}
                                            <button
                                                onClick={() => handleToggleVocabFavorite(vocabId)}
                                                className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${favoriteVocabIds.some(fid => String(fid) === String(vocabId))
                                                    ? 'text-yellow-500 hover:bg-yellow-100'
                                                    : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                                                    }`}
                                                title={favoriteVocabIds.some(fid => String(fid) === String(vocabId)) ? "取消收藏" : "收藏词汇"}
                                            >
                                                <svg className="w-4 h-4" fill={favoriteVocabIds.some(fid => String(fid) === String(vocabId)) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                </svg>
                                            </button>
                                            {/* 加入本子按钮 */}
                                            <button
                                                onClick={() => {
                                                    if (!user && !isDemo) {
                                                        alert('登录后才能使用本子功能');
                                                        return;
                                                    }
                                                    setNotebookDialogItem({
                                                        itemType: 'vocab',
                                                        itemId: vocabId,
                                                        videoId: Number(videoData.id)
                                                    });
                                                    setNotebookDialogOpen(true);
                                                }}
                                                className="absolute top-2 right-8 p-1 rounded-full transition-colors text-gray-300 hover:text-violet-500 hover:bg-violet-50"
                                                title="加入本子"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                            </button>
                                            <div className="flex items-end mb-1">
                                                <span className="text-base font-bold text-violet-500 mr-2">{item.word}</span>
                                                <span className="text-sm text-gray-500">{item.type}</span>
                                            </div>

                                            <div className="flex flex-col gap-1 mb-1.5">
                                                {item.ipa_us && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                        <span className="text-gray-400 w-4">US</span>
                                                        <span>/{item.ipa_us}/</span>
                                                        <button onClick={() => speak(item.word, 'en-US')} className="p-0.5 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                                {item.ipa_uk && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                        <span className="text-gray-400 w-4">UK</span>
                                                        <span>/{item.ipa_uk}/</span>
                                                        <button onClick={() => speak(item.word, 'en-GB')} className="p-0.5 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <p className="text-gray-600 font-medium mb-2 text-sm">{item.meaning}</p>

                                            {item.examples && item.examples.length > 0 && (
                                                <div className="mb-2 space-y-1">
                                                    {item.examples.slice(0, 1).map((ex, i) => (
                                                        <div key={i} className="text-[15px]">
                                                            <p className="text-gray-800 leading-snug">{ex.en}</p>
                                                            <p className="text-gray-500 text-[14px] mt-0.5">{ex.cn}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {item.collocations && item.collocations.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {item.collocations.slice(0, 3).map((col, i) => (
                                                        <span key={i} className="px-2 py-1 bg-violet-50 text-violet-500 text-[13px] rounded border border-violet-100">
                                                            {col}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 词汇关联期数 - 直接显示 */}
                                            {vocabOccurrences[item.word?.toLowerCase()]?.total > 0 && (
                                                <div className="mt-2 pt-2 border-t border-gray-100">
                                                    <div className="text-xs flex flex-wrap items-center gap-1.5">
                                                        <span className="text-gray-500">📍 还出现在：</span>
                                                        {vocabOccurrences[item.word.toLowerCase()].occurrences.map((occ, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={`/episode/${occ.episode}?scrollTo=vocab&vocabIndex=${occ.vocab_index || 0}`}
                                                                className="text-violet-500 hover:text-violet-500 hover:underline"
                                                            >
                                                                第{occ.episode}期
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>


            </div>

            {/* Add to Notebook Dialog */}
            <AddToNotebookDialog
                isOpen={notebookDialogOpen}
                onClose={() => {
                    setNotebookDialogOpen(false);
                    setNotebookDialogItem(null);
                }}
                user={user}
                isDemo={isDemo}
                itemType={notebookDialogItem?.itemType}
                itemId={notebookDialogItem?.itemId}
                videoId={notebookDialogItem?.videoId}
                onSuccess={(notebookName) => {
                    console.log(`Added to notebook: ${notebookName}`);
                }}
            />

            {/* Print Dialog */}
            {
                showPrintDialog && (
                    <>
                        {/* 遮罩层 */}
                        <div
                            className="fixed inset-0 bg-black/50 z-[200]"
                            onClick={() => setShowPrintDialog(false)}
                        />
                        {/* 弹窗 */}
                        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">选择打印格式</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => executePrint('dual')}
                                    className="w-full py-3 px-4 bg-violet-50 hover:bg-violet-100 text-violet-500 rounded-lg font-medium transition-colors text-left"
                                >
                                    <div className="font-medium">双语字幕</div>
                                    <div className="text-sm text-violet-500 mt-0.5">英文 + 中文翻译</div>
                                </button>
                                <button
                                    onClick={() => executePrint('en')}
                                    className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg font-medium transition-colors text-left"
                                >
                                    <div className="font-medium">纯英文</div>
                                    <div className="text-sm text-gray-500 mt-0.5">仅英文原文</div>
                                </button>
                                <button
                                    onClick={() => executePrint('cn')}
                                    className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg font-medium transition-colors text-left"
                                >
                                    <div className="font-medium">纯中文</div>
                                    <div className="text-sm text-gray-500 mt-0.5">仅中文翻译</div>
                                </button>
                            </div>
                            <button
                                onClick={() => setShowPrintDialog(false)}
                                className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </>
                )
            }
        </div >
    );
};

export default VideoDetail;
