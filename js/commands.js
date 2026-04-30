
// ============================================================
// SMARTFLOW COMMANDS v6.0 (Completo y unificado)
// Archivo: js/commands.js
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _render = null;        // SmartFlowRender (para vistas)
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // -------------------- DICCIONARIO DE INTENCIONES --------------------
    const IntentDictionary = {
        'crear': 'create', 'nuevo': 'create', 'añadir': 'create', 'instalar': 'create', 'pon': 'create', 'crea': 'create',
        'create': 'create', 'add': 'create',
        'conectar': 'connect', 'unir': 'connect', 'enlazar': 'connect', 'link': 'connect', 'vincula': 'connect', 'junta': 'connect', 'une': 'connect',
        'connect': 'connect',
        'ruta': 'route', 'route': 'route',
        'eliminar': 'delete', 'borrar': 'delete', 'quitar': 'delete', 'suprimir': 'delete', 'quita': 'delete', 'elimina': 'delete', 'limpiar': 'delete',
        'delete': 'delete', 'remove': 'delete',
        'editar': 'edit', 'modificar': 'edit', 'cambiar': 'edit', 'ajustar': 'edit', 'cambia': 'edit',
        'edit': 'edit', 'set': 'edit', 'update': 'edit', 'mover': 'edit', 'move': 'edit',
        'establecer': 'edit', 'spec': 'edit', 'diametro': 'edit',
        'listar': 'list', 'lista': 'list', 'list': 'list', 'inventory': 'list', 'showall': 'list',
        'auditar': 'audit', 'revisar': 'audit', 'verificar': 'audit', 'validar': 'audit', 'audita': 'audit', 'status': 'audit',
        'audit': 'audit', 'check': 'audit',
        'bom': 'bom', 'mto': 'bom', 'generar': 'bom', 'generate': 'bom',
        'ayuda': 'help', 'help': 'help', 'comandos': 'help', '?': 'help', 'h': 'help',
        'deshacer': 'undo', 'undo': 'undo',
        'rehacer': 'redo', 'redo': 'redo',
        'info': 'info', 'información': 'info', 'informacion': 'info', 'detalles': 'info', 'ver': 'info', 'describe': 'info',
        'tap': 'tap', 'derivar': 'tap',
        'split': 'split', 'dividir': 'split', 'romper': 'split'
    };

    function getIntent(word) {
        if (!word) return null;
        return IntentDictionary[word.toLowerCase()] || null;
    }

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        const intent = getIntent(parts[0]);
        if (intent) { parts[0] = intent; return parts.join(' '); }
        return cmd;
    }

    function extractCoords(str) {
        const m = str.match(/\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } : null;
    }

    function extractValue(parts, keys) {
        if (!Array.isArray(parts)) return null;
        for (let i = 0; i < parts.length; i++) {
            if (keys.includes(parts[i].toLowerCase()) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        return null;
    }

    function notifyWithVoice(message, isError = false) {
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        if (typeof SmartFlowAccessibility !== 'undefined' && SmartFlowAccessibility.isVoiceEnabled && SmartFlowAccessibility.isVoiceEnabled()) {
            SmartFlowAccessibility.speak(message);
        }
    }

    // ==================== INFO ====================
    function parseInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        if (parts.length < 2) {
            notifyWithVoice("Uso: info line [TAG] | info equipment [TAG] | info component [TAG]", true);
            return true;
        }
        const type = parts[1].toLowerCase();
        const tag = parts[2];
        if (!tag) { notifyWithVoice(`Especifique el tag del ${type}`, true); return true; }
        if (type === 'line' || type === 'línea' || type === 'linea') return infoLine(tag);
        if (type === 'equipment' || type === 'equipo') return infoEquipment(tag);
        if (type === 'component' || type === 'componente') return infoComponent(tag);
        notifyWithVoice(`Tipo desconocido: ${type}. Use line, equipment o component`, true);
        return true;
    }

    function infoLine(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const line = db.lines.find(l => l.tag === tag);
        if (!line) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
        const pts = line.points || line._cachedPoints;
        const numPuntos = pts ? pts.length : 0;
        let origen = "Ninguno", destino = "Ninguno";
        if (line.origin) {
            const obj = db.equipos.find(e => e.tag === line.origin.equipTag) || db.lines.find(l => l.tag === line.origin.equipTag);
            origen = `${line.origin.equipTag}.${line.origin.portId} (${obj?.tipo || 'line'})`;
        }
        if (line.destination) {
            const obj = db.equipos.find(e => e.tag === line.destination.equipTag) || db.lines.find(l => l.tag === line.destination.equipTag);
            destino = `${line.destination.equipTag}.${line.destination.portId} (${obj?.tipo || 'line'})`;
        }
        const msg = `📋 Línea ${tag} | Diámetro: ${line.diameter || '?'}" | Material: ${line.material || 'N/D'} | Spec: ${line.spec || 'N/D'} | Puntos: ${numPuntos} | Componentes: ${line.components?.length || 0} | Origen: ${origen} | Destino: ${destino}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoEquipment(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (!eq) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
        const tipo = eq.tipo;
        const material = eq.material || 'N/D';
        const pos = `(${eq.posX}, ${eq.posY}, ${eq.posZ})`;
        const dimensiones = `Diam: ${eq.diametro || 'N/D'} Altura: ${eq.altura || 'N/D'}`;
        const puertos = eq.puertos ? eq.puertos.map(p => p.id).join(', ') : 'Ninguno';
        const msg = `📋 Equipo ${tag} | Tipo: ${tipo} | Material: ${material} | Posición: ${pos} | ${dimensiones} | Puertos: ${puertos}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoComponent(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        let foundComp = null, foundLine = null;
        for (let line of db.lines) {
            if (line.components) {
                const comp = line.components.find(c => c.tag === tag);
                if (comp) { foundComp = comp; foundLine = line; break; }
            }
        }
        if (!foundComp) { notifyWithVoice(`Componente ${tag} no encontrado`, true); return true; }
        const tipo = foundComp.type;
        const descripcion = foundComp.description || 'Sin descripción';
        const posParam = foundComp.param ? `Parámetro: ${foundComp.param.toFixed(2)}` : '';
        const msg = `📋 Componente ${tag} | Tipo: ${tipo} | Descripción: ${descripcion} | Pertenece a línea: ${foundLine.tag} | ${posParam}`;
        notifyWithVoice(msg, false);
        return true;
    }

    // ==================== CREATE (equipos) ====================
    function parseCreate(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create') return false;
        const tipo = parts[1]; const tag = parts[2];
        if (parts[3] !== 'at') return false;
        let coordStr = '';
        for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const coords = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        const x = parseFloat(coords[1]), y = parseFloat(coords[2]), z = parseFloat(coords[3]);
        let params = {};
        for (let i = 5; i < parts.length; i++) {
            let key = parts[i];
            if (key === 'diam' || key === 'diametro') params.diametro = parseFloat(parts[++i]);
            else if (key === 'height' || key === 'altura') params.altura = parseFloat(parts[++i]);
            else if (key === 'largo') params.largo = parseFloat(parts[++i]);
            else if (key === 'material') params.material = parts[++i].toUpperCase();
            else if (key === 'spec') params.spec = parts[++i];
        }
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) { notifyWithVoice(`Tipo de equipo desconocido: ${tipo}`, true); return true; }
        const equipo = _catalog.createEquipment(tipo, tag, x, y, z, params);
        if (equipo) {
            _core.addEquipment(equipo);
            _core.setSelected({ type: 'equipment', obj: equipo });
            notifyWithVoice(`Equipo ${tag} (${equipoDef.nombre}) creado`, false);
        }
        return true;
    }

    // ==================== CREATE LINE ====================
    function parseCreateLine(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'line') return false;
        const tag = parts[2];
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5', points = [], i = 3;
        while (i < parts.length) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
            else if (parts[i] === 'route' || parts[i] === 'ruta') {
                i++;
                while (i < parts.length) {
                    const m = parts[i].match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                    if (m) points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
                    else break;
                    i++;
                }
                continue;
            }
            i++;
        }
        if (points.length < 2) { notifyWithVoice("Error: Se requieren al menos 2 puntos", true); return true; }
        const newLine = { tag, diameter, material, spec, points: points, _cachedPoints: points, waypoints: points.slice(1, -1), components: [] };
        _core.addLine(newLine);
        _core.setSelected({ type: 'line', obj: newLine });
        notifyWithVoice(`Línea ${tag} creada`, false);
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.procesarInterseccionesDeLinea) SmartFlowRouter.procesarInterseccionesDeLinea(newLine);
        return true;
    }

    // ==================== CREATE MANIFOLD ====================
    function parseCreateManifold(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'manifold') return false;
        let idx = 2; const tag = parts[idx++];
        if (parts[idx] !== 'at') return false; idx++;
        const coords = parts[idx++].match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        const x = parseFloat(coords[1]), y = parseFloat(coords[2]), z = parseFloat(coords[3]);
        let numEntradas = 2, spacing = 3000, outputPos = 'center', diametro = 4, material = 'PPR', spec = 'PPR_PN12_5';
        while (idx < parts.length) {
            const key = parts[idx++].toLowerCase();
            if (key === 'entries' || key === 'entradas') numEntradas = parseInt(parts[idx++]);
            else if (key === 'spacing' || key === 'espaciado') spacing = parseFloat(parts[idx++]);
            else if (key === 'output' || key === 'salida') outputPos = parts[idx++].toLowerCase();
            else if (key === 'diameter' || key === 'diametro') diametro = parseFloat(parts[idx++]);
            else if (key === 'material') material = parts[idx++].toUpperCase();
            else if (key === 'spec') spec = parts[idx++];
        }
        const colector = { tag, tipo: 'colector', posX: x, posY: y, posZ: z, diametro, altura: 0, largo: (numEntradas - 1) * spacing, material, spec, num_entradas: numEntradas, spacing, salida_pos: outputPos, diametro_entrada: diametro, diametro_salida: diametro };
        const def = _catalog.getEquipment('colector');
        colector.puertos = def.generarPuertos(colector);
        _core.addEquipment(colector);
        _core.setSelected({ type: 'equipment', obj: colector });
        notifyWithVoice(`Colector ${tag} creado`, false);
        return true;
    }

    // Helper para encontrar codo
    function findElbowForLine(material, diameter, angleDeg) {
        const mat = material.toUpperCase();
        const is90 = (Math.abs(angleDeg - 90) < 10);
        const is45 = (Math.abs(angleDeg - 45) < 10);
        if (!is90 && !is45) return null;
        if (mat.includes('PPR')) return is90 ? 'ELBOW_90_PPR' : 'ELBOW_45_PPR';
        else if (mat.includes('HDPE')) return is90 ? 'ELBOW_90_HDPE' : null;
        else if (mat.includes('PVC')) return is90 ? 'ELBOW_90_PVC' : null;
        else if (mat.includes('ACERO')) return is90 ? 'ELBOW_90_LR_CS' : 'ELBOW_45_CS';
        else if (mat.includes('INOXIDABLE') || mat.includes('INOX')) return is90 ? 'ELBOW_90_SANITARY' : null;
        return is90 ? 'ELBOW_90_LR_CS' : 'ELBOW_45_CS';
    }

    // ==================== CONNECT ====================
    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        const fromEquip = parts[1], fromNozzle = parts[2];
        if (parts[3] !== 'to' && parts[3] !== 'a') return false;
        const toEquip = parts[4];
        let toNozzle = parts[5] || null;
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        if (toNozzle && isNaN(parseFloat(toNozzle)) && toNozzle !== '0' && toNozzle !== '1' && !/^[A-Za-z]/.test(toNozzle[0])) toNozzle = null;
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.routeBetweenPorts) {
            SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        } else notifyWithVoice("Router no disponible", true);
        return true;
    }

    // ==================== ROUTE ====================
    function parseRoute(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'route' && parts[0] !== 'ruta') return false;
        if (parts[1] !== 'from' && parts[1] !== 'desde') return false;
        const fromEquip = parts[2], fromNozzle = parts[3];
        if (parts[4] !== 'to' && parts[4] !== 'a' && parts[4] !== 'hasta') return false;
        const toEquip = parts[5];
        let toNozzle = null, nextIdx = 6;
        if (nextIdx < parts.length && !parts[nextIdx].startsWith('diam') && parts[nextIdx] !== 'material') toNozzle = parts[nextIdx++];
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = nextIdx; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined') SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        else notifyWithVoice("Router no disponible", true);
        return true;
    }

    // ==================== DELETE ====================
    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete' && parts[0] !== 'eliminar') return false;
        const type = parts[1], tag = parts[2];
        if (type === 'equipment' || type === 'equipo') {
            _core.deleteEquipment(tag);
            notifyWithVoice(`Equipo ${tag} eliminado`, false);
        } else if (type === 'line' || type === 'línea') {
            _core.deleteLine(tag);
            notifyWithVoice(`Línea ${tag} eliminada`, false);
        } else return false;
        return true;
    }

    // ==================== EDIT ====================
    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit' && parts[0] !== 'editar') return false;
        if (parts[1] === 'equipment' || parts[1] === 'equipo') {
            const tag = parts[2], action = parts[3];
            if (action === 'move' || action === 'mover') {
                const coords = extractCoords(cmd);
                if (coords) _core.updateEquipment(tag, { posX: coords.x, posY: coords.y, posZ: coords.z });
                notifyWithVoice(`Equipo ${tag} movido`, false);
                return true;
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const prop = parts[4], val = parts[5];
                if (prop === 'material') { _core.updateLine(tag, { material: val.toUpperCase() }); notifyWithVoice(`Material de ${tag} cambiado`, false); return true; }
                if (prop === 'diameter' || prop === 'diametro') { _core.updateLine(tag, { diameter: parseFloat(val) }); notifyWithVoice(`Diámetro de ${tag} cambiado`, false); return true; }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'waypoint' || parts[4] === 'punto')) {
                const wp = extractCoords(cmd);
                if (wp) {
                    const line = _core.getDb().lines.find(l => l.tag === tag);
                    if (line) {
                        let pts = line.points || line._cachedPoints || [];
                        pts.push(wp);
                        _core.updateLine(tag, { points: pts, _cachedPoints: pts });
                        notifyWithVoice(`Waypoint añadido a ${tag}`, false);
                        return true;
                    }
                }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5; const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
                if (atIdx !== -1) position = parseFloat(parts[atIdx+1]);
                const compDef = _catalog.getComponent(compType);
                if (!compDef) { notifyWithVoice(`Componente desconocido: ${compType}`, true); return true; }
                const line = _core.getDb().lines.find(l => l.tag === tag);
                if (line) {
                    const comp = { type: compDef.tipo, tag: `${compType}-${Date.now().slice(-6)}`, param: position };
                    line.components = line.components || [];
                    line.components.push(comp);
                    _core.updateLine(tag, { components: line.components });
                    notifyWithVoice(`${compDef.nombre} añadido a ${tag}`, false);
                    return true;
                }
            }
        }
        return false;
    }

    // ==================== LIST ====================
    function parseListComponents(cmd) { if (cmd.trim().toLowerCase() === 'list components') { const types = _catalog.listComponentTypes(); notifyWithVoice("Componentes: "+types.join(', '), false); return true; } return false; }
    function parseListEquipment(cmd) { if (cmd.trim().toLowerCase() === 'list equipment') { const types = _catalog.listEquipmentTypes(); notifyWithVoice("Equipos: "+types.join(', '), false); return true; } return false; }

    // ==================== BOM ====================
    function parseBOM(cmd) { if (cmd.trim().toLowerCase() === 'bom' || cmd.trim().toLowerCase() === 'mto') { generateBOM(); return true; } return false; }
    function generateBOM() {
        const db = _core.getDb();
        let items = [];
        db.equipos.forEach(eq => items.push([eq.tag, eq.tipo, 1]));
        db.lines.forEach(line => {
            let len = 0; const pts = line.points || line._cachedPoints;
            if (pts) for (let i=0; i<pts.length-1; i++) len += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
            items.push([line.tag, `Tubería ${line.diameter}"`, (len/1000).toFixed(2)+" m"]);
            if (line.components) line.components.forEach(c => items.push([c.tag, c.type, 1]));
        });
        let csv = "Tag,Descripción,Cantidad\n";
        items.forEach(i => csv += `${i[0]},${i[1]},${i[2]}\n`);
        const blob = new Blob([csv], {type:'text/csv'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `BOM_${Date.now()}.csv`;
        a.click();
        notifyWithVoice(`BOM generado`, false);
    }

    // ==================== AUDIT ====================
    function parseAudit(cmd) { if (cmd.trim().toLowerCase() === 'audit') { const report = _core.auditModel(); notifyWithVoice(report, false); return true; } return false; }

    // ==================== HELP ====================
    function parseHelp(cmd) {
        if (cmd.trim().toLowerCase() !== 'help' && cmd.trim().toLowerCase() !== 'ayuda') return false;
        notifyWithVoice("Comandos: create, connect, route, delete, edit, list, info, bom, audit, undo, redo, help, tap, split", false);
        return true;
    }

    // ==================== TAP ====================
    function parseTap(cmd) { 
        // Implementación simplificada (puedes ampliarla)
        notifyWithVoice("Comando tap en desarrollo", false);
        return true;
    }

    // ==================== SPLIT ====================
    function parseSplit(cmd) { 
        notifyWithVoice("Comando split en desarrollo", false);
        return true;
    }

    // ==================== IMPORT PCF (delega a IO) ====================
    function importPCF(fileContent) {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.importPCF) {
            SmartFlowIO.importPCF(fileContent);
        } else {
            notifyWithVoice("Importación PCF delegada a SmartFlowIO", false);
        }
        return true;
    }

    // ==================== EJECUCIÓN ====================
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const norm = normalizeCommand(cmd);
        const trimmed = norm.trim();
        if (parseCreateLine(trimmed)) return true;
        if (parseCreateManifold(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseRoute(trimmed)) return true;
        if (parseDelete(trimmed)) return true;
        if (parseEditCommand(trimmed)) return true;
        if (parseListComponents(trimmed)) return true;
        if (parseListEquipment(trimmed)) return true;
        if (parseBOM(trimmed)) return true;
        if (parseAudit(trimmed)) return true;
        if (parseHelp(trimmed)) return true;
        if (parseInfo(trimmed)) return true;
        if (parseTap(trimmed)) return true;
        if (parseSplit(trimmed)) return true;
        if (trimmed === 'undo' || trimmed === 'deshacer') { _core.undo(); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { _core.redo(); return true; }
        notifyWithVoice(`Comando no reconocido: "${cmd}"`, true);
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let ok = 0, fail = 0;
        for (let raw of lines) {
            const t = raw.trim();
            if (!t || t.startsWith('//')) continue;
            if (executeCommand(t)) ok++;
            else fail++;
        }
        notifyWithVoice(`${ok} comandos OK, ${fail} fallidos`, fail>0);
        return ok;
    }

    function init(core, catalog, render, notifyFn, renderFn) {
        _core = core;
        _catalog = catalog;
        _render = render;
        if (notifyFn) _notifyUI = notifyFn;
        if (renderFn) _renderUI = renderFn;
        console.log("✅ SmartFlowCommands inicializado correctamente");
    }

    return { init, executeCommand, executeBatch, importPCF };
})();
