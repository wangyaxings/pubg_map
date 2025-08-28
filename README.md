# 周易六十四卦地图标注系统

这是一个前后端分离的周易六十四卦地图标注系统，使用Go作为后端，Vite + JavaScript作为前端。

## 项目结构

```
zhouyi-map-project/
├── backend/           # Go后端
│   ├── main.go       # 主程序
│   └── go.mod        # Go模块文件
├── frontend/          # 前端
│   ├── src/
│   │   └── main.js   # 主JavaScript文件
│   ├── index.html    # HTML文件
│   ├── package.json  # 前端依赖
│   └── vite.config.js # Vite配置
└── README.md         # 项目说明
```

## 功能特性

- 🗺️ 基于Leaflet的瓦片地图系统
- 📍 64个周易卦象标记点
- 📖 完整的周易数据展示（卦辞、彖辞、大象辞、爻辞等）
- 🎯 拖拽调整标记点位置（相对位置保持不变）
- 📋 按正确顺序显示爻辞（初、二、三、四、五、上）
- 🚫 过滤掉仅包含"六"或"九"的爻辞
- 🖼️ 支持为每个标记点上传图片
- 💾 保存/加载坐标数据
- 📱 响应式设计

## 数据来源

系统使用`zhouyi.py`生成的SQLite数据库，包含：
- 64个卦象的基本信息
- 卦辞、彖辞、大象辞及其译文和辨证
- 每个卦象的6个爻辞及其小象辞
- 内外卦信息

## 地图系统

使用Erangel地图瓦片系统：
- 瓦片大小：256x256像素
- 地图尺寸：8192x8192像素
- 最大缩放级别：3
- 瓦片格式：PNG

## 安装和运行

### 前置要求

1. 确保已运行`zhouyi.py`生成`zhouyi.db`数据库文件
2. 安装Go 1.21+
3. 安装Node.js 16+

### 快速启动（推荐）

#### Windows
```bash
# 双击运行或命令行执行
start.bat
```

#### Linux/Mac
```bash
# 给脚本执行权限
chmod +x start.sh
# 运行脚本
./start.sh
```

### 手动启动

#### 后端启动

```bash
cd backend
go mod tidy
go run main.go
```

后端将在 `http://localhost:8080` 启动

#### 前端启动

```bash
cd frontend
yarn install
yarn dev
```

前端将在 `http://localhost:3000` 启动

### 测试API

确保后端正在运行，然后执行：

```bash
node test-api.js
```

### 测试瓦片地图

确保前端正在运行，然后执行：

```bash
node test-tiles.js
```

## API接口

### 获取所有标记点
```
GET /api/markers
```

### 获取卦象详情
```
GET /api/hexagrams/{id}
```

### 获取所有卦象
```
GET /api/hexagrams
```

### 上传图片
```
POST /api/upload-image
```

### 更新标记点
```
POST /api/markers
```

## 使用说明

1. **上传地图图片**：点击或拖拽图片到上传区域
2. **查看卦象信息**：点击标记点查看详细信息
3. **编辑模式**：点击"启用拖拽"按钮进入编辑模式
4. **保存数据**：点击"保存坐标"按钮保存当前布局
5. **上传点图片**：在卦象详情弹窗中点击"上传"按钮

## 技术栈

### 后端
- Go 1.21+
- Gin Web框架
- SQLite数据库
- CORS支持

### 前端
- Vite构建工具
- Leaflet地图库
- Axios HTTP客户端
- Font Awesome图标

## 开发说明

### 数据结构

参考`zhouyi.py`中的数据结构：

```go
type Hexagram struct {
    Number              int     `json:"number"`
    Name                string  `json:"name"`
    Symbol              string  `json:"symbol"`
    GuaCi               string  `json:"gua_ci"`
    GuaCiTranslation    string  `json:"gua_ci_translation"`
    GuaCiCommentary     string  `json:"gua_ci_commentary"`
    TuanCi              string  `json:"tuan_ci"`
    TuanCiTranslation   string  `json:"tuan_ci_translation"`
    TuanCiCommentary    string  `json:"tuan_ci_commentary"`
    DaXiangCi           string  `json:"da_xiang_ci"`
    DaXiangTranslation  string  `json:"da_xiang_translation"`
    DaXiangCommentary   string  `json:"da_xiang_commentary"`
    InnerTrigram        string  `json:"inner_trigram"`
    OuterTrigram        string  `json:"outer_trigram"`
    X                   float64 `json:"x"`
    Y                   float64 `json:"y"`
    Image               string  `json:"image,omitempty"`
}
```

### 自定义开发

1. **添加新的API接口**：在`backend/main.go`中添加新的路由
2. **修改前端样式**：编辑`frontend/index.html`中的CSS
3. **扩展功能**：在`frontend/src/main.js`中添加新的JavaScript功能

## 许可证

MIT License
