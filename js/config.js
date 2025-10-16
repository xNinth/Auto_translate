// API配置
const config = {
    // API基础URL - 默认URL，将根据模型动态选择
    API_BASE_URL: 'https://1258924718-d2yyrm8l6e.ap-beijing.tencentscf.com',
    
    // 模型特定API基础URL
    MODEL_API_URLS: {
        deepseek: 'https://1258924718-d2yyrm8l6e.ap-beijing.tencentscf.com',
        gpt4o: 'https://1258924718-d2yyrm8l6e.ap-beijing.tencentscf.com',
        grok: 'https://auto-trans2-backend.vercel.app'
    },
    
    // API端点
    ENDPOINTS: {
        translate: '/translate',
        health: '/'
    },
    
    // 翻译模型配置
    models: {
        grok: {
            name: 'Grok-3',
            maxLength: 2000
        },
        deepseek: {
            name: 'Deepseek-V3',
            maxLength: 2000
        },
        gpt4o: {
            name: 'GPT-4',
            maxLength: 2000
        }
    },
    
    // 翻译批次大小限制
    MAX_CHARS_PER_BATCH: 300,
    
    // 请求超时时间（毫秒）
    TIMEOUT: 594000, // 594秒超时，略小于后端的600秒
    
    // 重试配置
    RETRY: {
        maxAttempts: 2,
        delay: 1000 // 毫秒
    }
};

// 防止配置被修改
Object.freeze(config);

export default config; 