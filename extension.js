const vscode = require('vscode');

// Move requires inside activate for fault tolerance
let folderManager;
let descriptions;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    try {
        console.log('Antigravity Menu is starting initialization...');

        // Lazy load dependencies inside try-catch
        try {
            folderManager = require('./lib/folder-manager');
            descriptions = require('./lib/descriptions');
            console.log('✅ Modules loaded successfully.');
        } catch (e) {
            console.error('❌ Failed to load dependency modules:', e);
            throw new Error(`Failed to load dependency modules: ${e.message}`);
        }

        console.log('🚀 Antigravity Menu is active!');

        // 1. 创建状态栏按钮
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = "$(hubot) AI指令集";
        statusBarItem.command = "antigravity-menu.open";
        statusBarItem.tooltip = "Loading..."; // Temporary tooltip
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        // Safe initialization
        let assetsCache = { agents: [], skills: [], workflows: [] };
        try {
            assetsCache = folderManager.scanAssets();
        } catch (e) {
            console.error("Initial scan failed", e);
        }

        // 初始化历史记录
        let history = context.globalState.get('antigravity-menu.history', []);

        // Initial update
        updateStatusBarTooltip();

        // 2. 注册核心命令
        let disposable = vscode.commands.registerCommand('antigravity-menu.open', async (initialCategory) => {
            console.log('Command "antigravity-menu.open" triggered');
            try {
                const structure = folderManager.getStructure();
                assetsCache = folderManager.scanAssets(); // 刷新缓存
                console.log('Assets scanned:', Object.keys(assetsCache).length, 'types found');

                if (initialCategory) {
                    if (structure[initialCategory]) {
                        await showMenu(structure[initialCategory], initialCategory, structure);
                        return;
                    }
                    const matchingKey = Object.keys(structure).find(k => k.includes(initialCategory));
                    if (matchingKey) {
                        await showMenu(structure[matchingKey], matchingKey, structure);
                        return;
                    }
                }
                await showMenu(structure, "AI 指令集");
            } catch (e) {
                vscode.window.showErrorMessage(`菜单打开失败: ${e.message}`);
            }
        });

        // 3. 注册复制命令
        let copyDisposable = vscode.commands.registerCommand('antigravity-menu.copy', async (text) => {
            if (!text) return;
            await vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage(`📋 指令已复制: "${text}"`);
        });

        // 4. 注册刷新菜单命令
        let refreshDisposable = vscode.commands.registerCommand('antigravity-menu.refresh', async () => {
            try {
                const result = folderManager.forceRefresh();
                assetsCache = folderManager.scanAssets();
                updateStatusBarTooltip();
                vscode.window.showInformationMessage(`✅ 菜单已刷新: 新增 ${result.added} 项`);
            } catch (e) {
                vscode.window.showErrorMessage(`刷新失败: ${e.message}`);
            }
        });

        // 5. 注册编辑配置命令
        let configDisposable = vscode.commands.registerCommand('antigravity-menu.config', async () => {
            const configPath = folderManager.getConfigPath();
            if (configPath) {
                const doc = await vscode.workspace.openTextDocument(configPath);
                await vscode.window.showTextDocument(doc);
            } else {
                vscode.window.showErrorMessage("无法找到配置文件");
            }
        });

        context.subscriptions.push(disposable);
        context.subscriptions.push(copyDisposable);
        context.subscriptions.push(refreshDisposable);
        context.subscriptions.push(configDisposable);

        // 辅助：更新状态栏 Tooltip
        function updateStatusBarTooltip() {
            try {
                const md = new vscode.MarkdownString();
                md.isTrusted = true;
                md.supportThemeIcons = true;

                // --- 1. 最近使用 (顶部) ---
                if (history.length > 0) {
                    md.appendMarkdown(`**🕒 最近使用**\n\n`);
                    history.forEach(item => {
                        let commandUri;
                        let display = item.name;
                        if (item.type === 'Workflow') {
                            commandUri = vscode.Uri.parse(`command:antigravity-menu.copy?${encodeURIComponent(JSON.stringify(item.value))}`);
                            display = item.name;
                        } else if (item.type === 'Link') {
                            commandUri = vscode.Uri.parse(`command:${item.command}`);
                        } else {
                            commandUri = vscode.Uri.parse(`command:antigravity-menu.open?${encodeURIComponent(JSON.stringify(item.name))}`);
                        }
                        md.appendMarkdown(`[${item.icon} ${display}](${commandUri})&nbsp;&nbsp;`);
                    });
                    md.appendMarkdown(`\n\n---\n\n`);
                }

                // --- 2. 快速导航 ---
                md.appendMarkdown(`**📂 快速导航**\n\n`);
                const categories = [
                    { name: "Agents", icon: "$(person)", label: "专家角色" },
                    { name: "Skills", icon: "$(tools)", label: "专业技能" },
                    { name: "Workflows", icon: "$(symbol-event)", label: "工作流" }
                ];
                categories.forEach(c => {
                    const commandUri = vscode.Uri.parse(`command:antigravity-menu.open?${encodeURIComponent(JSON.stringify(c.name))}`);
                    md.appendMarkdown(`[${c.icon} ${c.label}](${commandUri})<br>\n`);
                });

                // 刷新与配置链接
                md.appendMarkdown(`\n---\n`);
                const refreshUri = vscode.Uri.parse(`command:antigravity-menu.refresh`);
                const configUri = vscode.Uri.parse(`command:antigravity-menu.config`);
                md.appendMarkdown(`[$(sync) 刷新菜单](${refreshUri}) | [$(gear) 编辑配置](${configUri})`);

                statusBarItem.tooltip = md;
            } catch (e) {
                console.error("Error updating tooltip:", e);
            }
        }

        // 递归显示菜单函数
        async function showMenu(items, title, parent = null) {
            const quickPickItems = [];
            // 添加返回按钮
            if (parent) {
                quickPickItems.push({
                    label: "$(arrow-left) 返回上一级",
                    description: "",
                    action: 'back'
                });
            }

            if (Array.isArray(items)) {
                items.forEach(name => {
                    const type = getType(name, assetsCache);
                    const cnDesc = descriptions ? (descriptions[name] || "") : "";

                    quickPickItems.push({
                        label: getIcon(type) + " " + name,
                        description: cnDesc ? `${type} • ${cnDesc}` : type,
                        action: 'copy',
                        value: name,
                        type: type
                    });
                });
            } else if (typeof items === 'object') {
                Object.keys(items).forEach(key => {
                    quickPickItems.push({
                        label: "$(folder) " + key,
                        action: 'folder',
                        value: items[key]
                    });
                });
            }
            // 在根菜单底部添加 "管理菜单" 选项
            if (!parent) {
                quickPickItems.push({ label: "", kind: vscode.QuickPickItemKind.Separator });
                quickPickItems.push({
                    label: "$(gear) 管理菜单...",
                    description: "刷新列表或编辑分类",
                    action: 'manage'
                });
            }

            const selection = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: title,
                ignoreFocusOut: false
            });

            if (!selection) return 'CLOSED';
            if (selection.action === 'back') return 'BACK';

            if (selection.action === 'manage') {
                const action = await vscode.window.showQuickPick([
                    { label: "$(sync) 刷新菜单结构", description: "扫描新文件并合并", id: 'refresh' },
                    { label: "$(edit) 编辑配置文件", description: "手动调整分类 JSON", id: 'config' }
                ], { placeHolder: "管理菜单" });
                if (action) {
                    if (action.id === 'refresh') vscode.commands.executeCommand('antigravity-menu.refresh');
                    if (action.id === 'config') vscode.commands.executeCommand('antigravity-menu.config');
                }
                return 'CLOSED';
            }

            if (selection.action === 'folder') {
                const result = await showMenu(selection.value, selection.label, items);
                if (result === 'CLOSED') return 'CLOSED';
                return showMenu(items, title, parent);
            } else if (selection.action === 'copy') {
                await addToHistory({ name: selection.value, value: selection.value, type: selection.type, icon: getIcon(selection.type) });
                await handleSelection(selection.value, selection.type);
                return 'CLOSED';
            }
        }

        async function addToHistory(item) {
            history = history.filter(h => h.value !== item.value);
            history.unshift(item);
            if (history.length > 5) history.pop();
            await context.globalState.update('antigravity-menu.history', history);
            updateStatusBarTooltip();
        }

        async function handleSelection(name, type) {
            let textToCopy = name;
            if (type === 'Agent') {
                textToCopy = `@${name} `;
            } else if (type === 'Workflow') {
                if (!name.startsWith('/')) textToCopy = `/${name} `;
                else textToCopy = `${name} `;
            } else {
                textToCopy = `${name}`;
            }
            await vscode.env.clipboard.writeText(textToCopy);
            vscode.window.showInformationMessage(`📋 指令已复制: "${textToCopy}" (请直接粘贴)`);
        }

        function getType(name, assets) {
            if (name.startsWith('/')) return 'Workflow';
            if (assets && assets.agents && assets.agents.includes(name)) return 'Agent';
            if (assets && assets.workflows && assets.workflows.includes(name)) return 'Workflow';
            return 'Skill';
        }

        function getIcon(type) {
            if (type === 'Agent') return '$(person)';
            if (type === 'Workflow') return '$(rocket)';
            return '$(tools)';
        }

    } catch (e) {
        console.error("Critical Error activating Antigravity Menu:", e);
        vscode.window.showErrorMessage(`Antigravity Menu 启动严重错误: ${e.message}`);
    }
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
