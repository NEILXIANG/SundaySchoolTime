// 渲染进程脚本：显示运行平台
window.addEventListener('DOMContentLoaded', () => {
  if (window.api) {
    if (window.api.log) {
      window.api.log.info('Renderer process started', { href: window.location.href });
    }

    const platformName = document.getElementById('platformName');
    if (platformName) {
      platformName.textContent = window.api.platform;
      if (window.api.log) {
        window.api.log.debug(`Platform displayed: ${window.api.platform}`);
      }
    }
  } else {
    console.error('Window API not found');
  }
});
