const fs = require('fs');

// 读取文件
let content = fs.readFileSync('src/pages/VideoDetail.jsx', 'utf8');

// 1. 替换 import
content = content.replace(
    "import { mockVideos } from '../data/mockData';",
    "import { supabase } from '../lib/supabase';"
);

// 2. 添加 allVideos 状态
content = content.replace(
    'const [videoData, setVideoData] = useState(null);',
    'const [videoData, setVideoData] = useState(null);\n    const [allVideos, setAllVideos] = useState([]);'
);

// 3. 替换整个数据获取的 useEffect
const oldUseEffect = `    // 初始化数据
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
    }, [id]);`;

const newUseEffect = `    // 从 Supabase 获取当前视频数据
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
    }, []);`;

content = content.replace(oldUseEffect, newUseEffect);

// 4. 替换所有 mockVideos 引用为 allVideos
content = content.replace(/mockVideos\.findIndex/g, 'allVideos.findIndex');
content = content.replace(/mockVideos\[mockVideos\.findIndex/g, 'allVideos[allVideos.findIndex');
content = content.replace(/mockVideos\.length/g, 'allVideos.length');

// 5. 替换 videoUrl 为 video_url
content = content.replace('url={videoData.videoUrl}', 'url={videoData.video_url}');

// 保存文件
fs.writeFileSync('src/pages/VideoDetail.jsx', content, 'utf8');

console.log('✅ VideoDetail.jsx 修改成功！');
console.log('✅ 已添加 Supabase 数据获取逻辑');
console.log('✅ 已替换所有 mockVideos 引用');
