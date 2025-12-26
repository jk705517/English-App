import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Plus, MessageSquare, ChevronRight, Edit2, X, Play, MoreHorizontal, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notebookService } from '../services/notebookService';
import { notebooksAPI } from '../services/api';
import Modal from '../components/Modal';
import DropdownMenu from '../components/DropdownMenu';
import BottomSheet from '../components/BottomSheet';
import useLongPress from '../hooks/useLongPress';

function Notebooks() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const detailRef = useRef(null);

    // 从 URL 参数读取初始状态
    const urlNotebookId = searchParams.get('notebookId');
    const urlTab = searchParams.get('tab');
    const validTabs = ['sentence', 'vocab'];
    const initialTab = validTabs.includes(urlTab) ? urlTab : 'sentence';

    // 用于追踪需要自动选中的本子 ID（在本子列表加载完成后使用）
    const pendingNotebookIdRef = useRef(urlNotebookId);

    // 本子列表状态
    const [notebooks, setNotebooks] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    // 选中的本子
    const [selectedNotebook, setSelectedNotebook] = useState(null);
    const [notebookDetail, setNotebookDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Tab 状态（从 URL 初始化）
    const [activeTab, setActiveTab] = useState(initialTab);

    // 词汇复习统计（记忆曲线）
    const [vocabStats, setVocabStats] = useState({ dueCount: 0, totalVocabCount: 0, hasReviewState: false });
    const [vocabStatsLoading, setVocabStatsLoading] = useState(false);

    // 句子复习统计（记忆曲线）
    const [sentenceStats, setSentenceStats] = useState({ dueCount: 0, totalSentenceCount: 0, hasReviewState: false });
    const [sentenceStatsLoading, setSentenceStatsLoading] = useState(false);

    // 新建本子 Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNotebookName, setNewNotebookName] = useState('');
    const [creating, setCreating] = useState(false);

    // 删除确认 Modal
    const [deleteConfirm, setDeleteConfirm] = useState({
        isOpen: false,
        type: null,
        data: null
    });

    // 底部操作栏状态 (Mobile)
    const [bottomSheet, setBottomSheet] = useState({
        isOpen: false,
        title: '',
        type: null,
        data: null
    });

    // 重命名本子 Modal
    const [renameModal, setRenameModal] = useState({
        isOpen: false,
        notebook: null,
        newName: ''
    });
    const [renaming, setRenaming] = useState(false);

    // 打印弹窗状态
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const [printNotebookId, setPrintNotebookId] = useState(null);

    // 移动端检测
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 自动滚动到详情区域 (Mobile)
    useEffect(() => {
        if (isMobile && selectedNotebook && detailRef.current) {
            detailRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }
    }, [selectedNotebook, isMobile]);

    // 长按处理 Wrapper
    const LongPressWrapper = ({ children, data, type, onClick, className }) => {
        const longPressProps = useLongPress({
            onLongPress: () => {
                if (!isMobile) return;
                if (navigator.vibrate) navigator.vibrate(50);

                let title = '';
                if (type === 'notebook') title = data.name;
                else if (type === 'sentence') title = data.en;
                else if (type === 'vocab') title = data.word;

                setBottomSheet({
                    isOpen: true,
                    title,
                    type,
                    data
                });
            },
            onClick: onClick
        });

        return (
            <div
                {...longPressProps}
                className={`${className} ${isMobile ? 'mobile-longpress-target' : ''}`}
                onContextMenu={isMobile ? (e) => e.preventDefault() : undefined}
            >
                {children}
            </div>
        );
    };

    // 更新 URL 参数
    const updateUrlParams = (notebookId, tab) => {
        const params = {};
        if (notebookId) params.notebookId = notebookId;
        if (tab) params.tab = tab;
        setSearchParams(params, { replace: true });
    };

    // Tab 切换处理
    const handleTabChange = (tabKey) => {
        sessionStorage.setItem(`notebooks_scroll_${activeTab}`, window.scrollY.toString());
        setActiveTab(tabKey);
        updateUrlParams(selectedNotebook?.id, tabKey);
        setTimeout(() => {
            const savedScroll = sessionStorage.getItem(`notebooks_scroll_${tabKey}`);
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll, 10));
            }
        }, 0);
    };

    // 加载本子列表
    useEffect(() => {
        if (user) {
            loadNotebookList();
        }
    }, [user]);

    const loadNotebookList = async () => {
        setLoading(true);
        const { notebooks: loadedNotebooks, summary } = await notebookService.loadNotebooks(user);
        setNotebooks(loadedNotebooks);
        setSummary(summary);
        console.log('[NotebooksPage] summary', summary);
        setLoading(false);

        if (pendingNotebookIdRef.current && loadedNotebooks.length > 0) {
            const targetNotebook = loadedNotebooks.find(nb => String(nb.id) === String(pendingNotebookIdRef.current));
            if (targetNotebook) {
                setTimeout(() => {
                    handleSelectNotebook(targetNotebook, false);
                }, 0);
            }
            pendingNotebookIdRef.current = null;
        }
    };

    // 页面加载时恢复滚动位置
    useEffect(() => {
        const savedScroll = sessionStorage.getItem(`notebooks_scroll_${activeTab}`);
        if (savedScroll) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll, 10));
            }, 100);
        }
    }, []);

    // 监听 URL 参数变化
    useEffect(() => {
        if (loading || notebooks.length === 0) return;

        const currentUrlNotebookId = searchParams.get('notebookId');
        const currentUrlTab = searchParams.get('tab');
        const refreshParam = searchParams.get('refresh');

        if (currentUrlNotebookId) {
            const isSameNotebook = selectedNotebook && String(selectedNotebook.id) === String(currentUrlNotebookId);

            if (refreshParam && isSameNotebook) {
                console.log('[Notebooks] Refresh triggered from review page, reloading stats for notebook:', currentUrlNotebookId);
                loadVocabStats(currentUrlNotebookId);
                loadSentenceStats(currentUrlNotebookId);
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('refresh');
                setSearchParams(newParams, { replace: true });
                return;
            }

            if (!isSameNotebook) {
                const targetNotebook = notebooks.find(nb => String(nb.id) === String(currentUrlNotebookId));
                if (targetNotebook) {
                    console.log('[Notebooks] Restoring notebook from URL:', currentUrlNotebookId, 'found:', targetNotebook.name);
                    handleSelectNotebook(targetNotebook, false);
                } else {
                    console.warn('[Notebooks] Notebook not found for ID:', currentUrlNotebookId);
                }
            }
        }

        if (currentUrlTab && validTabs.includes(currentUrlTab) && activeTab !== currentUrlTab) {
            console.log('[Notebooks] Restoring tab from URL:', currentUrlTab);
            setActiveTab(currentUrlTab);
        }
    }, [searchParams, notebooks, loading]);

    // 选中本子并切换 Tab
    const handleJumpToNotebook = (notebookId, tab) => {
        const notebook = notebooks.find(nb => nb.id === notebookId);
        if (notebook) {
            handleSelectNotebook(notebook);
            if (tab === 'vocab' || tab === 'sentence') {
                setActiveTab(tab);
                updateUrlParams(notebookId, tab);
            }
        }
    };

    // 渲染今日汇总
    const renderTodaySummary = (summary, notebooks) => {
        if (!summary) return null;

        const {
            totalNotebooks,
            totalVocabCount,
            totalSentenceCount,
            totalDueVocabCount,
            totalDueSentenceCount,
            firstDueNotebookId,
            firstDueNotebookTab,
        } = summary;

        const totalDue = totalDueVocabCount + totalDueSentenceCount;
        const totalItems = totalVocabCount + totalSentenceCount;

        if (totalNotebooks === 0 || totalItems === 0) {
            return (
                <div className="flex flex-col gap-1">
                    <div>你还没有创建任何本子或添加内容。</div>
                    <div className="text-gray-500">
                        去视频页挑一些喜欢的句子和词汇，加到本子里再来复习吧。
                    </div>
                </div>
            );
        }

        if (totalDue > 0 && firstDueNotebookId) {
            const firstNotebook = notebooks.find(nb => nb.id === firstDueNotebookId);
            const firstName = firstNotebook?.name || '某个本子';

            return (
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <div>
                            今天待复习：<span className="font-semibold">{totalDueVocabCount}</span> 个词 ·{' '}
                            <span className="font-semibold">{totalDueSentenceCount}</span> 个句子
                            （分布在 <span className="font-semibold">{totalNotebooks}</span> 个本子里）
                        </div>
                        <div className="text-gray-500">
                            建议从《{firstName}》开始复习。
                        </div>
                    </div>
                    <button
                        type="button"
                        className="mt-2 inline-flex items-center justify-center rounded-md bg-violet-400 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 md:mt-0"
                        onClick={() => handleJumpToNotebook(firstDueNotebookId, firstDueNotebookTab)}
                    >
                        开始今天的复习
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <div>
                        🎉 今天所有本子的复习任务都完成啦！
                    </div>
                    <div className="text-gray-500">
                        共 {totalVocabCount} 个词、{totalSentenceCount} 个句子。
                        你可以随便练一练，或者明天再来～
                    </div>
                </div>
                {!!notebooks.length && (
                    <button
                        type="button"
                        className="mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 md:mt-0"
                        onClick={() => {
                            const target = notebooks.find(
                                nb => (nb.vocabCount || 0) + (nb.sentenceCount || 0) > 0
                            );
                            if (target) {
                                const tab = (target.vocabCount || 0) > 0 ? 'vocab' : 'sentence';
                                handleJumpToNotebook(target.id, tab);
                            }
                        }}
                    >
                        随便练一练
                    </button>
                )}
            </div>
        );
    };

    // 渲染本子副标题
    const renderNotebookSubtitle = (notebook) => {
        const totalCount = (notebook.vocabCount || 0) + (notebook.sentenceCount || 0);
        const dueCount = (notebook.dueVocabCount || 0) + (notebook.dueSentenceCount || 0);

        if (totalCount === 0) {
            return '暂无内容';
        }

        if (dueCount > 0) {
            const parts = [];
            if (notebook.dueVocabCount > 0) parts.push(`${notebook.dueVocabCount} 词`);
            if (notebook.dueSentenceCount > 0) parts.push(`${notebook.dueSentenceCount} 句`);
            return `今日待复习：${parts.join(' · ')}`;
        }

        const contentParts = [];
        if (notebook.vocabCount > 0) contentParts.push(`${notebook.vocabCount} 词`);
        if (notebook.sentenceCount > 0) contentParts.push(`${notebook.sentenceCount} 句`);
        return `${contentParts.join(' · ')}（今日已完成）`;
    };

    // 加载本子详情
    const handleSelectNotebook = async (notebook, shouldUpdateUrl = true) => {
        setSelectedNotebook(notebook);
        setDetailLoading(true);
        setVocabStats({ dueCount: 0, totalVocabCount: 0, hasReviewState: false });
        setSentenceStats({ dueCount: 0, totalSentenceCount: 0, hasReviewState: false });
        console.log('[handleSelectNotebook] Reset stats for notebook:', notebook.id);

        if (shouldUpdateUrl) {
            updateUrlParams(notebook.id, activeTab);
        }

        const detail = await notebookService.loadNotebookDetail(user, notebook.id);
        setNotebookDetail(detail);
        setDetailLoading(false);

        loadVocabStats(notebook.id);
        loadSentenceStats(notebook.id);
    };

    const loadVocabStats = async (notebookId) => {
        setVocabStatsLoading(true);
        try {
            const data = await notebookService.loadNotebookVocabsForReview(user, notebookId);
            if (data) {
                const hasReviewState = data.vocabs?.some(v => v.reviewState != null) || false;
                console.log('[VocabStats]', {
                    notebookId,
                    totalVocabCount: data.totalVocabCount,
                    dueCount: data.dueCount,
                    hasReviewState,
                    vocabsWithReviewState: data.vocabs?.filter(v => v.reviewState != null).length || 0,
                });
                const newStats = {
                    dueCount: data.dueCount || 0,
                    totalVocabCount: data.totalVocabCount || 0,
                    hasReviewState,
                };
                console.log('[VocabStats] Setting vocabStats to:', newStats);
                setVocabStats(newStats);
            }
        } catch (err) {
            console.error('Error loading vocab stats:', err);
        }
        setVocabStatsLoading(false);
    };

    const loadSentenceStats = async (notebookId) => {
        setSentenceStatsLoading(true);
        try {
            const data = await notebookService.loadNotebookSentencesForReview(user, notebookId);
            if (data) {
                const hasReviewState = data.sentences?.some(s => s.reviewState != null) || false;
                const stats = {
                    dueCount: data.dueSentenceCount || 0,
                    totalSentenceCount: data.totalSentenceCount || 0,
                    hasReviewState,
                };
                setSentenceStats(stats);

                console.log('[SentenceNotebookHeader]', {
                    notebookId,
                    totalSentenceCount: stats.totalSentenceCount,
                    dueSentenceCount: stats.dueCount,
                    hasReviewState: stats.hasReviewState,
                });
            }
        } catch (err) {
            console.error('Error loading sentence stats:', err);
        }
        setSentenceStatsLoading(false);
    };

    const handleCreateNotebook = async () => {
        if (!newNotebookName.trim()) return;

        setCreating(true);
        const newNotebook = await notebookService.createNotebook(user, {
            name: newNotebookName.trim()
        });

        if (newNotebook) {
            setNotebooks([newNotebook, ...notebooks]);
            setShowCreateModal(false);
            setNewNotebookName('');
        }
        setCreating(false);
    };

    const handleDeleteNotebook = async (notebookId) => {
        const success = await notebookService.deleteNotebook(user, notebookId);
        if (success) {
            setNotebooks(notebooks.filter(nb => nb.id !== notebookId));
            if (selectedNotebook?.id === notebookId) {
                setSelectedNotebook(null);
                setNotebookDetail(null);
            }
        }
    };

    const handleRenameNotebook = async () => {
        if (!renameModal.notebook || !renameModal.newName.trim()) return;

        setRenaming(true);
        try {
            const response = await notebooksAPI.update(renameModal.notebook.id, renameModal.newName.trim());
            if (response.success) {
                setNotebooks(notebooks.map(nb =>
                    nb.id === renameModal.notebook.id
                        ? { ...nb, name: renameModal.newName.trim() }
                        : nb
                ));
                if (selectedNotebook?.id === renameModal.notebook.id) {
                    setSelectedNotebook({ ...selectedNotebook, name: renameModal.newName.trim() });
                }
                setRenameModal({ isOpen: false, notebook: null, newName: '' });
            }
        } catch (err) {
            console.error('重命名本子失败:', err);
        }
        setRenaming(false);
    };

    const handleRemoveSentence = async (sentenceId) => {
        const success = await notebookService.removeItemFromNotebook(user, {
            notebookId: selectedNotebook.id,
            itemType: 'sentence',
            itemId: sentenceId
        });

        if (success) {
            setNotebookDetail(prev => ({
                ...prev,
                sentences: prev.sentences.filter(s => s.sentenceId !== sentenceId)
            }));
            setNotebooks(prev => prev.map(nb =>
                nb.id === selectedNotebook.id
                    ? { ...nb, sentenceCount: nb.sentenceCount - 1 }
                    : nb
            ));
            setSelectedNotebook(prev => ({
                ...prev,
                sentenceCount: prev.sentenceCount - 1
            }));
        }
    };

    const handleRemoveVocab = async (vocabId) => {
        const success = await notebookService.removeItemFromNotebook(user, {
            notebookId: selectedNotebook.id,
            itemType: 'vocab',
            itemId: vocabId
        });

        if (success) {
            setNotebookDetail(prev => ({
                ...prev,
                vocabs: prev.vocabs.filter(v => v.vocabId !== vocabId)
            }));
            setNotebooks(prev => prev.map(nb =>
                nb.id === selectedNotebook.id
                    ? { ...nb, vocabCount: nb.vocabCount - 1 }
                    : nb
            ));
            setSelectedNotebook(prev => ({
                ...prev,
                vocabCount: prev.vocabCount - 1
            }));
        }
    };

    const executeDelete = async () => {
        const { type, data } = deleteConfirm;
        if (!type || !data) return;

        if (type === 'notebook') {
            await handleDeleteNotebook(data.id);
        } else if (type === 'sentence') {
            await handleRemoveSentence(data.sentenceId);
        } else if (type === 'vocab') {
            await handleRemoveVocab(data.vocabId);
        }
        setDeleteConfirm({ isOpen: false, type: null, data: null });
    };

    // 执行打印本子
    const executePrintNotebook = (format) => {
        setShowPrintDialog(false);

        // 找到当前本子
        const notebook = notebooks.find(n => n.id === printNotebookId);
        if (!notebook || !notebookDetail) return;

        // 获取本子内容
        const vocabItems = notebookDetail.vocabs || [];
        const sentenceItems = notebookDetail.sentences || [];

        // 根据格式生成内容
        let vocabContent = '';
        let sentenceContent = '';

        if (format === 'vocab' || format === 'all') {
            vocabItems.forEach((item, index) => {
                vocabContent += `${index + 1}. ${item.word || ''}`;
                if (item.phonetic) vocabContent += ` /${item.phonetic}/`;
                vocabContent += `\n`;
                vocabContent += `   释义：${item.meaning || ''}\n`;
                if (item.examples && item.examples.length > 0) {
                    vocabContent += `   例句：${item.examples[0].en || ''}\n`;
                    vocabContent += `         ${item.examples[0].cn || ''}\n`;
                }
                if (item.collocations && item.collocations.length > 0) {
                    vocabContent += `   搭配：${item.collocations.join('、')}\n`;
                }
                vocabContent += `   来源：第${item.episode}期 · ${item.title || ''}\n`;
                vocabContent += '\n';
            });
        }

        if (format === 'sentence' || format === 'all') {
            sentenceItems.forEach((item, index) => {
                sentenceContent += `${index + 1}. ${item.en || ''}\n`;
                sentenceContent += `   ${item.cn || ''}\n`;
                sentenceContent += `   来源：第${item.episode}期 · ${item.title || ''}\n`;
                sentenceContent += '\n';
            });
        }

        // 创建打印窗口
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('请允许弹出窗口以使用打印功能');
            return;
        }

        const formatLabel = format === 'vocab' ? '词汇' : format === 'sentence' ? '句子' : '全部内容';
        const itemCount = format === 'vocab' ? vocabItems.length : format === 'sentence' ? sentenceItems.length : vocabItems.length + sentenceItems.length;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${notebook.name} - ${formatLabel}</title>
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
                    .section {
                        margin-bottom: 30px;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #4F46E5;
                        margin-bottom: 15px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .content {
                        white-space: pre-wrap;
                        font-size: 14px;
                    }
                    @media print {
                        body { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${notebook.name}</h1>
                    <div class="meta">
                        ${formatLabel} · 共 ${itemCount} 项
                    </div>
                </div>
                ${(format === 'vocab' || format === 'all') && vocabItems.length > 0 ? `
                    <div class="section">
                        <div class="section-title">📚 词汇 (${vocabItems.length})</div>
                        <div class="content">${vocabContent}</div>
                    </div>
                ` : ''}
                ${(format === 'sentence' || format === 'all') && sentenceItems.length > 0 ? `
                    <div class="section">
                        <div class="section-title">💬 句子 (${sentenceItems.length})</div>
                        <div class="content">${sentenceContent}</div>
                    </div>
                ` : ''}
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


    if (!user) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <BookOpen className="w-10 h-10 text-violet-500" />
                        我的本子
                    </h1>
                </div>
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                    <BookOpen className="w-24 h-24 text-gray-300 mb-4" />
                    <p className="text-xl text-gray-500 mb-2">本子功能需要登录后使用</p>
                    <p className="text-gray-400 mb-6">登录后可以创建主题本子，整理你的收藏</p>
                    <Link
                        to="/login"
                        className="px-6 py-3 bg-violet-400 text-white rounded-lg hover:bg-violet-400 font-medium transition-colors"
                    >
                        去登录
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto fade-in">
            <div className="mb-6">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                    <BookOpen className="w-10 h-10 text-violet-500" />
                    我的本子
                </h1>
                <p className="text-gray-600">
                    {loading ? '正在加载...' : `共 ${notebooks.length} 个本子`}
                </p>
            </div>

            {summary && (
                <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
                    {renderTodaySummary(summary, notebooks)}
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-80 shrink-0">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-violet-400 text-white rounded-lg hover:bg-violet-400 font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        新建本子
                    </button>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400"></div>
                        </div>
                    ) : notebooks.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">还没有本子</p>
                            <p className="text-gray-400 text-sm">点击上方按钮创建第一个本子</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {notebooks.map(notebook => (
                                <LongPressWrapper
                                    key={notebook.id}
                                    data={notebook}
                                    type="notebook"
                                    onClick={() => handleSelectNotebook(notebook)}
                                    className={`group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${selectedNotebook?.id === notebook.id
                                        ? 'bg-violet-400 text-white shadow-md'
                                        : 'bg-white hover:bg-gray-50 shadow-sm'
                                        }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">{notebook.name}</span>
                                        </div>
                                        <div className={`text-sm mt-1 ${selectedNotebook?.id === notebook.id ? 'text-violet-200' : 'text-gray-400'}`}>
                                            {renderNotebookSubtitle(notebook)}
                                        </div>
                                    </div>
                                    <div className="flex items-center shrink-0 ml-2">
                                        {!isMobile && (
                                            <DropdownMenu
                                                trigger={
                                                    <button className={`p-2 rounded-lg transition-colors ${selectedNotebook?.id === notebook.id
                                                        ? 'hover:bg-violet-400 text-violet-100'
                                                        : 'hover:bg-gray-200 text-gray-400'
                                                        }`}>
                                                        <MoreHorizontal className="w-5 h-5" />
                                                    </button>
                                                }
                                                items={[
                                                    {
                                                        icon: Edit2,
                                                        label: '重命名',
                                                        onClick: () => setRenameModal({
                                                            isOpen: true,
                                                            notebook: notebook,
                                                            newName: notebook.name
                                                        })
                                                    },
                                                    {
                                                        icon: Trash2,
                                                        label: '删除本子',
                                                        danger: true,
                                                        onClick: () => setDeleteConfirm({ isOpen: true, type: 'notebook', data: notebook })
                                                    }
                                                ]}
                                            />
                                        )}
                                    </div>
                                </LongPressWrapper>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0" ref={detailRef}>
                    {!selectedNotebook ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                            <BookOpen className="w-20 h-20 text-gray-300 mb-4" />
                            <p className="text-gray-500">选择一个本子查看内容</p>
                        </div>
                    ) : detailLoading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-400"></div>
                        </div>
                    ) : notebookDetail ? (
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-6">

                                <h2 className="text-2xl font-bold text-gray-800">
                                    {notebookDetail.notebook.name}
                                </h2>
                                <button
                                    onClick={() => {
                                        setPrintNotebookId(selectedNotebook.id);
                                        setShowPrintDialog(true);
                                    }}
                                    className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                    title="打印本子"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() => handleTabChange('sentence')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'sentence'
                                        ? 'bg-violet-400 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    句子 ({notebookDetail.sentences.length})
                                </button>
                                <button
                                    onClick={() => handleTabChange('vocab')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'vocab'
                                        ? 'bg-violet-400 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <BookOpen className="w-4 h-4" />
                                    词汇 ({notebookDetail.vocabs.length})
                                </button>
                            </div>

                            {activeTab === 'sentence' && (
                                <>
                                    {notebookDetail.sentences.length > 0 && (
                                        <div className="text-sm text-gray-500 mb-2">
                                            {sentenceStatsLoading ? (
                                                <span>加载中...</span>
                                            ) : !sentenceStats.hasReviewState ? (
                                                <div>📚 这个本子里有 {notebookDetail.sentences.length} 个句子还没学过，开始第一轮学习吧~</div>
                                            ) : sentenceStats.dueCount > 0 ? (
                                                <>今日待复习：<span className="font-medium text-violet-500">{sentenceStats.dueCount}</span> / 共 {sentenceStats.totalSentenceCount} 个句子</>
                                            ) : (
                                                <div>🎉 今天没有待复习的句子（共 {sentenceStats.totalSentenceCount} 个）</div>
                                            )}
                                        </div>
                                    )}
                                    <div className="mb-4">
                                        <button
                                            onClick={() => navigate(`/notebooks/${selectedNotebook.id}/review?type=sentence`)}
                                            disabled={notebookDetail.sentences.length === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${notebookDetail.sentences.length > 0
                                                ? 'bg-violet-400 text-white hover:bg-violet-400'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <Play className="w-4 h-4" />
                                            {!sentenceStats.hasReviewState
                                                ? '开始第一轮学习'
                                                : sentenceStats.dueCount > 0
                                                    ? '开始句子复习'
                                                    : '随便练一练'
                                            }
                                        </button>
                                    </div>
                                    {notebookDetail.sentences.length > 0 ? (
                                        <div className="space-y-4">
                                            {notebookDetail.sentences.map((sentence) => (
                                                <LongPressWrapper
                                                    key={`${sentence.videoId}-${sentence.sentenceId}`}
                                                    data={sentence}
                                                    type="sentence"
                                                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="flex-1">
                                                            <p className="text-lg text-gray-800 font-medium mb-2 leading-relaxed">
                                                                {sentence.en}
                                                            </p>
                                                            <p className="text-gray-500 mb-3">
                                                                {sentence.cn}
                                                            </p>
                                                            <p className="text-sm text-gray-400">
                                                                第 {sentence.episode} 期 · {sentence.title}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2 shrink-0">
                                                            {!isMobile && (
                                                                <DropdownMenu
                                                                    items={[
                                                                        {
                                                                            label: '删除句子',
                                                                            danger: true,
                                                                            onClick: () => setDeleteConfirm({ isOpen: true, type: 'sentence', data: sentence })
                                                                        }
                                                                    ]}
                                                                />
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    const sid = sentence.sentenceId;
                                                                    let index = typeof sid === 'string' && sid.includes('-')
                                                                        ? parseInt(sid.split('-').pop(), 10)
                                                                        : parseInt(sid, 10);
                                                                    navigate(`/episode/${sentence.episode}?mode=intensive&type=sentence&index=${index}`);
                                                                }}
                                                                className="px-4 py-2 bg-violet-50 text-violet-500 rounded-lg hover:bg-violet-100 font-medium transition-colors text-sm"
                                                            >
                                                                去学习
                                                            </button>
                                                        </div>
                                                    </div>
                                                </LongPressWrapper>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500">本子里还没有句子</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'vocab' && (
                                <>
                                    {notebookDetail.vocabs.length > 0 && (
                                        <div className="text-sm text-gray-500 mb-2">
                                            {vocabStatsLoading ? (
                                                <span>加载中...</span>
                                            ) : !vocabStats.hasReviewState ? (
                                                <div>📚 这个本子里有 {notebookDetail.vocabs.length} 个词还没学过，开始第一轮学习吧~</div>
                                            ) : vocabStats.dueCount > 0 ? (
                                                <>今日待复习：<span className="font-medium text-violet-500">{vocabStats.dueCount}</span> / 共 {vocabStats.totalVocabCount} 个词</>
                                            ) : (
                                                <div>🎉 今天没有待复习的词（共 {vocabStats.totalVocabCount} 个）</div>
                                            )}
                                        </div>
                                    )}
                                    <div className="mb-4">
                                        <button
                                            onClick={() => navigate(`/notebooks/${selectedNotebook.id}/review?type=vocab`)}
                                            disabled={notebookDetail.vocabs.length === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${notebookDetail.vocabs.length > 0
                                                ? 'bg-violet-400 text-white hover:bg-violet-400'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <Play className="w-4 h-4" />
                                            {!vocabStats.hasReviewState
                                                ? '开始第一轮学习'
                                                : vocabStats.dueCount > 0
                                                    ? '开始词汇复习'
                                                    : '随便练一练'
                                            }
                                        </button>
                                    </div>
                                    {notebookDetail.vocabs.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {notebookDetail.vocabs.map((vocab) => (
                                                <LongPressWrapper
                                                    key={`${vocab.videoId}-${vocab.vocabId}`}
                                                    data={vocab}
                                                    type="vocab"
                                                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <span className="text-xl font-bold text-violet-500">
                                                                {vocab.word}
                                                            </span>
                                                            {vocab.phonetic && (
                                                                <span className="ml-2 text-sm text-gray-400 font-mono">
                                                                    /{vocab.phonetic}/
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1 shrink-0">
                                                            {!isMobile && (
                                                                <DropdownMenu
                                                                    items={[
                                                                        {
                                                                            label: '删除单词',
                                                                            danger: true,
                                                                            onClick: () => setDeleteConfirm({ isOpen: true, type: 'vocab', data: vocab })
                                                                        }
                                                                    ]}
                                                                />
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    const vid = vocab.vocabId;
                                                                    let index;
                                                                    if (typeof vid === 'string' && vid.includes('-vocab-')) {
                                                                        index = parseInt(vid.split('-vocab-').pop(), 10);
                                                                    } else if (typeof vid === 'string' && vid.includes('-')) {
                                                                        index = parseInt(vid.split('-').pop(), 10);
                                                                    } else {
                                                                        index = parseInt(vid, 10);
                                                                    }
                                                                    navigate(`/episode/${vocab.episode}?mode=intensive&type=vocab&index=${index}`);
                                                                }}
                                                                className="px-3 py-1 bg-violet-50 text-violet-500 rounded-lg hover:bg-violet-100 font-medium transition-colors text-sm"
                                                            >
                                                                去学习
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-gray-600 mb-3">
                                                        {vocab.meaning}
                                                    </p>
                                                    <p className="text-sm text-gray-400">
                                                        第 {vocab.episode} 期 · {vocab.title}
                                                    </p>
                                                </LongPressWrapper>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500">本子里还没有词汇</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">新建本子</h3>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewNotebookName('');
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="输入本子名称，如：厨房场景本"
                            value={newNotebookName}
                            onChange={(e) => setNewNotebookName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                            autoFocus
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewNotebookName('');
                                }}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreateNotebook}
                                disabled={!newNotebookName.trim() || creating}
                                className="flex-1 px-4 py-2 bg-violet-400 text-white rounded-lg hover:bg-violet-400 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {creating ? '创建中...' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={renameModal.isOpen}
                onClose={() => setRenameModal({ isOpen: false, notebook: null, newName: '' })}
                title="重命名本子"
                footer={
                    <>
                        <button
                            onClick={() => setRenameModal({ isOpen: false, notebook: null, newName: '' })}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleRenameNotebook}
                            disabled={renaming || !renameModal.newName.trim()}
                            className="px-4 py-2 bg-violet-400 text-white rounded-lg hover:bg-violet-400 font-medium transition-colors disabled:opacity-50"
                        >
                            {renaming ? '保存中...' : '确定'}
                        </button>
                    </>
                }
            >
                <input
                    type="text"
                    value={renameModal.newName}
                    onChange={e => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
                    placeholder="请输入新名称"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                    autoFocus
                    onKeyDown={e => {
                        if (e.key === 'Enter' && renameModal.newName.trim()) {
                            handleRenameNotebook();
                        }
                    }}
                />
            </Modal>

            <Modal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                title={
                    deleteConfirm.type === 'notebook' ? '删除本子' :
                        deleteConfirm.type === 'sentence' ? '删除句子' :
                            '删除单词'
                }
                footer={
                    <>
                        <button
                            onClick={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={executeDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                        >
                            确认删除
                        </button>
                    </>
                }
            >
                <p className="text-gray-600">
                    {deleteConfirm.type === 'notebook' && '确定要删除这个本子吗？本子里的句子和单词也会一并移除，但你的学习记录会保留。'}
                    {deleteConfirm.type === 'sentence' && '确定要把这条句子从本子里删除吗？'}
                    {deleteConfirm.type === 'vocab' && '确定要把这个单词从本子里删除吗？'}
                </p>
            </Modal>

            <BottomSheet
                isOpen={bottomSheet.isOpen}
                onClose={() => setBottomSheet(prev => ({ ...prev, isOpen: false }))}
                title={bottomSheet.title}
                actions={[
                    {
                        label: bottomSheet.type === 'notebook' ? '删除本子' :
                            bottomSheet.type === 'sentence' ? '删除句子' : '删除单词',
                        danger: true,
                        icon: Trash2,
                        onClick: () => {
                            setBottomSheet(prev => ({ ...prev, isOpen: false }));
                            setDeleteConfirm({
                                isOpen: true,
                                type: bottomSheet.type,
                                data: bottomSheet.data
                            });
                        }
                    }
                ]}
            />

            {/* Print Notebook Dialog */}
            {showPrintDialog && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-[200]"
                        onClick={() => setShowPrintDialog(false)}
                    />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">选择打印内容</h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => executePrintNotebook('all')}
                                className="w-full py-3 px-4 bg-violet-50 hover:bg-violet-100 text-violet-500 rounded-lg font-medium transition-colors text-left"
                            >
                                <div className="font-medium">全部内容</div>
                                <div className="text-sm text-violet-500 mt-0.5">词汇 + 句子</div>
                            </button>
                            <button
                                onClick={() => executePrintNotebook('vocab')}
                                className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg font-medium transition-colors text-left"
                            >
                                <div className="font-medium">仅词汇</div>
                                <div className="text-sm text-gray-500 mt-0.5">打印收藏的词汇</div>
                            </button>
                            <button
                                onClick={() => executePrintNotebook('sentence')}
                                className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg font-medium transition-colors text-left"
                            >
                                <div className="font-medium">仅句子</div>
                                <div className="text-sm text-gray-500 mt-0.5">打印收藏的句子</div>
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
            )}
        </div>
    );
}

export default Notebooks;