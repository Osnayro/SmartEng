
// ============================================================
// SMARTFLOW COMMANDS v5.4 UNIFICADO - 2D/3D
// Incluye: parseConnect (línea@0.5) + comando coordenadas mejorado
// Archivo: js/commands.js
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
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
        const pts = obj._cachedPoints || obj.points3D || obj.points || [];
        return pts.length > 0 ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: 0, y: 0, z: 0 };
    }

    function getPoints(obj) {
        if (!obj) return [];
        return obj._cachedPoints || obj.points3D || obj.points || [];
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
        const speakText = message.replace(/[✅⚠️🗑️📋📐📦↩️↪️📍🔌📏⚙️🔵🟢❌]/g, '').trim();
        if (speakText && typeof SmartFlowAccessibility !== 'undefined' && SmartFlowAccessibility.isVoiceEnabled()) {
            SmartFlowAccessibility.speak(speakText);
        }
    }

    // ==================== COMANDO: COORDENADAS / PUNTO ====================
    function parsePoint(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'point' && parts[0] !== 'coordenadas') return false;
        
        try {
            let tag = null, subCommand = null, subId = null;
            
            if (parts.length >= 3 && parts[1]?.toLowerCase() === 'de') {
                tag = parts[2];
                if (parts.length >= 5) {
                    subCommand = parts[3]?.toLowerCase();
                    subId = parts[4];
                }
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
                } else {
                    tag = ref;
                }
            } else {
                notifyWithVoice('Uso: coordenadas de TAG [puerto|punto ID]\n  coordenadas TAG.PUERTO\n  coordenadas LINEA@0.5', true);
                return true;
            }

            if (!tag) { notifyWithVoice('❌ Tag no especificado', true); return true; }
            if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }

            const db = _core.getDb();
            const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
            if (!obj) { notifyWithVoice(`❌ "${tag}" no encontrado`, true); return true; }

            const basePos = getBasePosition(obj);
            const isEq = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
            let response = `📍 ${tag}`;

            if (!subCommand) {
                if (isEq) {
                    response += ` → Posición: (X=${basePos.x.toFixed(0)}, Y=${basePos.y.toFixed(0)}, Z=${basePos.z.toFixed(0)})`;
                    if (obj.diametro) response += ` | ⌀${obj.diametro}mm`;
                    if (obj.altura) response += ` | H=${obj.altura}mm`;
                    if (obj.largo) response += ` | L=${obj.largo}mm`;
                } else {
                    response += ` → Diámetro: ${obj.diameter || '?'}" | Material: ${obj.material || 'N/D'}`;
                }

                if (obj.puertos && obj.puertos.length > 0) {
                    response += '\n🔌 Puertos:';
                    obj.puertos.forEach(p => {
                        const px = basePos.x + (p.relX || p.relPos?.x || 0);
                        const py = basePos.y + (p.relY || p.relPos?.y || 0);
                        const pz = basePos.z + (p.relZ || p.relPos?.z || 0);
                        const st = p.status === 'connected' ? '🔵' : '🟢';
                        response += `\n  • ${p.id} → (${px.toFixed(0)},${py.toFixed(0)},${pz.toFixed(0)}) | ${p.diametro || '?'}" | ${st}`;
                    });
                }

                const pts = getPoints(obj);
                if (pts.length > 0) {
                    response += `\n📏 Puntos de ruta (${pts.length}):`;
                    pts.forEach((p, i) => response += `\n  • P${i}: (${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)})`);
                    let totalLen = 0;
                    for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                    response += `\n📐 Longitud total: ${(totalLen/1000).toFixed(2)} m`;
                }

                if (obj.components && obj.components.length > 0) {
                    response += `\n⚙️ Componentes: ${obj.components.length} (${obj.components.map(c => c.type).join(', ')})`;
                }

                notifyWithVoice(response, false);
                return true;
            }

            if (subCommand === 'puerto' && subId) {
                const puerto = obj.puertos?.find(p => p.id === subId || p.id?.toUpperCase() === subId?.toUpperCase());
                if (!puerto) {
                    const lista = (obj.puertos || []).map(p => p.id).join(', ');
                    notifyWithVoice(`❌ Puerto "${subId}" no encontrado. Disponibles: ${lista}`, true);
                    return true;
                }
                const px = basePos.x + (puerto.relX || puerto.relPos?.x || 0);
                const py = basePos.y + (puerto.relY || puerto.relPos?.y || 0);
                const pz = basePos.z + (puerto.relZ || puerto.relPos?.z || 0);
                const st = puerto.status === 'connected' ? '🔵 CONECTADO' : '🟢 DISPONIBLE';
                response += ` → Puerto ${puerto.id}`;
                response += `\n   Coordenadas: (X=${px.toFixed(0)}, Y=${py.toFixed(0)}, Z=${pz.toFixed(0)}) mm`;
                response += `\n   Diámetro: ${puerto.diametro || '?'}" | Status: ${st}`;
                if (puerto.connectedTo) response += `\n   Conectado a: ${puerto.connectedTo.tag || puerto.connectedTo}`;
                if (puerto.orientacion) response += `\n   Dirección: (${puerto.orientacion.dx?.toFixed(2)}, ${puerto.orientacion.dy?.toFixed(2)}, ${puerto.orientacion.dz?.toFixed(2)})`;
                if (puerto.constraints?.spec) response += `\n   Spec: ${puerto.constraints.spec}`;
                notifyWithVoice(response, false);
                return true;
            }

            if (subCommand === 'punto' && subId !== undefined) {
                const pts = getPoints(obj);
                if (!pts.length) { notifyWithVoice(`⚠️ ${tag} no tiene geometría`, true); return true; }
                const idx = subId === 'end' ? pts.length - 1 : parseInt(subId);
                if (isNaN(idx) || idx < 0 || idx >= pts.length) {
                    notifyWithVoice(`❌ Índice inválido. La línea tiene ${pts.length} puntos (0-${pts.length-1})`, true);
                    return true;
                }
                const p = pts[idx];
                response += ` → Punto ${idx}: (X=${p.x.toFixed(0)}, Y=${p.y.toFixed(0)}, Z=${p.z.toFixed(0)}) mm`;
                if (idx > 0) {
                    const dist = Math.hypot(p.x-pts[idx-1].x, p.y-pts[idx-1].y, p.z-pts[idx-1].z);
                    response += `\n   ← Distancia a P${idx-1}: ${(dist/1000).toFixed(2)} m`;
                }
                if (idx < pts.length - 1) {
                    const dist = Math.hypot(pts[idx+1].x-p.x, pts[idx+1].y-p.y, pts[idx+1].z-p.z);
                    response += `\n   → Distancia a P${idx+1}: ${(dist/1000).toFixed(2)} m`;
                }
                notifyWithVoice(response, false);
                return true;
            }

            if (subCommand === 'param' && subId !== undefined) {
                const param = parseFloat(subId);
                if (isNaN(param) || param < 0 || param > 1) {
                    notifyWithVoice('❌ La posición debe ser un número entre 0.0 y 1.0', true);
                    return true;
                }
                const resultado = calcularPuntoParametrico(obj, param);
                if (!resultado) { notifyWithVoice(`⚠️ ${tag} no tiene geometría válida`, true); return true; }
                response += ` → Posición @${param.toFixed(2)}`;
                response += `\n   Coordenadas: (X=${resultado.x.toFixed(0)}, Y=${resultado.y.toFixed(0)}, Z=${resultado.z.toFixed(0)}) mm`;
                response += `\n   Segmento: P${resultado.segIdx} → P${resultado.segIdx + 1} (${(resultado.t*100).toFixed(1)}% del segmento)`;
                response += `\n   Distancia: ${(resultado.target/1000).toFixed(2)} m de ${(resultado.totalLen/1000).toFixed(2)} m`;
                notifyWithVoice(response, false);
                return true;
            }

            notifyWithVoice('Comando no reconocido. Use: coordenadas de TAG [puerto|punto ID]', true);
            return true;
        } catch (error) {
            notifyWithVoice('❌ Error al obtener coordenadas: ' + error.message, true);
            return true;
        }
    }

    function parseNodes(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'nodes' && parts[0] !== 'nodos') return false;
        if (parts.length < 2) { notifyWithVoice('Uso: nodos TAG', true); return true; }
        const tag = parts[1];
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
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
 
    // ==================== COMANDOS INFO ====================
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
        const pts = getPoints(line);
        const numPuntos = pts.length;
        let origen = "Ninguno", destino = "Ninguno";
        if (line.origin) {
            const obj = db.equipos.find(e => e.tag === line.origin.equipTag) || db.lines.find(l => l.tag === line.origin.equipTag);
            origen = `${line.origin.equipTag}.${line.origin.portId} (${obj?.tipo || 'line'})`;
        }
        if (line.destination) {
            const obj = db.equipos.find(e => e.tag === line.destination.equipTag) || db.lines.find(l => l.tag === line.destination.equipTag);
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
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (!eq) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
        const tipo = eq.tipo || 'Desconocido';
        const material = eq.material || 'N/D';
        const pos = getBasePosition(eq);
        const msg = `📋 Equipo ${tag} | Tipo: ${tipo} | Material: ${material} | Pos: (${pos.x.toFixed(0)},${pos.y.toFixed(0)},${pos.z.toFixed(0)}) | ⌀${eq.diametro || 'N/D'} H=${eq.altura || 'N/D'} | Puertos: ${(eq.puertos || []).map(p => p.id).join(', ') || 'Ninguno'}`;
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
        const msg = `📋 Componente ${tag} | Tipo: ${foundComp.type} | Línea: ${foundLine.tag} | Posición: ${foundComp.param?.toFixed(2) || 'N/D'}`;
        notifyWithVoice(msg, false);
        return true;
    }

    // --- CREATE ---
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
            notifyWithVoice(`✅ Equipo ${tag} (${equipoDef.nombre}) creado en (${x},${y},${z})`, false);
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
        const nuevaLinea = { tag, diameter, material, spec, _cachedPoints: points, points3D: points, points: points, waypoints: points.slice(1, -1), components: [] };
        _core.addLine(nuevaLinea);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
        notifyWithVoice(`✅ Línea ${tag} creada (${points.length} pts, ${diameter}")`, false);
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.procesarInterseccionesDeLinea) {
            SmartFlowRouter.procesarInterseccionesDeLinea(nuevaLinea);
        }
        _renderUI();
        return true;
    }

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
        if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: colector });
        notifyWithVoice(`✅ Colector ${tag} creado`, false);
        return true;
    }

    // --- Helper para encontrar codo según material ---
    function findElbowForLine(material, diameter, angleDeg) {
        const mat = (material || '').toUpperCase();
        const is90 = (Math.abs(angleDeg - 90) < 10);
        const is45 = (Math.abs(angleDeg - 45) < 10);
        if (!is90 && !is45) return null;
        if (mat.includes('PPR')) return is90 ? 'ELBOW_90_PPR' : 'ELBOW_45_PPR';
        if (mat.includes('HDPE')) return is90 ? 'ELBOW_90_HDPE' : null;
        if (mat.includes('PVC')) return is90 ? 'ELBOW_90_PVC' : null;
        if (mat.includes('ACERO')) return is90 ? 'ELBOW_90_LR_CS' : 'ELBOW_45_CS';
        if (mat.includes('INOXIDABLE') || mat.includes('INOX')) return is90 ? 'ELBOW_90_SANITARY' : null;
        return is90 ? 'ELBOW_90_LR_CS' : 'ELBOW_45_CS';
    }

    // --- CONNECT (con herencia, auto‑codo siempre, y detección inteligente de puerto omitido) ---
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

        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquip) || db.lines.find(l => l.tag === fromEquip);
        const toObj = db.equipos.find(e => e.tag === toEquip) || db.lines.find(l => l.tag === toEquip);
        if (!fromObj || !toObj) { notifyWithVoice("Objeto no encontrado", true); return true; }

        let startPos = null;
        let fromDiameter = 4;
        const isFromLine = getPoints(fromObj).length >= 2;
        
        if (isFromLine && (fromNozzle === '0' || fromNozzle === '1')) {
            const pts = getPoints(fromObj);
            if (pts.length >= 2) {
                startPos = fromNozzle === '0' ? { ...pts[0] } : { ...pts[pts.length - 1] };
                fromDiameter = fromObj.diameter || 4;
            } else {
                notifyWithVoice("La línea origen no tiene geometría válida", true);
                return true;
            }
        } else {
            const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
            if (!nzFrom) { notifyWithVoice("Puerto origen no encontrado", true); return true; }
            fromDiameter = nzFrom.diametro || 4;
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
                startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
            } else {
                const basePos = getBasePosition(fromObj);
                startPos = {
                    x: basePos.x + (nzFrom.relX || 0),
                    y: basePos.y + (nzFrom.relY || 0),
                    z: basePos.z + (nzFrom.relZ || 0)
                };
            }
        }
        if (!startPos) { notifyWithVoice("No se pudo obtener la posición del puerto origen", true); return true; }

        const isLine = getPoints(toObj).length >= 2;
        const numPos = parseFloat(toNozzleRaw);
        const isNumeric = !isNaN(numPos) && isFinite(numPos);
        let posRelativa = isNumeric ? Math.min(1, Math.max(0, numPos)) : null;

        if (isLine && toObj.diameter && !parts.slice(6).some(p => p === 'diameter' || p === 'diametro')) {
            diameter = toObj.diameter;
        }
        if (!parts.slice(6).some(p => p === 'material')) {
            if (toObj.material) material = toObj.material;
            if (toObj.spec) spec = toObj.spec;
        }

        if (isLine && posRelativa !== null && (posRelativa <= 0.01 || posRelativa >= 0.99)) {
            toNozzleRaw = posRelativa <= 0.01 ? '0' : '1';
            posRelativa = null;
        }

        const newTag = `L-${(db.lines?.length || 0) + 1}`;
        let endPos = null;
        let newComponents = [];
        let nzTo = null;

        if (isLine && !toNozzleRaw) {
            const pts = getPoints(toObj);
            if (!pts || pts.length < 2) {
                notifyWithVoice("La línea destino no tiene geometría", true);
                return true;
            }
            let minDist = Infinity, bestPoint = pts[0];
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i+1];
                const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
                const ap = { x: startPos.x - a.x, y: startPos.y - a.y, z: startPos.z - a.z };
                const len2 = ab.x*ab.x + ab.y*ab.y + ab.z*ab.z;
                let t = 0;
                if (len2 !== 0) {
                    t = (ap.x*ab.x + ap.y*ab.y + ap.z*ab.z) / len2;
                    t = Math.max(0, Math.min(1, t));
                }
                const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
                const dist = Math.hypot(startPos.x - proj.x, startPos.y - proj.y, startPos.z - proj.z);
                if (dist < minDist) { minDist = dist; bestPoint = proj; }
            }

            if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') {
                notifyWithVoice("Router no disponible", true);
                return true;
            }

            const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, bestPoint, diameter, true);
            if (!puertoId) {
                notifyWithVoice("No se pudo insertar el accesorio automáticamente", true);
                return true;
            }

            endPos = bestPoint;
            const toObjUpd = db.lines.find(l => l.tag === toEquip);
            if (toObjUpd?.puertos) {
                nzTo = toObjUpd.puertos.find(p => p.id === puertoId);
            }

            const nuevaLinea = {
                tag: newTag, diameter, material, spec,
                origin: { objType: isFromLine ? 'line' : 'equipment', equipTag: fromEquip, portId: fromNozzle },
                destination: { objType: 'line', equipTag: toEquip, portId: puertoId },
                waypoints: [],
                _cachedPoints: [startPos, endPos],
                components: newComponents
            };
            _core.addLine(nuevaLinea);
            if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
            const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
            if (nzFrom) nzFrom.connectedLine = newTag;
            if (nzTo) nzTo.connectedLine = newTag;
            _core.syncPhysicalData(); _core._saveState(); _renderUI();
            notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip} en el punto más cercano`, false);
            return true;
        }

        if (isLine && posRelativa !== null) {
            if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') {
                notifyWithVoice("Router no disponible", true);
                return true;
            }
            const resultado = calcularPuntoParametrico(toObj, posRelativa);
            if (!resultado) { notifyWithVoice("Geometría inválida", true); return true; }
            const punto = { x: resultado.x, y: resultado.y, z: resultado.z };
            const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, punto, diameter, true);
            if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio", true); return true; }
            endPos = punto;
            const toObjUpd = db.lines.find(l => l.tag === toEquip);
            if (toObjUpd?.puertos) {
                nzTo = toObjUpd.puertos.find(p => p.id === puertoId);
            }

            const nuevaLinea = {
                tag: newTag, diameter, material, spec,
                origin: { objType: isFromLine ? 'line' : 'equipment', equipTag: fromEquip, portId: fromNozzle },
                destination: { objType: 'line', equipTag: toEquip, portId: puertoId },
                waypoints: [],
                _cachedPoints: [startPos, endPos],
                components: newComponents
            };
            _core.addLine(nuevaLinea);
            if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
            const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
            if (nzFrom) nzFrom.connectedLine = newTag;
            if (nzTo) nzTo.connectedLine = newTag;
            _core.syncPhysicalData(); _core._saveState(); _renderUI();
            notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip} en ${posRelativa.toFixed(2)}`, false);
            return true;
        } else {
            if (isLine && (toNozzleRaw === '0' || toNozzleRaw === '1')) {
                const pts = getPoints(toObj);
                if (!pts || pts.length < 2) { notifyWithVoice("La línea destino no tiene geometría", true); return true; }
                if (toNozzleRaw === '0') endPos = { ...pts[0] };
                else endPos = { ...pts[pts.length - 1] };
            } else {
                if (!toObj.puertos) toObj.puertos = [];
                nzTo = toObj.puertos?.find(n => n.id === toNozzleRaw);
                if (!nzTo) { notifyWithVoice("Puerto destino no encontrado", true); return true; }

                if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
                    endPos = SmartFlowRouter.getPortPosition(toObj, toNozzleRaw);
                } else {
                    const basePos = getBasePosition(toObj);
                    endPos = {
                        x: basePos.x + (nzTo.relX || 0),
                        y: basePos.y + (nzTo.relY || 0),
                        z: basePos.z + (nzTo.relZ || 0)
                    };
                }
            }

            const nuevaLinea = {
                tag: newTag, diameter, material, spec,
                origin: { objType: isFromLine ? 'line' : 'equipment', equipTag: fromEquip, portId: fromNozzle },
                destination: { objType: isLine ? 'line' : 'equipment', equipTag: toEquip, portId: toNozzleRaw },
                waypoints: [],
                _cachedPoints: [startPos, endPos],
                components: newComponents
            };
            _core.addLine(nuevaLinea);
            if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
            const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
            if (nzFrom) nzFrom.connectedLine = newTag;
            if (nzTo) nzTo.connectedLine = newTag;
            _core.syncPhysicalData(); _core._saveState(); _renderUI();
            notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip}.${toNozzleRaw}`, false);
            return true;
        }
    }

    // --- ROUTE (COMANDO) ---
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
        let diameter = 3, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = nextIdx; i < parts.length; i++) {
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

    // --- DELETE ---
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
            _core._saveState(); notifyWithVoice(`Equipo ${tag} eliminado`, false); _renderUI();
            return true;
        } else if (type === 'line' || type === 'línea') {
            const db = _core.getDb();
            const index = db.lines.findIndex(l => l.tag === tag);
            if (index === -1) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
            db.lines.splice(index, 1);
            db.equipos.forEach(eq => { if (eq.puertos) eq.puertos.forEach(p => { if (p.connectedLine === tag) delete p.connectedLine; }); });
            db.lines.forEach(l => { if (l.puertos) l.puertos.forEach(p => { if (p.connectedLine === tag) delete p.connectedLine; }); });
            _core._saveState(); notifyWithVoice(`Línea ${tag} eliminada`, false); _renderUI();
            return true;
        }
        return false;
    }

    // --- EDIT (COMPLETO con transición automática de materiales, flag nt y notificaciones legibles) ---
    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit' && parts[0] !== 'editar') return false;
        if (parts[1] === 'equipment' || parts[1] === 'equipo') {
            const tag = parts[2], action = parts[3];
            if (action === 'move' || action === 'mover') {
                let coordStr = '';
                for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) {
                    const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]);
                    _core.updateEquipment(tag, { posX: x, posY: y, posZ: z });
                    notifyWithVoice(`Equipo ${tag} movido`, false);
                    return true;
                }
            } else if (action === 'set' || action === 'establecer') {
                if (parts[4] === 'puerto') {
                    const puertoId = parts[5], subParam = parts[6];
                    if (subParam === 'diam' || subParam === 'diametro') {
                        const nuevoDiam = parseFloat(parts[7]);
                        if (!isNaN(nuevoDiam)) { _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam }); notifyWithVoice(`Puerto ${puertoId} diámetro ${nuevoDiam}"`, false); return true; }
                    } else if (subParam === 'pos' || subParam === 'posicion') {
                        let coordStr = '';
                        for (let i = 7; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                        const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                        if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]); _core.updatePuerto(tag, puertoId, { pos: { x, y, z } }); notifyWithVoice(`Puerto ${puertoId} posición actualizada`, false); return true; }
                    } else if (subParam === 'dir' || subParam === 'direccion') {
                        let coordStr = '';
                        for (let i = 7; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                        const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                        if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]); _core.updatePuerto(tag, puertoId, { dir: { dx: x, dy: y, dz: z } }); notifyWithVoice(`Puerto ${puertoId} dirección actualizada`, false); return true; }
                    }
                }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const property = parts[4], value = parts[5];
                if (property === 'material') { _core.updateLine(tag, { material: value.toUpperCase() }); notifyWithVoice(`Línea ${tag} material ${value}`, false); return true; }
                else if (property === 'diameter' || property === 'diametro') { _core.updateLine(tag, { diameter: parseFloat(value) }); notifyWithVoice(`Línea ${tag} diámetro ${value}"`, false); return true; }
                else if (property === 'spec') { _core.updateLine(tag, { spec: value }); notifyWithVoice(`Línea ${tag} especificación ${value}`, false); return true; }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'waypoint' || parts[4] === 'punto')) {
                let coordStr = '';
                for (let i = 5; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) {
                    const wp = { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) };
                    const db = _core.getDb(); const line = db.lines.find(l => l.tag === tag);
                    if (line) {
                        if (!line.waypoints) line.waypoints = [];
                        let after = -1; const afterIdx = parts.indexOf('after') !== -1 ? parts.indexOf('after') : parts.indexOf('despues');
                        if (afterIdx !== -1) after = parseInt(parts[afterIdx + 1]) - 1;
                        if (after >= 0 && after < line.waypoints.length) line.waypoints.splice(after + 1, 0, wp);
                        else line.waypoints.push(wp);
                        _core.updateLine(tag, { waypoints: line.waypoints }); _core.syncPhysicalData();
                        notifyWithVoice(`Waypoint añadido a ${tag}`, false); return true;
                    }
                }
            } else if ((action === 'remove' || action === 'quitar') && (parts[4] === 'waypoint' || parts[4] === 'punto')) {
                const idx = parseInt(parts[5]) - 1;
                const db = _core.getDb(); const line = db.lines.find(l => l.tag === tag);
                if (line && line.waypoints && idx >= 0 && idx < line.waypoints.length) {
                    line.waypoints.splice(idx, 1); _core.updateLine(tag, { waypoints: line.waypoints }); _core.syncPhysicalData();
                    notifyWithVoice(`Waypoint ${idx + 1} eliminado de ${tag}`, false); return true;
                }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5; const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
                if (atIdx !== -1) position = parseFloat(parts[atIdx + 1]);
                const suppressTransition = parts.slice(atIdx !== -1 ? atIdx + 2 : 6).some(p => p === 'nt' || p === 'notransition');
                const db = _core.getDb(); const line = db.lines.find(l => l.tag === tag);
                if (line) {
                    const compDef = _catalog.getComponent(compType);
                    if (!compDef) { notifyWithVoice(`Componente desconocido: ${compType}`, true); return true; }

                    const lineMaterial = (line.material || 'PPR').toUpperCase();
                    const compMaterial = (compDef.material || '').toUpperCase();
                    if (compMaterial && lineMaterial !== compMaterial && !suppressTransition) {
                        const transition = _catalog.getTransitionAccessories(lineMaterial, compMaterial, line.diameter);
                        if (transition) {
                            if (transition.left) {
                                const leftCompDef = _catalog.getComponent(transition.left);
                                if (leftCompDef) {
                                    const leftPos = Math.max(0, position - 0.05);
                                    const leftTag = `${transition.left}-${Date.now().toString().slice(-8)}`;
                                    const leftComp = { type: leftCompDef.tipo, tag: leftTag, param: leftPos };
                                    if (!line.components) line.components = [];
                                    line.components.push(leftComp);
                                    if (leftCompDef.generarPuertos) {
                                        const nuevosPuertos = leftCompDef.generarPuertos(line, leftPos, line.diameter);
                                        if (!line.puertos) line.puertos = [];
                                        nuevosPuertos.forEach((p, idx) => { p.id = `${leftTag}_${idx}`; line.puertos.push(p); });
                                    }
                                    notifyWithVoice(`Adaptador ${leftCompDef.nombre} insertado`, false);
                                }
                            }
                            if (transition.right) {
                                const rightCompDef = _catalog.getComponent(transition.right);
                                if (rightCompDef) {
                                    const rightPos = Math.min(1, position + 0.05);
                                    const rightTag = `${transition.right}-${Date.now().toString().slice(-8)}`;
                                    const rightComp = { type: rightCompDef.tipo, tag: rightTag, param: rightPos };
                                    if (!line.components) line.components = [];
                                    line.components.push(rightComp);
                                    if (rightCompDef.generarPuertos) {
                                        const nuevosPuertos = rightCompDef.generarPuertos(line, rightPos, line.diameter);
                                        if (!line.puertos) line.puertos = [];
                                        nuevosPuertos.forEach((p, idx) => { p.id = `${rightTag}_${idx}`; line.puertos.push(p); });
                                    }
                                    notifyWithVoice(`Adaptador ${rightCompDef.nombre} insertado`, false);
                                }
                            }
                        } else {
                            if (!suppressTransition) {
                                notifyWithVoice(`Advertencia: No se encontró adaptador para transición ${lineMaterial} → ${compMaterial}`, true);
                            }
                        }
                    }

                    const comp = { type: compDef.tipo, tag: `${compType}-${Date.now().toString().slice(-6)}`, param: position };
                    if (!line.components) line.components = [];
                    line.components.push(comp);
                    if (compDef.generarPuertos) {
                        const nuevosPuertos = compDef.generarPuertos(line, position, line.diameter);
                        if (!nuevosPuertos || nuevosPuertos.length === 0) {
                            notifyWithVoice(`Error: El componente ${compDef.nombre} no generó puertos válidos`, true);
                            return true;
                        }
                        if (!line.puertos) line.puertos = [];
                        nuevosPuertos.forEach((p, idx) => { p.id = `${comp.tag}_${idx}`; line.puertos.push(p); });
                        _core.updateLine(tag, { components: line.components, puertos: line.puertos });
                        notifyWithVoice(`${compDef.nombre} añadido a ${tag} con puertos lógicos`, false);
                    } else {
                        _core.updateLine(tag, { components: line.components });
                        notifyWithVoice(`${compDef.nombre} añadido a ${tag}`, false);
                    }
                    _renderUI(); return true;
                }
            }
        }
        return false;
    }

    // --- LIST ---
    function parseListComponents(cmd) { if (cmd.trim().toLowerCase() !== 'list components' && cmd.trim().toLowerCase() !== 'listar componentes') return false; const types = _catalog.listComponentTypes(); let msg = "Componentes disponibles:\n"; types.sort().forEach(t => { const comp = _catalog.getComponent(t); if (comp) msg += `  ${t} - ${comp.nombre || 'Sin descripción'}\n`; }); notifyWithVoice(msg, false); return true; }
    function parseListSpecs(cmd) { if (cmd.trim().toLowerCase() !== 'list specs' && cmd.trim().toLowerCase() !== 'listar especificaciones') return false; const specs = _catalog.listSpecs(); let msg = "Especificaciones disponibles:\n"; specs.sort().forEach(s => { const spec = _catalog.getSpec(s); if (spec) msg += `  ${s}: ${spec.material || ''} ${spec.norma || ''}\n`; else msg += `  ${s}\n`; }); notifyWithVoice(msg, false); return true; }
    function parseListEquipment(cmd) { if (cmd.trim().toLowerCase() !== 'list equipment' && cmd.trim().toLowerCase() !== 'listar equipos') return false; const types = _catalog.listEquipmentTypes(); let msg = "Equipos disponibles:\n"; types.sort().forEach(t => { const eq = _catalog.getEquipment(t); if (eq) msg += `  ${t} - ${eq.nombre || 'Sin descripción'}\n`; }); notifyWithVoice(msg, false); return true; }

    // --- BOM ---
    function parseBOM(cmd) { const trimmed = cmd.trim().toLowerCase(); if (trimmed === 'bom' || trimmed === 'mto' || trimmed === 'generate bom' || trimmed === 'generar bom') { generateBOM(); return true; } return false; }
    function generateBOM() {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return; }
        const db = _core.getDb(); const lines = db.lines || []; const equipos = db.equipos || []; let items = [];
        equipos.forEach(eq => items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: `${eq.tipo} ${eq.material || ''}`, cantidad: 1, unidad: 'Und' }));
        const pipeMap = new Map();
        lines.forEach(line => {
            const pts = getPoints(line); if (!pts || pts.length < 2) return;
            let length = 0; for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            const lengthM = length / 1000; const key = `${line.diameter}"-${line.material || 'PPR'}-${line.spec || 'STD'}`;
            if (pipeMap.has(key)) pipeMap.get(key).length += lengthM;
            else pipeMap.set(key, { tipo: 'TUBERIA', diametro: line.diameter, material: line.material || 'PPR', spec: line.spec || 'STD', length: lengthM });
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

    // --- AUDIT ---
    function parseAudit(cmd) { const trimmed = cmd.trim().toLowerCase(); if (trimmed === 'audit' || trimmed === 'auditar' || trimmed === 'audit model' || trimmed === 'auditar modelo') { if (_core && _core.auditModel) _core.auditModel(); else notifyWithVoice("Auditoría no disponible.", true); return true; } return false; }

    // --- HELP ---
    function parseHelp(cmd) {
        const lower = cmd.toLowerCase(); if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "═══════════════════════════════════════════════════════════\n              SMARTFLOW PRO - COMANDOS DISPONIBLES\n═══════════════════════════════════════════════════════════\n\n";
        ayuda += "CREACIÓN:\n  create/crear [tipo] [tag] at (x,y,z) [diam/diametro N] [height/altura N]\n  create line [tag] route/ruta (x1,y1,z1) ...\n  create manifold [tag] at (x,y,z) entries/entradas N spacing/espaciado D\n\n";
        ayuda += "CONEXIÓN:\n  connect/conectar [origen] [puerto] to/a [destino] [puerto o 0-1 o 0.0-1.0]\n  route/ruta desde [origen] [puerto] a/hasta [destino] [puerto-opcional]\n\n";
        ayuda += "COORDENADAS (NUEVO):\n  coordenadas de [TAG]\n  coordenadas de [TAG] puerto [ID]\n  coordenadas de [TAG] punto [N]\n  coordenadas [LINEA]@[0.0-1.0]\n\n";
        ayuda += "INFORMACIÓN:\n  info line/línea [TAG]\n  info equipment/equipo [TAG]\n  info component/componente [TAG]\n  nodos [TAG]\n\n";
        ayuda += "ELIMINACIÓN:\n  delete/eliminar equipment/equipo [tag]\n  delete/eliminar line/línea [tag]\n\n";
        ayuda += "EDICIÓN:\n  edit/editar equipment/equipo [tag] move/mover to (x,y,z)\n  edit/editar line/línea [tag] set/establecer material [M]\n  edit/editar line/línea [tag] add/añadir component/componente [tipo] at/en [0-1]\n\n";
        ayuda += "DERIVACIÓN / DIVISIÓN:\n  tap/derivar [Equipo] [Puerto] to [Línea] [Posición 0-1]\n  split/dividir [Línea] at (x,y,z) [type TEE_EQUAL]\n\n";
        ayuda += "REPORTES:\n  bom | mto | generate bom\n  audit/auditar\n\n";
        ayuda += "OTROS:\n  undo/deshacer | redo/rehacer | help/ayuda\n═══════════════════════════════════════════════════════════\n";
        notifyWithVoice(ayuda, false); return true;
    }

    // --- TAP ---
    function parseTap(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'tap') return false;
        if (parts.length < 6 || parts[3] !== 'to') { notifyWithVoice("Uso: tap [Equipo] [Puerto] to [Línea] [Posición 0-1] [diametro D] [material M]", true); return true; }
        const fromEquip = parts[1], fromNozzle = parts[2];
        const toLine = parts[4];
        const posRaw = parts[5]; const pos = parseFloat(posRaw);
        if (isNaN(pos) || pos < 0 || pos > 1) { notifyWithVoice("La posición debe ser un número entre 0 y 1", true); return true; }
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (!_core || !_catalog) { notifyWithVoice("Core o Catálogo no inicializados", true); return true; }
        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquip);
        if (!fromObj) { notifyWithVoice(`Equipo origen "${fromEquip}" no encontrado`, true); return true; }
        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        if (!nzFrom) { notifyWithVoice(`Puerto "${fromNozzle}" no encontrado en ${fromEquip}`, true); return true; }

        let startPos = null;
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
            startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
        } else {
            startPos = { x: fromObj.posX + (nzFrom.relX || 0), y: fromObj.posY + (nzFrom.relY || 0), z: fromObj.posZ + (nzFrom.relZ || 0) };
        }
        if (!startPos) { notifyWithVoice("No se pudo obtener la posición del puerto origen", true); return true; }

        const toObj = db.lines.find(l => l.tag === toLine);
        if (!toObj || !getPoints(toObj).length) { notifyWithVoice(`Línea destino "${toLine}" no encontrada o no válida`, true); return true; }
        if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') { notifyWithVoice("Módulo Router no disponible.", true); return true; }
        
        const resultado = calcularPuntoParametrico(toObj, pos);
        if (!resultado) { notifyWithVoice("No se pudo calcular el punto de conexión", true); return true; }
        const puntoConexion = { x: resultado.x, y: resultado.y, z: resultado.z };
        
        const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toLine, puntoConexion, diameter, true);
        if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio automáticamente.", true); return true; }
        const newTag = `L-${(db.lines?.length || 0) + 1}`;
        const nuevaLinea = { 
            tag: newTag, diameter, material, spec, 
            origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle }, 
            destination: { objType: 'line', equipTag: toLine, portId: puertoId }, 
            waypoints: [], 
            _cachedPoints: [startPos, puntoConexion]
        };
        _core.addLine(nuevaLinea);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
        nzFrom.connectedLine = newTag;
        const toObjUpd = db.lines.find(l => l.tag === toLine);
        if (toObjUpd?.puertos) { const p = toObjUpd.puertos.find(p => p.id === puertoId); if (p) p.connectedLine = newTag; }
        _core.syncPhysicalData(); _core._saveState(); _renderUI();
        notifyWithVoice(`✅ Derivación creada: ${newTag} (${fromEquip}.${fromNozzle} → ${toLine} en ${pos.toFixed(2)})`, false);
        return true;
    }

    // --- SPLIT ---
    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir' && parts[0] !== 'romper') return false;
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        if (!lineTag || !coords) { notifyWithVoice("Uso: split [línea] at (x,y,z). Tip: Puedes usar Ctrl+Clic en el modelo.", true); return true; }
        const type = extractValue(parts, ['type', 'tipo']) || 'TEE_EQUAL';
        notifyWithVoice(`Dividiendo línea ${lineTag} e insertando ${type}...`);
        const result = _core.splitLine(lineTag, coords, { type });
        if (result) {
            if (_core.setSelected) _core.setSelected({ type: 'COMPONENTE', obj: result.componente, parent: result.linea });
        } else {
            notifyWithVoice(`Error: El punto (${coords.x}, ${coords.y}) está muy lejos de la línea ${lineTag}`, true);
        }
        return true;
    }

    // ==================== IMPORTACIÓN PCF COMPLETA ====================
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
                lineasMap.set(currentLine.tag, currentLine);
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
                } else {
                    currentComponent = { type: firstWord };
                }
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
                        if (diam) currentComponent.diameter
```y 
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

        _core.syncPhysicalData();
        _core._saveState();
        _renderUI();
        notifyWithVoice(`✅ PCF importado: ${equiposMap.size} equipos, ${lineasMap.size} líneas.`, false);
        return true;
    }

    // ==================== EJECUCIÓN DE COMANDOS ====================
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        
        // Orden de prioridad de parsers
        if (parseCreateLine(trimmed)) return true;
        if (parseCreateManifold(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseRoute(trimmed)) return true;
        if (parseDelete(trimmed)) return true;
        if (parseEditCommand(trimmed)) return true;
        if (parseListComponents(trimmed)) return true;
        if (parseListSpecs(trimmed)) return true;
        if (parseListEquipment(trimmed)) return true;
        if (parseBOM(trimmed)) return true;
        if (parseAudit(trimmed)) return true;
        if (parseHelp(trimmed)) return true;
        if (parseInfo(trimmed)) return true;
        if (parseTap(trimmed)) return true;
        if (parseSplit(trimmed)) return true;
        if (parsePoint(trimmed)) return true;
        if (parseNodes(trimmed)) return true;
        
        // Comandos simples
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); _renderUI(); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); _renderUI(); return true; }
        
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
        _renderUI();
        if (executed + failed > 0) {
            notifyWithVoice(`${executed} comandos ejecutados, ${failed} fallidos`, failed > 0);
        }
        return executed;
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _renderer = rendererInstance;
        _notifyUI = notifyFn;
        _renderUI = renderFn;
        console.log("✅ SmartFlowCommands v5.4 UNIFICADO listo (2D/3D + coordenadas)");
    }

    return { init, executeCommand, executeBatch, importPCF };
})();
