# 直接在 useEffect 内部添加函数定义
$filePath = "src/pages/VideoDetail.jsx"
$content = Get-Content $filePath -Raw

# 找到 "useEffect(() => {" 后面紧跟 "fetchVideoData();" 的位置
# 在 fetchVideoData(); 之前插入函数定义

$pattern = "useEffect\(\(\) => \{\r?\n\s+fetchVideoData\(\);"
$replacement = @"
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
"@

$content = $content -replace $pattern, $replacement

# 在第一个 useEffect 之后添加第二个 useEffect 用于获取所有视频
# 找到 "}, [id]);" 的位置并在后面添加
$pattern2 = "\}, \[id\]\);\r?\n\r?\n\s+// 监听 mode"
$replacement2 = @"
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
    }, []);

    // 监听 mode
"@

$content = $content -replace $pattern2, $replacement2

Set-Content -Path $filePath -Value $content -NoNewline
Write-Host "Functions inserted successfully"
