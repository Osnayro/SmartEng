
// ============================================================
// MÓDULO 6: SMARTFLOW ROUTER (Enrutamiento Automático) - v2.8 CORREGIDO
// Archivo: js/router.js
// Corrección: findComponentInCatalog + findElbowForLine (multimaterial)
// ============================================================

const SmartFlowRouter = (function() {
    
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    function ensureInitialized() {
        if (!_core && typeof SmartFlowCore !== 'undefined') _core = SmartFlowCore;
        if (!_catalog && typeof SmartFlowCatalog !== 'undefined') _catalog = SmartFlowCatalog;
        if (_core && _catalog) return true;
        return false;
    }

    function speakText(text) {
        if (!window.voiceEnabled) return;
        if (typeof window.speechSynthesis !== 'undefined') {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    function notifyUser(message, isError = false) {
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        speakText(message);
    }

    function validateMaterialCompatibility(lineMat, compType) {
        const mat = lineMat.toUpperCase();
        const rules = {
            'PPR': ['PPR'],
            'ACERO_CARBONO': ['CS', 'STEEL', 'ACERO'],
            'PVC': ['PVC'],
            'HDPE': ['HDPE']
        };
        const compUpper = compType.toUpperCase();
        for (let [key, values] of Object.entries(rules)) {
            if (mat.includes(key) || key.includes(mat)) {
                return values.some(v => compUpper.includes(v));
            }
        }
        return true;
    }

    function checkVerticalAlignment(p1, p2, portA, portB) {
        const tol = 5;
        const dx = Math.abs(p1.x - p2.x);
        const dz = Math.abs(p1.z - p2.z);
        if (dx > tol || dz > tol) {
            notifyUser(`⚠️ Aviso: Nozzles ${portA} y ${portB} desalineados verticalmente.`, false);
            return false;
        }
        notifyUser("✅ Instrumentos alineados correctamente.", false);
        return true;
    }

    function validatePumpSuction(pumpObj, tankObj, pumpPort, tankPort) {
        const pPos = getPortPosition(pumpObj, pumpPort);
        const tPos = getPortPosition(tankObj, tankPort);
        if (pPos && tPos && pPos.y > tPos.y) {
            notifyUser(`❌ Peligro: Succión de bomba por encima de salida de tanque.`, true);
            return false;
        }
        return true;
    }

    function distance(p1, p2) { return Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z); }
    function addPoints(p1, p2) { return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z }; }
    function subtractPoints(p1, p2) { return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }; }
    function scalePoint(p, factor) { return { x: p.x * factor, y: p.y * factor, z: p.z * factor }; }
    function normalizeVector(v) {
        const len = Math.hypot(v.x, v.y, v.z);
        if (len === 0) return { x: 1, y: 0, z: 0 };
        return { x: v.x / len, y: v.y / len, z: v.z / len };
    }
    function dotProduct(v1, v2) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    function projectPointOnSegment(p, a, b) {
        const ab = subtractPoints(b, a);
        const ap = subtractPoints(p, a);
        const len2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
        if (len2 === 0) return { point: a, t: 0, distance: distance(p, a) };
        let t = dotProduct(ap, ab) / len2;
        t = Math.max(0, Math.min(1, t));
        const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
        return { point: proj, t, distance: distance(p, proj) };
    }

    function getPortPosition(obj, portId) {
        if (!obj) return null;
        if (obj.posX !== undefined) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (!puerto) return null;
            return {
                x: obj.posX + (puerto.relX || puerto.relPos?.x || 0),
                y: obj.posY + (puerto.relY || puerto.relPos?.y || 0),
                z: obj.posZ + (puerto.relZ || puerto.relPos?.z || 0)
            };
        }
        const pts = obj._cachedPoints || obj.points3D || obj.points;
        if (!pts || pts.length === 0) return null;
        if (obj.puertos) {
            const puerto = obj.puertos.find(p => p.id === portId);
            if (puerto && puerto.pos) return puerto.pos;
        }
        if (portId === '0') return pts[0];
        if (portId === '1') return pts[pts.length - 1];
        return pts[Math.floor(pts.length / 2)];
    }

    function getPortDirection(obj, portId) {
        if (!obj) return { dx: 1, dy: 0, dz: 0 };
        if (obj.posX !== undefined) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (puerto && puerto.orientacion) return puerto.orientacion;
            return { dx: 1, dy: 0, dz: 0 };
        }
        const pts = obj._cachedPoints || obj.points3D || obj.points;
        if (pts && pts.length >= 2) {
            if (portId === '0') return normalizeVector(subtractPoints(pts[1], pts[0]));
            if (portId === '1') return normalizeVector(subtractPoints(pts[pts.length - 1], pts[pts.length - 2]));
            return { dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y, dz: pts[1].z - pts[0].z };
        }
        return { dx: 1, dy: 0, dz: 0 };
    }

    // ==================== findComponentInCatalog CORREGIDO (v2.8) ====================
    function findComponentInCatalog(desiredType, lineMaterial = 'PPR', fallbackTypes = []) {
        ensureInitialized();
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) { notifyUser('Catálogo no disponible', true); return null; }
        const allTypes = catalog.listComponentTypes();
        
        const materialUpper = lineMaterial.toUpperCase();
        
        // Determinar prefijo de material
        let materialPrefix = '';
        if (materialUpper.includes('PPR')) materialPrefix = 'PPR';
        else if (materialUpper.includes('HDPE')) materialPrefix = 'HDPE';
        else if (materialUpper.includes('PVC')) materialPrefix = 'PVC';
        else if (materialUpper.includes('ACERO') || materialUpper.includes('CARBONO') || materialUpper.includes('CS')) materialPrefix = 'CS';
        else if (materialUpper.includes('INOX')) materialPrefix = 'SS';
        
        // Construir lista de candidatos en orden de prioridad
        const candidates = [];
        
        // 1. Tipo exacto con material
        if (materialPrefix) {
            candidates.push(`${desiredType}_${materialPrefix}`);
            // Alternativas para reductores
            if (desiredType.includes('REDUCER')) {
                candidates.push(`CONCENTRIC_REDUCER_${materialPrefix}`);
                candidates.push(`ECCENTRIC_REDUCER_${materialPrefix}`);
            }
        }
        
        // 2. Tipo base
        candidates.push(desiredType);
        
        // 3. Fallbacks explícitos
        for (let fb of fallbackTypes) {
            if (materialPrefix) candidates.push(`${fb}_${materialPrefix}`);
            candidates.push(fb);
        }
        
        // 4. Buscar en orden
        for (let candidate of candidates) {
            if (allTypes.includes(candidate)) {
                return candidate;
            }
        }
        
        // 5. Búsqueda flexible por nombre base + material
        const baseName = desiredType.split('_')[0];
        for (let type of allTypes) {
            const typeUpper = type.toUpperCase();
            if (typeUpper.includes(baseName) && materialPrefix && typeUpper.includes(materialPrefix)) {
                return type;
            }
        }
        
        // 6. Solo por nombre base (último recurso)
        for (let type of allTypes) {
            if (type.toUpperCase().includes(baseName)) {
                return type;
            }
        }
        
        // 7. Si es reductor y no encontró nada, devolver null sin error
        if (desiredType.includes('REDUCER')) {
            return null;
        }
        
        return null;
    }

    // ==================== findElbowForLine CORREGIDO (v2.8) ====================
    function findElbowForLine(material, diameter, angleDeg) {
        const mat = (material || '').toUpperCase();
        const is90 = (Math.abs(angleDeg - 90) < 10);
        const is45 = (Math.abs(angleDeg - 45) < 10);
        if (!is90 && !is45) return null;
        
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return null;
        
        // Determinar prefijo de material
        let prefix = '';
        if (mat.includes('PPR')) prefix = 'PPR';
        else if (mat.includes('HDPE')) prefix = 'HDPE';
        else if (mat.includes('PVC')) prefix = 'PVC';
        else if (mat.includes('ACERO') || mat.includes('CARBONO') || mat.includes('CS')) prefix = 'CS';
        else if (mat.includes('INOX')) prefix = 'SS';
        
        // Construir candidatos
        const candidates = [];
        if (is90) {
            if (prefix) candidates.push(`ELBOW_90_${prefix}`);
            candidates.push('ELBOW_90_LR_CS');
            candidates.push('ELBOW_90_PPR');
        }
        if (is45) {
            if (prefix) candidates.push(`ELBOW_45_${prefix}`);
            candidates.push('ELBOW_45_CS');
            candidates.push('ELBOW_45_PPR');
        }
        
        const allTypes = catalog.listComponentTypes();
        for (let c of candidates) {
            if (allTypes.includes(c)) return c;
        }
        
        // Búsqueda flexible
        for (let type of allTypes) {
            const typeUpper = type.toUpperCase();
            if (is90 && typeUpper.includes('ELBOW_90') && prefix && typeUpper.includes(prefix)) return type;
            if (is45 && typeUpper.includes('ELBOW_45') && prefix && typeUpper.includes(prefix)) return type;
        }
        
        return null;
    }

    function insertarAccesorioEnLinea(lineTag, puntoConexion, diametroNuevaLinea, forzarTee = false) {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        const db = _core.getDb();
        const linea = db.lines.find(l => l.tag === lineTag);
        if (!linea) { notifyUser(`Línea ${lineTag} no encontrada`, true); return null; }

        const pts = linea._cachedPoints || linea.points3D || linea.points;
        if (!pts || pts.length < 2) { notifyUser(`Línea ${lineTag} sin geometría`, true); return null; }

        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = distance(pts[i], pts[i+1]);
            lengths.push(d);
            totalLen += d;
        }

        let minDist = Infinity, bestSegIdx = 0, bestT = 0;
        for (let i = 0; i < lengths.length; i++) {
            const proj = projectPointOnSegment(puntoConexion, pts[i], pts[i+1]);
            if (proj.distance < minDist) {
                minDist = proj.distance;
                bestSegIdx = i;
                bestT = proj.t;
            }
        }

        let accumBefore = 0;
        for (let i = 0; i < bestSegIdx; i++) accumBefore += lengths[i];
        const param = (accumBefore + bestT * lengths[bestSegIdx]) / totalLen;

        const diamLinea = linea.diameter || 4;
        const diffDiam = Math.abs(diametroNuevaLinea - diamLinea) > 0.1;
        const esExtremo = !forzarTee && ((bestSegIdx === 0 && bestT < 0.1) || (bestSegIdx === lengths.length - 1 && bestT > 0.9));
        const lineMaterial = linea.material || 'PPR';

        let tipoAccesorio = 'TEE';
        let descripcion = 'Tee igual';

        if (esExtremo && diffDiam) {
            tipoAccesorio = 'CONCENTRIC_REDUCER';
            descripcion = `Reductor concéntrico ${diamLinea}"x${diametroNuevaLinea}"`;
        } else if (diffDiam) {
            tipoAccesorio = 'TEE_REDUCING';
            descripcion = `Tee reductora ${diamLinea}"x${diametroNuevaLinea}"`;
        } else {
            tipoAccesorio = 'TEE';
            descripcion = `Tee igual ${diamLinea}"`;
        }

        const compEnCatalogo = findComponentInCatalog(tipoAccesorio, lineMaterial, []);
        if (!compEnCatalogo) {
            notifyUser(`Componente no encontrado en catálogo: ${tipoAccesorio} (material: ${lineMaterial})`, true);
            return null;
        }

        if (!validateMaterialCompatibility(lineMaterial, compEnCatalogo)) {
            notifyUser(`Alerta: Material del accesorio no compatible con ${lineMaterial}`, true);
        }

        if (typeof SmartFlowCommands === 'undefined') {
            notifyUser('Módulo de comandos no disponible', true);
            return null;
        }

        const cmd = `edit line ${lineTag} add component ${compEnCatalogo} at ${param.toFixed(3)}`;
        const success = SmartFlowCommands.executeCommand(cmd);
        if (!success) {
            notifyUser(`Comando falló: ${cmd}`, true);
            return null;
        }

        notifyUser(`✅ ${descripcion} (${compEnCatalogo}) insertado en ${lineTag}`, false);

        const lineaActualizada = db.lines.find(l => l.tag === lineTag);
        if (!lineaActualizada || !lineaActualizada.puertos) {
            notifyUser('No se generaron puertos', true);
            return null;
        }
        const nuevoPuerto = lineaActualizada.puertos[lineaActualizada.puertos.length - 1];
        return nuevoPuerto.id;
    }

    function procesarInterseccionesDeLinea(nuevaLinea) {
        ensureInitialized();
        if (!_core) return;
        const db = _core.getDb();
        const lineasExistentes = db.lines.filter(l => l.tag !== nuevaLinea.tag);
        if (lineasExistentes.length === 0) return;
        
        const ptsNueva = nuevaLinea._cachedPoints || nuevaLinea.points3D || nuevaLinea.points;
        if (!ptsNueva || ptsNueva.length < 2) return;
        
        const tolerancia = 100;
        for (let lineaExistente of lineasExistentes) {
            const ptsExistente = lineaExistente._cachedPoints || lineaExistente.points3D || lineaExistente.points;
            if (!ptsExistente || ptsExistente.length < 2) continue;
            
            for (let i = 0; i < ptsNueva.length - 1; i++) {
                const a1 = ptsNueva[i], a2 = ptsNueva[i+1];
                for (let j = 0; j < ptsExistente.length - 1; j++) {
                    const b1 = ptsExistente[j], b2 = ptsExistente[j+1];
                    const midNuevo = { x: (a1.x+a2.x)/2, y: (a1.y+a2.y)/2, z: (a1.z+a2.z)/2 };
                    const proj = projectPointOnSegment(midNuevo, b1, b2);
                    if (proj.distance < tolerancia) {
                        const puertoId = insertarAccesorioEnLinea(lineaExistente.tag, proj.point, nuevaLinea.diameter || 4, true);
                        if (puertoId) {
                            nuevaLinea.destination = { objType: 'line', equipTag: lineaExistente.tag, portId: puertoId };
                            if (ptsNueva.length >= 2) {
                                ptsNueva[ptsNueva.length - 1] = proj.point;
                                nuevaLinea._cachedPoints = ptsNueva;
                                nuevaLinea.waypoints = ptsNueva.slice(1, -1);
                            }
                            if (lineaExistente.puertos) {
                                const puerto = lineaExistente.puertos.find(p => p.id === puertoId);
                                if (puerto) puerto.connectedLine = nuevaLinea.tag;
                            }
                            _core.updateLine(nuevaLinea.tag, nuevaLinea);
                            notifyUser(`✅ Conexión automática: ${nuevaLinea.tag} a ${lineaExistente.tag}`, false);
                        }
                        return;
                    }
                }
            }
        }
    }

    function routeBetweenPorts(fromEquipTag, fromPortId, toEquipTag, toPortId, diameter = 3, material = 'PPR', spec = 'PPR_PN12_5') {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquipTag) || db.lines.find(l => l.tag === fromEquipTag);
        let toObj = db.equipos.find(e => e.tag === toEquipTag) || db.lines.find(l => l.tag === toEquipTag);

        if (!fromObj) { notifyUser(`Origen ${fromEquipTag} no encontrado`, true); return null; }
        if (!toObj) { notifyUser(`Destino ${toEquipTag} no encontrado`, true); return null; }

        let startPos = getPortPosition(fromObj, fromPortId);
        if (!startPos) { notifyUser(`Puerto origen ${fromPortId} no encontrado`, true); return null; }

        if (fromPortId.includes('N') && toPortId.includes('N')) {
            const endPosAprox = getPortPosition(toObj, toPortId);
            if (endPosAprox) checkVerticalAlignment(startPos, endPosAprox, fromPortId, toPortId);
        }
        if ((fromEquipTag.includes('B-') || toEquipTag.includes('B-')) && 
            (fromObj.tipo === 'bomba' || toObj.tipo === 'bomba')) {
            validatePumpSuction(toObj, fromObj, toPortId, fromPortId);
        }

        let endPos, nuevoPuertoId = toPortId;
        let reductorComponent = null;

        if (toObj._cachedPoints || toObj.points3D || toObj.points) {
            const pts = toObj._cachedPoints || toObj.points3D || toObj.points;
            if (!pts || pts.length < 2) {
                notifyUser(`La línea ${toEquipTag} no tiene geometría definida.`, true);
                return null;
            }
            
            if (!toPortId || toPortId === '') {
                let minDist = Infinity, bestPoint = pts[0];
                for (let i = 0; i < pts.length - 1; i++) {
                    const proj = projectPointOnSegment(startPos, pts[i], pts[i+1]);
                    if (proj.distance < minDist) {
                        minDist = proj.distance;
                        bestPoint = proj.point;
                    }
                }
                const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, bestPoint, diameter, true);
                if (!puertoInsertado) return null;
                nuevoPuertoId = puertoInsertado;
                toObj = db.lines.find(l => l.tag === toEquipTag);
            } else {
                let puntoConexion;
                if (toPortId === '0') puntoConexion = pts[0];
                else if (toPortId === '1') puntoConexion = pts[pts.length - 1];
                else puntoConexion = getPortPosition(toObj, toPortId);
                
                if (!puntoConexion) { notifyUser(`Puerto destino no encontrado`, true); return null; }

                const esExtremo = (toPortId === '0' || toPortId === '1');
                const diffDiam = Math.abs(diameter - (toObj.diameter || 4)) > 0.1;
                if (esExtremo && !diffDiam) {
                    nuevoPuertoId = toPortId;
                } else if (esExtremo && diffDiam) {
                    const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, puntoConexion, diameter, false);
                    if (puertoInsertado) {
                        nuevoPuertoId = puertoInsertado;
                        toObj = db.lines.find(l => l.tag === toEquipTag);
                    } else {
                        const reductorId = findComponentInCatalog('CONCENTRIC_REDUCER', material, []);
                        if (reductorId) {
                            reductorComponent = {
                                type: reductorId,
                                tag: reductorId + '-' + Date.now().toString().slice(-6),
                                param: 1.0
                            };
                            notifyUser(`⚠️ No se pudo insertar reductor en ${toEquipTag}. Se añadirá a la nueva línea`, false);
                        }
                        nuevoPuertoId = toPortId;
                    }
                } else {
                    const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, puntoConexion, diameter, esExtremo ? false : true);
                    if (!puertoInsertado) return null;
                    nuevoPuertoId = puertoInsertado;
                    toObj = db.lines.find(l => l.tag === toEquipTag);
                }
            }
        }

        endPos = getPortPosition(toObj, nuevoPuertoId);
        if (!endPos) { notifyUser(`Puerto destino no encontrado`, true); return null; }

        const startDir = normalizeVector(getPortDirection(fromObj, fromPortId));
        const extStart = 500;
        const p1 = addPoints(startPos, scalePoint(startDir, extStart));

        let endDir, extEnd = 500;
        if (toObj.posX !== undefined) {
            endDir = normalizeVector(getPortDirection(toObj, nuevoPuertoId));
        } else {
            const vecHaciaDestino = subtractPoints(endPos, p1);
            if (Math.abs(vecHaciaDestino.x) > Math.abs(vecHaciaDestino.z)) {
                endDir = { dx: Math.sign(vecHaciaDestino.x), dy: 0, dz: 0 };
            } else {
                endDir = { dx: 0, dy: 0, dz: Math.sign(vecHaciaDestino.z) };
            }
            extEnd = 0;
        }
        const p4 = addPoints(endPos, scalePoint(endDir, extEnd));

        const waypoints = [p1];
        if (Math.abs(p1.y - p4.y) > 10) {
            waypoints.push({ x: p4.x, y: p1.y, z: p1.z });
            waypoints.push({ x: p4.x, y: p1.y, z: p4.z });
            waypoints.push({ x: p4.x, y: p4.y, z: p4.z });
        } else {
            waypoints.push({ x: p4.x, y: p1.y, z: p1.z });
            waypoints.push({ x: p4.x, y: p1.y, z: p4.z });
        }
        waypoints.push(p4);

        let uniqueWaypoints = waypoints.filter((pt, i, arr) => 
            i === 0 || distance(pt, arr[i-1]) > 1
        );
        if (uniqueWaypoints.length < 2) {
            uniqueWaypoints = [p1, p4].filter((pt, i, arr) => i === 0 || distance(pt, arr[i-1]) > 1);
        }

        const tag = `L-${db.lines.length + 1}`;
        const nuevaLinea = {
            tag, diameter, material, spec,
            origin: { objType: fromObj.posX !== undefined ? 'equipment' : 'line', equipTag: fromEquipTag, portId: fromPortId },
            destination: { objType: toObj.posX !== undefined ? 'equipment' : 'line', equipTag: toEquipTag, portId: nuevoPuertoId },
            waypoints: uniqueWaypoints.slice(1, -1),
            _cachedPoints: [...uniqueWaypoints],
            points3D: [...uniqueWaypoints],
            points: [...uniqueWaypoints],
            components: []
        };

        // Auto‑codo en origen
        try {
            if (uniqueWaypoints.length >= 2 && !fromObj.posX && (fromPortId === '0' || fromPortId === '1')) {
                const fromPortDir = getPortDirection(fromObj, fromPortId);
                const secondPoint = uniqueWaypoints[1];
                if (secondPoint) {
                    const newStartDir = normalizeVector(subtractPoints(secondPoint, startPos));
                    const angleRad = Math.acos(Math.min(1, Math.abs(dotProduct(fromPortDir, newStartDir))));
                    const angleDeg = angleRad * 180 / Math.PI;
                    if (angleDeg > 15) {
                        const elbowId = findElbowForLine(material, diameter, angleDeg);
                        if (elbowId) {
                            nuevaLinea.components.push({
                                type: elbowId,
                                tag: elbowId + '-' + Date.now().toString().slice(-6),
                                param: 0.0
                            });
                            notifyUser(`✅ Codo ${angleDeg.toFixed(0)}° (${elbowId}) insertado al inicio de ${tag}`, false);
                        }
                    }
                }
            }
        } catch (e) { /* silenciar */ }

        // Auto‑codo en destino
        try {
            if (uniqueWaypoints.length >= 2 && !toObj.posX && (nuevoPuertoId === '0' || nuevoPuertoId === '1')) {
                const yaTieneAccesorio = toObj.puertos && toObj.puertos.some(p => p.id === nuevoPuertoId && p.connectedLine);
                if (!yaTieneAccesorio) {
                    const toPortDir = getPortDirection(toObj, nuevoPuertoId);
                    const secondLastPoint = uniqueWaypoints[uniqueWaypoints.length - 2];
                    if (secondLastPoint) {
                        const lastSegDir = normalizeVector(subtractPoints(endPos, secondLastPoint));
                        const angleRad = Math.acos(Math.min(1, Math.abs(dotProduct(toPortDir, lastSegDir))));
                        const angleDeg = angleRad * 180 / Math.PI;
                        if (angleDeg > 15) {
                            const elbowId = findElbowForLine(material, diameter, angleDeg);
                            if (elbowId) {
                                nuevaLinea.components.push({
                                    type: elbowId,
                                    tag: elbowId + '-' + Date.now().toString().slice(-6),
                                    param: 1.0
                                });
                                notifyUser(`✅ Codo ${angleDeg.toFixed(0)}° (${elbowId}) insertado al final de ${tag}`, false);
                            }
                        }
                    }
                }
            }
        } catch (e) { /* silenciar */ }

        if (reductorComponent) {
            nuevaLinea.components.push(reductorComponent);
            notifyUser(`✅ Reductor (${reductorComponent.type}) añadido al final de ${tag}`, false);
        }

        _core.addLine(nuevaLinea);
        if (fromObj.puertos) {
            const pFrom = fromObj.puertos.find(p => p.id === fromPortId);
            if (pFrom) pFrom.connectedLine = tag;
        }
        if (toObj.puertos) {
            const pTo = toObj.puertos.find(p => p.id === nuevoPuertoId);
            if (pTo) pTo.connectedLine = tag;
        }

        _core.syncPhysicalData();
        _core._saveState();
        if (typeof _renderUI === 'function') _renderUI();

        _core.setSelected({ type: 'line', obj: nuevaLinea });

        notifyUser(`✅ Ruta creada: ${tag} (${fromEquipTag}.${fromPortId} → ${toEquipTag}.${nuevoPuertoId})`, false);
        return nuevaLinea;
    }

    function handleSnapClick(snapData) {
        if (!snapData) return;
        ensureInitialized();
        _core.setSelected({ 
            type: 'PUERTO', 
            obj: snapData.port, 
            parent: snapData.item 
        });
        notifyUser(`Puerto seleccionado: ${snapData.item.tag} - ${snapData.port.id}`);
    }

    function executeCommand(cmdLine) {
        ensureInitialized();
        const parts = cmdLine.trim().split(/\s+/);
        const action = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        switch(action) {
            case 'conectar':
                if (args.length >= 4) {
                    routeBetweenPorts(args[0], args[1], args[2], args[3]);
                } else {
                    notifyUser('Formato: conectar [Origen] [Puerto] [Destino] [Puerto]', true);
                }
                break;
            case 'split':
                if (args.length >= 2) {
                    const lineTag = args[0];
                    const param = parseFloat(args[1]);
                    if (!isNaN(param)) {
                        _core.injectAccessory(lineTag, param, {
                            tag: 'TEE',
                            generarPuertos: (line, p, d) => _catalog.getComponent('TEE_EQUAL').generarPuertos({diameter: d})
                        });
                    }
                } else {
                    notifyUser('Formato: split [Línea] [Posición 0-1]', true);
                }
                break;
            case 'limpiar':
                _core.nuevoProyecto();
                notifyUser('Proyecto limpiado.', false);
                break;
            default:
                notifyUser(`Comando router no reconocido: ${action}`, true);
        }
    }

    function init(coreInstance, catalogInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _notifyUI = notifyFn || ((msg, isErr) => console.log(msg));
        _renderUI = renderFn || (() => {});
        console.log('✅ SmartFlow Router v2.8 CORREGIDO (multimaterial)');
    }

    return {
        init,
        routeBetweenPorts,
        insertarAccesorioEnLinea,
        procesarInterseccionesDeLinea,
        getPortPosition,
        getPortDirection,
        findComponentInCatalog,
        findElbowForLine,
        handleSnapClick,
        executeCommand
    };
})();

if (typeof window !== 'undefined') window.SmartFlowRouter = SmartFlowRouter;
