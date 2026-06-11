
// Archivo: js/adaptiveCommandsUI.js

const AdaptiveCommandUI = (function() {
    
    let currentMode = 'assisted';
    let currentFlow = null;
    let activeCategory = 'all';

    function injectStyles() {
        const styleId = 'adaptive-command-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #adaptive-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(2, 6, 23, 0.85); z-index: 8000;
                display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(6px);
                animation: fadeIn 0.2s ease;
            }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            #adaptive-panel {
                width: 95%; max-width: 520px; max-height: 85vh;
                background: rgba(15, 23, 42, 0.98);
                border: 1px solid var(--accent-cyan, #00f2ff);
                border-radius: 16px;
                display: flex; flex-direction: column;
                box-shadow: 0 20px 60px rgba(0,0,0,0.7);
                overflow: hidden;
            }

            .adaptive-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 14px 18px; border-bottom: 1px solid rgba(0,242,255,0.2);
                background: rgba(0,242,255,0.03); flex-shrink: 0;
            }
            .adaptive-header h3 { 
                color: var(--accent-cyan, #00f2ff); font-size: 1em; margin: 0;
                display: flex; align-items: center; gap: 8px;
            }
            .adaptive-close {
                background: none; border: 1px solid rgba(255,255,255,0.2); color: #fff;
                width: 32px; height: 32px; border-radius: 50%; font-size: 18px;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s; flex-shrink: 0;
            }
            .adaptive-close:hover { background: #ef4444; border-color: #ef4444; }

            .adaptive-body {
                flex: 1; overflow-y: auto; padding: 16px;
                -webkit-overflow-scrolling: touch;
            }

            .adaptive-footer {
                padding: 12px 16px; border-top: 1px solid rgba(0,242,255,0.15);
                display: flex; justify-content: space-between; gap: 8px;
                flex-wrap: wrap; flex-shrink: 0;
            }

            .mode-tabs {
                display: flex; background: rgba(255,255,255,0.05);
                border-radius: 20px; padding: 3px; margin-bottom: 14px;
            }
            .mode-tab {
                flex: 1; text-align: center; padding: 8px 12px;
                border-radius: 18px; border: none; background: transparent;
                color: #94a3b8; font-size: 0.8em; font-weight: 600;
                cursor: pointer; transition: all 0.2s; white-space: nowrap;
            }
            .mode-tab.active { background: var(--accent-cyan, #00f2ff); color: #000; }
            .mode-tab:hover:not(.active) { color: #fff; }

            .cmd-categories {
                display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px;
            }
            .cmd-cat {
                padding: 5px 10px; border-radius: 14px; font-size: 0.7em;
                border: 1px solid rgba(255,255,255,0.15); background: transparent;
                color: #94a3b8; cursor: pointer; transition: all 0.2s; white-space: nowrap;
            }
            .cmd-cat.active { background: var(--accent-blue, #1e4eb8); border-color: var(--accent-cyan, #00f2ff); color: #fff; }
            .cmd-cat:hover { border-color: var(--accent-cyan, #00f2ff); }

            .cmd-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 8px;
            }
            @media (max-width: 400px) {
                .cmd-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
            }

            .cmd-card {
                background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 10px; padding: 10px; cursor: pointer;
                transition: all 0.2s; text-align: center;
            }
            .cmd-card:hover { border-color: var(--accent-cyan, #00f2ff); transform: translateY(-1px); }
            .cmd-card .cmd-icon { font-size: 1.5em; margin-bottom: 4px; }
            .cmd-card .cmd-name { font-size: 0.75em; font-weight: 600; color: #e0e6ed; }
            .cmd-card .cmd-badge { font-size: 0.6em; color: var(--accent-cyan, #00f2ff); margin-top: 3px; }

            .flow-progress {
                background: rgba(255,255,255,0.08); border-radius: 6px; height: 3px;
                margin-bottom: 14px; overflow: hidden;
            }
            .flow-progress-fill {
                background: linear-gradient(90deg, var(--accent-cyan, #00f2ff), var(--accent-blue, #1e4eb8));
                height: 100%; transition: width 0.3s ease;
            }
            .flow-back-btn {
                background: none; border: 1px solid rgba(255,255,255,0.2); color: #94a3b8;
                padding: 6px 12px; border-radius: 6px; font-size: 0.8em; cursor: pointer;
                margin-bottom: 12px;
            }
            .flow-back-btn:hover { color: #fff; border-color: #fff; }
            .flow-title {
                font-size: 0.95em; font-weight: 600; color: #e0e6ed; margin-bottom: 12px;
                display: flex; align-items: center; gap: 8px;
            }

            .flow-select-list {
                display: flex; flex-direction: column; gap: 4px;
                max-height: 45vh; overflow-y: auto;
            }
            .flow-select-item {
                display: flex; align-items: center; gap: 10px;
                padding: 10px 12px; background: rgba(30,41,59,0.6);
                border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
                cursor: pointer; transition: all 0.15s;
            }
            .flow-select-item:active { background: rgba(0,242,255,0.1); border-color: var(--accent-cyan, #00f2ff); }
            .flow-select-item.selected { border-color: var(--accent-blue, #1e4eb8); background: rgba(30,78,184,0.2); }
            .flow-select-item .fsi-icon { font-size: 1.2em; flex-shrink: 0; }
            .flow-select-item .fsi-info { flex: 1; min-width: 0; }
            .flow-select-item .fsi-label { font-weight: 500; font-size: 0.85em; }
            .flow-select-item .fsi-desc { font-size: 0.7em; color: #64748b; }
            .flow-select-item .fsi-abbr { font-size: 0.65em; color: var(--accent-cyan, #00f2ff); }

            .flow-cat-header {
                padding: 6px 10px; font-size: 0.7em; color: var(--accent-cyan, #00f2ff);
                font-weight: 700; text-transform: uppercase;
                background: rgba(0,242,255,0.05); border-radius: 4px;
                margin: 6px 0 2px 0; position: sticky; top: 0; z-index: 1;
            }

            .flow-form-group { margin-bottom: 10px; }
            .flow-form-group label { display: block; font-size: 0.75em; color: #94a3b8; margin-bottom: 4px; }
            .flow-form-group input,
            .flow-form-group select {
                width: 100%; padding: 10px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-size: 0.9em; outline: none;
            }
            .flow-form-group input:focus,
            .flow-form-group select:focus { border-color: var(--accent-cyan, #00f2ff); }

            .flow-coords {
                display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 6px;
                margin-bottom: 6px;
            }
            .flow-coords input { text-align: center; }

            .flow-slider-row {
                display: flex; align-items: center; gap: 8px;
            }
            .flow-slider-row input[type="range"] { flex: 1; }
            .flow-slider-val {
                color: var(--accent-cyan, #00f2ff); font-weight: 600; font-size: 0.85em; min-width: 30px;
            }

            .flow-confirm {
                text-align: center; padding: 20px; background: rgba(248,81,73,0.08);
                border: 1px solid rgba(248,81,73,0.3); border-radius: 10px;
                color: #fca5a5; font-size: 0.9em; line-height: 1.5; white-space: pre-line;
            }

            .flow-preview {
                margin-top: 12px; padding: 10px 14px;
                background: rgba(0,0,0,0.4); border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.08);
            }
            .flow-preview .fp-label { font-size: 0.7em; color: #64748b; margin-bottom: 3px; }
            .flow-preview code {
                color: var(--accent-cyan, #00f2ff); font-family: 'Courier New', monospace;
                font-size: 0.8em; word-break: break-all;
            }

            .flow-search {
                width: 100%; padding: 8px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-size: 0.85em; margin-bottom: 8px; outline: none;
            }
            .flow-search:focus { border-color: var(--accent-cyan, #00f2ff); }

            .text-console-output {
                background: rgba(0,0,0,0.4); border-radius: 8px; padding: 10px;
                max-height: 25vh; overflow-y: auto; margin-bottom: 10px;
                font-family: 'Courier New', monospace; font-size: 0.75em;
            }
            .text-console-output .tco-line { padding: 1px 0; }
            .text-console-output .tco-cmd { color: var(--accent-cyan, #00f2ff); }
            .text-console-output .tco-ok { color: #3fb950; }
            .text-console-output .tco-err { color: #f85149; }
            .text-console-output .tco-info { color: #8b949e; }

            .text-input-area { display: flex; gap: 6px; }
            .text-input-area input {
                flex: 1; padding: 10px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-family: 'Courier New', monospace; font-size: 0.85em; outline: none;
            }
            .text-input-area input:focus { border-color: var(--accent-cyan, #00f2ff); }
            .text-input-area button {
                padding: 10px 14px; background: var(--accent-blue, #1e4eb8);
                border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer;
                font-size: 0.85em;
            }

            .text-hints {
                font-size: 0.7em; color: #64748b; margin-top: 8px;
                padding: 8px; background: rgba(0,242,255,0.03); border-radius: 6px;
                line-height: 1.5;
            }
            .text-hints strong { color: var(--accent-cyan, #00f2ff); }

            .af-btn {
                padding: 8px 16px; border-radius: 6px; border: none;
                font-size: 0.8em; font-weight: 600; cursor: pointer; transition: all 0.2s;
            }
            .af-btn-primary { background: var(--accent-blue, #1e4eb8); color: #fff; }
            .af-btn-primary:hover { background: #2563eb; }
            .af-btn-success { background: #238636; color: #fff; }
            .af-btn-ghost { background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.15); }
            .af-btn-danger { background: transparent; color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
            .af-btn:disabled { opacity: 0.4; cursor: not-allowed; }

            .adaptive-toast {
                position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
                padding: 10px 20px; border-radius: 8px; z-index: 9000;
                font-size: 0.85em; font-weight: 600; pointer-events: none;
                animation: slideUp 0.3s ease;
            }
            .adaptive-toast.ok { background: #1a3a2a; color: #3fb950; border: 1px solid #3fb950; }
            .adaptive-toast.err { background: #3a1a1a; color: #f85149; border: 1px solid #f85149; }
            @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    function createOverlay() {
        const existing = document.getElementById('adaptive-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'adaptive-overlay';
        overlay.innerHTML = `
            <div id="adaptive-panel">
                <div class="adaptive-header">
                    <h3>🤖 <span id="adaptive-title">Comandos Inteligentes</span></h3>
                    <button class="adaptive-close" id="adaptive-close">✕</button>
                </div>
                <div class="adaptive-body" id="adaptive-body"></div>
                <div class="adaptive-footer" id="adaptive-footer"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('adaptive-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeOverlay();
        });

        return overlay;
    }

    function closeOverlay() {
        const overlay = document.getElementById('adaptive-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        }
        currentFlow = null;
        AdaptiveCommandSystem.resetFlow();
    }

    function openPanel(mode) {
        mode = mode || 'assisted';
        injectStyles();
        createOverlay();
        currentMode = mode;
        
        if (currentFlow) {
            renderFlowStep();
        } else {
            if (mode === 'assisted') {
                renderAssistedGrid();
            } else {
                renderTextMode();
            }
        }
    }

    function updateTitle(title) {
        const el = document.getElementById('adaptive-title');
        if (el) el.textContent = title || 'Comandos Inteligentes';
    }

    function renderAssistedGrid() {
        updateTitle('Comandos Inteligentes');
        currentFlow = null;
        AdaptiveCommandSystem.resetFlow();
        
        const commands = AdaptiveCommandSystem.getCommandsByCategory();
        const allCmds = Object.values(commands).flat();
        
        const catNames = {
            'config': '⚙️ Config', 'create': '🏗️ Crear', 'connect': '🔗 Conectar',
            'edit': '✏️ Editar', 'query': '🔍 Consultar', 'utility': '📦 Util', 'direct': '⚡ Directo'
        };

        let bodyHtml = `
            <div class="mode-tabs">
                <button class="mode-tab active" data-mode="assisted" onclick="AdaptiveCommandUI.switchTab('assisted')">🧭 Asistido</button>
                <button class="mode-tab" data-mode="text" onclick="AdaptiveCommandUI.switchTab('text')">⌨️ Texto</button>
            </div>
            <div class="cmd-categories">
                <button class="cmd-cat active" data-cat="all" onclick="AdaptiveCommandUI.filterCategory('all')">📋 Todos (${allCmds.length})</button>
        `;

        Object.entries(commands).forEach(([cat, cmds]) => {
            bodyHtml += `<button class="cmd-cat" data-cat="${cat}" onclick="AdaptiveCommandUI.filterCategory('${cat}')">${catNames[cat] || cat} (${cmds.length})</button>`;
        });

        bodyHtml += `</div><div class="cmd-grid" id="cmdGrid">${renderCmdCards(allCmds)}</div>`;

        document.getElementById('adaptive-body').innerHTML = bodyHtml;

        document.getElementById('adaptive-footer').innerHTML = `
            <button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand('undo')">↩️ Deshacer</button>
            <button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand('redo')">↪️ Rehacer</button>
            <button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand('help')">❓ Ayuda</button>
            <button class="af-btn af-btn-danger" onclick="AdaptiveCommandUI.closeOverlay()">Cerrar</button>
        `;
    }

    function renderCmdCards(cmds) {
        return cmds.map(cmd => {
            const variantCount = getVariantCount(cmd.command);
            return `
                <div class="cmd-card" data-category="${cmd.category}" onclick="AdaptiveCommandUI.startFlow('${cmd.command}')">
                    <div class="cmd-icon">${cmd.icon}</div>
                    <div class="cmd-name">${cmd.name}</div>
                    <div class="cmd-badge">${variantCount} opciones</div>
                </div>
            `;
        }).join('');
    }

    function getVariantCount(cmd) {
        const flow = AdaptiveCommandSystem.COMMAND_FLOWS[cmd];
        if (!flow) return 1;
        var count = 0;
        flow.steps.forEach(function(s) {
            if (typeof s.isFinal === 'function') {
                if (s.isFinal({})) count++;
            } else if (s.isFinal) {
                count++;
            }
        });
        return count || 1;
    }

    function filterCategory(cat) {
        activeCategory = cat;
        document.querySelectorAll('.cmd-cat').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cat === cat);
        });
        document.querySelectorAll('.cmd-card').forEach(card => {
            card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none';
        });
    }

    function switchTab(mode) {
        currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        if (mode === 'assisted') {
            renderAssistedGrid();
        } else {
            renderTextMode();
        }
    }

    function startFlow(commandPath) {
        if (AdaptiveCommandSystem.DIRECT_COMMANDS[commandPath]) {
            const cmd = AdaptiveCommandSystem.DIRECT_COMMANDS[commandPath].command;
            executeTextCommand(cmd);
            return;
        }

        const stepData = AdaptiveCommandSystem.startCommandFlow(commandPath);
        if (!stepData) {
            showToast('Comando no disponible', 'err');
            return;
        }

        if (stepData.direct) {
            executeTextCommand(stepData.command);
            return;
        }

        currentFlow = stepData;
        renderFlowStep();
    }

    function renderFlowStep() {
        if (!currentFlow) {
            renderAssistedGrid();
            return;
        }

        updateTitle(`${currentFlow.commandIcon} ${currentFlow.commandName}`);

        let bodyHtml = `
            <div class="flow-progress">
                <div class="flow-progress-fill" style="width:${currentFlow.progress || 0}%"></div>
            </div>
            <button class="flow-back-btn" onclick="AdaptiveCommandUI.flowBack()">← Volver a comandos</button>
            <div class="flow-title">${currentFlow.title || ''}</div>
        `;

        switch (currentFlow.type) {
            case 'select': bodyHtml += renderFlowSelect(currentFlow, false); break;
            case 'dynamicSelect': bodyHtml += renderFlowSelect(currentFlow, true); break;
            case 'multiSelect': bodyHtml += renderFlowMultiSelect(currentFlow); break;
            case 'multiComponentSelect': bodyHtml += renderFlowComponentMultiSelect(currentFlow); break;
            case 'form': bodyHtml += renderFlowForm(currentFlow); break;
            case 'coordinate': bodyHtml += renderFlowCoordinate(currentFlow); break;
            case 'coordinateList': bodyHtml += renderFlowCoordinateList(currentFlow); break;
            case 'text': bodyHtml += renderFlowText(currentFlow); break;
            case 'number': bodyHtml += renderFlowNumber(currentFlow); break;
            case 'slider': bodyHtml += renderFlowSlider(currentFlow); break;
            case 'confirm': bodyHtml += renderFlowConfirm(currentFlow); break;
            case 'info': bodyHtml += renderFlowInfo(currentFlow); break;
            case 'conditional': flowNext(); return;
            case 'dynamic': bodyHtml += renderFlowDynamic(currentFlow); break;
            default: bodyHtml += `<p style="color:#94a3b8">Paso: ${currentFlow.type}</p>`;
        }

        if (currentFlow.isFinal && currentFlow.command) {
            bodyHtml += `
                <div class="flow-preview">
                    <div class="fp-label">📝 Comando a ejecutar:</div>
                    <code>${currentFlow.command}</code>
                </div>
            `;
        }

        document.getElementById('adaptive-body').innerHTML = bodyHtml;

        setTimeout(function() {
            var materialField = document.getElementById('field-material');
            if (materialField) {
                materialField.addEventListener('change', function() {
                    refreshSpecField();
                });
            }
        }, 50);

        let isFinalStep = currentFlow.isFinal;
        if (typeof isFinalStep === 'function') {
            isFinalStep = isFinalStep(AdaptiveCommandSystem.getSelections ? 
                AdaptiveCommandSystem.getSelections() : {});
        }

        let footerHtml = `
            <button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.flowBack()" ${(currentFlow.stepIndex || 0) === 0 ? 'disabled' : ''}>← Anterior</button>
            <button class="af-btn af-btn-danger" onclick="AdaptiveCommandUI.cancelFlow()">Cancelar</button>
        `;

        if (isFinalStep) {
            footerHtml += `<button class="af-btn af-btn-success" onclick="AdaptiveCommandUI.executeFlowCommand()">✅ Ejecutar</button>`;
        } else {
            footerHtml += `<button class="af-btn af-btn-primary" onclick="AdaptiveCommandUI.flowNext()">Siguiente →</button>`;
        }

        document.getElementById('adaptive-footer').innerHTML = footerHtml;

        setTimeout(() => {
            const searchInput = document.getElementById('flow-search');
            if (searchInput) searchInput.focus();
        }, 100);
    }

    function renderFlowSelect(stepData, searchable) {
        const options = stepData.options || [];
        const hasCategories = options.length > 0 && options[0].category !== undefined;
        
        let html = '';
        
        if (searchable) {
            html += `<input type="text" class="flow-search" id="flow-search" placeholder="🔍 Buscar... (${options.length} opciones)" oninput="AdaptiveCommandUI.filterFlowItems()">`;
        }
        
        if (hasCategories) {
            const grouped = {};
            options.forEach(opt => {
                const cat = opt.category || 'other';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(opt);
            });
            
            const catNames = {
                'VALVE': '🔧 Válvulas', 'ELBOW': '🔀 Codos', 'TEE': '🔱 Tees',
                'REDUCER': '🔽 Reductores', 'FLANGE': '⭕ Bridas', 'STRAINER': '🔍 Filtros',
                'STEAM_TRAP': '💨 Trampas de Vapor', 'INSTRUMENT': '📊 Instrumentos',
                'PIPE': '📏 Tubería', 'SUPPORT': '📌 Soportes', 'CONNECTION': '🔗 Conexiones',
                'EXPANSION': '〰️ Expansión', 'HOSE': '🔧 Mangueras', 'SAFETY': '🛡️ Seguridad',
                'SAMPLE': '🧪 Muestreo', 'QUICK_CONNECT': '⚡ Conexión Rápida',
                'SANITARY': '🧼 Sanitario', 'SPECIAL': '⚙️ Especiales', 'other': '📦 Otros'
            };
            
            html += `<div class="flow-select-list" id="flowSelectList" style="max-height:50vh">`;
            
            Object.entries(grouped).forEach(([cat, items]) => {
                html += `<div class="flow-cat-header">${catNames[cat] || cat} (${items.length})</div>`;
                
                items.forEach(opt => {
                    const searchText = (opt.label + ' ' + (opt.abbr || '') + ' ' + (opt.material || '') + ' ' + (opt.spec || '')).toLowerCase();
                    html += `
                        <div class="flow-select-item" data-value="${opt.value}" data-search="${searchText}" onclick="AdaptiveCommandUI.selectFlowOption('${opt.value}', this)">
                            ${opt.icon ? `<span class="fsi-icon">${opt.icon}</span>` : '<span class="fsi-icon">🔩</span>'}
                            <div class="fsi-info">
                                <div class="fsi-label">${opt.label}</div>
                                ${opt.description ? `<div class="fsi-desc">${opt.description}</div>` : ''}
                                ${opt.abbr ? `<div class="fsi-abbr">ABBR: ${opt.abbr}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
            });
            
            html += `</div>`;
        } else {
            html += `<div class="flow-select-list" id="flowSelectList">`;
            options.forEach(opt => {
                html += `
                    <div class="flow-select-item" data-value="${opt.value}" data-search="${(opt.label || '').toLowerCase()}" onclick="AdaptiveCommandUI.selectFlowOption('${opt.value}', this)">
                        ${opt.icon ? `<span class="fsi-icon">${opt.icon}</span>` : ''}
                        <div class="fsi-info">
                            <div class="fsi-label">${opt.label}</div>
                            ${opt.description ? `<div class="fsi-desc">${opt.description}</div>` : ''}
                            ${opt.warning ? `<div class="fsi-desc" style="color:#f59e0b">⚠️ ${opt.warning}</div>` : ''}
                        </div>
                        ${opt.status === 'open' ? '<span style="color:#3fb950">🟢</span>' : ''}
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        return html;
    }

    function renderFlowMultiSelect(stepData) {
        let html = `<p style="font-size:0.8em;color:#94a3b8;margin-bottom:8px">Seleccione ${stepData.minSelect || 2}+ elementos</p>`;
        html += `<div class="flow-select-list" id="flowMultiSelectList">`;
        (stepData.options || []).forEach(opt => {
            html += `
                <div class="flow-select-item" data-value="${opt.value}" onclick="AdaptiveCommandUI.toggleMultiSelect('${opt.value}', this)">
                    ${opt.icon ? `<span class="fsi-icon">${opt.icon}</span>` : ''}
                    <div class="fsi-label">${opt.label}</div>
                    <span class="multi-check" style="display:none;color:#3fb950">✅</span>
                </div>
            `;
        });
        html += `</div>`;
        html += `<button class="af-btn af-btn-primary" onclick="AdaptiveCommandUI.confirmMultiSelect()" style="margin-top:8px;width:100%">Confirmar Selección</button>`;
        return html;
    }

    function renderFlowComponentMultiSelect(stepData) {
        const options = stepData.options || [];
        const hasCategories = options.length > 0 && options[0].category !== undefined;
        
        let html = `<p style="font-size:0.8em;color:#94a3b8;margin-bottom:8px">Seleccione los componentes deseados</p>`;
        
        if (hasCategories) {
            const grouped = {};
            options.forEach(opt => {
                const cat = opt.category || 'other';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(opt);
            });
            
            const catNames = {
                'VALVE': '🔧 Válvulas', 'ELBOW': '🔀 Codos', 'TEE': '🔱 Tees',
                'REDUCER': '🔽 Reductores', 'FLANGE': '⭕ Bridas', 'STRAINER': '🔍 Filtros',
                'STEAM_TRAP': '💨 Trampas de Vapor', 'INSTRUMENT': '📊 Instrumentos',
                'SUPPORT': '📌 Soportes', 'CONNECTION': '🔗 Conexiones',
                'EXPANSION': '〰️ Expansión', 'HOSE': '🔧 Mangueras', 'SAFETY': '🛡️ Seguridad',
                'SANITARY': '🧼 Sanitario', 'SPECIAL': '⚙️ Especiales', 'other': '📦 Otros'
            };
            
            html += `<div class="flow-select-list" id="flowMultiSelectList" style="max-height:40vh">`;
            
            Object.entries(grouped).forEach(([cat, items]) => {
                html += `<div class="flow-cat-header">${catNames[cat] || cat} (${items.length})</div>`;
                items.forEach(opt => {
                    html += `
                        <div class="flow-select-item" data-value="${opt.value}" onclick="AdaptiveCommandUI.toggleMultiSelect('${opt.value}', this)">
                            🔩
                            <div class="fsi-info">
                                <div class="fsi-label">${opt.label}</div>
                                ${opt.abbr ? `<div class="fsi-abbr">ABBR: ${opt.abbr}</div>` : ''}
                            </div>
                            <span class="multi-check" style="display:none;color:#3fb950">✅</span>
                        </div>
                    `;
                });
            });
            
            html += `</div>`;
        } else {
            html += `<div class="flow-select-list" id="flowMultiSelectList">`;
            options.forEach(opt => {
                html += `
                    <div class="flow-select-item" data-value="${opt.value}" onclick="AdaptiveCommandUI.toggleMultiSelect('${opt.value}', this)">
                        <div class="fsi-label">${opt.label}</div>
                        <span class="multi-check" style="display:none;color:#3fb950">✅</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        html += `<button class="af-btn af-btn-primary" onclick="AdaptiveCommandUI.confirmMultiSelect()" style="margin-top:8px;width:100%">Confirmar Selección</button>`;
        return html;
    }

    function renderFlowForm(stepData) {
        var html = '';
        (stepData.fields || []).forEach(function(field) {
            html += '<div class="flow-form-group">';
            html += '<label>' + field.label + '</label>';
            
            if (field.type === 'select') {
                html += '<select id="field-' + field.id + '" data-field="' + field.id + '">';
                html += '<option value="">Seleccionar...</option>';
                var opts = field.options;
                if (typeof opts === 'function') {
                    var sel = null;
                    var st = AdaptiveCommandSystem.getSelections ? AdaptiveCommandSystem.getSelections() : {};
                    opts = opts(sel, st);
                }
                (opts || []).forEach(function(opt) {
                    var val = typeof opt === 'object' ? opt.value : opt;
                    var lbl = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                    html += '<option value="' + val + '">' + lbl + '</option>';
                });
                html += '</select>';
            } else if (field.type === 'checkbox') {
                html += '<input type="checkbox" id="field-' + field.id + '" data-field="' + field.id + '" style="width:auto">';
            } else {
                html += '<input type="' + field.type + '" id="field-' + field.id + '" data-field="' + field.id + '" ' +
                         'value="' + (field.default || '') + '" placeholder="' + (field.placeholder || '') + '" ' +
                         'min="' + (field.min || '') + '" max="' + (field.max || '') + '" step="' + (field.step || '') + '">';
            }
            html += '</div>';
        });
        return html;
    }

    function renderFlowCoordinate(stepData) {
        const def = stepData.default || { x: 0, y: 0, z: 0 };
        return `
            <div class="flow-form-group">
                <label>Coordenadas (X, Y, Z) en mm</label>
                <div class="flow-coords" style="grid-template-columns:1fr 1fr 1fr">
                    <input type="number" id="coord-x" placeholder="X" value="${def.x || 0}">
                    <input type="number" id="coord-y" placeholder="Y" value="${def.y || 0}">
                    <input type="number" id="coord-z" placeholder="Z" value="${def.z || 0}">
                </div>
            </div>
        `;
    }

    function renderFlowCoordinateList(stepData) {
        let html = `<p style="font-size:0.8em;color:#94a3b8;margin-bottom:8px">${stepData.description || 'Agregue puntos'} (mín: ${stepData.minPoints || 2})</p>`;
        html += `<div id="coordListContainer">`;
        const pts = stepData.default || [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }];
        pts.forEach((p, i) => {
            html += `
                <div class="flow-coords" data-cidx="${i}">
                    <input type="number" placeholder="X" value="${p.x || 0}" data-axis="x">
                    <input type="number" placeholder="Y" value="${p.y || 0}" data-axis="y">
                    <input type="number" placeholder="Z" value="${p.z || 0}" data-axis="z">
                    <button class="af-btn af-btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 6px;font-size:0.7em">✕</button>
                </div>
            `;
        });
        html += `</div>`;
        html += `<button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.addCoordRow()" style="margin-top:6px">+ Agregar Punto</button>`;
        return html;
    }

    function renderFlowText(stepData) {
        return `
            <div class="flow-form-group">
                <input type="text" id="flow-text-input" placeholder="${stepData.placeholder || ''}" 
                       value="${stepData.default || ''}" class="flow-search">
            </div>
        `;
    }

    function renderFlowNumber(stepData) {
        return `
            <div class="flow-form-group">
                <input type="number" id="flow-number-input" value="${stepData.default || 0}"
                       min="${stepData.min || ''}" max="${stepData.max || ''}" step="${stepData.step || '1'}">
            </div>
        `;
    }

    function renderFlowSlider(stepData) {
        return `
            <div class="flow-form-group">
                <label>${stepData.title || 'Valor'}</label>
                <div class="flow-slider-row">
                    <input type="range" id="flow-slider" min="${stepData.min || 0}" max="${stepData.max || 1}" 
                           step="${stepData.step || 0.01}" value="${stepData.default || 0.5}"
                           oninput="document.getElementById('flow-slider-val').textContent = this.value">
                    <span class="flow-slider-val" id="flow-slider-val">${stepData.default || 0.5}</span>
                </div>
            </div>
        `;
    }

    function renderFlowConfirm(stepData) {
        return `<div class="flow-confirm">${stepData.message || '¿Confirmar esta acción?'}</div>`;
    }

    function renderFlowInfo(stepData) {
        return `<div style="text-align:center;padding:20px;color:var(--accent-cyan, #00f2ff);white-space:pre-line;font-size:0.9em">${stepData.message || ''}</div>`;
    }

    function renderFlowDynamic(stepData) {
        if (stepData.resolver) {
            const flowData = AdaptiveCommandSystem.getCurrentStepData();
            const selections = flowData?.selections || {};
            const resolved = stepData.resolver(selections);
            if (resolved.type === 'coordinate') {
                return renderFlowCoordinate({ default: resolved.default });
            } else if (resolved.type === 'number') {
                return renderFlowNumber({ default: resolved.default, min: resolved.min, max: resolved.max, step: resolved.step });
            }
        }
        return renderFlowText(stepData);
    }

    function selectFlowOption(value, element) {
        document.querySelectorAll('#flowSelectList .flow-select-item').forEach(item => {
            item.classList.remove('selected');
        });
        if (element) element.classList.add('selected');

        const nextData = AdaptiveCommandSystem.nextStep(value);
        handleNextStep(nextData);
    }

    function toggleMultiSelect(value, element) {
        element.classList.toggle('selected');
        const check = element.querySelector('.multi-check');
        if (check) check.style.display = element.classList.contains('selected') ? 'inline' : 'none';
    }

    function confirmMultiSelect() {
        const selected = [];
        document.querySelectorAll('#flowMultiSelectList .flow-select-item.selected').forEach(item => {
            selected.push(item.dataset.value);
        });
        
        const minSelect = currentFlow?.minSelect || 1;
        if (selected.length < minSelect) {
            showToast(`Seleccione al menos ${minSelect} elemento(s)`, 'err');
            return;
        }

        const nextData = AdaptiveCommandSystem.nextStep(selected);
        handleNextStep(nextData);
    }

    function flowNext() {
        if (!currentFlow) return;
        
        let value = null;

        if (currentFlow.type === 'form') {
            value = {};
            document.querySelectorAll('[data-field]').forEach(input => {
                const field = input.dataset.field;
                if (input.type === 'checkbox') {
                    value[field] = input.checked;
                } else {
                    value[field] = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
                }
            });
        } else if (currentFlow.type === 'coordinate') {
            value = {
                x: parseFloat(document.getElementById('coord-x')?.value || 0),
                y: parseFloat(document.getElementById('coord-y')?.value || 0),
                z: parseFloat(document.getElementById('coord-z')?.value || 0)
            };
        } else if (currentFlow.type === 'coordinateList') {
            value = [];
            document.querySelectorAll('#coordListContainer .flow-coords').forEach(row => {
                value.push({
                    x: parseFloat(row.querySelector('[data-axis="x"]')?.value || 0),
                    y: parseFloat(row.querySelector('[data-axis="y"]')?.value || 0),
                    z: parseFloat(row.querySelector('[data-axis="z"]')?.value || 0)
                });
            });
        } else if (currentFlow.type === 'text') {
            value = document.getElementById('flow-text-input')?.value || '';
        } else if (currentFlow.type === 'number') {
            value = parseFloat(document.getElementById('flow-number-input')?.value || 0);
        } else if (currentFlow.type === 'slider') {
            value = document.getElementById('flow-slider')?.value || '0.5';
        } else if (currentFlow.type === 'confirm') {
            value = true;
        }

        const nextData = AdaptiveCommandSystem.nextStep(value);
        handleNextStep(nextData);
    }

    function handleNextStep(nextData) {
        if (!nextData) {
            renderAssistedGrid();
            return;
        }

        if (nextData.finished) {
            if (nextData.executeImmediately && nextData.command) {
                executeTextCommand(nextData.command);
                renderAssistedGrid();
            } else if (nextData.command) {
                currentFlow = {
                    ...currentFlow,
                    isFinal: true,
                    command: nextData.command,
                    executeImmediately: nextData.executeImmediately,
                    commandName: nextData.commandName || currentFlow.commandName,
                    commandIcon: nextData.commandIcon || currentFlow.commandIcon,
                    progress: 100
                };
                renderFlowStep();
                return;
            }
            renderAssistedGrid();
            return;
        }

        currentFlow = nextData;
        renderFlowStep();
    }

    function flowBack() {
        if (!currentFlow) {
            renderAssistedGrid();
            return;
        }
        
        const prevData = AdaptiveCommandSystem.previousStep();
        if (prevData) {
            currentFlow = prevData;
            renderFlowStep();
        } else {
            renderAssistedGrid();
        }
    }

    function cancelFlow() {
        AdaptiveCommandSystem.resetFlow();
        currentFlow = null;
        renderAssistedGrid();
    }

    function executeFlowCommand() {
        let cmd = null;
        
        if (currentFlow && currentFlow.command) {
            cmd = currentFlow.command;
        } else {
            const stepData = AdaptiveCommandSystem.getCurrentStepData();
            if (stepData && stepData.command) {
                cmd = stepData.command;
            }
        }
        
        if (!cmd && currentFlow && currentFlow.commandPath) {
            const flow = AdaptiveCommandSystem.COMMAND_FLOWS[currentFlow.commandPath];
            if (flow) {
                const finalStep = flow.steps.find(s => s.isFinal && s.buildCommand);
                if (finalStep && finalStep.buildCommand) {
                    const selections = AdaptiveCommandSystem.getSelections ? 
                        AdaptiveCommandSystem.getSelections() : {};
                    cmd = finalStep.buildCommand(null, selections);
                }
            }
        }
        
        if (cmd) {
            executeTextCommand(cmd);
            showToast('✅ Comando ejecutado', 'ok');
            renderAssistedGrid();
        } else {
            showToast('❌ No se pudo construir el comando', 'err');
        }
    }

    function filterFlowItems() {
        const search = document.getElementById('flow-search')?.value?.toLowerCase() || '';
        document.querySelectorAll('#flowSelectList .flow-select-item, #flowMultiSelectList .flow-select-item').forEach(item => {
            const searchText = item.dataset.search || '';
            item.style.display = searchText.includes(search) ? '' : 'none';
        });
        document.querySelectorAll('.flow-cat-header').forEach(header => {
            let hasVisible = false;
            let next = header.nextElementSibling;
            while (next && !next.classList.contains('flow-cat-header')) {
                if (next.style.display !== 'none') hasVisible = true;
                next = next.nextElementSibling;
            }
            header.style.display = hasVisible ? '' : 'none';
        });
    }

    function addCoordRow() {
        const container = document.getElementById('coordListContainer');
        if (!container) return;
        const idx = container.children.length;
        const row = document.createElement('div');
        row.className = 'flow-coords';
        row.dataset.cidx = idx;
        row.innerHTML = `
            <input type="number" placeholder="X" value="0" data-axis="x">
            <input type="number" placeholder="Y" value="0" data-axis="y">
            <input type="number" placeholder="Z" value="0" data-axis="z">
            <button class="af-btn af-btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 6px;font-size:0.7em">✕</button>
        `;
        container.appendChild(row);
    }

    function refreshSpecField() {
        var materialField = document.getElementById('field-material');
        var specSelect = document.getElementById('field-spec');
        if (!specSelect) return;
        
        var material = materialField ? materialField.value : '';
        
        var specs = AdaptiveCommandSystem.getSpecOptions(material);
        
        specSelect.innerHTML = '<option value="">Seleccionar...</option>';
        
        specs.forEach(function(spec) {
            var opt = document.createElement('option');
            opt.value = spec.value;
            opt.textContent = spec.label;
            specSelect.appendChild(opt);
        });
    }

    function renderTextMode() {
        updateTitle('Comandos de Texto');
        currentFlow = null;

        document.getElementById('adaptive-body').innerHTML = `
            <div class="mode-tabs">
                <button class="mode-tab" data-mode="assisted" onclick="AdaptiveCommandUI.switchTab('assisted')">🧭 Asistido</button>
                <button class="mode-tab active" data-mode="text" onclick="AdaptiveCommandUI.switchTab('text')">⌨️ Texto</button>
            </div>
            <div class="text-console-output" id="textConsoleOutput">
                <div class="tco-line tco-info">💡 Consola de comandos. Escriba y presione Enter o ▶</div>
                <div class="tco-line tco-info">   Escriba "help" para ver todos los comandos disponibles.</div>
            </div>
            <div class="text-input-area">
                <input type="text" id="textCommandInput" placeholder="Ej: crear tanque_v TK-01 at (1000,2000,0) diam 1500 altura 2000 material PPR" 
                       onkeydown="if(event.key==='Enter')AdaptiveCommandUI.executeTextInput()">
                <button onclick="AdaptiveCommandUI.executeTextInput()">▶</button>
            </div>
            <div class="text-hints">
                <strong>Atajos:</strong> undo | redo | help | bom | audit<br>
                <strong>Crear:</strong> create [tipo] [tag] at (x,y,z) diam [d] altura [h] material [m]<br>
                <strong>Conectar:</strong> connect [origen] [puerto] to [destino] [puerto] diameter [d]<br>
                <strong>Línea:</strong> line [tag] from [eq] [port] to [eq] [port] diameter [d]<br>
                <strong>Info:</strong> info line/equipment [tag] | nodos [tag] | list equipos/lineas<br>
                <strong>Editar:</strong> edit line [tag] set material/diameter/spec [valor]
            </div>
        `;

        document.getElementById('adaptive-footer').innerHTML = `
            <button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand('help')">❓ Ayuda</button>
            <button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand('audit')">🔍 Auditar</button>
            <button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand('bom')">📊 BOM</button>
            <button class="af-btn af-btn-danger" onclick="AdaptiveCommandUI.closeOverlay()">Cerrar</button>
        `;

        setTimeout(() => {
            document.getElementById('textCommandInput')?.focus();
        }, 100);
    }

    function executeTextInput() {
        const input = document.getElementById('textCommandInput');
        if (!input) return;
        const cmd = input.value.trim();
        if (!cmd) return;
        
        addConsoleLine(cmd, 'cmd');
        executeTextCommand(cmd);
        input.value = '';
        input.focus();
    }

    function addConsoleLine(text, type) {
        const consoleEl = document.getElementById('textConsoleOutput');
        if (!consoleEl) return;
        
        const line = document.createElement('div');
        line.className = `tco-line tco-${type || 'info'}`;
        line.textContent = (type === 'cmd' ? '> ' : '') + text;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function executeTextCommand(cmd) {
        if (!cmd) return;
        
        if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommands.executeCommand === 'function') {
            const result = SmartFlowCommands.executeCommand(cmd);
            if (result) {
                addConsoleLine('✅ Ejecutado correctamente', 'ok');
                showToast('Comando ejecutado', 'ok');
            } else {
                addConsoleLine('❌ Comando no reconocido o sin efecto', 'err');
                showToast('Comando no reconocido', 'err');
            }
        } else {
            const textarea = document.getElementById('commandText');
            if (textarea) {
                textarea.value = cmd;
                const runBtn = document.getElementById('runCommands');
                if (runBtn) runBtn.click();
            }
        }
    }

    function runQuickCommand(cmd) {
        executeTextCommand(cmd);
    }

    function showToast(msg, type) {
        const existing = document.querySelector('.adaptive-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `adaptive-toast ${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 2500);
    }

    return {
        openPanel,
        closeOverlay,
        switchTab,
        filterCategory,
        startFlow,
        flowNext,
        flowBack,
        cancelFlow,
        executeFlowCommand,
        selectFlowOption,
        toggleMultiSelect,
        confirmMultiSelect,
        filterFlowItems,
        addCoordRow,
        executeTextInput,
        executeTextCommand,
        runQuickCommand,
        showToast,
        refreshSpecField
    };

})();
