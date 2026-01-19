/**
 * 测试辅助函数
 */

/**
 * 清理 Electron 应用实例
 * @param {ElectronApplication} electronApp - Playwright Electron应用实例
 * @param {number} timeout - 超时时间(毫秒)
 */
async function cleanupElectronApp(electronApp, timeout = 10000) {
  if (!electronApp) return;
  
  try {
    // 检查进程是否已终止
    if (!electronApp.process().killed) {
      // 使用Promise.race实现超时控制
      await Promise.race([
        electronApp.close(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Close timeout')), timeout)
        )
      ]);
      console.log('✅ App closed gracefully');
    }
  } catch (error) {
    console.warn(`⚠️  Graceful close failed: ${error.message}`);
    
    // 强制终止进程
    try {
      electronApp.process().kill('SIGKILL');
      console.log('✅ Process force killed');
    } catch (killError) {
      console.error(`❌ Force kill failed: ${killError.message}`);
    }
  }
}

/**
 * 隐藏 Electron 窗口（减少测试时UI干扰）
 * @param {Page} window - Playwright窗口实例
 */
async function hideWindow(window) {
  try {
    await window.evaluate(() => {
      const win = window.electronAPI?.getCurrentWindow?.() || 
                  require('@electron/remote')?.getCurrentWindow();
      if (win) {
        win.hide();
        win.setPosition(-2000, -2000);
        win.minimize();
      }
    });
  } catch (error) {
    // 忽略错误，某些测试环境可能不支持
    console.warn('⚠️  Could not hide window:', error.message);
  }
}

/**
 * 获取隐藏窗口的启动配置
 * @param {string} appPath - 应用路径
 * @returns {object} Electron启动配置
 */
function getHeadlessLaunchConfig(appPath) {
  return {
    args: [
      appPath,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-position=-2000,-2000'
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HEADLESS: 'true'  // 自定义环境变量，main.js可响应
    }
  };
}

module.exports = {
  cleanupElectronApp,
  hideWindow,
  getHeadlessLaunchConfig
};
