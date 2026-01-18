// 渲染进程脚本：显示运行平台
window.addEventListener('DOMContentLoaded', () => {
  if (!window.api) {
    console.error('Window API not found - preload script may have failed');
    // 显示错误信息给用户
    const platformName = document.getElementById('platformName');
    if (platformName) {
      platformName.textContent = 'API 加载失败';
      platformName.style.color = '#ff6b6b';
    }
    return;
  }

  if (window.api.log) {
    window.api.log.info('Renderer process started', { href: window.location.href });
  }

  const platformName = document.getElementById('platformName');
  if (platformName && window.api.platform) {
    platformName.textContent = window.api.platform;
    if (window.api.log) {
      window.api.log.debug(`Platform displayed: ${window.api.platform}`);
    }
  }
});
