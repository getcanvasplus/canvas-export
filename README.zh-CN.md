# canvas-export

**在浏览器里从 Canvas 导出东西**，包含两个没有任何依赖的小工具：

- **`ics`**：把 Canvas 的截止时间和考试导出成 `.ics` 日历文件（Google 日历、Apple 日历、Outlook 都能导入），或者生成"添加到 Google 日历"链接。
- **`zip`**：在浏览器里把很多文件（比如一整门课的课件）直接打包成一个 `.zip`。

它们是 [Canvas+](https://getcanvasplus.com) 里负责导出的代码。Canvas+ 是一个帮学生用好 Canvas 的 Chrome 插件。

[English](README.md)

## 安装

```bash
npm install canvas-export        # 或者直接把 index.js 复制到项目里
```

```js
const { ics, zip } = require('canvas-export');
```

浏览器里用 `<script src="index.js">` 引入后，可以通过 `window.CanvasExport` 访问。

## 日历（.ics）

```js
const text = ics.build(deadlines, { domain: 'canvas.example.edu', lang: 'zh' });
```

- 每个截止时间会变成一个 30 分钟的日程，结束时间就是截止时间。截止前 1 天和前 2 小时各提醒一次。
- 可以用 `prodId`、`calName`、`footer` 自定义日历名称，以及每条描述最后一行显示的文字（例如"由 我的应用 导出"）。
- 符合 RFC 5545 规范：文字会正确转义；超过 75 字节的行会自动折行，而且不会把中文字切成两半。
- `ics.fromExams()` 可以把考试列表转成日程，`ics.googleUrl()` 可以生成"添加到 Google 日历"链接。

## 在浏览器里打包 zip

```js
const blob = zip.build([{ name: '第一周/讲义.pdf', data: uint8Array }, { name: '第二周/笔记.pdf', data: someBlob, crc }]);
```

- **只打包、不压缩**：PDF、PPT、Word 本身已经是压缩过的，再压一遍几乎省不了空间，还很慢。
- **大文件不会在内存里复制一份**：直接传 Blob，同时传它的 CRC-32 就行。CRC-32 可以在下载时用 `zip.crc32(数据块, 上一次的结果)` 分块算出来。
- **中文文件名不乱码**：文件名用 UTF-8 存储。
- **只支持经典 zip 格式**：最多 65,535 个文件，总大小不到 4 GB。超过会抛出 `zip_too_many` 或 `zip_too_big`。

`examples/` 里有可以直接运行的日历脚本，还有一个打开就能用的浏览器打包页面。

## 许可证

MIT © Baowen Liu。MIT 只适用于代码本身，**Canvas+** / **Canvas Plus** 的名称和 logo 不在授权范围内。

Canvas 是 Instructure, Inc. 的商标。本项目是独立项目，与 Instructure 无关，也未获其认可。
