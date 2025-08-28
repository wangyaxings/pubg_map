# .gitignore 文件说明

## 概述

本项目包含一个全面的 `.gitignore` 文件，用于忽略不需要版本控制的文件和目录。

## 主要忽略内容

### 🔧 开发环境文件
- **Node.js 依赖**: `node_modules/`, `package-lock.json`, `yarn.lock`
- **Go 构建文件**: `*.exe`, `*.test`, `go-build/`
- **Vite 缓存**: `.vite/`, `dist/`, `dist-ssr/`

### 🗄️ 数据库文件
- **SQLite 数据库**: `*.db`, `*.sqlite`, `*.sqlite3`, `zhouyi.db`
- **数据库备份**: `*.db.backup`, `*.sqlite.backup`

### 📁 项目特定文件
- **瓦片图片**: `frontend/public/erange/`, `frontend/public/tiles/`
- **大文件**: `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.bmp`, `*.tiff`

### 🔒 敏感信息
- **环境变量**: `.env`, `.env.local`, `.env.development`
- **API 密钥**: `secrets.json`, `api-keys.json`, `*.key`, `*.pem`

### 💻 系统文件
- **macOS**: `.DS_Store`, `._*`, `.Spotlight-V100`
- **Windows**: `Thumbs.db`, `Desktop.ini`, `$RECYCLE.BIN/`
- **Linux**: `*~`, `.directory`, `.Trash-*`

### 🛠️ IDE 文件
- **VSCode**: `.vscode/` (保留配置文件)
- **IntelliJ**: `.idea/`, `*.iml`, `*.ipr`
- **Vim**: `*.swp`, `*.swo`
- **Emacs**: `*~`, `\#*\#`, `*.elc`

### 📊 日志和缓存
- **日志文件**: `*.log`, `npm-debug.log*`, `yarn-debug.log*`
- **缓存目录**: `.cache/`, `.parcel-cache/`, `.eslintcache`

## 使用说明

### 1. 初始化 Git 仓库
```bash
git init
```

### 2. 添加 .gitignore 文件
```bash
# .gitignore 文件已经存在，无需额外操作
```

### 3. 检查忽略状态
```bash
# 查看哪些文件被忽略
git status --ignored

# 查看 .gitignore 规则
git check-ignore -v <文件名>
```

### 4. 强制添加被忽略的文件（谨慎使用）
```bash
# 如果确实需要添加被忽略的文件
git add -f <文件名>
```

## 注意事项

### ⚠️ 重要提醒
1. **数据库文件**: `zhouyi.db` 不会被提交，确保在部署时重新生成
2. **瓦片图片**: 大量图片文件不会被提交，需要单独部署
3. **环境配置**: 敏感信息不会被提交，需要手动配置

### 🔄 如果需要提交特定文件
如果某些被忽略的文件确实需要版本控制，可以：

1. **修改 .gitignore**: 在相应规则前添加 `!` 来取消忽略
2. **使用 git add -f**: 强制添加特定文件
3. **创建例外规则**: 在 .gitignore 末尾添加例外规则

### 📝 示例：添加例外规则
```gitignore
# 忽略所有 .png 文件
*.png

# 但保留特定的图片文件
!important-image.png
!logo.png
```

## 维护说明

### 🔧 更新 .gitignore
当项目添加新的技术栈或文件类型时，记得更新 `.gitignore` 文件：

1. 添加新的忽略规则
2. 测试规则是否生效
3. 更新此说明文档

### 📋 定期检查
建议定期运行以下命令检查是否有意外提交的文件：
```bash
git status --ignored
git ls-files --others --ignored --exclude-standard
```

## 相关链接

- [Git 官方文档 - .gitignore](https://git-scm.com/docs/gitignore)
- [GitHub .gitignore 模板](https://github.com/github/gitignore)
- [Node.js .gitignore 最佳实践](https://github.com/github/gitignore/blob/main/Node.gitignore)
- [Go .gitignore 最佳实践](https://github.com/github/gitignore/blob/main/Go.gitignore)
