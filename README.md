# 叶读 · Leaf Reader

React + TypeScript + Vite + Capacitor 的 Android 英文阅读器。业务代码都在 `src/`，不需要编写 Kotlin / Java。

## 开始开发

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
```

打开终端输出的本地地址。修改 `src/` 后浏览器自动刷新；网页预览与 Android 使用同一套界面和阅读逻辑。

```sh
npm test
npm run build
```

## Android

本机已在项目 `.tools/` 中配置 JDK 21、Android SDK 36 和 Build Tools 35/36，可以直接运行：

```sh
npm run android:build
```

输出为 `artifacts/leaf-reader-debug.apk`。首版调试包已通过构建和签名校验，支持 Android 7.0（API 24）及以上，需可用的现代 Android System WebView。系统朗读和原生文件选择仍待安卓真机验收。

如果换到另一台电脑，可使用 Android Studio 配置构建环境：

安装 Android Studio 2025.2.1 或更新版本及对应 Android SDK（Capacitor 8）。首次打开时跟随提示下载 SDK；Android Studio 自带 JDK，不需要自己写原生代码。

```sh
npm run android:sync
npm run android:open
```

在 Android Studio 中选择连接的手机，点击 Run。开发者选项里需启用 USB 调试。

生成测试 APK：Android Studio 的 Build 菜单中选择 Generate App Bundles or APKs > Generate APKs。调试包通常在 `android/app/build/outputs/apk/debug/app-debug.apk`。正式发行需要自己的签名和平台资料。

vivo 草稿使用的正式签名安装包为 `artifacts/leaf-reader-vivo-release.apk`。签名密钥及口令存放在项目的 `.release/` 目录（已排除出 Git），以后更新同一应用需要继续使用该签名；请妥善备份此目录，不要公开或发送给他人。

若已安装项目内的可选构建工具，也可运行 `bash scripts/build-android.sh`。工具在 `.tools/`，不会修改系统 Java 或 Android SDK。首次 SDK 安装由 Android 官方工具提示确认许可。

## 首版功能

- 书架：十本内置英文原版全文；搜索；正在阅读 / 本地导入筛选。
- 导入：15 MB 以内 TXT、无 DRM 的文字 EPUB；SHA-256 去重；仅存本机 IndexedDB。
- 阅读：目录、分页、字号、三种背景、自动恢复阅读位置。
- 查词：ECDICT 常用词和内置书籍词汇子集；常见词形还原；本地单词收藏。
- 听书：Android 原生系统 TTS 插件，由 TypeScript 调用；要求已安装离线英文语音；音色选择与试听、语速、暂停 / 继续、翻页、连续朗读、定时停止。
- 数据：没有账号、后台、云同步、广告 SDK 或收费 API，当前运行不产生云账单。

## 已知边界

- **首版仅支持前台朗读。** 切后台 / 锁屏会暂停，不宣称后台播放；后台连续播放和锁屏控制需要媒体前台服务与真机验证。
- 浏览器朗读取决于电脑的语音服务；Android 会主动检查离线英文声音，并在缺少语音包时提示安装。
- 音色不再直接选择英文列表的第一项：会过滤 Albert、Bahh、Bells 等已知旧式或特效音色，优先常规英文音色及系统提供的增强版。默认选择和你的手动选择都会体现在播放器；手动音色按稳定 ID 保存在本机。美式、英式等按所选声音的语言播放。
- 点击听书页的音色卡片即可切换或试听；安装新的系统英文音色后，点击“刷新音色”。短段落连续朗读，减少逐句重新启动造成的停顿。系统 TTS 的音质仍取决于设备和语音包，不宣称达到真人有声书的水平。
- 暂停在当前语音分段处恢复，可能重读这一小段；不是逐词精准断点。
- EPUB 会提取正文，保留章节顺序，不保留原书的全部排版、插图、表格；不支持 PDF、扫描件、DRM 和超大文件。
- 离线词典显示基础释义，不提供整句翻译和上下文 AI 解释；词库未收录时会明确提示。
- 本地数据会随卸载 App / 清除应用数据移除，请保留书籍原文件。网页端清除站点数据也会移除导入书籍。
- 没有接入真实广告；需要选定发行市场、广告联盟，完成准入与隐私适配后再接，不能直接使用微信小程序流量主来变现 APK。

## 文件结构

```text
src/App.tsx               页面与交互
src/styles.css            响应式界面与阅读主题
src/lib/books.ts          TXT / EPUB 解析、导入与本地存储
src/lib/dictionary.ts     离线查词、词形还原
src/lib/speech.ts         Android 系统朗读、浏览器预览朗读
public/books/             十本完整原文、目录与来源校验信息
public/data/              离线词典与来源
public/licenses/          第三方许可证
android/                  Capacitor 自动生成的 Android 容器
```

## 内容和许可

内置：Alice’s Adventures in Wonderland、Pride and Prejudice、The Adventures of Sherlock Holmes、Frankenstein、The Time Machine、The Secret Garden、Treasure Island、The Wonderful Wizard of Oz、The Adventures of Tom Sawyer、Moby Dick。

原文来自 [Project Gutenberg](https://www.gutenberg.org/)，原始 TXT 保留完整许可声明。每本的来源链接、SHA-256 和文件大小保存在 `public/books/sources.json`。这是本地开发验证版本；正式发行时需按目标地区核实各书具体版本（含插图、封面、整理内容）和发行资质，不能把美国公版标识视作全球授权。

词典来源：[ECDICT](https://github.com/skywind3000/ECDICT)，MIT 许可。使用常用词及内置书籍词汇筛选子集，原始许可在 `public/licenses/ECDICT-MIT.txt`。封面为本项目自行编写的 SVG / CSS 设计。

刷新书籍与词典资源（仅维护时需要，运行 App 不需要）：

```sh
python3 scripts/fetch-content.py
```

## 后续优先级

1. Android 真机检查文件导入、英文语音包、返回键和数据恢复。
2. 生词本专用页面、阅读位置与听书位置互相同步的精细优化。
3. 媒体前台服务、锁屏控制、音频焦点与耳机事件。
4. 在确认发行平台后接入广告，并评估广告对阅读留存的影响。

## 本次验证

- 18 项自动化测试通过，覆盖完整书籍校验、离线词典数据、分页、词形处理、语音分段、EPUB 正文提取和加密书拒绝，以及特效音色过滤、指定音色与口音、异步音色初始化、取消后不误启动音频。
- 浏览器验证：TXT / EPUB 导入、目录与正文、刷新后的导入数据保留、阅读进度恢复、选词查词、单词收藏、字号和主题保存、播放器按钮与语速 / 定时选项。
- 界面检查：390 × 844 手机视口和 1280 × 900 桌面视口。
- Android：Gradle 调试构建、APK v2 签名验证、包内十本完整原文 / 43,009 条词典 / 最新前端构建一致性检查。
- 具体校验记录和 APK SHA-256 位于 `artifacts/verification.json`。未连接安卓真机，不把浏览器测试视为原生文件选择或系统语音的真机验收。

## 0.1.1 听书改进

- 默认推荐正常的英文朗读音色；本机浏览器验证显示 Samantha（美式）、Daniel（英式）、Karen、Moira、Tessa、Rishi 共 6 个可选声音。其他设备的列表以实际安装情况为准。
- 新增同一句英文试听、停止试听、口音显示、音色持久化和刷新音色。
- 朗读分段合并短句，并忽略原文中的下划线强调标记、插图占位符。
- 继续使用离线系统语音，没有新增云服务和语音 API 费用。
