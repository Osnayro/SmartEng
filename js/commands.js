
// ============================================================
// SMARTFLOW COMMANDS v6.2 (Completo: todos los comandos de texto)
// Archivo: js/commands.js
// ============================================================

const SmartFlowCommands = (function() {
    let _core = null;
    let _catalog = null;
    let _render = null;
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

    // -------------------- UTILIDADES DE EXTRACCIÓN --------------------
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

    // -------------------- NOTIFICACIÓN --------------------
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
        if (line.origin) origen = `${line.origin.equipTag}.${line.origin.portId}`;
        if (line.destination) destino = `${line.destination.equipTag}.${line.destination.portId}`;
        const msg = `Línea ${tag} | Diámetro: ${line.diameter || '?'}" | Material: ${line.material || 'N/D'} | Puntos: ${numPuntos} | Componentes: ${line.components?.length || 0} | Origen: ${origen} | Destino: ${destino}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoEquipment(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (!eq) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
        const msg = `Equipo ${tag} | Tipo: ${eq.tipo} | Material: ${eq.material || 'N/D'} | Pos: (${eq.posX}, ${eq.posY}, ${eq.posZ}) | Diámetro: ${eq.diametro || '-'} | Puertos: ${eq.puertos?.map(p=>p.id).join(', ') || 'ninguno'}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoComponent(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        for (let line of db.lines) {
            const comp = line.components?.find(c => c.tag === tag);
            if (comp) {
                notifyWithVoice(`Componente ${tag} | Tipo: ${comp.type} | Línea: ${line.tag} | Parámetro: ${comp.param}`, false);
                return true;
            }
        }
        notifyWithVoice(`Componente ${tag} no encontrado`, true);
        return true;
    }

    // ==================== CREATE (equipo) ====================
    function parseCreate(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create') return false;
        const tipo = parts[1]; const tag = parts[2];
        if (parts[3] !== 'at') return false;
        let coordStr = '';
        for (let i=4; i<parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const coords = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        const x=parseFloat(coords[1]), y=parseFloat(coords[2]), z=parseFloat(coords[3]);
        let params = {};
        for (let i=5; i<parts.length; i++) {
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
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5', points = [], i=3;
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
        const newLine = { tag, diameter, material, spec, points, _cachedPoints: points, waypoints: points.slice(1,-1), components: [] };
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
        const colector = { tag, tipo: 'colector', posX: x, posY: y, posZ: z, diametro, altura: 0, largo: (numEntradas-1)*spacing, material, spec, num_entradas: numEntradas, spacing, salida_pos: outputPos, diametro_entrada: diametro, diametro_salida: diametro };
        const def = _catalog.getEquipment('colector');
        colector.puertos = def.generarPuertos(colector);
        _core.addEquipment(colector);
        _core.setSelected({ type: 'equipment', obj: colector });
        notifyWithVoice(`Colector ${tag} creado`, false);
        return true;
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
        // Detectar si el siguiente token es parámetro
        if (toNozzle && isNaN(parseFloat(toNozzle)) && toNozzle !== '0' && toNozzle !== '1' && !/^[A-Za-z]/.test(toNozzle[0])) toNozzle = null;
        for (let i=6; i<parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.routeBetweenPorts) {
            SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        } else {
            notifyWithVoice("Router no disponible para conectar", true);
        }
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
        if (nextIdx < parts.length && !parts[nextIdx].startsWith('diam') && parts[nextIdx] !== 'material' && parts[nextIdx] !== 'spec') {
            toNozzle = parts[nextIdx]; nextIdx++;
        }
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i=nextIdx; i<parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        } else {
            notifyWithVoice("Módulo Router no disponible.", true);
        }
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
            } else if (action === 'set' || action === 'establecer') {
                if (parts[4] === 'puerto') {
                    const puertoId = parts[5], subParam = parts[6];
                    if (subParam === 'diam' || subParam === 'diametro') {
                        const nuevoDiam = parseFloat(parts[7]);
                        if (!isNaN(nuevoDiam)) { _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam }); notifyWithVoice(`Puerto ${puertoId} diámetro ${nuevoDiam}"`, false); return true; }
                    } else if (subParam === 'pos' || subParam === 'posicion') {
                        const posCoords = extractCoords(cmd.substr(cmd.indexOf('pos')));
                        if (posCoords) { _core.updatePuerto(tag, puertoId, { pos: posCoords }); notifyWithVoice(`Puerto ${puertoId} posición actualizada`, false); return true; }
                    } else if (subParam === 'dir' || subParam === 'direccion') {
                        const dirCoords = extractCoords(cmd.substr(cmd.indexOf('dir')));
                        if (dirCoords) { _core.updatePuerto(tag, puertoId, { dir: dirCoords }); notifyWithVoice(`Puerto ${puertoId} dirección actualizada`, false); return true; }
                    }
                }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const prop = parts[4], value = parts[5];
                if (prop === 'material') { _core.updateLine(tag, { material: value.toUpperCase() }); notifyWithVoice(`Línea ${tag} material ${value}`, false); return true; }
                else if (prop === 'diameter' || prop === 'diametro') { _core.updateLine(tag, { diameter: parseFloat(value) }); notifyWithVoice(`Línea ${tag} diámetro ${value}"`, false); return true; }
                else if (prop === 'spec') { _core.updateLine(tag, { spec: value }); notifyWithVoice(`Línea ${tag} especificación ${value}`, false); return true; }
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
            } else if ((action === 'remove' || action === 'quitar') && (parts[4] === 'waypoint' || parts[4] === 'punto')) {
                const idx = parseInt(parts[5])-1;
                const line = _core.getDb().lines.find(l => l.tag === tag);
                if (line && line.points && idx>=0 && idx<line.points.length) {
                    line.points.splice(idx,1);
                    _core.updateLine(tag, { points: line.points, _cachedPoints: line.points });
                    notifyWithVoice(`Waypoint ${idx+1} eliminado de ${tag}`, false);
                    return true;
                }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5; const atIdx = parts.indexOf('at')!==-1 ? parts.indexOf('at') : parts.indexOf('en');
                if (atIdx !== -1) position = parseFloat(parts[atIdx+1]);
                const suppressTransition = parts.slice(atIdx!==-1 ? atIdx+2 : 6).some(p => p === 'nt' || p === 'notransition');
                const line = _core.getDb().lines.find(l => l.tag === tag);
                if (!line) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
                const compDef = _catalog.getComponent(compType);
                if (!compDef) { notifyWithVoice(`Componente desconocido: ${compType}`, true); return true; }
                // Transición automática de materiales
                const lineMaterial = (line.material || 'PPR').toUpperCase();
                const compMaterial = (compDef.material || '').toUpperCase();
                if (compMaterial && lineMaterial !== compMaterial && !suppressTransition) {
                    const transition = _catalog.getTransitionAccessories(lineMaterial, compMaterial, line.diameter);
                    if (transition) {
                        if (transition.left) {
                            const leftComp = { type: transition.left, tag: `${transition.left}-${Date.now().slice(-8)}`, param: Math.max(0, position-0.05) };
                            line.components = line.components || [];
                            line.components.push(leftComp);
                            notifyWithVoice(`Adaptador ${transition.left} insertado`, false);
                        }
                        if (transition.right) {
                            const rightComp = { type: transition.right, tag: `${transition.right}-${Date.now().slice(-8)}`, param: Math.min(1, position+0.05) };
                            line.components.push(rightComp);
                            notifyWithVoice(`Adaptador ${transition.right} insertado`, false);
                        }
                    } else if (!suppressTransition) {
                        notifyWithVoice(`Advertencia: No se encontró adaptador para transición ${lineMaterial} → ${compMaterial}`, true);
                    }
                }
                // Insertar componente principal
                const comp = { type: compDef.tipo, tag: `${compType}-${Date.now().slice(-6)}`, param: position };
                line.components = line.components || [];
                line.components.push(comp);
                _core.updateLine(tag, { components: line.components });
                notifyWithVoice(`${compDef.nombre} añadido a ${tag}`, false);
                return true;
            }
        }
        return false;
    }

    // ==================== LIST ====================
    function parseListComponents(cmd) { if (cmd.trim().toLowerCase() === 'list components') { const types = _catalog.listComponentTypes(); notifyWithVoice("Componentes: "+types.join(', '), false); return true; } return false; }
    function parseListEquipment(cmd) { if (cmd.trim().toLowerCase() === 'list equipment') { const types = _catalog.listEquipmentTypes(); notifyWithVoice("Equipos: "+types.join(', '), false); return true; } return false; }
    function parseListSpecs(cmd) { if (cmd.trim().toLowerCase() === 'list specs') { const specs = _catalog.listSpecs(); notifyWithVoice("Especificaciones: "+specs.join(', '), false); return true; } return false; }

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
        notifyWithVoice(`BOM generado con ${items.length} ítems`, false);
    }

    // ==================== AUDIT ====================
    function parseAudit(cmd) { if (cmd.trim().toLowerCase() === 'audit') { const report = _core.auditModel(); notifyWithVoice(report, false); return true; } return false; }

    // ==================== HELP ====================
    function parseHelp(cmd) {
        if (cmd.trim().toLowerCase() !== 'help' && cmd.trim().toLowerCase() !== 'ayuda') return false;
        let ayuda = "Comandos disponibles:\n" +
            "create/crear [tipo] [tag] at (x,y,z) [diam X] [altura Y] [material M]\n" +
            "create line [tag] route (x1,y1,z1) (x2,y2,z2) ...\n" +
            "connect/conectar [origen] [puerto] to [destino] [puerto]\n" +
            "route/ruta from [origen] [puerto] to [destino] [puerto]\n" +
            "delete/eliminar equipment/line [tag]\n" +
            "edit/editar equipment/line [tag] ...\n" +
            "list components | equipment | specs\n" +
            "info line/equipment/component [tag]\n" +
            "bom | mto\n" +
            "audit\n" +
            "tap [equipo] [puerto] to [línea] [posición 0-1]\n" +
            "split [línea] at (x,y,z)\n" +
            "undo | redo | help";
        notifyWithVoice(ayuda, false);
        return true;
    }

    // ==================== TAP ====================
    function parseTap(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'tap') return false;
        if (parts.length < 6 || parts[3] !== 'to') {
            notifyWithVoice("Uso: tap [Equipo] [Puerto] to [Línea] [Posición 0-1] [diametro D] [material M]", true);
            return true;
        }
        const fromEquip = parts[1], fromNozzle = parts[2];
        const toLine = parts[4];
        const posRaw = parts[5]; const pos = parseFloat(posRaw);
        if (isNaN(pos) || pos < 0 || pos > 1) {
            notifyWithVoice("La posición debe ser un número entre 0 y 1", true);
            return true;
        }
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquip);
        if (!fromObj) { notifyWithVoice(`Equipo origen "${fromEquip}" no encontrado`, true); return true; }
        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        if (!nzFrom) { notifyWithVoice(`Puerto "${fromNozzle}" no encontrado en ${fromEquip}`, true); return true; }
        let startPos = { x: fromObj.posX + (nzFrom.relX||0), y: fromObj.posY + (nzFrom.relY||0), z: fromObj.posZ + (nzFrom.relZ||0) };
        const toObj = db.lines.find(l => l.tag === toLine);
        if (!toObj || !(toObj.points || toObj._cachedPoints)) {
            notifyWithVoice(`Línea destino "${toLine}" no encontrada o no válida`, true);
            return true;
        }
        if (typeof SmartFlowRouter === 'undefined' || !SmartFlowRouter.insertarAccesorioEnLinea) {
            notifyWithVoice("Módulo Router no disponible.", true);
            return true;
        }
        const pts = toObj.points || toObj._cachedPoints;
        let totalLen = 0, lengths = [];
        for (let i=0; i<pts.length-1; i++) {
            const d = Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
            lengths.push(d); totalLen += d;
        }
        const targetLen = totalLen * pos;
        let accum = 0, segIdx = 0, t = 0;
        for (let i=0; i<lengths.length; i++) {
            if (accum+lengths[i] >= targetLen || i===lengths.length-1) {
                segIdx = i; t = (targetLen-accum)/(lengths[i]||1); break;
            }
            accum += lengths[i];
        }
        const pA = pts[segIdx], pB = pts[segIdx+1];
        const puntoConexion = { x: pA.x+(pB.x-pA.x)*t, y: pA.y+(pB.y-pA.y)*t, z: pA.z+(pB.z-pA.z)*t };
        const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toLine, puntoConexion, diameter, true);
        if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio automáticamente.", true); return true; }
        const newTag = `L-${(db.lines?.length || 0)+1}`;
        const nuevaLinea = {
            tag: newTag, diameter, material, spec,
            points: [startPos, puntoConexion], _cachedPoints: [startPos, puntoConexion],
            origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle },
            destination: { objType: 'line', equipTag: toLine, portId: puertoId },
            components: []
        };
        _core.addLine(nuevaLinea);
        nzFrom.connectedLine = newTag;
        const toObjUpd = db.lines.find(l => l.tag === toLine);
        if (toObjUpd?.puertos) { const p = toObjUpd.puertos.find(p => p.id === puertoId); if (p) p.connectedLine = newTag; }
        _core.syncPhysicalData(); _core._saveState();
        notifyWithVoice(`✅ Derivación creada: ${newTag} (${fromEquip}.${fromNozzle} → ${toLine} en ${pos.toFixed(2)})`, false);
        return true;
    }

    // ==================== SPLIT ====================
    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir' && parts[0] !== 'romper') return false;
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        if (!lineTag || !coords) {
            notifyWithVoice("Uso: split [línea] at (x,y,z). Tip: Puedes usar Ctrl+Clic en el modelo.", true);
            return true;
        }
        const type = extractValue(parts, ['type', 'tipo']) || 'TEE_EQUAL';
        notifyWithVoice(`Dividiendo línea ${lineTag} e insertando ${type}...`);
        if (!_core.splitLine) {
            notifyWithVoice("Función splitLine no disponible en Core", true);
            return true;
        }
        const result = _core.splitLine(lineTag, coords, { type });
        if (result) {
            _core.setSelected({ type: 'COMPONENTE', obj: result.componente, parent: result.linea });
            notifyWithVoice(`Línea dividida correctamente.`, false);
        } else {
            notifyWithVoice(`Error: El punto (${coords.x}, ${coords.y}, ${coords.z}) está muy lejos de la línea ${lineTag}`, true);
        }
        return true;
    }

    // ==================== IMPORT PCF (delegado a IO) ====================
    function importPCF(fileContent) {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.importPCF) {
            SmartFlowIO.importPCF(fileContent);
        } else {
            notifyWithVoice("Importación PCF delegada a SmartFlowIO. Módulo no disponible.", true);
        }
        return true;
    }

    // ==================== EJECUCIÓN DE COMANDOS ====================
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        if (parseCreateLine(trimmed)) return true;
        if (parseCreateManifold(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseRoute(trimmed)) return true;
        if (parseDelete(trimmed)) return true;
        if (parseEditCommand(trimmed)) return true;
        if (parseListComponents(trimmed)) return true;
        if (parseListEquipment(trimmed)) return true;
        if (parseListSpecs(trimmed)) return true;
        if (parseBOM(trimmed)) return true;
        if (parseAudit(trimmed)) return true;
        if (parseHelp(trimmed)) return true;
        if (parseInfo(trimmed)) return true;
        if (parseTap(trimmed)) return true;
        if (parseSplit(trimmed)) return true;
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); return true; }
        notifyWithVoice(`Comando no reconocido: "${cmd}"`, true);
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0, failed = 0;
        for (let raw of lines) {
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notifyWithVoice(`No entendí: "${trimmed.substring(0,50)}..."`, true); }
        }
        notifyWithVoice(`${executed} comandos ejecutados, ${failed} fallidos`, failed>0);
        return executed;
    }

    function init(coreInstance, catalogInstance, renderInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _render = renderInstance;
        if (notifyFn) _notifyUI = notifyFn;
        if (renderFn) _renderUI = renderFn;
        console.log("✅ SmartFlowCommands inicializado (todos los comandos disponibles)");
    }

    return { init, executeCommand, executeBatch, importPCF };
})();
