# Auto_trans2 项目

这是一个多语言自动翻译工具项目，包含前端界面和后端API服务。

## 项目结构

- **前端**：基于HTML、CSS和JavaScript的多语言翻译界面
- **后端**：基于Flask的翻译API，有两种部署选项：
  - Vercel平台部署（有60秒超时限制）
  - 阿里云函数计算部署（支持长达10分钟的处理时间）

## 后端API服务

### 功能概述

后端API服务提供了多语言翻译功能，支持以下特性：

1. **多语言翻译**：同时支持7种语言的翻译
   - 简体中文 (zh_CN)
   - 英语 (en_US)
   - 阿拉伯语 (AR)
   - 土耳其语 (TR)
   - 巴西葡萄牙语 (pt_BR)
   - 墨西哥西班牙语 (es_MX)
   - 繁体中文 (TC)

2. **基于说明的翻译指导**：通过提供说明字段，精确控制翻译结果
   - 支持指定单复数形式
   - 支持指定特定含义（如"太阳"vs"天数"）
   - 优先级机制确保说明被严格遵循

3. **多模型支持**：
   - Grok-3
   - Deepseek-V3

4. **版本跟踪**：
   - 响应中包含应用版本和提示模板版本
   - 方便追踪和调试

### API端点

#### 1. 健康检查
- **URL**: `/`
- **方法**: GET
- **返回**: 服务状态、版本信息等

#### 2. 翻译接口
- **URL**: `/translate`
- **方法**: POST
- **请求体**:
  ```json
  {
    "text": "要翻译的文本",
    "description": "翻译说明（指导翻译的方向）",
    "model": "grok/deepseek"
  }
  ```
- **返回**:
  ```json
  {
    "success": true,
    "data": {
      "translations": {
        "zh_CN": "...",
        "en_US": "...",
        "AR": "...",
        "TR": "...",
        "pt_BR": "...",
        "es_MX": "...",
        "TC": "..."
      },
      "model": "使用的模型",
      "process_time": 1.23,
      "app_version": "2.1-ENHANCED-PROMPT-1234567890",
      "prompt_version": "强化版-说明优先级提示模板"
    }
  }
  ```

### 核心文件

- **app.py**: 主应用逻辑，处理翻译请求
- **wsgi.py**: Vercel部署入口文件
- **vercel.json**: Vercel部署配置
- **requirements.txt**: 依赖管理

### 部署在Vercel上

1. **准备工作**:
   - 创建GitHub仓库并上传代码
   - 注册Vercel账号并连接GitHub

2. **配置Vercel项目**:
   - 导入GitHub仓库
   - 设置环境变量（API密钥等）
   - 选择Python运行时

3. **部署与更新**:
   - Vercel会自动监测GitHub仓库的变更
   - 每次提交后自动部署

### 部署在阿里云函数计算上

1. **准备工作**:
   - 创建阿里云账号并开通函数计算服务
   - 安装Serverless Devs工具：`npm install @serverless-devs/s -g`

2. **配置项目**:
   - 使用`translate.yaml`配置文件定义HTTP触发函数
   - 设置环境变量（GROK_API_KEY和DEEPSEEK_API_KEY）
   - 配置Python 3.10运行时环境

3. **部署流程**:
   ```bash
   s deploy -t ./translate.yaml
   ```

4. **优势**:
   - 支持长达10分钟（600秒）的处理时间，适合处理大量文本
   - 支持更高的内存分配（1024MB）
   - 更稳定的网络连接，不需要翻墙

5. **前端配置**:
   - 使用`config_aliyun.js`文件替代默认的`config.js`
   - 修改`main.js`中的导入语句：`import config from './config_aliyun.js';`

## 常见问题与解决方案

在开发和部署过程中，我们遇到了一些问题并找到了相应的解决方案：

### 1. Vercel配置冲突

**问题**: `vercel.json`中同时使用了`routes`和`headers/rewrites`等配置，导致部署失败。

```
Error: If `rewrites`, `redirects`, `headers`, `cleanUrls` or `trailingSlash` are used, then `routes` cannot be present.
```

**解决方案**: 移除`routes`配置，使用新的`rewrites`格式：

```json
{
    "rewrites": [
        { "source": "/static/(.*)", "destination": "/static/$1" },
        { "source": "/(.*)", "destination": "/wsgi.py" }
    ]
}
```

### 2. 只读文件系统错误

**问题**: Vercel的serverless环境使用只读文件系统，无法写入日志文件。

```
OSError: [Errno 30] Read-only file system: '/var/task/logs/wsgi.log'
```

**解决方案**: 修改日志配置，使用标准输出而不是文件：

```python
# 替换
file_handler = RotatingFileHandler(detailed_log_file, maxBytes=10*1024*1024, backupCount=5)

# 为
file_handler = logging.StreamHandler(sys.stdout)
```

### 3. Python依赖冲突

**问题**: 特定版本的依赖项之间存在冲突，导致部署失败。

```
ERROR: Cannot install -r /vercel/path0/requirements.txt (line 1) and jinja2==2.11.3 because these package versions have conflicting dependencies.
```

**解决方案**: 使用更灵活的版本范围，让pip自动解决依赖关系：

```
flask>=2.0.0,<2.3.0
flask-cors>=4.0.0
python-dotenv>=1.0.0
requests>=2.31.0
gunicorn>=20.0.0
```

### 4. Git与Vercel同步问题

**问题**: 修改后的代码未在Vercel上正确部署。

**解决方案**:
- 确保所有修改都已提交并推送到正确的分支
- 使用`git add`、`git commit`和`git push`命令确保代码同步
- 在Vercel控制台手动触发新的部署
- 使用`vercel deploy --prod --force`强制重新部署

### 5. 文件编码问题

**问题**: 中文字符在文件中显示为乱码，导致功能异常。

**解决方案**:
- 确保所有包含中文的文件使用UTF-8编码保存
- 重新创建文件并粘贴内容，确保编码正确
- 使用`StreamHandler`而非`FileHandler`避免编码问题

## API使用示例

### Python 示例

```python
import requests
import json

url = "https://auto-trans2-backend.vercel.app/translate"

payload = {
    "text": "日",
    "description": "表示太阳，单数",
    "model": "grok"
}

headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, headers=headers, json=payload)
result = response.json()

print(json.dumps(result, indent=2, ensure_ascii=False))
```

### JavaScript 示例

```javascript
async function translate() {
  const response = await fetch("https://auto-trans2-backend.vercel.app/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: "日",
      description: "表示太阳，单数",
      model: "grok"
    }),
  });
  
  const data = await response.json();
  console.log(data);
}

translate();
```

## 更新日志

### 2024-04-17
- 添加版本标识功能，方便追踪部署状态
- 增强翻译提示模板，提高翻译准确性
- 修复Vercel部署问题
- 优化日志系统，适应serverless环境

### 2024-04-15
- 添加翻译进度显示功能
- 添加取消翻译功能
- 添加当前模型显示功能
- 优化用户界面交互

## 未来计划

1. 添加更多AI模型支持
2. 优化翻译质量
3. 添加翻译历史记录
4. 支持更多语言
5. 添加自定义提示模板功能

## Git 操作指南

由于本项目使用 GitHub Desktop 内置的 Git，所以需要使用完整的 Git 路径。以下是标准操作流程：

### 1. Git 环境设置

Git 可执行文件的标准路径：
```
C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe
```

为了方便使用，建议将此路径设置为环境变量或创建别名。

### 2. 标准 Git 操作流程

#### 2.1 查看当前状态
```powershell
C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe status
```

#### 2.2 添加更改
```powershell
# 添加单个文件
C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe add [文件路径]

# 添加所有更改
C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe add .
```

#### 2.3 提交更改
```powershell
# 使用单引号来避免中文字符的问题
C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe commit -m '提交说明'
```

#### 2.4 推送到远程仓库
```powershell
C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe push origin [分支名]
```

#### 2.5 标签管理
```powershell
# 创建标签
C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe tag [标签名]

# 推送标签
C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe push origin [标签名]
```

### 3. 注意事项

1. 提交中文说明时使用单引号而不是双引号，避免字符编码问题
2. 每次操作前先用 `status` 命令检查仓库状态
3. 提交前确保已经添加(`add`)所有需要的文件
4. 推送前确保本地提交已完成
5. 如果遇到 PowerShell 控制台报错，可以尝试使用 `cmd /c` 前缀来执行命令

### 4. 常见问题解决

1. 如果提交时出现编码问题，尝试：
   ```powershell
   cmd /c "C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe commit -m '提交说明'"
   ```

2. 如果需要取消最后一次提交：
   ```powershell
   C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe reset HEAD~1
   ```

3. 如果需要切换分支：
   ```powershell
   C:\Users\[用户名]\AppData\Local\GitHubDesktop\app-[版本号]\resources\app\git\cmd\git.exe checkout [分支名]
   ```

记住：在执行任何 Git 操作之前，都建议先使用 `status` 命令检查当前状态，这样可以避免很多潜在的问题。

## 自动翻译机

一个支持多语言批量翻译的智能工具，使用先进的AI模型进行翻译。

## 功能特点

1. **多语言支持**
   - 支持简体中文、英语、阿拉伯语、土耳其语、巴西葡萄牙语、墨西哥西班牙语、繁体中文
   - 可切换语言显示顺序（正常/后台模式）

2. **批量翻译**
   - 支持多行文本同时翻译
   - 自动分批处理长文本
   - 实时显示翻译进度

3. **智能模型选择**
   - 支持 Deepseek-V3 和 Grok-3 模型
   - 翻译过程中显示当前使用的模型
   - 可随时切换模型

4. **用户友好的界面**
   - 玻璃态设计风格
   - 实时进度显示
   - 支持取消翻译操作
   - 复制翻译结果
   - 清空所有内容

## 使用方法

1. **输入文本**
   - 在左侧输入区域添加需要翻译的文本
   - 每行可以添加说明信息
   - 支持粘贴多行文本

2. **选择模型**
   - 从下拉菜单选择要使用的AI模型
   - 当前支持 Deepseek-V3 和 Grok-3

3. **开始翻译**
   - 点击"开始翻译"按钮
   - 查看实时翻译进度
   - 可以随时点击"取消翻译"按钮停止翻译

4. **查看结果**
   - 翻译结果会显示在右侧表格中
   - 可以切换语言显示顺序
   - 支持复制单个单元格或全部结果

## 技术特点

1. **分批处理机制**
   - 自动将长文本分成多个批次
   - 每批次限制字符数，确保翻译质量
   - 实时显示处理进度

2. **进度显示**
   - 显示总体翻译进度
   - 显示当前使用的模型
   - 支持取消操作

3. **错误处理**
   - 自动处理翻译错误
   - 显示友好的错误提示
   - 支持重试操作

## 界面说明

1. **输入区域**
   - 说明列：可添加翻译场景说明
   - 原文列：输入需要翻译的文本
   - 操作列：删除行按钮

2. **结果区域**
   - 多语言列：显示翻译结果
   - 排序切换：切换语言显示顺序
   - 操作按钮：复制结果、清空内容

3. **进度显示**
   - 加载动画：表示正在处理
   - 进度条：显示总体进度
   - 模型信息：显示当前使用的模型
   - 取消按钮：停止翻译操作

## 注意事项

1. 确保网络连接稳定
2. 长文本会自动分批处理
3. 可以随时取消翻译操作
4. 翻译结果会自动保存到表格中

## 项目启动方式

1. **通过 Python 启动（推荐）**：
   - 打开终端（命令提示符或 PowerShell）
   - 进入项目根目录
   - 运行命令：`python -m http.server 8000`
   - 在浏览器中访问：`http://localhost:8000`

2. **直接打开**：
   - 在文件管理器中找到项目根目录
   - 双击 `index.html` 文件
   - 使用浏览器打开（推荐使用 Chrome 浏览器）

## 技术栈

- 前端：HTML5, CSS3, JavaScript, Bootstrap 5
- AI模型：Grok 3
- 设计风格：Glass Morphism (玻璃态设计)

## 开发环境要求

- 操作系统：Windows 11
- 浏览器：Chrome 135.0.7049.85 或更高版本
- Python 3.x（用于启动本地服务器） 