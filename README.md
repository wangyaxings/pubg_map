# 周易六十四卦地图标注系统

一个前后端分离的周易六十四卦地图标注系统：后端使用 Go（Gin + SQLite），前端使用 Vite + JavaScript（Leaflet）。

## 目录结构

```
zhouyi-map-project/
├─ backend/                       # Go 后端
│  ├─ main.go
│  ├─ go.mod / go.sum
│  └─ static/                     # 静态目录（tiles、uploads、打包后的前端）
├─ frontend/                      # 前端（Vite）
│  ├─ index.html
│  ├─ vite.config.js
│  └─ src/
├─ data/
│  ├─ zhouyi_map.db               # 唯一使用的 SQLite 数据库（统一路径）
│  └─ uploads/                    # 上传图片持久化目录
├─ docker-compose.yml
├─ Dockerfile
├─ start.bat
└─ README.md
```

## 数据库路径统一

为保证开发与生产环境一致，统一仅使用仓库根目录下的 `data/zhouyi_map.db`。

- 本地开发（backend 工作目录为 `backend/`）
  - 默认路径：`../data/zhouyi_map.db`
  - 可通过环境变量覆盖：`DB_PATH=绝对或相对路径`
- Docker/Docker Compose（容器内 backend 工作目录为 `/app/backend`）
  - 默认路径：`/app/data/zhouyi_map.db`（等价于相对的 `../data/zhouyi_map.db`）
  - 通过环境变量覆盖：`-e DB_PATH=/app/data/zhouyi_map.db`

说明：项目中其他历史路径（如 `zhouyi.db`、`/app/zhouyi.db` 等）均已废弃，不再使用。

## 运行方式

### 一、Windows 本地快速启动

```bat
start.bat
```

- 后端：`http://localhost:8080`
- 前端（开发服务器，base 为 `/static/`）：`http://localhost:3000/static/`

start.bat 已设置 `DB_PATH=..\data\zhouyi_map.db`，无需手动配置。

### 二、手动启动（开发模式）

1) 启动后端

```bash
cd backend
set DB_PATH=..\data\zhouyi_map.db  # Windows PowerShell/CMD
# 或 export DB_PATH=../data/zhouyi_map.db  # Linux/Mac
go run main.go
```

访问后端：`http://localhost:8080`

2) 启动前端（Vite）

```bash
cd frontend
yarn install
yarn dev
```

访问前端：`http://localhost:3000/static/`

说明：Vite 开发服务器通过代理将 `/api`、`/static/tiles`、`/static/uploads` 分发到后端。

### 三、Docker 单容器运行

1) 构建镜像

```bash
docker build -t zhouyi-map:latest .
```

2) 运行容器（挂载数据库与瓦片、上传目录）

```bash
docker run -d \
  --name zhouyi-map \
  -p 8080:8080 \
  -v /abs/path/zhouyi_map.db:/app/data/zhouyi_map.db \
  -v /abs/path/tiles:/app/backend/static/tiles:ro \
  -v /abs/path/uploads:/app/backend/static/uploads \
  -e TZ=Asia/Shanghai \
  zhouyi-map:latest
```

访问：`http://localhost:8080/`

可选环境变量：
- `DB_PATH`：后端在容器内的数据库路径，默认 `/app/data/zhouyi_map.db`。
- `STATIC_DIR`：后端静态目录，默认 `/app/backend/static`。

### 四、Docker Compose 运行（推荐）

```bash
docker compose up -d --build
```

访问：`http://localhost:3000/`

说明：Compose 将宿主机 `./data` 挂载到容器内 `/app/data`，确保 `./data/zhouyi_map.db` 存在即可。

## API（简要）

- `GET /api/hexagrams`：获取所有卦象
- `GET /api/hexagrams/{id}`：获取某一卦象详情（含爻辞）
- `GET /api/hexagrams/search?q=...`：搜索卦象
- `GET /api/markers`：获取用户标记
- `POST /api/markers`：新增标记
- `PUT /api/markers/{id}`：更新标记
- `DELETE /api/markers/{id}`：删除标记
- `POST /api/upload-image`：上传图片（保存到 `/static/uploads/`）

## 其他说明

- 底图瓦片放在 `backend/static/tiles`，生产环境由后端通过 `/static/tiles` 提供。
- 前端构建产物在容器内会复制到 `backend/static`，后端通过 `/`（入口）和 `/static`（资源）对外提供。
- 本地开发的 API 调用使用相对路径 `/api`，由 Vite 代理到后端，生产环境走同源。

本地（Windows）：
双击运行 start.bat，访问
后端: http://localhost:8080
前端（开发）: http://localhost:3000/static/

Docker（单容器）：
docker build -t zhouyi-map:latest .
docker run -d -p 8080:8080 -v /abs/path/zhouyi_map.db:/app/data/zhouyi_map.db zhouyi-map:latest
访问: http://localhost:8080/

Docker Compose：
docker compose up -d --build
访问: http://localhost:3000/
