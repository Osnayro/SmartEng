
// ============================================================
// MÓDULO: SMARTFLOW MAIN v6.4 (Con auto-centrado al añadir equipos)
// Archivo: js/main.js
// ============================================================

(function() {
    "use strict";
    
    // -------------------- DOM --------------------
    const canvasContainer = document.getElementById('canvas-container');
    const notificationEl = document.getElementById('notification');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const catalogPanel = document.getElementById('catalogPanel');
    const propertyPanel = document.getElementById('side-panel');
    const customElev = document.getElementById('customElev');
    
    // Botones
    const btnNew = document.getElementById('btnNew');
    const btnOpen = document.getElementById('btnOpen');
    const btnSave = document.getElementById('btnSave');
    const btnReset = document.getElementById('btnReset');
    const btnTopView = document.getElementById('btnTopView');
    const btnFrontView = document.getElementById('btnFrontView');
    const btnSideView = document.getElementById('btnSideView');
    const btnCommand = document.getElementById('btnCommand');
    const btnCloseCommand = document.getElementById('closeCommand');
    const btnRunCommands = document.getElementById('runCommands');
    const btnClearCommand = document.getElementById('clearCommand');
    const btnAddTank = document.getElementById('btnAddTank');
    const btnAddPump = document.getElementById('btnAddPump');
    const btnMTO = document.getElementById('btnMTO');
    const btnPDF = document.getElementById('btnPDF');
    const btnExportPCF = document.getElementById('btnExportPCF');
    const btnImportPCF = document.getElementById('btnImportPCF');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    const btnVoice = document.getElementById('btnVoice');
    const btnApplyNorm = document.getElementById('btnApplyNorm');
    const btnSpeakSummary = document.getElementById('btnSpeakSummary');
    const btnRecalc = document.getElementById('btnRecalc');
    const btnToggleCatalog = document.getElementById('btnToggleCatalog');
    const btnSetElev = document.getElementById('btnSetElev');
    const btnExportProject = document.getElementById('btnExportProject');
    const btnImportProject = document.getElementById('btnImportProject');
    
    // Herramientas
    const toolSelect = document.getElementById('toolSelect');
    const toolMoveEq = document.getElementById('toolMoveEq');
    const toolEditPipe = document.getElementById('toolEditPipe');
    const toolAddPoint = document.getElementById('toolAddPoint');
    
    // -------------------- Estado --------------------
    let toolMode = 'select';
    let voiceEnabled = true;
    let _unsubscribe = null;
    let previousEquiposCount = 0;
    let previousLinesCount = 0;
    let isFirstLoad = true;
    
    // -------------------- UI Helpers --------------------
    function notify(msg, isErr = false) {
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636';
            notificationEl.style.display = 'block';
        }
        if (statusMsgEl) statusMsgEl.innerHTML = msg;
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            setTimeout(() => window.speechSynthesis.speak(u), 50);
        }
        setTimeout(() => { if (notificationEl) notificationEl.style.display = 'none'; }, 4000);
    }
    
    function render() {
        if (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getSelected) {
            const selected = SmartFlowCore.getSelected();
            if (selected && propertyPanel && !propertyPanel.classList.contains('hidden')) {
                updatePropertyPanel(selected.obj);
            }
        }
    }
    
    // Función autoCenter mejorada: usa fitCameraToEquipments o fallback a vista iso
    function autoCenter() {
        if (typeof SmartFlowRender !== 'undefined' && SmartFlowRender.fitCameraToEquipments) {
            SmartFlowRender.fitCameraToEquipments();
        } else if (typeof SmartFlowRender !== 'undefined' && SmartFlowRender.setView) {
            SmartFlowRender.setView('iso');
            notify("Vista isométrica centrada (modo estándar).", false);
        } else {
            notify("Función de centrado no disponible.", true);
        }
    }
    
    function togglePanel(show) {
        if (propertyPanel) {
            if (show) propertyPanel.classList.remove('hidden');
            else propertyPanel.classList.add('hidden');
        }
    }
    
    function updatePropertyPanel(obj) {
        const content = document.getElementById('panel-content');
        if (!obj) { togglePanel(false); return; }
        togglePanel(true);
        const isLine = obj.points !== undefined || obj._cachedPoints !== undefined;
        content.innerHTML = `
            <div class="prop-group"><span class="prop-label">TAG</span><span class="prop-value">${obj.tag}</span></div>
            <div class="prop-group"><span class="prop-label">TIPO</span><span class="prop-value">${obj.tipo || (isLine ? 'Tubería' : 'Equipo')}</span></div>
            <div class="prop-group"><span class="prop-label">MATERIAL</span><span class="prop-value">${obj.material || 'N/A'}</span></div>
            <div class="prop-group"><span class="prop-label">DIÁMETRO</span><span class="prop-value">${obj.diameter || obj.diametro || '-'}"</span></div>
            <div class="prop-group"><span class="prop-label">ESPECIFICACIÓN</span><span class="prop-value">${obj.spec || 'N/A'}</span></div>
            <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
            <div class="prop-group"><span class="prop-label">POSICIÓN</span><span class="prop-value">X:${Math.round(obj.posX||0)} Y:${Math.round(obj.posY||0)} Z:${Math.round(obj.posZ||0)}</span></div>
            ${obj.puertos ? `
            <div class="prop-group"><span class="prop-label">PUERTOS</span>
                ${obj.puertos.map(p => `
                    <div class="port-item"><span>${p.id}</span><span class="${p.status === 'open' ? 'port-open' : 'port-connected'}">${p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO'}</span></div>
                `).join('')}
            </div>` : ''}
        `;
    }
    
    // -------------------- Proyecto --------------------
    function guardarProyecto() { const state = SmartFlowCore.exportProject(); localStorage.setItem('smartengp_v2_project', state); notify("Proyecto guardado.", false); }
    function cargarProyecto() { const data = localStorage.getItem('smartengp_v2_project'); if(data) try{ SmartFlowCore.importState(JSON.parse(data).data || JSON.parse(data)); autoCenter(); notify("Proyecto cargado.", false); }catch(e){ notify("Error al cargar.", true); } else notify("No hay proyecto guardado.", true); }
    function exportarProyectoArchivo() { const state = SmartFlowCore.exportProject(); const blob = new Blob([state], {type:'application/json'}); const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${window.currentProjectName || 'Proyecto'}_SmartEngp3D.json`; a.click(); notify("Proyecto exportado.", false); }
    function importarProyectoArchivo() { const input = document.createElement('input'); input.type='file'; input.accept='.json'; input.onchange=e=>{ const file=e.target.files[0]; if(file){ const reader=new FileReader(); reader.onload=ev=>{ try{ SmartFlowCore.importState(JSON.parse(ev.target.result).data || JSON.parse(ev.target.result)); autoCenter(); notify("Proyecto importado.", false); }catch(err){ notify("Error al importar.", true); } }; reader.readAsText(file); } }; input.click(); }
    function nuevoProyecto() { if(confirm("¿Nuevo proyecto? Se perderán cambios.")){ SmartFlowCore.clearProject(); autoCenter(); } }
    function resumenProyecto() { const equipos=SmartFlowCore.getEquipos(); const lines=SmartFlowCore.getLines(); const tanques=equipos.filter(e=>e.tipo==='tanque_v'||e.tipo==='tanque_h'); const bombas=equipos.filter(e=>e.tipo.includes('bomba')); let totalCodos=0,totalValvulas=0; lines.forEach(l=>{ if(l.components) l.components.forEach(c=>{ if(c.type&&c.type.includes('ELBOW')) totalCodos++; if(c.type&&c.type.includes('VALVE')) totalValvulas++; }); }); const msg=`Proyecto: ${tanques.length} tanques, ${bombas.length} bombas, ${lines.length} tuberías, ${totalCodos} codos, ${totalValvulas} válvulas.`; notify(msg,false); if(voiceEnabled&&window.speechSynthesis){ const u=new SpeechSynthesisUtterance(msg); u.lang='es-ES'; window.speechSynthesis.speak(u); } }
    
    // -------------------- Herramientas --------------------
    function setTool(mode) { toolMode=mode; [toolSelect,toolMoveEq,toolEditPipe,toolAddPoint].forEach(btn=>{ if(btn) btn.classList.remove('active'); }); if(mode==='select'&&toolSelect) toolSelect.classList.add('active'); else if(mode==='moveEq'&&toolMoveEq) toolMoveEq.classList.add('active'); else if(mode==='editPipe'&&toolEditPipe) toolEditPipe.classList.add('active'); else if(mode==='addPoint'&&toolAddPoint) toolAddPoint.classList.add('active'); }
    function setElevation(level) { if(typeof SmartFlowCore !== 'undefined' && SmartFlowCore.setElevation) SmartFlowCore.setElevation(level); if(customElev) customElev.value=level; }
    function toggleVoice() { voiceEnabled=!voiceEnabled; if(typeof SmartFlowCore !== 'undefined' && SmartFlowCore.setVoice) SmartFlowCore.setVoice(voiceEnabled); if(btnVoice) btnVoice.textContent=voiceEnabled?"Voz ON":"Voz OFF"; }
    
    // -------------------- Inicialización de módulos --------------------
    function initModules() {
        try {
            if (typeof SmartFlowCore !== 'undefined') {
                SmartFlowCore.init('canvas-container');
            } else {
                notify("Error: SmartFlowCore no cargado", true);
                return;
            }
            
            if (typeof SmartFlowCatalog !== 'undefined') {
                SmartFlowCore.registerVisualFactory(SmartFlowCatalog);
            } else {
                notify("Advertencia: Catálogo no disponible", false);
            }
            
            if (typeof SmartFlowRouter !== 'undefined') SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify);
            if (typeof SmartFlowRender !== 'undefined') SmartFlowRender.init(SmartFlowCore);
            if (typeof SmartFlowCommands !== 'undefined') SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRender, notify, ()=>{});
            if (typeof SmartFlowAccessibility !== 'undefined') SmartFlowAccessibility.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRender, notify);
            if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.init(SmartFlowCore, SmartFlowCatalog, notify);
            if (typeof SmartFlowLabels !== 'undefined') SmartFlowLabels.init(SmartFlowCore);
            if (commandText && typeof SmartFlowAutocomplete !== 'undefined') SmartFlowAutocomplete.init(commandText, SmartFlowCore, SmartFlowCatalog, SmartFlowCommands);
            
            // Contar elementos iniciales
            previousEquiposCount = SmartFlowCore.getEquipos().length;
            previousLinesCount = SmartFlowCore.getLines().length;
            
            if (typeof SmartFlowCore.subscribe === 'function') {
                _unsubscribe = SmartFlowCore.subscribe(() => {
                    const selected = SmartFlowCore.getSelected();
                    if (selected && selected.obj) updatePropertyPanel(selected.obj);
                    else if (propertyPanel && !propertyPanel.classList.contains('hidden')) togglePanel(false);
                    render();
                    
                    // Detectar si se agregó un equipo o línea nueva
                    const currentEquipos = SmartFlowCore.getEquipos().length;
                    const currentLines = SmartFlowCore.getLines().length;
                    
                    if (currentEquipos > previousEquiposCount || currentLines > previousLinesCount) {
                        previousEquiposCount = currentEquipos;
                        previousLinesCount = currentLines;
                        // Esperar a que se renderice el nuevo objeto
                        setTimeout(() => {
                            if (typeof SmartFlowRender !== 'undefined' && SmartFlowRender.fitCameraToEquipments) {
                                SmartFlowRender.fitCameraToEquipments();
                            }
                        }, 150);
                    } else {
                        previousEquiposCount = currentEquipos;
                        previousLinesCount = currentLines;
                    }
                });
            }
            
            notify("SmartFlow 3D - Sistema listo", false);
        } catch(e) {
            notify("Error en inicialización: " + e.message, true);
            console.error(e);
        }
    }
    
    // -------------------- Atajos teclado --------------------
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (document.activeElement && document.activeElement.id === 'commandText') return;
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); if(commandPanel) commandPanel.style.display='block'; if(commandText) commandText.focus(); break;
                    case 'R': e.preventDefault(); resumenProyecto(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'U': e.preventDefault(); if(typeof SmartFlowCore !== 'undefined') SmartFlowCore.undo(); render(); break;
                    case 'Y': e.preventDefault(); if(typeof SmartFlowCore !== 'undefined') SmartFlowCore.redo(); render(); break;
                    case 'M': e.preventDefault(); if(typeof SmartFlowIO !== 'undefined' && SmartFlowIO.exportMTO) SmartFlowIO.exportMTO(); break;
                    case 'P': e.preventDefault(); if(typeof SmartFlowIO !== 'undefined' && SmartFlowIO.exportPDF) SmartFlowIO.exportPDF(); break;
                    case 'E': e.preventDefault(); if(typeof SmartFlowIO !== 'undefined' && SmartFlowIO.exportPCF) SmartFlowIO.exportPCF(); break;
                }
            }
        });
    }
    
    // -------------------- Canvas events (mover equipo) --------------------
    function initCanvasEvents() {
        if (!canvasContainer) return;
        let dragging = false, draggedEquip = null, lastPos = {x:0, y:0};
        canvasContainer.addEventListener('mousedown', (e) => {
            if (toolMode !== 'moveEq') return;
            const selected = (typeof SmartFlowCore !== 'undefined') ? SmartFlowCore.getSelected() : null;
            if (selected && selected.type === 'equipment') {
                dragging = true; draggedEquip = selected.obj; lastPos = {x: e.clientX, y: e.clientY};
                canvasContainer.style.cursor = 'grabbing'; e.preventDefault();
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging || !draggedEquip) return;
            const dx = (e.clientX - lastPos.x) / 2, dy = (e.clientY - lastPos.y) / 2;
            if (typeof SmartFlowCore !== 'undefined') {
                SmartFlowCore.updateEquipment(draggedEquip.tag, { posX: (draggedEquip.posX||0)+dx, posZ: (draggedEquip.posZ||0)+dy });
            }
            lastPos = {x: e.clientX, y: e.clientY};
        });
        window.addEventListener('mouseup', () => { dragging = false; draggedEquip = null; canvasContainer.style.cursor = 'default'; });
    }
    
    // -------------------- Botones --------------------
    function bindEvents() {
        const vincular = (id, accion) => { const el = document.getElementById(id); if (el) el.onclick = accion; else console.warn("Botón no encontrado:", id); };
        
        vincular('btnNew', nuevoProyecto);
        vincular('btnOpen', cargarProyecto);
        vincular('btnSave', guardarProyecto);
        vincular('btnExportProject', exportarProyectoArchivo);
        vincular('btnImportProject', importarProyectoArchivo);
        vincular('btnReset', autoCenter);  // AHORA USA autoCenter QUE LLAMA A fitCameraToEquipments
        vincular('btnTopView', () => { if (typeof SmartFlowRender !== 'undefined') SmartFlowRender.setView('top'); });
        vincular('btnFrontView', () => { if (typeof SmartFlowRender !== 'undefined') SmartFlowRender.setView('front'); });
        vincular('btnSideView', () => { if (typeof SmartFlowRender !== 'undefined') SmartFlowRender.setView('side'); });
        vincular('btnCommand', () => { if (commandPanel) commandPanel.style.display = 'block'; });
        vincular('closeCommand', () => { if (commandPanel) commandPanel.style.display = 'none'; });
        vincular('clearCommand', () => { if (commandText) commandText.value = ''; });
        vincular('runCommands', () => {
            if (!commandText) return;
            const cmd = commandText.value.trim();
            let processed = false;
            if (typeof SmartFlowAccessibility !== 'undefined') processed = SmartFlowAccessibility.processAccessibilityCommand(cmd);
            if (!processed && typeof SmartFlowCommands !== 'undefined') SmartFlowCommands.executeBatch(cmd);
            commandText.value = '';
            if (commandPanel) commandPanel.style.display = 'none';
            if (typeof SmartFlowAutocomplete !== 'undefined') SmartFlowAutocomplete.hideSuggestions();
        });
        vincular('btnAddTank', () => {
            const equipos = SmartFlowCore.getEquipos();
            const tag = `TK-${equipos.filter(e=>e.tipo==='tanque_v').length+1}`;
            const ult = equipos[equipos.length-1];
            const x = ult ? ult.posX+3000 : 0;
            if (typeof SmartFlowCommands !== 'undefined') SmartFlowCommands.executeCommand(`create tanque_v ${tag} at (${x},1450,0) diam 2380 altura 2900 material CS`);
        });
        vincular('btnAddPump', () => {
            const equipos = SmartFlowCore.getEquipos();
            const tag = `B-${equipos.filter(e=>e.tipo.includes('bomba')).length+1}`;
            const ult = equipos[equipos.length-1];
            const x = ult ? ult.posX+3000 : 5000;
            if (typeof SmartFlowCommands !== 'undefined') SmartFlowCommands.executeCommand(`create bomba ${tag} at (${x},800,0) diam 800 altura 800`);
        });
        vincular('toolSelect', ()=>setTool('select'));
        vincular('toolMoveEq', ()=>setTool('moveEq'));
        vincular('toolEditPipe', ()=>setTool('editPipe'));
        vincular('toolAddPoint', ()=>setTool('addPoint'));
        
        vincular('btnMTO', () => { if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.exportMTO) SmartFlowIO.exportMTO(); else notify("MTO no disponible", true); });
        vincular('btnPDF', () => { if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.exportPDF) SmartFlowIO.exportPDF(); else notify("PDF no disponible", true); });
        vincular('btnExportPCF', () => { if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.exportPCF) SmartFlowIO.exportPCF(); else notify("Export PCF no disponible", true); });
        vincular('btnImportPCF', () => {
            if (typeof SmartFlowIO === 'undefined' || !SmartFlowIO.importPCF) { notify("Import PCF no disponible", true); return; }
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pcf,.txt';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => SmartFlowIO.importPCF(ev.target.result);
                    reader.readAsText(file);
                }
            };
            input.click();
        });
        vincular('btnUndo', () => { if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.undo(); render(); });
        vincular('btnRedo', () => { if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.redo(); render(); });
        vincular('btnVoice', toggleVoice);
        vincular('btnSpeakSummary', resumenProyecto);
        vincular('btnRecalc', () => { if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.syncPhysicalData(); render(); });
        vincular('btnSetElev', () => { const val = parseInt(customElev?.value); if (!isNaN(val)) setElevation(val); });
        vincular('btnApplyNorm', () => notify("Función de normas en desarrollo.", false));
        vincular('btnToggleCatalog', () => { if (catalogPanel) catalogPanel.style.display = catalogPanel.style.display==='none' ? 'flex' : 'none'; });
        
        window.addEventListener('resize', () => {
            if (typeof SmartFlowCore !== 'undefined') {
                const camera = SmartFlowCore.getCamera?.();
                const renderer = SmartFlowCore.getRenderer?.();
                if (camera && renderer && canvasContainer) {
                    camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
                }
            }
        });
    }
    
    // -------------------- Arranque --------------------
    function init() {
        initModules();
        bindEvents();
        initCanvasEvents();
        setupKeyboardShortcuts();
        setTool('select');
        setElevation(0);
        // Al arrancar, centrar la vista después de que todo esté cargado
        setTimeout(() => {
            if (typeof SmartFlowRender !== 'undefined' && SmartFlowRender.fitCameraToEquipments) {
                SmartFlowRender.fitCameraToEquipments();
            } else if (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getCamera) {
                autoCenter();
            }
        }, 200);
    }
    
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
