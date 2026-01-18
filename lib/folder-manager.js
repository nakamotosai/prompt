const fs = require('fs');
const path = require('path');
const os = require('os');
const categoryMap = require('../category-map');

class FolderManager {
    constructor() {
        this.agentRoot = path.join(os.homedir(), '.agent');
        this.configPath = path.join(this.agentRoot, 'ag-menu-structure.json');
    }

    // 获取完整菜单结构（懒加载）
    getStructure() {
        if (!fs.existsSync(this.configPath)) {
            this.generateDefaultConfig();
        }
        try {
            const content = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(content);
        } catch (e) {
            console.error("Failed to parse menu config", e);
            return {};
        }
    }

    // 扫描现有资产
    scanAssets() {
        const assets = {
            agents: [],
            skills: [],
            workflows: []
        };

        const scanDir = (dirname, type) => {
            const dirPath = path.join(this.agentRoot, dirname);
            if (fs.existsSync(dirPath)) {
                fs.readdirSync(dirPath).forEach(file => {
                    const name = path.basename(file, '.md');
                    if (file.endsWith('.md') && name !== 'SKILL') {
                        assets[type].push(name);
                    }
                    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
                        assets[type].push(file); // Skill folder name
                    }
                });
            }
        };

        scanDir('agents', 'agents');
        scanDir('skills', 'skills');
        scanDir('workflows', 'workflows');

        // Remove duplicates and clean up
        assets.skills = [...new Set(assets.skills)];

        return assets;
    }

    // 生成默认配置（含智能分类）
    generateDefaultConfig() {
        const assets = this.scanAssets();
        const config = JSON.parse(JSON.stringify(categoryMap)); // Deep copy official map

        // 辅助：扁平化官方列表以进行查重
        const officialItems = new Set();
        const traverse = (obj) => {
            for (const key in obj) {
                if (Array.isArray(obj[key])) {
                    obj[key].forEach(item => officialItems.add(item));
                } else {
                    traverse(obj[key]);
                }
            }
        };
        traverse(config);

        // 处理未分类的 Skill (自定义 Custom Skill)
        const customSkills = assets.skills.filter(s => !officialItems.has(s) && s !== 'SKILL');

        if (customSkills.length > 0) {
            config["✨ 用户自定义 (Custom)"] = {};

            customSkills.forEach(skill => {
                // 简单的智能推断
                let category = "📂 其他";
                const lower = skill.toLowerCase();

                if (lower.includes('java') || lower.includes('spring') || lower.includes('db') || lower.includes('sql')) category = "⚙️ 后端";
                else if (lower.includes('js') || lower.includes('react') || lower.includes('vue') || lower.includes('ui')) category = "🎨 前端";
                else if (lower.includes('test') || lower.includes('qa')) category = "🧪 测试";
                else if (lower.includes('sec') || lower.includes('audit')) category = "🔒 安全";

                if (!config["✨ 用户自定义 (Custom)"][category]) {
                    config["✨ 用户自定义 (Custom)"][category] = [];
                }
                config["✨ 用户自定义 (Custom)"][category].push(skill);
            });
        }

        // 写入文件
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    }
    // 获取配置文件路径
    getConfigPath() {
        return this.configPath;
    }

    // 强制刷新：扫描新资源并合并到现有配置
    forceRefresh() {
        // 1. 获取现有配置
        let config = this.getStructure();
        
        // 2. 扫描当前实际文件
        const currentAssets = this.scanAssets();
        const allCurrentFiles = new Set([
            ...currentAssets.agents,
            ...currentAssets.skills,
            ...currentAssets.workflows
        ]);

        // 3. 收集配置中已有的项（用于查重和清理）
        const configItems = new Set();
        const cleanConfig = (obj) => {
            for (const key in obj) {
                if (Array.isArray(obj[key])) {
                    // 过滤掉不存在的文件
                    obj[key] = obj[key].filter(item => {
                        const exists = allCurrentFiles.has(item);
                        if (exists) configItems.add(item);
                        return exists;
                    });
                    // 如果分类空了，保留空数组或删除键？这里保留空数组以免结构变动太大
                } else if (typeof obj[key] === 'object') {
                    cleanConfig(obj[key]);
                    // 如果子对象空了，可以考虑删除，这里暂时保留
                }
            }
        };
        cleanConfig(config);

        // 4. 找出新增项
        const newItems = {
            agents: currentAssets.agents.filter(x => !configItems.has(x)),
            skills: currentAssets.skills.filter(x => !configItems.has(x) && x !== 'SKILL'),
            workflows: currentAssets.workflows.filter(x => !configItems.has(x))
        };

        const totalNew = newItems.agents.length + newItems.skills.length + newItems.workflows.length;

        if (totalNew > 0) {
            // 确保 "✨ 用户自定义 (Custom)" -> "🆕 新增 (New)" 存在
            if (!config["✨ 用户自定义 (Custom)"]) config["✨ 用户自定义 (Custom)"] = {};
            if (!config["✨ 用户自定义 (Custom)"]["🆕 新增 (New)"]) config["✨ 用户自定义 (Custom)"]["🆕 新增 (New)"] = [];

            const targetList = config["✨ 用户自定义 (Custom)"]["🆕 新增 (New)"];
            
            // 添加新项
            targetList.push(...newItems.agents);
            targetList.push(...newItems.skills);
            targetList.push(...newItems.workflows);
        }

        // 5. 保存更新
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
        
        return {
            added: totalNew,
            config: config
        };
    }

    // 生成默认配置（含智能分类）
    generateDefaultConfig() {
        const assets = this.scanAssets();
        const config = JSON.parse(JSON.stringify(categoryMap)); // Deep copy official map

        // 辅助：扁平化官方列表以进行查重
        const officialItems = new Set();
        const traverse = (obj) => {
            for (const key in obj) {
                if (Array.isArray(obj[key])) {
                    obj[key].forEach(item => officialItems.add(item));
                } else {
                    traverse(obj[key]);
                }
            }
        };
        traverse(config);

        // 处理未分类的 Skill (自定义 Custom Skill)
        const customSkills = assets.skills.filter(s => !officialItems.has(s) && s !== 'SKILL');

        if (customSkills.length > 0) {
            config["✨ 用户自定义 (Custom)"] = {};

            customSkills.forEach(skill => {
                // 简单的智能推断
                let category = "📂 其他";
                const lower = skill.toLowerCase();

                if (lower.includes('java') || lower.includes('spring') || lower.includes('db') || lower.includes('sql')) category = "⚙️ 后端";
                else if (lower.includes('js') || lower.includes('react') || lower.includes('vue') || lower.includes('ui')) category = "🎨 前端";
                else if (lower.includes('test') || lower.includes('qa')) category = "🧪 测试";
                else if (lower.includes('sec') || lower.includes('audit')) category = "🔒 安全";

                if (!config["✨ 用户自定义 (Custom)"][category]) {
                    config["✨ 用户自定义 (Custom)"][category] = [];
                }
                config["✨ 用户自定义 (Custom)"][category].push(skill);
            });
        }

        // 写入文件
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    }
}

module.exports = new FolderManager();
