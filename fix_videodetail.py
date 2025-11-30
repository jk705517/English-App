# -*- coding: utf-8 -*-
import re

# 读取文件 - 使用 latin-1 避免编码错误
with open('src/pages/VideoDetail.jsx', 'r', encoding='latin-1') as f:
    content = f.read()

# 1. 替换 import
content = content.replace(
    "import { mockVideos } from '../data/mockData';",
    "import { supabase } from '../lib/supabase';"
)

# 2. 添加 allVideos 状态
content = content.replace(
    "const [videoData, setVideoData] = useState(null);",
    "const [videoData, setVideoData] = useState(null);\n    const [allVideos, setAllVideos] = useState([]);"
)

# 3. 替换数据获取的 useEffect
old_effect = """    // 初始化数据
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
    }, [id]);"""

new_effect = """    // 从 Supabase 获取当前视频数据
    useEffect(() => {
        const fetchVideoData = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('*')
                .eq('id', parseInt(id))
                .single();
            
            if (error) {
                console.error('Error fetching video:', error);
            } else {
                console.log('Video data loaded:', data);
                setVideoData(data);
            }
        };

        fetchVideoData();

        // 每次切换视频时，重新检查该视频的学习状态和收藏状态
        const learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        setIsLearned(learnedIds.includes(parseInt(id)));

        const favoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        setIsFavorite(favoriteIds.includes(parseInt(id)));
    }, [id]);

    // 获取所有视频用于上一期/下一期导航
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
    }, []);"""

content = content.replace(old_effect, new_effect)

# 4. 替换 mockVideos 为 allVideos
content = content.replace('mockVideos.findIndex', 'allVideos.findIndex')
content = content.replace('mockVideos[mockVideos.findIndex', 'allVideos[allVideos.findIndex')
content = content.replace('mockVideos.length', 'allVideos.length')

# 5. 替换 videoUrl 为 video_url
content = content.replace('url={videoData.videoUrl}', 'url={videoData.video_url}')

# 保存文件 - 使用 latin-1 保持原编码
with open('src/pages/VideoDetail.jsx', 'w', encoding='latin-1') as f:
    f.write(content)

print("✓ VideoDetail.jsx 修改成功！")
print("✓ 已添加 Supabase 数据获取逻辑")
print("✓ 已替换所有 mockVideos 引用")
