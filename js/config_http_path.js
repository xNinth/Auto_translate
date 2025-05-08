// API配置 - 阿里云函数计算HTTP路径处理函数版本
const config = {
    // API基础URL - 阿里云函数计算服务URL
    API_BASE_URL: 'https://http-pafunction-http-pa-service-gxtbpdaedv.cn-hangzhou.fcapp.run',
    
    // API端点
    ENDPOINTS: {
        translate: '', // 空白路径，因为阿里云HTTP触发器有路径问题
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
        }
    },
    
    // 翻译批次大小限制
    MAX_CHARS_PER_BATCH: 300,
    
    // 请求超时时间（毫秒）- 增加以适应阿里云函数计算的更长处理时间
    TIMEOUT: 300000, // 300秒超时
    
    // 重试配置
    RETRY: {
        maxAttempts: 2,
        delay: 1000 // 毫秒
    }
};

// 防止配置被修改
Object.freeze(config);

export default config; 