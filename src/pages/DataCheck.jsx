import { useState, useEffect } from 'react';
import { videoAPI } from '../services/api';

function DataCheck() {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await videoAPI.getAll();
                if (response.success && response.data) {
                    // Sort by episode descending
                    const sorted = [...response.data].sort((a, b) => b.episode - a.episode);
                    setVideos(sorted);
                } else {
                    setError('API 返回失败');
                }
            } catch (err) {
                setError(err.message);
            }
            setLoading(false);
        }
        fetchData();
    }, []);

    if (loading) return <div className="p-8">加载中...</div>;
    if (error) return <div className="p-8 text-red-600">错误: {error}</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">视频数据完整性检查</h1>
            <p className="mb-4">找到 {videos.length} 个视频</p>

            {videos.map(video => {
                const hasTranscript = video.transcript && Array.isArray(video.transcript) && video.transcript.length > 0;
                const hasVocab = video.vocab && Array.isArray(video.vocab) && video.vocab.length > 0;

                return (
                    <div key={video.id} className="border border-gray-300 rounded-lg p-6 mb-4 bg-white shadow-sm">
                        <h3 className="text-xl font-bold mb-4">
                            Episode {video.episode}: {video.title || '(无标题)'}
                        </h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <span className="font-semibold">ID:</span> {video.id ? '✓' : '✗'} {video.id}
                            </div>
                            <div>
                                <span className="font-semibold">Episode:</span> {video.episode ? '✓' : '✗'} {video.episode}
                            </div>
                            <div>
                                <span className="font-semibold">Title:</span> {video.title ? '✓' : '✗'} {video.title || '(空)'}
                            </div>
                            <div>
                                <span className="font-semibold">Video URL:</span> {video.video_url ? '✓' : '✗'} {video.video_url ? '有' : '(空)'}
                            </div>
                            <div>
                                <span className="font-semibold">Cover:</span> {video.cover ? '✓' : '✗'} {video.cover ? '有' : '(空)'}
                            </div>
                            <div>
                                <span className="font-semibold">Category:</span> {video.category ? '✓' : '✗'} {video.category || '(空)'}
                            </div>
                            <div>
                                <span className="font-semibold">Author:</span> {video.author ? '✓' : '✗'} {video.author || '(空)'}
                            </div>
                            <div>
                                <span className="font-semibold">Level:</span> {video.level ? '✓' : '✗'} {video.level || '(空)'}
                            </div>
                            <div>
                                <span className="font-semibold">Duration:</span> {video.duration ? '✓' : '✗'} {video.duration || '(空)'}
                            </div>
                        </div>

                        <div className="mb-3">
                            <span className="font-semibold">Transcript:</span> {hasTranscript ? `✓ (${video.transcript.length}条)` : '✗ (空)'}
                            {hasTranscript && (
                                <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-40">
                                    {JSON.stringify(video.transcript[0], null, 2)}
                                </pre>
                            )}
                        </div>

                        <div>
                            <span className="font-semibold">Vocab:</span> {hasVocab ? `✓ (${video.vocab.length}个)` : '✗ (空)'}
                            {hasVocab && (
                                <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-40">
                                    {JSON.stringify(video.vocab[0], null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default DataCheck;
