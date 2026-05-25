
// ============================================================
// SMARTFLOW ORCHESTRATOR v3.2 - Punto de Entrada Unificado
// Archivo: js/main.js
// Orquesta: Core + Catalog + Router + Commands + Renderer3D + Annotations + Notifications
// Corrección v3.2: Recuperado Ctrl+Shift+R para Resumen
// ============================================================

(function() {
    "use strict";
    
    // ================================================================
    // 1. REFERENCIAS AL DOM
    // ================================================================
    const viewportContainer = document.getElementById('viewport-3d');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const sidePanel = document.getElementById('side-panel');
    const panelContent = document.getElementById('panel-content');
    const splashScreen = document.getElementById('splash-screen');
    const welcomePanel = document.getElementById('welcome-panel');
    const projectModal = document.getElementById('project-name-modal');
    const projectInput = document.getElementById('project-name-input');
    
    // ================================================================
    // 2. ESTADO GLOBAL
    // ================================================================
    let voiceEnabled = true;
    
    window._commandHistory = window._commandHistory || [];
    
    // ================================================================
    // 3. SISTEMA DE NOTIFICACIONES
    // ================================================================
    function notify(message, isError) {
        isError = isError || false;
        
        if (typeof SmartFlowNotifications !== 'undefined') {
            SmartFlowNotifications.notify(message, isError ? 'error' : 'info', {
                sound: true,
                console: true
            });
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
    // 4. RENDERIZADO Y ACTUALIZACIÓN
    // ================================================================
    function scheduleRender() {
        if (typeof SmartFlowRenderer3D !== 'undefined' && SmartFlowRenderer3D.isReady()) {
            SmartFlowRenderer3D.rebuildScene();
        }
        if (typeof SmartFlowAnnotations !== 'undefined') {
            SmartFlowAnnotations.markDirty();
        }
    }
    
    function autoCenter() {
        if (typeof SmartFlowRenderer3D !== 'undefined' && SmartFlowRenderer3D.isReady()) {
            SmartFlowRenderer3D.zoomToFit();
            notify("✅ Vista centrada correctamente", false);
        }
    }
    
    // ================================================================
    // 5. PANEL DE PROPIEDADES
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
                (info.dimensiones.posX || 0).toFixed(0) + ', ' + 
                (info.dimensiones.posY || 0).toFixed(0) + ', ' + 
                (info.dimensiones.posZ || 0).toFixed(0) + ')</span></div>';
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
                html += '<div class="port-item">';
                html += '<span>' + p.id + ' ⌀' + (p.diametro || '?') + '"</span>';
                html += '<span class="' + (p.status === 'open' ? 'port-open' : 'port-connected') + '">' + 
                        (p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO a ' + (p.connectedTo || '')) + '</span>';
                html += '</div>';
            });
        } else {
            html += '<p style="color:#64748b; font-size:11px;">Sin puertos</p>';
        }
        html += '</div>';
        
        panelContent.innerHTML = html;
    }
    
    function closePanel() {
        if (sidePanel) sidePanel.classList.add('hidden');
        if (typeof SmartFlowRenderer3D !== 'undefined') {
            SmartFlowRenderer3D.deselectObject();
        }
    }
    
    // ================================================================
    // 6. INICIALIZACIÓN DE MÓDULOS
    // ================================================================
    function initModules() {
        console.log('🚀 Inicializando módulos SmartEngp 3D...');
        
        if (typeof THREE === 'undefined') {
            console.error('❌ THREE.js no está cargado');
            notify('Error: Motor 3D no disponible (THREE.js no cargado)', true);
        }
        
        if (typeof SmartFlowCore === 'undefined') {
            console.error('❌ SmartFlowCore no está cargado');
            return;
        }
        
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('  ✅ Core v5.5 inicializado');
        
        if (typeof SmartFlowNotifications !== 'undefined') {
            SmartFlowNotifications.init({
                toastEnabled: true,
                toastPosition: 'bottom-right',
                soundEnabled: true,
                voiceEnabled: voiceEnabled,
                voiceRate: 1.1,
                voiceLang: 'es-ES',
                consoleEnabled: true
            });
            console.log('  ✅ Notificaciones inicializadas');
        }
        
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify, scheduleRender);
            console.log('  ✅ Router inicializado');
        }
        
        if (typeof SmartFlowRenderer3D !== 'undefined' && viewportContainer) {
            setTimeout(function() {
                const success = SmartFlowRenderer3D.init(viewportContainer, SmartFlowCore, SmartFlowCatalog, {
                    enableShadows: true,
                    isoAngle: 30,
                    backgroundColor: 0x0a0e17
                });
                
                if (success) {
                    console.log('  ✅ Renderer3D v3.1 inicializado');
                    
                    SmartFlowRenderer3D.onSelection(function(selectionData) {
                        if (selectionData && selectionData.obj) {
                            const info = SmartFlowCore.getPropertyInfo(selectionData.obj.tag);
                            updatePropertyPanel(info);
                        } else {
                            updatePropertyPanel(null);
                        }
                        if (typeof SmartFlowAnnotations !== 'undefined') {
                            SmartFlowAnnotations.markDirty();
                        }
                    });
                } else {
                    console.error('  ❌ Renderer3D falló');
                    notify('Error: No se pudo iniciar el motor 3D', true);
                }
            }, 150);
        }
        
        if (typeof SmartFlowAnnotations !== 'undefined' && viewportContainer) {
            setTimeout(function() {
                SmartFlowAnnotations.init(viewportContainer, SmartFlowCore, SmartFlowRenderer3D, SmartFlowCatalog, {
                    standard: 'ISA',
                    showEquipmentTags: true,
                    showPipeTags: true,
                    showDimensions: true,
                    showBOMTable: false,
                    showFlowArrows: true,
                    showNorthArrow: true,
                    showElevationMarkers: true,
                    dualDimension: true
                });
                console.log('  ✅ Anotaciones inicializadas');
            }, 300);
        }
        
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer3D, notify, scheduleRender, voiceFn);
        console.log('  ✅ Comandos inicializados');
        
        if (typeof SmartFlowNotifications !== 'undefined' && typeof SmartFlowRenderer3D !== 'undefined') {
            SmartFlowNotifications.setRenderer3D(SmartFlowRenderer3D);
        }
        
        SmartFlowCore.setVoice(voiceEnabled);
        
        notify("SmartEngp 3D - Sistema listo", false);
        console.log('🎯 Todos los módulos inicializados');
    }
    
    // ================================================================
    // 7. GESTIÓN DE PROYECTOS
    // ================================================================
    function guardarProyecto() {
        const state = SmartFlowCore.exportProject();
        localStorage.setItem('smartengp_3d_project', state);
        notify("✅ Proyecto guardado en el navegador", false);
    }
    
    function cargarProyecto() {
        const data = localStorage.getItem('smartengp_3d_project');
        if (data) {
            try {
                const state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                scheduleRender();
                autoCenter();
                notify("✅ Proyecto cargado correctamente", false);
            } catch (e) {
                notify("Error al cargar el proyecto: archivo corrupto", true);
            }
        } else {
            notify("No hay proyecto guardado en el navegador", true);
        }
    }
    
    function exportarProyectoArchivo() {
        const state = SmartFlowCore.exportProject();
        const blob = new Blob([state], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (window.currentProjectName || 'Proyecto') + '_SmartEngp3D.json';
        a.click();
        notify("✅ Proyecto exportado como JSON", false);
    }
    
    function importarProyectoArchivo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const state = JSON.parse(ev.target.result);
                    SmartFlowCore.importState(state.data || state);
                    scheduleRender();
                    autoCenter();
                    notify("✅ Proyecto importado correctamente", false);
                } catch (err) {
                    notify("Error al importar el proyecto: archivo corrupto", true);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    function nuevoProyecto() {
        if (confirm("¿Desea crear un nuevo proyecto? Se perderán los cambios no guardados.")) {
            SmartFlowCore.nuevoProyecto();
            scheduleRender();
            autoCenter();
            notify("✅ Nuevo proyecto creado", false);
        }
    }
    
    function iniciarNuevoProyecto() {
        const name = projectInput ? projectInput.value.trim() : '';
        if (name) window.currentProjectName = name;
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        SmartFlowCore.nuevoProyecto();
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + (window.currentProjectName || 'Sin nombre') + ' | SmartEngp 3D';
        scheduleRender();
        autoCenter();
    }
    
    function saltarNombreProyecto() {
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + (window.currentProjectName || 'Sin nombre') + ' | SmartEngp 3D';
    }
    
    // ================================================================
    // 8A. MTO, AUDITORÍA Y EXPORTACIONES
    // ================================================================
    function exportarMTO() {
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        let items = [];
        
        equipos.forEach(function(eq) {
            if (eq.tipo !== 'colector' && eq.tipo !== 'plataforma') {
                items.push([eq.tag, eq.tipo || 'Equipo', "Und", 1]);
            }
        });
        
        lines.forEach(function(line) {
            let length = 0;
            const pts = SmartFlowCore.getLinePoints(line);
            if (pts) {
                for (let i = 0; i < pts.length - 1; i++) {
                    length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                }
            }
            items.push([line.tag, 'Tubo ' + (line.material || 'N/D') + ' ' + (line.diameter || '?') + '" ' + (line.spec || ''), "m", (length / 1000).toFixed(2)]);
            
            if (line.components) {
                line.components.forEach(function(comp) {
                    items.push([comp.tag || 'COMP-' + line.tag, comp.type || 'Componente', "Und", 1]);
                });
            }
        });
        
        if (items.length === 0) {
            notify("No hay elementos para exportar", true);
            return;
        }
        
        const ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripción", "Unidad", "Cantidad"]].concat(items));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, 'MTO_' + (window.currentProjectName || 'Proyecto') + '_' + Date.now() + '.xlsx');
        notify("✅ MTO exportado correctamente (XLSX)", false);
    }
    
    function auditarModelo() {
        if (SmartFlowCore.auditModel) {
            const report = SmartFlowCore.auditModel();
            notify(report, false);
        } else {
            notify("Función de auditoría no disponible", true);
        }
    }
    
    function exportarPDF() {
        if (typeof SmartFlowRenderer3D === 'undefined' || !SmartFlowRenderer3D.isReady()) {
            notify("Motor 3D no disponible", true);
            return;
        }
        
        const renderer = SmartFlowRenderer3D.getRenderer();
        if (!renderer) {
            notify("Renderer no disponible", true);
            return;
        }
        
        const canvas3D = renderer.domElement;
        const canvas2D = (typeof SmartFlowAnnotations !== 'undefined') ? SmartFlowAnnotations.getCanvas() : null;
        
        const combined = document.createElement('canvas');
        combined.width = canvas3D.width;
        combined.height = canvas3D.height;
        const ctx = combined.getContext('2d');
        ctx.drawImage(canvas3D, 0, 0);
        if (canvas2D) ctx.drawImage(canvas2D, 0, 0);
        
        const imgData = combined.toDataURL('image/png');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('landscape', 'mm', 'a3');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'PNG', 5, 5, pageWidth - 10, pageHeight - 10);
        pdf.save('Isometrico_' + (window.currentProjectName || 'Proyecto') + '.pdf');
        notify("✅ PDF isométrico generado correctamente", false);
    }
    
    function exportarPCF() {
        const lines = SmartFlowCore.getLines();
        if (lines.length === 0) {
            notify("No hay líneas para exportar", true);
            return;
        }
        
        let pcf = '';
        lines.forEach(function(line) {
            pcf += 'PIPE\n';
            pcf += '    ITEM-CODE ' + line.tag + '\n';
            pcf += '    PIPING-SPEC ' + (line.spec || 'STD') + '\n';
            pcf += '    MATERIAL ' + (line.material || 'N/D') + '\n';
            pcf += '    DIAMETER ' + ((line.diameter || 4) * 25.4) + '\n';
            
            const pts = SmartFlowCore.getLinePoints(line) || [];
            for (let i = 0; i < pts.length - 1; i++) {
                pcf += '    END-POINT ' + pts[i].x.toFixed(3) + ' ' + pts[i].y.toFixed(3) + ' ' + pts[i].z.toFixed(3) + ' ' + 
                       pts[i+1].x.toFixed(3) + ' ' + pts[i+1].y.toFixed(3) + ' ' + pts[i+1].z.toFixed(3) + '\n';
            }
            pcf += '\n';
        });
        
        const blob = new Blob([pcf], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (window.currentProjectName || 'Proyecto') + '.pcf';
        a.click();
        notify("✅ Archivo PCF exportado correctamente", false);
    }
    
    function importarPCF() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pcf,.txt';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    SmartFlowCommands.importPCF(ev.target.result);
                    scheduleRender();
                    autoCenter();
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    // ================================================================
    // 8B. RESUMEN DEL PROYECTO
    // ================================================================
    function resumenProyecto() {
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        
        const tanquesV = equipos.filter(function(e) { return e.tipo === 'tanque_v'; });
        const tanquesH = equipos.filter(function(e) { return e.tipo === 'tanque_h'; });
        const bombas = equipos.filter(function(e) { return e.tipo && e.tipo.includes('bomba'); });
        const intercambiadores = equipos.filter(function(e) { return e.tipo === 'intercambiador' || e.tipo === 'condensador'; });
        const torres = equipos.filter(function(e) { return e.tipo === 'torre' || e.tipo === 'columna_fraccionadora' || e.tipo === 'antorcha'; });
        const reactores = equipos.filter(function(e) { return e.tipo && (e.tipo.includes('reactor') || e.tipo === 'autoclave'); });
        const filtros = equipos.filter(function(e) { return e.tipo && (e.tipo.includes('filtro') || e.tipo.includes('osmosis')); });
        const plataformas = equipos.filter(function(e) { return e.tipo === 'plataforma'; });
        const otros = equipos.length - tanquesV.length - tanquesH.length - bombas.length - 
                      intercambiadores.length - torres.length - reactores.length - filtros.length - plataformas.length;
        
        let totalCodos = 0, totalTees = 0, totalReducciones = 0, totalValvulas = 0;
        let totalBridas = 0, totalInstrumentos = 0, totalSoportes = 0, totalOtrosComp = 0;
        
        lines.forEach(function(l) {
            if (l.components) {
                l.components.forEach(function(c) {
                    const type = (c.type || '').toUpperCase();
                    if (type.includes('ELBOW')) totalCodos++;
                    else if (type.includes('TEE')) totalTees++;
                    else if (type.includes('REDUCER')) totalReducciones++;
                    else if (type.includes('VALVE')) totalValvulas++;
                    else if (type.includes('FLANGE')) totalBridas++;
                    else if (type.includes('GAUGE') || type.includes('METER') || type.includes('TRANSMITTER') || type.includes('INSTRUMENT') || type.includes('SIGHT')) totalInstrumentos++;
                    else if (type.includes('SHOE') || type.includes('BOLT') || type.includes('GUIDE') || type.includes('ANCHOR') || type.includes('HANGER') || type.includes('CLAMP')) totalSoportes++;
                    else totalOtrosComp++;
                });
            }
            
            const pts = SmartFlowCore.getLinePoints(l) || [];
            if (pts.length > 2) {
                for (let i = 1; i < pts.length - 1; i++) {
                    const d1x = pts[i].x - pts[i-1].x, d1y = pts[i].y - pts[i-1].y, d1z = pts[i].z - pts[i-1].z;
                    const d2x = pts[i+1].x - pts[i].x, d2y = pts[i+1].y - pts[i].y, d2z = pts[i+1].z - pts[i].z;
                    const len1 = Math.sqrt(d1x*d1x + d1y*d1y + d1z*d1z) || 1;
                    const len2 = Math.sqrt(d2x*d2x + d2y*d2y + d2z*d2z) || 1;
                    const dot = (d1x*d2x + d1y*d2y + d1z*d2z) / (len1 * len2);
                    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
                    if (angle > 5) totalCodos++;
                }
            }
        });
        
        let longitudTotal = 0;
        lines.forEach(function(l) {
            const pts = SmartFlowCore.getLinePoints(l) || [];
            for (let i = 0; i < pts.length - 1; i++) {
                longitudTotal += Math.sqrt(
                    Math.pow(pts[i+1].x - pts[i].x, 2) +
                    Math.pow(pts[i+1].y - pts[i].y, 2) +
                    Math.pow(pts[i+1].z - pts[i].z, 2)
                );
            }
        });
        
        let msg = '═══════════════════════════════════\n';
        msg += '    📋 RESUMEN DEL PROYECTO\n';
        msg += '       ' + (window.currentProjectName || 'Sin nombre') + '\n';
        msg += '═══════════════════════════════════\n\n';
        
        msg += '🏭 EQUIPOS (' + equipos.length + '):\n';
        if (tanquesV.length) msg += '  • Tanques Verticales: ' + tanquesV.length + '\n';
        if (tanquesH.length) msg += '  • Tanques Horizontales: ' + tanquesH.length + '\n';
        if (bombas.length) msg += '  • Bombas: ' + bombas.length + '\n';
        if (intercambiadores.length) msg += '  • Intercambiadores: ' + intercambiadores.length + '\n';
        if (torres.length) msg += '  • Torres/Columnas: ' + torres.length + '\n';
        if (reactores.length) msg += '  • Reactores: ' + reactores.length + '\n';
        if (filtros.length) msg += '  • Filtros/Ósmosis: ' + filtros.length + '\n';
        if (plataformas.length) msg += '  • Plataformas: ' + plataformas.length + '\n';
        if (otros > 0) msg += '  • Otros equipos: ' + otros + '\n';
        
        msg += '\n📏 TUBERÍAS (' + lines.length + '):\n';
        msg += '  • Longitud total: ' + (longitudTotal / 1000).toFixed(2) + ' m\n';
        
        const totalComp = totalCodos + totalTees + totalReducciones + totalValvulas + totalBridas + totalInstrumentos + totalSoportes + totalOtrosComp;
        if (totalComp > 0) {
            msg += '\n🔩 COMPONENTES (' + totalComp + '):\n';
            if (totalCodos) msg += '  • Codos: ' + totalCodos + '\n';
            if (totalTees) msg += '  • Tees/Cruces: ' + totalTees + '\n';
            if (totalReducciones) msg += '  • Reducciones: ' + totalReducciones + '\n';
            if (totalValvulas) msg += '  • Válvulas: ' + totalValvulas + '\n';
            if (totalBridas) msg += '  • Bridas: ' + totalBridas + '\n';
            if (totalInstrumentos) msg += '  • Instrumentos: ' + totalInstrumentos + '\n';
            if (totalSoportes) msg += '  • Soportes: ' + totalSoportes + '\n';
            if (totalOtrosComp) msg += '  • Otros: ' + totalOtrosComp + '\n';
        }
        
        msg += '\n═══════════════════════════════════';
        
        notify(msg, false);
    }
    
    // ================================================================
    // 9. CONSOLA DE COMANDOS
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
        if (indicator) {
            indicator.textContent = _commandHistory.length > 0 ? 
                '⏺ ' + _commandHistory.length + ' comandos (↑↓ para navegar)' : '';
        }
    }
    
    function navigateHistory(direction) {
        if (!commandText) return;
        if (_historyIndex === _commandHistory.length) {
            _tempCommand = commandText.value;
        }
        
        if (direction === 'up' && _historyIndex > 0) {
            _historyIndex--;
            commandText.value = _commandHistory[_historyIndex];
        } else if (direction === 'down' && _historyIndex < _commandHistory.length - 1) {
            _historyIndex++;
            commandText.value = _commandHistory[_historyIndex];
        } else if (direction === 'down' && _historyIndex === _commandHistory.length - 1) {
            _historyIndex++;
            commandText.value = _tempCommand || '';
        }
    }
    
    function abrirPanelComandos() {
        if (commandPanel) {
            commandPanel.style.display = 'block';
            if (commandText) commandText.focus();
        }
    }
    
    function ejecutarComando() {
        if (!commandText) return;
        const textoCompleto = commandText.value.trim();
        if (!textoCompleto) return;
        
        const lineas = textoCompleto.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        
        let success = true;
        if (lineas.length === 1) {
            const resultado = SmartFlowCommands.executeCommand(lineas[0]);
            success = (resultado !== false);
        } else {
            const ejecutados = SmartFlowCommands.executeBatch(lineas.join('\n'));
            success = ejecutados > 0;
        }
        
        if (success) addToHistory(textoCompleto);
        
        commandText.value = '';
        _historyIndex = _commandHistory.length;
        scheduleRender();
        
        const primera = lineas[0].toLowerCase();
        const infoCommands = ['info', 'coordenadas', 'nodos', 'listar', 'list', 'ayuda', 'help', 'bom', 'mto', 'audit', 'measure', 'medir', 'distancia', 'macro list', 'macro lista', 'resumen'];
        const esInformativo = infoCommands.some(function(c) { return primera.startsWith(c); });
        
        if (!esInformativo && commandPanel) {
            commandPanel.style.display = 'none';
        }
    }
    
    // ================================================================
    // 10. VISTAS DE CÁMARA
    // ================================================================
    function setView(viewName) {
        if (typeof SmartFlowRenderer3D !== 'undefined' && SmartFlowRenderer3D.isReady()) {
            SmartFlowRenderer3D.setView(viewName);
        }
    }
    
    // ================================================================
    // 11. TOGGLE VOZ
    // ================================================================
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        SmartFlowCore.setVoice(voiceEnabled);
        
        if (typeof SmartFlowNotifications !== 'undefined') {
            SmartFlowNotifications.toggleVoice(voiceEnabled);
        }
        
        const btnVoice = document.getElementById('btnVoice');
        if (btnVoice) {
            btnVoice.textContent = voiceEnabled ? '🔊' : '🔇';
            btnVoice.style.color = voiceEnabled ? '' : '#ef4444';
        }
        
        notify(voiceEnabled ? "✅ Voz activada" : "🔇 Voz desactivada", false);
    }
    
    // ================================================================
    // 12. FULLSCREEN
    // ================================================================
    function toggleFullscreen() {
        document.body.classList.add('fullscreen-mode');
        autoCenter();
    }
    
    function exitFullscreen() {
        document.body.classList.remove('fullscreen-mode');
        autoCenter();
    }
    
    // ================================================================
    // 13. ATAJOS DE TECLADO (COMPLETOS - IGUAL QUE ORIGINAL)
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
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); notify("↩️ Acción deshecha", false); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); notify("↪️ Acción rehecha", false); break;
                    case 'M': e.preventDefault(); exportarMTO(); break;
                    case 'P': e.preventDefault(); exportarPDF(); break;
                    case 'E': e.preventDefault(); exportarPCF(); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                    case 'A': e.preventDefault(); auditarModelo(); break;
                }
            }
            
            if (e.key === 'Escape') {
                if (commandPanel && commandPanel.style.display === 'block') {
                    commandPanel.style.display = 'none';
                }
                closePanel();
            }
        });
    }
    
    // ================================================================
    // 14. CABLEADO DE BOTONES
    // ================================================================
    function bindEvents() {
        function vincular(id, accion) {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', accion);
        }
        
        vincular('welcome-new-project', function() { if (projectModal) projectModal.style.display = 'flex'; });
        vincular('welcome-open-project', function() {
            cargarProyecto();
            if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        });
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
        
        vincular('btnAddTank', function() {
            const equipos = SmartFlowCore.getEquipos();
            const tag = 'TK-' + (equipos.filter(function(e) { return e.tipo === 'tanque_v'; }).length + 1);
            const ult = equipos[equipos.length - 1];
            const x = ult ? ult.posX + 4000 : 0;
            SmartFlowCommands.executeCommand('create tanque_v ' + tag + ' at (' + x + ',1500,0) diam 2000 height 3000 material CS spec ACERO_150_RF');
            scheduleRender();
            notify("✅ " + tag + " creado", false);
        });
        
        vincular('btnAddPump', function() {
            const equipos = SmartFlowCore.getEquipos();
            const tag = 'P-' + (equipos.filter(function(e) { return e.tipo && e.tipo.includes('bomba'); }).length + 1);
            const ult = equipos[equipos.length - 1];
            const x = ult ? ult.posX + 4000 : 5000;
            SmartFlowCommands.executeCommand('create bomba ' + tag + ' at (' + x + ',800,0) diam 600 height 800 material CS');
            scheduleRender();
            notify("✅ " + tag + " creado", false);
        });
        
        vincular('btnAddExchanger', function() {
            const equipos = SmartFlowCore.getEquipos();
            const tag = 'E-' + (equipos.filter(function(e) { return e.tipo === 'intercambiador'; }).length + 1);
            const ult = equipos[equipos.length - 1];
            const x = ult ? ult.posX + 5000 : 3000;
            SmartFlowCommands.executeCommand('create intercambiador ' + tag + ' at (' + x + ',1200,0) diam 600 largo 3000 material CS');
            scheduleRender();
            notify("✅ " + tag + " creado", false);
        });
        
        vincular('btnAddVessel', function() {
            const equipos = SmartFlowCore.getEquipos();
            const tag = 'V-' + (equipos.filter(function(e) { return e.tipo === 'tanque_h'; }).length + 1);
            const ult = equipos[equipos.length - 1];
            const x = ult ? ult.posX + 4000 : 2000;
            SmartFlowCommands.executeCommand('create tanque_h ' + tag + ' at (' + x + ',1000,0) diam 1500 largo 3500 material CS');
            scheduleRender();
            notify("✅ " + tag + " creado", false);
        });
        
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
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown.open').forEach(function(d) { d.classList.remove('open'); });
            }
        });
        
        if (commandText) {
            commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ejecutarComando();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    navigateHistory('up');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    navigateHistory('down');
                }
            });
        }
        
        window.addEventListener('resize', function() {
            // El motor 3D maneja su propio resize internamente
        });
    }
    
    // ================================================================
    // 15. ARRANQUE DE LA APLICACIÓN
    // ================================================================
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_SmartEngp3D';
        
        const splashStatus = document.getElementById('splash-status');
        const messages = [
            "Cargando Three.js WebGL...",
            "Inicializando SmartFlowCore v5.5...",
            "Cargando catálogo industrial v4.0...",
            "Configurando motor de renderizado PBR...",
            "Preparando sistema de anotaciones ISA...",
            "¡SmartEngp 3D Activo!"
        ];
        let msgIndex = 0;
        const interval = setInterval(function() {
            if (msgIndex < messages.length && splashStatus) {
                splashStatus.textContent = messages[msgIndex];
                msgIndex++;
            }
        }, 700);
        
        initModules();
        bindEvents();
        setupKeyboardShortcuts();
        
        setTimeout(function() {
            if (splashScreen) splashScreen.classList.add('splash-hidden');
            clearInterval(interval);
        }, 4500);
        
        setTimeout(function() {
            if (welcomePanel) welcomePanel.classList.remove('welcome-hidden');
        }, 4800);
        
        setTimeout(function() {
            autoCenter();
        }, 600);
    }
    
    init();
})();
