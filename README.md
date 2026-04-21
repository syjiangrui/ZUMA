# ZUMA

Zuma-style puzzle game — HTML5 Canvas + vanilla ES modules. Build tooling: Vite.

## 开发

```bash
npm install
npm run dev
```

打开 http://localhost:5173/ 进主游戏，
打开 http://localhost:5173/tools/path-editor/ 进路径编辑器。

## 构建

```bash
npm run build
npm run preview
```

产物输出到 `dist/`。主页面 `dist/index.html`，路径编辑器 `dist/tools/path-editor/index.html`。

> 默认 `vite.config.js` 里 `base: './'`，产物可直接放到任意子路径静态托管。
> 若部署到域名根路径且希望使用绝对资源 URL，改 `base: '/'`。

## 目录结构

```
src/               主游戏源码（ES modules）
  render/          渲染层（按职责拆分）
  config.js        常量
  main.js          游戏入口
  ...
public/            静态资源（按原路径暴露到站点根）
  level-paths.json 关卡路径数据
tools/
  path-editor/     贝塞尔路径编辑器（开发工具，不进产品）
docs/              设计文档
```

## 关卡数据

`public/level-paths.json` 由 `tools/path-editor/` 编辑。
主游戏启动时通过 `fetch('./level-paths.json')` 读取；若失败回落到 `src/levels.js` 中的硬编码默认值。
