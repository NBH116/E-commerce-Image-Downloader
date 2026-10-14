# 电商图片提取下载

Chrome Manifest V3 扩展：在淘宝、京东、拼多多商品详情页提取商品图，于新标签页勾选后下载为 PNG。

仓库还包含静态展示页 [`website/index.html`](website/index.html)。

## 安装

1. 打开 Chrome，访问 `chrome://extensions`。
2. 打开右上角 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择本仓库中的 `extension` 目录。
4. 打开任一支持平台的 **商品详情页**（不是首页或搜索页）。
5. 页面右下角出现「获取图片」后点击，会打开图库标签页。
6. 全选 / 反选 / 勾选单张，再点「下载选中」。文件名为 `商品图_001.png` 起，保存到浏览器默认下载目录。

## 支持的详情页

- 淘宝 / 天猫：`item.htm` 且带商品 `id`
- 京东：`item.jd.com/*.html`、`item.m.jd.com/product/`
- 拼多多：`goods.html` 且带 `goods_id`（`pinduoduo.com` / `yangkeduo.com`）

## 本地自测（不加载扩展）

用浏览器打开：

- `tests/mock-product.html`：检查提取过滤（页面底部报告应为 PASS）
- `extension/gallery.html`：点「载入布局预览」核对网格与工具栏
- `website/index.html`：展示官网

完整下载链路需要在 Chrome 中加载扩展，并在真实详情页操作（登录态、反爬、懒加载滚动无法在此仓库内模拟）。

## 使用注意

请只整理你有权使用的商品图，并遵守各电商平台规则。
