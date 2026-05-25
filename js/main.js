
// ============================================================
// SMARTFLOW ORCHESTRATOR v4.0 - Motor Dual 2D/3D
// Archivo: js/main.js
// ============================================================

(function() {
    "use strict";
    
    // ================================================================
    // 1. REFERENCIAS AL DOM
    // ================================================================
    const canvas2D = document.getElementById('isoCanvas');
    const container3D = document.getElementById('three-container');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const sidePanel = document.getElementById('side-panel');
    const panelContent = document.getElementById('panel-content');
    const splashScreen = document.getElementById('splash-screen');
    const welcomePanel = document.getElementById('welcome-panel');
    const projectModal = document.getElementById('project-name-modal');
    const projectInput = document.getElementById('project-name-input');
    const motorSelect = document.getElementById('tres-de');
    
    // ================================================================
    // 2. ESTADO GLOBAL
    // ================================================================
    let currentMotor = '3d';  // '2d' o '3d'
    let voiceEnabled = true;
    window._commandHistory = window._commandHistory || [];
    
    // ================================================================
    // 3. SISTEMA DE NOTIFICACIONES
    // ================================================================
    function notify(message, isError) {
        isError = isError || false;
        if (typeof SmartFlowNotifications !== 'undefined') {
            SmartFlowNotifications.notify(message, isError ? 'error' : 'info', { sound: true, console: true });
        }
        if (statusMsgEl) {
            statusMsgEl.textContent = message;
            statusMsgEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
    }
    
    function voiceFn(message) {
        if (typeof SmartFlowNotifications !== 'undefined') {
            SmartFlowNotifications.speak(message, false);
        } else if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(message);
            u.lang = 'es-ES';
            window.speechSynthesis.speak(u);
        }
    }
    
    // ================================================================
    // 4. DETECCIÓN DE MOTOR ACTIVO
    // ================================================================
    function is2D() { return currentMotor === '2d'; }
    function is3D() { return currentMotor === '3d'; }
    
    // ================================================================
    // 5. RENDERIZADO Y ACTUALIZACIÓN (SEGÚN MOTOR ACTIVO)
    // ================================================================
    function scheduleRender() {
        if (is2D() && typeof SmartFlowRenderer !== 'undefined') {
            SmartFlowRenderer.render();
        }
        if (is3D() && typeof SmartFlowRenderer3D !== 'undefined' && SmartFlowRenderer3D.isReady()) {
            SmartFlowRenderer3D.rebuildScene();
        }
        if (typeof SmartFlowAnnotations !== 'undefined') {
            SmartFlowAnnotations.markDirty();
        }
    }
    
    function autoCenter() {
        if (is2D() && typeof SmartFlowRenderer !== 'undefined') {
            SmartFlowRenderer.autoCenter();
            notify("✅ Vista centrada (2D)", false);
        }
        if (is3D() && typeof SmartFlowRenderer3D !== 'undefined' && SmartFlowRenderer3D.isReady()) {
            SmartFlowRenderer3D.zoomToFit();
            notify("✅ Zoom Fit aplicado (3D)", false);
        }
    }
    
    // ================================================================
    // 6. CAMBIO DE MOTOR (2D ↔ 3D)
    // ================================================================
    function switchMotor(mode) {
        if (mode === currentMotor) return;
        currentMotor = mode;
        
        if (mode === '2d') {
            // Activar 2D
            if (canvas2D) canvas2D.classList.add('active');
            if (container3D) container3D.classList.remove('active');
            if (typeof SmartFlowRenderer !== 'undefined') {
                SmartFlowRenderer.resizeCanvas();
                SmartFlowRenderer.autoCenter();
                SmartFlowRenderer.render();
            }
            // Desactivar anotaciones 3D
            const annLayer = document.getElementById('annotation-layer');
            if (annLayer) annLayer.classList.remove('active');
            notify("⚫ Motor 2D activado", false);
        } else {
            // Activar 3D
            if (canvas2D) canvas2D.classList.remove('active');
            if (container3D) container3D.classList.add('active');
            if (typeof SmartFlowRenderer3D !== 'undefined' && SmartFlowRenderer3D.isReady()) {
                SmartFlowRenderer3D.rebuildScene();
                SmartFlowRenderer3D.zoomToFit();
            }
            // Activar anotaciones
            const annLayer = document.getElementById('annotation-layer');
            if (annLayer) annLayer.classList.add('active');
            notify("🔷 Motor 3D activado", false);
        }
        
        if (motorSelect) motorSelect.value = mode;
    }
    
    // ================================================================
    // 7. VISTAS DE CÁMARA (BOTONES INTELIGENTES)
    // ================================================================
    function setView(viewName) {
        if (is2D()) {
            // En 2D: ISO = autoCenter, TOP/FRONT no aplican → autoCenter
            if (typeof SmartFlowRenderer !== 'undefined') {
                SmartFlowRenderer.autoCenter();
            }
            notify("🔭 Vista centrada (2D)", false);
        }
        if (is3D() && typeof SmartFlowRenderer3D !== 'undefined' && SmartFlowRenderer3D.isReady()) {
            SmartFlowRenderer3D.setView(viewName);
            notify("🔭 Vista: " + viewName.toUpperCase() + " (3D)", false);
        }
    }
    
    // ================================================================
    // 8. PANEL DE PROPIEDADES
    // ================================================================
    function updatePropertyPanel(info) {
        if (!panelContent) return;
        if (!info) {
            if (sidePanel) sidePanel.classList.add('hidden');
            return;
        }
        if (sidePanel) sidePanel.classList.remove('hidden');
        
        let html = '';
        html += '<div class="prop-group"><span class="prop-label">TAG</span><span class="prop-value" style="color:var(--accent-cyan);">' + (info.tag || 'N/A') + '</span></div>';
        html += '<div class="prop-group"><span class="prop-label">TIPO</span><span class="prop-value">' + (info.tipo || 'Desconocido') + '</span></div>';
        html += '<div class="prop-group"><span class="prop-label">MATERIAL</span><span class="prop-value">' + (info.material || 'N/A') + '</span></div>';
        html += '<div class="prop-group"><span class="prop-label">DIÁMETRO</span><span class="prop-value">' + (info.diametro || 'N/A') + '</span></div>';
        if (info.dimensiones) {
            html += '<div class="prop-group"><span class="prop-label">POSICIÓN</span><span class="prop-value">(' + 
                (info.dimensiones.posX || 0).toFixed(0) + ', ' + (info.dimensiones.posY || 0).toFixed(0) + ', ' + (info.dimensiones.posZ || 0).toFixed(0) + ')</span></div>';
        }
        if (info.spool) {
            html += '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">';
            html += '<div class="prop-group"><span class="prop-label">LONGITUD TOTAL</span><span class="prop-value">' + info.spool.longitudTotalM + ' m</span></div>';
            html += '<div class="prop-group"><span class="prop-label">JUNTAS ESTIMADAS</span><span class="prop-value">' + info.spool.juntasEstimadas + '</span></div>';
        }
        html += '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">';
        html += '<div class="prop-group"><span class="prop-label">PUERTOS</span>';
        if (info.puertos && info.puertos.length) {
            info.puertos.forEach(function(p) {
                html += '<div class="port-item"><span>' + p.id + ' ⌀' + (p.diametro || '?') + '"</span>';
                html += '<span class="' + (p.status === 'open' ? 'port-open' : 'port-connected') + '">' + 
                        (p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO a ' + (p.connectedTo || '')) + '</span></div>';
            });
        } else {
            html += '<p style="color:#64748b; font-size:11px;">Sin puertos</p>';
        }
        html += '</div>';
        panelContent.innerHTML = html;
    }
    
    function closePanel() {
        if (sidePanel) sidePanel.classList.add('hidden');
        if (is3D() && typeof SmartFlowRenderer3D !== 'undefined') {
            SmartFlowRenderer3D.deselectObject();
        }
    }
    
    // ================================================================
    // 9. INICIALIZACIÓN DE MÓDULOS
    // ================================================================
    function initModules() {
        console.log('🚀 Inicializando SmartEngp Dual (2D/3D)...');
        
        // 1. Core
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('  ✅ Core v5.5');
        
        // 2. Notificaciones
        if (typeof SmartFlowNotifications !== 'undefined') {
            SmartFlowNotifications.init({
                toastEnabled: true, toastPosition: 'bottom-right',
                soundEnabled: true, voiceEnabled: voiceEnabled,
                voiceRate: 1.1, voiceLang: 'es-ES', consoleEnabled: true
            });
            console.log('  ✅ Notificaciones');
        }
        
        // 3. Router
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify, scheduleRender);
            console.log('  ✅ Router');
        }
        
        // 4. Motor 2D
        if (typeof SmartFlowRenderer !== 'undefined' && canvas2D) {
            SmartFlowRenderer.init(canvas2D, SmartFlowCore, notify);
            console.log('  ✅ Motor 2D');
        }
        
        // 5. Motor 3D
        if (typeof SmartFlowRenderer3D !== 'undefined' && container3D) {
            setTimeout(function() {
                const success = SmartFlowRenderer3D.init(container3D, SmartFlowCore, SmartFlowCatalog, {
                    enableShadows: true, isoAngle: 30, backgroundColor: 0x0a0e17
                });
                if (success) {
                    console.log('  ✅ Motor 3D');
                    SmartFlowRenderer3D.onSelection(function(selectionData) {
                        if (selectionData && selectionData.obj) {
                            updatePropertyPanel(SmartFlowCore.getPropertyInfo(selectionData.obj.tag));
                        } else {
                            updatePropertyPanel(null);
                        }
                        if (typeof SmartFlowAnnotations !== 'undefined') SmartFlowAnnotations.markDirty();
                    });
                } else {
                    console.error('  ❌ Motor 3D falló');
                }
            }, 150);
        }
        
        // 6. Anotaciones
        if (typeof SmartFlowAnnotations !== 'undefined' && container3D) {
            setTimeout(function() {
                SmartFlowAnnotations.init(container3D, SmartFlowCore, SmartFlowRenderer3D, SmartFlowCatalog, {
                    standard: 'ISA', showEquipmentTags: true, showPipeTags: true,
                    showDimensions: true, showBOMTable: false, showFlowArrows: true,
                    showNorthArrow: true, showElevationMarkers: true, dualDimension: true
                });
                console.log('  ✅ Anotaciones');
            }, 300);
        }
        
        // 7. Comandos
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer3D, notify, scheduleRender, voiceFn);
        console.log('  ✅ Comandos');
        
        if (typeof SmartFlowNotifications !== 'undefined' && typeof SmartFlowRenderer3D !== 'undefined') {
            SmartFlowNotifications.setRenderer3D(SmartFlowRenderer3D);
        }
        
        SmartFlowCore.setVoice(voiceEnabled);
        
        // Activar motor por defecto (3D)
        switchMotor('3d');
        
        notify("SmartEngp 2D/3D - Sistema listo", false);
        console.log('🎯 Todos los módulos inicializados');
    }
    
    // ================================================================
    // 10. GESTIÓN DE PROYECTOS
    // ================================================================
    function guardarProyecto() {
        localStorage.setItem('smartengp_dual_project', SmartFlowCore.exportProject());
        notify("✅ Proyecto guardado", false);
    }
    
    function cargarProyecto() {
        const data = localStorage.getItem('smartengp_dual_project');
        if (data) {
            try {
                SmartFlowCore.importState(JSON.parse(data).data || JSON.parse(data));
                scheduleRender(); autoCenter();
                notify("✅ Proyecto cargado", false);
            } catch (e) { notify("Error al cargar", true); }
        } else { notify("No hay proyecto guardado", true); }
    }
    
    function exportarProyectoArchivo() {
        const blob = new Blob([SmartFlowCore.exportProject()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (window.currentProjectName || 'Proyecto') + '_SmartEngp.json';
        a.click();
        notify("✅ Proyecto exportado", false);
    }
    
    function importarProyectoArchivo() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const state = JSON.parse(ev.target.result);
                    SmartFlowCore.importState(state.data || state);
                    scheduleRender(); autoCenter();
                    notify("✅ Proyecto importado", false);
                } catch (err) { notify("Error al importar", true); }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    function nuevoProyecto() {
        if (confirm("¿Crear nuevo proyecto? Se perderán los cambios no guardados.")) {
            SmartFlowCore.nuevoProyecto();
            scheduleRender(); autoCenter();
            notify("✅ Nuevo proyecto creado", false);
        }
    }
    
    function iniciarNuevoProyecto() {
        const name = projectInput ? projectInput.value.trim() : '';
        if (name) window.currentProjectName = name;
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        SmartFlowCore.nuevoProyecto();
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + (window.currentProjectName || 'Sin nombre') + ' | SmartEngp';
        scheduleRender(); autoCenter();
    }
    
    function saltarNombreProyecto() {
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + (window.currentProjectName || 'Sin nombre') + ' | SmartEngp';
    }
    
    // ================================================================
    // 11. MTO, AUDITORÍA, EXPORTACIONES
    // ================================================================
    function exportarMTO() {
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        let items = [];
        equipos.forEach(function(eq) {
            if (eq.tipo !== 'colector' && eq.tipo !== 'plataforma') items.push([eq.tag, eq.tipo || 'Equipo', "Und", 1]);
        });
        lines.forEach(function(line) {
            let length = 0;
            const pts = SmartFlowCore.getLinePoints(line);
            if (pts) for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            items.push([line.tag, 'Tubo ' + (line.material || 'N/D') + ' ' + (line.diameter || '?') + '" ' + (line.spec || ''), "m", (length / 1000).toFixed(2)]);
            if (line.components) line.components.forEach(function(comp) { items.push([comp.tag || 'COMP-' + line.tag, comp.type || 'Componente', "Und", 1]); });
        });
        if (items.length === 0) { notify("No hay elementos", true); return; }
        const ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripción", "Unidad", "Cantidad"]].concat(items));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, 'MTO_' + (window.currentProjectName || 'Proyecto') + '_' + Date.now() + '.xlsx');
        notify("✅ MTO exportado", false);
    }
    
    function auditarModelo() {
        if (SmartFlowCore.auditModel) { notify(SmartFlowCore.auditModel(), false); }
    }
    
    function exportarPDF() {
        if (is2D() && typeof SmartFlowRenderer !== 'undefined') {
            SmartFlowRenderer.exportPDF();
            return;
        }
        if (is3D() && typeof SmartFlowRenderer3D !== 'undefined' && SmartFlowRenderer3D.isReady()) {
            const renderer = SmartFlowRenderer3D.getRenderer();
            if (!renderer) return;
            const canvas3D = renderer.domElement;
            const combined = document.createElement('canvas');
            combined.width = canvas3D.width; combined.height = canvas3D.height;
            const ctx = combined.getContext('2d');
            ctx.drawImage(canvas3D, 0, 0);
            const annCanvas = (typeof SmartFlowAnnotations !== 'undefined') ? SmartFlowAnnotations.getCanvas() : null;
            if (annCanvas) ctx.drawImage(annCanvas, 0, 0);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('landscape', 'mm', 'a3');
            pdf.addImage(combined.toDataURL('image/png'), 'PNG', 5, 5, pdf.internal.pageSize.getWidth() - 10, pdf.internal.pageSize.getHeight() - 10);
            pdf.save('Isometrico_' + (window.currentProjectName || 'Proyecto') + '.pdf');
            notify("✅ PDF generado", false);
        }
    }
    
    function exportarPCF() {
        if (is2D() && typeof SmartFlowRenderer !== 'undefined') {
            SmartFlowRenderer.exportPCF();
            return;
        }
        const lines = SmartFlowCore.getLines();
        if (lines.length === 0) { notify("No hay líneas", true); return; }
        let pcf = '';
        lines.forEach(function(line) {
            pcf += 'PIPE\n    ITEM-CODE ' + line.tag + '\n    PIPING-SPEC ' + (line.spec || 'STD') + '\n    MATERIAL ' + (line.material || 'N/D') + '\n    DIAMETER ' + ((line.diameter || 4) * 25.4) + '\n';
            const pts = SmartFlowCore.getLinePoints(line) || [];
            for (let i = 0; i < pts.length - 1; i++) pcf += '    END-POINT ' + pts[i].x.toFixed(3) + ' ' + pts[i].y.toFixed(3) + ' ' + pts[i].z.toFixed(3) + ' ' + pts[i+1].x.toFixed(3) + ' ' + pts[i+1].y.toFixed(3) + ' ' + pts[i+1].z.toFixed(3) + '\n';
            pcf += '\n';
        });
        const blob = new Blob([pcf], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (window.currentProjectName || 'Proyecto') + '.pcf';
        a.click();
        notify("✅ PCF exportado", false);
    }
    
    function importarPCF() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.pcf,.txt';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) { SmartFlowCommands.importPCF(ev.target.result); scheduleRender(); autoCenter(); };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    // ================================================================
    // 12. RESUMEN DEL PROYECTO
    // ================================================================
    function resumenProyecto() {
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        const tanquesV = equipos.filter(function(e) { return e.tipo === 'tanque_v'; });
        const tanquesH = equipos.filter(function(e) { return e.tipo === 'tanque_h'; });
        const bombas = equipos.filter(function(e) { return e.tipo && e.tipo.includes('bomba'); });
        const intercambiadores = equipos.filter(function(e) { return e.tipo === 'intercambiador' || e.tipo === 'condensador'; });
        const plataformas = equipos.filter(function(e) { return e.tipo === 'plataforma'; });
        const otros = equipos.length - tanquesV.length - tanquesH.length - bombas.length - intercambiadores.length - plataformas.length;
        
        let totalCodos = 0, totalTees = 0, totalValvulas = 0, longitudTotal = 0;
        lines.forEach(function(l) {
            const pts = SmartFlowCore.getLinePoints(l) || [];
            for (let i = 0; i < pts.length - 1; i++) longitudTotal += Math.sqrt(Math.pow(pts[i+1].x-pts[i].x,2) + Math.pow(pts[i+1].y-pts[i].y,2) + Math.pow(pts[i+1].z-pts[i].z,2));
            if (l.components) l.components.forEach(function(c) {
                const type = (c.type || '').toUpperCase();
                if (type.includes('ELBOW')) totalCodos++;
                else if (type.includes('TEE')) totalTees++;
                else if (type.includes('VALVE')) totalValvulas++;
            });
        });
        
        let msg = '═══════════════════════════════════\n    📋 RESUMEN DEL PROYECTO\n       ' + (window.currentProjectName || 'Sin nombre') + '\n═══════════════════════════════════\n\n';
        msg += '🏭 EQUIPOS (' + equipos.length + '):\n';
        if (tanquesV.length) msg += '  • Tanques Verticales: ' + tanquesV.length + '\n';
        if (tanquesH.length) msg += '  • Tanques Horizontales: ' + tanquesH.length + '\n';
        if (bombas.length) msg += '  • Bombas: ' + bombas.length + '\n';
        if (intercambiadores.length) msg += '  • Intercambiadores: ' + intercambiadores.length + '\n';
        if (plataformas.length) msg += '  • Plataformas: ' + plataformas.length + '\n';
        if (otros > 0) msg += '  • Otros: ' + otros + '\n';
        msg += '\n📏 TUBERÍAS (' + lines.length + '):\n  • Longitud total: ' + (longitudTotal / 1000).toFixed(2) + ' m\n';
        const totalComp = totalCodos + totalTees + totalValvulas;
        if (totalComp > 0) msg += '\n🔩 COMPONENTES (' + totalComp + '):\n  • Codos: ' + totalCodos + '\n  • Tees: ' + totalTees + '\n  • Válvulas: ' + totalValvulas + '\n';
        msg += '\n═══════════════════════════════════';
        notify(msg, false);
    }
    
    // ================================================================
    // 13. CONSOLA DE COMANDOS
    // ================================================================
    const _commandHistory = [];
    const MAX_HISTORY = 100;
    let _historyIndex = -1;
    let _tempCommand = '';
    
    function addToHistory(cmd) {
        const trimmed = cmd.trim();
        if (!trimmed) return;
        if (_commandHistory.length > 0 && _commandHistory[_commandHistory.length - 1] === trimmed) return;
        _commandHistory.push(trimmed);
        if (_commandHistory.length > MAX_HISTORY) _commandHistory.shift();
        _historyIndex = _commandHistory.length;
        window._commandHistory = _commandHistory.slice();
        updateHistoryIndicator();
    }
    
    function updateHistoryIndicator() {
        const indicator = document.getElementById('historyIndicator');
        if (indicator) indicator.textContent = _commandHistory.length > 0 ? '⏺ ' + _commandHistory.length + ' comandos (↑↓ para navegar)' : '';
    }
    
    function navigateHistory(direction) {
        if (!commandText) return;
        if (_historyIndex === _commandHistory.length) _tempCommand = commandText.value;
        if (direction === 'up' && _historyIndex > 0) { _historyIndex--; commandText.value = _commandHistory[_historyIndex]; }
        else if (direction === 'down' && _historyIndex < _commandHistory.length - 1) { _historyIndex++; commandText.value = _commandHistory[_historyIndex]; }
        else if (direction === 'down' && _historyIndex === _commandHistory.length - 1) { _historyIndex++; commandText.value = _tempCommand || ''; }
    }
    
    function abrirPanelComandos() {
        if (commandPanel) { commandPanel.style.display = 'block'; if (commandText) commandText.focus(); }
    }
    
    function ejecutarComando() {
        if (!commandText) return;
        const textoCompleto = commandText.value.trim();
        if (!textoCompleto) return;
        const lineas = textoCompleto.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        let success = true;
        if (lineas.length === 1) { success = SmartFlowCommands.executeCommand(lineas[0]) !== false; }
        else { success = SmartFlowCommands.executeBatch(lineas.join('\n')) > 0; }
        if (success) addToHistory(textoCompleto);
        commandText.value = '';
        _historyIndex = _commandHistory.length;
        scheduleRender();
        const primera = lineas[0].toLowerCase();
        const infoCommands = ['info', 'coordenadas', 'nodos', 'listar', 'list', 'ayuda', 'help', 'bom', 'mto', 'audit', 'measure', 'medir', 'distancia', 'macro list', 'macro lista', 'resumen'];
        if (!infoCommands.some(function(c) { return primera.startsWith(c); }) && commandPanel) commandPanel.style.display = 'none';
    }
    
    // ================================================================
    // 14. TOGGLE VOZ Y FULLSCREEN
    // ================================================================
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        SmartFlowCore.setVoice(voiceEnabled);
        if (typeof SmartFlowNotifications !== 'undefined') SmartFlowNotifications.toggleVoice(voiceEnabled);
        const btnVoice = document.getElementById('btnVoice');
        if (btnVoice) { btnVoice.textContent = voiceEnabled ? '🔊' : '🔇'; btnVoice.style.color = voiceEnabled ? '' : '#ef4444'; }
        notify(voiceEnabled ? "✅ Voz activada" : "🔇 Voz desactivada", false);
    }
    
    function toggleFullscreen() { document.body.classList.add('fullscreen-mode'); autoCenter(); }
    function exitFullscreen() { document.body.classList.remove('fullscreen-mode'); autoCenter(); }
    
    // ================================================================
    // 15. ATAJOS DE TECLADO
    // ================================================================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            const activeEl = document.activeElement;
            const isInCommandPanel = activeEl && activeEl.id === 'commandText';
            if (e.ctrlKey && e.shiftKey && !isInCommandPanel) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); abrirPanelComandos(); break;
                    case 'R': e.preventDefault(); resumenProyecto(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); notify("↩️ Deshecho", false); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); notify("↪️ Rehecho", false); break;
                    case 'M': e.preventDefault(); exportarMTO(); break;
                    case 'P': e.preventDefault(); exportarPDF(); break;
                    case 'E': e.preventDefault(); exportarPCF(); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                    case 'A': e.preventDefault(); auditarModelo(); break;
                }
            }
            if (e.key === 'Escape') {
                if (commandPanel && commandPanel.style.display === 'block') commandPanel.style.display = 'none';
                closePanel();
            }
        });
    }
    
    // ================================================================
    // 16. CABLEADO DE BOTONES
    // ================================================================
    function bindEvents() {
        function vincular(id, accion) {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', accion);
        }
        
        vincular('welcome-new-project', function() { if (projectModal) projectModal.style.display = 'flex'; });
        vincular('welcome-open-project', function() { cargarProyecto(); if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); });
        vincular('modal-accept', iniciarNuevoProyecto);
        vincular('modal-skip', saltarNombreProyecto);
        
        vincular('btnNew', nuevoProyecto);
        vincular('btnOpen', cargarProyecto);
        vincular('btnSave', guardarProyecto);
        vincular('btnExportProject', exportarProyectoArchivo);
        vincular('btnImportProject', importarProyectoArchivo);
        vincular('btnExportPCF', exportarPCF);
        vincular('btnImportPCF', importarPCF);
        
        vincular('btnUndo', function() { SmartFlowCore.undo(); scheduleRender(); notify("↩️ Deshecho", false); });
        vincular('btnRedo', function() { SmartFlowCore.redo(); scheduleRender(); notify("↪️ Rehecho", false); });
        
        // Vistas (inteligentes: llaman a la función correcta según motor)
        vincular('btnViewIso', function() { setView('iso'); });
        vincular('btnViewTop', function() { setView('top'); });
        vincular('btnViewFront', function() { setView('front'); });
        vincular('btnZoomFit', autoCenter);
        
        vincular('btnCommand', abrirPanelComandos);
        vincular('closeCommand', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        vincular('clearCommand', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; } });
        vincular('runCommands', ejecutarComando);
        
        vincular('btnFullscreen', toggleFullscreen);
        vincular('btnFullscreenCenter', autoCenter);
        vincular('btnFullscreenExit', exitFullscreen);
        vincular('btnVoice', toggleVoice);
        vincular('btnMTO', exportarMTO);
        vincular('btnPDF', exportarPDF);
        vincular('btnAudit', auditarModelo);
        vincular('btnSummary', resumenProyecto);
        vincular('btnClosePanel', closePanel);
        
        // Equipos rápidos
        vincular('btnAddTank', function() {
            const eqs = SmartFlowCore.getEquipos();
            const tag = 'TK-' + (eqs.filter(function(e) { return e.tipo === 'tanque_v'; }).length + 1);
            const ult = eqs[eqs.length - 1]; const x = ult ? ult.posX + 4000 : 0;
            SmartFlowCommands.executeCommand('create tanque_v ' + tag + ' at (' + x + ',1500,0) diam 2000 height 3000 material CS spec ACERO_150_RF');
            scheduleRender(); notify("✅ " + tag + " creado", false);
        });
        vincular('btnAddPump', function() {
            const eqs = SmartFlowCore.getEquipos();
            const tag = 'P-' + (eqs.filter(function(e) { return e.tipo && e.tipo.includes('bomba'); }).length + 1);
            const ult = eqs[eqs.length - 1]; const x = ult ? ult.posX + 4000 : 5000;
            SmartFlowCommands.executeCommand('create bomba ' + tag + ' at (' + x + ',800,0) diam 600 height 800 material CS');
            scheduleRender(); notify("✅ " + tag + " creado", false);
        });
        vincular('btnAddExchanger', function() {
            const eqs = SmartFlowCore.getEquipos();
            const tag = 'E-' + (eqs.filter(function(e) { return e.tipo === 'intercambiador'; }).length + 1);
            const ult = eqs[eqs.length - 1]; const x = ult ? ult.posX + 5000 : 3000;
            SmartFlowCommands.executeCommand('create intercambiador ' + tag + ' at (' + x + ',1200,0) diam 600 largo 3000 material CS');
            scheduleRender(); notify("✅ " + tag + " creado", false);
        });
        vincular('btnAddVessel', function() {
            const eqs = SmartFlowCore.getEquipos();
            const tag = 'V-' + (eqs.filter(function(e) { return e.tipo === 'tanque_h'; }).length + 1);
            const ult = eqs[eqs.length - 1]; const x = ult ? ult.posX + 4000 : 2000;
            SmartFlowCommands.executeCommand('create tanque_h ' + tag + ' at (' + x + ',1000,0) diam 1500 largo 3500 material CS');
            scheduleRender(); notify("✅ " + tag + " creado", false);
        });
        vincular('btnAddPlatform', function() {
            const eqs = SmartFlowCore.getEquipos();
            const tag = 'PLAT-' + (eqs.filter(function(e) { return e.tipo === 'plataforma'; }).length + 1);
            const ult = eqs[eqs.length - 1]; const x = ult ? ult.posX + 5000 : 0;
            SmartFlowCommands.executeCommand('create plataforma ' + tag + ' at (' + x + ',200,0) largo 6000 ancho 3000 altura 400 material CS');
            scheduleRender(); notify("✅ " + tag + " creada", false);
        });
        
        // Selector de motor
        if (motorSelect) {
            motorSelect.addEventListener('change', function() {
                switchMotor(this.value);
            });
        }
        
        // Dropdowns
        function setupDropdown(buttonId) {
            const btn = document.getElementById(buttonId);
            if (!btn) return;
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const parent = this.closest('.dropdown');
                if (parent) parent.classList.toggle('open');
            });
        }
        setupDropdown('btnFileMenu');
        setupDropdown('btnToolsMenu');
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown.open').forEach(function(d) { d.classList.remove('open'); });
        });
        
        // Comandos: Enter ejecuta, flechas navegan
        if (commandText) {
            commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ejecutarComando(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory('up'); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory('down'); }
            });
        }
    }
    
    // ================================================================
    // 17. ARRANQUE
    // ================================================================
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_SmartEngp';
        
        const splashStatus = document.getElementById('splash-status');
        const messages = ["Cargando Three.js...", "Inicializando Core...", "Cargando catálogo...", "Motor 2D listo", "Motor 3D listo", "¡SmartEngp Activo!"];
        let msgIndex = 0;
        const interval = setInterval(function() {
            if (msgIndex < messages.length && splashStatus) { splashStatus.textContent = messages[msgIndex]; msgIndex++; }
        }, 700);
        
        initModules();
        bindEvents();
        setupKeyboardShortcuts();
        
        setTimeout(function() { if (splashScreen) splashScreen.classList.add('splash-hidden'); clearInterval(interval); }, 4500);
        setTimeout(function() { if (welcomePanel) welcomePanel.classList.remove('welcome-hidden'); }, 4800);
        setTimeout(function() { autoCenter(); }, 600);
    }
    
    init();
})();
