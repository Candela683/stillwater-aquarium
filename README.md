# Stillwater Aquarium · 静水鱼缸

一个可交互的 Three.js 水草缸：超白玻璃、持续水面涟漪、光线追踪折射、成群游动的霓虹灯鱼，以及由数学曲面生成的水草。黑色背景、木质底台，画面不显示控制面板或文字。

An interactive Three.js aquascape with ray-traced refraction, schooling neon tetras and procedural aquatic plants.

## 本地运行

需要 Node.js 22.12+，以及支持 WebGL 2 的浏览器。推荐在启用硬件加速的 Chrome / Edge 中打开。

```sh
npm ci
npm run dev
```

打开 <http://127.0.0.1:5179/>。

```sh
npm test        # 17 项几何、鱼群、交互和水面回归检查
npm run build  # 构建到 dist/
npm run preview
```

## 操作与导出

| 操作 | 效果 |
| --- | --- |
| 拖动 | 环绕观察 |
| 滚轮 / 双指缩放 | 拉近或拉远 |
| 点击鱼群附近 | 附近的鱼短暂逃离，然后重新归群；产生水面扰动 |
| `S` | 下载当前画面的 PNG 截图 |
| `R` | 录制并下载 24 秒、1920 × 1080 的自动镜头演示 |

录制只捕获鱼缸画布，没有桌面内容或麦克风。演示缓慢移动镜头，并在中段触发一次鱼群惊吓。浏览器支持时输出 MP4，否则输出 WebM；目标采样率为 30 fps，实际流畅度取决于 GPU 和渲染速度。录制结束后恢复原视角与窗口分辨率。

## 实现

- **水与玻璃**：基于 `three-mesh-bvh` 的三角形求交，反射 / 折射、菲涅耳与全内反射；64 × 64 高度场持续产生细小涟漪。鱼和草的变化会更新折射画面。
- **鱼群**：38 条灯鱼，随机分群、局部社交注意力、分离 / 对齐 / 聚合、预测避障、冲刺与滑行。鱼体保持直立，每条鱼有独立的身体游动相位；偶尔单独乱窜，也能被点击惊吓。
- **水草**：牛毛草前景、高低珍珠中景、弯曲茎秆的宝塔草后景。参数化叶面、随机叶形和大小、鹅黄绿到深绿的叶色；根部固定，仅在局部鱼尾流作用下轻微弯曲。
- **场景**：3 块深色纹理造景石、颗粒水草泥、玻璃上的实体 LED 支架，以及整块木质桌面。
- **性能取舍**：DPR 上限 2、阴影关闭、批量水草网格、96 帧鱼姿态缓存、休眠叶片和局部流场采样。

这是实时图形近似，并非完整流体或光谱渲染器。玻璃采用薄界面近似，反射中的鱼采用简化轮廓，透明鱼鳍使用 alpha cutout；植物是物种形态启发的程序化模型。

## 代码结构

```text
src/
  aquascape.js       场景与主循环
  ray-water.js       光线求交、玻璃和水面着色
  schooling.js      群游、分组、避障
  fish-darts.js     偶发冲刺与点击惊吓
  tetra-model.js    模型、姿态缓存和鱼体材质
  ambulia-plants.js 宝塔草曲线茎秆与轮生叶
  pearl-plants.js   高低珍珠的生长参数与叶面
  vegetation.js     水草布置与牛毛草
  leaf-flex.js      连续叶片弯曲
  capture.js        截图与画布视频导出
public/models/      灯鱼、石头和贴图（各有授权说明）
tests/              无需浏览器的回归检查
docs/media/         实际运行截图与演示视频
```

## 素材与许可

项目代码采用 MIT；第三方素材保持各自许可，不适用项目 MIT 的重新授权。

- [Evan Wallace — WebGL Water](https://madebyevan.com/webgl-water/)：MIT，提供水面算法与光学实现参考；当前场景是 Three.js 扩展实现。
- [AeroPlankton — Neon Tetra Automated Swimming Rig](https://sketchfab.com/3d-models/neon-tetra-automated-swimming-rig-22cddb626d9f417e9baec7894e86cb73)：CC BY 4.0，已调整轴向、缩放、游动形变与材质。
- [Jenelle van Heerden / Poly Haven — Rock 07](https://polyhaven.com/a/rock_07)：CC0，已简化几何、缩放并调整色调。

完整署名、许可范围和改动见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
