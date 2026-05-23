
const SmartFlowRouter = (function() {
    
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _currentUtterance = null;

    const ANGLE_TOLERANCE = 0.9999;
    const ORTHOGONAL_TOLERANCE = 0.0175;
    const MIN_ANGLE_FOR_ELBOW = 3;
    const EXTENSION_DISTANCE = 500;

    function ensureInitialized() {
        if (!_core && typeof SmartFlowCore !== 'undefined') _core = SmartFlowCore;
        if (!_catalog && typeof SmartFlowCatalog !== 'undefined') _catalog = SmartFlowCatalog;
        if (_core && _catalog) return true;
        return false;
    }

    function speakText(text) {
        if (!_core || !_core.isVoiceEnabled()) return;
        if (typeof window.speechSynthesis !== 'undefined') {
            window.speechSynthesis.cancel();
            _currentUtterance = new SpeechSynthesisUtterance(text);
            _currentUtterance.lang = 'es-ES';
            _currentUtterance.rate = 0.95;
            window.speechSynthesis.speak(_currentUtterance);
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

    function distance(p1, p2) { return Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z); }
    function addPoints(p1, p2) { return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z }; }
    function subtractPoints(p1, p2) { return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }; }
    function scalePoint(p, factor) { return { x: p.x * factor, y: p.y * factor, z: p.z * factor }; }
    function normalizeVector(v) {
        const len = Math.hypot(v.x, v.y, v.z);
        if (len === 0) return { x: 1, y: 0, z: 0, dx: 1, dy: 0, dz: 0 };
        const n = { x: v.x / len, y: v.y / len, z: v.z / len };
        n.dx = n.x; n.dy = n.y; n.dz = n.z;
        return n;
    }
    function dotProduct(v1, v2) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    function crossProduct(v1, v2) { return { x: v1.y * v2.z - v1.z * v2.y, y: v1.z * v2.x - v1.x * v2.z, z: v1.x * v2.y - v1.y * v2.x }; }
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

    function calculateOrthogonalIntersection(portPos, portDir, targetPos) {
        const dir = normalizeVector(portDir);
        const toTarget = subtractPoints(targetPos, portPos);
        const targetDist = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
        
        if (targetDist === 0) {
            return { intersection: portPos, lateralDistance: 0, isOrthogonal: true, angleDeg: 0, needsElbow: false };
        }

        const projLength = dotProduct(toTarget, dir);
        const intersection = addPoints(portPos, scalePoint(dir, projLength));
        
        const lateralVector = subtractPoints(targetPos, intersection);
        const lateralDistance = Math.hypot(lateralVector.x, lateralVector.y, lateralVector.z);

        const toTargetDir = normalizeVector(toTarget);
        const cosAngle = Math.max(-1, Math.min(1, dotProduct(dir, toTargetDir)));
        const angleDeg = Math.acos(cosAngle) * 180 / Math.PI;

        const isOrthogonal = lateralDistance < ORTHOGONAL_TOLERANCE || Math.abs(projLength) < ORTHOGONAL_TOLERANCE;

        return {
            intersection,
            lateralVector,
            lateralDir: lateralDistance > 0 ? normalizeVector(lateralVector) : { dx: 0, dy: 0, dz: 0, x: 0, y: 0, z: 0 },
            lateralDistance,
            isOrthogonal,
            angleDeg: angleDeg,
            needsElbow: !isOrthogonal && (angleDeg > MIN_ANGLE_FOR_ELBOW)
        };
    }

    function getFittingLength(componentType, diameter) {
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return 0;
        try {
            const comp = catalog.getComponent(componentType);
            if (!comp) return 0;
            const dims = comp.dimensiones || comp.dimensions;
            if (!dims) return 0;
            const diamKey = `${diameter}"` || `${diameter}`;
            const dimForDiam = dims[diamKey] || dims[diameter] || dims.DEFAULT;
            if (dimForDiam && dimForDiam.centerToFace) return dimForDiam.centerToFace;
            const typicalLengths = {
                'ELBOW_90': 38, 'ELBOW_45': 25, 'TEE': 50, 'TEE_EQUAL': 50,
                'TEE_REDUCING': 55, 'CONCENTRIC_REDUCER': 75
            };
            for (const [key, val] of Object.entries(typicalLengths)) {
                if (componentType.includes(key)) return val;
            }
        } catch (e) { console.warn('Error obteniendo fitting length:', e); }
        return 50;
    }

    function getPortPosition(obj, portId) {
        if (!obj) return null;
        if (obj.posX !== undefined) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (!puerto) return null;
            return { x: obj.posX + (puerto.relX || puerto.relPos?.x || 0), y: obj.posY + (puerto.relY || puerto.relPos?.y || 0), z: obj.posZ + (puerto.relZ || puerto.relPos?.z || 0) };
        }
        if (obj.pos && obj.pos.x !== undefined) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (!puerto) return null;
            return { x: obj.pos.x + (puerto.relX || puerto.relPos?.x || 0), y: obj.pos.y + (puerto.relY || puerto.relPos?.y || 0), z: obj.pos.z + (puerto.relZ || puerto.relPos?.z || 0) };
        }
        const pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points);
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
        const defaultDir = { dx: 1, dy: 0, dz: 0, x: 1, y: 0, z: 0 };
        if (!obj) return defaultDir;

        if (obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined)) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (puerto) {
                const ori = puerto.orientacion || puerto.dir || puerto.normal || puerto.vector;
                if (ori) {
                    const x = parseFloat(ori.dx !== undefined ? ori.dx : (ori.x !== undefined ? ori.x : 1));
                    const y = parseFloat(ori.dy !== undefined ? ori.dy : (ori.y !== undefined ? ori.y : 0));
                    const z = parseFloat(ori.dz !== undefined ? ori.dz : (ori.z !== undefined ? ori.z : 0));
                    return { dx: x, dy: y, dz: z, x, y, z };
                }
            }
            return defaultDir;
        }

        const pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points);
        if (pts && Array.isArray(pts) && pts.length >= 2) {
            try {
                let pBase, pSig;
                if (portId === '0' || portId === 0) {
                    pBase = pts[0]; pSig = pts[1];
                } else if (portId === '1' || portId === 1 || portId === String(pts.length - 1)) {
                    pBase = pts[pts.length - 2]; pSig = pts[pts.length - 1];
                } else {
                    pBase = pts[0]; pSig = pts[1];
                }

                if (pBase && pSig && pBase.x !== undefined && pSig.x !== undefined) {
                    const vSub = { x: pSig.x - pBase.x, y: pSig.y - pBase.y, z: pSig.z - pBase.z };
                    const vNorm = normalizeVector(vSub);
                    return { dx: vNorm.x, dy: vNorm.y, dz: vNorm.z, x: vNorm.x, y: vNorm.y, z: vNorm.z };
                }
            } catch (err) {
                console.warn(`Error de orientación en línea para puerto ${portId}:`, err);
            }
        }
        return defaultDir;
    }

    function getPortDirectionLocal(obj, portId) {
        return getPortDirection(obj, portId);
    }

    function findComponentInCatalog(desiredType, lineMaterial = 'PPR', fallbackTypes = []) {
        ensureInitialized();
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) { notifyUser('Catálogo no disponible', true); return null; }
        const allTypes = catalog.listComponentTypes();
        const materialUpper = lineMaterial.toUpperCase();
        let materialPrefix = '';
        if (materialUpper.includes('PPR')) materialPrefix = 'PPR';
        else if (materialUpper.includes('HDPE')) materialPrefix = 'HDPE';
        else if (materialUpper.includes('PVC')) materialPrefix = 'PVC';
        else if (materialUpper.includes('ACERO') || materialUpper.includes('CARBONO') || materialUpper.includes('CS')) materialPrefix = 'CS';
        else if (materialUpper.includes('INOX')) materialPrefix = 'SS';
        const candidates = [];
        if (materialPrefix) {
            candidates.push(`${desiredType}_${materialPrefix}`);
            if (desiredType.includes('REDUCER')) {
                candidates.push(`CONCENTRIC_REDUCER_${materialPrefix}`);
                candidates.push(`ECCENTRIC_REDUCER_${materialPrefix}`);
            }
        }
        candidates.push(desiredType);
        for (let fb of fallbackTypes) {
            if (materialPrefix) candidates.push(`${fb}_${materialPrefix}`);
            candidates.push(fb);
        }
        for (let candidate of candidates) {
            if (allTypes.includes(candidate)) return candidate;
        }
        const baseName = desiredType.split('_')[0];
        for (let type of allTypes) {
            if (type.toUpperCase().includes(baseName) && materialPrefix && type.toUpperCase().includes(materialPrefix)) return type;
        }
        for (let type of allTypes) {
            if (type.toUpperCase().includes(baseName)) return type;
        }
        return null;
    }

    function findElbowForLine(material, diameter, angleDeg) {
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return null;
        const allTypes = catalog.listComponentTypes();
        
        const elbowTypes = allTypes.filter(t => t.toUpperCase().includes('ELBOW'));
        
        let bestMatch = null, bestDiff = Infinity;
        for (const type of elbowTypes) {
            const comp = catalog.getComponent(type);
            if (!comp || typeof comp.angulo === 'undefined') continue;
            
            const diff = Math.abs(comp.angulo - angleDeg);
            if (diff < bestDiff && diff < 15) { 
                bestDiff = diff; 
                bestMatch = type; 
            }
        }
        
        if (!bestMatch) {
            const mat = (material || '').toUpperCase();
            bestMatch = elbowTypes.find(t => {
                if (mat.includes('PPR') && t.toUpperCase().includes('PPR')) return true;
                if (mat.includes('HDPE') && t.toUpperCase().includes('HDPE')) return true;
                if ((mat.includes('ACERO') || mat.includes('CS')) && (t.toUpperCase().includes('CS') || t.toUpperCase().includes('LR'))) return true;
                if (mat.includes('INOX') && (t.toUpperCase().includes('SS') || t.toUpperCase().includes('SANITARY'))) return true;
                return false;
            });
        }
        
        if (bestMatch) console.log(`✅ Codo seleccionado: ${bestMatch} (${angleDeg.toFixed(0)}°)`);
        return bestMatch;
    }

    function ensureFittings(lineObj, fromObj, fromPortId, toObj, toPortId, diameter, material) {
        if (!lineObj) return { added: [], message: ' | ⚠️ Sin objeto de línea' };
        
        const puntos = lineObj._cachedPoints || lineObj.points3D || [];
        if (puntos.length < 2) return { added: [], message: ' | ⚠️ Puntos insuficientes' };

        lineObj.components = lineObj.components || [];
        const inicialCount = lineObj.components.length;
        const addedFittings = [];

        if (fromObj && fromPortId && puntos.length >= 2) {
            const dirPuerto = getPortDirection(fromObj, fromPortId);
            const vInicial = { x: puntos[1].x - puntos[0].x, y: puntos[1].y - puntos[0].y, z: puntos[1].z - puntos[0].z };
            const lenInic = Math.hypot(vInicial.x, vInicial.y, vInicial.z) || 1;
            const dotInicio = (dirPuerto.x * vInicial.x + dirPuerto.y * vInicial.y + dirPuerto.z * vInicial.z) / lenInic;
            
            if (Math.abs(dotInicio) < 0.96) { 
                const codoInicial = {
                    type: 'ELBOW_90_LR',
                    skey: 'ELBW',
                    tag: `ELBW-${lineObj.tag}-START`,
                    param: 0.0,
                    diameter: diameter || 4,
                    material: material || 'PPR'
                };
                if (!lineObj.components.some(c => c.tag === codoInicial.tag)) {
                    lineObj.components.push(codoInicial);
                    addedFittings.push(codoInicial.tag);
                }
            }

            if (fromObj && fromObj._cachedPoints) {
                const fromDiam = parseFloat(lineObj.diameter || diameter);
                const toDiam = parseFloat(fromObj.diameter || diameter);
                if (!isNaN(fromDiam) && !isNaN(toDiam) && Math.abs(fromDiam - toDiam) > 0.1) {
                    const reducerType = findComponentInCatalog('CONCENTRIC_REDUCER', material, []);
                    if (reducerType) {
                        const reducer = {
                            type: reducerType,
                            skey: 'REDC',
                            tag: `REDC-${lineObj.tag}-START`,
                            param: 0.0,
                            diameterLarge: Math.max(fromDiam, toDiam),
                            diameterSmall: Math.min(fromDiam, toDiam),
                            material: material || 'PPR'
                        };
                        if (!lineObj.components.some(c => c.tag === reducer.tag)) {
                            lineObj.components.push(reducer);
                            addedFittings.push(reducer.tag);
                        }
                    }
                }
            }
        }

        for (let i = 1; i < puntos.length - 1; i++) {
            const pAnt = puntos[i - 1];
            const pAct = puntos[i];
            const pSig = puntos[i + 1];

            const v1 = { x: pAct.x - pAnt.x, y: pAct.y - pAnt.y, z: pAct.z - pAnt.z };
            const v2 = { x: pSig.x - pAct.x, y: pSig.y - pAct.y, z: pSig.z - pAct.z };

            const len1 = Math.hypot(v1.x, v1.y, v1.z) || 1;
            const len2 = Math.hypot(v2.x, v2.y, v2.z) || 1;
            const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (len1 * len2);
            const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

            if (angleDeg > 15) {
                let totalLen = 0, accum = 0;
                for (let j = 0; j < puntos.length - 1; j++) {
                    totalLen += Math.hypot(puntos[j+1].x - puntos[j].x, puntos[j+1].y - puntos[j].y, puntos[j+1].z - puntos[j].z);
                }
                for (let j = 0; j < i; j++) {
                    accum += Math.hypot(puntos[j+1].x - puntos[j].x, puntos[j+1].y - puntos[j].y, puntos[j+1].z - puntos[j].z);
                }
                const paramValue = totalLen > 0 ? (accum / totalLen) : 0.5;

                const codo = {
                    type: 'ELBOW_90_LR',
                    skey: 'ELBW',
                    tag: `ELBW-${lineObj.tag}-${i}`,
                    param: paramValue,
                    diameter: diameter || 4,
                    material: material || 'PPR'
                };
                
                if (!lineObj.components.some(c => c.tag === codo.tag)) {
                    lineObj.components.push(codo);
                    addedFittings.push(codo.tag);
                }
            }
        }

        if (lineObj.destination && lineObj.destination.objType === 'line') {
            const targetLine = _core ? _core.findObjectByTag(lineObj.destination.equipTag) : null;
            const puntosTarget = targetLine ? (_core.getLinePoints(targetLine) || []) : [];
            
            const puntoFinalConexion = puntos[puntos.length - 1];
            const puntoCeroTarget = puntosTarget[0];

            let distanciaAPuntoCero = Infinity;
            if (puntoFinalConexion && puntoCeroTarget) {
                distanciaAPuntoCero = Math.hypot(
                    puntoFinalConexion.x - puntoCeroTarget.x,
                    puntoFinalConexion.y - puntoCeroTarget.y,
                    puntoFinalConexion.z - puntoCeroTarget.z
                );
            }

            if (distanciaAPuntoCero < 10) {
                const codoTerminal = {
                    type: 'ELBOW_90_LR',
                    skey: 'ELBW',
                    tag: `ELBW-${lineObj.tag}-TERM`,
                    param: 1.0,
                    diameter: diameter || 4,
                    material: material || 'PPR'
                };

                if (!lineObj.components.some(c => c.tag === codoTerminal.tag)) {
                    lineObj.components.push(codoTerminal);
                    addedFittings.push(codoTerminal.tag);
                }
            }
        }

        const delta = lineObj.components.length - inicialCount;
        return {
            added: addedFittings,
            message: delta > 0 ? ` | 🛠️ Accesorios inyectados: +${delta}` : ' | 📐 Continuidad geométrica OK'
        };
    }

    function insertarAccesorioEnLinea(lineTag, puntoConexion, diametroNuevaLinea, forzarTee = false) {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        const db = _core.getDb();
        const linea = db.lines.find(l => l.tag === lineTag);
        if (!linea) { notifyUser(`Línea ${lineTag} no encontrada`, true); return null; }
        const pts = _core.getLinePoints(linea) || linea._cachedPoints || linea.points3D || linea.points;
        if (!pts || pts.length < 2) { notifyUser(`Línea ${lineTag} sin geometría`, true); return null; }
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) { const d = distance(pts[i], pts[i+1]); lengths.push(d); totalLen += d; }
        let minDist = Infinity, bestSegIdx = 0, bestT = 0;
        for (let i = 0; i < lengths.length; i++) {
            const proj = projectPointOnSegment(puntoConexion, pts[i], pts[i+1]);
            if (proj.distance < minDist) { minDist = proj.distance; bestSegIdx = i; bestT = proj.t; }
        }
        let accumBefore = 0;
        for (let i = 0; i < bestSegIdx; i++) accumBefore += lengths[i];
        const param = (accumBefore + bestT * lengths[bestSegIdx]) / totalLen;
        const diamLinea = linea.diameter || 4;
        const diffDiam = Math.abs(diametroNuevaLinea - diamLinea) > 0.1;
        const esExtremo = !forzarTee && ((bestSegIdx === 0 && bestT < 0.1) || (bestSegIdx === lengths.length - 1 && bestT > 0.9));
        const lineMaterial = linea.material || 'PPR';
        let tipoAccesorio = 'TEE', descripcion = 'Tee igual';
        if (esExtremo && diffDiam) { tipoAccesorio = 'CONCENTRIC_REDUCER'; descripcion = `Reductor concéntrico ${diamLinea}"x${diametroNuevaLinea}"`; }
        else if (diffDiam) { tipoAccesorio = 'TEE_REDUCING'; descripcion = `Tee reductora ${diamLinea}"x${diametroNuevaLinea}"`; }
        else { tipoAccesorio = 'TEE'; descripcion = `Tee igual ${diamLinea}"`; }
        const compEnCatalogo = findComponentInCatalog(tipoAccesorio, lineMaterial, []);
        if (!compEnCatalogo) { notifyUser(`Componente no encontrado: ${tipoAccesorio} (${lineMaterial})`, true); return null; }
        if (typeof SmartFlowCommands !== 'undefined') {
            const cmd = `edit line ${lineTag} add component ${compEnCatalogo} at ${param.toFixed(3)}`;
            SmartFlowCommands.executeCommand(cmd);
        } else {
            notifyUser('Módulo de comandos no disponible', true);
            return null;
        }
        notifyUser(`✅ ${descripcion} (${compEnCatalogo}) insertado en ${lineTag}`, false);
        const lineaActualizada = db.lines.find(l => l.tag === lineTag);
        if (!lineaActualizada || !lineaActualizada.puertos || lineaActualizada.puertos.length === 0) {
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
        const ptsNueva = _core.getLinePoints(nuevaLinea) || nuevaLinea._cachedPoints || nuevaLinea.points3D || nuevaLinea.points;
        if (!ptsNueva || ptsNueva.length < 2) return;
        const tolerancia = 100;
        for (let lineaExistente of lineasExistentes) {
            const ptsExistente = _core.getLinePoints(lineaExistente) || lineaExistente._cachedPoints || lineaExistente.points3D || lineaExistente.points;
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
                            if (ptsNueva.length >= 2) { ptsNueva[ptsNueva.length - 1] = proj.point; nuevaLinea._cachedPoints = ptsNueva; nuevaLinea.waypoints = ptsNueva.slice(1, -1); }
                            if (lineaExistente.puertos) { const puerto = lineaExistente.puertos.find(p => p.id === puertoId); if (puerto) puerto.connectedLine = nuevaLinea.tag; }
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
        const fromObj = _core.findObjectByTag(fromEquipTag) || db.equipos.find(e => e.tag === fromEquipTag) || db.lines.find(l => l.tag === fromEquipTag);
        let toObj = _core.findObjectByTag(toEquipTag) || db.equipos.find(e => e.tag === toEquipTag) || db.lines.find(l => l.tag === toEquipTag);
        if (!fromObj) { notifyUser(`Origen ${fromEquipTag} no encontrado`, true); return null; }
        if (!toObj) { notifyUser(`Destino ${toEquipTag} no encontrado`, true); return null; }

        let startPos = getPortPosition(fromObj, fromPortId);
        if (!startPos) { notifyUser(`Puerto origen ${fromPortId} no encontrado`, true); return null; }

        let endPos, nuevoPuertoId = toPortId;
        let reductorComponent = null;

        if (_core.getLinePoints(toObj) || toObj._cachedPoints || toObj.points3D || toObj.points) {
            const pts = _core.getLinePoints(toObj) || toObj._cachedPoints || toObj.points3D || toObj.points;
            if (!pts || pts.length < 2) { notifyUser(`La línea ${toEquipTag} no tiene geometría`, true); return null; }
            if (!toPortId || toPortId === '') {
                let minDist = Infinity, bestPoint = pts[0];
                for (let i = 0; i < pts.length - 1; i++) { const proj = projectPointOnSegment(startPos, pts[i], pts[i+1]); if (proj.distance < minDist) { minDist = proj.distance; bestPoint = proj.point; } }
                const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, bestPoint, diameter, true);
                if (!puertoInsertado) return null;
                nuevoPuertoId = puertoInsertado;
                endPos = bestPoint;
                toObj = _core.findObjectByTag(toEquipTag) || db.lines.find(l => l.tag === toEquipTag);
            } else {
                let puntoConexion;
                if (toPortId === '0') puntoConexion = pts[0];
                else if (toPortId === '1') puntoConexion = pts[pts.length - 1];
                else puntoConexion = getPortPosition(toObj, toPortId);
                if (!puntoConexion) { notifyUser(`Puerto destino no encontrado`, true); return null; }
                const esExtremo = (toPortId === '0' || toPortId === '1');
                const diffDiam = Math.abs(diameter - (toObj.diameter || 4)) > 0.1;
                if (esExtremo && !diffDiam) { nuevoPuertoId = toPortId; endPos = puntoConexion; }
                else if (esExtremo && diffDiam) {
                    const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, puntoConexion, diameter, false);
                    if (puertoInsertado) { nuevoPuertoId = puertoInsertado; toObj = _core.findObjectByTag(toEquipTag) || db.lines.find(l => l.tag === toEquipTag); }
                    else { const reductorId = findComponentInCatalog('CONCENTRIC_REDUCER', material, []); if (reductorId) { reductorComponent = { type: reductorId, tag: reductorId + '-' + Date.now().toString().slice(-6), param: 1.0 }; } nuevoPuertoId = toPortId; }
                    endPos = puntoConexion;
                } else {
                    const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, puntoConexion, diameter, true);
                    if (!puertoInsertado) return null;
                    nuevoPuertoId = puertoInsertado;
                    endPos = puntoConexion;
                    toObj = _core.findObjectByTag(toEquipTag) || db.lines.find(l => l.tag === toEquipTag);
                }
            }
        } else {
            endPos = getPortPosition(toObj, nuevoPuertoId);
        }
        if (!endPos) { notifyUser(`Puerto destino no encontrado`, true); return null; }

        const startDirRaw = getPortDirection(fromObj, fromPortId);
        const startDir = normalizeVector(startDirRaw);
        let endDirRaw, endDir;
        const isEquipoDest = toObj.posX !== undefined || (toObj.pos && toObj.pos.x !== undefined);
        if (isEquipoDest) { endDirRaw = getPortDirection(toObj, nuevoPuertoId); endDir = normalizeVector(endDirRaw); }
        else {
            const ptsTo = _core.getLinePoints(toObj) || toObj._cachedPoints || toObj.points3D || toObj.points;
            if (ptsTo && ptsTo.length >= 2) { endDir = normalizeVector(subtractPoints(ptsTo[ptsTo.length - 1], ptsTo[ptsTo.length - 2])); }
            else { endDir = { dx: 1, dy: 0, dz: 0, x: 1, y: 0, z: 0 }; }
        }

        const orthoResultStart = calculateOrthogonalIntersection(startPos, startDir, endPos);
        const endDirInverted = scalePoint(endDir, -1);
        const orthoResultEnd = calculateOrthogonalIntersection(endPos, endDirInverted, startPos);
        const waypoints = [startPos];
        const extStart = addPoints(startPos, scalePoint(startDir, EXTENSION_DISTANCE));
        if (orthoResultStart.isOrthogonal) { waypoints.push(extStart); waypoints.push(orthoResultStart.intersection); }
        else { waypoints.push(extStart); const breakPoint = orthoResultStart.intersection; waypoints.push(breakPoint); waypoints.push(endPos); }
        let uniqueWaypoints = waypoints.filter((pt, i, arr) => i === 0 || distance(pt, arr[i-1]) > 1);
        if (uniqueWaypoints.length < 2) uniqueWaypoints = [startPos, endPos];

        const tag = `L-${db.lines.length + 1}`;
        const nuevaLinea = {
            tag, diameter, material, spec,
            origin: { objType: (fromObj.posX !== undefined || (fromObj.pos && fromObj.pos.x !== undefined)) ? 'equipment' : 'line', equipTag: fromEquipTag, portId: fromPortId },
            destination: { objType: isEquipoDest ? 'equipment' : 'line', equipTag: toEquipTag, portId: nuevoPuertoId },
            waypoints: uniqueWaypoints.slice(1, -1),
            _cachedPoints: [...uniqueWaypoints],
            points3D: [...uniqueWaypoints],
            points: [...uniqueWaypoints],
            components: reductorComponent ? [reductorComponent] : []
        };

        _core.addLine(nuevaLinea);
        
        const lineaRegistrada = db.lines.find(l => l.tag === tag) || nuevaLinea;
        const fittingInfo = ensureFittings(lineaRegistrada, fromObj, fromPortId, toObj, nuevoPuertoId, diameter, material);
        
        if (_core.updateLine) {
            _core.updateLine(tag, lineaRegistrada);
        }

        if (fromObj.puertos) { const pFrom = fromObj.puertos.find(p => p.id === fromPortId); if (pFrom) pFrom.connectedLine = tag; }
        if (toObj.puertos) { const pTo = toObj.puertos.find(p => p.id === nuevoPuertoId); if (pTo) pTo.connectedLine = tag; }
        
        notifyUser(`✅ Ruta: ${tag} (${fromEquipTag}.${fromPortId} → ${toEquipTag}.${nuevoPuertoId})${fittingInfo.message}`, false);
        return lineaRegistrada;
    }

    function handleSnapClick(snapData) {
        if (!snapData) return;
        ensureInitialized();
        _core.setSelected({ type: 'PUERTO', obj: snapData.port, parent: snapData.item });
        notifyUser(`Puerto seleccionado: ${snapData.item.tag} - ${snapData.port.id}`);
    }

    function executeCommand(cmdLine) {
        ensureInitialized();
        const parts = cmdLine.trim().split(/\s+/);
        const action = parts[0]?.toLowerCase();
        const args = parts.slice(1);
        switch(action) {
            case 'conectar': if (args.length >= 4) routeBetweenPorts(args[0], args[1], args[2], args[3]); else notifyUser('Formato: conectar [Origen] [Puerto] [Destino] [Puerto]', true); break;
            case 'split': if (args.length >= 2) { const lineTag = args[0]; const param = parseFloat(args[1]); if (!isNaN(param) && _core.injectAccessory) { _core.injectAccessory(lineTag, param, { tag: 'TEE', generarPuertos: (line, p, d) => _catalog.getComponent('TEE_EQUAL')?.generarPuertos?.({diameter: d}) || [] }); } } else notifyUser('Formato: split [Línea] [Posición 0-1]', true); break;
            case 'limpiar': if (_core.nuevoProyecto) _core.nuevoProyecto(); notifyUser('Proyecto limpiado.', false); break;
            default: notifyUser(`Comando router no reconocido: ${action}`, true);
        }
    }

    function init(coreInstance, catalogInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _notifyUI = notifyFn || ((msg, isErr) => console.log(msg));
        _renderUI = renderFn || (() => {});
    }

    return {
        init, routeBetweenPorts, insertarAccesorioEnLinea, procesarInterseccionesDeLinea,
        getPortPosition, getPortDirection, getPortDirectionLocal, findComponentInCatalog,
        findElbowForLine, calculateOrthogonalIntersection, getFittingLength, ensureFittings,
        handleSnapClick, executeCommand
    };
})();

if (typeof window !== 'undefined') window.SmartFlowRouter = SmartFlowRouter;
