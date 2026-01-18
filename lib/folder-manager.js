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
        assets.agents = [...new Set(assets.agents)];
        assets.workflows = [...new Set(assets.workflows)];

        return assets;
    }

    // 获取配置文件路径
    getConfigPath() {
        return this.configPath;
    }

    // 生成默认配置（含智能分类）
    generateDefaultConfig() {
        const assets = this.scanAssets();
        const config = JSON.parse(JSON.stringify(categoryMap)); // Deep copy official map

        // 1. 扁平化 Agents
        // 将所有实际发现的 agents 加到 Agents 数组中，并去重
        const existingAgents = new Set(config["🤖 专家角色 (Agents)"] || []);
        assets.agents.forEach(a => existingAgents.add(a));
        config["🤖 专家角色 (Agents)"] = Array.from(existingAgents);

        // 2. 处理 Workflows (扁平化)
        // 抓取 workflows 目录下的，以及文件名以 / 开头的
        const existingWorkflows = new Set(config["⚡ 快捷指令 (Workflows)"] || []);
        assets.workflows.forEach(w => {
            if (w.startsWith('/')) existingWorkflows.add(w);
            else existingWorkflows.add('/' + w);
        });
        // 还要检查 skills 里的 workflow (以 / 开头)
        assets.skills.forEach(s => {
            if (s.startsWith('/')) existingWorkflows.add(s);
        });
        config["⚡ 快捷指令 (Workflows)"] = Array.from(existingWorkflows);

        // 3. 处理 Skills
        const officialSkillItems = new Set();
        const skillCategories = config["🧠 专业技能 (Skills)"];
        for (const cat in skillCategories) {
            if (Array.isArray(skillCategories[cat])) {
                skillCategories[cat].forEach(item => officialSkillItems.add(item));
            }
        }

        // 把未分类的 Skill 放入 "📂 其他"
        const otherSkills = assets.skills.filter(s => {
            // 过滤掉官方已有的、它是 workflow 的、或者是 SKILL 标记的
            return !officialSkillItems.has(s) && !s.startsWith('/') && s !== 'SKILL';
        });

        if (!skillCategories["📂 其他"]) skillCategories["📂 其他"] = [];
        const otherSet = new Set(skillCategories["📂 其他"]);
        otherSkills.forEach(s => otherSet.add(s));
        skillCategories["📂 其他"] = Array.from(otherSet);

        // 写入文件
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
        return config;
    }

    // 强制刷新：重新生成配置（简化版本，直接利用 generateDefaultConfig 覆盖/合并逻辑）
    forceRefresh() {
        const oldConfig = this.getStructure();
        const newConfig = this.generateDefaultConfig();

        // 这里的“新增”统计变得复杂，我们简单通过数量比较返回
        const countItems = (cfg) => {
            let count = 0;
            const traverse = (obj) => {
                for (let k in obj) {
                    if (Array.isArray(obj[k])) count += obj[k].length;
                    else if (typeof obj[k] === 'object') traverse(obj[k]);
                }
            };
            traverse(cfg);
            return count;
        };

        return {
            added: Math.max(0, countItems(newConfig) - countItems(oldConfig)),
            config: newConfig
        };
    }
}

module.exports = new FolderManager();
