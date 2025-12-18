import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notebookService } from '../services/notebookService';
import { recordReviewLog, updateReviewState } from '../services/reviewService';
import VocabReviewCard from '../components/VocabReviewCard';
import SentenceReviewCard from '../components/SentenceReviewCard';


/**
 * 记录复习结果：调用 reviewService 更新复习状态
 * @param {object} item - 当前复习的词汇或句子对象
 * @param {boolean} isKnown - true=我会了, false=还不熟
 * @param {string} type - 'vocab' 或 'sentence'
 * @param {string} notebookId - 当前本子的 id
 * @param {string} userId - 当前用户 id
 */
function recordReviewResult(item, isKnown, type, notebookId, userId) {
    // 1. 仍然保留 console.log，方便本地调试
    console.log('review result', {
        type,
        itemId: type === 'sentence' ? item?.sentenceId : (item?.vocabId ?? item?.id),
        isKnown,
        word: item?.word || item?.en?.substring(0, 30),
    });

    if (!item) return;

    // 2. 组装公共字段
    // 注意：从 notebookService 丰富后的数据中，句子用 sentenceId，词汇用 vocabId
    const itemId = type === 'sentence'
        ? (item.sentenceId ?? item.id)
        : (item.vocabId ?? item.id ?? item.word);

    const payload = {
        itemType: type === 'sentence' ? 'sentence' : 'vocab',
        itemId,
        isKnown,
        videoId: item.videoId,
        notebookId,
        reviewMode: type === 'sentence' ? 'sentence_review' : 'vocab_review',
    };

    console.log('[recordReviewResult] payload:', payload);

    // 3. 异步写入日志（不阻塞 UI）- 现在由后端统一处理
    recordReviewLog(payload, userId);

    // 4. 更新记忆曲线状态（不阻塞 UI）
    updateReviewState(payload, userId);
}


/**
 * 本子复习页面（支持词汇和句子两种模式）
 */
function NotebookReviewPage() {
    const { notebookId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // 从 URL 读取模式类型
    const type = searchParams.get('type') || 'vocab';

    // 数据状态
    const [loading, setLoading] = useState(true);
    const [notebookName, setNotebookName] = useState('');
    const [vocabs, setVocabs] = useState([]);
    const [sentences, setSentences] = useState([]);
    const [totalVocabCount, setTotalVocabCount] = useState(0); // 本子里所有词汇总数

    // 复习会话状态
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [stats, setStats] = useState({ known: 0, unknown: 0 });

    // v1.1: 2秒冷却状态 - 强制用户先想一想
    const [canReveal, setCanReveal] = useState(false);

    // v1.3: 句子展示状态（仅用于词汇模式）
    const [sentencesVisible, setSentencesVisible] = useState(false);
    const [sentencesLoading, setSentencesLoading] = useState(false);
    const [sentencesForVocab, setSentencesForVocab] = useState([]);
    const [sentencesForVocabId, setSentencesForVocabId] = useState(null);

    // v1.2: sessionStorage key for progress persistence（区分 type）
    const storageKey = user?.id
        ? `notebookReviewState:${user.id}:${notebookId}:${type}`
        : null;

    // v1.2: 标记是否已尝试恢复状态，避免重复恢复
    const hasRestoredRef = useRef(false);

    // 当前模式的数据列表
    const items = type === 'sentence' ? sentences : vocabs;
    const total = items.length;
    const currentItem = total > 0 && currentIndex < total ? items[currentIndex] : null;

    // 加载本子数据（根据 type 调用不同 service）
    useEffect(() => {
        if (!user || !notebookId) return;

        const loadData = async () => {
            setLoading(true);
            hasRestoredRef.current = false; // 重置恢复标记

            try {
                if (type === 'sentence') {
                    const data = await notebookService.loadNotebookSentencesForReview(user, notebookId);
                    if (data) {
                        setNotebookName(data.notebook.name);
                        setSentences(data.sentences || []);
                        setVocabs([]); // 清空另一个模式的数据
                    }
                } else {
                    const data = await notebookService.loadNotebookVocabsForReview(user, notebookId);
                    if (data) {
                        setNotebookName(data.notebook.name);
                        setVocabs(data.vocabs || []);
                        setTotalVocabCount(data.totalVocabCount || 0);
                        setSentences([]); // 清空另一个模式的数据
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user, notebookId, type]);

    // v1.2: 从 sessionStorage 恢复进度（仅在数据加载完成后执行一次）
    useEffect(() => {
        if (!storageKey || items.length === 0) return;
        if (hasRestoredRef.current) return; // 只恢复一次

        const raw = sessionStorage.getItem(storageKey);
        if (!raw) {
            hasRestoredRef.current = true;
            return;
        }

        try {
            const saved = JSON.parse(raw);

            // 校验：同一本本子、数量一致、保存时间不太久（2 小时内）
            const isSameNotebook = saved.notebookId === notebookId;
            const sameTotal = typeof saved.total === 'number' && saved.total === items.length;
            const notTooOld =
                typeof saved.savedAt === 'number' &&
                Date.now() - saved.savedAt < 2 * 60 * 60 * 1000; // 2 小时

            if (isSameNotebook && sameTotal && notTooOld) {
                if (
                    typeof saved.currentIndex === 'number' &&
                    saved.currentIndex >= 0 &&
                    saved.currentIndex < items.length
                ) {
                    setCurrentIndex(saved.currentIndex);
                }
                if (saved.stats && typeof saved.stats === 'object') {
                    setStats(saved.stats);
                }
                console.log('Restored review state:', saved);
            } else {
                // 不满足条件就清掉旧状态
                sessionStorage.removeItem(storageKey);
            }
        } catch (e) {
            console.error('Failed to restore notebook review state', e);
            sessionStorage.removeItem(storageKey);
        }

        hasRestoredRef.current = true;
    }, [storageKey, notebookId, items]);

    // v1.2: 每次进度变化时把状态写入 sessionStorage
    useEffect(() => {
        if (!storageKey || items.length === 0) return;
        if (!hasRestoredRef.current) return; // 恢复完成后才开始保存

        const stateToSave = {
            notebookId,
            currentIndex,
            stats,
            total: items.length,
            savedAt: Date.now(),
        };

        sessionStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }, [storageKey, notebookId, currentIndex, stats, items]);

    // 当前卡片变化时，重置翻面和冷却状态 + 启动 2 秒定时器
    useEffect(() => {
        // 重置翻面和冷却状态
        setIsFlipped(false);
        setCanReveal(false);

        // 重置句子展示状态（仅词汇模式需要）
        setSentencesVisible(false);
        setSentencesForVocab([]);
        setSentencesForVocabId(null);

        // 2 秒后才允许翻面
        const timer = setTimeout(() => {
            setCanReveal(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, [currentIndex]);

    // 键盘事件处理（PC 端）- 需要尊重 canReveal
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 避免影响输入框等元素
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                if (!isFlipped && canReveal && currentIndex < total) {
                    setIsFlipped(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFlipped, canReveal, currentIndex, total]);

    // 翻面 - 需要尊重 canReveal
    const handleFlip = useCallback(() => {
        if (!canReveal) return; // 还在"想一想"阶段，不允许翻
        if (!isFlipped) {
            setIsFlipped(true);
        }
    }, [isFlipped, canReveal]);

    // 我会了 / 我懂了
    const handleKnown = useCallback(() => {
        if (currentIndex >= total) return;

        const item = items[currentIndex];
        setStats(prev => ({ ...prev, known: prev.known + 1 }));
        recordReviewResult(item, true, type, notebookId, user?.id);

        // 切换到下一条
        setCurrentIndex(prev => prev + 1);
    }, [currentIndex, items, total, type, notebookId, user?.id]);

    // 还不熟
    const handleUnknown = useCallback(() => {
        if (currentIndex >= total) return;

        const item = items[currentIndex];
        setStats(prev => ({ ...prev, unknown: prev.unknown + 1 }));
        recordReviewResult(item, false, type, notebookId, user?.id);

        // 切换到下一条
        setCurrentIndex(prev => prev + 1);
    }, [currentIndex, items, total, type, notebookId, user?.id]);

    // 再来一轮 - 清理存储并重置
    const handleRestart = () => {
        if (storageKey) {
            sessionStorage.removeItem(storageKey);
        }
        setCurrentIndex(0);
        setStats({ known: 0, unknown: 0 });
        setIsFlipped(false);
        setCanReveal(false);
    };

    // 返回本子详情页 - 清理存储并携带本子 ID
    const handleBack = () => {
        if (storageKey) {
            sessionStorage.removeItem(storageKey);
        }
        // 携带 notebookId、tab 和 refresh 参数，使 Notebooks 页面能恢复选中状态并刷新数据
        // refresh 参数是时间戳，用于触发强制刷新
        navigate(`/notebooks?notebookId=${notebookId}&tab=${type}&refresh=${Date.now()}`);
    };

    // 去原视频
    const handleGoToVideo = useCallback((item) => {
        if (type === 'sentence') {
            // 句子模式：跳转到视频并定位到该句子
            navigate(`/video/${item.videoId}?mode=intensive&sentenceId=${item.id}`);
        } else {
            // 词汇模式：跳转到视频并定位到该词汇
            navigate(`/video/${item.videoId}?mode=intensive&vocabId=${item.id}`);
        }
    }, [navigate, type]);

    // 词汇模式：切换句子展示
    const handleToggleSentences = useCallback(async (currentVocab) => {
        if (!sentencesVisible) {
            setSentencesVisible(true);

            if (sentencesForVocabId !== currentVocab.id) {
                setSentencesLoading(true);
                try {
                    const list = await notebookService.loadSentencesForVocab(user, currentVocab);
                    setSentencesForVocab(list || []);
                    setSentencesForVocabId(currentVocab.id);
                } finally {
                    setSentencesLoading(false);
                }
            }
        } else {
            setSentencesVisible(false);
        }
    }, [sentencesVisible, sentencesForVocabId, user]);

    // 未登录
    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-xl text-gray-600 mb-4">请先登录后使用复习功能</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        去登录
                    </button>
                </div>
            </div>
        );
    }

    // 加载中
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // 没有数据 - 区分“本子真的空”和“本轮没有到期的词”
    if (total === 0) {
        const isReallyEmpty = type === 'vocab' ? totalVocabCount === 0 : true;

        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
                <div className="text-center">
                    {isReallyEmpty ? (
                        <>
                            <p className="text-xl text-gray-600 mb-4">
                                这个本子里还没有{type === 'sentence' ? '句子' : '词汇'}
                            </p>
                            <p className="text-gray-400 mb-6">
                                先去视频页面添加一些{type === 'sentence' ? '句子' : '词汇'}到本子吧
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-xl text-gray-600 mb-4">
                                🎉 暂时没有需要复习的词汇
                            </p>
                            <p className="text-gray-400 mb-6">
                                本子里共有 {totalVocabCount} 个词，但都还没到复习时间。稍后再来吧！
                            </p>
                        </>
                    )}
                    <button
                        onClick={handleBack}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        返回本子
                    </button>
                </div>
            </div>
        );
    }

    // 复习完成 - 总结页
    if (currentIndex >= total) {
        const totalReviewed = stats.known + stats.unknown;
        const modeLabel = type === 'sentence' ? '句子' : '词汇';
        const knownLabel = type === 'sentence' ? '我懂了' : '我会了';

        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col">
                {/* 顶部栏 */}
                <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm shadow-sm">
                    <button
                        onClick={handleBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">复习完成</h1>
                    <div className="w-10" /> {/* 占位 */}
                </div>

                {/* 总结内容 */}
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check className="w-10 h-10 text-green-600" />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-2">本次复习完成 🎉</h2>
                        <p className="text-gray-500 mb-8">你已经复习了 {totalReviewed} 个{modeLabel}</p>

                        {/* 统计数据 */}
                        <div className="flex justify-center gap-8 mb-8">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">{stats.known}</div>
                                <div className="text-sm text-gray-500">{knownLabel}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-orange-500">{stats.unknown}</div>
                                <div className="text-sm text-gray-500">还不熟</div>
                            </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleRestart}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-5 h-5" />
                                再刷这一轮
                            </button>
                            <button
                                onClick={handleBack}
                                className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                回到本子页
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 正常复习界面
    const progress = ((currentIndex + 1) / total) * 100;
    const modeLabel = type === 'sentence' ? '句子复习' : '词汇复习';
    const knownButtonLabel = type === 'sentence' ? '我懂了' : '我会了';

    // 根据模式渲染不同的卡片
    let card = null;
    if (type === 'sentence') {
        card = (
            <SentenceReviewCard
                sentence={currentItem}
                isFlipped={isFlipped}
                canReveal={canReveal}
                onFlip={handleFlip}
                onGoToVideo={() => handleGoToVideo(currentItem)}
            />
        );
    } else {
        card = (
            <VocabReviewCard
                vocab={currentItem}
                isFlipped={isFlipped}
                canReveal={canReveal}
                onFlip={handleFlip}
                onGoToVideo={() => handleGoToVideo(currentItem)}
                sentences={sentencesForVocab}
                sentencesVisible={sentencesVisible}
                sentencesLoading={sentencesLoading}
                onToggleSentences={() => handleToggleSentences(currentItem)}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col">
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm shadow-sm">
                {/* 返回按钮 */}
                <button
                    onClick={handleBack}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>

                {/* 标题 */}
                <div className="text-center">
                    <h1 className="text-lg font-semibold text-gray-800">{notebookName}</h1>
                    <p className="text-sm text-gray-500">{modeLabel}</p>
                </div>

                {/* 进度 */}
                <div className="text-right">
                    <span className="text-lg font-semibold text-indigo-600">
                        {currentIndex + 1}
                    </span>
                    <span className="text-gray-400"> / {total}</span>
                </div>
            </div>

            {/* 进度条 */}
            <div className="h-1 bg-gray-200">
                <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* 卡片区域 */}
            <div className="flex-1 flex items-center justify-center p-4">
                {card}
            </div>

            {/* 底部操作区域 */}
            <div className="p-4 bg-white/80 backdrop-blur-sm shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {!isFlipped ? (
                    /* 未翻面：显示释义按钮 - 冷却期间禁用 */
                    <button
                        onClick={handleFlip}
                        disabled={!canReveal}
                        className={`w-full py-4 rounded-xl font-medium text-lg transition-colors ${canReveal
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {canReveal ? '显示释义' : '想一想…'}
                    </button>
                ) : (
                    /* 已翻面：还不熟 / 我会了（我懂了） */
                    <div className="flex gap-4">
                        <button
                            onClick={handleUnknown}
                            className="flex-1 py-4 bg-orange-100 text-orange-600 rounded-xl font-medium text-lg hover:bg-orange-200 transition-colors flex items-center justify-center gap-2"
                        >
                            <X className="w-5 h-5" />
                            还不熟
                        </button>
                        <button
                            onClick={handleKnown}
                            className="flex-1 py-4 bg-green-500 text-white rounded-xl font-medium text-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            {knownButtonLabel}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default NotebookReviewPage;
