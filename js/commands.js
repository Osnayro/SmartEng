// ============================================================
// SMARTFLOW COMMANDS v3.7 - Intérprete de Comandos Unificado
// Archivo: js/commands.js
// Compatible: SmartFlowCore v5.6 + SmartFlowRouter v3.6 + SmartFlowCatalog v4.1
// Novedades v3.7:
//   - Eliminado skeyToInternal (ahora en SmartFlowIO)
//   - Eliminado importPCF (ahora en SmartFlowIO)
//   - Export/Import delegados a SmartFlowIO con fallback
//   - parseNodes MEJORADO: coordenadas, iconos 🟢/🔴, puertos TEE
//   - parseNodosAbiertos: puertos disponibles con nombre completo
//   - Nombres de puerto listos para copiar y pegar (L-1.TEE_xyz_P3)
//   - parseLineFromTo: creación de línea en un solo paso
//   - parseExtendLine: extender línea existente
//   - parseOptimizeRoute: eliminar puntos colineales
//   - parseRerouteLine: recalcular ruta completa
//   - parseSetProject: configurar defaults de material/spec
//   - extractBranchOrientation: keywords direccionales
//   - calculateBranchDirection: dirección automática del BRANCH
//   - validateTeeSpace: validar espacio para inserción
//   - resolveMaterialAndSpec: NO hereda material sin confirmación
//   - checkMaterialCompatibility: advertencias de incompatibilidad
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
        'edit': 'edit', 'update': 'edit', 'mover': 'move', 'move': 'move',
        'establecer': 'edit', 'diametro': 'edit',
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
        'apoyar': 'place', 'posar': 'place', 'place': 'place', 'poner': 'place', 'colocar': 'place',
        'accesorios': 'accessories', 'accesorios': 'accessories', 'accessories': 'accessories',
        'transicion': 'transition', 'transition': 'transition',
        'extender': 'extend', 'extend': 'extend',
        'optimizar': 'optimize', 'optimize': 'optimize',
        're-enrutar': 'reroute', 'reroute': 'reroute', 'recalcular': 'reroute',
        'proyecto': 'project', 'project': 'project'
    };

    function getIntent(word) {
        if (!word) return null;
        return IntentDictionary[word.toLowerCase()] || null;
    }

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        
        if (parts.length >= 2 && parts[0].toLowerCase() === 'set' && parts[1].toLowerCase() === 'project') {
            return cmd;
        }
        
        const intent = getIntent(parts[0]);
        if (intent) { parts[0] = intent; return parts.join(' '); }
        return cmd;
    }

    // ================================================================
    //  DEFAULTS DEL PROYECTO (Configurables)
    // ================================================================
    let _projectDefaults = {
        material: 'PPR',
        spec: 'PPR_PN12_5'
    };

    function getProjectDefaultMaterial() {
        return _projectDefaults.material;
    }

    function getProjectDefaultSpec(material) {
        if (_projectDefaults.spec) {
            return _projectDefaults.spec;
        }
        const mat = (material || _projectDefaults.material || '').toUpperCase();
        if (mat.includes('PPR')) return 'PPR_PN12_5';
        if (mat.includes('HDPE') || mat.includes('PE100')) return 'HDPE_PE100';
        if (mat.includes('PVC') && !mat.includes('CPVC')) return 'PVC_SCH80';
        if (mat.includes('CPVC')) return 'CPVC_SCH80';
        if (mat.includes('INOX') || mat.includes('SS') || mat.includes('STAINLESS')) return 'SS_150_RF';
        if (mat.includes('ACERO') || mat.includes('CARBONO') || mat.includes('CS') || mat.includes('STEEL')) return 'ACERO_150_RF';
        if (mat.includes('DUPLEX')) return 'DUPLEX_150_RF';
        if (mat.includes('ALUMINIO') || mat.includes('ALUMINUM')) return 'ALUMINIO_ESTRUCTURAL';
        if (mat.includes('CONCRETO') || mat.includes('HORMIGON')) return 'HORMIGON_ESTRUCTURAL';
        if (mat.includes('MADERA') || mat.includes('WOOD')) return 'MADERA_ESTRUCTURAL';
        return 'PPR_PN12_5';
    }

    function setProjectDefaults(material, spec) {
        if (material) _projectDefaults.material = material;
        if (spec) _projectDefaults.spec = spec;
        notifyWithVoice("📐 Defaults del proyecto: " + _projectDefaults.material + " / " + _projectDefaults.spec, false);
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

    function extractNamedParams(parts, startIndex) {
        const params = {};
        const keywords = ['material', 'spec', 'diameter', 'diametro', 'type', 'tipo', 'orient', 'direccion', 'via'];
        const skipWords = ['to', 'from', 'at', 'in', 'on', 'by', 'with', 'and', 'route', 'ruta', 'via', 'as', 'like', 'auto', 'add', 'transition', 'transicion'];
        
        for (let i = startIndex || 0; i < parts.length; i++) {
            const w = (parts[i] || '').toLowerCase();
            
            if ((w === 'material' || w === 'spec' || w === 'type' || w === 'tipo') && i + 1 < parts.length) {
                const next = parts[i + 1];
                if (next && !keywords.includes(next.toLowerCase()) && !skipWords.includes(next.toLowerCase())) {
                    params[w === 'material' ? 'material' : w === 'spec' ? 'spec' : 'type'] = 
                        w === 'material' ? next.toUpperCase() : next;
                    i++;
                }
            } else if ((w === 'diameter' || w === 'diametro') && i + 1 < parts.length) {
                const val = parseFloat(parts[i + 1]);
                if (!isNaN(val)) { params.diameter = val; i++; }
            }
        }
        return params;
    }

    function extractWaypoints(parts, startIdx, endIdx) {
        const waypoints = [];
        for (let i = startIdx; i < (endIdx || parts.length); i++) {
            const coordStr = parts[i];
            const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
            if (m) {
                waypoints.push({ 
                    x: parseFloat(m[1]), 
                    y: parseFloat(m[2]), 
                    z: parseFloat(m[3]) 
                });
            }
        }
        return waypoints;
    }

    function extractOrientation(parts) {
        const orientIdx = parts.indexOf('orient') !== -1 ? parts.indexOf('orient') : parts.indexOf('direccion');
        if (orientIdx !== -1 && orientIdx + 1 < parts.length) {
            const orientStr = parts.slice(orientIdx + 1).join('');
            const m = orientStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
            if (m) {
                return { 
                    dx: parseFloat(m[1]), 
                    dy: parseFloat(m[2]), 
                    dz: parseFloat(m[3]) 
                };
            }
        }
        return null;
    }

    function extractBranchOrientation(parts, startIdx) {
        startIdx = startIdx || 0;
        for (let i = startIdx; i < parts.length; i++) {
            const w = (parts[i] || '').toLowerCase();
            if (w === 'orient' || w === 'direccion' || w === 'dirección' || w === 'branch') {
                if (i + 1 < parts.length) {
                    const orientStr = parts.slice(i + 1).join(' ');
                    const m = orientStr.match(/\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/);
                    if (m) {
                        return { dx: parseFloat(m[1]), dy: parseFloat(m[2]), dz: parseFloat(m[3]) };
                    }
                }
            }
            if (w === 'branchup' || w === 'branch_up' || w === 'up') return { dx: 0, dy: 1, dz: 0 };
            if (w === 'branchdown' || w === 'branch_down' || w === 'down') return { dx: 0, dy: -1, dz: 0 };
            if (w === 'branchnorth' || w === 'branch_north' || w === 'north') return { dx: 0, dy: 0, dz: -1 };
            if (w === 'branchsouth' || w === 'branch_south' || w === 'south') return { dx: 0, dy: 0, dz: 1 };
            if (w === 'brancheast' || w === 'branch_east' || w === 'east') return { dx: 1, dy: 0, dz: 0 };
            if (w === 'branchwest' || w === 'branch_west' || w === 'west') return { dx: -1, dy: 0, dz: 0 };
        }
        return null;
    }

    function resolveMaterialAndSpec(explicitParams, connectedObjects, defaults, options) {
        options = options || {};
        const inheritFromConnected = options.inheritFromConnected === true;
        
        const result = {
            material: null,
            spec: null
        };
        
        if (explicitParams.material) {
            result.material = explicitParams.material;
        }
        if (explicitParams.spec) {
            result.spec = explicitParams.spec;
        }
        
        if (!result.material && inheritFromConnected && connectedObjects && connectedObjects.length > 0) {
            for (let i = 0; i < connectedObjects.length; i++) {
                if (connectedObjects[i] && connectedObjects[i].material) {
                    result.material = connectedObjects[i].material;
                    break;
                }
            }
        }
        
        if (!result.spec && inheritFromConnected && connectedObjects && connectedObjects.length > 0) {
            for (let i = 0; i < connectedObjects.length; i++) {
                if (connectedObjects[i] && connectedObjects[i].spec) {
                    result.spec = connectedObjects[i].spec;
                    break;
                }
            }
        }
        
        if (!result.material) {
            result.material = (defaults && defaults.material) || getProjectDefaultMaterial();
        }
        
        if (!result.spec) {
            if (defaults && defaults.spec) {
                result.spec = defaults.spec;
            } else {
                result.spec = getProjectDefaultSpec(result.material);
            }
        }
        
        return result;
    }

    function calculateBranchDirection(teePosition, targetPosition, waypoints) {
        let target;
        if (waypoints && waypoints.length > 0) {
            target = waypoints[0];
        } else if (targetPosition) {
            target = targetPosition;
        } else {
            return { dx: 0, dy: 1, dz: 0 };
        }
        
        const dx = target.x - teePosition.x;
        const dy = target.y - teePosition.y;
        const dz = target.z - teePosition.z;
        
        const len = Math.hypot(dx, dy, dz);
        
        if (len < 0.01) {
            return { dx: 0, dy: 1, dz: 0 };
        }
        
        return {
            dx: dx / len,
            dy: dy / len,
            dz: dz / len
        };
    }

    function validateTeeSpace(line, position, diameter) {
        const pts = _core ? _core.getLinePoints(line) : (line._cachedPoints || line.points3D || []);
        if (!pts || pts.length < 2) return { valid: true, warnings: [] };
        
        let totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
        }
        
        const insertDist = totalLen * position;
        const diamMM = (diameter || 4) * 25.4;
        const minSpace = diamMM * 2;
        
        const warnings = [];
        
        if (insertDist < minSpace && position > 0.02) {
            warnings.push("Espacio antes de TEE: " + insertDist.toFixed(0) + "mm (mín: " + minSpace.toFixed(0) + "mm)");
        }
        
        const spaceAfter = totalLen - insertDist;
        if (spaceAfter < minSpace && position < 0.98) {
            warnings.push("Espacio después de TEE: " + spaceAfter.toFixed(0) + "mm (mín: " + minSpace.toFixed(0) + "mm)");
        }
        
        if (line.components) {
            const nearby = line.components.filter(function(c) { 
                return Math.abs((c.param || 0) - position) < 0.04; 
            });
            if (nearby.length > 0) {
                warnings.push("Componente(s) cercano(s): " + nearby.map(function(c) { return c.type || '?'; }).join(', '));
            }
        }
        
        return {
            valid: warnings.length === 0,
            warnings: warnings,
            minSpace: minSpace
        };
    }

    function checkMaterialCompatibility(newLineMaterial, fromObj, toObj) {
        const warnings = [];
        
        if (fromObj && fromObj.material && fromObj.material.toUpperCase() !== newLineMaterial.toUpperCase()) {
            warnings.push("⚠️ Material diferente al origen: " + fromObj.material + " → " + newLineMaterial);
        }
        
        if (toObj && toObj.material && toObj.material.toUpperCase() !== newLineMaterial.toUpperCase()) {
            warnings.push("⚠️ Material diferente al destino: " + toObj.material + " → " + newLineMaterial);
        }
        
        return warnings;
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
        const puerto = obj.puertos && obj.puertos.find(function(p) { return p.id === portId; });
        if (puerto) {
            const ori = puerto.orientacion || puerto.dir || puerto.normal;
            if (ori) return { dx: ori.x || ori.dx || 1, dy: ori.y || ori.dy || 0, dz: ori.z || ori.dz || 0 };
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

    function isParametricPortId(portId) {
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.isParametricPortId) {
            return SmartFlowRouter.isParametricPortId(portId);
        }
        if (portId === '0' || portId === '1' || portId === 0 || portId === 1) return false;
        if (String(portId) === '0.0' || String(portId) === '1.0') return false;
        const paramValue = parseFloat(portId);
        return !isNaN(paramValue) && paramValue > 0 && paramValue < 1;
    }

    function getPointAtParam(pts, param) {
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPointAtParam) {
            return SmartFlowRouter.getPointAtParam(pts, param);
        }
        if (!pts || pts.length < 2) return pts && pts[0] ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : null;
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return { x: pts[0].x, y: pts[0].y, z: pts[0].z };
        const targetDist = totalLen * Math.max(0, Math.min(1, param));
        let accumDist = 0;
        for (let j = 0; j < lengths.length; j++) {
            if (accumDist + lengths[j] >= targetDist || j === lengths.length - 1) {
                const segParam = lengths[j] > 0 ? (targetDist - accumDist) / lengths[j] : 0;
                return {
                    x: pts[j].x + (pts[j+1].x - pts[j].x) * Math.max(0, Math.min(1, segParam)),
                    y: pts[j].y + (pts[j+1].y - pts[j].y) * Math.max(0, Math.min(1, segParam)),
                    z: pts[j].z + (pts[j+1].z - pts[j].z) * Math.max(0, Math.min(1, segParam))
                };
            }
            accumDist += lengths[j];
        }
        return { x: pts[pts.length-1].x, y: pts[pts.length-1].y, z: pts[pts.length-1].z };
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

    function getPortPosition(tag, portId) {
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
            return SmartFlowRouter.getPortPosition(_core ? _core.findObjectByTag(tag) : null, portId);
        }
        const obj = _core ? _core.findObjectByTag(tag) : null;
        if (!obj) return { x: 0, y: 0, z: 0 };
        const base = getBasePosition(obj);
        const puerto = obj.puertos && obj.puertos.find(function(p) { return p.id === portId; });
        if (puerto) {
            return {
                x: base.x + (puerto.relX || 0),
                y: base.y + (puerto.relY || 0),
                z: base.z + (puerto.relZ || 0)
            };
        }
        return base;
    }

    function notifyWithVoice(message, isError) {
        isError = isError || false;
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
        } else if (_core && _core.getDb) {
            const state = JSON.parse(JSON.stringify({
                equipos: _core.getDb().equipos,
                lines: _core.getDb().lines
            }));
            if (!window._manualUndoStack) window._manualUndoStack = [];
            window._manualUndoStack.push(state);
        }
    }

    function runFittingInjection(line, fromObj, fromPortId, toObj, toPortId, diameter, material, spec) {
        if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.ensureFittings === 'function') {
            return SmartFlowRouter.ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material, spec);
        }
        return { added: [], message: ' | ⚠️ Router no disponible para inyección' };
    }

    function getTopSurface(tag) {
        const obj = _core ? _core.findObjectByTag(tag) : null;
        if (!obj) return 0;
        const altura = obj.altura || 0;
        const posY = obj.posY || 0;
        return posY + (altura / 2);
    }

    function getEquipmentTypeName(tipo) {
        const names = {
            'tanque_v': 'Tanque Vertical', 'tanque_h': 'Tanque Horizontal',
            'bomba': 'Bomba Centrífuga', 'bomba_dosificacion': 'Bomba Dosificadora',
            'intercambiador': 'Intercambiador de Calor', 'condensador': 'Condensador',
            'torre': 'Torre de Destilación', 'columna_fraccionadora': 'Columna Fraccionadora',
            'reactor': 'Reactor', 'reactor_encamisado': 'Reactor Encamisado',
            'autoclave': 'Autoclave', 'caldera': 'Caldera', 'compresor': 'Compresor',
            'separador': 'Separador Bifásico', 'separador_trifasico': 'Separador Trifásico',
            'plataforma': 'Plataforma Estructural', 'antorcha': 'Antorcha (Flare)',
            'filtro_prensa': 'Filtro Prensa', 'filtro_duplex': 'Filtro Dúplex',
            'osmosis': 'Ósmosis Inversa', 'centrifuga': 'Centrífuga',
            'agitador': 'Agitador / Mezclador', 'molino': 'Molino',
            'llenadora': 'Llenadora', 'skid_inyeccion': 'Skid Inyección Química'
        };
        return names[tipo] || tipo || 'Equipo';
    }

    function addComponentToLine(line, lineTag, compType, position) {
        let finalType = compType;
        const compDef = _catalog ? _catalog.getComponent(compType) : null;
        if (!compDef) {
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.findComponentInCatalog) {
                const found = SmartFlowRouter.findComponentInCatalog(compType, line.material || 'PPR', []);
                if (!found) {
                    notifyWithVoice("⚠️ Componente no encontrado: " + compType, true);
                    return false;
                }
                finalType = found;
            } else {
                notifyWithVoice("⚠️ Componente no encontrado: " + compType, true);
                return false;
            }
        }
        
        const existe = line.components && line.components.some(function(c) { 
            return c.type && c.type.toUpperCase().indexOf(finalType.toUpperCase()) !== -1 && 
                   Math.abs((c.param || 0) - position) < 0.01; 
        });
        
        if (existe) {
            notifyWithVoice("⚠️ Ya existe " + finalType + " en pos " + position.toFixed(2), false);
            return false;
        }
        
        if (!line.components) line.components = [];
        
        line.components.push({
            type: finalType,
            tag: finalType + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4),
            param: position
        });
        
        return true;
    }

    const SPACING_RULES = {
        'VALVE': { spaceBefore: 150, spaceAfter: 150, category: 'inline' },
        'GATE_VALVE': { spaceBefore: 150, spaceAfter: 150, category: 'inline' },
        'GLOBE_VALVE': { spaceBefore: 180, spaceAfter: 150, category: 'inline' },
        'BALL_VALVE': { spaceBefore: 120, spaceAfter: 120, category: 'inline' },
        'BUTTERFLY_VALVE': { spaceBefore: 120, spaceAfter: 120, category: 'inline' },
        'CHECK_VALVE': { spaceBefore: 150, spaceAfter: 150, category: 'inline' },
        'STRAINER': { spaceBefore: 200, spaceAfter: 200, category: 'inline' },
        'FLANGE': { spaceBefore: 50, spaceAfter: 50, category: 'connection' },
        'WELD_NECK_FLANGE': { spaceBefore: 50, spaceAfter: 50, category: 'connection' },
        'SLIP_ON_FLANGE': { spaceBefore: 50, spaceAfter: 50, category: 'connection' },
        'BLIND_FLANGE': { spaceBefore: 30, spaceAfter: 0, category: 'connection' },
        'REDUCER': { spaceBefore: 100, spaceAfter: 80, category: 'transition' },
        'CONCENTRIC_REDUCER': { spaceBefore: 100, spaceAfter: 80, category: 'transition' },
        'ECCENTRIC_REDUCER': { spaceBefore: 100, spaceAfter: 80, category: 'transition' },
        'TEE_REDUCING': { spaceBefore: 120, spaceAfter: 100, category: 'branch' },
        'ELBOW': { spaceBefore: 80, spaceAfter: 80, category: 'directional' },
        'ELBOW_90_LR': { spaceBefore: 80, spaceAfter: 80, category: 'directional' },
        'ELBOW_90_SR': { spaceBefore: 60, spaceAfter: 60, category: 'directional' },
        'ELBOW_45': { spaceBefore: 60, spaceAfter: 60, category: 'directional' },
        'TEE': { spaceBefore: 120, spaceAfter: 120, category: 'branch' },
        'TEE_EQUAL': { spaceBefore: 120, spaceAfter: 120, category: 'branch' },
        'EXPANSION_JOINT': { spaceBefore: 250, spaceAfter: 250, category: 'expansion' },
        'PIPE_GUIDE': { spaceBefore: 50, spaceAfter: 50, category: 'support' },
        'CAP': { spaceBefore: 30, spaceAfter: 0, category: 'end' },
        'CROSS': { spaceBefore: 150, spaceAfter: 150, category: 'branch' },
        'PRESSURE_GAUGE': { spaceBefore: 60, spaceAfter: 0, category: 'instrument' },
        'TEMPERATURE_GAUGE': { spaceBefore: 60, spaceAfter: 0, category: 'instrument' },
        'FLOW_METER': { spaceBefore: 200, spaceAfter: 200, category: 'instrument' },
        'DEFAULT': { spaceBefore: 100, spaceAfter: 100, category: 'general' }
    };

    function getSpacingRules(componentType) {
        const typeUpper = (componentType || '').toUpperCase();
        if (SPACING_RULES[typeUpper]) return SPACING_RULES[typeUpper];
        const keys = Object.keys(SPACING_RULES);
        for (let i = 0; i < keys.length; i++) {
            if (typeUpper.indexOf(keys[i]) !== -1 || keys[i].indexOf(typeUpper) !== -1) {
                return SPACING_RULES[keys[i]];
            }
        }
        if (typeUpper.indexOf('VALVE') !== -1) return SPACING_RULES['VALVE'];
        if (typeUpper.indexOf('FLANGE') !== -1) return SPACING_RULES['FLANGE'];
        if (typeUpper.indexOf('REDUC') !== -1) return SPACING_RULES['REDUCER'];
        if (typeUpper.indexOf('ELBOW') !== -1) return SPACING_RULES['ELBOW'];
        if (typeUpper.indexOf('TEE') !== -1) return SPACING_RULES['TEE'];
        return SPACING_RULES['DEFAULT'];
    }

    function calculateAccessoryPositions(componentTypes, startPosition, totalLength, diameter) {
        const positions = [];
        let currentPos = startPosition;
        
        for (let i = 0; i < componentTypes.length; i++) {
            const compType = componentTypes[i];
            const rules = getSpacingRules(compType);
            let spaceBefore = rules.spaceBefore;
            
            if (diameter > 6) spaceBefore *= 1.5;
            if (diameter > 12) spaceBefore *= 2.0;
            
            if (i > 0) {
                const prevRules = getSpacingRules(componentTypes[i - 1]);
                if (prevRules.category === 'connection' && rules.category === 'inline') {
                    spaceBefore = Math.max(spaceBefore, 50);
                }
                if (prevRules.category === 'inline' && rules.category === 'inline') {
                    spaceBefore *= 1.5;
                }
            }
            
            const spaceParam = spaceBefore / totalLength;
            currentPos += spaceParam;
            
            if (currentPos > 0.99) {
                currentPos = 0.99;
            }
            
            positions.push({
                type: compType,
                position: currentPos,
                spaceBeforeMM: spaceBefore,
                category: rules.category
            });
        }
        
        return positions;
    }

    // ================================================================
    //  COMANDO INFO
    // ================================================================

    function parseInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        if (parts.length < 2) { notifyWithVoice("Uso: info line [TAG] | info equipment [TAG] | info component [TAG]", true); return true; }
        const type = parts[1].toLowerCase();
        const tag = parts[2];
        if (!tag) { notifyWithVoice("Especifique el tag del " + type, true); return true; }
        if (type === 'line' || type === 'línea' || type === 'linea') return infoLine(tag);
        if (type === 'equipment' || type === 'equipo') return infoEquipment(tag);
        if (type === 'component' || type === 'componente') return infoComponent(tag);
        notifyWithVoice("Tipo desconocido: " + type + ". Use line, equipment o component", true);
        return true;
    }

    function infoLine(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(tag);
        if (!line || !_core.getLines().includes(line)) { notifyWithVoice("Línea " + tag + " no encontrada", true); return true; }
        const pts = getPoints(line);
        const numPuntos = pts.length;
        let origen = "Ninguno", destino = "Ninguno";
        if (line.origin) {
            const obj = _core.findObjectByTag(line.origin.equipTag || line.origin.objTag);
            origen = (line.origin.equipTag || line.origin.objTag) + "." + line.origin.portId + " (" + (obj && obj.tipo ? obj.tipo : 'line') + ")";
        }
        if (line.destination) {
            const obj = _core.findObjectByTag(line.destination.equipTag || line.destination.objTag);
            destino = (line.destination.equipTag || line.destination.objTag) + "." + line.destination.portId + " (" + (obj && obj.tipo ? obj.tipo : 'line') + ")";
        }
        let totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
        
        let compInfo = '';
        if (line.components && line.components.length > 0) {
            const sorted = line.components.slice().sort(function(a, b) { return (a.param || 0) - (b.param || 0); });
            compInfo = '\n🔩 Componentes (' + sorted.length + '):';
            sorted.forEach(function(c) {
                compInfo += '\n   ' + (c.type || '?') + ' @' + (c.param ? c.param.toFixed(3) : '?') + ' [' + (c.tag || '') + ']';
            });
        }
        
        const msg = "📋 Línea " + tag + " | ⌀" + (line.diameter || '?') + "\" | " + (line.material || 'N/D') + " | Spec: " + (line.spec || 'N/D') + " | Puntos: " + numPuntos + " | Long: " + (totalLen/1000).toFixed(2) + "m | Componentes: " + (line.components ? line.components.length : 0) + " | Origen: " + origen + " | Destino: " + destino + compInfo;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoEquipment(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const eq = _core.findObjectByTag(tag);
        if (!eq || !_core.getEquipos().includes(eq)) { notifyWithVoice("Equipo " + tag + " no encontrado", true); return true; }
        
        const tipo = eq.tipo || 'Desconocido';
        const material = eq.material || 'N/D';
        const spec = eq.spec || 'N/D';
        const pos = getBasePosition(eq);
        const altura = eq.altura || 0;
        const diametro = eq.diametro || 0;
        
        const baseElevation = pos.y - (altura / 2);
        const topElevation = pos.y + (altura / 2);
        
        let msg = '═══════════════════════════════════\n';
        msg += '📋 ' + tag + ' — ' + getEquipmentTypeName(tipo) + '\n';
        msg += '═══════════════════════════════════\n\n';
        msg += '📐 DIMENSIONES:\n';
        if (diametro > 0) msg += '   Diámetro: ' + diametro.toFixed(0) + ' mm\n';
        if (altura > 0) msg += '   Altura: ' + altura.toFixed(0) + ' mm\n';
        msg += '\n📏 ELEVACIONES:\n';
        msg += '   Centro (posY): ' + pos.y.toFixed(0) + ' mm\n';
        msg += '   Base: EL ' + (baseElevation/1000 >= 0 ? '+' : '') + (baseElevation/1000).toFixed(3) + ' m\n';
        msg += '   Tope: EL ' + (topElevation/1000 >= 0 ? '+' : '') + (topElevation/1000).toFixed(3) + ' m\n\n';
        msg += '🔩 ESPECIFICACIONES:\n';
        msg += '   Material: ' + material + '\n';
        msg += '   Spec: ' + spec + '\n\n';
        msg += '🔌 PUERTOS:\n';
        if (eq.puertos && eq.puertos.length > 0) {
            eq.puertos.forEach(function(p) {
                const portElevation = pos.y + (p.relY || 0);
                const status = p.status === 'open' ? 'DISPONIBLE' : (p.connectedTo ? 'CONECTADO a ' + p.connectedTo.tag : 'CONECTADO');
                msg += '   ' + p.id + ': ⌀' + (p.diametro || '?') + '" | EL ' + (portElevation/1000 >= 0 ? '+' : '') + (portElevation/1000).toFixed(3) + 'm | ' + status + '\n';
            });
        } else {
            msg += '   Sin puertos definidos\n';
        }
        msg += '\n═══════════════════════════════════';
        notifyWithVoice(msg, false);
        return true;
    }

    function infoComponent(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        let foundComp = null, foundLine = null;
        const lines = _core.getLines();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.components) {
                const comp = line.components.find(function(c) { return c.tag === tag; });
                if (comp) { foundComp = comp; foundLine = line; break; }
            }
        }
        if (!foundComp) { notifyWithVoice("Componente " + tag + " no encontrado", true); return true; }
        const msg = "📋 Componente " + tag + " | Tipo: " + foundComp.type + " | Línea: " + foundLine.tag + " | Posición: " + (foundComp.param ? foundComp.param.toFixed(2) : 'N/D');
        notifyWithVoice(msg, false);
        return true;
    }

    // ================================================================
    //  COMANDO POINT / COORDENADAS
    // ================================================================

    function parsePoint(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'point' && parts[0] !== 'coordenadas') return false;
        try {
            let tag = null, subCommand = null, subId = null;
            if (parts.length >= 3 && parts[1] && parts[1].toLowerCase() === 'de') {
                tag = parts[2];
                if (parts.length >= 5) { subCommand = parts[3] ? parts[3].toLowerCase() : null; subId = parts[4]; }
            } else if (parts.length >= 2) {
                let ref = parts[1];
                const atIdx = ref.indexOf('@');
                if (atIdx > 0) {
                    tag = ref.substring(0, atIdx);
                    subId = ref.substring(atIdx + 1);
                    const numVal = parseFloat(subId);
                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 1) subCommand = 'param';
                    else if (subId.toUpperCase() === 'START' || subId === '0') { subCommand = 'punto'; subId = '0'; }
                    else if (subId.toUpperCase() === 'END' || subId === '1') { subCommand = 'punto'; subId = 'end'; }
                    else subCommand = 'puerto';
                } else if (ref.indexOf('.') > 0) {
                    tag = ref.substring(0, ref.indexOf('.'));
                    subId = ref.substring(ref.indexOf('.') + 1);
                    subCommand = 'puerto';
                } else { tag = ref; }
            } else { notifyWithVoice('Uso: coordenadas de TAG [puerto|punto ID]', true); return true; }
            if (!tag) { notifyWithVoice('❌ Tag no especificado', true); return true; }
            if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
            const obj = _core.findObjectByTag(tag);
            if (!obj) { notifyWithVoice('❌ "' + tag + '" no encontrado', true); return true; }
            const basePos = getBasePosition(obj);
            const isEq = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
            let response = '📍 ' + tag;
            if (!subCommand) {
                if (isEq) {
                    response += ' → (X=' + basePos.x.toFixed(0) + ', Y=' + basePos.y.toFixed(0) + ', Z=' + basePos.z.toFixed(0) + ')';
                    if (obj.diametro) response += ' | ⌀' + obj.diametro + 'mm';
                    if (obj.altura) response += ' | H=' + obj.altura + 'mm';
                }
                if (obj.puertos && obj.puertos.length) {
                    response += '\n🔌 Puertos:';
                    obj.puertos.forEach(function(p) {
                        const px = basePos.x + (p.relX || 0);
                        const py = basePos.y + (p.relY || 0);
                        const pz = basePos.z + (p.relZ || 0);
                        response += '\n  • ' + p.id + ' (' + px.toFixed(0) + ',' + py.toFixed(0) + ',' + pz.toFixed(0) + ') | ' + (p.diametro || '?') + '"';
                    });
                }
                const pts = getPoints(obj);
                if (pts.length > 0) {
                    response += '\n📏 ' + pts.length + ' puntos:';
                    pts.forEach(function(p, i) { response += '\n  P0' + i + ': (' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ',' + p.z.toFixed(0) + ')'; });
                    let len = 0;
                    for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
                    response += '\n📐 Long: ' + (len/1000).toFixed(2) + ' m';
                }
                notifyWithVoice(response, false);
                return true;
            }
            if (subCommand === 'puerto' && subId) {
                const puerto = obj.puertos && obj.puertos.find(function(p) { return p.id === subId || (p.id && p.id.toUpperCase() === subId.toUpperCase()); });
                if (!puerto) { notifyWithVoice('❌ Puerto "' + subId + '" no encontrado', true); return true; }
                const px = basePos.x + (puerto.relX || 0), py = basePos.y + (puerto.relY || 0), pz = basePos.z + (puerto.relZ || 0);
                response += ' → ' + puerto.id + ' (' + px.toFixed(0) + ',' + py.toFixed(0) + ',' + pz.toFixed(0) + ') | ' + (puerto.diametro || '?') + '" | ' + (puerto.status || 'open');
                notifyWithVoice(response, false);
                return true;
            }
            if (subCommand === 'punto' && subId !== undefined) {
                const pts = getPoints(obj);
                if (!pts.length) { notifyWithVoice('⚠️ ' + tag + ' sin geometría', true); return true; }
                const idx = subId === 'end' ? pts.length - 1 : parseInt(subId);
                if (isNaN(idx) || idx < 0 || idx >= pts.length) { notifyWithVoice('❌ Índice inválido (0-' + (pts.length-1) + ')', true); return true; }
                response += ' → P' + idx + ': (' + pts[idx].x.toFixed(0) + ',' + pts[idx].y.toFixed(0) + ',' + pts[idx].z.toFixed(0) + ')';
                notifyWithVoice(response, false);
                return true;
            }
            if (subCommand === 'param' && subId !== undefined) {
                const coords = calcularPuntoParametrico(obj, parseFloat(subId));
                if (!coords) { notifyWithVoice('⚠️ ' + tag + ' sin geometría', true); return true; }
                response += ' @' + subId + ': (' + coords.x.toFixed(0) + ',' + coords.y.toFixed(0) + ',' + coords.z.toFixed(0) + ')';
                notifyWithVoice(response, false);
                return true;
            }
            notifyWithVoice('Comando no reconocido', true);
            return true;
        } catch (e) { notifyWithVoice('❌ Error: ' + e.message, true); return true; }
    }

    // ================================================================
    //  COMANDO NODES / NODOS
    // ================================================================

    function parseNodes(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'nodes' && parts[0] !== 'nodos') return false;
        if (parts.length < 2) { notifyWithVoice('Uso: nodos TAG | nodos TAG free', true); return true; }
        const tag = parts[1];
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice('❌ "' + tag + '" no encontrado', true); return true; }
        
        const isEquipment = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
        
        let msg = '═══════════════════════════════════\n';
        msg += '🔌 NODOS DE ' + tag + '\n';
        msg += '═══════════════════════════════════\n';
        
        if (isEquipment) {
            msg += 'Tipo: EQUIPO | Puertos: ' + (obj.puertos ? obj.puertos.length : 0) + '\n\n';
            let freeCount = 0, totalCount = 0;
            if (obj.puertos && obj.puertos.length > 0) {
                obj.puertos.forEach(function(p) {
                    totalCount++;
                    const isFree = !p.connectedTo || p.status === 'open';
                    if (isFree) freeCount++;
                    const icon = isFree ? '🟢' : '🔴';
                    const posX = (obj.posX || 0) + (p.relX || 0);
                    const posY = (obj.posY || 0) + (p.relY || 0);
                    const posZ = (obj.posZ || 0) + (p.relZ || 0);
                    const fullName = tag + '.' + p.id;
                    msg += icon + ' ' + fullName + ': ⌀' + (p.diametro || '?') + '" | (' + 
                           posX.toFixed(0) + ', ' + posY.toFixed(0) + ', ' + posZ.toFixed(0) + ')';
                    if (isFree) { msg += ' → DISPONIBLE'; }
                    else if (p.connectedTo) { msg += ' → ' + (p.connectedTo.tag || 'Conectado'); }
                    msg += '\n';
                });
            } else { msg += '⚠️ Sin puertos definidos\n'; }
            msg += '\n📊 Total: ' + totalCount + ' | 🟢 ' + freeCount + ' libres | 🔴 ' + (totalCount - freeCount) + ' conectados';
        } else {
            const pts = getPoints(obj);
            if (pts.length < 2) { msg += '⚠️ Línea sin geometría\n'; }
            else {
                let totalLen = 0, lengths = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                    lengths.push(d); totalLen += d;
                }
                msg += 'Tipo: LÍNEA | Long: ' + (totalLen/1000).toFixed(2) + ' m | Componentes: ' + (obj.components ? obj.components.length : 0) + '\n\n';
                let freeCount = 0, totalCount = 0;
                
                totalCount++;
                const p0 = obj.puertos ? obj.puertos.find(function(p) { return p.id === '0'; }) : null;
                const isFree0 = p0 ? (p0.status === 'open') : false;
                if (isFree0) freeCount++;
                const icon0 = isFree0 ? '🟢' : '🔴';
                msg += icon0 + ' ' + tag + '.0 (START): (' + pts[0].x.toFixed(0) + ', ' + pts[0].y.toFixed(0) + ', ' + pts[0].z.toFixed(0) + ')';
                if (isFree0) { msg += ' → DISPONIBLE'; }
                else if (obj.origin) { msg += ' → ' + (obj.origin.equipTag || '?') + ':' + (obj.origin.portId || '?'); }
                msg += '\n';
                
                if (obj.components && obj.components.length > 0) {
                    const sortedComps = obj.components.slice().sort(function(a, b) { return (a.param || 0) - (b.param || 0); });
                    sortedComps.forEach(function(comp) {
                        const compType = (comp.type || '').toUpperCase();
                        const generaPuertos = compType.indexOf('TEE') !== -1 || compType.indexOf('CROSS') !== -1;
                        if (generaPuertos && obj.puertos) {
                            obj.puertos.forEach(function(p) {
                                if (p.id === '0' || p.id === '1') return;
                                if (p.id.indexOf('S1') !== -1 || p.id.indexOf('S2') !== -1) return;
                                totalCount++;
                                const isFree = !p.connectedTo || p.status === 'open';
                                if (isFree) freeCount++;
                                const icon = isFree ? '🟢' : '🔴';
                                const param = comp.param || 0.5;
                                const targetLen = totalLen * param;
                                let accum = 0, segIdx = 0, t = 0;
                                for (let j = 0; j < lengths.length; j++) {
                                    if (accum + lengths[j] >= targetLen || j === lengths.length - 1) { segIdx = j; t = (targetLen - accum) / (lengths[j] || 1); break; }
                                    accum += lengths[j];
                                }
                                const pA = pts[segIdx], pB = pts[segIdx + 1];
                                const portPoint = {
                                    x: pA.x + (pB.x - pA.x) * t + (p.relX || 0),
                                    y: pA.y + (pB.y - pA.y) * t + (p.relY || 0),
                                    z: pA.z + (pB.z - pA.z) * t + (p.relZ || 0)
                                };
                                const fullName = tag + '.' + p.id;
                                msg += icon + ' ' + fullName + ' @' + (comp.param ? comp.param.toFixed(3) : '?') + 
                                       ' | (' + portPoint.x.toFixed(0) + ', ' + portPoint.y.toFixed(0) + ', ' + portPoint.z.toFixed(0) + ')';
                                if (isFree) { msg += ' → DISPONIBLE'; if (p.diametro) msg += ' | ⌀' + p.diametro + '"'; }
                                else if (p.connectedTo) { msg += ' → ' + (p.connectedTo.tag || 'Conectado'); }
                                msg += '\n';
                            });
                        }
                    });
                }
                
                totalCount++;
                const p1 = obj.puertos ? obj.puertos.find(function(p) { return p.id === '1'; }) : null;
                const isFree1 = p1 ? (p1.status === 'open') : false;
                if (isFree1) freeCount++;
                const lastIdx = pts.length - 1;
                const icon1 = isFree1 ? '🟢' : '🔴';
                msg += icon1 + ' ' + tag + '.1 (END): (' + pts[lastIdx].x.toFixed(0) + ', ' + pts[lastIdx].y.toFixed(0) + ', ' + pts[lastIdx].z.toFixed(0) + ')';
                if (isFree1) { msg += ' → DISPONIBLE'; }
                else if (obj.destination) { msg += ' → ' + (obj.destination.equipTag || '?') + ':' + (obj.destination.portId || '?'); }
                msg += '\n';
                msg += '\n📊 Total: ' + totalCount + ' | 🟢 ' + freeCount + ' libres | 🔴 ' + (totalCount - freeCount) + ' conectados';
            }
        }
        msg += '\n═══════════════════════════════════';
        notifyWithVoice(msg, false);
        return true;
    }

    // ================================================================
    //  COMANDO NODOS ABIERTOS
    // ================================================================

    function parseNodosAbiertos(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'nodos' && parts[0] !== 'nodes') return false;
        if (parts[1] !== 'abiertos' && parts[1] !== 'open' && parts[1] !== 'libres') return false;
        
        let tag;
        if (parts[2] === 'de') { tag = parts[3]; }
        else { tag = parts[2]; }
        
        if (!tag) { notifyWithVoice("Uso: nodos abiertos [TAG] | nodos abiertos de [TAG]", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice('❌ "' + tag + '" no encontrado', true); return true; }
        
        const isEquipment = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
        let msg = '═══════════════════════════════════\n';
        msg += '🟢 NODOS ABIERTOS DE ' + tag + '\n';
        msg += '═══════════════════════════════════\n';
        let openCount = 0;
        
        if (isEquipment) {
            if (obj.puertos && obj.puertos.length > 0) {
                obj.puertos.forEach(function(p) {
                    const isOpen = !p.connectedTo || p.status === 'open';
                    if (isOpen) {
                        openCount++;
                        const posX = (obj.posX || 0) + (p.relX || 0);
                        const posY = (obj.posY || 0) + (p.relY || 0);
                        const posZ = (obj.posZ || 0) + (p.relZ || 0);
                        const fullName = tag + '.' + p.id;
                        msg += '• ' + fullName + ': ⌀' + (p.diametro || '?') + '" | (' + 
                               posX.toFixed(0) + ', ' + posY.toFixed(0) + ', ' + posZ.toFixed(0) + ')';
                        if (p.orientacion) {
                            msg += ' | Dir: (' + (p.orientacion.dx || 0).toFixed(1) + ', ' + 
                                   (p.orientacion.dy || 0).toFixed(1) + ', ' + (p.orientacion.dz || 0).toFixed(1) + ')';
                        }
                        msg += '\n';
                    }
                });
            }
        } else {
            const pts = getPoints(obj);
            if (pts.length < 2) { msg += '⚠️ Línea sin geometría\n'; }
            else {
                let totalLen = 0, lengths = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                    lengths.push(d); totalLen += d;
                }
                
                const p0 = obj.puertos ? obj.puertos.find(function(p) { return p.id === '0'; }) : null;
                if (p0 && p0.status === 'open') {
                    openCount++;
                    msg += '• ' + tag + '.0 (START): (' + pts[0].x.toFixed(0) + ', ' + pts[0].y.toFixed(0) + ', ' + pts[0].z.toFixed(0) + ')';
                    if (p0.diametro) msg += ' | ⌀' + p0.diametro + '"';
                    msg += '\n';
                }
                
                if (obj.components && obj.puertos) {
                    obj.puertos.forEach(function(p) {
                        if (p.id === '0' || p.id === '1') return;
                        if (p.id.indexOf('S1') !== -1 || p.id.indexOf('S2') !== -1) return;
                        const isOpen = !p.connectedTo || p.status === 'open';
                        if (isOpen) {
                            openCount++;
                            let compParam = 0.5;
                            if (obj.components) {
                                for (let c = 0; c < obj.components.length; c++) {
                                    if (p.id.indexOf(obj.components[c].tag) !== -1) { compParam = obj.components[c].param || 0.5; break; }
                                }
                            }
                            const targetLen = totalLen * compParam;
                            let accum = 0, segIdx = 0, t = 0;
                            for (let j = 0; j < lengths.length; j++) {
                                if (accum + lengths[j] >= targetLen || j === lengths.length - 1) { segIdx = j; t = (targetLen - accum) / (lengths[j] || 1); break; }
                                accum += lengths[j];
                            }
                            const pA = pts[segIdx], pB = pts[segIdx + 1];
                            const portPoint = {
                                x: pA.x + (pB.x - pA.x) * t + (p.relX || 0),
                                y: pA.y + (pB.y - pA.y) * t + (p.relY || 0),
                                z: pA.z + (pB.z - pA.z) * t + (p.relZ || 0)
                            };
                            const fullName = tag + '.' + p.id;
                            msg += '• ' + fullName + ' @' + compParam.toFixed(3) + ': (' + portPoint.x.toFixed(0) + ', ' + portPoint.y.toFixed(0) + ', ' + portPoint.z.toFixed(0) + ')';
                            if (p.diametro) msg += ' | ⌀' + p.diametro + '"';
                            msg += '\n';
                        }
                    });
                }
                
                const p1 = obj.puertos ? obj.puertos.find(function(p) { return p.id === '1'; }) : null;
                if (p1 && p1.status === 'open') {
                    openCount++;
                    const lastIdx = pts.length - 1;
                    msg += '• ' + tag + '.1 (END): (' + pts[lastIdx].x.toFixed(0) + ', ' + pts[lastIdx].y.toFixed(0) + ', ' + pts[lastIdx].z.toFixed(0) + ')';
                    if (p1.diametro) msg += ' | ⌀' + p1.diametro + '"';
                    msg += '\n';
                }
            }
        }
        
        if (openCount === 0) { msg += '⚠️ No hay nodos disponibles. Todos están conectados.\n'; }
        msg += '\n📊 ' + openCount + ' nodo(s) disponible(s)';
        msg += '\n═══════════════════════════════════';
        msg += '\n💡 Copia el nombre completo (ej: L-1.TEE_xyz_P3) para usar en:\n   connect L-1.TEE_xyz_P3 to EQUIPO PUERTO';
        notifyWithVoice(msg, false);
        return true;
    }

    // ================================================================
    //  COMANDO LISTAR
    // ================================================================

    function listEquipos() { 
        const eqs = _core.getDb().equipos; 
        notifyWithVoice(eqs.length ? '📦 Equipos (' + eqs.length + '): ' + eqs.map(function(e) { return e.tag; }).join(', ') : 'No hay equipos'); 
    }
    
    function listLineas() { 
        const ls = _core.getDb().lines; 
        notifyWithVoice(ls.length ? '📏 Líneas (' + ls.length + '): ' + ls.map(function(l) { return l.tag + '(' + (l.diameter || '?') + '" ' + (l.material || '?') + ')'; }).join(', ') : 'No hay líneas'); 
    }
    
    function parseList(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' && parts[0] !== 'listar') return false;
        const sub = parts[1] ? parts[1].toLowerCase() : null;
        if (sub === 'equipos') { listEquipos(); return true; }
        if (sub === 'lineas' || sub === 'líneas') { listLineas(); return true; }
        if (sub === 'componentes') { 
            const types = _catalog ? _catalog.listComponentTypes() : []; 
            notifyWithVoice('🔩 Componentes: ' + types.sort().join(', '), false); 
            return true; 
        }
        if (sub === 'especificaciones') { 
            const specs = _catalog ? _catalog.listSpecs() : []; 
            notifyWithVoice('📋 Especificaciones: ' + specs.sort().join(', '), false); 
            return true; 
        }
        notifyWithVoice('Use: listar equipos | listar lineas | listar componentes | listar especificaciones');
        return true;
    }

    // ================================================================
    //  COMANDO MEASURE / DISTANCIA
    // ================================================================

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
        if (tag1 && tag1.indexOf(':') > 0) { var sp = tag1.split(':'); tag1 = sp[0]; port1 = sp[1]; }
        if (tag2 && tag2.indexOf(':') > 0) { var sp = tag2.split(':'); tag2 = sp[0]; port2 = sp[1]; }
        const obj1 = _core.findObjectByTag(tag1);
        const obj2 = _core.findObjectByTag(tag2);
        if (!obj1 || !obj2) { notifyWithVoice("Objeto(s) no encontrado(s)", true); return true; }
        const pos1 = port1 ? getPortPosition(tag1, port1) : getBasePosition(obj1);
        const pos2 = port2 ? getPortPosition(tag2, port2) : getBasePosition(obj2);
        const dx = pos2.x - pos1.x, dy = pos2.y - pos1.y, dz = pos2.z - pos1.z;
        const dist = Math.hypot(dx, dy, dz);
        const distH = Math.hypot(dx, dz);
        let msg = '📏 Distancia ' + tag1;
        if (port1) msg += ':' + port1;
        msg += ' → ' + tag2;
        if (port2) msg += ':' + port2;
        msg += ':\n  3D: ' + (dist/1000).toFixed(3) + ' m (' + dist.toFixed(0) + ' mm)\n  Horizontal: ' + (distH/1000).toFixed(3) + ' m\n  ΔX: ' + dx.toFixed(0) + ' mm | ΔY: ' + dy.toFixed(0) + ' mm | ΔZ: ' + dz.toFixed(0) + ' mm';
        notifyWithVoice(msg, false);
        return true;
    }

    // ================================================================
    //  COMANDO PLACE
    // ================================================================
    
    function parsePlace(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'place' && parts[0] !== 'apoyar' && parts[0] !== 'posar' && parts[0] !== 'poner' && parts[0] !== 'colocar') return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice('Uso: place EQUIPO on SUPERFICIE | place EQUIPO on ground | place EQUIPO on suelo', true); return true; }
        const onIdx = parts.indexOf('on') !== -1 ? parts.indexOf('on') : parts.indexOf('sobre');
        if (onIdx === -1 || onIdx + 1 >= parts.length) { notifyWithVoice('Uso: place EQUIPO on SUPERFICIE | place EQUIPO on ground', true); return true; }
        let superficieTag = parts[onIdx + 1];
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const equipo = _core.findObjectByTag(tag);
        if (!equipo) { notifyWithVoice('❌ Equipo "' + tag + '" no encontrado', true); return true; }
        let superficieY = 0;
        let superficieNombre = 'suelo (EL ±0.000m)';
        if (superficieTag && superficieTag.toLowerCase() !== 'ground' && superficieTag.toLowerCase() !== 'suelo') {
            const superficie = _core.findObjectByTag(superficieTag);
            if (!superficie) { notifyWithVoice('❌ Superficie "' + superficieTag + '" no encontrada', true); return true; }
            const alturaSuperficie = superficie.altura || 0;
            superficieY = (superficie.posY || 0) + (alturaSuperficie / 2);
            superficieNombre = superficieTag + ' (EL ' + (superficieY/1000 >= 0 ? '+' : '') + (superficieY/1000).toFixed(3) + 'm)';
        }
        const alturaEquipo = equipo.altura || 0;
        const nuevoPosY = superficieY + (alturaEquipo / 2);
        saveStateBeforeMutation();
        if (equipo.posX !== undefined) {
            _core.updateEquipment(tag, { posY: nuevoPosY, elevacion: superficieY });
        } else {
            const pts = getPoints(equipo);
            if (pts.length > 0) {
                const dy = nuevoPosY - (equipo.posY || pts[0].y || 0);
                const newPts = pts.map(function(p) { return { x: p.x, y: p.y + dy, z: p.z }; });
                _core.updateLine(tag, { _cachedPoints: newPts });
            }
        }
        _core.syncPhysicalData();
        if (_renderUI) _renderUI();
        const baseElev = nuevoPosY - (alturaEquipo / 2);
        notifyWithVoice('✅ ' + tag + ' apoyado sobre ' + superficieNombre + '\n   Centro Y=' + nuevoPosY.toFixed(0) + 'mm | Base EL ' + (baseElev/1000 >= 0 ? '+' : '') + (baseElev/1000).toFixed(3) + 'm', false);
        return true;
    }

    // ================================================================
    //  COMANDO CREATE EQUIPO
    // ================================================================

    function parseCreate(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create') return false;
        const tipo = parts[1]; const tag = parts[2];
        if (!tipo || !tag || parts[3] !== 'at') return false;
        let coordStr = '';
        for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const coords = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        const x = parseFloat(coords[1]), y = parseFloat(coords[2]), z = parseFloat(coords[3]);
        const namedParams = extractNamedParams(parts, 5);
        let params = {};
        if (namedParams.diameter) params.diametro = namedParams.diameter;
        if (namedParams.material) params.material = namedParams.material;
        if (namedParams.spec) params.spec = namedParams.spec;
        if (namedParams.type) params.tipo = namedParams.type;
        for (let i = 5; i < parts.length; i++) {
            let key = parts[i];
            if (key === 'diam' || key === 'diametro') { if (params.diametro === undefined) params.diametro = parseFloat(parts[++i]); else i++; }
            else if (key === 'height' || key === 'altura') params.altura = parseFloat(parts[++i]);
            else if (key === 'largo') params.largo = parseFloat(parts[++i]);
            else if (key === 'ancho') params.ancho = parseFloat(parts[++i]);
            else if (key === 'diametro_succion' || key === 'succion') params.diametro_succion = parseFloat(parts[++i]);
            else if (key === 'diametro_descarga' || key === 'descarga') params.diametro_descarga = parseFloat(parts[++i]);
            else if (key === 'diametro_entrada' || key === 'entrada') params.diametro_entrada = parseFloat(parts[++i]);
            else if (key === 'diametro_salida' || key === 'salida') params.diametro_salida = parseFloat(parts[++i]);
            else if (key === 'altura_salida_desde_base' || key === 'altura_salida') params.altura_salida_desde_base = parseFloat(parts[++i]);
            else if (key === 'material') { if (params.material === undefined) params.material = parts[++i].toUpperCase(); else i++; }
            else if (key === 'spec') { if (params.spec === undefined) params.spec = parts[++i]; else i++; }
            else if (key === 'baranda') { var v = parts[++i]; params.baranda = v === 'true' || v === 'si' || v === 'yes'; }
            else if (key === 'escalera') { var v = parts[++i]; params.escalera = v === 'true' || v === 'si' || v === 'yes'; }
        }
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) { notifyWithVoice("Tipo de equipo desconocido: " + tipo, true); return true; }
        if (_core && _core.findObjectByTag(tag)) { notifyWithVoice("❌ Error: El tag " + tag + " ya existe", true); return true; }
        const equipo = _catalog.createEquipment(tipo, tag, x, y, z, params);
        if (equipo) { _core.addEquipment(equipo); if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: equipo }); notifyWithVoice("✅ Equipo " + tag + " (" + (equipoDef.nombre || tipo) + ") creado en (" + x + "," + y + "," + z + ")", false); }
        return true;
    }

    // ================================================================
    //  COMANDO CREATE LINE
    // ================================================================

    function parseCreateLine(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'line') return false;
        const tag = parts[2];
        if (!tag) { notifyWithVoice("Error: Tag de línea requerido", true); return true; }
        if (_core && _core.findObjectByTag(tag)) { notifyWithVoice("❌ Error: El tag " + tag + " ya existe", true); return true; }
        const namedParams = extractNamedParams(parts, 3);
        const resolved = resolveMaterialAndSpec(namedParams, [], null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || 4;
        let material = resolved.material;
        let spec = resolved.spec;
        let points = [];
        let i = 3;
        while (i < parts.length) {
            if (parts[i] === 'route' || parts[i] === 'ruta') {
                i++;
                while (i < parts.length) {
                    const coordStr = parts[i];
                    const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                    if (m) { points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) }); i++; }
                    else { const lower = (parts[i] || '').toLowerCase(); if (['material', 'spec', 'diameter', 'diametro'].indexOf(lower) !== -1) { i += 2; } else { i++; } }
                }
                break;
            }
            i++;
        }
        if (points.length < 2) { notifyWithVoice("Error: Se requieren al menos 2 puntos para la ruta", true); return true; }
        const nuevaLinea = { tag: tag, diameter: diameter, material: material, spec: spec, _cachedPoints: points, waypoints: points.slice(1, -1), components: [] };
        _core.addLine(nuevaLinea);
        const db = _core.getDb();
        const lineaRegistrada = db.lines.find(function(l) { return l.tag === tag; }) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, null, null, null, null, diameter, material, spec);
        if (_core.updateLine) { _core.updateLine(tag, lineaRegistrada); }
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        notifyWithVoice("✅ Línea " + tag + " creada: " + material + " " + diameter + "\" " + spec + (fittingInfo.message || ''), false);
        return true;
    }

    // ================================================================
    //  COMANDO CONNECT
    // ================================================================

    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        const fromEquip = parts[1], fromNozzle = parts[2];
        if (parts[3] !== 'to' && parts[3] !== 'a') return false;
        const toEquip = parts[4];
        const viaIdx = parts.indexOf('via');
        let waypoints = [];
        if (viaIdx !== -1) {
            const endKeywords = ['to', 'a', 'diameter', 'diametro', 'material', 'spec', 'orient', 'direccion', 'branchup', 'branchdown', 'branchnorth', 'branchsouth', 'brancheast', 'branchwest', 'up', 'down', 'north', 'south', 'east', 'west'];
            let endIdx = parts.length;
            for (let i = viaIdx + 1; i < parts.length; i++) { if (endKeywords.includes(parts[i].toLowerCase())) { endIdx = i; break; } }
            waypoints = extractWaypoints(parts, viaIdx + 1, endIdx);
        }
        let toNozzleRaw = parts[5];
        const knownKeywords = ['material', 'spec', 'diameter', 'diametro', 'type', 'tipo', 'orient', 'direccion', 'via'];
        if (toNozzleRaw && knownKeywords.indexOf(toNozzleRaw.toLowerCase()) !== -1) { toNozzleRaw = null; }
        if (toNozzleRaw && toNozzleRaw.startsWith('(')) { toNozzleRaw = null; }
        let branchOrientation = extractOrientation(parts);
        if (!branchOrientation) { branchOrientation = extractBranchOrientation(parts, 5); }
        let paramsStartIndex = 5;
        if (toNozzleRaw) paramsStartIndex = 6;
        if (viaIdx !== -1 && viaIdx >= paramsStartIndex) {
            paramsStartIndex = viaIdx;
            let skipCount = 1;
            for (let i = viaIdx + 1; i < parts.length; i++) { if (parts[i].startsWith('(')) skipCount++; else break; }
            paramsStartIndex += skipCount;
        }
        const namedParams = extractNamedParams(parts, paramsStartIndex);
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip);
        const toObj = _core.findObjectByTag(toEquip);
        if (!fromObj || !toObj) { notifyWithVoice("Objeto no encontrado", true); return true; }
        const resolved = resolveMaterialAndSpec(namedParams, [fromObj, toObj], null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || 4;
        let material = resolved.material;
        let spec = resolved.spec;
        for (let i = paramsStartIndex; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        const numPosFrom = parseFloat(fromNozzle);
        const isNumericFrom = !isNaN(numPosFrom) && isFinite(numPosFrom) && numPosFrom >= 0 && numPosFrom <= 1;
        const isFromLine = _core.getLinePoints(fromObj) ? true : false;
        const isToLine = _core.getLinePoints(toObj) ? true : false;
        const db = _core.getDb();
        let startPos = null, fromDiameter = 4;
        let effectiveFromNozzle = fromNozzle;
        if (isFromLine && isNumericFrom && numPosFrom > 0.01 && numPosFrom < 0.99) {
            const pts = _core.getLinePoints(fromObj);
            if (!pts || pts.length < 2) { notifyWithVoice("La línea origen no tiene geometría válida", true); return true; }
            let totalLen = 0, lengths = [];
            for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z); lengths.push(d); totalLen += d; }
            const targetLen = totalLen * numPosFrom;
            let accum = 0, segIdx = 0, t = 0;
            for (let i = 0; i < lengths.length; i++) { if (accum + lengths[i] >= targetLen || i === lengths.length - 1) { segIdx = i; t = (targetLen - accum) / (lengths[i] || 1); break; } accum += lengths[i]; }
            const pA = pts[segIdx], pB = pts[segIdx + 1];
            startPos = { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t };
            fromDiameter = fromObj.diameter || 4;
        } else if (_core.getLinePoints(fromObj) && (fromNozzle === '0' || fromNozzle === '1')) {
            const pts = _core.getLinePoints(fromObj);
            if (pts && pts.length >= 2) { startPos = fromNozzle === '0' ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: pts[pts.length - 1].z }; fromDiameter = fromObj.diameter || 4; }
        } else {
            const nzFrom = fromObj.puertos && fromObj.puertos.find(function(n) { return n.id === fromNozzle; });
            if (!nzFrom) { notifyWithVoice("Puerto origen '" + fromNozzle + "' no encontrado", true); return true; }
            fromDiameter = nzFrom.diametro || 4;
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) { startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle); }
            else { const basePos = getBasePosition(fromObj); startPos = { x: basePos.x + (nzFrom.relX || 0), y: basePos.y + (nzFrom.relY || 0), z: basePos.z + (nzFrom.relZ || 0) }; }
        }
        if (!startPos) { notifyWithVoice("No se pudo obtener la posición del puerto origen", true); return true; }
        let endPos = null, nuevoPuertoId = toNozzleRaw;
        let nzTo = null;
        let destBranchDirection = null;
        if (isToLine && (!toNozzleRaw || toNozzleRaw === '')) {
            const pts = _core.getLinePoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("La línea destino no tiene geometría", true); return true; }
            let minDist = Infinity, bestPoint = pts[0];
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i+1];
                const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
                const ap = { x: startPos.x - a.x, y: startPos.y - a.y, z: startPos.z - a.z };
                const len2 = ab.x*ab.x + ab.y*ab.y + ab.z*ab.z;
                let t2 = len2 !== 0 ? Math.max(0, Math.min(1, (ap.x*ab.x + ap.y*ab.y + ap.z*ab.z) / len2)) : 0;
                const proj = { x: a.x + ab.x * t2, y: a.y + ab.y * t2, z: a.z + ab.z * t2 };
                const dist = Math.hypot(startPos.x - proj.x, startPos.y - proj.y, startPos.z - proj.z);
                if (dist < minDist) { minDist = dist; bestPoint = proj; }
            }
            endPos = bestPoint;
            destBranchDirection = calculateBranchDirection(endPos, startPos);
        } else if (isToLine && isParametricPortId(toNozzleRaw)) {
            const pts = _core.getLinePoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("Geometría inválida", true); return true; }
            const paramValue = parseFloat(toNozzleRaw);
            endPos = getPointAtParam(pts, paramValue);
            if (!endPos) { notifyWithVoice("No se pudo calcular punto en posición " + toNozzleRaw, true); return true; }
            destBranchDirection = calculateBranchDirection(endPos, startPos);
        } else if (isToLine && (toNozzleRaw === '0' || toNozzleRaw === '1')) {
            const pts = _core.getLinePoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("La línea destino no tiene geometría", true); return true; }
            endPos = toNozzleRaw === '0' ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: pts[pts.length - 1].z };
        } else {
            if (!toObj.puertos) toObj.puertos = [];
            nzTo = toObj.puertos && toObj.puertos.find(function(n) { return n.id === toNozzleRaw; });
            if (!nzTo) { notifyWithVoice("Puerto destino '" + toNozzleRaw + "' no encontrado", true); return true; }
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) { endPos = SmartFlowRouter.getPortPosition(toObj, toNozzleRaw); }
            else { const basePos = getBasePosition(toObj); endPos = { x: basePos.x + (nzTo.relX || 0), y: basePos.y + (nzTo.relY || 0), z: basePos.z + (nzTo.relZ || 0) }; }
        }
        if (!endPos) { notifyWithVoice("No se pudo determinar el punto de destino", true); return true; }
        let originBranchDirection = null;
        if (isFromLine && isNumericFrom && numPosFrom > 0.01 && numPosFrom < 0.99) {
            if (branchOrientation) { originBranchDirection = branchOrientation; const oLen = Math.hypot(originBranchDirection.dx, originBranchDirection.dy, originBranchDirection.dz); if (oLen > 0) { originBranchDirection.dx /= oLen; originBranchDirection.dy /= oLen; originBranchDirection.dz /= oLen; } }
            else { originBranchDirection = calculateBranchDirection(startPos, endPos, waypoints); }
        }
        if (isFromLine && isNumericFrom && numPosFrom > 0.01 && numPosFrom < 0.99) {
            if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.insertarAccesorioEnLinea === 'function') {
                const nuevoPuertoId = SmartFlowRouter.insertarAccesorioEnLinea(fromEquip, startPos, diameter, true, originBranchDirection);
                if (nuevoPuertoId) { effectiveFromNozzle = nuevoPuertoId; } else { notifyWithVoice("No se pudo insertar TEE en la línea origen", true); return true; }
            }
        }
        if (isToLine && (isParametricPortId(toNozzleRaw) || !toNozzleRaw || toNozzleRaw === '')) {
            if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.insertarAccesorioEnLinea === 'function') {
                const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, endPos, diameter, true, destBranchDirection);
                if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio automáticamente", true); return true; }
                nuevoPuertoId = puertoId;
            }
        }
        let newTag;
        let counter = 1;
        const existingTags = new Set(db.lines.map(function(l) { return l.tag; }));
        do { newTag = 'L-' + counter; counter++; } while (existingTags.has(newTag) && counter < 10000);
        let linePoints = [startPos];
        if (waypoints.length > 0) { for (let w = 0; w < waypoints.length; w++) { linePoints.push(waypoints[w]); } }
        linePoints.push(endPos);
        const nuevaLinea = {
            tag: newTag, diameter: diameter, material: material, spec: spec,
            origin: { objType: isFromLine ? 'line' : 'equipment', equipTag: fromEquip, portId: effectiveFromNozzle },
            destination: { objType: isToLine ? 'line' : 'equipment', equipTag: toEquip, portId: nuevoPuertoId },
            waypoints: linePoints.slice(1, -1), _cachedPoints: linePoints.slice(), components: [],
            fittingInsertedAtOrigin: isFromLine && isNumericFrom && numPosFrom > 0.01 && numPosFrom < 0.99,
            fittingInsertedAtDestination: !isToLine
        };
        _core.addLine(nuevaLinea);
        const lineaRegistrada = _core.getDb().lines.find(function(l) { return l.tag === newTag; }) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, fromObj, effectiveFromNozzle, toObj, nuevoPuertoId, diameter, material, spec);
        if (_core.updateLine) { _core.updateLine(newTag, lineaRegistrada); }
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        const nzFrom = fromObj.puertos && fromObj.puertos.find(function(n) { return n.id === effectiveFromNozzle; });
        if (nzFrom) nzFrom.connectedLine = newTag;
        if (nzTo) nzTo.connectedLine = newTag;
        const matWarnings = checkMaterialCompatibility(material, fromObj, toObj);
        const viaMsg = waypoints.length > 0 ? " vía " + waypoints.length + " waypoint(s)" : "";
        const orientMsg = branchOrientation ? " [orientación manual]" : " [orientación auto]";
        notifyWithVoice("✅ Conectado " + fromEquip + "." + effectiveFromNozzle + " a " + toEquip + "." + nuevoPuertoId + " | " + material + " " + diameter + "\" " + spec + viaMsg + orientMsg + (fittingInfo.message || '') + (matWarnings.length > 0 ? '\n' + matWarnings.join('\n') : ''), matWarnings.length > 0);
        return true;
    }

    // ================================================================
    //  COMANDO ROUTE
    // ================================================================

    function parseRoute(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'route' && parts[0] !== 'ruta') return false;
        let fromIdx = -1, toIdx = -1, viaIdx = -1;
        for (let i = 1; i < parts.length; i++) {
            const w = parts[i].toLowerCase();
            if ((w === 'from' || w === 'desde') && fromIdx === -1) fromIdx = i;
            if ((w === 'to' || w === 'a' || w === 'hasta') && toIdx === -1) toIdx = i;
            if (w === 'via' && viaIdx === -1) viaIdx = i;
        }
        if (fromIdx === -1 || toIdx === -1) { notifyWithVoice("Uso: route from [origen] [puerto] [via (x,y,z)...] to [destino] [puerto] [diameter X] [material X]", true); return true; }
        const fromEquip = parts[fromIdx + 1], fromNozzle = parts[fromIdx + 2], toEquip = parts[toIdx + 1];
        if (!fromEquip || !fromNozzle || !toEquip) { notifyWithVoice("❌ Faltan parámetros", true); return true; }
        let waypoints = [], toNozzle = null, paramsStartIdx;
        if (viaIdx !== -1 && viaIdx < toIdx) { waypoints = extractWaypoints(parts, viaIdx + 1, toIdx); paramsStartIdx = toIdx + 2; }
        else { paramsStartIdx = toIdx + 2; }
        if (paramsStartIdx < parts.length && ['material', 'spec', 'diameter', 'diametro', 'orient', 'direccion'].indexOf((parts[paramsStartIdx] || '').toLowerCase()) === -1) { toNozzle = parts[paramsStartIdx]; paramsStartIdx++; }
        const namedParams = extractNamedParams(parts, paramsStartIdx);
        const fromObj = _core ? _core.findObjectByTag(fromEquip) : null;
        const toObj = _core ? _core.findObjectByTag(toEquip) : null;
        const resolved = resolveMaterialAndSpec(namedParams, [fromObj, toObj].filter(Boolean), null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || 3, material = resolved.material, spec = resolved.spec;
        for (let i = paramsStartIdx; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            if (waypoints.length > 0 && typeof SmartFlowRouter.routeWithWaypoints === 'function') { SmartFlowRouter.routeWithWaypoints(fromEquip, fromNozzle, toEquip, toNozzle, waypoints, diameter, material, spec); }
            else { SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec); }
        } else { notifyWithVoice("Módulo Router no disponible.", true); }
        return true;
    }

    // ================================================================
    //  COMANDO TAP
    // ================================================================

    function parseTap(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'tap') return false;
        if (parts.length < 6 || parts[3] !== 'to') { notifyWithVoice("Uso: tap [Equipo] [Puerto] to [Línea] [Posición 0-1] [material X] [diameter X] [spec X] [orient (dx,dy,dz)]", true); return true; }
        const fromEquip = parts[1], fromNozzle = parts[2], toLine = parts[4];
        const pos = parseFloat(parts[5]);
        if (isNaN(pos) || pos < 0 || pos > 1) { notifyWithVoice("Posición debe ser 0-1", true); return true; }
        const namedParams = extractNamedParams(parts, 6);
        const branchOrientation = extractBranchOrientation(parts, 6);
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip);
        if (!fromObj || !_core.getEquipos().includes(fromObj)) { notifyWithVoice('Equipo "' + fromEquip + '" no encontrado', true); return true; }
        const nzFrom = fromObj.puertos && fromObj.puertos.find(function(n) { return n.id === fromNozzle; });
        if (!nzFrom) { notifyWithVoice('Puerto "' + fromNozzle + '" no encontrado', true); return true; }
        const toObj = _core.findObjectByTag(toLine);
        if (!toObj || !_core.getLines().includes(toObj) || !getPoints(toObj).length) { notifyWithVoice('Línea "' + toLine + '" no encontrada', true); return true; }
        const resolved = resolveMaterialAndSpec(namedParams, [fromObj, toObj], null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || toObj.diameter || 4, material = resolved.material, spec = resolved.spec;
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        let startPos = null;
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
        else startPos = { x: (fromObj.posX||0) + (nzFrom.relX||0), y: (fromObj.posY||0) + (nzFrom.relY||0), z: (fromObj.posZ||0) + (nzFrom.relZ||0) };
        if (!startPos) { notifyWithVoice("No se pudo obtener posición origen", true); return true; }
        if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') { notifyWithVoice("Router no disponible", true); return true; }
        const resultado = calcularPuntoParametrico(toObj, pos);
        if (!resultado) { notifyWithVoice("No se pudo calcular punto de conexión", true); return true; }
        const puntoConexion = { x: resultado.x, y: resultado.y, z: resultado.z };
        const tapBranchDir = branchOrientation || calculateBranchDirection(puntoConexion, startPos);
        const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toLine, puntoConexion, diameter, true, tapBranchDir);
        if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio", true); return true; }
        const db = _core.getDb();
        const existingTags = new Set(db.lines.map(function(l) { return l.tag; }));
        let newTag, counter = 1;
        do { newTag = 'L-' + counter; counter++; } while (existingTags.has(newTag) && counter < 10000);
        const nuevaLinea = { tag: newTag, diameter: diameter, material: material, spec: spec, origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle }, destination: { objType: 'line', equipTag: toLine, portId: puertoId }, waypoints: [], _cachedPoints: [startPos, puntoConexion], components: [] };
        _core.addLine(nuevaLinea);
        const lineaRegistrada = db.lines.find(function(l) { return l.tag === newTag; }) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, fromObj, fromNozzle, toObj, puertoId, diameter, material, spec);
        if (_core.updateLine) { _core.updateLine(newTag, lineaRegistrada); }
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        nzFrom.connectedLine = newTag;
        const toObjUpd = _core.findObjectByTag(toLine);
        if (toObjUpd && toObjUpd.puertos) { const p = toObjUpd.puertos.find(function(p) { return p.id === puertoId; }); if (p) p.connectedLine = newTag; }
        notifyWithVoice("✅ Derivación: " + newTag + " (" + fromEquip + "." + fromNozzle + " → " + toLine + " @" + pos.toFixed(2) + ") | " + material + " " + diameter + "\" " + spec + (fittingInfo.message || ''), false);
        return true;
    }

    // ================================================================
    //  COMANDO SPLIT
    // ================================================================

    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir' && parts[0] !== 'romper') return false;
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        if (!lineTag || !coords) { notifyWithVoice("Uso: split [línea] at (x,y,z)", true); return true; }
        const type = extractValue(parts, ['type', 'tipo']) || 'TEE_EQUAL';
        saveStateBeforeMutation();
        const result = _core.splitLine(lineTag, coords, { type: type });
        if (result) { if (_core.setSelected) _core.setSelected({ type: 'COMPONENTE', obj: result.componente, parent: result.linea }); notifyWithVoice("✅ Línea " + lineTag + " dividida con " + type, false); }
        else { notifyWithVoice("Error: Punto fuera de la línea " + lineTag, true); }
        return true;
    }

    // ================================================================
    //  COMANDO DELETE
    // ================================================================

    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete' && parts[0] !== 'eliminar') return false;
        const type = parts[1] ? parts[1].toLowerCase() : null;
        const tag = parts[2];
        if (!type || !tag) { notifyWithVoice("❌ Uso: delete equipment [TAG] | delete line [TAG]", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        saveStateBeforeMutation();
        if (type === 'equipment' || type === 'equipo' || type === 'eq') {
            if (_core.removeEquipment) { _core.removeEquipment(tag); if (_renderUI) _renderUI(); }
            else {
                const db = _core.getDb();
                const equipo = _core.findObjectByTag(tag);
                if (!equipo || !_core.getEquipos().includes(equipo)) { notifyWithVoice("❌ Equipo \"" + tag + "\" no encontrado", true); return true; }
                const lineasConectadas = db.lines.filter(function(line) { return (line.origin && (line.origin.equipTag === tag || line.origin.objTag === tag)) || (line.destination && (line.destination.equipTag === tag || line.destination.objTag === tag)); });
                lineasConectadas.forEach(function(linea) {
                    var otroExtremo = null;
                    if (linea.origin && (linea.origin.equipTag === tag || linea.origin.objTag === tag)) { otroExtremo = linea.destination; }
                    else if (linea.destination) { otroExtremo = linea.origin; }
                    if (otroExtremo && (otroExtremo.equipTag || otroExtremo.objTag)) {
                        var otroTag = otroExtremo.equipTag || otroExtremo.objTag;
                        var otroObj = _core.findObjectByTag(otroTag);
                        if (otroObj && otroObj.puertos) {
                            var puerto = otroObj.puertos.find(function(p) { return p.id === otroExtremo.portId; });
                            if (puerto) { puerto.status = 'open'; puerto.flow = 'bi'; delete puerto.connectedTo; delete puerto.connectedLine; }
                        }
                    }
                });
                db.lines = db.lines.filter(function(line) { return lineasConectadas.indexOf(line) === -1; });
                db.equipos = db.equipos.filter(function(e) { return e.tag !== tag; });
                if (_core.rebuildIndexes) _core.rebuildIndexes();
                if (_core.syncPhysicalData) _core.syncPhysicalData();
                if (_renderUI) _renderUI();
                notifyWithVoice("✅ Equipo \"" + tag + "\" eliminado" + (lineasConectadas.length > 0 ? " + " + lineasConectadas.length + " línea(s)" : ""), false);
            }
            return true;
        }
        if (type === 'line' || type === 'línea' || type === 'linea' || type === 'pipe') {
            if (_core.removeLine) { _core.removeLine(tag); if (_renderUI) _renderUI(); }
            else {
                const db = _core.getDb();
                const linea = _core.findObjectByTag(tag);
                if (!linea || !_core.getLines().includes(linea)) { notifyWithVoice("❌ Línea \"" + tag + "\" no encontrada", true); return true; }
                if (linea.origin && (linea.origin.equipTag || linea.origin.objTag)) {
                    var origTag = linea.origin.equipTag || linea.origin.objTag;
                    var objOrigen = _core.findObjectByTag(origTag);
                    if (objOrigen && objOrigen.puertos) {
                        var puerto = objOrigen.puertos.find(function(p) { return p.id === linea.origin.portId; });
                        if (puerto) { puerto.status = 'open'; puerto.flow = 'bi'; delete puerto.connectedTo; delete puerto.connectedLine; }
                    }
                }
                if (linea.destination && (linea.destination.equipTag || linea.destination.objTag)) {
                    var destTag = linea.destination.equipTag || linea.destination.objTag;
                    var objDestino = _core.findObjectByTag(destTag);
                    if (objDestino && objDestino.puertos) {
                        var puerto = objDestino.puertos.find(function(p) { return p.id === linea.destination.portId; });
                        if (puerto) { puerto.status = 'open'; puerto.flow = 'bi'; delete puerto.connectedTo; delete puerto.connectedLine; }
                    }
                }
                db.lines = db.lines.filter(function(l) { return l.tag !== tag; });
                if (_core.rebuildIndexes) _core.rebuildIndexes();
                if (_core.syncPhysicalData) _core.syncPhysicalData();
                if (_renderUI) _renderUI();
                notifyWithVoice("✅ Línea \"" + tag + "\" eliminada. Puertos liberados.", false);
            }
            return true;
        }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice("❌ \"" + tag + "\" no encontrado", true); return true; }
        if (_core.getEquipos().includes(obj)) { return parseDelete("delete equipment " + tag); }
        else if (_core.getLines().includes(obj)) { return parseDelete("delete line " + tag); }
        notifyWithVoice("❌ No se pudo determinar el tipo de \"" + tag + "\". Use: delete equipment/line [TAG]", true);
        return true;
    }

    // ================================================================
    //  COMANDO EDIT
    // ================================================================

    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit' && parts[0] !== 'editar') return false;
        saveStateBeforeMutation();
        if (parts[1] === 'equipment' || parts[1] === 'equipo') {
            const tag = parts[2], action = parts[3];
            if (action === 'move' || action === 'mover') {
                let coordStr = '';
                for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]); _core.updateEquipment(tag, { posX: x, posY: y, posZ: z }); notifyWithVoice("✅ Equipo " + tag + " movido a (" + x + "," + y + "," + z + ")", false); return true; }
            } else if (action === 'set' || action === 'establecer') {
                if (parts[4] === 'puerto') {
                    const puertoId = parts[5], subParam = parts[6];
                    if (subParam === 'diam' || subParam === 'diametro') { const nuevoDiam = parseFloat(parts[7]); if (!isNaN(nuevoDiam)) { _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam }); notifyWithVoice("✅ Puerto " + puertoId + " diámetro " + nuevoDiam + "\"", false); return true; } }
                    else if (subParam === 'pos' || subParam === 'posicion') { let cs = ''; for (let i = 7; i < parts.length; i++) { cs += parts[i]; if (parts[i].includes(')')) break; } const m = cs.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/); if (m) { _core.updatePuerto(tag, puertoId, { pos: { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } }); notifyWithVoice("✅ Puerto " + puertoId + " posición actualizada", false); return true; } }
                    else if (subParam === 'dir' || subParam === 'direccion') { let cs = ''; for (let i = 7; i < parts.length; i++) { cs += parts[i]; if (parts[i].includes(')')) break; } const m = cs.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/); if (m) { _core.updatePuerto(tag, puertoId, { dir: { dx: parseFloat(m[1]), dy: parseFloat(m[2]), dz: parseFloat(m[3]) } }); notifyWithVoice("✅ Puerto " + puertoId + " dirección actualizada", false); return true; } }
                }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const property = parts[4], value = parts[5];
                if (property === 'material') { _core.updateLine(tag, { material: value.toUpperCase() }); notifyWithVoice("✅ Línea " + tag + " material " + value.toUpperCase(), false); return true; }
                else if (property === 'diameter' || property === 'diametro') { const val = parseFloat(value); if (!isNaN(val)) { _core.updateLine(tag, { diameter: val }); notifyWithVoice("✅ Línea " + tag + " diámetro " + val + "\"", false); return true; } }
                else if (property === 'spec') { _core.updateLine(tag, { spec: value }); notifyWithVoice("✅ Línea " + tag + " spec " + value, false); return true; }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5;
                const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
                if (atIdx !== -1) position = parseFloat(parts[atIdx + 1]);
                const branchOrientation = extractBranchOrientation(parts, atIdx + 2);
                const line = _core.findObjectByTag(tag);
                if (line && _core.getLines().includes(line)) {
                    const compDef = _catalog.getComponent(compType);
                    if (!compDef) { notifyWithVoice("Componente desconocido: " + compType, true); return true; }
                    const comp = { type: compDef.tipo || compType, tag: compType + "-" + Date.now().toString().slice(-6), param: position };
                    if (!line.components) line.components = [];
                    const existe = line.components.some(function(c) { return c.type === comp.type && Math.abs((c.param || 0) - position) < 0.02; });
                    if (existe) { notifyWithVoice("⚠️ Ya existe un componente similar en esa posición", false); return true; }
                    line.components.push(comp);
                    if (compDef.generarPuertos) {
                        const nuevosPuertos = compDef.generarPuertos(line, position, line.diameter, branchOrientation);
                        if (!line.puertos) line.puertos = [];
                        nuevosPuertos.forEach(function(p, idx) { p.id = comp.tag + "_" + idx; if (branchOrientation && (p.id.includes('BRANCH') || p.label === 'Derivación' || idx === 2)) { p.orientacion = branchOrientation; p.dir = branchOrientation; p.vector = branchOrientation; } line.puertos.push(p); });
                    }
                    _core.updateLine(tag, { components: line.components, puertos: line.puertos });
                    notifyWithVoice("✅ " + (compDef.nombre || compType) + " añadido a " + tag + " en posición " + position.toFixed(2) + (branchOrientation ? " con orientación personalizada" : ""), false);
                    return true;
                }
            }
        }
        return false;
    }

    // ================================================================
    //  COMANDO MOVE
    // ================================================================

    function parseMoveCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'move' && parts[0] !== 'mover') return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice("Uso: move TAG to (x,y,z) | move TAG by (dx,dy,dz)", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(tag + " no encontrado", true); return true; }
        const mode = parts[2] ? parts[2].toLowerCase() : null;
        let coordStr = '';
        for (let i = 3; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const m = coordStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
        if (!m) { notifyWithVoice("Formato: (x,y,z)", true); return true; }
        const vx = parseFloat(m[1]), vy = parseFloat(m[2]), vz = parseFloat(m[3]);
        saveStateBeforeMutation();
        if (obj.posX !== undefined) {
            if (mode === 'by' || mode === 'por') { _core.updateEquipment(tag, { posX: (obj.posX || 0) + vx, posY: (obj.posY || 0) + vy, posZ: (obj.posZ || 0) + vz }); }
            else { _core.updateEquipment(tag, { posX: vx, posY: vy, posZ: vz }); }
            notifyWithVoice("✅ " + tag + " movido a (" + vx + "," + vy + "," + vz + ")", false);
        } else {
            const pts = getPoints(obj);
            if (pts.length > 0) {
                let newPts;
                if (mode === 'by' || mode === 'por') { newPts = pts.map(function(p) { return { x: p.x + vx, y: p.y + vy, z: p.z + vz }; }); }
                else { const base = pts[0]; const dx = vx - base.x, dy = vy - base.y, dz = vz - base.z; newPts = pts.map(function(p) { return { x: p.x + dx, y: p.y + dy, z: p.z + dz }; }); }
                _core.updateLine(tag, { _cachedPoints: newPts });
                notifyWithVoice("✅ " + tag + " desplazado", false);
            }
        }
        if (_renderUI) _renderUI();
        return true;
    }

    // ================================================================
    //  COMANDO ROTATE
    // ================================================================

    function parseRotate(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'rotate' && parts[0] !== 'rotar' && parts[0] !== 'girar') return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice("Uso: rotate TAG [angulo] [around X|Y|Z]", true); return true; }
        let angle = 0;
        if (parts[2] === 'by') { angle = parseFloat(parts[3]) || 0; } else { angle = parseFloat(parts[2]) || 0; }
        let axis = 'Y';
        const aroundIdx = parts.indexOf('around') !== -1 ? parts.indexOf('around') : parts.indexOf('eje');
        if (aroundIdx !== -1 && aroundIdx + 1 < parts.length) { axis = parts[aroundIdx + 1].toUpperCase(); }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(tag + " no encontrado", true); return true; }
        saveStateBeforeMutation();
        if (obj.posX !== undefined) {
            const currentRotation = obj.rotation || 0;
            _core.updateEquipment(tag, { rotation: currentRotation + angle });
            notifyWithVoice("✅ " + tag + " rotado " + angle + "° (total: " + (currentRotation + angle) + "°)", false);
        } else {
            const pts = getPoints(obj);
            if (pts.length > 0) {
                const rad = angle * Math.PI / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                let cx = 0, cy = 0, cz = 0;
                pts.forEach(function(p) { cx += p.x; cy += p.y; cz += p.z; });
                cx /= pts.length; cy /= pts.length; cz /= pts.length;
                const newPts = pts.map(function(p) {
                    const rx = p.x - cx, ry = p.y - cy, rz = p.z - cz;
                    if (axis === 'Y') return { x: cx + rx * cos - rz * sin, y: p.y, z: cz + rx * sin + rz * cos };
                    else if (axis === 'Z') return { x: cx + rx * cos - ry * sin, y: cy + rx * sin + ry * cos, z: p.z };
                    else if (axis === 'X') return { x: p.x, y: cy + ry * cos - rz * sin, z: cz + ry * sin + rz * cos };
                    return p;
                });
                _core.updateLine(tag, { _cachedPoints: newPts });
                notifyWithVoice("✅ " + tag + " rotado " + angle + "° alrededor del eje " + axis, false);
            }
        }
        if (_renderUI) _renderUI();
        return true;
    }

    // ================================================================
    //  COMANDO DUPLICATE
    // ================================================================

    function parseDuplicate(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'duplicate' && parts[0] !== 'duplicar' && parts[0] !== 'copy' && parts[0] !== 'copiar') return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice("Uso: duplicate TAG as NUEVO_TAG [offset (dx,dy,dz)]", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const original = _core.findObjectByTag(tag);
        if (!original) { notifyWithVoice(tag + " no encontrado", true); return true; }
        let newTag = null;
        const asIdx = parts.indexOf('as') !== -1 ? parts.indexOf('as') : parts.indexOf('como');
        if (asIdx !== -1 && asIdx + 1 < parts.length) { newTag = parts[asIdx + 1]; } else { newTag = tag + '-COPY'; }
        if (_core.findObjectByTag(newTag)) { notifyWithVoice("❌ El tag " + newTag + " ya existe", true); return true; }
        let offsetX = 2000, offsetY = 0, offsetZ = 0;
        const offsetIdx = parts.indexOf('offset') !== -1 ? parts.indexOf('offset') : parts.indexOf('desplazar');
        if (offsetIdx !== -1) { const coordStr = parts.slice(offsetIdx + 1).join(''); const m = coordStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/); if (m) { offsetX = parseFloat(m[1]); offsetY = parseFloat(m[2]); offsetZ = parseFloat(m[3]); } }
        const isEquipment = original.posX !== undefined || (original.pos && original.pos.x !== undefined);
        saveStateBeforeMutation();
        if (isEquipment) {
            const clone = JSON.parse(JSON.stringify(original));
            clone.tag = newTag;
            clone.posX = (clone.posX || 0) + offsetX;
            clone.posY = (clone.posY || 0) + offsetY;
            clone.posZ = (clone.posZ || 0) + offsetZ;
            const success = _core.addEquipment(clone);
            if (success) { notifyWithVoice("✅ Equipo duplicado: " + tag + " → " + newTag, false); if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: clone }); }
        } else {
            const clone = JSON.parse(JSON.stringify(original));
            clone.tag = newTag;
            const pts = getPoints(original);
            if (pts.length > 0) { clone._cachedPoints = pts.map(function(p) { return { x: p.x + offsetX, y: p.y + offsetY, z: p.z + offsetZ }; }); }
            const success = _core.addLine(clone);
            if (success) { notifyWithVoice("✅ Línea duplicada: " + tag + " → " + newTag, false); if (_core.setSelected) _core.setSelected({ type: 'line', obj: clone }); }
        }
        if (_renderUI) _renderUI();
        return true;
    }

    // ================================================================
    //  COMANDO ALIGN
    // ================================================================

    function parseAlign(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'align' && parts[0] !== 'alinear') return false;
        const tags = [];
        let axis = 'Y';
        let i = 1;
        while (i < parts.length && parts[i] !== 'on' && parts[i] !== 'en') { tags.push(parts[i]); i++; }
        if (i < parts.length && (parts[i] === 'on' || parts[i] === 'en')) { axis = (parts[i + 1] || 'Y').toUpperCase(); }
        if (tags.length < 2) { notifyWithVoice("Uso: align TAG1 TAG2 [TAG3...] on X|Y|Z", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const refObj = _core.findObjectByTag(tags[0]);
        if (!refObj || refObj.posX === undefined) { notifyWithVoice(tags[0] + " no es un equipo válido para alinear", true); return true; }
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
        notifyWithVoice("✅ " + count + " equipos alineados al eje " + axis, false);
        if (_renderUI) _renderUI();
        return true;
    }

    // ================================================================
    //  COMANDO ACCESSORIES
    // ================================================================

    function parseAccessoriesCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'accessories' && parts[0] !== 'accesorios') return false;
        const lineTag = parts[1];
        if (!lineTag) { notifyWithVoice("Uso: accessories LINEA add TIPO@pos... | accessories LINEA auto TIPO... at POS | accessories LINEA transition from MAT1 to MAT2 [with COMP] at POS", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(lineTag);
        if (!line || !_core.getLines().includes(line)) { notifyWithVoice("❌ Línea " + lineTag + " no encontrada", true); return true; }
        saveStateBeforeMutation();
        if (parts[2] === 'add' || parts[2] === 'añadir') {
            let added = 0, errors = 0;
            for (let i = 3; i < parts.length; i++) {
                const accDef = parts[i];
                const atIdx = accDef.indexOf('@');
                if (atIdx === -1) { notifyWithVoice("⚠️ Formato: " + accDef + " (use TIPO@pos)", true); errors++; continue; }
                const compType = accDef.substring(0, atIdx);
                const position = parseFloat(accDef.substring(atIdx + 1));
                if (isNaN(position) || position < 0 || position > 1) { notifyWithVoice("⚠️ Posición inválida: " + accDef, true); errors++; continue; }
                if (!addComponentToLine(line, lineTag, compType, position)) { errors++; } else { added++; }
            }
            _core.updateLine(lineTag, { components: line.components });
            if (_renderUI) _renderUI();
            notifyWithVoice("✅ " + added + " accesorio(s) añadido(s)" + (errors > 0 ? " | ⚠️ " + errors + " error(es)" : ""), errors > 0);
            return true;
        }
        if (parts[2] === 'auto') {
            const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
            const endIdx = atIdx !== -1 ? atIdx : parts.length;
            const componentTypes = [];
            for (let i = 3; i < endIdx; i++) { const compType = parts[i].toUpperCase(); if (['AT', 'EN', 'DIAMETER', 'DIAMETRO'].indexOf(compType) === -1) { componentTypes.push(compType); } }
            if (componentTypes.length === 0) { notifyWithVoice("❌ Especifique al menos un componente", true); return true; }
            let startPosition = 0.5;
            if (atIdx !== -1 && atIdx + 1 < parts.length) { startPosition = parseFloat(parts[atIdx + 1]); if (isNaN(startPosition)) startPosition = 0.5; }
            const namedParams = extractNamedParams(parts, endIdx);
            const diameter = namedParams.diameter || line.diameter || 4;
            const pts = getPoints(line);
            let totalLength = 10000;
            if (pts.length >= 2) { totalLength = 0; for (let i = 0; i < pts.length - 1; i++) { totalLength += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z); } }
            const positions = calculateAccessoryPositions(componentTypes, startPosition, totalLength, diameter);
            let added = 0, errors = 0;
            for (let i = 0; i < positions.length; i++) { const pos = positions[i]; if (addComponentToLine(line, lineTag, pos.type, pos.position)) { added++; } else { errors++; } }
            if (line.components) { line.components.sort(function(a, b) { return (a.param || 0) - (b.param || 0); }); }
            _core.updateLine(lineTag, { components: line.components });
            if (_renderUI) _renderUI();
            notifyWithVoice("✅ " + added + " accesorio(s) añadido(s) automáticamente a " + lineTag + " (desde pos " + startPosition.toFixed(2) + ")" + (errors > 0 ? " | ⚠️ " + errors + " error(es)" : ""), errors > 0);
            return true;
        }
        if (parts[2] === 'transition' || parts[2] === 'transicion') {
            const fromIdx = parts.indexOf('from') !== -1 ? parts.indexOf('from') : parts.indexOf('de');
            const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
            const withIdx = parts.indexOf('with') !== -1 ? parts.indexOf('with') : parts.indexOf('con');
            const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
            if (fromIdx === -1 || toIdx === -1) { notifyWithVoice("Uso: accessories LINEA transition from MAT1 to MAT2 [with COMP] at POS", true); return true; }
            const material1 = parts[fromIdx + 1].toUpperCase();
            const material2 = parts[toIdx + 1].toUpperCase();
            const componente = withIdx !== -1 ? parts[withIdx + 1] : null;
            let startPos = 0.85;
            if (atIdx !== -1 && atIdx + 1 < parts.length) { startPos = parseFloat(parts[atIdx + 1]); if (isNaN(startPos)) startPos = 0.85; }
            const namedParams = extractNamedParams(parts, toIdx + 2);
            const diameter = namedParams.diameter || line.diameter || 4;
            const transitionComponents = ['FLANGE'];
            if (material1 !== material2) { transitionComponents.push('CONCENTRIC_REDUCER'); }
            if (componente) { transitionComponents.push(componente); }
            transitionComponents.push('FLANGE');
            const pts = getPoints(line);
            let totalLength = 10000;
            if (pts.length >= 2) { totalLength = 0; for (let i = 0; i < pts.length - 1; i++) { totalLength += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z); } }
            const positions = calculateAccessoryPositions(transitionComponents, startPos, totalLength, diameter);
            let added = 0;
            for (let i = 0; i < positions.length; i++) { const pos = positions[i]; if (addComponentToLine(line, lineTag, pos.type, pos.position)) { added++; } }
            if (line.components) { line.components.sort(function(a, b) { return (a.param || 0) - (b.param || 0); }); }
            _core.updateLine(lineTag, { components: line.components });
            if (_renderUI) _renderUI();
            notifyWithVoice("✅ Transición " + material1 + " → " + material2 + " creada en " + lineTag + " (" + added + " accesorios)" + (componente ? " con " + componente : ""), false);
            return true;
        }
        notifyWithVoice("Modo no reconocido. Use: add | auto | transition", true);
        return true;
    }

    // ================================================================
    //  COMANDO BOM, AUDIT, HELP, MACRO, EXPORT, VIEW, PCF
    // ================================================================

    function parseBOM(cmd) { 
        const t = cmd.trim().toLowerCase(); 
        if (t === 'bom' || t === 'mto' || t === 'generate bom' || t === 'generar bom') { generateBOM(); return true; } 
        return false; 
    }
    
    function generateBOM() {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return; }
        // Delegar a SmartFlowIO si está disponible
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadMTO) {
            SmartFlowIO.downloadMTO();
            return;
        }
        // Fallback
        const db = _core.getDb(); const lines = db.lines || []; const equipos = db.equipos || []; let items = [];
        equipos.forEach(function(eq) { if (eq.tipo !== 'colector') { items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: (eq.tipo || 'Equipo') + ' ' + (eq.material || ''), cantidad: 1, unidad: 'Und' }); } });
        const pipeMap = new Map();
        lines.forEach(function(line) {
            const pts = getPoints(line); if (!pts || pts.length < 2) return;
            let length = 0; for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            const lengthM = length / 1000; const key = (line.diameter || '?') + '"-' + (line.material || 'PPR') + '-' + (line.spec || 'STD');
            if (pipeMap.has(key)) { var d = pipeMap.get(key); d.length += lengthM; }
            else pipeMap.set(key, { diametro: line.diameter, material: line.material || 'PPR', spec: line.spec || 'STD', length: lengthM });
        });
        pipeMap.forEach(function(data, key) { items.push({ tipo: 'TUBERIA', tag: '', descripcion: 'Tubo ' + data.material + ' ' + data.diametro + '" ' + data.spec, cantidad: data.length.toFixed(2), unidad: 'm' }); });
        const compMap = new Map();
        lines.forEach(function(line) { if (line.components) line.components.forEach(function(comp) { const key = (comp.type || '?') + '-' + (line.diameter || '?') + '"'; compMap.set(key, (compMap.get(key) || 0) + 1); }); });
        compMap.forEach(function(count, key) { const parts = key.split('-'); items.push({ tipo: 'COMPONENTE', tag: '', descripcion: parts[0] + ' ' + parts[1], cantidad: count, unidad: 'Und' }); });
        let csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
        items.forEach(function(item) { csv += item.tipo + ',' + item.tag + ',' + item.descripcion + ',' + item.cantidad + ',' + item.unidad + '\n'; });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'BOM_' + (window.currentProjectName || 'Proyecto') + '_' + Date.now() + '.csv'; a.click();
        notifyWithVoice('✅ BOM generado con ' + items.length + ' líneas.', false);
    }

    function parseAudit(cmd) { 
        const t = cmd.trim().toLowerCase(); 
        if (t === 'audit' || t === 'auditar') { if (_core && _core.auditModel) _core.auditModel(); else notifyWithVoice("Auditoría no disponible.", true); return true; } 
        return false; 
    }

    function parseHelp(cmd) {
        const lower = cmd.toLowerCase(); 
        if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "═══════════════════════════════════════════════════════════\n";
        ayuda += "              SMARTFLOW PRO v3.7 - COMANDOS\n";
        ayuda += "═══════════════════════════════════════════════════════════\n\n";
        ayuda += "⚙️ CONFIGURACIÓN:\n";
        ayuda += "  set project material <MATERIAL> spec <SPEC>\n";
        ayuda += "  set project defaults  (ver configuración actual)\n\n";
        ayuda += "🏗️ CREACIÓN:\n";
        ayuda += "  create [tipo] [tag] at (x,y,z) [diam X] [height X] [material X]\n";
        ayuda += "  create line [tag] route (x,y,z) (x,y,z)... [diameter X] [material X] [spec X]\n";
        ayuda += "  line TAG from EQUIPO PUERTO to EQUIPO PUERTO [diameter X] [via (x,y,z)...]\n\n";
        ayuda += "🔗 CONEXIÓN:\n";
        ayuda += "  connect [origen] [0.5|puerto] to [destino] [puerto] [material X] [diameter X]\n";
        ayuda += "  connect ... via (x,y,z) (x,y,z) ← waypoints intermedios\n";
        ayuda += "  route from [origen] [puerto] via (x,y,z)... to [destino] [puerto]\n";
        ayuda += "  tap [origen] [puerto] to [linea] [0.0-1.0] [material X] [diameter X]\n\n";
        ayuda += "✏️ EDICIÓN:\n";
        ayuda += "  extend line TAG to EQUIPO PUERTO [via (x,y,z)...]\n";
        ayuda += "  optimize route TAG\n";
        ayuda += "  reroute line TAG [mode smart|orthogonal] [elevation N]\n";
        ayuda += "  move [tag] to (x,y,z)  |  move [tag] by (dx,dy,dz)\n";
        ayuda += "  rotate [tag] [angulo] [around X|Y|Z]\n";
        ayuda += "  duplicate [tag] as [nuevo_tag] [offset (dx,dy,dz)]\n";
        ayuda += "  delete equipment|line [tag]\n";
        ayuda += "  split [línea] at (x,y,z) [type TEE_EQUAL]\n\n";
        ayuda += "🔩 ACCESORIOS:\n";
        ayuda += "  accessories [linea] add TIPO@pos TIPO@pos...\n";
        ayuda += "  accessories [linea] auto TIPO TIPO... at POS [diameter X]\n";
        ayuda += "  accessories [linea] transition from MAT1 to MAT2 [with COMP] at POS\n";
        ayuda += "  edit line [tag] set material|diameter|spec [valor]\n\n";
        ayuda += "📊 CONSULTAS:\n";
        ayuda += "  info line|equipment|component [tag]\n";
        ayuda += "  nodos [tag]  ← muestra todos los puertos con nombres completos\n";
        ayuda += "  nodos abiertos [tag]  ← muestra solo puertos DISPONIBLES\n";
        ayuda += "  point de [tag] [puerto|@0.5|punto N]\n";
        ayuda += "  measure [tag1] to [tag2]\n";
        ayuda += "  list equipos | lineas | componentes | especificaciones\n\n";
        ayuda += "📁 INTEROPERABILIDAD (SmartFlow I/O):\n";
        ayuda += "  export pcf           ← Exporta para SmartPlant, Aveva, AutoCAD\n";
        ayuda += "  import pcf           ← Carga archivo PCF de otros softwares\n";
        ayuda += "  export mto           ← Exporta Lista de Materiales (CSV)\n";
        ayuda += "  export json          ← Guarda proyecto completo\n";
        ayuda += "  import json          ← Carga proyecto guardado\n\n";
        ayuda += "💡 TIP: Copia el nombre completo de un nodo (ej: L-1.TEE_xyz_P3)\n";
        ayuda += "   y úsalo directamente en: connect L-1.TEE_xyz_P3 to EQUIPO PUERTO\n\n";
        ayuda += "🎯 VISTA / OTROS:\n";
        ayuda += "  view top|front|iso|extents  |  view [tag] (centrar)\n";
        ayuda += "  macro save|run|list|delete [nombre]\n";
        ayuda += "  export json | csv  |  bom  |  audit  |  undo | redo\n";
        ayuda += "═══════════════════════════════════════════════════════════\n";
        notifyWithVoice(ayuda, false); return true;
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
        const action = parts[1] ? parts[1].toLowerCase() : null;
        if (action === 'save' || action === 'guardar') {
            const name = parts[2];
            if (!name) { notifyWithVoice("Uso: macro save NOMBRE", true); return true; }
            const history = window._commandHistory.slice();
            _macros.set(name, history);
            notifyWithVoice("💾 Macro \"" + name + "\" guardada (" + history.length + " comandos)", false);
            return true;
        }
        if (action === 'run' || action === 'ejecutar') {
            const name = parts[2];
            if (!name || !_macros.has(name)) { notifyWithVoice("Macro \"" + name + "\" no encontrada. Use macro list.", true); return true; }
            const commands = _macros.get(name);
            let count = 0;
            commands.forEach(function(c) { if (executeCommand(c)) count++; });
            notifyWithVoice("▶️ Macro \"" + name + "\": " + count + "/" + commands.length + " comandos ejecutados", false);
            return true;
        }
        if (action === 'list' || action === 'lista') {
            if (_macros.size === 0) { notifyWithVoice("No hay macros guardadas.", false); }
            else { let msg = "📋 Macros guardadas:\n"; _macros.forEach(function(cmds, name) { msg += "  • " + name + " (" + cmds.length + " comandos)\n"; }); notifyWithVoice(msg, false); }
            return true;
        }
        if (action === 'delete' || action === 'eliminar') {
            const name = parts[2];
            if (_macros.delete(name)) { notifyWithVoice("🗑️ Macro \"" + name + "\" eliminada", false); }
            else { notifyWithVoice("Macro \"" + name + "\" no encontrada", true); }
            return true;
        }
        notifyWithVoice("Uso: macro save|run|list|delete [nombre]", true);
        return true;
    }

    function parseExportCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'export' && parts[0] !== 'exportar') return false;
        const format = parts[1] ? parts[1].toLowerCase() : null;
        
        // Delegar a SmartFlowIO
        if (format === 'pcf') {
            if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadPCF) {
                SmartFlowIO.downloadPCF();
                return true;
            }
            notifyWithVoice("❌ Módulo I/O no disponible", true);
            return true;
        }
        if (format === 'mto' || format === 'csv') {
            if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadMTO) {
                SmartFlowIO.downloadMTO();
                return true;
            }
            generateBOM();
            return true;
        }
        if (format === 'json') {
            if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadJSON) {
                SmartFlowIO.downloadJSON();
                return true;
            }
            if (_core && _core.exportProject) {
                const json = _core.exportProject();
                const blob = new Blob([json], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'SmartFlow_' + new Date().toISOString().slice(0,10) + '.json';
                a.click();
                notifyWithVoice("📁 Proyecto exportado como JSON", false);
            }
            return true;
        }
        notifyWithVoice("Formatos: export pcf | export mto | export json | export csv", true);
        return true;
    }

    function parseViewCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'view' && parts[0] !== 'vista' && parts[0] !== 'zoom' && parts[0] !== 'camara' && parts[0] !== 'cámara') return false;
        const sub = parts[1] ? parts[1].toLowerCase() : null;
        if (sub === 'top' || sub === 'planta') { if (_renderer && _renderer.setView) _renderer.setView('top'); notifyWithVoice("🔭 Vista: Planta (TOP)", false); return true; }
        if (sub === 'front' || sub === 'frente') { if (_renderer && _renderer.setView) _renderer.setView('front'); notifyWithVoice("🔭 Vista: Frontal", false); return true; }
        if (sub === 'iso' || sub === 'isometrico' || sub === 'isométrico') { if (_renderer && _renderer.setView) _renderer.setView('iso'); notifyWithVoice("🔭 Vista: Isométrica", false); return true; }
        if (sub === 'extents' || sub === 'todo' || sub === 'fit' || sub === 'extender') { if (_renderer && _renderer.zoomToFit) _renderer.zoomToFit(); notifyWithVoice("🔭 Zoom: Extender", false); return true; }
        if (sub && ['top','front','iso','extents','fit','todo','extender','reset'].indexOf(sub) === -1) {
            const obj = _core ? _core.findObjectByTag(sub) : null;
            if (obj) { const pos = getBasePosition(obj); if (_renderer && _renderer.focusOn) _renderer.focusOn(pos); notifyWithVoice("🔭 Centrando en " + sub, false); return true; }
        }
        notifyWithVoice("Vistas: top | front | iso | extents | [TAG]", true);
        return true;
    }

    // ================================================================
    //  NUEVOS COMANDOS v3.5
    // ================================================================
    
    function parseLineFromTo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'line' && parts[0] !== 'linea') return false;
        const tag = parts[1];
        if (!tag) return false;
        const fromIdx = parts.indexOf('from') !== -1 ? parts.indexOf('from') : parts.indexOf('desde');
        const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
        if (fromIdx === -1 || toIdx === -1) return false;
        if (fromIdx >= toIdx) return false;
        const fromEquip = parts[fromIdx + 1], fromNozzle = parts[fromIdx + 2], toEquip = parts[toIdx + 1];
        let toNozzle = parts[toIdx + 2];
        const keywords = ['material', 'spec', 'diameter', 'diametro', 'via', 'route', 'ruta', 'mode', 'orient', 'direccion'];
        if (toNozzle && keywords.indexOf(toNozzle.toLowerCase()) !== -1) toNozzle = null;
        if (!fromEquip || !fromNozzle || !toEquip) { notifyWithVoice("❌ Uso: line TAG from EQUIPO PUERTO to EQUIPO [PUERTO]", true); return true; }
        const viaIdx = parts.indexOf('via');
        let waypoints = [];
        if (viaIdx !== -1 && viaIdx < toIdx) waypoints = extractWaypoints(parts, viaIdx + 1, toIdx);
        const paramStartIdx = toIdx + (toNozzle ? 3 : 2);
        const namedParams = extractNamedParams(parts, paramStartIdx);
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        if (_core.findObjectByTag(tag)) { notifyWithVoice("❌ El tag " + tag + " ya existe", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip), toObj = _core.findObjectByTag(toEquip);
        if (!fromObj || !toObj) { notifyWithVoice("❌ Origen/Destino no encontrado", true); return true; }
        const resolved = resolveMaterialAndSpec(namedParams, [fromObj, toObj], null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || 4, material = resolved.material, spec = resolved.spec;
        for (let i = paramStartIdx; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (!toNozzle) {
            const ptsTo = _core.getLinePoints(toObj) || toObj._cachedPoints;
            if (ptsTo && ptsTo.length >= 2) toNozzle = '';
            else if (toObj.puertos && toObj.puertos.length > 0) { const openPort = toObj.puertos.find(function(p) { return p.status === 'open'; }); toNozzle = openPort ? openPort.id : toObj.puertos[0].id; }
            else toNozzle = 'N1';
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            let nuevaLinea;
            if (waypoints.length > 0) nuevaLinea = SmartFlowRouter.routeWithWaypoints(fromEquip, fromNozzle, toEquip, toNozzle, waypoints, diameter, material, spec);
            else nuevaLinea = SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
            if (nuevaLinea && nuevaLinea.tag !== tag) {
                const oldTag = nuevaLinea.tag;
                _core.updateLine(oldTag, { tag: tag });
                if (_core.rebuildIndexes) _core.rebuildIndexes();
                if (fromObj && fromObj.puertos) { const pFrom = fromObj.puertos.find(function(p) { return p.id === fromNozzle; }); if (pFrom && pFrom.connectedLine === oldTag) pFrom.connectedLine = tag; }
                if (toObj && toObj.puertos) { const pTo = toObj.puertos.find(function(p) { return p.id === toNozzle; }); if (pTo && pTo.connectedLine === oldTag) pTo.connectedLine = tag; }
            }
            if (_core.setSelected) { const finalLine = _core.findObjectByTag(tag); if (finalLine) _core.setSelected({ type: 'line', obj: finalLine }); }
            if (_renderUI) _renderUI();
            notifyWithVoice("✅ Línea " + tag + ": " + fromEquip + ":" + fromNozzle + " → " + toEquip + ":" + (toNozzle || 'auto') + " | " + material + " " + diameter + "\" " + spec, false);
        } else { notifyWithVoice("Router no disponible", true); }
        return true;
    }

    function parseExtendLine(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'extend' || (parts[1] !== 'line' && parts[1] !== 'linea')) return false;
        const lineTag = parts[2];
        const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
        if (toIdx === -1) { notifyWithVoice("Uso: extend line TAG to EQUIPO PUERTO [via (x,y,z)...]", true); return true; }
        const targetTag = parts[toIdx + 1];
        let targetPort = parts[toIdx + 2];
        if (targetPort && ['via', 'material', 'spec', 'diameter'].indexOf(targetPort.toLowerCase()) !== -1) targetPort = null;
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(lineTag);
        if (!line) { notifyWithVoice("❌ Línea " + lineTag + " no encontrada", true); return true; }
        const targetObj = _core.findObjectByTag(targetTag);
        if (!targetObj) { notifyWithVoice("❌ Destino " + targetTag + " no encontrado", true); return true; }
        const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D;
        if (!pts || pts.length < 2) { notifyWithVoice("❌ Línea sin geometría", true); return true; }
        const lastPoint = pts[pts.length - 1];
        const material = line.material || getProjectDefaultMaterial();
        const spec = line.spec || getProjectDefaultSpec(material);
        const diameter = line.diameter || 4;
        if (!targetPort && targetObj.puertos) { const openPort = targetObj.puertos.find(function(p) { return p.status === 'open'; }); targetPort = openPort ? openPort.id : targetObj.puertos[0].id; }
        if (!targetPort) targetPort = 'N1';
        let endPos;
        if (typeof SmartFlowRouter !== 'undefined') endPos = SmartFlowRouter.getPortPosition(targetObj, targetPort);
        else endPos = getPortPosition(targetTag, targetPort);
        if (!endPos) { notifyWithVoice("❌ No se pudo obtener posición del destino", true); return true; }
        saveStateBeforeMutation();
        const newPoints = pts.slice();
        const viaIdx = parts.indexOf('via');
        if (viaIdx !== -1) { const wps = extractWaypoints(parts, viaIdx + 1, parts.length); for (let w = 0; w < wps.length; w++) newPoints.push({ x: wps[w].x, y: wps[w].y, z: wps[w].z }); }
        newPoints.push({ x: endPos.x, y: endPos.y, z: endPos.z });
        _core.updateLine(lineTag, { _cachedPoints: newPoints, destination: { equipTag: targetTag, portId: targetPort } });
        if (typeof SmartFlowRouter !== 'undefined') { const updatedLine = _core.findObjectByTag(lineTag); if (updatedLine) SmartFlowRouter.ensureFittings(updatedLine, null, null, targetObj, targetPort, diameter, material, spec); }
        _core.syncPhysicalData();
        if (_renderUI) _renderUI();
        notifyWithVoice("✅ Línea " + lineTag + " extendida a " + targetTag + ":" + targetPort + " (+" + (newPoints.length - pts.length) + " punto(s))", false);
        return true;
    }

    function parseOptimizeRoute(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'optimize' || (parts[1] !== 'route' && parts[1] !== 'ruta')) return false;
        const lineTag = parts[2];
        if (!lineTag) { notifyWithVoice("Uso: optimize route TAG", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(lineTag);
        if (!line) { notifyWithVoice("❌ Línea " + lineTag + " no encontrada", true); return true; }
        const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D;
        if (!pts || pts.length < 3) { notifyWithVoice("✅ La línea ya está optimizada", true); return true; }
        const optimized = [pts[0]];
        let removedCount = 0;
        for (let i = 1; i < pts.length - 1; i++) {
            const prev = optimized[optimized.length - 1], curr = pts[i], next = pts[i + 1];
            const v1 = { x: curr.x - prev.x, y: curr.y - prev.y, z: curr.z - prev.z };
            const v2 = { x: next.x - curr.x, y: next.y - curr.y, z: next.z - curr.z };
            const len1 = Math.hypot(v1.x, v1.y, v1.z) || 1, len2 = Math.hypot(v2.x, v2.y, v2.z) || 1;
            const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (len1 * len2);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
            if (angle > 5) optimized.push(curr); else removedCount++;
        }
        optimized.push(pts[pts.length - 1]);
        if (removedCount > 0) {
            saveStateBeforeMutation();
            _core.updateLine(lineTag, { _cachedPoints: optimized });
            _core.syncPhysicalData();
            if (_renderUI) _renderUI();
            notifyWithVoice("✅ Ruta optimizada: " + removedCount + " punto(s) eliminado(s) (" + pts.length + " → " + optimized.length + " puntos)");
        } else { notifyWithVoice("✅ La ruta ya está optimizada."); }
        return true;
    }

    function parseRerouteLine(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'reroute' || (parts[1] !== 'line' && parts[1] !== 'linea')) return false;
        const lineTag = parts[2];
        if (!lineTag) { notifyWithVoice("Uso: reroute line TAG [mode smart|orthogonal] [elevation N]", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(lineTag);
        if (!line) { notifyWithVoice("❌ Línea " + lineTag + " no encontrada", true); return true; }
        let mode = 'smart', elevation = null;
        for (let i = 3; i < parts.length; i++) {
            if (parts[i] === 'mode') mode = (parts[++i] || 'smart').toLowerCase();
            else if (parts[i] === 'elevation' || parts[i] === 'elevacion') elevation = parseFloat(parts[++i]);
        }
        const origin = line.origin, destination = line.destination;
        if (!origin || !destination) { notifyWithVoice("❌ La línea debe tener origen y destino definidos", true); return true; }
        const material = line.material || getProjectDefaultMaterial();
        const spec = line.spec || getProjectDefaultSpec(material);
        const diameter = line.diameter || 4;
        saveStateBeforeMutation();
        if (typeof SmartFlowRouter !== 'undefined') {
            const fromTag = origin.equipTag || origin.objTag, fromPort = origin.portId;
            const toTag = destination.equipTag || destination.objTag, toPort = destination.portId;
            _core.removeLine(lineTag);
            let nuevaLinea;
            if (elevation !== null) {
                const pts = _core.getLinePoints(line) || line._cachedPoints || [];
                const startPoint = pts[0] || { x: 0, y: 0, z: 0 };
                const endPoint = pts[pts.length - 1] || { x: 0, y: 0, z: 0 };
                const midPoint = { x: (startPoint.x + endPoint.x) / 2, y: elevation, z: (startPoint.z + endPoint.z) / 2 };
                nuevaLinea = SmartFlowRouter.routeWithWaypoints(fromTag, fromPort, toTag, toPort, [midPoint], diameter, material, spec);
            } else {
                nuevaLinea = SmartFlowRouter.routeBetweenPorts(fromTag, fromPort, toTag, toPort, diameter, material, spec);
            }
            if (nuevaLinea) { const oldTag = nuevaLinea.tag; _core.updateLine(oldTag, { tag: lineTag }); if (_core.rebuildIndexes) _core.rebuildIndexes(); }
            notifyWithVoice("✅ Línea " + lineTag + " re-enrutada (modo: " + mode + (elevation ? ", elevación: " + elevation + "mm" : "") + ")", false);
        } else { notifyWithVoice("Router no disponible", true); }
        if (_renderUI) _renderUI();
        return true;
    }

    function parseSetProject(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'set' || parts[1] !== 'project') return false;
        if (parts[2] === 'defaults' || parts[2] === 'default') {
            notifyWithVoice("📐 Defaults del proyecto: Material=" + _projectDefaults.material + " | Spec=" + _projectDefaults.spec + "\nPara cambiar: set project material <MATERIAL> spec <SPEC>", false);
            return true;
        }
        let material = null, spec = null;
        for (let i = 2; i < parts.length; i++) {
            if (parts[i] === 'material' && i + 1 < parts.length) material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec' && i + 1 < parts.length) spec = parts[++i];
        }
        if (material || spec) setProjectDefaults(material, spec);
        else notifyWithVoice("Uso: set project material <MATERIAL> spec <SPEC>", true);
        return true;
    }

    // ================================================================
    //  EJECUCIÓN PRINCIPAL DE COMANDOS
    // ================================================================

    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); recordCommand(cmd); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); recordCommand(cmd); return true; }
        
        if (parseNodosAbiertos(trimmed))  { recordCommand(cmd); return true; }
        if (parseLineFromTo(trimmed))      { recordCommand(cmd); return true; }
        if (parseExtendLine(trimmed))      { recordCommand(cmd); return true; }
        if (parseOptimizeRoute(trimmed))   { recordCommand(cmd); return true; }
        if (parseRerouteLine(trimmed))     { recordCommand(cmd); return true; }
        if (parseSetProject(trimmed))      { recordCommand(cmd); return true; }
        if (parseCreateLine(trimmed)) { recordCommand(cmd); return true; }
        if (parseCreate(trimmed)) { recordCommand(cmd); return true; }
        if (parseConnect(trimmed)) { recordCommand(cmd); return true; }
        if (parseRoute(trimmed)) { recordCommand(cmd); return true; }
        if (parseDelete(trimmed)) { recordCommand(cmd); return true; }
        if (parseTap(trimmed)) { recordCommand(cmd); return true; }
        if (parseAccessoriesCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parseSplit(trimmed)) { recordCommand(cmd); return true; }
        if (parseMoveCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parsePlace(trimmed)) { recordCommand(cmd); return true; }
        if (parseRotate(trimmed)) { recordCommand(cmd); return true; }
        if (parseDuplicate(trimmed)) { recordCommand(cmd); return true; }
        if (parseAlign(trimmed)) { recordCommand(cmd); return true; }
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
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i]; const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notifyWithVoice('No entendí: "' + trimmed.substring(0, 50) + '..."', true); }
        }
        if (executed + failed > 0) notifyWithVoice(executed + ' comandos ejecutados, ' + failed + ' fallidos', failed > 0);
        return executed;
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn, voiceFn) {
        _core = coreInstance; _catalog = catalogInstance; _renderer = rendererInstance;
        _notifyUI = notifyFn || _notifyUI; _renderUI = renderFn || _renderUI; _voiceFn = voiceFn || null;
    }

    // ================================================================
    //  API PÚBLICA
    // ================================================================
    return {
        init: init, executeCommand: executeCommand, executeBatch: executeBatch,
        getPortDirectionLocal: getPortDirectionLocal, getTopSurface: getTopSurface,
        runFittingInjection: runFittingInjection,
        getMacros: function() { return _macros; },
        getHistory: function() { return window._commandHistory || []; },
        clearHistory: function() { window._commandHistory = []; },
        setProjectDefaults: setProjectDefaults,
        getProjectDefaults: function() { return { material: _projectDefaults.material, spec: _projectDefaults.spec }; },
        IntentDictionary: IntentDictionary,
        notify: notifyWithVoice
    };
})();
