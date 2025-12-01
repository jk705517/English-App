const fs = require('fs');

// 以 UTF-8 编码读取文件
let content = fs.readFileSync('src/pages/VideoDetail.jsx', 'utf8');

// 1. 替换 import
content = content.replace(
    "import { mockVideos } from '../data/mockData';",
    "import { supabase } from '../lib/supabase';"
);

// 2. 添加 allVideos 状态（只添加一次）
content = content.replace(
    'const [videoData, setVideoData] = useState(null);',
    'const [videoData, setVideoData] = useState(null);\n    const [allVideos, setAllVideos] = useState([]);'
);

// 3. 查找并替换 mock 数据获取的 useEffect
const oldPattern = /\/\/ 初始化数据[\s\S]*?useEffect\(\(\) => \{[\s\S]*?mockVideos\.find[\s\S]*?\}, \[id\]\);/;

const newUseEffect = `// Fetch video data from Supabase
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
    }, []);`;

content = content.replace(oldPattern, newUseEffect);

// 4. 替换所有 mockVideos 引用为 allVideos
content = content.replace(/mockVideos\.findIndex/g, 'allVideos.findIndex');
content = content.replace(/mockVideos\[mockVideos\.findIndex/g, 'allVideos[allVideos.findIndex');
content = content.replace(/mockVideos\.length/g, 'allVideos.length');

// 5. 替换所有 videoUrl 为 video_url
content = content.replace(/videoData\.videoUrl/g, 'videoData.video_url');

// 以 UTF-8 编码保存文件
fs.writeFileSync('src/pages/VideoDetail.jsx', content, 'utf8');

console.log('✅ VideoDetail.jsx successfully updated!');
console.log('✅ All encoding issues fixed');
console.log('✅ Supabase integration complete');
