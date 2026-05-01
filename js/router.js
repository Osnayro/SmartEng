
// ============================================================
// SMARTFLOW ROUTER v6.2 (Completo: auto‑codos, reductores, herencia)
// Archivo: js/router.js
// ============================================================

const SmartFlowRouter = (function() {
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);

    // ------------------------------------------------------------
    // Helpers geométricos
    // ------------------------------------------------------------
    const _dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
    const _clonePoint = (p) => ({ x: p.x, y: p.y, z: p.z });
    const _dot = (v1, v2) => v1.x*v2.x + v1.y*v2.y + v1.z*v2.z;
    const _normalize = (v) => {
        const len = Math.hypot(v.x, v.y, v.z);
        if (len === 0) return { dx:1, dy:0, dz:0 };
        return { dx: v.x/len, dy: v.y/len, dz: v.z/len };
    };
    const _subtract = (a,b) => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });

    // ------------------------------------------------------------
    // 1. Creación de malla volumétrica (tubería 3D)
    // ------------------------------------------------------------
    function createLineMesh(lineData) {
        const points = lineData.points || lineData._cachedPoints;
        if (!points || points.length < 2) return new THREE.Group();

        const vectors = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const diamMM = (parseFloat(lineData.diameter) || 4) * 25.4;
        const radius = Math.max(5, diamMM / 2);
        const curve = new THREE.CatmullRomCurve3(vectors);
        curve.curveType = 'catmullrom';
        curve.tension = 0; // respeta puntos exactos
        const tubularSegments = Math.max(32, vectors.length * 8);
        const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 12, false);

        let color = 0x71717a;
        if (lineData.spec && _catalog?.getSpec) {
            const spec = _catalog.getSpec(lineData.spec);
            if (spec?.color) color = spec.color;
        } else if (lineData.material) {
            const mat = lineData.material.toUpperCase();
            if (mat.includes('PPR')) color = 0x7c3aed;
            else if (mat.includes('ACERO')) color = 0x94a3b8;
            else if (mat.includes('HDPE')) color = 0x22c55e;
            else if (mat.includes('PVC')) color = 0xeab308;
        }
        const material = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { tag: lineData.tag, type: 'line' };
        return mesh;
    }

    // ------------------------------------------------------------
    // 2. Enrutamiento ortogonal (prioridad horizontal)
    // ------------------------------------------------------------
    function calculateRoute(start, end, axisPriority = ['x', 'z', 'y']) {
        const points = [_clonePoint(start)];
        let current = _clonePoint(start);
        for (let axis of axisPriority) {
            if (Math.abs(current[axis] - end[axis]) > 0.1) {
                current[axis] = end[axis];
                points.push(_clonePoint(current));
            }
        }
        // eliminar duplicados consecutivos
        const unique = [];
        for (let i=0; i<points.length; i++) {
            if (i===0 || _dist(points[i], points[i-1]) > 1) unique.push(points[i]);
        }
        return unique;
    }

    // ------------------------------------------------------------
    // 3. Obtener posición absoluta de un puerto (nozzle)
    // ------------------------------------------------------------
    function getPortPosition(obj, portId) {
        if (!obj) return null;
        if (obj.posX !== undefined) {
            const port = obj.puertos?.find(p => p.id === portId);
            if (!port) return null;
            return {
                x: obj.posX + (port.relX || 0),
                y: obj.posY + (port.relY || 0),
                z: obj.posZ + (port.relZ || 0)
            };
        }
        // Es una línea: puertos virtuales 0 (inicio) o 1 (fin)
        const pts = obj.points || obj._cachedPoints;
        if (!pts || pts.length === 0) return null;
        if (portId === '0') return _clonePoint(pts[0]);
        if (portId === '1') return _clonePoint(pts[pts.length-1]);
        return null;
    }

    function getPortDirection(obj, portId) {
        if (!obj) return { dx:1, dy:0, dz:0 };
        if (obj.posX !== undefined) {
            const port = obj.puertos?.find(p => p.id === portId);
            if (port && port.orientacion) return port.orientacion;
            return { dx:1, dy:0, dz:0 };
        }
        const pts = obj.points || obj._cachedPoints;
        if (pts && pts.length >= 2) {
            if (portId === '0') return _normalize(_subtract(pts[1], pts[0]));
            if (portId === '1') return _normalize(_subtract(pts[pts.length-1], pts[pts.length-2]));
        }
        return { dx:1, dy:0, dz:0 };
    }

    // ------------------------------------------------------------
    // 4. Seleccionar codo según material y ángulo
    // ------------------------------------------------------------
    function findElbowForLine(material, diameter, angleDeg) {
        const mat = material.toUpperCase();
        const is90 = Math.abs(angleDeg-90) < 10;
        const is45 = Math.abs(angleDeg-45) < 10;
        if (!is90 && !is45) return null;
        if (mat.includes('PPR')) return is90 ? 'ELBOW_90_PPR' : 'ELBOW_45_PPR';
        if (mat.includes('HDPE')) return is90 ? 'ELBOW_90_HDPE' : null;
        if (mat.includes('PVC')) return is90 ? 'ELBOW_90_PVC' : null;
        if (mat.includes('ACERO')) return is90 ? 'ELBOW_90_LR_CS' : 'ELBOW_45_CS';
        if (mat.includes('INOX')) return is90 ? 'ELBOW_90_SANITARY' : null;
        return is90 ? 'ELBOW_90_LR_CS' : 'ELBOW_45_CS';
    }

    // ------------------------------------------------------------
    // 5. Insertar accesorio (tee o reductor) en una línea existente
    // ------------------------------------------------------------
    function insertarAccesorioEnLinea(lineTag, puntoConexion, diametroNuevaLinea, forzarTee = false) {
        const db = _core.getDb();
        const linea = db.lines.find(l => l.tag === lineTag);
        if (!linea) { _notifyUI(`Línea ${lineTag} no encontrada`, true); return null; }

        let pts = linea.points || linea._cachedPoints;
        if (!pts || pts.length < 2) return null;

        // Encontrar el segmento más cercano e insertar punto
        let minDist = Infinity, insertIdx = -1;
        for (let i=0; i<pts.length-1; i++) {
            const a = pts[i], b = pts[i+1];
            const ab = _subtract(b, a);
            const ap = _subtract(puntoConexion, a);
            const t = _dot(ap, ab) / (ab.x*ab.x + ab.y*ab.y + ab.z*ab.z || 1);
            if (t >= 0 && t <= 1) {
                const proj = { x: a.x + t*ab.x, y: a.y + t*ab.y, z: a.z + t*ab.z };
                const d = _dist(puntoConexion, proj);
                if (d < minDist) { minDist = d; insertIdx = i+1; }
            }
        }
        if (insertIdx === -1) return null;
        pts.splice(insertIdx, 0, puntoConexion);

        const diamLinea = linea.diameter || 4;
        const diffDiam = Math.abs(diametroNuevaLinea - diamLinea) > 0.1;
        const esExtremo = !forzarTee && ((insertIdx===1 && _dist(pts[0], puntoConexion)<1) || (insertIdx===pts.length-2 && _dist(pts[pts.length-1], puntoConexion)<1));
        let tipoAccesorio = 'TEE_EQUAL';
        if (esExtremo && diffDiam) tipoAccesorio = 'CONCENTRIC_REDUCER';
        else if (diffDiam) tipoAccesorio = 'TEE_REDUCING';

        const compEnCatalogo = _catalog.getComponent(tipoAccesorio);
        if (!compEnCatalogo) { _notifyUI(`Accesorio ${tipoAccesorio} no encontrado`, true); return null; }

        const compTag = `${tipoAccesorio}-${Date.now().slice(-6)}`;
        const param = insertIdx / (pts.length-1);
        linea.components = linea.components || [];
        linea.components.push({ type: compEnCatalogo.tipo, tag: compTag, param });
        _core.updateLine(lineTag, { points: pts, _cachedPoints: pts, components: linea.components });

        // Generar puerto virtual para conexión
        const puertoId = `ACC-${compTag}`;
        const ref = pts[0];
        linea.puertos = linea.puertos || [];
        linea.puertos.push({
            id: puertoId, label: 'Derivación',
            relX: puntoConexion.x - ref.x, relY: puntoConexion.y - ref.y, relZ: puntoConexion.z - ref.z,
            diametro: diametroNuevaLinea, status: 'open'
        });
        _core.updateLine(lineTag, { puertos: linea.puertos });
        _notifyUI(`Accesorio ${compEnCatalogo.nombre} insertado en ${lineTag}`, false);
        return puertoId;
    }

    // ------------------------------------------------------------
    // 6. Enrutamiento entre dos puertos (con auto‑codos y reductores)
    // ------------------------------------------------------------
    function routeBetweenPorts(fromTag, fromPort, toTag, toPort, diameter = 4, material = 'PPR', spec = 'PPR_PN12_5') {
        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromTag) || db.lines.find(l => l.tag === fromTag);
        let toObj = db.equipos.find(e => e.tag === toTag) || db.lines.find(l => l.tag === toTag);
        if (!fromObj || !toObj) { _notifyUI("Origen o destino no encontrado", true); return null; }

        let startPos = getPortPosition(fromObj, fromPort);
        if (!startPos) { _notifyUI(`Puerto origen ${fromPort} no encontrado`, true); return null; }

        let endPos = null;
        let nuevoPuertoId = toPort;
        let reductorComponent = null;

        // Si el destino es una línea y no se especificó puerto o se pide conexión a punto intermedio
        if (toObj.points || toObj._cachedPoints) {
            const pts = toObj.points || toObj._cachedPoints;
            if (!pts || pts.length < 2) { _notifyUI("Línea destino sin geometría", true); return null; }

            if (!toPort || toPort === '') {
                // Buscar el punto más cercano de la línea
                let minDist = Infinity, bestPoint = null;
                for (let i=0; i<pts.length-1; i++) {
                    const a=pts[i], b=pts[i+1];
                    const ab=_subtract(b,a), ap=_subtract(startPos,a);
                    const t = _dot(ap,ab) / (ab.x*ab.x+ab.y*ab.y+ab.z*ab.z || 1);
                    if (t>=0 && t<=1) {
                        const proj = { x: a.x + t*ab.x, y: a.y + t*ab.y, z: a.z + t*ab.z };
                        const d = _dist(startPos, proj);
                        if (d < minDist) { minDist = d; bestPoint = proj; }
                    }
                }
                if (!bestPoint) { _notifyUI("No se pudo encontrar punto de conexión", true); return null; }
                const puertoId = insertarAccesorioEnLinea(toTag, bestPoint, diameter, true);
                if (!puertoId) return null;
                nuevoPuertoId = puertoId;
                toObj = db.lines.find(l => l.tag === toTag);
            } else {
                let puntoConexion = getPortPosition(toObj, toPort);
                if (!puntoConexion) { _notifyUI("Puerto destino no válido", true); return null; }
                const esExtremo = (toPort === '0' || toPort === '1');
                const diffDiam = Math.abs(diameter - (toObj.diameter || 4)) > 0.1;
                if (esExtremo && !diffDiam) {
                    nuevoPuertoId = toPort;
                } else if (esExtremo && diffDiam) {
                    const puertoId = insertarAccesorioEnLinea(toTag, puntoConexion, diameter, false);
                    if (puertoId) { nuevoPuertoId = puertoId; toObj = db.lines.find(l => l.tag === toTag); }
                    else {
                        const reductorId = (material.toUpperCase().includes('PPR')) ? 'CONCENTRIC_REDUCER_PPR' : 'CONCENTRIC_REDUCER_CS';
                        reductorComponent = { type: reductorId, tag: `${reductorId}-${Date.now().slice(-6)}`, param: 1.0 };
                        _notifyUI(`No se insertó reductor en ${toTag}, se añadirá a la nueva línea`, false);
                        nuevoPuertoId = toPort;
                    }
                } else {
                    const puertoId = insertarAccesorioEnLinea(toTag, puntoConexion, diameter, esExtremo ? false : true);
                    if (!puertoId) return null;
                    nuevoPuertoId = puertoId;
                    toObj = db.lines.find(l => l.tag === toTag);
                }
            }
        }
        endPos = getPortPosition(toObj, nuevoPuertoId);
        if (!endPos) { _notifyUI("No se pudo obtener posición destino", true); return null; }

        // Herencia de diámetro/material/spec del destino si no se especificaron
        if (toObj.diameter && !diameter) diameter = toObj.diameter;
        const materialFinal = material || toObj.material || 'PPR';
        const specFinal = spec || toObj.spec || 'PPR_PN12_5';

        // Calcular ruta ortogonal
        const points = calculateRoute(startPos, endPos, ['x', 'z', 'y']);
        const newTag = `L-${db.lines.length+1}`;
        const newLine = {
            tag: newTag, diameter, material: materialFinal, spec: specFinal,
            points, _cachedPoints: points, waypoints: points.slice(1,-1),
            origin: { objType: fromObj.posX!==undefined ? 'equipment' : 'line', equipTag: fromTag, portId: fromPort },
            destination: { objType: toObj.posX!==undefined ? 'equipment' : 'line', equipTag: toTag, portId: nuevoPuertoId },
            components: []
        };

        // Auto‑codo en origen (si es línea)
        if (fromObj.points || fromObj._cachedPoints) {
            const fromDir = getPortDirection(fromObj, fromPort);
            const firstSeg = _normalize(_subtract(points[1], startPos));
            const angleRad = Math.acos(Math.min(1, Math.abs(_dot(fromDir, firstSeg))));
            const angleDeg = angleRad * 180 / Math.PI;
            if (angleDeg > 15) {
                const elbowId = findElbowForLine(materialFinal, diameter, angleDeg);
                if (elbowId) newLine.components.push({ type: elbowId, tag: `${elbowId}-${Date.now().slice(-6)}`, param: 0.0 });
            }
        }
        // Auto‑codo en destino (si es línea)
        if (toObj.points || toObj._cachedPoints) {
            const toDir = getPortDirection(toObj, nuevoPuertoId);
            const lastSeg = _normalize(_subtract(endPos, points[points.length-2]));
            const angleRad = Math.acos(Math.min(1, Math.abs(_dot(toDir, lastSeg))));
            const angleDeg = angleRad * 180 / Math.PI;
            if (angleDeg > 15) {
                const elbowId = findElbowForLine(materialFinal, diameter, angleDeg);
                if (elbowId) newLine.components.push({ type: elbowId, tag: `${elbowId}-${Date.now().slice(-6)}`, param: 1.0 });
            }
        }

        if (reductorComponent) newLine.components.push(reductorComponent);

        _core.addLine(newLine);
        // Marcar puertos como conectados
        const fromPortObj = fromObj.puertos?.find(p=>p.id===fromPort);
        if (fromPortObj) fromPortObj.connectedLine = newTag;
        const toPortObj = toObj.puertos?.find(p=>p.id===nuevoPuertoId);
        if (toPortObj) toPortObj.connectedLine = newTag;

        _core.syncPhysicalData(); _core._saveState();
        _notifyUI(`✅ Ruta ${newTag} creada (${fromTag}.${fromPort} → ${toTag}.${nuevoPuertoId})`, false);
        return newLine;
    }

    // ------------------------------------------------------------
    // 7. Procesar intersecciones automáticas (placeholder)
    // ------------------------------------------------------------
    function procesarInterseccionesDeLinea(nuevaLinea) {
        // Puedes implementar detección de cruces con otras líneas aquí
    }

    // ------------------------------------------------------------
    // 8. Inicialización
    // ------------------------------------------------------------
    function init(core, catalog, notifyFn) {
        _core = core; _catalog = catalog; if (notifyFn) _notifyUI = notifyFn;
        console.log("✅ Router v6.2 listo (auto-codos, reductores, herencia)");
    }

    return {
        init, createLineMesh, calculateRoute, getPortPosition, getPortDirection,
        routeBetweenPorts, insertarAccesorioEnLinea, procesarInterseccionesDeLinea
    };
})();
