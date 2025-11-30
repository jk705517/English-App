const fs = require('fs');

// 读取文件
let content = fs.readFileSync('src/pages/VideoDetail.jsx', 'utf8');

// 在 fetchVideoData(); 调用之前插入函数定义
// 找到 "useEffect(() => {" 后面紧跟 "fetchVideoData();" 的位置
const pattern = /(useEffect\(\(\) => \{\r?\n\s+)fetchVideoData\(\);/;

const replacement = `$1const fetchVideoData = async () => {
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

        fetchVideoData();`;

content = content.replace(pattern, replacement);

// 在 }, [id]); 后面添加第二个 useEffect
const pattern2 = /(\}, \[id\];\r?\n)(\r?\n\s+\/\/ 监听 mode)/;

const replacement2 = `$1
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
    }, []);
$2`;

content = content.replace(pattern2, replacement2);

// 保存文件
fs.writeFileSync('src/pages/VideoDetail.jsx', content, 'utf8');

console.log('✅ 已成功添加 fetchVideoData 和 fetchAllVideos 函数！');
