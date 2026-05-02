
// ============================================================
// MÓDULO: SMARTFLOW ACCESSIBILITY v6.0 (Adaptado a Three.js)
// Archivo: js/accessibility.js
// ============================================================

const SmartFlowAccessibility = (function() {
    
    let _core = null;
    let _catalog = null;
    let _render = null;           // SmartFlowRender (para vistas)
    let _notifyUI = (msg) => console.log(msg);
    
    // Estado del modo accesibilidad
    let _verboseMode = true;
    let _ariaLiveRegion = null;
    
    // Síntesis de voz
    let _synth = window.speechSynthesis;
    let _speaking = false;
    let _messageQueue = [];
    
    // -------------------- 1. GESTIÓN DE VOZ (TTS) --------------------
    function speak(text, priority = false) {
        if (!_synth) return;
        if (priority) {
            _synth.cancel();
            _messageQueue = [];
        }
        _messageQueue.push(text);
        if (!_speaking) _processQueue();
    }
    
    function _processQueue() {
        if (_messageQueue.length === 0) {
            _speaking = false;
            return;
        }
        _speaking = true;
        const text = _messageQueue.shift();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.95;
        utterance.onend = () => _processQueue();
        utterance.onerror = () => _processQueue();
        _synth.speak(utterance);
    }
    
    function stopSpeaking() {
        if (_synth) {
            _synth.cancel();
            _messageQueue = [];
            _speaking = false;
        }
    }
    
    // -------------------- 2. DESCRIPCIONES SEMÁNTICAS --------------------
    function describeEquipment(eq) {
        const def = _catalog ? _catalog.getEquipment(eq.tipo) : null;
        const tipoNombre = def?.nombre || eq.tipo;
        let desc = `${tipoNombre} ${eq.tag}. `;
        desc += `Posición: X=${eq.posX.toFixed(0)}, Y=${eq.posY.toFixed(0)}, Z=${eq.posZ.toFixed(0)} milímetros. `;
        desc += `Diámetro ${eq.diametro} milímetros, altura ${eq.altura} milímetros. `;
        desc += `Material: ${eq.material || 'No especificado'}. `;
        if (eq.puertos && eq.puertos.length > 0) {
            const puertosConectados = eq.puertos.filter(p => p.connectedLine);
            const puertosLibres = eq.puertos.filter(p => !p.connectedLine);
            desc += `Tiene ${eq.puertos.length} puertos. `;
            if (puertosConectados.length > 0) desc += `Conectados: ${puertosConectados.map(p => p.id).join(', ')}. `;
            if (puertosLibres.length > 0) desc += `Libres: ${puertosLibres.map(p => p.id).join(', ')}. `;
        }
        return desc;
    }
    
    function describeLine(line) {
        let desc = `Línea ${line.tag}. `;
        desc += `Diámetro ${line.diameter} pulgadas, material ${line.material || 'PPR'}. `;
        const pts = line.points || line._cachedPoints;
        if (pts && pts.length >= 2) {
            let totalLen = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            }
            desc += `Longitud total: ${(totalLen/1000).toFixed(2)} metros. `;
        }
        if (line.origin) desc += `Conecta desde equipo ${line.origin.equipTag}, puerto ${line.origin.portId}. `;
        if (line.destination) desc += `Conecta hacia equipo ${line.destination.equipTag}, puerto ${line.destination.portId}. `;
        if (line.components && line.components.length > 0) {
            const compNames = line.components.map(c => c.type);
            desc += `Contiene ${line.components.length} componentes: ${compNames.join(', ')}. `;
        }
        return desc;
    }
    
    function describeScene() {
        const db = _core.getDb();
        const equipos = db.equipos || [];
        const lines = db.lines || [];
        let desc = `Escena actual: ${equipos.length} equipos, ${lines.length} líneas. `;
        if (equipos.length > 0) desc += `Equipos: ${equipos.map(e => e.tag).join(', ')}. `;
        return desc;
    }
    
    function describeSelection() {
        const selected = _core.getSelected();
        if (!selected) return "No hay ningún elemento seleccionado.";
        if (selected.type === 'equipment') return describeEquipment(selected.obj);
        if (selected.type === 'line') return describeLine(selected.obj);
        return "Elemento seleccionado no reconocido.";
    }
    
    // -------------------- 3. COMANDOS DE ACCESIBILIDAD (TEXTO) --------------------
    function processAccessibilityCommand(cmd) {
        const lower = cmd.toLowerCase().trim();
        
        // Comandos de selección
        if (lower.startsWith('seleccionar ')) {
            const tag = cmd.substring(12).trim().toUpperCase();
            const db = _core.getDb();
            const eq = db.equipos.find(e => e.tag === tag);
            if (eq) {
                _core.setSelected({ type: 'equipment', obj: eq });
                const desc = describeEquipment(eq);
                speak(`Seleccionado. ${desc}`, true);
                return true;
            }
            const line = db.lines.find(l => l.tag === tag);
            if (line) {
                _core.setSelected({ type: 'line', obj: line });
                const desc = describeLine(line);
                speak(`Seleccionado. ${desc}`, true);
                return true;
            }
            speak(`No se encontró el elemento con tag ${tag}`, true);
            return true;
        }
        
        // Comandos de información
        if (lower === 'leer selección' || lower === 'describir selección') {
            speak(describeSelection(), true);
            return true;
        }
        if (lower === 'leer escena' || lower === 'describir escena') {
            speak(describeScene(), true);
            return true;
        }
        
        if (lower === '¿dónde estoy?' || lower === 'donde estoy' || lower === 'ubicación') {
            const camera = _core.getCamera();
            if (camera) {
                const pos = camera.position;
                speak(`Cámara 3D en posición X=${pos.x.toFixed(0)}, Y=${pos.y.toFixed(0)}, Z=${pos.z.toFixed(0)}.`, true);
            } else {
                speak("Información de cámara no disponible.", true);
            }
            return true;
        }
        
        if (lower === 'lista de equipos' || lower === 'listar equipos') {
            const db = _core.getDb();
            const equipos = db.equipos || [];
            if (equipos.length === 0) speak("No hay equipos en el modelo.", true);
            else speak(`Equipos en el modelo: ${equipos.map(e => e.tag).join(', ')}`, true);
            return true;
        }
        
        if (lower === 'lista de líneas' || lower === 'listar líneas') {
            const db = _core.getDb();
            const lines = db.lines || [];
            if (lines.length === 0) speak("No hay líneas en el modelo.", true);
            else speak(`Líneas en el modelo: ${lines.map(l => l.tag).join(', ')}`, true);
            return true;
        }
        
        // Comandos de vista
        if (lower === 'centrar vista' || lower === 'vista isométrica' || lower === 'vista iso') {
            if (_render && _render.setView) {
                _render.setView('iso');
                speak("Vista isométrica centrada.", true);
            } else {
                speak("No se pudo centrar la vista.", true);
            }
            return true;
        }
        
        if (lower === 'vista superior' || lower === 'vista top' || lower === 'vista planta') {
            if (_render && _render.setView) { _render.setView('top'); speak("Vista superior (planta).", true); }
            else speak("Vista superior no disponible.", true);
            return true;
        }
        
        if (lower === 'vista frontal' || lower === 'vista front') {
            if (_render && _render.setView) { _render.setView('front'); speak("Vista frontal.", true); }
            else speak("Vista frontal no disponible.", true);
            return true;
        }
        
        if (lower === 'ayuda accesibilidad' || lower === 'comandos de voz') {
            const ayuda = "Comandos de accesibilidad: seleccionar [tag], leer selección, leer escena, ¿dónde estoy?, lista de equipos, lista de líneas, centrar vista, vista superior, vista frontal, silencio, modo verbose.";
            speak(ayuda, true);
            return true;
        }
        
        if (lower === 'silencio' || lower === 'callar') {
            stopSpeaking();
            return true;
        }
        
        if (lower === 'modo verbose') {
            _verboseMode = !_verboseMode;
            speak(_verboseMode ? "Modo detallado activado." : "Modo detallado desactivado.", true);
            return true;
        }
        
        return false;
    }
    
    // -------------------- 4. NOTIFICACIONES MEJORADAS --------------------
    function notifyWithDescription(message, isError, context) {
        if (_notifyUI) _notifyUI(message, isError);
        let spokenMessage = message;
        if (context && _verboseMode) {
            if (context.equipment) spokenMessage += '. ' + describeEquipment(context.equipment);
            else if (context.line) spokenMessage += '. ' + describeLine(context.line);
        }
        speak(spokenMessage, isError);
        if (_ariaLiveRegion) _ariaLiveRegion.textContent = message;
    }
    
    function isVoiceEnabled() { return true; } // simple, puede modificarse
    
    // -------------------- 5. INICIALIZACIÓN --------------------
    function init(coreInstance, catalogInstance, renderInstance, notifyFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _render = renderInstance;
        _notifyUI = notifyFn;
        
        // Crear región ARIA live
        _ariaLiveRegion = document.getElementById('aria-live-region');
        if (!_ariaLiveRegion) {
            _ariaLiveRegion = document.createElement('div');
            _ariaLiveRegion.id = 'aria-live-region';
            _ariaLiveRegion.setAttribute('aria-live', 'polite');
            _ariaLiveRegion.setAttribute('aria-atomic', 'true');
            _ariaLiveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
            document.body.appendChild(_ariaLiveRegion);
        }
        
        speak("Sistema de accesibilidad 3D activado. Escriba 'ayuda accesibilidad' en el panel de comandos.", true);
    }
    
    // -------------------- API PÚBLICA --------------------
    return {
        init,
        speak,
        stopSpeaking,
        describeEquipment,
        describeLine,
        describeScene,
        describeSelection,
        processAccessibilityCommand,
        notifyWithDescription,
        isVoiceEnabled
    };
})();
