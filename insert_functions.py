# -*- coding: utf-8 -*-

# 读取文件
with open('src/pages/VideoDetail.jsx', 'r', encoding='latin-1') as f:
    lines = f.readlines()

# 找到包含 "fetchVideoData();" 的行
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # 如果找到 fetchVideoData(); 调用，在它之前插入函数定义
    if 'fetchVideoData();' in line and 'const fetchVideoData' not in lines[i-1] if i > 0 else True:
        # 获取缩进
        indent = len(line) - len(line.lstrip())
        spaces = ' ' * indent
        
        # 插入函数定义
        function_def = f"""{spaces}const fetchVideoData = async () => {{
{spaces}    const {{ data, error }} = await supabase
{spaces}        .from('videos')
{spaces}        .select('*')
{spaces}        .eq('id', parseInt(id))
{spaces}        .single();
{spaces}    
{spaces}    if (error) {{
{spaces}        console.error('Error fetching video:', error);
{spaces}    }} else {{
{spaces}        console.log('Video data loaded:', data);
{spaces}        setVideoData(data);
{spaces}    }}
{spaces}}};
{spaces}
"""
        new_lines.append(function_def)
    
    new_lines.append(line)
    i += 1

# 写回文件
with open('src/pages/VideoDetail.jsx', 'w', encoding='latin-1') as f:
    f.writelines(new_lines)

print("✓ 已添加 fetchVideoData 函数定义")

# 现在添加 fetchAllVideos
with open('src/pages/VideoDetail.jsx', 'r', encoding='latin-1') as f:
    content = f.read()

# 在第一个 useEffect 的 }, [id]); 后面添加第二个 useEffect
insert_point = content.find('}, [id]);', content.find('fetchVideoData'))
if insert_point != -1:
    # 找到下一行的开始
    next_line_start = content.find('\n', insert_point) + 1
    
    new_useeffect = """
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
"""
    
    content = content[:next_line_start] + new_useeffect + content[next_line_start:]
    
    with open('src/pages/VideoDetail.jsx', 'w', encoding='latin-1') as f:
        f.write(content)
    
    print("✓ 已添加 fetchAllVideos 函数定义")

print("\n✅ 所有修改完成！")
