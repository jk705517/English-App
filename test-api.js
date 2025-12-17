// 测试 BiuBiu API 的注册和登录功能

const BASE_URL = 'https://api.biubiuenglish.com';

// 测试注册
async function testRegister() {
  console.log('🧪 测试注册 API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test${Date.now()}@example.com`, // 使用时间戳避免重复
        password: '123456',
        nickname: '测试用户'
      })
    });
    
    const data = await response.json();
    console.log('✅ 注册结果:', data);
    
    if (data.success) {
      return data.data.token; // 返回 token 用于后续测试
    }
  } catch (error) {
    console.error('❌ 注册失败:', error);
  }
}

// 测试登录
async function testLogin(email, password) {
  console.log('\n🧪 测试登录 API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    console.log('✅ 登录结果:', data);
    return data.data?.token;
  } catch (error) {
    console.error('❌ 登录失败:', error);
  }
}

// 测试获取用户信息
async function testGetMe(token) {
  console.log('\n🧪 测试获取用户信息 API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    console.log('✅ 用户信息:', data);
  } catch (error) {
    console.error('❌ 获取用户信息失败:', error);
  }
}

// 运行所有测试
async function runTests() {
  const email = `test${Date.now()}@example.com`;
  const password = '123456';
  
  // 1. 测试注册
  const token1 = await testRegister();
  
  // 2. 测试登录
  const token2 = await testLogin(email, password);
  
  // 3. 测试获取用户信息
  if (token2) {
    await testGetMe(token2);
  }
}

runTests();