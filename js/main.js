// 从配置文件导入API配置
import config from './config.js';

// 语言顺序配置
const languageOrders = {
    normal: ['zh_CN', 'en_US', 'ar_AE', 'tr_TR', 'pt_BR', 'es_MX', 'zh_TW', 'fr_FR', 'id_ID', 'ms_MY'],
    backend: ['zh_CN', 'zh_TW', 'en_US', 'ar_AE', 'tr_TR', 'es_MX', 'pt_BR', 'fr_FR', 'id_ID', 'ms_MY']
};

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
                        <textarea class="form-control original-text" rows="2"></textarea>
                    </td>
                    <td>
                        <button class="btn btn-danger btn-sm delete-row">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                newRow.querySelector('.original-text').value = text;
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

    // 取消翻译控制器
    let abortController = null;

    // 取消翻译函数
    function cancelTranslation() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        hideLoading();
        showToast('翻译已取消', 'warning');
    }

    // 带重试的fetch请求
    async function fetchWithRetry(url, options, maxAttempts = config.RETRY.maxAttempts, delay = config.RETRY.delay) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                return response;
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                if (attempt === maxAttempts) throw error;
                console.log(`[重试] 第${attempt}次失败，${delay}ms后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // 翻译文本
    async function translateText(description, originalText, signal) {
        const selectedModel = modelSelect.value;

        const requestData = {
            text: originalText,
            model: selectedModel,
            description: description,
            api_token: config.API_TOKEN
        };

        const apiBaseUrl = config.MODEL_API_URLS[selectedModel] || config.API_BASE_URL;

        const response = await fetchWithRetry(`${apiBaseUrl}${config.ENDPOINTS.translate}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
            signal: signal
        });

        const responseText = await response.text();
        const result = JSON.parse(responseText);

        // 提取翻译数据
        let translations;
        if (result.data && result.data.translations) {
            translations = result.data.translations;
        } else if (result.translations) {
            translations = result.translations;
        } else if (typeof result === 'object' && result.zh_CN) {
            translations = result;
        } else {
            throw new Error('服务器返回了无法识别的数据格式');
        }

        // 填充缺失语言
        const requiredLanguages = ['zh_CN', 'en_US', 'ar_AE', 'tr_TR', 'pt_BR', 'es_MX', 'zh_TW', 'fr_FR', 'id_ID', 'ms_MY'];
        requiredLanguages.forEach(lang => {
            if (!translations[lang]) translations[lang] = `[缺失: ${lang}]`;
        });

        return { description, translations };
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
            resetProgress();
            abortController = new AbortController();

            const currentModelName = document.getElementById('currentModelName');
            const selectedModel = modelSelect.value;
            currentModelName.textContent = config.models[selectedModel].name;

            const rows = Array.from(inputTable.querySelectorAll('tbody tr'));
            const totalRows = rows.length;

            if (totalRows === 0) {
                throw new Error('请至少添加一行文本');
            }

            // 收集所有需要翻译的行数据
            const tasks = rows.map(row => ({
                description: row.querySelector('.description').value.trim(),
                originalText: row.querySelector('.original-text').value.trim()
            }));

            // 并发翻译（限制3个并发）
            const concurrency = 3;
            const translations = new Array(tasks.length).fill(null);
            let completedCount = 0;

            for (let i = 0; i < tasks.length; i += concurrency) {
                if (abortController.signal.aborted) break;

                const batch = tasks.slice(i, i + concurrency);
                const promises = batch.map((task, batchIndex) => {
                    const index = i + batchIndex;
                    if (!task.originalText) {
                        completedCount++;
                        updateProgress(completedCount / totalRows * 100);
                        return Promise.resolve(null);
                    }
                    return translateText(task.description, task.originalText, abortController.signal)
                        .then(result => {
                            translations[index] = result;
                            completedCount++;
                            updateProgress(completedCount / totalRows * 100);
                        })
                        .catch(error => {
                            if (error.name === 'AbortError') return;
                            showToast(`第 ${index + 1} 行翻译失败: ${error.message}`, 'error');
                            const errorPlaceholder = {};
                            const langs = ['zh_CN', 'en_US', 'ar_AE', 'tr_TR', 'pt_BR', 'es_MX', 'zh_TW', 'fr_FR', 'id_ID', 'ms_MY'];
                            langs.forEach(lang => { errorPlaceholder[lang] = '[翻译失败]'; });
                            translations[index] = { description: task.description, translations: errorPlaceholder };
                            completedCount++;
                            updateProgress(completedCount / totalRows * 100);
                        });
                });

                await Promise.all(promises);
            }

            // 过滤掉空行（null），更新结果表格
            const validTranslations = translations.filter(t => t !== null);
            if (validTranslations.length > 0) {
                updateResultTable(validTranslations);
                showToast('翻译完成！', 'success');
            }

        } catch (error) {
            if (error.name !== 'AbortError') {
                showToast(error.message, 'error');
            }
        } finally {
            abortController = null;
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