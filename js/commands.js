const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _voiceFn = null;

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
        'split': 'split', 'dividir': 'split', 'romper': 'split',
        'punto': 'point', 'coordenadas': 'point', 'coordenada': 'point', 'posicion': 'point', 'ubicacion': 'point',
        'nodos': 'nodes', 'nodo': 'nodes', 'nodes': 'nodes'
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

    function getBasePosition(obj) {
        if (!obj) return { x: 0, y: 0, z: 0 };
        if (obj.posX !== undefined) return { x: obj.posX || 0, y: obj.posY || 0, z: obj.posZ || 0 };
        if (obj.pos && obj.pos.x !== undefined) return { x: obj.pos.x || 0, y: obj.pos.y || 0, z: obj.pos.z || 0 };
        const pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points || []);
        return pts.length > 0 ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: 0, y: 0, z: 0 };
    }

    function getPoints(obj) {
        if (!obj) return [];
        if (_core) return _core.getLinePoints(obj) || [];
        return obj._cachedPoints || obj.points3D || obj.points || [];
    }

    function getPortDirectionLocal(obj, portId) {
        if (!obj) return { dx: 1, dy: 0, dz: 0 };
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortDirection) {
            const d = SmartFlowRouter.getPortDirection(obj, portId);
            return { dx: d.x, dy: d.y, dz: d.z };
        }
        const puerto = obj.puertos?.find(p => p.id === portId);
        if (puerto) {
            const ori = puerto.orientacion || puerto.dir || puerto.normal;
            if (ori) return { dx: ori.x ?? ori.dx ?? 1, dy: ori.y ?? ori.dy ?? 0, dz: ori.z ?? ori.dz ?? 0 };
        }
        const pts = getPoints(obj);
        if (pts && pts.length >= 2) {
            let pA = pts[0], pB = pts[1];
            if (portId === '1' || portId === String(pts.length - 1)) {
                pA = pts[pts.length - 2]; pB = pts[pts.length - 1];
            }
            const dx = pB.x - pA.x, dy = pB.y - pA.y, dz = pB.z - pA.z;
            const len = Math.hypot(dx, dy, dz) || 1;
            return { dx: dx/len, dy: dy/len, dz: dz/len };
        }
        return { dx: 1, dy: 0, dz: 0 };
    }

    function calcularPuntoParametrico(lineObj, param) {
        const pts = getPoints(lineObj);
        if (pts.length < 2) return null;
        let totalLen = 0, lengths = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        const target = totalLen * param;
        let accum = 0, segIdx = 0, t = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (accum + lengths[i] >= target || i === lengths.length - 1) { segIdx = i; t = (target - accum) / (lengths[i] || 1); break; }
            accum += lengths[i];
        }
        const pA = pts[segIdx], pB = pts[segIdx + 1];
        return { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t,
                 segIdx, t, totalLen, target };
    }

    function notifyWithVoice(message, isError = false) {
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        if (typeof _voiceFn === 'function') { _voiceFn(message); }
    }

    // Unificación centralizada de inyección delegando estrictamente al módulo Router
    function runFittingInjection(line, fromObj, fromPortId, toObj, toPortId, diameter, material) {
        if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.ensureFittings === 'function') {
            return SmartFlowRouter.ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material);
        }
        return { added: [], message: ' | ⚠️ Router no disponible para inyección' };
    }

    function parsePoint(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'point' && parts[0] !== 'coordenadas') return false;
        try {
            let tag = null, subCommand = null, subId = null;
            if (parts.length >= 3 && parts[1]?.toLowerCase() === 'de') {
                tag = parts[2];
                if (parts.length >= 5) { subCommand = parts[3]?.toLowerCase(); subId = parts[4]; }
            } else if (parts.length >= 2) {
                let ref = parts[1];
                const dotIdx = ref.indexOf('.');
                const atIdx = ref.indexOf('@');
                if (atIdx > 0) {
                    tag = ref.substring(0, atIdx);
                    subId = ref.substring(atIdx + 1);
                    const numVal = parseFloat(subId);
                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 1) subCommand = 'param';
                    else if (subId.toUpperCase() === 'START' || subId === '0') { subCommand = 'punto'; subId = '0'; }
                    else if (subId.toUpperCase() === 'END' || subId === '1') { subCommand = 'punto'; subId = 'end'; }
                    else subCommand = 'puerto';
                } else if (dotIdx > 0) {
                    tag = ref.substring(0, dotIdx);
                    subId = ref.substring(dotIdx + 1);
                    subCommand = 'puerto';
                } else { tag = ref; }
            } else { notifyWithVoice('Uso: coordenadas de TAG [puerto|punto ID]', true); return true; }
            if (!tag) { notifyWithVoice('❌ Tag no especificado', true); return true; }
            if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
            const obj = _core.findObjectByTag(tag);
            if (!obj) { notifyWithVoice(`❌ "${tag}" no encontrado`, true); return true; }
            const basePos = getBasePosition(obj);
            const isEq = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
            let response = `📍 ${tag}`;
            if (!subCommand) {
                if (isEq) {
                    response += ` → (X=${basePos.x.toFixed(0)}, Y=${basePos.y.toFixed(0)}, Z=${basePos.z.toFixed(0)})`;
                    if (obj.diametro) response += ` | ⌀${obj.diametro}mm`;
                    if (obj.altura) response += ` | H=${obj.altura}mm`;
                }
                if (obj.puertos?.length) {
                    response += '\n🔌 Puertos:';
                    obj.puertos.forEach(p => {
                        const px = basePos.x + (p.relX || p.relPos?.x || 0);
                        const py = basePos.y + (p.relY || p.relPos?.y || 0);
                        const pz = basePos.z + (p.relZ || p.relPos?.z || 0);
                        response += `\n  • ${p.id} (${px.toFixed(0)},${py.toFixed(0)},${pz.toFixed(0)}) | ${p.diametro}"`;
                    });
                }
                const pts = getPoints(obj);
                if (pts.length > 0) {
                    response += `\n📏 ${pts.length} puntos:`;
                    pts.forEach((p, i) => response += `\n  P0${i}: (${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)})`);
                    let len = 0;
                    for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
                    response += `\n📐 Long: ${(len/1000).toFixed(2)} m`;
                }
                notifyWithVoice(response, false);
                return true;
            }
            if (subCommand === 'puerto' && subId) {
                const puerto = obj.puertos?.find(p => p.id === subId || p.id?.toUpperCase() === subId?.toUpperCase());
                if (!puerto) { notifyWithVoice(`❌ Puerto "${subId}" no encontrado`, true); return true; }
                const px = basePos.x + (puerto.relX || 0), py = basePos.y + (puerto.relY || 0), pz = basePos.z + (puerto.relZ || 0);
                response += ` → ${puerto.id} (${px.toFixed(0)},${py.toFixed(0)},${pz.toFixed(0)}) | ${puerto.diametro}" | ${puerto.status}`;
                notifyWithVoice(response, false);
                return true;
            }
            if (subCommand === 'punto' && subId !== undefined) {
                const pts = getPoints(obj);
                if (!pts.length) { notifyWithVoice(`⚠️ ${tag} sin geometría`, true); return true; }
                const idx = subId === 'end' ? pts.length - 1 : parseInt(subId);
                if (isNaN(idx) || idx < 0 || idx >= pts.length) { notifyWithVoice(`❌ Índice inválido (0-${pts.length-1})`, true); return true; }
                response += ` → P${idx}: (${pts[idx].x.toFixed(0)},${pts[idx].y.toFixed(0)},${pts[idx].z.toFixed(0)})`;
                notifyWithVoice(response, false);
                return true;
            }
            if (subCommand === 'param' && subId !== undefined) {
                const coords = calcularPuntoParametrico(obj, parseFloat(subId));
                if (!coords) { notifyWithVoice(`⚠️ ${tag} sin geometría`, true); return true; }
                response += ` @${subId}: (${coords.x.toFixed(0)},${coords.y.toFixed(0)},${coords.z.toFixed(0)})`;
                notifyWithVoice(response, false);
                return true;
            }
            notifyWithVoice('Comando no reconocido', true);
            return true;
        } catch (e) { notifyWithVoice('❌ Error: ' + e.message, true); return true; }
    }

    function parseNodes(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'nodes' && parts[0] !== 'nodos') return false;
        if (parts.length < 2) { notifyWithVoice('Uso: nodos TAG', true); return true; }
        const tag = parts[1];
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(`${tag} no encontrado`, true); return true; }
        let nodes = [];
        if (obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined)) {
            nodes = (obj.puertos || []).map(p => `${p.id} ⌀${p.diametro || '?'}" ${p.status}`);
        } else {
            nodes = ['START (P0)', 'END (P' + (getPoints(obj).length - 1) + ')'];
            if (obj.puertos) nodes.push(...obj.puertos.filter(p => !['START', 'END', '0', '1'].includes(p.id)).map(p => p.id));
        }
        notifyWithVoice(`🔌 Nodos de ${tag}: ${nodes.join(' | ')}`, false);
        return true;
    }

    function parseInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        if (parts.length < 2) { notifyWithVoice("Uso: info line [TAG] | info equipment [TAG] | info component [TAG]", true); return true; }
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
        const line = _core.findObjectByTag(tag);
        if (!line || !_core.getLines().includes(line)) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
        const pts = getPoints(line);
        const numPuntos = pts.length;
        let origen = "Ninguno", destino = "Ninguno";
        if (line.origin) {
            const obj = _core.findObjectByTag(line.origin.equipTag);
            origen = `${line.origin.equipTag}.${line.origin.portId} (${obj?.tipo || 'line'})`;
        }
        if (line.destination) {
            const obj = _core.findObjectByTag(line.destination.equipTag);
            destino = `${line.destination.equipTag}.${line.destination.portId} (${obj?.tipo || 'line'})`;
        }
        let totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
        const msg = `📋 Línea ${tag} | ⌀${line.diameter || '?'}" | ${line.material || 'N/D'} | Spec: ${line.spec || 'N/D'} | Puntos: ${numPuntos} | Long: ${(totalLen/1000).toFixed(2)}m | Componentes: ${line.components?.length || 0} | Origen: ${origen} | Destino: ${destino}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoEquipment(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const eq = _core.findObjectByTag(tag);
        if (!eq || !_core.getEquipos().includes(eq)) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
        const tipo = eq.tipo || 'Desconocido';
        const material = eq.material || 'N/D';
        const pos = getBasePosition(eq);
        const msg = `📋 Equipo ${tag} | Tipo: ${tipo} | Material: ${material} | Pos: (${pos.x.toFixed(0)},${pos.y.toFixed(0)},${pos.z.toFixed(0)}) | ⌀${eq.diametro || 'N/D'} H=${eq.altura || 'N/D'} | Puertos: ${(eq.puertos || []).map(p => p.id).join(', ') || 'Ninguno'}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoComponent(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        let foundComp = null, foundLine = null;
        for (let line of _core.getLines()) {
            if (line.components) {
                const comp = line.components.find(c => c.tag === tag);
                if (comp) { foundComp = comp; foundLine = line; break; }
            }
        }
        if (!foundComp) { notifyWithVoice(`Componente ${tag} no encontrado`, true); return true; }
        const msg = `📋 Componente ${tag} | Tipo: ${foundComp.type} | Línea: ${foundLine.tag} | Posición: ${foundComp.param?.toFixed(2) || 'N/D'}`;
        notifyWithVoice(msg, false);
        return true;
    }

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
            if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: equipo });
            notifyWithVoice(`Equipo ${tag} (${equipoDef.nombre}) creado`, false);
        }
        return true;
    }

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
                    const coordStr = parts[i];
                    const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                    if (m) points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
                    else break;
                    i++;
                }
                continue;
            }
            i++;
        }
        if (points.length < 2) { notifyWithVoice("Error: Se requieren al menos 2 puntos", true); return true; }
        const nuevaLinea = { tag, diameter, material, spec, _cachedPoints: points, waypoints: points.slice(1, -1), components: [] };
        
        _core.addLine(nuevaLinea);
        
        // Sincronización post-inserción en Core
        const db = _core.getDb();
        const lineaRegistrada = db.lines.find(l => l.tag === tag) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, null, null, null, null, diameter, material);
        if (_core.updateLine) { _core.updateLine(tag, lineaRegistrada); }

        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        notifyWithVoice(`Línea ${tag} creada${fittingInfo.message}`, false);
        return true;
    }

    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        const fromEquip = parts[1], fromNozzle = parts[2];
        if (parts[3] !== 'to' && parts[3] !== 'a') return false;
        const toEquip = parts[4];
        let toNozzleRaw = parts[5];
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        if (toNozzleRaw && isNaN(parseFloat(toNozzleRaw)) && toNozzleRaw !== '0' && toNozzleRaw !== '1' && !/^[A-Za-z]/.test(toNozzleRaw?.[0]||'')) {
            toNozzleRaw = '';
        }
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }

        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip);
        const toObj = _core.findObjectByTag(toEquip);
        if (!fromObj || !toObj) { notifyWithVoice("Objeto no encontrado", true); return true; }

        let startPos = null, fromDiameter = 4;
        if (_core.getLinePoints(fromObj) && (fromNozzle === '0' || fromNozzle === '1')) {
            const pts = _core.getLinePoints(fromObj);
            if (pts && pts.length >= 2) {
                startPos = fromNozzle === '0' ? { ...pts[0] } : { ...pts[pts.length - 1] };
                fromDiameter = fromObj.diameter || 4;
            } else { notifyWithVoice("La línea origen no tiene geometría válida", true); return true; }
        } else {
            const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
            if (!nzFrom) { notifyWithVoice("Puerto origen no encontrado", true); return true; }
            fromDiameter = nzFrom.diametro || 4;
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
                startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
            } else {
                const basePos = getBasePosition(fromObj);
                startPos = { x: basePos.x + (nzFrom.relX || 0), y: basePos.y + (nzFrom.relY || 0), z: basePos.z + (nzFrom.relZ || 0) };
            }
        }
        if (!startPos) { notifyWithVoice("No se pudo obtener la posición del puerto origen", true); return true; }

        const isFromLine = _core.getLinePoints(fromObj) ? true : false;
        const isToLine = _core.getLinePoints(toObj) ? true : false;
        const db = _core.getDb();
        const newTag = `L-${(db.lines?.length || 0) + 1}`;
        let endPos = null, nuevoPuertoId = toNozzleRaw;
        let nzTo = null;

        if (isToLine && (!toNozzleRaw || toNozzleRaw === '')) {
            const pts = _core.getLinePoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("La línea destino no tiene geometría", true); return true; }
            let minDist = Infinity, bestPoint = pts[0];
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i+1];
                const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
                const ap = { x: startPos.x - a.x, y: startPos.y - a.y, z: startPos.z - a.z };
                const len2 = ab.x*ab.x + ab.y*ab.y + ab.z*ab.z;
                let t = len2 !== 0 ? Math.max(0, Math.min(1, (ap.x*ab.x + ap.y*ab.y + ap.z*ab.z) / len2)) : 0;
                const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
                const dist = Math.hypot(startPos.x - proj.x, startPos.y - proj.y, startPos.z - proj.z);
                if (dist < minDist) { minDist = dist; bestPoint = proj; }
            }
            if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') {
                notifyWithVoice("Router no disponible", true); return true;
            }
            const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, bestPoint, diameter, true);
            if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio automáticamente", true); return true; }
            nuevoPuertoId = puertoId;
            endPos = bestPoint;
            const toObjUpd = _core.findObjectByTag(toEquip);
            if (toObjUpd?.puertos) nzTo = toObjUpd.puertos.find(p => p.id === puertoId);
        } else {
            const numPos = parseFloat(toNozzleRaw);
            const isNumeric = !isNaN(numPos) && isFinite(numPos);
            let posRelativa = isNumeric ? Math.min(1, Math.max(0, numPos)) : null;
            if (isToLine && toObj.diameter && !parts.slice(6).some(p => p === 'diameter' || p === 'diametro')) diameter = toObj.diameter;
            if (!parts.slice(6).some(p => p === 'material')) { if (toObj.material) material = toObj.material; if (toObj.spec) spec = toObj.spec; }
            if (isToLine && posRelativa !== null && (posRelativa <= 0.01 || posRelativa >= 0.99)) { toNozzleRaw = posRelativa <= 0.01 ? '0' : '1'; posRelativa = null; }

            if (isToLine && posRelativa !== null) {
                const pts = _core.getLinePoints(toObj);
                if (!pts || pts.length < 2) { notifyWithVoice("Geometría inválida", true); return true; }
                let totalLen = 0, lengths = [];
                for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z); lengths.push(d); totalLen += d; }
                const targetLen = totalLen * posRelativa;
                let accum = 0, segIdx = 0, t = 0;
                for (let i = 0; i < lengths.length; i++) { if (accum + lengths[i] >= targetLen || i === lengths.length - 1) { segIdx = i; t = (targetLen - accum) / (lengths[i] || 1); break; } accum += lengths[i]; }
                const pA = pts[segIdx], pB = pts[segIdx + 1];
                const punto = { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t };
                if (typeof SmartFlowRouter !== 'undefined') {
                    const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, punto, diameter, true);
                    if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio", true); return true; }
                    nuevoPuertoId = puertoId;
                    endPos = punto;
                    const toObjUpd = _core.findObjectByTag(toEquip);
                    if (toObjUpd?.puertos) nzTo = toObjUpd.puertos.find(p => p.id === puertoId);
                }
            } else {
                if (isToLine && (toNozzleRaw === '0' || toNozzleRaw === '1')) {
                    const pts = _core.getLinePoints(toObj);
                    if (!pts || pts.length < 2) { notifyWithVoice("La línea destino no tiene geometría", true); return true; }
                    endPos = toNozzleRaw === '0' ? { ...pts[0] } : { ...pts[pts.length - 1] };
                } else {
                    if (!toObj.puertos) toObj.puertos = [];
                    nzTo = toObj.puertos?.find(n => n.id === toNozzleRaw);
                    if (!nzTo) { notifyWithVoice("Puerto destino no encontrado", true); return true; }
                    if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
                        endPos = SmartFlowRouter.getPortPosition(toObj, toNozzleRaw);
                    } else {
                        const basePos = getBasePosition(toObj);
                        endPos = { x: basePos.x + (nzTo.relX || 0), y: basePos.y + (nzTo.relY || 0), z: basePos.z + (nzTo.relZ || 0) };
                    }
                }
            }
        }

        if (!endPos) { notifyWithVoice("No se pudo determinar el punto de destino", true); return true; }

        const nuevaLinea = {
            tag: newTag, diameter, material, spec,
            origin: { objType: isFromLine ? 'line' : 'equipment', equipTag: fromEquip, portId: fromNozzle },
            destination: { objType: isToLine ? 'line' : 'equipment', equipTag: toEquip, portId: nuevoPuertoId },
            waypoints: [], _cachedPoints: [startPos, endPos], components: []
        };

        // --- CORRECCIÓN EN CONNECT: PERSISTENCIA INVERTIDA ---
        _core.addLine(nuevaLinea);
        
        const lineaRegistrada = _core.getDb().lines.find(l => l.tag === newTag) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, fromObj, fromNozzle, toObj, nuevoPuertoId, diameter, material);
        
        if (_core.updateLine) { _core.updateLine(newTag, lineaRegistrada); }

        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        if (nzFrom) nzFrom.connectedLine = newTag;
        if (nzTo) nzTo.connectedLine = newTag;
        notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip}.${nuevoPuertoId}${fittingInfo.message}`, false);
        return true;
    }

    function parseRoute(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'route' && parts[0] !== 'ruta') return false;
        if (parts[1] !== 'from' && parts[1] !== 'desde') return false;
        const fromEquip = parts[2], fromNozzle = parts[3];
        if (parts[4] !== 'to' && parts[4] !== 'a' && parts[4] !== 'hasta') return false;
        const toEquip = parts[5];
        let toNozzle = null, nextIdx = 6;
        if (nextIdx < parts.length && !parts[nextIdx].startsWith('diam') && parts[nextIdx] !== 'material' && parts[nextIdx] !== 'spec') { toNozzle = parts[nextIdx]; nextIdx++; }
        let diameter = 3, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = nextIdx; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        } else { notifyWithVoice("Módulo Router no disponible.", true); }
        return true;
    }

    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete' && parts[0] !== 'eliminar') return false;
        const type = parts[1], tag = parts[2];
        if (type === 'equipment' || type === 'equipo') {
            const db = _core.getDb();
            const index = db.equipos.findIndex(e => e.tag === tag);
            if (index === -1) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
            db.equipos.splice(index, 1);
            db.lines = db.lines.filter(line => !((line.origin && line.origin.equipTag === tag) || (line.destination && line.destination.equipTag === tag)));
            notifyWithVoice(`Equipo ${tag} eliminado`, false);
            return true;
        } else if (type === 'line' || type === 'línea') {
            const db = _core.getDb();
            const index = db.lines.findIndex(l => l.tag === tag);
            if (index === -1) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
            db.lines.splice(index, 1);
            db.equipos.forEach(eq => { if (eq.puertos) eq.puertos.forEach(p => { if (p.connectedLine === tag) delete p.connectedLine; }); });
            db.lines.forEach(l => { if (l.puertos) l.puertos.forEach(p => { if (p.connectedLine === tag) delete p.connectedLine; }); });
            notifyWithVoice(`Línea ${tag} eliminada`, false);
            return true;
        }
        return false;
    }

    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit' && parts[0] !== 'editar') return false;
        if (parts[1] === 'equipment' || parts[1] === 'equipo') {
            const tag = parts[2], action = parts[3];
            if (action === 'move' || action === 'mover') {
                let coordStr = '';
                for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]); _core.updateEquipment(tag, { posX: x, posY: y, posZ: z }); notifyWithVoice(`Equipo ${tag} movido`, false); return true; }
            } else if (action === 'set' || action === 'establecer') {
                if (parts[4] === 'puerto') {
                    const puertoId = parts[5], subParam = parts[6];
                    if (subParam === 'diam' || subParam === 'diametro') { const nuevoDiam = parseFloat(parts[7]); if (!isNaN(nuevoDiam)) { _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam }); notifyWithVoice(`Puerto ${puertoId} diámetro ${nuevoDiam}"`, false); return true; } }
                    else if (subParam === 'pos' || subParam === 'posicion') { let cs=''; for(let i=7;i<parts.length;i++){cs+=parts[i];if(parts[i].includes(')'))break;} const m=cs.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/); if(m){_core.updatePuerto(tag,puertoId,{pos:{x:parseFloat(m[1]),y:parseFloat(m[2]),z:parseFloat(m[3])}});notifyWithVoice(`Puerto ${puertoId} posición actualizada`,false);return true;} }
                    else if (subParam === 'dir' || subParam === 'direccion') { let cs=''; for(let i=7;i<parts.length;i++){cs+=parts[i];if(parts[i].includes(')'))break;} const m=cs.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/); if(m){_core.updatePuerto(tag,puertoId,{dir:{dx:parseFloat(m[1]),dy:parseFloat(m[2]),dz:parseFloat(m[3])}});notifyWithVoice(`Puerto ${puertoId} dirección actualizada`,false);return true;} }
                }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const property = parts[4], value = parts[5];
                if (property === 'material') { _core.updateLine(tag, { material: value.toUpperCase() }); notifyWithVoice(`Línea ${tag} material ${value}`, false); return true; }
                else if (property === 'diameter' || property === 'diametro') { _core.updateLine(tag, { diameter: parseFloat(value) }); notifyWithVoice(`Línea ${tag} diámetro ${value}"`, false); return true; }
                else if (property === 'spec') { _core.updateLine(tag, { spec: value }); notifyWithVoice(`Línea ${tag} específica ${value}`, false); return true; }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5; const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
                if (atIdx !== -1) position = parseFloat(parts[atIdx + 1]);
                const line = _core.findObjectByTag(tag);
                if (line && _core.getLines().includes(line)) {
                    const compDef = _catalog.getComponent(compType);
                    if (!compDef) { notifyWithVoice(`Componente desconocido: ${compType}`, true); return true; }
                    const comp = { type: compDef.tipo, tag: `${compType}-${Date.now().toString().slice(-6)}`, param: position };
                    if (!line.components) line.components = [];
                    line.components.push(comp);
                    if (compDef.generarPuertos) {
                        const nuevosPuertos = compDef.generarPuertos(line, position, line.diameter);
                        if (!line.puertos) line.puertos = [];
                        nuevosPuertos.forEach((p, idx) => { p.id = `${comp.tag}_${idx}`; line.puertos.push(p); });
                    }
                    _core.updateLine(tag, { components: line.components, puertos: line.puertos });
                    notifyWithVoice(`${compDef.nombre} añadido a ${tag}`, false);
                    return true;
                }
            }
        }
        return false;
    }

    function listEquipos() { const eqs = _core.getDb().equipos; notifyWithVoice(eqs.length ? `Equipos (${eqs.length}): ${eqs.map(e=>e.tag).join(', ')}` : 'No hay equipos'); }
    function listLineas() { const ls = _core.getDb().lines; notifyWithVoice(ls.length ? `Líneas (${ls.length}): ${ls.map(l=>`${l.tag}(${l.diameter}" ${l.material||'?'})`).join(', ')}` : 'No hay líneas'); }
    function parseList(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' && parts[0] !== 'listar') return false;
        const sub = parts[1]?.toLowerCase();
        if (sub === 'equipos') { listEquipos(); return true; }
        if (sub === 'lineas' || sub === 'líneas') { listLineas(); return true; }
        if (sub === 'componentes') { const types = _catalog.listComponentTypes(); notifyWithVoice(`Componentes: ${types.sort().join(', ')}`, false); return true; }
        if (sub === 'especificaciones') { const specs = _catalog.listSpecs(); notifyWithVoice(`Especificaciones: ${specs.sort().join(', ')}`, false); return true; }
        notifyWithVoice('Use: listar equipos | listar lineas | listar componentes | listar especificaciones');
        return true;
    }

    function parseBOM(cmd) { const t = cmd.trim().toLowerCase(); if (t === 'bom' || t === 'mto' || t === 'generate bom' || t === 'generar bom') { generateBOM(); return true; } return false; }
    function generateBOM() {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return; }
        const db = _core.getDb(); const lines = db.lines || []; const equipos = db.equipos || []; let items = [];
        equipos.forEach(eq => { if (eq.tipo !== 'colector') { items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: `${eq.tipo} ${eq.material || ''}`, cantidad: 1, unidad: 'Und' }); } });
        const pipeMap = new Map();
        lines.forEach(line => {
            const pts = getPoints(line); if (!pts || pts.length < 2) return;
            let length = 0; for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            const lengthM = length / 1000; const key = `${line.diameter}"-${line.material || 'PPR'}-${line.spec || 'STD'}`;
            if (pipeMap.has(key)) pipeMap.get(key).length += lengthM;
            else pipeMap.set(key, { diametro: line.diameter, material: line.material || 'PPR', spec: line.spec || 'STD', length: lengthM });
        });
        for (const [key, data] of pipeMap.entries()) items.push({ tipo: 'TUBERIA', tag: '', descripcion: `Tubo ${data.material} ${data.diametro}" ${data.spec}`, cantidad: data.length.toFixed(2), unidad: 'm' });
        const compMap = new Map();
        lines.forEach(line => { if (line.components) line.components.forEach(comp => { const key = `${comp.type}-${line.diameter}"`; compMap.set(key, (compMap.get(key) || 0) + 1); }); });
        for (const [key, count] of compMap.entries()) { const [type, diam] = key.split('-'); items.push({ tipo: 'COMPONENTE', tag: '', descripcion: `${type} ${diam}`, cantidad: count, unidad: 'Und' }); }
        let csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
        items.forEach(item => csv += `${item.tipo},${item.tag},${item.descripcion},${item.cantidad},${item.unidad}\n`);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `BOM_${window.currentProjectName || 'Proyecto'}_${Date.now()}.csv`; a.click();
        notifyWithVoice(`BOM generado con ${items.length} líneas.`, false);
    }

    function parseAudit(cmd) { const t = cmd.trim().toLowerCase(); if (t === 'audit' || t === 'auditar') { if (_core && _core.auditModel) _core.auditModel(); else notifyWithVoice("Auditoría no disponible.", true); return true; } return false; }

    function parseHelp(cmd) {
        const lower = cmd.toLowerCase(); if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "═══════════════════════════════════════════════════════════\n              SMARTFLOW PRO - COMANDOS DISPONIBLES\n═══════════════════════════════════════════════════════════\n\n";
        ayuda += "CREACIÓN:\n  create/crear [tipo] [tag] at (x,y,z)\n  create line [tag] route/ruta (x1,y1,z1)...\n\n";
        ayuda += "CONEXIÓN:\n  connect/conectar [origen] [puerto] to/a [destino] [puerto o 0-1 o 0.0-1.0]\n\n";
        ayuda += "COORDENADAS:\n  coordenadas de [TAG]\n  coordenadas de [TAG] puerto [ID]\n  coordenadas de [TAG] punto [N]\n  coordenadas [LINEA]@[0.0-1.0]\n  nodos [TAG]\n\n";
        ayuda += "INFO:\n  info line/equipment/component [TAG]\n  listar equipos | listar lineas\n\n";
        ayuda += "EDITAR:\n  edit line [TAG] add component [TIPO] at [0-1]\n\n";
        ayuda += "OTROS: bom | audit | tap | split | undo | redo | help\n═══════════════════════════════════════════════════════════\n";
        notifyWithVoice(ayuda, false); return true;
    }

    function parseTap(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'tap') return false;
        if (parts.length < 6 || parts[3] !== 'to') { notifyWithVoice("Uso: tap [Equipo] [Puerto] to [Línea] [Posición 0-1]", true); return true; }
        const fromEquip = parts[1], fromNozzle = parts[2], toLine = parts[4];
        const pos = parseFloat(parts[5]);
        if (isNaN(pos) || pos < 0 || pos > 1) { notifyWithVoice("Posición debe ser 0-1", true); return true; }
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip);
        if (!fromObj || !_core.getEquipos().includes(fromObj)) { notifyWithVoice(`Equipo "${fromEquip}" no encontrado`, true); return true; }
        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        if (!nzFrom) { notifyWithVoice(`Puerto "${fromNozzle}" no encontrado`, true); return true; }
        let startPos = null;
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
        else startPos = { x: (fromObj.posX||0) + (nzFrom.relX||0), y: (fromObj.posY||0) + (nzFrom.relY||0), z: (fromObj.posZ||0) + (nzFrom.relZ||0) };
        if (!startPos) { notifyWithVoice("No se pudo obtener posición origen", true); return true; }
        const toObj = _core.findObjectByTag(toLine);
        if (!toObj || !_core.getLines().includes(toObj) || !getPoints(toObj).length) { notifyWithVoice(`Línea "${toLine}" no encontrada`, true); return true; }
        if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') { notifyWithVoice("Router no disponible", true); return true; }
        const resultado = calcularPuntoParametrico(toObj, pos);
        if (!resultado) { notifyWithVoice("No se pudo calcular punto de conexión", true); return true; }
        const puntoConexion = { x: resultado.x, y: resultado.y, z: resultado.z };
        const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toLine, puntoConexion, diameter, true);
        if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio", true); return true; }
        const newTag = `L-${(_core.getDb().lines?.length || 0) + 1}`;
        const nuevaLinea = { 
            tag: newTag, diameter, material, spec, 
            origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle }, 
            destination: { objType: 'line', equipTag: toLine, portId: puertoId }, 
            waypoints: [], _cachedPoints: [startPos, puntoConexion], components: []
        };

        // --- CORRECCIÓN EN TAP: PERSISTENCIA POST-INSERCIÓN ---
        _core.addLine(nuevaLinea);
        
        const lineaRegistrada = _core.getDb().lines.find(l => l.tag === newTag) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, fromObj, fromNozzle, toObj, puertoId, diameter, material);
        
        if (_core.updateLine) { _core.updateLine(newTag, lineaRegistrada); }

        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        nzFrom.connectedLine = newTag;
        const toObjUpd = _core.findObjectByTag(toLine);
        if (toObjUpd?.puertos) { const p = toObjUpd.puertos.find(p => p.id === puertoId); if (p) p.connectedLine = newTag; }
        notifyWithVoice(`✅ Derivación: ${newTag} (${fromEquip}.${fromNozzle} → ${toLine} @${pos.toFixed(2)})${fittingInfo.message}`, false);
        return true;
    }

    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir' && parts[0] !== 'romper') return false;
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        if (!lineTag || !coords) { notifyWithVoice("Uso: split [línea] at (x,y,z)", true); return true; }
        const type = extractValue(parts, ['type', 'tipo']) || 'TEE_EQUAL';
        const result = _core.splitLine(lineTag, coords, { type });
        if (result) {
            if (_core.setSelected) _core.setSelected({ type: 'COMPONENTE', obj: result.componente, parent: result.linea });
            notifyWithVoice(`✅ Línea ${lineTag} dividida con ${type}`, false);
        } else {
            notifyWithVoice(`Error: Punto fuera de la línea ${lineTag}`, true);
        }
        return true;
    }

    const skeyToInternal = {
        'TANK': { type: 'equipment', internal: 'tanque_v' },
        'PUMP': { type: 'equipment', internal: 'bomba' },
        'VESS': { type: 'equipment', internal: 'tanque_v' },
        'STRA': { type: 'pipe', internal: 'PIPE' },
        'VALV': { type: 'component', internal: 'GATE_VALVE' },
        'VAGF': { type: 'component', internal: 'GATE_VALVE' },
        'VGLF': { type: 'component', internal: 'GLOBE_VALVE' },
        'VBAL': { type: 'component', internal: 'BALL_VALVE' },
        'VBAF': { type: 'component', internal: 'BUTTERFLY_VALVE' },
        'VCFF': { type: 'component', internal: 'CHECK_VALVE' },
        'ELBW': { type: 'component', internal: 'ELBOW_90_LR' },
        'ELL4': { type: 'component', internal: 'ELBOW_45' },
        'ELLL': { type: 'component', internal: 'ELBOW_90_LR' },
        'ELLS': { type: 'component', internal: 'ELBOW_90_SR' },
        'TEES': { type: 'component', internal: 'TEE_EQUAL' },
        'TEER': { type: 'component', internal: 'TEE_REDUCING' },
        'CROS': { type: 'component', internal: 'CROSS' },
        'FLWN': { type: 'component', internal: 'WELD_NECK_FLANGE' },
        'FLSO': { type: 'component', internal: 'SLIP_ON_FLANGE' },
        'FLBL': { type: 'component', internal: 'BLIND_FLANGE' },
        'CAPF': { type: 'component', internal: 'CAP' },
        'REDC': { type: 'component', internal: 'CONCENTRIC_REDUCER' },
        'REDE': { type: 'component', internal: 'ECCENTRIC_REDUCER' },
        'INSI': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INPG': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INTG': { type: 'component', internal: 'TEMPERATURE_GAUGE' },
        'INFM': { type: 'component', internal: 'FLOW_METER' },
        'INLV': { type: 'component', internal: 'LEVEL_SWITCH_RANA' }
    };

    function importPCF(fileContent) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado.", true); return; }
        const lines = fileContent.split('\n');
        let currentLine = null, puntos = [], componentes = [];
        const equiposMap = new Map(), lineasMap = new Map();
        let currentComponent = null;

        function processAccumulatedComponent() {
            if (!currentComponent || !currentComponent.skey) return;
            const mapping = skeyToInternal[currentComponent.skey];
            if (mapping) {
                if (mapping.type === 'equipment') {
                    const pos = currentComponent.pos || {x:0, y:0, z:0};
                    const tag = currentComponent.itemCode || `${mapping.internal}_${equiposMap.size + 1}`;
                    if (!equiposMap.has(tag)) {
                        const equipo = _catalog.createEquipment(mapping.internal, tag, pos.x, pos.y, pos.z, {
                            diametro: currentComponent.diameter || 1000,
                            altura: currentComponent.height || 1500,
                            material: currentComponent.material || 'PPR'
                        });
                        if (equipo) { equiposMap.set(tag, equipo); _core.addEquipment(equipo); }
                    }
                } else if (mapping.type === 'component' && currentLine) {
                    componentes.push({
                        type: mapping.internal,
                        tag: currentComponent.itemCode || `${mapping.internal}_${componentes.length + 1}`,
                        param: 0.5,
                        description: currentComponent.description,
                        material: currentComponent.material
                    });
                }
            }
            currentComponent = null;
        }

        function finalizeLine() {
            if (currentLine && puntos.length >= 2) {
                if (!currentLine.tag) currentLine.tag = `L-${(lineasMap.size + 1)}`;
                currentLine._cachedPoints = puntos;
                currentLine.components = componentes;
                
                _core.addLine(currentLine);
                
                // Forzar inyección automática al importar desde PCF
                const db = _core.getDb();
                const lReg = db.lines.find(l => l.tag === currentLine.tag) || currentLine;
                runFittingInjection(lReg, null, null, null, null, lReg.diameter || 4, lReg.material || 'PPR');
                if (_core.updateLine) { _core.updateLine(lReg.tag, lReg); }

                lineasMap.set(currentLine.tag, lReg);
            }
            currentLine = null; puntos = []; componentes = [];
        }

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('!') || line.length === 0) continue;
            const parts = line.split(/\s+/);
            const firstWord = parts[0];
            const newBlockWords = ['PIPE', 'VALVE', 'TEE', 'TANK', 'PUMP', 'INSTRUMENT', 'ELBOW', 'FLANGE', 'STRA'];
            if (newBlockWords.includes(firstWord)) {
                processAccumulatedComponent();
                if (firstWord === 'PIPE' || firstWord === 'STRA') {
                    finalizeLine();
                    currentLine = { tag: '', diameter: 4, material: 'PPR', spec: 'PPR_PN12_5' };
                    puntos = []; componentes = [];
                } else { currentComponent = { type: firstWord }; }
                continue;
            }
            if (line.startsWith('END-POINT')) {
                if (parts.length >= 7) {
                    const p1 = { x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) };
                    const p2 = { x: parseFloat(parts[4]), y: parseFloat(parts[5]), z: parseFloat(parts[6]) };
                    const diam = parts.length >= 8 ? parseFloat(parts[7]) : null;
                    if (currentLine) {
                        if (puntos.length === 0) puntos.push(p1);
                        puntos.push(p2);
                        if (diam && !currentLine.diameter) currentLine.diameter = diam / 25.4;
                    }
                    if (currentComponent) {
                        currentComponent.pos = p1;
                        if (diam) currentComponent.diameter = diam;
                    }
                }
            } else if (line.startsWith('PCF_ELEM_SKEY')) {
                const skey = parts[1]?.replace(/'/g, '') || '';
                if (currentComponent) currentComponent.skey = skey;
                else if (currentLine) currentLine.skey = skey;
            } else if (line.startsWith('ITEM-CODE')) {
                const code = line.substring(line.indexOf('ITEM-CODE') + 9).trim().replace(/'/g, '');
                if (currentComponent) currentComponent.itemCode = code;
                else if (currentLine) currentLine.tag = code;
            } else if (line.startsWith('DESCRIPTION')) {
                const desc = line.substring(line.indexOf('DESCRIPTION') + 11).trim().replace(/'/g, '');
                if (currentComponent) currentComponent.description = desc;
            } else if (line.startsWith('MATERIAL')) {
                const mat = parts[1]?.replace(/'/g, '') || '';
                if (currentComponent) currentComponent.material = mat;
                else if (currentLine) currentLine.material = mat;
            } else if (line.startsWith('HEIGHT')) {
                if (currentComponent) currentComponent.height = parseFloat(parts[1]);
            } else if (line.startsWith('DIAMETER')) {
                if (currentComponent) currentComponent.diameter = parseFloat(parts[1]);
            } else if (line.startsWith('PIPING-SPEC')) {
                const spec = parts.slice(1).join(' ').replace(/'/g, '');
                if (currentLine) currentLine.spec = spec;
            }
        }
        processAccumulatedComponent();
        finalizeLine();
        notifyWithVoice(`✅ PCF importado: ${equiposMap.size} equipos, ${lineasMap.size} líneas.`, false);
        return true;
    }

    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        if (parseCreateLine(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseRoute(trimmed)) return true;
        if (parseDelete(trimmed)) return true;
        if (parseEditCommand(trimmed)) return true;
        if (parseList(trimmed)) return true;
        if (parseBOM(trimmed)) return true;
        if (parseAudit(trimmed)) return true;
        if (parseHelp(trimmed)) return true;
        if (parseInfo(trimmed)) return true;
        if (parseTap(trimmed)) return true;
        if (parseSplit(trimmed)) return true;
        if (parsePoint(trimmed)) return true;
        if (parseNodes(trimmed)) return true;
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); return true; }
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0, failed = 0;
        for (let raw of lines) {
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notifyWithVoice(`No entendí: "${trimmed.substring(0, 50)}..."`, true); }
        }
        if (executed + failed > 0) notifyWithVoice(`${executed} comandos ejecutados, ${failed} fallidos`, failed > 0);
        return executed;
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn, voiceFn) {
        _core = coreInstance; _catalog = catalogInstance; _renderer = rendererInstance;
        _notifyUI = notifyFn; _renderUI = renderFn;
        _voiceFn = voiceFn || null;
    }

    return { init, executeCommand, executeBatch, importPCF, getPortDirectionLocal };
})();
