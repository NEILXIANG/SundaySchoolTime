# 应用图标占位符

由于图标文件是二进制文件，需要设计师提供或使用在线工具生成。

## 所需图标文件

### macOS
- `icon.icns` - macOS 应用图标（512x512@2x）

### Windows
- `icon.ico` - Windows 应用图标（256x256）

### Linux
- `icon.png` - Linux 应用图标（512x512）

## 生成工具推荐

1. **在线工具**：
   - https://www.icoconverter.com/
   - https://cloudconvert.com/png-to-icns
   - https://convertio.co/png-ico/

2. **命令行工具**：
   ```bash
   # macOS
   brew install imagemagick
   
   # 生成 .icns
   mkdir icon.iconset
   sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
   sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
   sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
   sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
   sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
   sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
   sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
   sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
   sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
   sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
   iconutil -c icns icon.iconset
   ```

3. **electron-icon-builder**：
   ```bash
   npm install -g electron-icon-builder
   electron-icon-builder --input=./icon.png --output=./assets
   ```

## 图标设计规范

- **尺寸**：至少 512x512 像素（推荐 1024x1024）
- **格式**：PNG 透明背景
- **风格**：简洁、识别度高
- **颜色**：与应用主题一致

## 临时解决方案

在正式图标准备好之前，可以：
1. 使用 Electron 默认图标
2. 或临时注释 package.json 中的 icon 配置
