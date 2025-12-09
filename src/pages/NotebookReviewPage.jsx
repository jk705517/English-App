import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notebookService } from '../services/notebookService';
import VocabReviewCard from '../components/VocabReviewCard';

/**
 * 预留函数：记录复习结果
 * TODO: 未来在这里调用 Supabase，写入 user_review_states 表
 */
function recordReviewResult(vocabItem, isKnown) {
    console.log('review result', { vocabId: vocabItem.id, isKnown, word: vocabItem.word });
}

/**
 * 本子词汇复习页面
 */
function NotebookReviewPage() {
    const { notebookId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const type = searchParams.get('type') || 'vocab';

    // 数据状态
    const [loading, setLoading] = useState(true);
    const [notebookName, setNotebookName] = useState('');
    const [vocabs, setVocabs] = useState([]);

    // 复习会话状态
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [stats, setStats] = useState({ known: 0, unknown: 0 });

    // v1.1: 1秒冷却状态 - 强制用户先想一想
    const [canReveal, setCanReveal] = useState(false);

    // 加载本子词汇数据
    useEffect(() => {
        if (!user || !notebookId) return;

        const loadData = async () => {
            setLoading(true);
            const data = await notebookService.loadNotebookVocabsForReview(user, notebookId);
            if (data) {
                setNotebookName(data.notebook.name);
                // v1: 按添加顺序排列（已在 service 中按 created_at 排序）
                // 可选：随机打乱顺序
                // const shuffled = [...data.vocabs].sort(() => Math.random() - 0.5);
                setVocabs(data.vocabs);
            }
            setLoading(false);
        };

        loadData();
    }, [user, notebookId]);

    // v1.1: 当前单词变化时，重置状态 + 启动 1 秒定时器
    useEffect(() => {
        // 重置翻面和冷却状态
        setIsFlipped(false);
        setCanReveal(false);

        // 1 秒后才允许翻面
        const timer = setTimeout(() => {
            setCanReveal(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, [currentIndex]);

    // 键盘事件处理（PC 端）- 需要尊重 canReveal
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 避免影响输入框等元素
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                // v1.1: 需要检查 canReveal
                if (!isFlipped && canReveal && currentIndex < vocabs.length) {
                    setIsFlipped(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFlipped, canReveal, currentIndex, vocabs.length]);

    // 翻面 - v1.1: 需要尊重 canReveal
    const handleFlip = useCallback(() => {
        if (!canReveal) return; // 还在"想一想"阶段，不允许翻
        if (!isFlipped) {
            setIsFlipped(true);
        }
    }, [isFlipped, canReveal]);

    // 我会了
    const handleKnown = useCallback(() => {
        if (currentIndex >= vocabs.length) return;

        const currentVocab = vocabs[currentIndex];
        setStats(prev => ({ ...prev, known: prev.known + 1 }));
        recordReviewResult(currentVocab, true);

        // 切换到下一条（useEffect 会自动重置 isFlipped 和 canReveal）
        setCurrentIndex(prev => prev + 1);
    }, [currentIndex, vocabs]);

    // 还不熟
    const handleUnknown = useCallback(() => {
        if (currentIndex >= vocabs.length) return;

        const currentVocab = vocabs[currentIndex];
        setStats(prev => ({ ...prev, unknown: prev.unknown + 1 }));
        recordReviewResult(currentVocab, false);

        // 切换到下一条（useEffect 会自动重置 isFlipped 和 canReveal）
        setCurrentIndex(prev => prev + 1);
    }, [currentIndex, vocabs]);

    // 再来一轮
    const handleRestart = () => {
        setCurrentIndex(0);
        // useEffect 会自动处理 isFlipped 和 canReveal 的重置
        setStats({ known: 0, unknown: 0 });
    };

    // 返回本子详情页
    const handleBack = () => {
        navigate('/notebooks');
    };

    // v1.1: 去原视频 - 复用 Notebooks 页"去学习"的跳转逻辑
    const handleGoToVideo = useCallback((vocabItem) => {
        // 跳转到视频详情页，并定位到该词汇
        // 路径格式与 Notebooks.jsx 中"去学习"按钮保持一致
        navigate(`/video/${vocabItem.videoId}?mode=intensive&vocabId=${vocabItem.id}`);
    }, [navigate]);

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

    // 非词汇类型（句子复习即将上线）
    if (type !== 'vocab') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-xl text-gray-600 mb-4">句子复习功能即将上线，敬请期待！</p>
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

    // 加载中
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // 没有词汇
    if (vocabs.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-xl text-gray-600 mb-4">这个本子里还没有词汇</p>
                    <p className="text-gray-400 mb-6">先去视频页面添加一些词汇到本子吧</p>
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
    if (currentIndex >= vocabs.length) {
        const totalReviewed = stats.known + stats.unknown;
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
                        <p className="text-gray-500 mb-8">你已经复习了 {totalReviewed} 个单词</p>

                        {/* 统计数据 */}
                        <div className="flex justify-center gap-8 mb-8">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">{stats.known}</div>
                                <div className="text-sm text-gray-500">我会了</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-orange-500">{stats.unknown}</div>
                                <div className="text-sm text-gray-500">暂时不熟</div>
                            </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleRestart}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-5 h-5" />
                                再来一轮
                            </button>
                            <button
                                onClick={handleBack}
                                className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                返回本子
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 正常复习界面
    const currentVocab = vocabs[currentIndex];
    const progress = ((currentIndex + 1) / vocabs.length) * 100;

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
                    <p className="text-sm text-gray-500">词汇复习</p>
                </div>

                {/* 进度 */}
                <div className="text-right">
                    <span className="text-lg font-semibold text-indigo-600">
                        {currentIndex + 1}
                    </span>
                    <span className="text-gray-400"> / {vocabs.length}</span>
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
                <VocabReviewCard
                    vocab={currentVocab}
                    isFlipped={isFlipped}
                    onFlip={handleFlip}
                    canReveal={canReveal}
                    onGoToVideo={() => handleGoToVideo(currentVocab)}
                />
            </div>

            {/* 底部操作区域 */}
            <div className="p-4 bg-white/80 backdrop-blur-sm shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {!isFlipped ? (
                    /* 未翻面：显示释义按钮 - v1.1: 冷却期间禁用 */
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
                    /* 已翻面：我会了 / 还不熟 */
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
                            我会了
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default NotebookReviewPage;
