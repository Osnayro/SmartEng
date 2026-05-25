// ============================================================
// SMARTFLOW COMMANDS v2.5 - Intérprete de Comandos Unificado
// Archivo: js/commands.js
// Compatible: SmartFlowCore v5.5 + SmartFlowRouter
// Novedades v2.5: info mejorado, place, getTopSurface, getEquipmentTypeName
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _voiceFn = null;

    // ================================================================
    //  DICCIONARIO DE INTENCIONES MULTILINGÜE
    // ================================================================
    const IntentDictionary = {
        'crear': 'create', 'nuevo': 'create', 'añadir': 'create', 'instalar': 'create', 'pon': 'create', 'crea': 'create',
        'create': 'create', 'add': 'create',
        'conectar': 'connect', 'unir': 'connect', 'enlazar': 'connect', 'link': 'connect', 'vincula': 'connect', 'junta': 'connect', 'une': 'connect',
        'connect': 'connect',
        'ruta': 'route', 'route': 'route',
        'eliminar': 'delete', 'borrar': 'delete', 'quitar': 'delete', 'suprimir': 'delete', 'quita': 'delete', 'elimina': 'delete', 'limpiar': 'delete',
        'delete': 'delete', 'remove': 'delete',
        'editar': 'edit', 'modificar': 'edit', 'cambiar': 'edit', 'ajustar': 'edit', 'cambia': 'edit',
        'edit': 'edit', 'set': 'edit', 'update': 'edit', 'mover': 'move', 'move': 'move',
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
        'nodos': 'nodes', 'nodo': 'nodes', 'nodes': 'nodes',
        'rotar': 'rotate', 'girar': 'rotate', 'rotate': 'rotate',
        'duplicar': 'duplicate', 'copiar': 'duplicate', 'duplicate': 'duplicate', 'copy': 'duplicate',
        'alinear': 'align', 'align': 'align',
        'medir': 'measure', 'distancia': 'measure', 'measure': 'measure', 'distance': 'measure',
        'macro': 'macro', 'script': 'macro',
        'exportar': 'export', 'export': 'export',
        'vista': 'view', 'view': 'view', 'zoom': 'view', 'camara': 'view', 'cámara': 'view',
        'apoyar': 'place', 'posar': 'place', 'place': 'place', 'poner': 'place', 'colocar': 'place'
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

    // ================================================================
    //  UTILIDADES
    // ================================================================
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

    function saveStateBeforeMutation() {
        if (_core && _core._saveState) {
            _core._saveState();
        }
    }

    function getPortPosition(tag, portId) {
        const obj = _core ? _core.findObjectByTag(tag) : null;
        if (!obj) return { x: 0, y: 0, z: 0 };
        const base = getBasePosition(obj);
        const puerto = obj.puertos?.find(p => p.id === portId);
        if (puerto) {
            return {
                x: base.x + (puerto.relX || 0),
                y: base.y + (puerto.relY || 0),
                z: base.z + (puerto.relZ || 0)
            };
        }
        return base;
    }

    // ═══════════════════════════════════════════════════════
    // FUNCIONES DE APOYO (NUEVAS v2.5)
    // ═══════════════════════════════════════════════════════

    /**
     * Calcula la cota de la superficie superior (techo) de cualquier objeto
     */
    function getTopSurface(tag) {
        const obj = _core ? _core.findObjectByTag(tag) : null;
        if (!obj) return 0;
        const altura = obj.altura || 0;
        const posY = obj.posY || 0;
        return posY + (altura / 2);
    }

    /**
     * Nombres descriptivos para tipos de equipo
     */
    function getEquipmentTypeName(tipo) {
        const names = {
            'tanque_v': 'Tanque Vertical',
            'tanque_h': 'Tanque Horizontal',
            'bomba': 'Bomba Centrífuga',
            'bomba_dosificacion': 'Bomba Dosificadora',
            'bomba_sumergible': 'Bomba Sumergible',
            'intercambiador': 'Intercambiador de Calor',
            'condensador': 'Condensador',
            'torre': 'Torre de Destilación',
            'columna_fraccionadora': 'Columna Fraccionadora',
            'reactor': 'Reactor',
            'reactor_encamisado': 'Reactor Encamisado',
            'autoclave': 'Autoclave',
            'caldera': 'Caldera',
            'compresor': 'Compresor',
            'separador': 'Separador Bifásico',
            'separador_trifasico': 'Separador Trifásico',
            'slug_catcher': 'Slug Catcher',
            'calentador_fuego_directo': 'Calentador Fuego Directo',
            'secador_rotativo': 'Secador Rotativo',
            'evaporador': 'Evaporador',
            'cristalizador': 'Cristalizador',
            'absorbedor': 'Absorbedor',
            'stripper': 'Stripper / Despojador',
            'clarificador': 'Clarificador',
            'filtro_arena': 'Filtro de Arena',
            'filtro_carbon': 'Filtro Carbón Activado',
            'filtro_prensa': 'Filtro Prensa',
            'filtro_duplex': 'Filtro Dúplex',
            'filtro_tambor': 'Filtro Tambor Rotativo',
            'osmosis': 'Ósmosis Inversa',
            'desgasificador': 'Desgasificador',
            'desmineralizador': 'Desmineralizador',
            'suavizador': 'Suavizador',
            'dosificador_quimico': 'Dosificador Químico',
            'canaleta_parshall': 'Canaleta Parshall',
            'espesador': 'Espesador',
            'floculador': 'Floculador',
            'celda_electrolitica': 'Celda Electrolítica',
            'centrifuga': 'Centrífuga',
            'centrifuga_discos': 'Centrífuga de Discos',
            'agitador': 'Agitador / Mezclador',
            'molino': 'Molino',
            'tanque_acero': 'Tanque Acero Inoxidable',
            'tanque_aseptico': 'Tanque Aséptico',
            'pasteurizador': 'Pasteurizador',
            'homogeneizador': 'Homogeneizador',
            'homogeneizador_ap': 'Homogeneizador Alta Presión',
            'esterilizador_uht': 'Esterilizador UHT',
            'tina_quesera': 'Tina Quesera',
            'llenadora': 'Llenadora',
            'plataforma': 'Plataforma Estructural',
            'antorcha': 'Antorcha (Flare)',
            'skid_inyeccion': 'Skid Inyección Química'
        };
        return names[tipo] || tipo || 'Equipo';
    }

    function runFittingInjection(line, fromObj, fromPortId, toObj, toPortId, diameter, material) {
        if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.ensureFittings === 'function') {
            return SmartFlowRouter.ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material);
        }
        return { added: [], message: ' | ⚠️ Router no disponible para inyección' };
    }

    // ================================================================
    //  COMANDOS ORIGINALES
    // ================================================================

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

    // ═══════════════════════════════════════════════════════
    // COMANDO INFO (MEJORADO v2.5)
    // ═══════════════════════════════════════════════════════

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
        const spec = eq.spec || 'N/D';
        const pos = getBasePosition(eq);
        const altura = eq.altura || 0;
        const diametro = eq.diametro || 0;
        const largo = eq.largo || 0;
        const ancho = eq.ancho || 0;
        
        const baseElevation = pos.y - (altura / 2);
        const topElevation = pos.y + (altura / 2);
        const centerElevation = pos.y;
        
        let msg = '═══════════════════════════════════\n';
        msg += `📋 ${tag} — ${getEquipmentTypeName(tipo)}\n`;
        msg += '═══════════════════════════════════\n\n';
        
        // Dimensiones según tipo
        if (tipo === 'plataforma') {
            msg += `📐 DIMENSIONES:\n`;
            msg += `   Largo: ${largo.toFixed(0)} mm\n`;
            msg += `   Ancho: ${ancho.toFixed(0)} mm\n`;
            msg += `   Espesor: ${altura.toFixed(0)} mm\n`;
            msg += `   Área: ${((largo * ancho) / 1e6).toFixed(2)} m²\n\n`;
        } else if (tipo === 'tanque_v' || tipo === 'torre' || tipo.includes('reactor') || tipo.includes('columna') || tipo.includes('filtro') || tipo.includes('clarificador') || tipo.includes('evaporador') || tipo.includes('cristalizador') || tipo.includes('absorbedor') || tipo.includes('desgasificador') || tipo.includes('desmineralizador') || tipo.includes('suavizador') || tipo.includes('agitador') || tipo.includes('autoclave') || tipo.includes('centrifuga_discos') || tipo.includes('tanque_aseptico') || tipo.includes('espesador')) {
            msg += `📐 DIMENSIONES:\n`;
            msg += `   Diámetro: ${diametro.toFixed(0)} mm\n`;
            msg += `   Altura: ${altura.toFixed(0)} mm\n`;
            if (diametro > 0 && altura > 0) msg += `   Volumen aprox: ${(Math.PI * Math.pow(diametro/2, 2) * altura / 1e9).toFixed(2)} m³\n\n`;
            else msg += '\n';
        } else if (tipo === 'tanque_h' || tipo.includes('separador') || tipo.includes('slug') || tipo.includes('calentador') || tipo.includes('secador') || tipo === 'centrifuga' || tipo === 'filtro_tambor' || tipo === 'molino') {
            msg += `📐 DIMENSIONES:\n`;
            msg += `   Diámetro: ${diametro.toFixed(0)} mm\n`;
            msg += `   Largo: ${largo.toFixed(0)} mm\n\n`;
        } else if (tipo.includes('bomba') || tipo === 'compresor' || tipo.includes('dosificador') || tipo.includes('skid') || tipo.includes('homogeneizador') || tipo.includes('pasteurizador') || tipo.includes('esterilizador') || tipo.includes('llenadora') || tipo.includes('osmosis') || tipo.includes('celda_electrolitica') || tipo.includes('filtro_prensa') || tipo === 'intercambiador' || tipo === 'condensador' || tipo === 'caldera') {
            msg += `📐 DIMENSIONES:\n`;
            if (largo > 0) msg += `   Largo: ${largo.toFixed(0)} mm\n`;
            if (ancho > 0) msg += `   Ancho: ${ancho.toFixed(0)} mm\n`;
            if (altura > 0) msg += `   Altura: ${altura.toFixed(0)} mm\n`;
            msg += '\n';
        } else {
            if (largo > 0 || ancho > 0 || altura > 0) {
                msg += `📐 DIMENSIONES:\n`;
                if (largo > 0) msg += `   Largo: ${largo.toFixed(0)} mm\n`;
                if (ancho > 0) msg += `   Ancho: ${ancho.toFixed(0)} mm\n`;
                if (altura > 0) msg += `   Altura: ${altura.toFixed(0)} mm\n`;
                msg += '\n';
            }
        }
        
        // Elevaciones
        msg += `📏 ELEVACIONES:\n`;
        msg += `   Centro (posY): ${centerElevation.toFixed(0)} mm\n`;
        msg += `   Cota de apoyo (base): EL ${(baseElevation / 1000) >= 0 ? '+' : ''}${(baseElevation / 1000).toFixed(3)} m\n`;
        msg += `   Cota de superficie (NPT): EL ${(topElevation / 1000) >= 0 ? '+' : ''}${(topElevation / 1000).toFixed(3)} m\n\n`;
        
        // Material y especificación
        msg += `🔩 ESPECIFICACIONES:\n`;
        msg += `   Material: ${material}\n`;
        msg += `   Spec: ${spec}\n\n`;
        
        // Detalles específicos por tipo
        if (tipo === 'plataforma') {
            msg += `🚧 DETALLES ESTRUCTURALES:\n`;
            msg += `   Baranda: ${eq.baranda !== false ? 'Sí (H=1100mm)' : 'No'}\n`;
            msg += `   Escalera: ${eq.escalera !== false ? 'Sí' : 'No'}\n`;
            msg += `   Columnas: ${eq.altura_columnas ? eq.altura_columnas + 'mm' : 'Estándar (3000mm)'}\n\n`;
        }
        
        // Puertos
        msg += `🔌 PUERTOS:\n`;
        if (eq.puertos && eq.puertos.length > 0) {
            eq.puertos.forEach(function(p) {
                const portElevation = pos.y + (p.relY || 0);
                const status = p.status === 'open' ? 'DISPONIBLE' : (p.connectedTo ? 'CONECTADO a ' + p.connectedTo.tag : 'CONECTADO');
                msg += `   ${p.id}: ⌀${p.diametro || '?'}" | EL ${(portElevation / 1000) >= 0 ? '+' : ''}${(portElevation / 1000).toFixed(3)}m | ${status}\n`;
            });
        } else {
            msg += `   Sin puertos definidos\n`;
        }
        
        msg += '\n═══════════════════════════════════';
        
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

    // ================================================================
    //  COMANDO PLACE (NUEVO v2.5)
    // ================================================================
    
    function parsePlace(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'place' && parts[0] !== 'apoyar' && parts[0] !== 'posar' && parts[0] !== 'poner' && parts[0] !== 'colocar') return false;
        
        const tag = parts[1];
        if (!tag) { notifyWithVoice('Uso: place EQUIPO on SUPERFICIE | place EQUIPO on ground | place EQUIPO on suelo', true); return true; }
        
        const onIdx = parts.indexOf('on') !== -1 ? parts.indexOf('on') : parts.indexOf('sobre');
        if (onIdx === -1 || onIdx + 1 >= parts.length) { 
            notifyWithVoice('Uso: place EQUIPO on SUPERFICIE | place EQUIPO on ground', true); 
            return true; 
        }
        
        let superficieTag = parts[onIdx + 1];
        
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        
        const equipo = _core.findObjectByTag(tag);
        if (!equipo) { notifyWithVoice(`❌ Equipo "${tag}" no encontrado`, true); return true; }
        
        // Si es "ground" o "suelo", apoyar en datum 0
        let superficieY = 0;
        let superficieNombre = 'suelo (EL ±0.000m)';
        
        if (superficieTag && superficieTag.toLowerCase() !== 'ground' && superficieTag.toLowerCase() !== 'suelo') {
            const superficie = _core.findObjectByTag(superficieTag);
            if (!superficie) { notifyWithVoice(`❌ Superficie "${superficieTag}" no encontrada`, true); return true; }
            
            const alturaSuperficie = superficie.altura || 0;
            superficieY = (superficie.posY || 0) + (alturaSuperficie / 2);
            superficieNombre = `${superficieTag} (EL ${(superficieY/1000) >= 0 ? '+' : ''}${(superficieY/1000).toFixed(3)}m)`;
        }
        
        const alturaEquipo = equipo.altura || 0;
        const nuevoPosY = superficieY + (alturaEquipo / 2);
        const dy = nuevoPosY - (equipo.posY || 0);
        
        saveStateBeforeMutation();
        
        if (equipo.posX !== undefined) {
            _core.updateEquipment(tag, { 
                posY: nuevoPosY,
                elevacion: superficieY
            });
        } else {
            const pts = getPoints(equipo);
            if (pts.length > 0) {
                const newPts = pts.map(p => ({ x: p.x, y: p.y + dy, z: p.z }));
                _core.updateLine(tag, { _cachedPoints: newPts });
            }
        }
        
        _core.syncPhysicalData();
        if (_renderUI) _renderUI();
        
        const baseElev = nuevoPosY - (alturaEquipo / 2);
        notifyWithVoice(`✅ ${tag} apoyado sobre ${superficieNombre}\n   Centro Y=${nuevoPosY.toFixed(0)}mm | Base EL ${(baseElev/1000) >= 0 ? '+' : ''}${(baseElev/1000).toFixed(3)}m`, false);
        
        return true;
    }

    // ================================================================
    //  COMANDOS CREATE, CONNECT, ROUTE, DELETE, EDIT, LIST, BOM, AUDIT
    //  (Se mantienen todos los comandos originales sin cambios)
    // ================================================================

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
            else if (key === 'ancho') params.ancho = parseFloat(parts[++i]);
            else if (key === 'material') params.material = parts[++i].toUpperCase();
            else if (key === 'spec') params.spec = parts[++i];
            else if (key === 'baranda') params.baranda = parts[++i].toLowerCase() === 'true' || parts[++i] === 'si';
            else if (key === 'escalera') params.escalera = parts[++i].toLowerCase() === 'true' || parts[++i] === 'si';
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
        const nuevaLinea = { tag, diameter, material, spec, _cachedPoints: points, waypoints: points.slice(1, -1), components: [] };
        _core.addLine(nuevaLinea);
        const db = _core.getDb();
        const lineaRegistrada = db.lines.find(l => l.tag === tag) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, null, null, null, null, diameter, material);
        if (_core.updateLine) { _core.updateLine(tag, lineaRegistrada); }
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        notifyWithVoice(`✅ Línea ${tag} creada${fittingInfo.message}`, false);
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
        saveStateBeforeMutation();
        if (type === 'equipment' || type === 'equipo') {
            const db = _core.getDb();
            const index = db.equipos.findIndex(e => e.tag === tag);
            if (index === -1) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
            db.equipos.splice(index, 1);
            db.lines = db.lines.filter(line => !((line.origin && line.origin.equipTag === tag) || (line.destination && line.destination.equipTag === tag)));
            notifyWithVoice(`✅ Equipo ${tag} eliminado`, false);
            return true;
        } else if (type === 'line' || type === 'línea') {
            const db = _core.getDb();
            const index = db.lines.findIndex(l => l.tag === tag);
            if (index === -1) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
            db.lines.splice(index, 1);
            db.equipos.forEach(eq => { if (eq.puertos) eq.puertos.forEach(p => { if (p.connectedLine === tag) delete p.connectedLine; }); });
            db.lines.forEach(l => { if (l.puertos) l.puertos.forEach(p => { if (p.connectedLine === tag) delete p.connectedLine; }); });
            notifyWithVoice(`✅ Línea ${tag} eliminada`, false);
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
                if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]); _core.updateEquipment(tag, { posX: x, posY: y, posZ: z }); notifyWithVoice(`✅ Equipo ${tag} movido`, false); return true; }
            } else if (action === 'set' || action === 'establecer') {
                if (parts[4] === 'puerto') {
                    const puertoId = parts[5], subParam = parts[6];
                    if (subParam === 'diam' || subParam === 'diametro') { const nuevoDiam = parseFloat(parts[7]); if (!isNaN(nuevoDiam)) { _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam }); notifyWithVoice(`✅ Puerto ${puertoId} diámetro ${nuevoDiam}"`, false); return true; } }
                    else if (subParam === 'pos' || subParam === 'posicion') { let cs=''; for(let i=7;i<parts.length;i++){cs+=parts[i];if(parts[i].includes(')'))break;} const m=cs.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/); if(m){_core.updatePuerto(tag,puertoId,{pos:{x:parseFloat(m[1]),y:parseFloat(m[2]),z:parseFloat(m[3])}});notifyWithVoice(`✅ Puerto ${puertoId} posición actualizada`,false);return true;} }
                    else if (subParam === 'dir' || subParam === 'direccion') { let cs=''; for(let i=7;i<parts.length;i++){cs+=parts[i];if(parts[i].includes(')'))break;} const m=cs.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/); if(m){_core.updatePuerto(tag,puertoId,{dir:{dx:parseFloat(m[1]),dy:parseFloat(m[2]),dz:parseFloat(m[3])}});notifyWithVoice(`✅ Puerto ${puertoId} dirección actualizada`,false);return true;} }
                }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const property = parts[4], value = parts[5];
                if (property === 'material') { _core.updateLine(tag, { material: value.toUpperCase() }); notifyWithVoice(`✅ Línea ${tag} material ${value}`, false); return true; }
                else if (property === 'diameter' || property === 'diametro') { _core.updateLine(tag, { diameter: parseFloat(value) }); notifyWithVoice(`✅ Línea ${tag} diámetro ${value}"`, false); return true; }
                else if (property === 'spec') { _core.updateLine(tag, { spec: value }); notifyWithVoice(`✅ Línea ${tag} spec ${value}`, false); return true; }
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
                    notifyWithVoice(`✅ ${compDef.nombre} añadido a ${tag}`, false);
                    return true;
                }
            }
        }
        return false;
    }

    function listEquipos() { const eqs = _core.getDb().equipos; notifyWithVoice(eqs.length ? `📦 Equipos (${eqs.length}): ${eqs.map(e=>e.tag).join(', ')}` : 'No hay equipos'); }
    function listLineas() { const ls = _core.getDb().lines; notifyWithVoice(ls.length ? `📏 Líneas (${ls.length}): ${ls.map(l=>`${l.tag}(${l.diameter}" ${l.material||'?'})`).join(', ')}` : 'No hay líneas'); }
    
    function parseList(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' && parts[0] !== 'listar') return false;
        const sub = parts[1]?.toLowerCase();
        if (sub === 'equipos') { listEquipos(); return true; }
        if (sub === 'lineas' || sub === 'líneas') { listLineas(); return true; }
        if (sub === 'componentes') { const types = _catalog.listComponentTypes(); notifyWithVoice(`🔩 Componentes: ${types.sort().join(', ')}`, false); return true; }
        if (sub === 'especificaciones') { const specs = _catalog.listSpecs(); notifyWithVoice(`📋 Especificaciones: ${specs.sort().join(', ')}`, false); return true; }
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
        notifyWithVoice(`✅ BOM generado con ${items.length} líneas.`, false);
    }

    function parseAudit(cmd) { const t = cmd.trim().toLowerCase(); if (t === 'audit' || t === 'auditar') { if (_core && _core.auditModel) _core.auditModel(); else notifyWithVoice("Auditoría no disponible.", true); return true; } return false; }

    function parseHelp(cmd) {
        const lower = cmd.toLowerCase(); if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "═══════════════════════════════════════════════════════════\n";
        ayuda += "              SMARTFLOW PRO v2.5 - COMANDOS\n";
        ayuda += "═══════════════════════════════════════════════════════════\n\n";
        ayuda += "🏗️ CREACIÓN:\n";
        ayuda += "  create [tipo] [tag] at (x,y,z) [diam X] [height X] [material X]\n";
        ayuda += "  create line [tag] route (x,y,z) (x,y,z)... [diameter X] [spec X]\n\n";
        ayuda += "🔗 CONEXIÓN:\n";
        ayuda += "  connect [origen] [puerto] to [destino] [puerto|0-1|0.0-1.0]\n";
        ayuda += "  route from [origen] [puerto] to [destino] [puerto]\n";
        ayuda += "  tap [origen] [puerto] to [linea] [0.0-1.0]\n\n";
        ayuda += "✏️ EDICIÓN:\n";
        ayuda += "  move [tag] to (x,y,z)  |  move [tag] by (dx,dy,dz)\n";
        ayuda += "  place [equipo] on [superficie|ground|suelo]\n";
        ayuda += "  rotate [tag] [angulo] [around X|Y|Z]\n";
        ayuda += "  duplicate [tag] as [nuevo_tag] [offset (dx,dy,dz)]\n";
        ayuda += "  align [tag1] [tag2] ... on X|Y|Z\n";
        ayuda += "  edit line [tag] add component [tipo] at [0-1]\n";
        ayuda += "  split [linea] at (x,y,z) [type TEE_EQUAL]\n";
        ayuda += "  delete equipment|line [tag]\n\n";
        ayuda += "📊 CONSULTAS:\n";
        ayuda += "  info line|equipment|component [tag]\n";
        ayuda += "  point de [tag] [puerto|@0.5|punto N]\n";
        ayuda += "  nodes [tag]\n";
        ayuda += "  measure [tag1] to [tag2]  |  measure between [tag1] and [tag2]\n";
        ayuda += "  list equipos | lineas | componentes | especificaciones\n\n";
        ayuda += "🎯 VISTA:\n";
        ayuda += "  view top|front|iso|extents  |  view [tag] (centrar)\n\n";
        ayuda += "💾 MACROS / EXPORT:\n";
        ayuda += "  macro save [nombre]  |  macro run [nombre]\n";
        ayuda += "  macro list  |  macro delete [nombre]\n";
        ayuda += "  export json  |  export csv\n\n";
        ayuda += "🔄 undo | redo | bom | audit | help\n";
        ayuda += "═══════════════════════════════════════════════════════════\n";
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

    function parseMoveCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'move' && parts[0] !== 'mover') return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice("Uso: move TAG to (x,y,z) | move TAG by (dx,dy,dz)", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(`${tag} no encontrado`, true); return true; }
        const mode = parts[2]?.toLowerCase();
        let coordStr = '';
        for (let i = 3; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const m = coordStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
        if (!m) { notifyWithVoice("Formato: (x,y,z)", true); return true; }
        const vx = parseFloat(m[1]), vy = parseFloat(m[2]), vz = parseFloat(m[3]);
        saveStateBeforeMutation();
        if (obj.posX !== undefined) {
            if (mode === 'by' || mode === 'por') {
                _core.updateEquipment(tag, { posX: (obj.posX || 0) + vx, posY: (obj.posY || 0) + vy, posZ: (obj.posZ || 0) + vz });
            } else {
                _core.updateEquipment(tag, { posX: vx, posY: vy, posZ: vz });
            }
            notifyWithVoice(`✅ ${tag} movido`, false);
        } else {
            const pts = getPoints(obj);
            if (pts.length > 0) {
                let newPts;
                if (mode === 'by' || mode === 'por') {
                    newPts = pts.map(p => ({ x: p.x + vx, y: p.y + vy, z: p.z + vz }));
                } else {
                    const base = pts[0];
                    const dx = vx - base.x, dy = vy - base.y, dz = vz - base.z;
                    newPts = pts.map(p => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz }));
                }
                _core.updateLine(tag, { _cachedPoints: newPts });
                notifyWithVoice(`✅ ${tag} desplazado`, false);
            }
        }
        return true;
    }

    function parseRotate(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'rotate' && parts[0] !== 'rotar' && parts[0] !== 'girar') return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice("Uso: rotate TAG [angulo] [around X|Y|Z]", true); return true; }
        let angle = 0;
        if (parts[2] === 'by') { angle = parseFloat(parts[3]) || 0; }
        else { angle = parseFloat(parts[2]) || 0; }
        let axis = 'Y';
        const aroundIdx = parts.indexOf('around') !== -1 ? parts.indexOf('around') : parts.indexOf('eje');
        if (aroundIdx !== -1 && aroundIdx + 1 < parts.length) { axis = parts[aroundIdx + 1].toUpperCase(); }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(`${tag} no encontrado`, true); return true; }
        saveStateBeforeMutation();
        if (obj.posX !== undefined) {
            const currentRotation = obj.rotation || 0;
            _core.updateEquipment(tag, { rotation: currentRotation + angle });
            notifyWithVoice(`✅ ${tag} rotado ${angle}° (total: ${currentRotation + angle}°)`, false);
        } else {
            const pts = getPoints(obj);
            if (pts.length > 0) {
                const rad = angle * Math.PI / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                let cx = 0, cy = 0, cz = 0;
                pts.forEach(p => { cx += p.x; cy += p.y; cz += p.z; });
                cx /= pts.length; cy /= pts.length; cz /= pts.length;
                const newPts = pts.map(p => {
                    const rx = p.x - cx, ry = p.y - cy, rz = p.z - cz;
                    if (axis === 'Y') return { x: cx + rx * cos - rz * sin, y: p.y, z: cz + rx * sin + rz * cos };
                    else if (axis === 'Z') return { x: cx + rx * cos - ry * sin, y: cy + rx * sin + ry * cos, z: p.z };
                    else if (axis === 'X') return { x: p.x, y: cy + ry * cos - rz * sin, z: cz + ry * sin + rz * cos };
                    return p;
                });
                _core.updateLine(tag, { _cachedPoints: newPts });
                notifyWithVoice(`✅ ${tag} rotado ${angle}° alrededor del eje ${axis}`, false);
            }
        }
        return true;
    }

    function parseDuplicate(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'duplicate' && parts[0] !== 'duplicar' && parts[0] !== 'copy' && parts[0] !== 'copiar') return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice("Uso: duplicate TAG as NUEVO_TAG [offset (dx,dy,dz)]", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const original = _core.findObjectByTag(tag);
        if (!original) { notifyWithVoice(`${tag} no encontrado`, true); return true; }
        let newTag = null;
        const asIdx = parts.indexOf('as') !== -1 ? parts.indexOf('as') : parts.indexOf('como');
        if (asIdx !== -1 && asIdx + 1 < parts.length) { newTag = parts[asIdx + 1]; }
        else { newTag = tag + '-COPY'; }
        let offsetX = 2000, offsetY = 0, offsetZ = 0;
        const offsetIdx = parts.indexOf('offset') !== -1 ? parts.indexOf('offset') : parts.indexOf('desplazar');
        if (offsetIdx !== -1) {
            const coordStr = parts.slice(offsetIdx + 1).join('');
            const m = coordStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
            if (m) { offsetX = parseFloat(m[1]); offsetY = parseFloat(m[2]); offsetZ = parseFloat(m[3]); }
        }
        const isEquipment = original.posX !== undefined || (original.pos && original.pos.x !== undefined);
        saveStateBeforeMutation();
        if (isEquipment) {
            const clone = JSON.parse(JSON.stringify(original));
            clone.tag = newTag;
            clone.posX = (clone.posX || 0) + offsetX;
            clone.posY = (clone.posY || 0) + offsetY;
            clone.posZ = (clone.posZ || 0) + offsetZ;
            const success = _core.addEquipment(clone);
            if (success) { notifyWithVoice(`✅ Equipo duplicado: ${tag} → ${newTag}`, false); if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: clone }); }
        } else {
            const clone = JSON.parse(JSON.stringify(original));
            clone.tag = newTag;
            const pts = getPoints(original);
            if (pts.length > 0) {
                clone._cachedPoints = pts.map(p => ({ x: p.x + offsetX, y: p.y + offsetY, z: p.z + offsetZ }));
            }
            const success = _core.addLine(clone);
            if (success) { notifyWithVoice(`✅ Línea duplicada: ${tag} → ${newTag}`, false); if (_core.setSelected) _core.setSelected({ type: 'line', obj: clone }); }
        }
        return true;
    }

    function parseAlign(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'align' && parts[0] !== 'alinear') return false;
        const tags = [];
        let axis = 'Y';
        let i = 1;
        while (i < parts.length && parts[i] !== 'on' && parts[i] !== 'en') { tags.push(parts[i]); i++; }
        if (i < parts.length && (parts[i] === 'on' || parts[i] === 'en')) { axis = parts[i + 1]?.toUpperCase() || 'Y'; }
        if (tags.length < 2) { notifyWithVoice("Uso: align TAG1 TAG2 [TAG3...] on X|Y|Z", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const refObj = _core.findObjectByTag(tags[0]);
        if (!refObj || refObj.posX === undefined) { notifyWithVoice(`${tags[0]} no es un equipo válido para alinear`, true); return true; }
        const refValue = axis === 'X' ? refObj.posX : axis === 'Y' ? refObj.posY : refObj.posZ;
        saveStateBeforeMutation();
        let count = 0;
        for (let j = 1; j < tags.length; j++) {
            const obj = _core.findObjectByTag(tags[j]);
            if (!obj || obj.posX === undefined) continue;
            const update = {};
            if (axis === 'X') update.posX = refValue;
            else if (axis === 'Y') update.posY = refValue;
            else update.posZ = refValue;
            _core.updateEquipment(tags[j], update);
            count++;
        }
        notifyWithVoice(`✅ ${count} equipos alineados al eje ${axis}`, false);
        return true;
    }

    function parseMeasure(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'measure' && parts[0] !== 'medir' && parts[0] !== 'distancia' && parts[0] !== 'distance') return false;
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        let tag1, tag2, port1 = null, port2 = null;
        if (parts[1] === 'between' || parts[1] === 'entre') {
            tag1 = parts[2];
            const andIdx = parts.indexOf('and') !== -1 ? parts.indexOf('and') : parts.indexOf('y');
            if (andIdx === -1) { notifyWithVoice("Uso: measure between TAG1 and TAG2", true); return true; }
            tag2 = parts[andIdx + 1];
        } else {
            tag1 = parts[1];
            const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
            if (toIdx === -1) { notifyWithVoice("Uso: measure TAG1 to TAG2", true); return true; }
            tag2 = parts[toIdx + 1];
        }
        if (tag1?.includes(':')) { [tag1, port1] = tag1.split(':'); }
        if (tag2?.includes(':')) { [tag2, port2] = tag2.split(':'); }
        const obj1 = _core.findObjectByTag(tag1);
        const obj2 = _core.findObjectByTag(tag2);
        if (!obj1 || !obj2) { notifyWithVoice("Objeto(s) no encontrado(s)", true); return true; }
        const pos1 = port1 ? getPortPosition(tag1, port1) : getBasePosition(obj1);
        const pos2 = port2 ? getPortPosition(tag2, port2) : getBasePosition(obj2);
        const dx = pos2.x - pos1.x, dy = pos2.y - pos1.y, dz = pos2.z - pos1.z;
        const dist = Math.hypot(dx, dy, dz);
        const distH = Math.hypot(dx, dz);
        let msg = `📏 Distancia ${tag1}`;
        if (port1) msg += `:${port1}`;
        msg += ` → ${tag2}`;
        if (port2) msg += `:${port2}`;
        msg += `:\n  3D: ${(dist/1000).toFixed(3)} m (${dist.toFixed(0)} mm)\n  Horizontal: ${(distH/1000).toFixed(3)} m\n  ΔX: ${dx.toFixed(0)} mm | ΔY: ${dy.toFixed(0)} mm | ΔZ: ${dz.toFixed(0)} mm`;
        notifyWithVoice(msg, false);
        return true;
    }

    let _macros = new Map();
    window._commandHistory = window._commandHistory || [];

    function recordCommand(cmd) {
        if (cmd && !cmd.startsWith('//') && cmd.trim()) {
            window._commandHistory.push(cmd.trim());
            if (window._commandHistory.length > 200) { window._commandHistory.shift(); }
        }
    }

    function parseMacro(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'macro' && parts[0] !== 'script') return false;
        const action = parts[1]?.toLowerCase();
        if (action === 'save' || action === 'guardar') {
            const name = parts[2];
            if (!name) { notifyWithVoice("Uso: macro save NOMBRE", true); return true; }
            const history = [...window._commandHistory];
            _macros.set(name, history);
            notifyWithVoice(`💾 Macro "${name}" guardada (${history.length} comandos)`, false);
            return true;
        }
        if (action === 'run' || action === 'ejecutar') {
            const name = parts[2];
            if (!name || !_macros.has(name)) { notifyWithVoice(`Macro "${name}" no encontrada. Use macro list.`, true); return true; }
            const commands = _macros.get(name);
            let count = 0;
            commands.forEach(c => { if (executeCommand(c)) count++; });
            notifyWithVoice(`▶️ Macro "${name}": ${count}/${commands.length} comandos ejecutados`, false);
            return true;
        }
        if (action === 'list' || action === 'lista') {
            if (_macros.size === 0) { notifyWithVoice("No hay macros guardadas.", false); }
            else {
                let msg = "📋 Macros guardadas:\n";
                for (const [name, cmds] of _macros) { msg += `  • ${name} (${cmds.length} comandos)\n`; }
                notifyWithVoice(msg, false);
            }
            return true;
        }
        if (action === 'delete' || action === 'eliminar') {
            const name = parts[2];
            if (_macros.delete(name)) { notifyWithVoice(`🗑️ Macro "${name}" eliminada`, false); }
            else { notifyWithVoice(`Macro "${name}" no encontrada`, true); }
            return true;
        }
        notifyWithVoice("Uso: macro save|run|list|delete [nombre]", true);
        return true;
    }

    function parseExportCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'export' && parts[0] !== 'exportar') return false;
        const format = parts[1]?.toLowerCase();
        if (format === 'json') {
            if (_core && _core.exportProject) {
                const json = _core.exportProject();
                const blob = new Blob([json], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `SmartFlow_${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                notifyWithVoice("📁 Proyecto exportado como JSON", false);
            }
            return true;
        }
        if (format === 'csv') { generateBOM(); return true; }
        notifyWithVoice("Formatos: export json | export csv", true);
        return true;
    }

    function parseViewCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'view' && parts[0] !== 'vista' && parts[0] !== 'zoom' && parts[0] !== 'camara' && parts[0] !== 'cámara') return false;
        const sub = parts[1]?.toLowerCase();
        if (sub === 'top' || sub === 'planta') { if (_renderer && _renderer.setView) _renderer.setView('top'); notifyWithVoice("🔭 Vista: Planta (TOP)", false); return true; }
        if (sub === 'front' || sub === 'frente') { if (_renderer && _renderer.setView) _renderer.setView('front'); notifyWithVoice("🔭 Vista: Frontal", false); return true; }
        if (sub === 'iso' || sub === 'isometrico' || sub === 'isométrico') { if (_renderer && _renderer.setView) _renderer.setView('iso'); notifyWithVoice("🔭 Vista: Isométrica", false); return true; }
        if (sub === 'extents' || sub === 'todo' || sub === 'fit' || sub === 'extender') { if (_renderer && _renderer.zoomToFit) _renderer.zoomToFit(); notifyWithVoice("🔭 Zoom: Extender", false); return true; }
        if (sub && !['top','front','iso','extents','fit','todo','extender','reset'].includes(sub)) {
            const obj = _core?.findObjectByTag(sub);
            if (obj) { const pos = getBasePosition(obj); if (_renderer && _renderer.focusOn) _renderer.focusOn(pos); notifyWithVoice(`🔭 Centrando en ${sub}`, false); return true; }
        }
        notifyWithVoice("Vistas: top | front | iso | extents | [TAG]", true);
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

    // ================================================================
    //  EJECUCIÓN PRINCIPAL
    // ================================================================

    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); recordCommand(cmd); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); recordCommand(cmd); return true; }
        
        if (parseCreateLine(trimmed)) { recordCommand(cmd); return true; }
        if (parseCreate(trimmed)) { recordCommand(cmd); return true; }
        if (parseConnect(trimmed)) { recordCommand(cmd); return true; }
        if (parseRoute(trimmed)) { recordCommand(cmd); return true; }
        if (parseTap(trimmed)) { recordCommand(cmd); return true; }
        if (parseSplit(trimmed)) { recordCommand(cmd); return true; }
        if (parseMoveCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parsePlace(trimmed)) { recordCommand(cmd); return true; }
        if (parseRotate(trimmed)) { recordCommand(cmd); return true; }
        if (parseDuplicate(trimmed)) { recordCommand(cmd); return true; }
        if (parseAlign(trimmed)) { recordCommand(cmd); return true; }
        if (parseDelete(trimmed)) { recordCommand(cmd); return true; }
        if (parseEditCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parseMeasure(trimmed)) { recordCommand(cmd); return true; }
        if (parsePoint(trimmed)) { recordCommand(cmd); return true; }
        if (parseNodes(trimmed)) { recordCommand(cmd); return true; }
        if (parseInfo(trimmed)) { recordCommand(cmd); return true; }
        if (parseList(trimmed)) { recordCommand(cmd); return true; }
        if (parseViewCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parseBOM(trimmed)) { recordCommand(cmd); return true; }
        if (parseAudit(trimmed)) { recordCommand(cmd); return true; }
        if (parseMacro(trimmed)) { recordCommand(cmd); return true; }
        if (parseExportCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parseHelp(trimmed)) { recordCommand(cmd); return true; }
        
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
        _core = coreInstance;
        _catalog = catalogInstance;
        _renderer = rendererInstance;
        _notifyUI = notifyFn;
        _renderUI = renderFn;
        _voiceFn = voiceFn || null;
    }

    // ================================================================
    //  API PÚBLICA
    // ================================================================
    return {
        init,
        executeCommand,
        executeBatch,
        importPCF,
        getPortDirectionLocal,
        getTopSurface,
        getMacros: () => _macros,
        getHistory: () => window._commandHistory || [],
        clearHistory: () => { window._commandHistory = []; }
    };
})();
