# ZLSQ 自律神器 (React 版)

这是一个基于 React + TypeScript + MobX 的自律神器 (ZLSQ) 原型移植项目。

## 快速开始

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **启动开发服务器**:
   ```bash
   npm run dev
   ```

## 打包与部署

### 1. 生成部署包
运行以下命令构建项目并生成压缩包：
```bash
npm run package
```
此命令会执行构建，并在根目录下生成一个 `build.zip` 文件（包含 `dist` 目录内容）。

### 2. 上传到 AWS S3 找陆总
1.  访问 AWS S3 控制台 (**需要翻墙**):
    [AWS S3 Console - zlsq folder](https://ap-southeast-2.console.aws.amazon.com/s3/buckets/usor-static-website?region=ap-southeast-2&prefix=zlsq/&showversions=false)
2.  将 `build.zip` 解压，把 `dist` 文件夹内的**所有文件**（index.html, assets 文件夹等）直接上传到该 S3 目录中。
    *注意：请确保 `index.html` 位于 `zlsq/` 目录下，而不是 `zlsq/dist/`。*

### 3. 访问网站
上传完成后，可以通过以下链接访问：
[https://usor-static-website.s3.ap-southeast-2.amazonaws.com/zlsq/index.html](https://usor-static-website.s3.ap-southeast-2.amazonaws.com/zlsq/index.html)

## 功能特性

- **堡垒模式 (Fortress Mode)**: 严格的定时锁定，包含21天挑战。
- **普通模式 (Normal Mode)**: 定时锁定，但可通过密码解锁。
- **密码模式 (Password Mode)**: 无倒计时锁定，仅需密码解锁。
- **无限模式 (Infinite Mode)**: 正向计时锁定，直到手动结束（含延时确认）。
- **调试面板 (Debug Panel)**: 用于测试的额外控制（减少时间、强制解锁、模拟盖子开合等）。

## 项目结构

- `src/store/TimerStore.ts`: 核心逻辑与状态管理 (MobX)。
- `src/components/Display.tsx`: LCD 屏幕组件。
- `src/components/Controls.tsx`: 物理按键组件。
- `src/App.tsx`: 主布局文件。
