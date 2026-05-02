
// SmartFlowCommands v9.4 - Completo con comando "punto"
const SmartFlowCommands = (function() {
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);

    // Diccionario bilingüe
    const LEX = {
        'crear': 'CREATE', 'create': 'CREATE', '+': 'CREATE',
        'modificar': 'MODIFY', 'editar': 'MODIFY', 'edit': 'MODIFY', '~': 'MODIFY',
        'eliminar': 'DELETE', 'borrar': 'DELETE', 'delete': 'DELETE', '-': 'DELETE',
        'mover': 'MOVE', 'move': 'MOVE', '>': 'MOVE',
        'conectar': 'CONNECT', 'connect': 'CONNECT',
        'linea': 'LINEA_WP', 'line': 'LINEA_WP',
        'info': 'INFO', '?': 'INFO', 'informacion': 'INFO',
        'listar': 'LIST', 'list': 'LIST',
        '??': 'LIST_EQUIPOS', '???': 'LIST_LINEAS',
        'ayuda': 'HELP', 'help': 'HELP', 'h': 'HELP',
        'undo': 'UNDO', 'deshacer': 'UNDO', '<<': 'UNDO',
        'redo': 'REDO', 'rehacer': 'REDO', '>>': 'REDO',
        'nodos': 'NODES', 'nodes': 'NODES',
        'punto': 'POINT', 'coordenadas': 'POINT',
        'vista': 'VIEW', 'view': 'VIEW',
        'isometrico': 'VIEW_ISO', 'iso': 'VIEW_ISO',
        'top': 'VIEW_TOP', 'planta': 'VIEW_TOP',
        'front': 'VIEW_FRONT', 'frontal': 'VIEW_FRONT',
        'side': 'VIEW_SIDE', 'lateral': 'VIEW_SIDE',
        '.': 'VIEW_ISO', '.t': 'VIEW_TOP', '.f': 'VIEW_FRONT', '.s': 'VIEW_SIDE',
        'exportar': 'EXPORT', 'export': 'EXPORT',
        '!mto': 'EXPORT_MTO', '!pcf': 'EXPORT_PCF', '!pdf': 'EXPORT_PDF',
        'guardar': 'SAVE', '!save': 'SAVE',
        'cargar': 'LOAD', '!load': 'LOAD',
        '%': 'CREATE_LINE',
        'ruta': 'CREATE_LINE',
        'resumen': 'SUMMARY', 'summary': 'SUMMARY'
    };

    function notify(msg, isErr = false) {
        if (typeof _notifyUI === 'function') {
            _notifyUI(msg, isErr);
        } else {
            const statusEl = document.getElementById('statusMsg');
            if (statusEl) {
                statusEl.innerText = msg;
                statusEl.style.color = isErr ? '#ef4444' : '#00f2ff';
            }
        }

        const speakText = msg.replace(/[✅⚠️🗑️📋📐📦↩️↪️📍]/g, '').trim();
        if (speakText) {
            if (typeof SmartFlowAccessibility !== 'undefined' && SmartFlowAccessibility.speak) {
                SmartFlowAccessibility.speak(speakText, isErr);
            } else if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(speakText);
                utterance.lang = 'es-ES';
                utterance.rate = 0.95;
                window.speechSynthesis.speak(utterance);
            }
        }
    }

    function tokenize(cmd) {
        const tokens = [];
        const regex = /(\([^)]+\)|->|@|[\w\-\.=]+|[<>+\-~%!?.]+)/g;
        let match;
        while ((match = regex.exec(cmd)) !== null) {
            tokens.push(match[0]);
        }
        return tokens;
    }

    function extractCoords(str) {
        const m = str.match(/\(?\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*\)?/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } : null;
    }

    function extractParams(tokens) {
        const p = {};
        for (const t of tokens) {
            let m = t.match(/^d(?:iam(?:etro)?)?[=:](\d+\.?\d*)/i);
            if (m) { p.diametro = parseFloat(m[1]); continue; }
            m = t.match(/^(?:h(?:eight)?|altura)[=:](\d+\.?\d*)/i);
            if (m) { p.altura = parseFloat(m[1]); continue; }
            m = t.match(/^l(?:argo)?[=:](\d+\.?\d*)/i);
            if (m) { p.largo = parseFloat(m[1]); continue; }
            m = t.match(/^m(?:aterial)?[=:](\w+[\w\-]*)/i);
            if (m) { p.material = m[1].toUpperCase(); continue; }
            m = t.match(/^s(?:pec)?[=:](\w+[\w\-]*)/i);
            if (m) { p.spec = m[1]; continue; }
            m = t.match(/^(?:w(?:idth)?|ancho)[=:](\d+\.?\d*)/i);
            if (m) { p.ancho = parseFloat(m[1]); continue; }
            m = t.match(/^(?:n|entradas|entries)[=:](\d+)/i);
            if (m) { p.entradas = parseInt(m[1]); continue; }
            m = t.match(/^(?:sp|spacing|espaciado)[=:](\d+\.?\d*)/i);
            if (m) { p.spacing = parseFloat(m[1]); continue; }
            m = t.match(/^(?:out|salida|output)[=:](\w+)/i);
            if (m) { p.salida = m[1]; continue; }
            m = t.match(/^pos[=:]\(?\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*\)?/i);
            if (m) { p.pos = { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) }; continue; }
            m = t.match(/^dir[=:]\(?\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*\)?/i);
            if (m) { p.dir = { dx: parseFloat(m[1]), dy: parseFloat(m[2]), dz: parseFloat(m[3]) }; continue; }
            if (t.match(/^status[=:](\w+)/i)) { p.status = RegExp.$1.toLowerCase(); continue; }
        }
        return p;
    }

    function parseNodeRef(str) {
        const dot = str.indexOf('.');
        if (dot > 0) return { tag: str.substring(0, dot), port: str.substring(dot + 1) };
        const at = str.indexOf('@');
        if (at > 0) return { tag: str.substring(0, at), port: str.substring(at + 1) };
        return { tag: str, port: '1' };
    }

    function getPortWorldPos(tag, portId) {
        const db = _core.getDb();
        const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
        if (!obj || typeof SmartFlowRouter === 'undefined') return null;
        return SmartFlowRouter.getPortPosition(obj, portId);
    }

    function findElbowForMaterial(material, angleDeg) {
        const mat = (material || '').toUpperCase();
        if (angleDeg < 15) return null;
        const is90 = angleDeg > 60;
        const is45 = angleDeg >= 15 && angleDeg <= 60;
        if (mat.includes('PPR')) return is90 ? 'ELBOW_90_PPR' : (is45 ? 'ELBOW_45_PPR' : null);
        if (mat.includes('HDPE')) return is90 ? 'ELBOW_90_HDPE' : null;
        if (mat.includes('PVC')) return is90 ? 'ELBOW_90_PVC' : null;
        if (mat.includes('ACERO') || mat.includes('CARBONO')) return is90 ? 'ELBOW_90_LR_CS' : (is45 ? 'ELBOW_45_CS' : null);
        if (mat.includes('INOX')) return is90 ? 'ELBOW_90_SANITARY' : null;
        return is90 ? 'ELBOW_90_LR_CS' : (is45 ? 'ELBOW_45_CS' : null);
    }

    function angleBetweenVectors(v1, v2) {
        const dot = v1.dx * v2.dx + v1.dy * v2.dy + v1.dz * v2.dz;
        return Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
    }

    function injectFittingsIntoLine(lineObj) {
        const pts = lineObj._cachedPoints || lineObj.points;
        if (!pts || pts.length < 2) return lineObj;
        const comps = lineObj.components || [];
        for (let i = 1; i < pts.length - 1; i++) {
            const seg1 = { dx: pts[i].x - pts[i-1].x, dy: pts[i].y - pts[i-1].y, dz: pts[i].z - pts[i-1].z };
            const seg2 = { dx: pts[i+1].x - pts[i].x, dy: pts[i+1].y - pts[i].y, dz: pts[i+1].z - pts[i].z };
            const len1 = Math.hypot(seg1.dx, seg1.dy, seg1.dz) || 1;
            const len2 = Math.hypot(seg2.dx, seg2.dy, seg2.dz) || 1;
            const v1 = { dx: seg1.dx/len1, dy: seg1.dy/len1, dz: seg1.dz/len1 };
            const v2 = { dx: seg2.dx/len2, dy: seg2.dy/len2, dz: seg2.dz/len2 };
            const angle = angleBetweenVectors(v1, v2);
            const elbowType = findElbowForMaterial(lineObj.material || 'PPR', angle);
            if (elbowType) {
                comps.push({
                    type: elbowType,
                    tag: `${elbowType}-${Date.now().toString(36)}`,
                    param: i / (pts.length - 1),
                    angle: Math.round(angle)
                });
            }
        }
        lineObj.components = comps;
        return lineObj;
    }

    // ==================== EJECUCIÓN PRINCIPAL ====================
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const tokens = tokenize(cmd);
        if (!tokens || !tokens.length) return false;

        // Detectar flecha para conexión (compatibilidad)
        let arrowIdx = tokens.indexOf('->');
        if (arrowIdx < 0) {
            const aIdx = tokens.findIndex(t => t.toLowerCase() === 'a' || t.toLowerCase() === 'to');
            if (aIdx > 0 && aIdx < tokens.length - 1) {
                const left = tokens.slice(0, aIdx).join('');
                const right = tokens.slice(aIdx + 1).join(' ');
                if (left.includes('.') || right.includes('.')) {
                    arrowIdx = aIdx;
                }
            }
        }
        if (arrowIdx > 0) {
            return handleConnect(tokens, arrowIdx);
        }

        const first = tokens[0].toLowerCase();
        const action = LEX[first] || first.toUpperCase();

        if (action === 'CREATE' && tokens.length >= 3 && (tokens[1].toLowerCase() === 'linea' || tokens[1].toLowerCase() === 'line')) {
            return handleCreateLineFromCreate(tokens);
        }

        switch (action) {
            case 'CREATE': return handleCreateEquipo(tokens);
            case 'CREATE_LINE': return handleCreateLine(tokens);
            case 'LINEA_WP': return handleLineWithWaypoints(tokens);
            case 'MODIFY': return handleModify(tokens);
            case 'DELETE': return handleDelete(tokens);
            case 'MOVE': return handleMove(tokens);
            case 'CONNECT':
                if (tokens && tokens.length >= 3) {
                    const left = tokens[1];
                    const right = tokens.slice(2).join('');
                    if (left && right && left.includes('.') && right.includes('.')) {
                        return handleConnect(['', left, 'a', right], 2);
                    }
                }
                notify('Formato de conexión. Use: conectar ORIGEN a DESTINO', true);
                return true;
            case 'INFO': return handleInfo(tokens);
            case 'LIST': return handleList(tokens);
            case 'LIST_EQUIPOS': listEquipos(); return true;
            case 'LIST_LINEAS': listLineas(); return true;
            case 'HELP': showHelp(); return true;
            case 'UNDO': if (_core) _core.undo(); notify('Deshacer: última acción revertida'); return true;
            case 'REDO': if (_core) _core.redo(); notify('Rehacer: última acción restablecida'); return true;
            case 'NODES': return handleNodes(tokens);
            case 'POINT': return handlePoint(tokens);
            case 'VIEW':
                if (tokens.length >= 2) {
                    const sub = tokens[1].toLowerCase();
                    if (sub === 'iso' || sub === 'isometrico') setView('iso');
                    else if (sub === 'top' || sub === 'planta') setView('top');
                    else if (sub === 'front' || sub === 'frontal') setView('front');
                    else if (sub === 'side' || sub === 'lateral') setView('side');
                    else notify('Vista no reconocida. Use: vista iso|top|front|side', true);
                } else {
                    setView('iso');
                }
                return true;
            case 'VIEW_ISO': setView('iso'); return true;
            case 'VIEW_TOP': setView('top'); return true;
            case 'VIEW_FRONT': setView('front'); return true;
            case 'VIEW_SIDE': setView('side'); return true;
            case 'EXPORT':
                if (tokens.length >= 2) {
                    const type = tokens[1].toLowerCase();
                    if (type === 'mto') { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportMTO(); else notify('Exportación MTO no disponible', true); }
                    else if (type === 'pcf') { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportPCF(); else notify('Exportación PCF no disponible', true); }
                    else if (type === 'pdf') { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportPDF(); else notify('Exportación PDF no disponible', true); }
                    else notify('Exportación no reconocida. Use: exportar mto|pcf|pdf', true);
                } else notify('Especifique: exportar mto|pcf|pdf', true);
                return true;
            case 'EXPORT_MTO': if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportMTO(); else notify('Exportación MTO no disponible', true); return true;
            case 'EXPORT_PCF': if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportPCF(); else notify('Exportación PCF no disponible', true); return true;
            case 'EXPORT_PDF': if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportPDF(); else notify('Exportación PDF no disponible', true); return true;
            case 'SAVE': {
                const state = _core.exportProject();
                localStorage.setItem('smartengp_v2_project', state);
                notify('Proyecto guardado correctamente');
                return true;
            }
            case 'LOAD': {
                const data = localStorage.getItem('smartengp_v2_project');
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        _core.importState(parsed.data || parsed);
                        notify('Proyecto cargado correctamente');
                    } catch (e) { notify('Error al cargar proyecto', true); }
                } else { notify('No hay proyecto guardado', true); }
                return true;
            }
            case 'SUMMARY': return resumen();
        }

        return false;
    }

    // -------------------- HANDLERS --------------------
    function handleCreateEquipo(tokens) {
        const enIdx = tokens.findIndex(t => t.toLowerCase() === 'en' || t.toLowerCase() === 'at');
        if (enIdx < 0) {
            notify('Formato: crear TIPO TAG en X,Y,Z [d=DIAM] [h=ALTURA] [m=MATERIAL]', true);
            return true;
        }
        const tipo = tokens[1];
        const tag = tokens[2];
        const coordTokens = tokens.slice(enIdx + 1);
        const coordStr = coordTokens.join('');
        const coords = extractCoords(coordStr);
        if (!coords) { notify('Coordenadas inválidas', true); return true; }
        const params = extractParams(coordTokens.slice(1));
        const eqDef = _catalog.getEquipment(tipo);
        if (!eqDef) {
            const tipos = _catalog.listEquipmentTypes().join(', ');
            notify(`Tipo "${tipo}" no encontrado. Disponibles: ${tipos}`, true);
            return true;
        }
        const eq = _catalog.createEquipment(tipo, tag, coords.x, coords.y, coords.z, params);
        if (eq) {
            _core.addEquipment(eq);
            if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: eq });
            const dims = [];
            if (eq.diametro) dims.push(`⌀${eq.diametro}mm`);
            if (eq.altura) dims.push(`H=${eq.altura}mm`);
            if (eq.largo) dims.push(`L=${eq.largo}mm`);
            notify(`✅ Equipo ${tag} (${eqDef.nombre}) creado en (${coords.x},${coords.y},${coords.z}) ${dims.join(' ')} Material: ${eq.material || 'N/D'} Spec: ${eq.spec || 'N/D'}`);
        }
        return true;
    }

    function handleCreateLineFromCreate(tokens) {
        let tagIdx = 2;
        if (tokens[2].toLowerCase() === 'ruta') tagIdx = 3;
        if (tagIdx >= tokens.length) { notify('Falta tag de línea', true); return true; }
        const tag = tokens[tagIdx];
        const rutaIdx = tokens.findIndex(t => t.toLowerCase() === 'ruta');
        const points = [];
        let startIdx = rutaIdx >= 0 ? rutaIdx + 1 : tagIdx + 1;
        let i = startIdx;
        while (i < tokens.length) {
            const coord = extractCoords(tokens[i]);
            if (coord) { points.push(coord); i++; }
            else break;
        }
        if (points.length < 2) { notify('Se requieren al menos 2 puntos', true); return true; }
        const params = extractParams(tokens.slice(i));
        let newLine = {
            tag,
            diameter: params.diametro || 4,
            material: params.material || 'PPR',
            spec: params.spec || 'PPR_PN12_5',
            points,
            _cachedPoints: points,
            waypoints: points.slice(1, -1),
            components: []
        };
        newLine = injectFittingsIntoLine(newLine);
        _core.addLine(newLine);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: newLine });
        notify(`✅ Línea ${tag} creada: ${newLine.diameter}" ${newLine.material}, ${points.length} puntos, ${newLine.components.length} accesorios automáticos`);
        return true;
    }

    function handleCreateLine(tokens) {
        let tagIdx = 1;
        if (tokens[0] === '%') tagIdx = 1;
        else if (tokens[0].toLowerCase() === 'ruta') tagIdx = 1;
        else { notify('Formato: % TAG X1,Y1,Z1 ...', true); return true; }
        if (tokens.length < tagIdx + 2) { notify('Uso: % TAG X1,Y1,Z1 X2,Y2,Z2 [d=DIAM] [m=MATERIAL]', true); return true; }
        const tag = tokens[tagIdx];
        const points = [];
        let i = tagIdx + 1;
        while (i < tokens.length) {
            const coord = extractCoords(tokens[i]);
            if (coord) { points.push(coord); i++; }
            else break;
        }
        if (points.length < 2) { notify('Se requieren al menos 2 puntos', true); return true; }
        const params = extractParams(tokens.slice(i));
        let newLine = {
            tag,
            diameter: params.diametro || 4,
            material: params.material || 'PPR',
            spec: params.spec || 'PPR_PN12_5',
            points,
            _cachedPoints: points,
            waypoints: points.slice(1, -1),
            components: []
        };
        newLine = injectFittingsIntoLine(newLine);
        _core.addLine(newLine);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: newLine });
        notify(`✅ Línea ${tag} creada: ${newLine.diameter}" ${newLine.material}, ${points.length} puntos, ${newLine.components.length} accesorios automáticos`);
        return true;
    }

    function handleLineWithWaypoints(tokens) {
        const desdeIdx = tokens.findIndex(t => t.toLowerCase() === 'desde');
        const porIdx = tokens.findIndex(t => t.toLowerCase() === 'por');
        const hastaIdx = tokens.findIndex(t => t.toLowerCase() === 'hasta');

        if (desdeIdx < 0 || hastaIdx < 0) {
            notify('Uso: linea TAG desde EQP.PUERTO por x,y,z ... hasta EQP.PUERTO [d=DIAM] [m=MAT]', true);
            return true;
        }

        const tag = tokens[1];
        const desdeToken = tokens[desdeIdx + 1];
        const desde = parseNodeRef(desdeToken);
        const hastaToken = tokens[hastaIdx + 1];
        const hasta = parseNodeRef(hastaToken);

        if (!desde.tag || !hasta.tag) {
            notify('Los argumentos DESDE y HASTA deben ser EQUIPO.PUERTO', true);
            return true;
        }

        const startPos = getPortWorldPos(desde.tag, desde.port);
        const endPos = getPortWorldPos(hasta.tag, hasta.port);
        if (!startPos || !endPos) {
            notify('No se pudo obtener la posición de los puertos indicados', true);
            return true;
        }

        const waypoints = [];
        if (porIdx > 0) {
            for (let i = porIdx + 1; i < hastaIdx; i++) {
                const coord = extractCoords(tokens[i]);
                if (coord) waypoints.push(coord);
            }
        }

        const points = [startPos, ...waypoints, endPos];
        const params = extractParams(tokens.slice(hastaIdx + 1));
        const diameter = params.diametro || 4;
        const material = params.material || 'PPR';
        const spec = params.spec || 'PPR_PN12_5';

        let newLine = {
            tag,
            diameter,
            material,
            spec,
            points,
            _cachedPoints: points,
            waypoints,
            components: [],
            origin: { objType: 'equipment', equipTag: desde.tag, portId: desde.port },
            destination: { objType: 'equipment', equipTag: hasta.tag, portId: hasta.port }
        };
        newLine = injectFittingsIntoLine(newLine);

        const db = _core.getDb();
        const toObj = db.equipos.find(e => e.tag === hasta.tag) || db.lines.find(l => l.tag === hasta.tag);
        if (toObj && toObj.puertos) {
            const destPort = toObj.puertos.find(p => p.id === hasta.port);
            if (destPort && Math.abs(diameter - (destPort.diametro || diameter)) > 0.01) {
                const reducerTag = `RED-${Date.now().toString(36)}`;
                newLine.components.push({
                    type: 'CONCENTRIC_REDUCER',
                    tag: reducerTag,
                    param: 0.95,
                    fromDiam: diameter,
                    toDiam: destPort.diametro
                });
            }
        }

        _core.addLine(newLine);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: newLine });

        const fromObj = db.equipos.find(e => e.tag === desde.tag) || db.lines.find(l => l.tag === desde.tag);
        if (fromObj?.puertos) {
            const p = fromObj.puertos.find(p => p.id === desde.port);
            if (p) { p.status = 'connected'; p.connectedLine = newLine.tag; }
        }
        if (toObj?.puertos) {
            const p = toObj.puertos.find(p => p.id === hasta.port);
            if (p) { p.status = 'connected'; p.connectedLine = newLine.tag; }
        }
        _core.syncPhysicalData();
        _core._saveState();

        notify(`✅ Línea ${tag} creada desde ${desde.tag}.${desde.port} hasta ${hasta.tag}.${hasta.port} con ${waypoints.length} waypoints, ${newLine.diameter}" ${newLine.material}, ${newLine.components.length} accesorios automáticos`);
        return true;
    }

    function handleModify(tokens) {
        if (tokens.length < 3) { notify('Uso: modificar TAG [prop=valor] o modificar TAG.PUERTO [pos=x,y,z] [dir=dx,dy,dz] [diam=4]', true); return true; }
        const tagOrRef = tokens[1];
        const dotIdx = tagOrRef.indexOf('.');
        if (dotIdx > 0) {
            const tag = tagOrRef.substring(0, dotIdx);
            const puertoId = tagOrRef.substring(dotIdx + 1);
            const params = extractParams(tokens.slice(2));
            const cambios = {};
            if (params.pos) cambios.pos = params.pos;
            if (params.dir) cambios.dir = params.dir;
            if (params.diametro !== undefined) cambios.diametro = params.diametro;
            if (params.status) cambios.status = params.status;
            if (Object.keys(cambios).length === 0) { notify('Propiedades de puerto no reconocidas', true); return true; }
            const ok = _core.updatePuerto(tag, puertoId, cambios);
            if (ok) notify(`✅ Puerto ${puertoId} de ${tag} modificado`);
            else notify(`No se pudo modificar el puerto ${puertoId}`, true);
            return true;
        }

        const tag = tagOrRef;
        const params = extractParams(tokens.slice(2));
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (eq) {
            const updates = {};
            if (params.diametro !== undefined) updates.diametro = params.diametro;
            if (params.altura !== undefined) updates.altura = params.altura;
            if (params.largo !== undefined) updates.largo = params.largo;
            if (params.ancho !== undefined) updates.ancho = params.ancho;
            if (params.material) updates.material = params.material;
            if (params.spec) updates.spec = params.spec;
            if (Object.keys(updates).length) {
                _core.updateEquipment(tag, updates);
                notify(`✅ Equipo ${tag} modificado: ${JSON.stringify(updates)}`);
            } else { notify('Sin cambios para aplicar', true); }
            return true;
        }
        const line = db.lines.find(l => l.tag === tag);
        if (line) {
            const updates = {};
            if (params.diametro !== undefined) updates.diameter = params.diametro;
            if (params.material) updates.material = params.material;
            if (params.spec) updates.spec = params.spec;
            if (Object.keys(updates).length) {
                _core.updateLine(tag, updates);
                notify(`✅ Línea ${tag} modificada: ${JSON.stringify(updates)}`);
            } else { notify('Sin cambios para aplicar', true); }
            return true;
        }
        notify(`Elemento ${tag} no encontrado`, true);
        return true;
    }

    function handleDelete(tokens) {
        if (tokens.length < 2) { notify('Uso: eliminar TAG', true); return true; }
        const tag = tokens[1];
        const db = _core.getDb();
        if (db.equipos.some(e => e.tag === tag)) {
            _core.deleteEquipment(tag);
            notify(`🗑️ Equipo ${tag} eliminado`);
            return true;
        }
        if (db.lines.some(l => l.tag === tag)) {
            _core.deleteLine(tag);
            notify(`🗑️ Línea ${tag} eliminada`);
            return true;
        }
        notify(`${tag} no encontrado`, true);
        return true;
    }

    function handleMove(tokens) {
        const aIdx = tokens.findIndex(t => t.toLowerCase() === 'a' || t.toLowerCase() === 'to');
        if (aIdx < 0) { notify('Uso: mover TAG a X,Y,Z', true); return true; }
        const tag = tokens[1];
        const coordStr = tokens.slice(aIdx + 1).join('');
        const coords = extractCoords(coordStr);
        if (!coords) { notify('Coordenadas inválidas', true); return true; }
        const db = _core.getDb();
        if (db.equipos.find(e => e.tag === tag)) {
            _core.updateEquipment(tag, { posX: coords.x, posY: coords.y, posZ: coords.z });
            notify(`✅ Equipo ${tag} movido a (${coords.x},${coords.y},${coords.z})`);
        } else {
            notify(`Solo se pueden mover equipos. ${tag} no es un equipo.`, true);
        }
        return true;
    }

    function handleConnect(tokens, arrowIdx) {
        const leftSide = tokens.slice(0, arrowIdx);
        const rightSide = tokens.slice(arrowIdx + 1);
        if (!rightSide.length) { notify('Falta destino después de la palabra de enlace', true); return true; }
        const left = parseNodeRef(leftSide.join(''));
        const right = parseNodeRef(rightSide[0]);
        if (!left.tag || !right.tag) { notify('Origen o destino inválido', true); return true; }
        const params = extractParams(rightSide.slice(1));
        const diam = params.diametro || 4;
        const mat = params.material || 'PPR';
        const spec = params.spec || 'PPR_PN12_5';

        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(left.tag, left.port, right.tag, right.port, diam, mat, spec);
        } else {
            notify('Router no disponible', true);
        }
        return true;
    }

    function handleInfo(tokens) {
        if (tokens.length < 2) { notify('Uso: info TAG', true); return true; }
        const tag = tokens[1];
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (eq) {
            let info = `${eq.tag} | ${eq.tipo} | Pos: (${eq.posX},${eq.posY},${eq.posZ}) | ⌀${eq.diametro || '?'} H=${eq.altura || '?'} | ${eq.material || 'N/D'}`;
            if (eq.puertos) info += ` | Puertos: ${eq.puertos.map(p => `${p.id}(${p.status})`).join(', ')}`;
            notify(info);
            return true;
        }
        const line = db.lines.find(l => l.tag === tag);
        if (line) {
            const pts = line._cachedPoints || [];
            let info = `${line.tag} | ${line.diameter}" ${line.material || 'N/D'} | Puntos: ${pts.length}`;
            if (line.origin) info += ` | De: ${line.origin.equipTag}.${line.origin.portId}`;
            if (line.destination) info += ` | A: ${line.destination.equipTag}.${line.destination.portId}`;
            if (line.components) info += ` | Componentes: ${line.components.length}`;
            notify(info);
            return true;
        }
        notify(`${tag} no encontrado`, true);
        return true;
    }

    function handleList(tokens) {
        const sub = tokens[1] ? tokens[1].toLowerCase() : '';
        if (sub === 'components' || sub === 'componentes') {
            const types = _catalog.listComponentTypes();
            notify(`Componentes disponibles: ${types.sort().join(', ')}`);
        } else if (sub === 'equipment' || sub === 'equipos') {
            listEquipos();
        } else if (sub === 'líneas' || sub === 'lineas') {
            listLineas();
        } else if (sub === 'specs' || sub === 'especificaciones') {
            const specs = _catalog.listSpecs();
            notify(`Especificaciones: ${specs.sort().join(', ')}`);
        } else {
            notify('Use: listar equipos | listar lineas | listar componentes | listar especificaciones');
        }
        return true;
    }

    function listEquipos() {
        const db = _core.getDb();
        const equipos = db.equipos;
        if (equipos.length === 0) { notify('No hay equipos'); return; }
        notify(`Equipos (${equipos.length}): ${equipos.map(e => e.tag).join(', ')}`);
    }

    function listLineas() {
        const db = _core.getDb();
        const lines = db.lines;
        if (lines.length === 0) { notify('No hay líneas'); return; }
        notify(`Líneas (${lines.length}): ${lines.map(l => `${l.tag}(${l.diameter}" ${l.material || '?'})`).join(', ')}`);
    }

    function handleNodes(tokens) {
        if (tokens.length < 2) { notify('Uso: nodos TAG', true); return true; }
        const tag = tokens[1];
        const db = _core.getDb();
        const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
        if (!obj) { notify(`${tag} no encontrado`, true); return true; }
        let nodes = [];
        if (obj.posX !== undefined) {
            nodes = (obj.puertos || []).map(p => `${p.id}: ⌀${p.diametro || '?'}" ${p.status}`);
        } else {
            nodes = ['START', 'END'];
            if (obj.puertos) nodes.push(...obj.puertos.filter(p => p.id !== 'START' && p.id !== 'END').map(p => p.id));
        }
        notify(`Nodos de ${tag}: ${nodes.join(', ')}`);
        return true;
    }

    function handlePoint(tokens) {
        if (tokens.length < 2) {
            notify('Uso: punto EQUIPO.PUERTO o punto LINEA@POS o punto LINEA.EXTREMO', true);
            return true;
        }
        const ref = tokens[1];
        const dotIdx = ref.indexOf('.');
        const atIdx = ref.indexOf('@');

        let tag, portOrPos;
        if (atIdx > 0) {
            tag = ref.substring(0, atIdx);
            portOrPos = ref.substring(atIdx + 1);
        } else if (dotIdx > 0) {
            tag = ref.substring(0, dotIdx);
            portOrPos = ref.substring(dotIdx + 1);
        } else {
            notify('Formato incorrecto. Use TAG.PUERTO o TAG@POS', true);
            return true;
        }

        const db = _core.getDb();
        const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
        if (!obj) {
            notify(`Elemento ${tag} no encontrado`, true);
            return true;
        }

        let coords = null;
        if (obj.posX !== undefined) {
            const port = obj.puertos?.find(p => p.id === portOrPos);
            if (!port) {
                notify(`Puerto ${portOrPos} no encontrado en ${tag}`, true);
                return true;
            }
            coords = {
                x: obj.posX + (port.relX || 0),
                y: obj.posY + (port.relY || 0),
                z: obj.posZ + (port.relZ || 0)
            };
        } else {
            const pts = obj.points || obj._cachedPoints;
            if (!pts || pts.length < 2) {
                notify(`Línea ${tag} sin geometría`, true);
                return true;
            }
            if (portOrPos === '0' || portOrPos.toUpperCase() === 'START') {
                coords = { x: pts[0].x, y: pts[0].y, z: pts[0].z };
            } else if (portOrPos === '1' || portOrPos.toUpperCase() === 'END') {
                const last = pts.length - 1;
                coords = { x: pts[last].x, y: pts[last].y, z: pts[last].z };
            } else {
                const param = parseFloat(portOrPos);
                if (isNaN(param) || param < 0 || param > 1) {
                    notify(`Posición inválida. Use 0-1, START, END o un puerto virtual`, true);
                    return true;
                }
                let totalLen = 0, lengths = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                    lengths.push(d);
                    totalLen += d;
                }
                if (totalLen === 0) { notify('Línea sin longitud', true); return true; }
                const target = totalLen * param;
                let accum = 0, segIdx = 0, t = 0;
                for (let i = 0; i < lengths.length; i++) {
                    if (accum + lengths[i] >= target || i === lengths.length - 1) {
                        segIdx = i;
                        t = (target - accum) / (lengths[i] || 1);
                        break;
                    }
                    accum += lengths[i];
                }
                const pA = pts[segIdx], pB = pts[segIdx + 1];
                coords = {
                    x: pA.x + (pB.x - pA.x) * t,
                    y: pA.y + (pB.y - pA.y) * t,
                    z: pA.z + (pB.z - pA.z) * t
                };
            }
        }

        if (!coords) {
            notify('No se pudieron calcular las coordenadas', true);
            return true;
        }

        const msg = `📍 ${ref}: X=${coords.x.toFixed(1)}, Y=${coords.y.toFixed(1)}, Z=${coords.z.toFixed(1)} mm`;
        notify(msg);
        return true;
    }

    function setView(view) {
        if (typeof SmartFlowRender !== 'undefined') {
            if (view === 'iso' && SmartFlowRender.fitCameraToEquipments) {
                SmartFlowRender.fitCameraToEquipments();
            } else if (SmartFlowRender.setView) {
                SmartFlowRender.setView(view);
            }
            notify(`Vista: ${view}`);
        }
    }

    function resumen() {
        const db = _core.getDb();
        const equipos = db.equipos || [];
        const lines = db.lines || [];

        let tanques = 0, bombas = 0, otros = 0;
        equipos.forEach(e => {
            if (e.tipo.includes('tanque')) tanques++;
            else if (e.tipo.includes('bomba')) bombas++;
            else otros++;
        });

        let totalCodos = 0, totalValvulas = 0, totalReductores = 0;
        let longitudTotal = 0;
        lines.forEach(l => {
            const pts = l._cachedPoints || l.points;
            if (pts && pts.length >= 2) {
                for (let i = 0; i < pts.length - 1; i++) {
                    longitudTotal += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                }
            }
            if (l.components) {
                l.components.forEach(c => {
                    if (c.type && c.type.includes('ELBOW')) totalCodos++;
                    else if (c.type && c.type.includes('VALVE')) totalValvulas++;
                    else if (c.type && c.type.includes('REDUC')) totalReductores++;
                });
            }
        });

        const msg = `Resumen del proyecto: ${equipos.length} equipos (${tanques} tanques, ${bombas} bombas, ${otros} otros). ` +
                    `${lines.length} líneas. Longitud total de tubería: ${(longitudTotal/1000).toFixed(2)} metros. ` +
                    `Componentes: ${totalCodos} codos, ${totalValvulas} válvulas, ${totalReductores} reductores.`;
        notify(msg);
        return true;
    }

    function showHelp() {
        const help = [
            '═══ SMARTFLOW 3D - COMANDOS ═══',
            'CREAR EQUIPO:',
            '  crear TIPO TAG en X,Y,Z [d=DIAM] [h=ALTURA] [m=MAT]',
            'CREAR LÍNEA SUELTA (colectores, distribuidores):',
            '  crear linea TAG ruta X1,Y1,Z1 X2,Y2,Z2 ... [d=DIAM] [m=MAT]',
            'CREAR LÍNEA CON WAYPOINTS:',
            '  linea TAG desde EQP.PUERTO por x,y,z ... hasta EQP.PUERTO [d=DIAM] [m=MAT]',
            'CONECTAR:',
            '  conectar EQP1.PUERTO1 a EQP2.PUERTO2 [d=DIAM] [m=MAT]',
            '  EQP1.PUERTO1 a LINEA@0.5',
            'MODIFICAR:',
            '  modificar TAG d=3000 m=HDPE',
            '  modificar TAG.PUERTO pos=500,200,0 dir=0,1,0 diam=4 status=open',
            'MOVER:',
            '  mover TAG a X,Y,Z',
            'ELIMINAR: eliminar TAG',
            'CONSULTAR: info TAG  listar equipos  listar lineas  nodos TAG  resumen',
            'COORDENADAS: punto TAG.PUERTO  o  punto LINEA@0.5',
            'VISTAS: vista iso  vista top  vista front  vista side',
            'OTROS: deshacer  rehacer  ayuda  exportar mto/pcf/pdf  guardar  cargar'
        ].join('\n');
        notify(help);
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0, failed = 0;
        for (let raw of lines) {
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notify(`No entendí: "${trimmed.substring(0, 50)}"`, true); }
        }
        if (executed + failed > 0) {
            notify(`${executed} comandos ejecutados, ${failed} fallidos`, failed > 0);
        }
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _notifyUI = notifyFn;
        console.log("Commands v9.4 con comando 'punto' listo");
    }

    return { init, executeCommand, executeBatch };
})();
```

Copia este código completo en tu archivo js/commands.js, reemplazando el anterior. Con esto tendrás todas las funcionalidades actualizadas, incluido el nuevo comando punto (o coordenadas) que te dará las coordenadas exactas de cualquier nodo, con notificación de voz y visual. Aquí tienes el archivo commands.js v9.4 completo, que unifica todas las mejoras que hemos trabajado: notificaciones con voz y visuales, tokenización de parámetros, comando resumen, manejo robusto de conexiones y el nuevo comando punto (o coordenadas) para obtener las coordenadas exactas de cualquier nodo o punto de una línea.

```javascript
// SmartFlowCommands v9.4 - Completo con comando "punto"
const SmartFlowCommands = (function() {
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);

    // Diccionario bilingüe
    const LEX = {
        'crear': 'CREATE', 'create': 'CREATE', '+': 'CREATE',
        'modificar': 'MODIFY', 'editar': 'MODIFY', 'edit': 'MODIFY', '~': 'MODIFY',
        'eliminar': 'DELETE', 'borrar': 'DELETE', 'delete': 'DELETE', '-': 'DELETE',
        'mover': 'MOVE', 'move': 'MOVE', '>': 'MOVE',
        'conectar': 'CONNECT', 'connect': 'CONNECT',
        'linea': 'LINEA_WP', 'line': 'LINEA_WP',
        'info': 'INFO', '?': 'INFO', 'informacion': 'INFO',
        'listar': 'LIST', 'list': 'LIST',
        '??': 'LIST_EQUIPOS', '???': 'LIST_LINEAS',
        'ayuda': 'HELP', 'help': 'HELP', 'h': 'HELP',
        'undo': 'UNDO', 'deshacer': 'UNDO', '<<': 'UNDO',
        'redo': 'REDO', 'rehacer': 'REDO', '>>': 'REDO',
        'nodos': 'NODES', 'nodes': 'NODES',
        'punto': 'POINT', 'coordenadas': 'POINT',
        'vista': 'VIEW', 'view': 'VIEW',
        'isometrico': 'VIEW_ISO', 'iso': 'VIEW_ISO',
        'top': 'VIEW_TOP', 'planta': 'VIEW_TOP',
        'front': 'VIEW_FRONT', 'frontal': 'VIEW_FRONT',
        'side': 'VIEW_SIDE', 'lateral': 'VIEW_SIDE',
        '.': 'VIEW_ISO', '.t': 'VIEW_TOP', '.f': 'VIEW_FRONT', '.s': 'VIEW_SIDE',
        'exportar': 'EXPORT', 'export': 'EXPORT',
        '!mto': 'EXPORT_MTO', '!pcf': 'EXPORT_PCF', '!pdf': 'EXPORT_PDF',
        'guardar': 'SAVE', '!save': 'SAVE',
        'cargar': 'LOAD', '!load': 'LOAD',
        '%': 'CREATE_LINE',
        'ruta': 'CREATE_LINE',
        'resumen': 'SUMMARY', 'summary': 'SUMMARY'
    };

    function notify(msg, isErr = false) {
        if (typeof _notifyUI === 'function') {
            _notifyUI(msg, isErr);
        } else {
            const statusEl = document.getElementById('statusMsg');
            if (statusEl) {
                statusEl.innerText = msg;
                statusEl.style.color = isErr ? '#ef4444' : '#00f2ff';
            }
        }

        const speakText = msg.replace(/[✅⚠️🗑️📋📐📦↩️↪️📍]/g, '').trim();
        if (speakText) {
            if (typeof SmartFlowAccessibility !== 'undefined' && SmartFlowAccessibility.speak) {
                SmartFlowAccessibility.speak(speakText, isErr);
            } else if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(speakText);
                utterance.lang = 'es-ES';
                utterance.rate = 0.95;
                window.speechSynthesis.speak(utterance);
            }
        }
    }

    function tokenize(cmd) {
        const tokens = [];
        const regex = /(\([^)]+\)|->|@|[\w\-\.=]+|[<>+\-~%!?.]+)/g;
        let match;
        while ((match = regex.exec(cmd)) !== null) {
            tokens.push(match[0]);
        }
        return tokens;
    }

    function extractCoords(str) {
        const m = str.match(/\(?\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*\)?/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } : null;
    }

    function extractParams(tokens) {
        const p = {};
        for (const t of tokens) {
            let m = t.match(/^d(?:iam(?:etro)?)?[=:](\d+\.?\d*)/i);
            if (m) { p.diametro = parseFloat(m[1]); continue; }
            m = t.match(/^(?:h(?:eight)?|altura)[=:](\d+\.?\d*)/i);
            if (m) { p.altura = parseFloat(m[1]); continue; }
            m = t.match(/^l(?:argo)?[=:](\d+\.?\d*)/i);
            if (m) { p.largo = parseFloat(m[1]); continue; }
            m = t.match(/^m(?:aterial)?[=:](\w+[\w\-]*)/i);
            if (m) { p.material = m[1].toUpperCase(); continue; }
            m = t.match(/^s(?:pec)?[=:](\w+[\w\-]*)/i);
            if (m) { p.spec = m[1]; continue; }
            m = t.match(/^(?:w(?:idth)?|ancho)[=:](\d+\.?\d*)/i);
            if (m) { p.ancho = parseFloat(m[1]); continue; }
            m = t.match(/^(?:n|entradas|entries)[=:](\d+)/i);
            if (m) { p.entradas = parseInt(m[1]); continue; }
            m = t.match(/^(?:sp|spacing|espaciado)[=:](\d+\.?\d*)/i);
            if (m) { p.spacing = parseFloat(m[1]); continue; }
            m = t.match(/^(?:out|salida|output)[=:](\w+)/i);
            if (m) { p.salida = m[1]; continue; }
            m = t.match(/^pos[=:]\(?\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*\)?/i);
            if (m) { p.pos = { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) }; continue; }
            m = t.match(/^dir[=:]\(?\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*\)?/i);
            if (m) { p.dir = { dx: parseFloat(m[1]), dy: parseFloat(m[2]), dz: parseFloat(m[3]) }; continue; }
            if (t.match(/^status[=:](\w+)/i)) { p.status = RegExp.$1.toLowerCase(); continue; }
        }
        return p;
    }

    function parseNodeRef(str) {
        const dot = str.indexOf('.');
        if (dot > 0) return { tag: str.substring(0, dot), port: str.substring(dot + 1) };
        const at = str.indexOf('@');
        if (at > 0) return { tag: str.substring(0, at), port: str.substring(at + 1) };
        return { tag: str, port: '1' };
    }

    function getPortWorldPos(tag, portId) {
        const db = _core.getDb();
        const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
        if (!obj || typeof SmartFlowRouter === 'undefined') return null;
        return SmartFlowRouter.getPortPosition(obj, portId);
    }

    function findElbowForMaterial(material, angleDeg) {
        const mat = (material || '').toUpperCase();
        if (angleDeg < 15) return null;
        const is90 = angleDeg > 60;
        const is45 = angleDeg >= 15 && angleDeg <= 60;
        if (mat.includes('PPR')) return is90 ? 'ELBOW_90_PPR' : (is45 ? 'ELBOW_45_PPR' : null);
        if (mat.includes('HDPE')) return is90 ? 'ELBOW_90_HDPE' : null;
        if (mat.includes('PVC')) return is90 ? 'ELBOW_90_PVC' : null;
        if (mat.includes('ACERO') || mat.includes('CARBONO')) return is90 ? 'ELBOW_90_LR_CS' : (is45 ? 'ELBOW_45_CS' : null);
        if (mat.includes('INOX')) return is90 ? 'ELBOW_90_SANITARY' : null;
        return is90 ? 'ELBOW_90_LR_CS' : (is45 ? 'ELBOW_45_CS' : null);
    }

    function angleBetweenVectors(v1, v2) {
        const dot = v1.dx * v2.dx + v1.dy * v2.dy + v1.dz * v2.dz;
        return Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
    }

    function injectFittingsIntoLine(lineObj) {
        const pts = lineObj._cachedPoints || lineObj.points;
        if (!pts || pts.length < 2) return lineObj;
        const comps = lineObj.components || [];
        for (let i = 1; i < pts.length - 1; i++) {
            const seg1 = { dx: pts[i].x - pts[i-1].x, dy: pts[i].y - pts[i-1].y, dz: pts[i].z - pts[i-1].z };
            const seg2 = { dx: pts[i+1].x - pts[i].x, dy: pts[i+1].y - pts[i].y, dz: pts[i+1].z - pts[i].z };
            const len1 = Math.hypot(seg1.dx, seg1.dy, seg1.dz) || 1;
            const len2 = Math.hypot(seg2.dx, seg2.dy, seg2.dz) || 1;
            const v1 = { dx: seg1.dx/len1, dy: seg1.dy/len1, dz: seg1.dz/len1 };
            const v2 = { dx: seg2.dx/len2, dy: seg2.dy/len2, dz: seg2.dz/len2 };
            const angle = angleBetweenVectors(v1, v2);
            const elbowType = findElbowForMaterial(lineObj.material || 'PPR', angle);
            if (elbowType) {
                comps.push({
                    type: elbowType,
                    tag: `${elbowType}-${Date.now().toString(36)}`,
                    param: i / (pts.length - 1),
                    angle: Math.round(angle)
                });
            }
        }
        lineObj.components = comps;
        return lineObj;
    }

    // ==================== EJECUCIÓN PRINCIPAL ====================
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const tokens = tokenize(cmd);
        if (!tokens || !tokens.length) return false;

        // Detectar flecha para conexión (compatibilidad)
        let arrowIdx = tokens.indexOf('->');
        if (arrowIdx < 0) {
            const aIdx = tokens.findIndex(t => t.toLowerCase() === 'a' || t.toLowerCase() === 'to');
            if (aIdx > 0 && aIdx < tokens.length - 1) {
                const left = tokens.slice(0, aIdx).join('');
                const right = tokens.slice(aIdx + 1).join(' ');
                if (left.includes('.') || right.includes('.')) {
                    arrowIdx = aIdx;
                }
            }
        }
        if (arrowIdx > 0) {
            return handleConnect(tokens, arrowIdx);
        }

        const first = tokens[0].toLowerCase();
        const action = LEX[first] || first.toUpperCase();

        if (action === 'CREATE' && tokens.length >= 3 && (tokens[1].toLowerCase() === 'linea' || tokens[1].toLowerCase() === 'line')) {
            return handleCreateLineFromCreate(tokens);
        }

        switch (action) {
            case 'CREATE': return handleCreateEquipo(tokens);
            case 'CREATE_LINE': return handleCreateLine(tokens);
            case 'LINEA_WP': return handleLineWithWaypoints(tokens);
            case 'MODIFY': return handleModify(tokens);
            case 'DELETE': return handleDelete(tokens);
            case 'MOVE': return handleMove(tokens);
            case 'CONNECT':
                if (tokens && tokens.length >= 3) {
                    const left = tokens[1];
                    const right = tokens.slice(2).join('');
                    if (left && right && left.includes('.') && right.includes('.')) {
                        return handleConnect(['', left, 'a', right], 2);
                    }
                }
                notify('Formato de conexión. Use: conectar ORIGEN a DESTINO', true);
                return true;
            case 'INFO': return handleInfo(tokens);
            case 'LIST': return handleList(tokens);
            case 'LIST_EQUIPOS': listEquipos(); return true;
            case 'LIST_LINEAS': listLineas(); return true;
            case 'HELP': showHelp(); return true;
            case 'UNDO': if (_core) _core.undo(); notify('Deshacer: última acción revertida'); return true;
            case 'REDO': if (_core) _core.redo(); notify('Rehacer: última acción restablecida'); return true;
            case 'NODES': return handleNodes(tokens);
            case 'POINT': return handlePoint(tokens);
            case 'VIEW':
                if (tokens.length >= 2) {
                    const sub = tokens[1].toLowerCase();
                    if (sub === 'iso' || sub === 'isometrico') setView('iso');
                    else if (sub === 'top' || sub === 'planta') setView('top');
                    else if (sub === 'front' || sub === 'frontal') setView('front');
                    else if (sub === 'side' || sub === 'lateral') setView('side');
                    else notify('Vista no reconocida. Use: vista iso|top|front|side', true);
                } else {
                    setView('iso');
                }
                return true;
            case 'VIEW_ISO': setView('iso'); return true;
            case 'VIEW_TOP': setView('top'); return true;
            case 'VIEW_FRONT': setView('front'); return true;
            case 'VIEW_SIDE': setView('side'); return true;
            case 'EXPORT':
                if (tokens.length >= 2) {
                    const type = tokens[1].toLowerCase();
                    if (type === 'mto') { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportMTO(); else notify('Exportación MTO no disponible', true); }
                    else if (type === 'pcf') { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportPCF(); else notify('Exportación PCF no disponible', true); }
                    else if (type === 'pdf') { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportPDF(); else notify('Exportación PDF no disponible', true); }
                    else notify('Exportación no reconocida. Use: exportar mto|pcf|pdf', true);
                } else notify('Especifique: exportar mto|pcf|pdf', true);
                return true;
            case 'EXPORT_MTO': if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportMTO(); else notify('Exportación MTO no disponible', true); return true;
            case 'EXPORT_PCF': if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportPCF(); else notify('Exportación PCF no disponible', true); return true;
            case 'EXPORT_PDF': if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.exportPDF(); else notify('Exportación PDF no disponible', true); return true;
            case 'SAVE': {
                const state = _core.exportProject();
                localStorage.setItem('smartengp_v2_project', state);
                notify('Proyecto guardado correctamente');
                return true;
            }
            case 'LOAD': {
                const data = localStorage.getItem('smartengp_v2_project');
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        _core.importState(parsed.data || parsed);
                        notify('Proyecto cargado correctamente');
                    } catch (e) { notify('Error al cargar proyecto', true); }
                } else { notify('No hay proyecto guardado', true); }
                return true;
            }
            case 'SUMMARY': return resumen();
        }

        return false;
    }

    // -------------------- HANDLERS --------------------
    function handleCreateEquipo(tokens) {
        const enIdx = tokens.findIndex(t => t.toLowerCase() === 'en' || t.toLowerCase() === 'at');
        if (enIdx < 0) {
            notify('Formato: crear TIPO TAG en X,Y,Z [d=DIAM] [h=ALTURA] [m=MATERIAL]', true);
            return true;
        }
        const tipo = tokens[1];
        const tag = tokens[2];
        const coordTokens = tokens.slice(enIdx + 1);
        const coordStr = coordTokens.join('');
        const coords = extractCoords(coordStr);
        if (!coords) { notify('Coordenadas inválidas', true); return true; }
        const params = extractParams(coordTokens.slice(1));
        const eqDef = _catalog.getEquipment(tipo);
        if (!eqDef) {
            const tipos = _catalog.listEquipmentTypes().join(', ');
            notify(`Tipo "${tipo}" no encontrado. Disponibles: ${tipos}`, true);
            return true;
        }
        const eq = _catalog.createEquipment(tipo, tag, coords.x, coords.y, coords.z, params);
        if (eq) {
            _core.addEquipment(eq);
            if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: eq });
            const dims = [];
            if (eq.diametro) dims.push(`⌀${eq.diametro}mm`);
            if (eq.altura) dims.push(`H=${eq.altura}mm`);
            if (eq.largo) dims.push(`L=${eq.largo}mm`);
            notify(`✅ Equipo ${tag} (${eqDef.nombre}) creado en (${coords.x},${coords.y},${coords.z}) ${dims.join(' ')} Material: ${eq.material || 'N/D'} Spec: ${eq.spec || 'N/D'}`);
        }
        return true;
    }

    function handleCreateLineFromCreate(tokens) {
        let tagIdx = 2;
        if (tokens[2].toLowerCase() === 'ruta') tagIdx = 3;
        if (tagIdx >= tokens.length) { notify('Falta tag de línea', true); return true; }
        const tag = tokens[tagIdx];
        const rutaIdx = tokens.findIndex(t => t.toLowerCase() === 'ruta');
        const points = [];
        let startIdx = rutaIdx >= 0 ? rutaIdx + 1 : tagIdx + 1;
        let i = startIdx;
        while (i < tokens.length) {
            const coord = extractCoords(tokens[i]);
            if (coord) { points.push(coord); i++; }
            else break;
        }
        if (points.length < 2) { notify('Se requieren al menos 2 puntos', true); return true; }
        const params = extractParams(tokens.slice(i));
        let newLine = {
            tag,
            diameter: params.diametro || 4,
            material: params.material || 'PPR',
            spec: params.spec || 'PPR_PN12_5',
            points,
            _cachedPoints: points,
            waypoints: points.slice(1, -1),
            components: []
        };
        newLine = injectFittingsIntoLine(newLine);
        _core.addLine(newLine);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: newLine });
        notify(`✅ Línea ${tag} creada: ${newLine.diameter}" ${newLine.material}, ${points.length} puntos, ${newLine.components.length} accesorios automáticos`);
        return true;
    }

    function handleCreateLine(tokens) {
        let tagIdx = 1;
        if (tokens[0] === '%') tagIdx = 1;
        else if (tokens[0].toLowerCase() === 'ruta') tagIdx = 1;
        else { notify('Formato: % TAG X1,Y1,Z1 ...', true); return true; }
        if (tokens.length < tagIdx + 2) { notify('Uso: % TAG X1,Y1,Z1 X2,Y2,Z2 [d=DIAM] [m=MATERIAL]', true); return true; }
        const tag = tokens[tagIdx];
        const points = [];
        let i = tagIdx + 1;
        while (i < tokens.length) {
            const coord = extractCoords(tokens[i]);
            if (coord) { points.push(coord); i++; }
            else break;
        }
        if (points.length < 2) { notify('Se requieren al menos 2 puntos', true); return true; }
        const params = extractParams(tokens.slice(i));
        let newLine = {
            tag,
            diameter: params.diametro || 4,
            material: params.material || 'PPR',
            spec: params.spec || 'PPR_PN12_5',
            points,
            _cachedPoints: points,
            waypoints: points.slice(1, -1),
            components: []
        };
        newLine = injectFittingsIntoLine(newLine);
        _core.addLine(newLine);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: newLine });
        notify(`✅ Línea ${tag} creada: ${newLine.diameter}" ${newLine.material}, ${points.length} puntos, ${newLine.components.length} accesorios automáticos`);
        return true;
    }

    function handleLineWithWaypoints(tokens) {
        const desdeIdx = tokens.findIndex(t => t.toLowerCase() === 'desde');
        const porIdx = tokens.findIndex(t => t.toLowerCase() === 'por');
        const hastaIdx = tokens.findIndex(t => t.toLowerCase() === 'hasta');

        if (desdeIdx < 0 || hastaIdx < 0) {
            notify('Uso: linea TAG desde EQP.PUERTO por x,y,z ... hasta EQP.PUERTO [d=DIAM] [m=MAT]', true);
            return true;
        }

        const tag = tokens[1];
        const desdeToken = tokens[desdeIdx + 1];
        const desde = parseNodeRef(desdeToken);
        const hastaToken = tokens[hastaIdx + 1];
        const hasta = parseNodeRef(hastaToken);

        if (!desde.tag || !hasta.tag) {
            notify('Los argumentos DESDE y HASTA deben ser EQUIPO.PUERTO', true);
            return true;
        }

        const startPos = getPortWorldPos(desde.tag, desde.port);
        const endPos = getPortWorldPos(hasta.tag, hasta.port);
        if (!startPos || !endPos) {
            notify('No se pudo obtener la posición de los puertos indicados', true);
            return true;
        }

        const waypoints = [];
        if (porIdx > 0) {
            for (let i = porIdx + 1; i < hastaIdx; i++) {
                const coord = extractCoords(tokens[i]);
                if (coord) waypoints.push(coord);
            }
        }

        const points = [startPos, ...waypoints, endPos];
        const params = extractParams(tokens.slice(hastaIdx + 1));
        const diameter = params.diametro || 4;
        const material = params.material || 'PPR';
        const spec = params.spec || 'PPR_PN12_5';

        let newLine = {
            tag,
            diameter,
            material,
            spec,
            points,
            _cachedPoints: points,
            waypoints,
            components: [],
            origin: { objType: 'equipment', equipTag: desde.tag, portId: desde.port },
            destination: { objType: 'equipment', equipTag: hasta.tag, portId: hasta.port }
        };
        newLine = injectFittingsIntoLine(newLine);

        const db = _core.getDb();
        const toObj = db.equipos.find(e => e.tag === hasta.tag) || db.lines.find(l => l.tag === hasta.tag);
        if (toObj && toObj.puertos) {
            const destPort = toObj.puertos.find(p => p.id === hasta.port);
            if (destPort && Math.abs(diameter - (destPort.diametro || diameter)) > 0.01) {
                const reducerTag = `RED-${Date.now().toString(36)}`;
                newLine.components.push({
                    type: 'CONCENTRIC_REDUCER',
                    tag: reducerTag,
                    param: 0.95,
                    fromDiam: diameter,
                    toDiam: destPort.diametro
                });
            }
        }

        _core.addLine(newLine);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: newLine });

        const fromObj = db.equipos.find(e => e.tag === desde.tag) || db.lines.find(l => l.tag === desde.tag);
        if (fromObj?.puertos) {
            const p = fromObj.puertos.find(p => p.id === desde.port);
            if (p) { p.status = 'connected'; p.connectedLine = newLine.tag; }
        }
        if (toObj?.puertos) {
            const p = toObj.puertos.find(p => p.id === hasta.port);
            if (p) { p.status = 'connected'; p.connectedLine = newLine.tag; }
        }
        _core.syncPhysicalData();
        _core._saveState();

        notify(`✅ Línea ${tag} creada desde ${desde.tag}.${desde.port} hasta ${hasta.tag}.${hasta.port} con ${waypoints.length} waypoints, ${newLine.diameter}" ${newLine.material}, ${newLine.components.length} accesorios automáticos`);
        return true;
    }

    function handleModify(tokens) {
        if (tokens.length < 3) { notify('Uso: modificar TAG [prop=valor] o modificar TAG.PUERTO [pos=x,y,z] [dir=dx,dy,dz] [diam=4]', true); return true; }
        const tagOrRef = tokens[1];
        const dotIdx = tagOrRef.indexOf('.');
        if (dotIdx > 0) {
            const tag = tagOrRef.substring(0, dotIdx);
            const puertoId = tagOrRef.substring(dotIdx + 1);
            const params = extractParams(tokens.slice(2));
            const cambios = {};
            if (params.pos) cambios.pos = params.pos;
            if (params.dir) cambios.dir = params.dir;
            if (params.diametro !== undefined) cambios.diametro = params.diametro;
            if (params.status) cambios.status = params.status;
            if (Object.keys(cambios).length === 0) { notify('Propiedades de puerto no reconocidas', true); return true; }
            const ok = _core.updatePuerto(tag, puertoId, cambios);
            if (ok) notify(`✅ Puerto ${puertoId} de ${tag} modificado`);
            else notify(`No se pudo modificar el puerto ${puertoId}`, true);
            return true;
        }

        const tag = tagOrRef;
        const params = extractParams(tokens.slice(2));
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (eq) {
            const updates = {};
            if (params.diametro !== undefined) updates.diametro = params.diametro;
            if (params.altura !== undefined) updates.altura = params.altura;
            if (params.largo !== undefined) updates.largo = params.largo;
            if (params.ancho !== undefined) updates.ancho = params.ancho;
            if (params.material) updates.material = params.material;
            if (params.spec) updates.spec = params.spec;
            if (Object.keys(updates).length) {
                _core.updateEquipment(tag, updates);
                notify(`✅ Equipo ${tag} modificado: ${JSON.stringify(updates)}`);
            } else { notify('Sin cambios para aplicar', true); }
            return true;
        }
        const line = db.lines.find(l => l.tag === tag);
        if (line) {
            const updates = {};
            if (params.diametro !== undefined) updates.diameter = params.diametro;
            if (params.material) updates.material = params.material;
            if (params.spec) updates.spec = params.spec;
            if (Object.keys(updates).length) {
                _core.updateLine(tag, updates);
                notify(`✅ Línea ${tag} modificada: ${JSON.stringify(updates)}`);
            } else { notify('Sin cambios para aplicar', true); }
            return true;
        }
        notify(`Elemento ${tag} no encontrado`, true);
        return true;
    }

    function handleDelete(tokens) {
        if (tokens.length < 2) { notify('Uso: eliminar TAG', true); return true; }
        const tag = tokens[1];
        const db = _core.getDb();
        if (db.equipos.some(e => e.tag === tag)) {
            _core.deleteEquipment(tag);
            notify(`🗑️ Equipo ${tag} eliminado`);
            return true;
        }
        if (db.lines.some(l => l.tag === tag)) {
            _core.deleteLine(tag);
            notify(`🗑️ Línea ${tag} eliminada`);
            return true;
        }
        notify(`${tag} no encontrado`, true);
        return true;
    }

    function handleMove(tokens) {
        const aIdx = tokens.findIndex(t => t.toLowerCase() === 'a' || t.toLowerCase() === 'to');
        if (aIdx < 0) { notify('Uso: mover TAG a X,Y,Z', true); return true; }
        const tag = tokens[1];
        const coordStr = tokens.slice(aIdx + 1).join('');
        const coords = extractCoords(coordStr);
        if (!coords) { notify('Coordenadas inválidas', true); return true; }
        const db = _core.getDb();
        if (db.equipos.find(e => e.tag === tag)) {
            _core.updateEquipment(tag, { posX: coords.x, posY: coords.y, posZ: coords.z });
            notify(`✅ Equipo ${tag} movido a (${coords.x},${coords.y},${coords.z})`);
        } else {
            notify(`Solo se pueden mover equipos. ${tag} no es un equipo.`, true);
        }
        return true;
    }

    function handleConnect(tokens, arrowIdx) {
        const leftSide = tokens.slice(0, arrowIdx);
        const rightSide = tokens.slice(arrowIdx + 1);
        if (!rightSide.length) { notify('Falta destino después de la palabra de enlace', true); return true; }
        const left = parseNodeRef(leftSide.join(''));
        const right = parseNodeRef(rightSide[0]);
        if (!left.tag || !right.tag) { notify('Origen o destino inválido', true); return true; }
        const params = extractParams(rightSide.slice(1));
        const diam = params.diametro || 4;
        const mat = params.material || 'PPR';
        const spec = params.spec || 'PPR_PN12_5';

        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(left.tag, left.port, right.tag, right.port, diam, mat, spec);
        } else {
            notify('Router no disponible', true);
        }
        return true;
    }

    function handleInfo(tokens) {
        if (tokens.length < 2) { notify('Uso: info TAG', true); return true; }
        const tag = tokens[1];
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (eq) {
            let info = `${eq.tag} | ${eq.tipo} | Pos: (${eq.posX},${eq.posY},${eq.posZ}) | ⌀${eq.diametro || '?'} H=${eq.altura || '?'} | ${eq.material || 'N/D'}`;
            if (eq.puertos) info += ` | Puertos: ${eq.puertos.map(p => `${p.id}(${p.status})`).join(', ')}`;
            notify(info);
            return true;
        }
        const line = db.lines.find(l => l.tag === tag);
        if (line) {
            const pts = line._cachedPoints || [];
            let info = `${line.tag} | ${line.diameter}" ${line.material || 'N/D'} | Puntos: ${pts.length}`;
            if (line.origin) info += ` | De: ${line.origin.equipTag}.${line.origin.portId}`;
            if (line.destination) info += ` | A: ${line.destination.equipTag}.${line.destination.portId}`;
            if (line.components) info += ` | Componentes: ${line.components.length}`;
            notify(info);
            return true;
        }
        notify(`${tag} no encontrado`, true);
        return true;
    }

    function handleList(tokens) {
        const sub = tokens[1] ? tokens[1].toLowerCase() : '';
        if (sub === 'components' || sub === 'componentes') {
            const types = _catalog.listComponentTypes();
            notify(`Componentes disponibles: ${types.sort().join(', ')}`);
        } else if (sub === 'equipment' || sub === 'equipos') {
            listEquipos();
        } else if (sub === 'líneas' || sub === 'lineas') {
            listLineas();
        } else if (sub === 'specs' || sub === 'especificaciones') {
            const specs = _catalog.listSpecs();
            notify(`Especificaciones: ${specs.sort().join(', ')}`);
        } else {
            notify('Use: listar equipos | listar lineas | listar componentes | listar especificaciones');
        }
        return true;
    }

    function listEquipos() {
        const db = _core.getDb();
        const equipos = db.equipos;
        if (equipos.length === 0) { notify('No hay equipos'); return; }
        notify(`Equipos (${equipos.length}): ${equipos.map(e => e.tag).join(', ')}`);
    }

    function listLineas() {
        const db = _core.getDb();
        const lines = db.lines;
        if (lines.length === 0) { notify('No hay líneas'); return; }
        notify(`Líneas (${lines.length}): ${lines.map(l => `${l.tag}(${l.diameter}" ${l.material || '?'})`).join(', ')}`);
    }

    function handleNodes(tokens) {
        if (tokens.length < 2) { notify('Uso: nodos TAG', true); return true; }
        const tag = tokens[1];
        const db = _core.getDb();
        const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
        if (!obj) { notify(`${tag} no encontrado`, true); return true; }
        let nodes = [];
        if (obj.posX !== undefined) {
            nodes = (obj.puertos || []).map(p => `${p.id}: ⌀${p.diametro || '?'}" ${p.status}`);
        } else {
            nodes = ['START', 'END'];
            if (obj.puertos) nodes.push(...obj.puertos.filter(p => p.id !== 'START' && p.id !== 'END').map(p => p.id));
        }
        notify(`Nodos de ${tag}: ${nodes.join(', ')}`);
        return true;
    }

    function handlePoint(tokens) {
        if (tokens.length < 2) {
            notify('Uso: punto EQUIPO.PUERTO o punto LINEA@POS o punto LINEA.EXTREMO', true);
            return true;
        }
        const ref = tokens[1];
        const dotIdx = ref.indexOf('.');
        const atIdx = ref.indexOf('@');

        let tag, portOrPos;
        if (atIdx > 0) {
            tag = ref.substring(0, atIdx);
            portOrPos = ref.substring(atIdx + 1);
        } else if (dotIdx > 0) {
            tag = ref.substring(0, dotIdx);
            portOrPos = ref.substring(dotIdx + 1);
        } else {
            notify('Formato incorrecto. Use TAG.PUERTO o TAG@POS', true);
            return true;
        }

        const db = _core.getDb();
        const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
        if (!obj) {
            notify(`Elemento ${tag} no encontrado`, true);
            return true;
        }

        let coords = null;
        if (obj.posX !== undefined) {
            const port = obj.puertos?.find(p => p.id === portOrPos);
            if (!port) {
                notify(`Puerto ${portOrPos} no encontrado en ${tag}`, true);
                return true;
            }
            coords = {
                x: obj.posX + (port.relX || 0),
                y: obj.posY + (port.relY || 0),
                z: obj.posZ + (port.relZ || 0)
            };
        } else {
            const pts = obj.points || obj._cachedPoints;
            if (!pts || pts.length < 2) {
                notify(`Línea ${tag} sin geometría`, true);
                return true;
            }
            if (portOrPos === '0' || portOrPos.toUpperCase() === 'START') {
                coords = { x: pts[0].x, y: pts[0].y, z: pts[0].z };
            } else if (portOrPos === '1' || portOrPos.toUpperCase() === 'END') {
                const last = pts.length - 1;
                coords = { x: pts[last].x, y: pts[last].y, z: pts[last].z };
            } else {
                const param = parseFloat(portOrPos);
                if (isNaN(param) || param < 0 || param > 1) {
                    notify(`Posición inválida. Use 0-1, START, END o un puerto virtual`, true);
                    return true;
                }
                let totalLen = 0, lengths = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                    lengths.push(d);
                    totalLen += d;
                }
                if (totalLen === 0) { notify('Línea sin longitud', true); return true; }
                const target = totalLen * param;
                let accum = 0, segIdx = 0, t = 0;
                for (let i = 0; i < lengths.length; i++) {
                    if (accum + lengths[i] >= target || i === lengths.length - 1) {
                        segIdx = i;
                        t = (target - accum) / (lengths[i] || 1);
                        break;
                    }
                    accum += lengths[i];
                }
                const pA = pts[segIdx], pB = pts[segIdx + 1];
                coords = {
                    x: pA.x + (pB.x - pA.x) * t,
                    y: pA.y + (pB.y - pA.y) * t,
                    z: pA.z + (pB.z - pA.z) * t
                };
            }
        }

        if (!coords) {
            notify('No se pudieron calcular las coordenadas', true);
            return true;
        }

        const msg = `📍 ${ref}: X=${coords.x.toFixed(1)}, Y=${coords.y.toFixed(1)}, Z=${coords.z.toFixed(1)} mm`;
        notify(msg);
        return true;
    }

    function setView(view) {
        if (typeof SmartFlowRender !== 'undefined') {
            if (view === 'iso' && SmartFlowRender.fitCameraToEquipments) {
                SmartFlowRender.fitCameraToEquipments();
            } else if (SmartFlowRender.setView) {
                SmartFlowRender.setView(view);
            }
            notify(`Vista: ${view}`);
        }
    }

    function resumen() {
        const db = _core.getDb();
        const equipos = db.equipos || [];
        const lines = db.lines || [];

        let tanques = 0, bombas = 0, otros = 0;
        equipos.forEach(e => {
            if (e.tipo.includes('tanque')) tanques++;
            else if (e.tipo.includes('bomba')) bombas++;
            else otros++;
        });

        let totalCodos = 0, totalValvulas = 0, totalReductores = 0;
        let longitudTotal = 0;
        lines.forEach(l => {
            const pts = l._cachedPoints || l.points;
            if (pts && pts.length >= 2) {
                for (let i = 0; i < pts.length - 1; i++) {
                    longitudTotal += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                }
            }
            if (l.components) {
                l.components.forEach(c => {
                    if (c.type && c.type.includes('ELBOW')) totalCodos++;
                    else if (c.type && c.type.includes('VALVE')) totalValvulas++;
                    else if (c.type && c.type.includes('REDUC')) totalReductores++;
                });
            }
        });

        const msg = `Resumen del proyecto: ${equipos.length} equipos (${tanques} tanques, ${bombas} bombas, ${otros} otros). ` +
                    `${lines.length} líneas. Longitud total de tubería: ${(longitudTotal/1000).toFixed(2)} metros. ` +
                    `Componentes: ${totalCodos} codos, ${totalValvulas} válvulas, ${totalReductores} reductores.`;
        notify(msg);
        return true;
    }

    function showHelp() {
        const help = [
            '═══ SMARTFLOW 3D - COMANDOS ═══',
            'CREAR EQUIPO:',
            '  crear TIPO TAG en X,Y,Z [d=DIAM] [h=ALTURA] [m=MAT]',
            'CREAR LÍNEA SUELTA (colectores, distribuidores):',
            '  crear linea TAG ruta X1,Y1,Z1 X2,Y2,Z2 ... [d=DIAM] [m=MAT]',
            'CREAR LÍNEA CON WAYPOINTS:',
            '  linea TAG desde EQP.PUERTO por x,y,z ... hasta EQP.PUERTO [d=DIAM] [m=MAT]',
            'CONECTAR:',
            '  conectar EQP1.PUERTO1 a EQP2.PUERTO2 [d=DIAM] [m=MAT]',
            '  EQP1.PUERTO1 a LINEA@0.5',
            'MODIFICAR:',
            '  modificar TAG d=3000 m=HDPE',
            '  modificar TAG.PUERTO pos=500,200,0 dir=0,1,0 diam=4 status=open',
            'MOVER:',
            '  mover TAG a X,Y,Z',
            'ELIMINAR: eliminar TAG',
            'CONSULTAR: info TAG  listar equipos  listar lineas  nodos TAG  resumen',
            'COORDENADAS: punto TAG.PUERTO  o  punto LINEA@0.5',
            'VISTAS: vista iso  vista top  vista front  vista side',
            'OTROS: deshacer  rehacer  ayuda  exportar mto/pcf/pdf  guardar  cargar'
        ].join('\n');
        notify(help);
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0, failed = 0;
        for (let raw of lines) {
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notify(`No entendí: "${trimmed.substring(0, 50)}"`, true); }
        }
        if (executed + failed > 0) {
            notify(`${executed} comandos ejecutados, ${failed} fallidos`, failed > 0);
        }
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _notifyUI = notifyFn;
        console.log("Commands v9.4 con comando 'punto' listo");
    }

    return { init, executeCommand, executeBatch };
})();
