// 从配置文件导入API配置
import config from './config.js';

// 语言顺序配置
const languageOrders = {
    normal: ['zh_CN', 'en_US', 'ar_AE', 'tr_TR', 'pt_BR', 'es_MX', 'zh_TW', 'fr_FR', 'id_ID', 'ms_MY'],
    backend: ['zh_CN', 'zh_TW', 'en_US', 'ar_AE', 'tr_TR', 'es_MX', 'pt_BR', 'fr_FR', 'id_ID', 'ms_MY']
};

// 添加字符限制常量
const MAX_CHARS_PER_BATCH = 300;

// DOM元素
document.addEventListener('DOMContentLoaded', () => {
    const inputTable = document.getElementById('inputTable');
    const resultTable = document.getElementById('resultTable');
    const addRowBtn = document.getElementById('addRow');
    const translateBtn = document.getElementById('translate');
    const loadingOverlay = document.querySelector('.loading-overlay');
    const copyAllResultsBtn = document.getElementById('copyAllResults');
    const clearAllBtn = document.getElementById('clearAll');
    const sortToggle = document.getElementById('sortToggle');
    const modelSelect = document.getElementById('modelSelect');
    const cancelTranslationBtn = document.getElementById('cancelTranslation');

    // 初始化开关标签文本
    const sortLabel = document.querySelector('label[for="sortToggle"]');
    sortLabel.textContent = '切换为后台';

    // 绑定事件监听器
    addRowBtn.addEventListener('click', addNewRow);
    translateBtn.addEventListener('click', startTranslation);
    copyAllResultsBtn.addEventListener('click', copyAllResults);
    clearAllBtn.addEventListener('click', clearAll);
    sortToggle.addEventListener('change', handleSortToggle);
    setupDeleteRowHandlers();
    setupPasteHandler();
    cancelTranslationBtn.addEventListener('click', cancelTranslation);

    // 获取当前选择的模型配置
    function getCurrentModelConfig() {
        const selectedModel = modelSelect.value;
        return config.models[selectedModel];
    }

    // 添加新行
    function addNewRow() {
        const tbody = inputTable.querySelector('tbody');
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td>
                <textarea class="form-control description" rows="2" placeholder="请输入说明..."></textarea>
            </td>
            <td>
                <textarea class="form-control original-text" rows="2" placeholder="请输入原文..."></textarea>
            </td>
            <td>
                <button class="btn btn-danger btn-sm delete-row">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(newRow);
        setupDeleteRowHandlers();
    }

    // 设置删除行按钮的事件处理
    function setupDeleteRowHandlers() {
        document.querySelectorAll('.delete-row').forEach(button => {
            button.onclick = function() {
                const row = this.closest('tr');
                row.remove();
            };
        });
    }

    // 处理粘贴事件
    function setupPasteHandler() {
        inputTable.addEventListener('paste', (e) => {
            // 只处理粘贴到原文列的情况
            if (!e.target.classList.contains('original-text')) return;
            
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text');
            const rows = pastedText.split(/\r\n|\r|\n/).filter(row => row.trim()); // 处理不同系统的换行符

            // 如果只有一行，直接粘贴
            if (rows.length === 1) {
                e.target.value = rows[0];
                return;
            }

            // 获取当前粘贴的单元格所在行
            const currentRow = e.target.closest('tr');
            const tbody = inputTable.querySelector('tbody');
            const allRows = Array.from(tbody.querySelectorAll('tr'));
            const currentRowIndex = allRows.indexOf(currentRow);

            // 删除当前行后的所有行
            allRows.slice(currentRowIndex + 1).forEach(row => row.remove());

            // 更新当前行的内容
            currentRow.querySelector('.original-text').value = rows[0];

            // 为剩余的每一行创建新行
            rows.slice(1).forEach(text => {
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td>
                        <textarea class="form-control description" rows="2" placeholder="请输入说明..."></textarea>
                    </td>
                    <td>
                        <textarea class="form-control original-text" rows="2">${text}</textarea>
                    </td>
                    <td>
                        <button class="btn btn-danger btn-sm delete-row">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(newRow);
            });

            // 重新设置删除按钮的事件处理
            setupDeleteRowHandlers();
        });
    }

    // 处理排序切换
    function handleSortToggle() {
        const isBackendSort = sortToggle.checked;
        const currentOrder = isBackendSort ? languageOrders.backend : languageOrders.normal;
        
        // 更新开关标签文本
        sortLabel.textContent = isBackendSort ? '切换为正常' : '切换为后台';
        
        // 更新表头顺序
        const thead = resultTable.querySelector('thead tr');
        thead.innerHTML = '';
        currentOrder.forEach(lang => {
            const th = document.createElement('th');
            th.textContent = lang;
            thead.appendChild(th);
        });

        // 重新排序现有数据
        const tbody = resultTable.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const newRow = document.createElement('tr');
            
            currentOrder.forEach(lang => {
                const cell = cells.find(cell => cell.dataset.lang.toLowerCase() === lang.toLowerCase());
                if (cell) {
                    newRow.appendChild(cell.cloneNode(true));
                }
            });
            
            row.replaceWith(newRow);
        });

        // 重新设置单元格复制功能
        setupCellCopyHandlers();
    }

    // 添加取消翻译标志
    let isTranslationCancelled = false;

    // 取消翻译函数
    function cancelTranslation() {
        isTranslationCancelled = true;
        hideLoading();
        showToast('翻译已取消', 'warning');
    }

    // 翻译文本
    async function translateText(description, originalText, currentRow, totalRows) {
        try {
            const selectedModel = modelSelect.value;
            
            // 准备请求数据，包含说明字段
            const requestData = {
                text: originalText,
                model: selectedModel,
                description: description // 添加说明字段
            };
            
            // 根据模型选择对应的API URL
            const apiBaseUrl = config.MODEL_API_URLS[selectedModel] || config.API_BASE_URL;
            
            console.log(`[DEBUG] 发送请求详情:`);
            console.log(`- 模型: ${selectedModel}`);
            console.log(`- 原文: "${originalText}"`);
            console.log(`- 说明: "${description}"`);
            console.log(`- URL: ${apiBaseUrl}${config.ENDPOINTS.translate}`);
            
            // 发送请求
            const response = await fetch(`${apiBaseUrl}${config.ENDPOINTS.translate}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData),
                signal: AbortSignal.timeout(config.TIMEOUT)
            });
            
            console.log(`[DEBUG] 收到响应状态: ${response.status}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            // 解析响应数据
            const responseText = await response.text();
            console.log(`[DEBUG] 响应内容长度: ${responseText.length} 字符`);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error(`[DEBUG] JSON解析错误:`, e);
                throw new Error(`无法解析服务器响应: ${e.message}`);
            }
            
            // 缩短日志输出，只显示关键内容
            if (result && result.data) {
                console.log(`[DEBUG] 解析后结果包含data字段:`, {
                    success: result.success,
                    timestamp: result.timestamp,
                    data: {
                        model: result.data.model,
                        process_time: result.data.process_time,
                        translations: Object.keys(result.data.translations || {}).length + " 种语言"
                    }
                });
            } else {
                console.log(`[DEBUG] 解析后结果结构:`, result ? Object.keys(result) : null);
            }
            
            // 提取正确的翻译数据
            let translations;
            if (result.data && result.data.translations) {
                // 处理嵌套的data结构
                console.log(`[DEBUG] 检测到嵌套的data结构`);
                translations = result.data.translations;
            } else if (result.translations) {
                // 处理包含translations字段的结构
                console.log(`[DEBUG] 检测到直接的translations结构`);
                translations = result.translations;
            } else if (typeof result === 'object' && result.zh_CN) {
                // 处理直接返回翻译对象的情况
                console.log(`[DEBUG] 检测到直接的翻译对象`);
                translations = result;
            } else {
                console.error(`[DEBUG] 无法识别的响应格式`, result);
                throw new Error('服务器返回了无法识别的数据格式');
            }
            
            // 显示英文翻译结果，确认说明是否生效
            if (translations.en_US) {
                console.log(`[DEBUG] 英文翻译结果: "${translations.en_US}"`);
                console.log(`[DEBUG] 原文: "${originalText}", 说明: "${description}"`);
            }
            
            // 确保所有必要的语言键存在
            const requiredLanguages = ['zh_CN', 'en_US', 'ar_AE', 'tr_TR', 'pt_BR', 'es_MX', 'zh_TW', 'fr_FR', 'id_ID', 'ms_MY'];
            const missingLanguages = requiredLanguages.filter(lang => !translations[lang]);
            
            if (missingLanguages.length > 0) {
                console.warn(`[DEBUG] 缺少语言:`, missingLanguages);
                // 填充缺失的语言，防止渲染错误
                missingLanguages.forEach(lang => {
                    translations[lang] = `[缺失: ${lang}]`;
                });
            }
            
            // 更新进度
            updateProgress((currentRow + 1) / totalRows * 100);
            
            return {
                description,
                translations: translations
            };
            
        } catch (error) {
            console.error('[翻译错误]:', error);
            showToast(`翻译失败: ${error.message}`, 'error');
            throw error;
        }
    }

    // 添加进度更新函数
    function updateProgress(progress) {
        const progressBar = document.querySelector('.progress-bar');
        const progressText = document.querySelector('.progress-text');
        
        if (progressBar && progressText) {
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `翻译进度: ${Math.round(progress)}%`;
            
            // 当进度达到100%时，添加完成动画
            if (progress === 100) {
                progressBar.classList.add('progress-complete');
                setTimeout(() => {
                    progressBar.classList.remove('progress-complete');
                }, 500);
            }
        }
    }

    // 重置进度条
    function resetProgress() {
        const progressBar = document.querySelector('.progress-bar');
        const progressText = document.querySelector('.progress-text');
        
        if (progressBar && progressText) {
            progressBar.style.width = '0%';
            progressText.textContent = '翻译进度: 0%';
            progressBar.classList.remove('progress-complete');
        }
    }

    // 开始翻译
    async function startTranslation() {
        try {
            showLoading();
            // 重置进度条和取消标志
            resetProgress();
            isTranslationCancelled = false;
            
            // 更新当前使用的模型名称
            const currentModelName = document.getElementById('currentModelName');
            const selectedModel = modelSelect.value;
            currentModelName.textContent = config.models[selectedModel].name;
            
            // 获取所有需要翻译的行
            const rows = Array.from(inputTable.querySelectorAll('tbody tr'));
            const totalRows = rows.length;
            
            if (totalRows === 0) {
                throw new Error('请至少添加一行文本');
            }
            
            console.log(`[翻译日志] 开始时间: ${new Date().toLocaleString()}`);
            console.log(`[翻译日志] 总行数: ${totalRows}`);
            
            const translations = [];
            let currentRow = 0;
            
            // 处理每一行
            for (const row of rows) {
                if (isTranslationCancelled) {
                    console.log('[翻译日志] 翻译已取消');
                    break;
                }
                
                // 获取说明和原文内容
                const description = row.querySelector('.description').value.trim();
                const originalText = row.querySelector('.original-text').value.trim();
                
                // 记录行数据和说明内容
                console.log(`[翻译日志] 行 ${currentRow + 1}:`);
                console.log(`- 原文: "${originalText}"`);
                console.log(`- 说明: "${description}"`);
                
                if (!originalText) {
                    console.log(`[翻译日志] 跳过空行: ${currentRow + 1}`);
                    currentRow++;
                    continue;
                }
                
                try {
                    // 传递说明和原文到翻译函数
                    console.log(`[翻译日志] 发送翻译请求，行 ${currentRow + 1}, 说明长度: ${description.length}`);
                    const result = await translateText(description, originalText, currentRow, totalRows);
                    translations.push(result);
                    console.log(`[翻译日志] 行 ${currentRow + 1} 翻译成功`);
                } catch (error) {
                    console.error(`[翻译日志] 行 ${currentRow + 1} 翻译失败:`, error);
                    showToast(`第 ${currentRow + 1} 行翻译失败: ${error.message}`, 'error');
                }
                
                currentRow++;
            }
            
            // 更新结果表格
            if (translations.length > 0) {
                updateResultTable(translations);
                showToast('翻译完成！', 'success');
            }
            
        } catch (error) {
            console.error('[翻译日志] 翻译过程出错:', error);
            showToast(error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // 更新结果表格
    function updateResultTable(translations) {
        const tbody = resultTable.querySelector('tbody');
        tbody.innerHTML = '';

        // 获取当前排序顺序
        const currentOrder = sortToggle.checked ? languageOrders.backend : languageOrders.normal;

        console.log(`[DEBUG] 更新表格, 翻译结果数量: ${translations.length}`);
        
        if (translations.length > 0) {
            console.log(`[DEBUG] 第一个翻译结果:`, translations[0]);
        }
        
        // 确保翻译结果与输入行一一对应
        translations.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // 检查翻译结果格式
            if (!item || !item.translations) {
                console.error(`[DEBUG] 翻译结果格式错误:`, item);
                return; // 跳过这一行
            }
            
            // 遍历语言创建单元格
            currentOrder.forEach(lang => {
                const cell = document.createElement('td');
                cell.className = 'selectable';
                cell.dataset.lang = lang;
                
                const span = document.createElement('span');
                span.className = 'cell-content';
                
                // 安全获取翻译文本
                const translatedText = item.translations[lang] || `[未翻译: ${lang}]`;
                span.textContent = translatedText;
                
                cell.appendChild(span);
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        });

        // 设置单元格复制功能
        setupCellCopyHandlers();
    }

    // 设置单元格复制功能
    function setupCellCopyHandlers() {
        // 设置列选择功能
        document.querySelectorAll('thead th').forEach((th, index) => {
            th.addEventListener('click', function() {
                const rows = Array.from(resultTable.querySelectorAll('tbody tr'));
                const lang = this.textContent.trim(); // 获取表头的语言代码
                const columnContent = rows.map(row => {
                    const cell = row.querySelector(`td[data-lang="${lang}"] .cell-content`);
                    return cell ? cell.textContent : '';
                }).join('\n');
                
                navigator.clipboard.writeText(columnContent)
                    .then(() => {
                        showToast('已复制整列内容', 'success');
                    })
                    .catch(err => {
                        console.error('复制失败:', err);
                        showToast('复制失败，请重试', 'error');
                    });
            });
        });

        // 设置单元格点击事件
        document.querySelectorAll('.selectable').forEach(cell => {
            cell.addEventListener('click', function() {
                // 移除其他单元格的焦点
                document.querySelectorAll('.selectable').forEach(c => {
                    if (c !== this) {
                        c.classList.remove('focused');
                    }
                });
                
                // 添加当前单元格的焦点
                this.classList.add('focused');
                
                // 选中单元格内容
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(this.querySelector('.cell-content'));
                selection.removeAllRanges();
                selection.addRange(range);
            });
        });
    }

    // 复制所有结果
    function copyAllResults() {
        const rows = Array.from(resultTable.querySelectorAll('tbody tr'));
        if (rows.length === 0) {
            showToast('没有可复制的翻译结果', 'warning');
            return;
        }

        let csvContent = '';

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('.cell-content'));
            const rowContent = cells.map(cell => cell.textContent).join('\t');
            csvContent += rowContent + '\n';
        });

        navigator.clipboard.writeText(csvContent)
            .then(() => {
                showToast('已复制所有翻译结果', 'success');
            })
            .catch(err => {
                console.error('复制失败:', err);
                showToast('复制失败，请重试', 'error');
            });
    }

    // 清空所有行
    function clearAll() {
        const inputTbody = inputTable.querySelector('tbody');
        const resultTbody = resultTable.querySelector('tbody');
        
        // 清空输入表格，只保留一行
        inputTbody.innerHTML = `
            <tr>
                <td>
                    <textarea class="form-control description" rows="2" placeholder="请输入说明..."></textarea>
                </td>
                <td>
                    <textarea class="form-control original-text" rows="2" placeholder="请输入原文..."></textarea>
                </td>
                <td>
                    <button class="btn btn-danger btn-sm delete-row">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        
        // 清空结果表格
        resultTbody.innerHTML = '';
        
        // 重新设置删除按钮的事件处理
        setupDeleteRowHandlers();
        
        showToast('已清空所有内容', 'success');
    }

    // 显示加载动画
    function showLoading() {
        loadingOverlay.classList.remove('d-none');
    }

    // 隐藏加载动画
    function hideLoading() {
        loadingOverlay.classList.add('d-none');
    }

    // 显示Toast提示
    function showToast(message, type = 'info') {
        const toastContainer = document.querySelector('.toast-container') || createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast show`;
        toast.innerHTML = `
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // 3秒后自动消失
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // 创建Toast容器
    function createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
}); 