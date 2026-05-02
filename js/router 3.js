
// SmartFlowRouter v7.4 - Ruta directa para distancias < 1000 mm
const SmartFlowRouter = (function() {
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);

    const _dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
    const _clone = p => ({x:p.x, y:p.y, z:p.z});
    const _sub = (a,b) => ({x:a.x-b.x, y:a.y-b.y, z:a.z-b.z});
    const _dot = (a,b) => a.x*b.x + a.y*b.y + a.z*b.z;
    const _norm = v => {
        const len = Math.hypot(v.x, v.y, v.z) || 1;
        return {dx: v.x/len, dy: v.y/len, dz: v.z/len};
    };

    function _cleanPoints(pts) {
        if (!pts || pts.length < 2) return pts;
        const cleaned = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            if (_dist(pts[i], cleaned[cleaned.length-1]) > 1) {
                cleaned.push(pts[i]);
            }
        }
        return cleaned;
    }

    function angleBetweenVectors(v1, v2) {
        const dot = v1.dx * v2.dx + v1.dy * v2.dy + v1.dz * v2.dz;
        return Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
    }

    function findElbow(material, angleDeg) {
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

    function injectElbowsInRoute(points, material) {
        if (!points || points.length < 2) return [];
        const elbows = [];
        for (let i = 1; i < points.length - 1; i++) {
            const seg1 = { dx: points[i].x - points[i-1].x, dy: points[i].y - points[i-1].y, dz: points[i].z - points[i-1].z };
            const seg2 = { dx: points[i+1].x - points[i].x, dy: points[i+1].y - points[i].y, dz: points[i+1].z - points[i].z };
            const len1 = Math.hypot(seg1.dx, seg1.dy, seg1.dz) || 1;
            const len2 = Math.hypot(seg2.dx, seg2.dy, seg2.dz) || 1;
            const v1 = { dx: seg1.dx/len1, dy: seg1.dy/len1, dz: seg1.dz/len1 };
            const v2 = { dx: seg2.dx/len2, dy: seg2.dy/len2, dz: seg2.dz/len2 };
            const angle = angleBetweenVectors(v1, v2);
            const elbowType = findElbow(material, angle);
            if (elbowType) {
                elbows.push({
                    type: elbowType,
                    tag: `${elbowType}-${Date.now().toString(36)}`,
                    param: i / (points.length - 1),
                    angle: Math.round(angle)
                });
            }
        }
        return elbows;
    }

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
        const pts = obj.points || obj._cachedPoints;
        if (!pts || pts.length < 2) return null;
        if (portId === '0') return _clone(pts[0]);
        if (portId === '1') return _clone(pts[pts.length-1]);
        if (obj.puertos) {
            const vp = obj.puertos.find(p => p.id === portId);
            if (vp && vp.relX !== undefined) {
                const ref = pts[0];
                return {x: ref.x + vp.relX, y: ref.y + vp.relY, z: ref.z + vp.relZ};
            }
        }
        return null;
    }

    function getPortDirection(obj, portId) {
        if (!obj) return {dx:1, dy:0, dz:0};
        if (obj.posX !== undefined) {
            const port = obj.puertos?.find(p => p.id === portId);
            return port?.orientacion || {dx:1, dy:0, dz:0};
        }
        const pts = obj.points || obj._cachedPoints;
        if (!pts || pts.length < 2) return {dx:1, dy:0, dz:0};
        if (portId === '0') return _norm(_sub(pts[1], pts[0]));
        if (portId === '1') {
            const last = pts.length-1;
            const d = _sub(pts[last], pts[last-1]);
            return {dx: -d.x, dy: -d.y, dz: -d.z};
        }
        return {dx:1, dy:0, dz:0};
    }

    function insertarAccesorioEnLinea(lineTag, punto, diamNuevo, forzarTee = false) {
        const db = _core.getDb();
        const linea = db.lines.find(l => l.tag === lineTag);
        if (!linea) {
            _notifyUI(`Línea ${lineTag} no encontrada`, true);
            return null;
        }
        const pts = linea.points || linea._cachedPoints;
        if (!pts || pts.length < 2) {
            _notifyUI(`Línea ${lineTag} sin geometría`, true);
            return null;
        }
        let minDist = Infinity, bestParam = 0.5, bestProj = null;
        let totalLen = 0, lengths = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const d = _dist(pts[i], pts[i+1]);
            lengths.push(d);
            totalLen += d;
        }
        if (totalLen === 0) return null;
        let accum = 0;
        for (let i = 0; i < lengths.length; i++) {
            const a = pts[i], b = pts[i+1];
            const ab = _sub(b, a);
            const ap = _sub(punto, a);
            const t = Math.max(0, Math.min(1, _dot(ap, ab) / (ab.x*ab.x + ab.y*ab.y + ab.z*ab.z || 1)));
            const proj = {x: a.x + t*ab.x, y: a.y + t*ab.y, z: a.z + t*ab.z};
            const dist = _dist(punto, proj);
            if (dist < minDist) {
                minDist = dist;
                bestParam = (accum + t * lengths[i]) / totalLen;
                bestProj = proj;
            }
            accum += lengths[i];
        }
        if (minDist > 500) {
            _notifyUI(`Punto muy alejado de la línea (${minDist.toFixed(0)} mm)`, true);
            return null;
        }
        const diamLinea = linea.diameter || 4;
        const diffDiam = Math.abs(diamNuevo - diamLinea) > 0.01;
        const tipoAccesorio = diffDiam ? 'TEE_REDUCING' : 'TEE_EQUAL';
        const compEnCatalogo = _catalog?.getComponent(tipoAccesorio);
        if (!compEnCatalogo) {
            _notifyUI(`Accesorio ${tipoAccesorio} no encontrado`, true);
            return null;
        }
        const compTag = `${tipoAccesorio}-${Date.now().toString(36)}`;
        linea.components = linea.components || [];
        linea.components.push({ type: compEnCatalogo.tipo || tipoAccesorio, tag: compTag, param: bestParam });
        const puertoId = `TAP-${compTag}`;
        const ref = pts[0];
        linea.puertos = linea.puertos || [];
        linea.puertos.push({
            id: puertoId,
            label: 'Derivación',
            relX: bestProj.x - ref.x,
            relY: bestProj.y - ref.y,
            relZ: bestProj.z - ref.z,
            diametro: diamNuevo,
            status: 'open',
            orientacion: {dx:0, dy:1, dz:0}
        });
        _core.updateLine(lineTag, { components: linea.components, puertos: linea.puertos });
        _core._saveState();
        return puertoId;
    }

    function calculateRoute(start, end, axisPriority = ['x','z','y']) {
        let pts = [_clone(start)];
        let cur = _clone(start);
        for (let axis of axisPriority) {
            if (Math.abs(cur[axis] - end[axis]) > 1) {
                cur[axis] = end[axis];
                pts.push(_clone(cur));
            }
        }
        return _cleanPoints(pts);
    }

    function routeBetweenPorts(fromTag, fromPort, toTag, toPort, diameter = 4, material = 'PPR', spec = 'PPR_PN12_5') {
        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromTag) || db.lines.find(l => l.tag === fromTag);
        let toObj = db.equipos.find(e => e.tag === toTag) || db.lines.find(l => l.tag === toTag);
        if (!fromObj || !toObj) {
            _notifyUI("Origen o destino no encontrado", true);
            return null;
        }
        let startPos = getPortPosition(fromObj, fromPort);
        if (!startPos) {
            _notifyUI(`Puerto origen ${fromPort} no encontrado en ${fromTag}`, true);
            return null;
        }
        let endPos = null, nuevoPuertoId = toPort;
        const isLineDest = toObj.points || toObj._cachedPoints;
        if (isLineDest && toPort !== '0' && toPort !== '1') {
            const numPos = parseFloat(toPort);
            if (!isNaN(numPos) && numPos >= 0 && numPos <= 1) {
                const pts = toObj.points || toObj._cachedPoints;
                let totalLen = 0, lengths = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const d = _dist(pts[i], pts[i+1]);
                    lengths.push(d); totalLen += d;
                }
                const target = totalLen * numPos;
                let accum = 0, segIdx = 0, t = 0;
                for (let i = 0; i < lengths.length; i++) {
                    if (accum + lengths[i] >= target || i === lengths.length - 1) {
                        segIdx = i; t = (target - accum) / (lengths[i] || 1);
                        break;
                    }
                    accum += lengths[i];
                }
                const pa = pts[segIdx], pb = pts[segIdx+1];
                const punto = {x: pa.x + (pb.x - pa.x)*t, y: pa.y + (pb.y - pa.y)*t, z: pa.z + (pb.z - pa.z)*t};
                const puertoId = insertarAccesorioEnLinea(toTag, punto, diameter, true);
                if (!puertoId) return null;
                nuevoPuertoId = puertoId;
                toObj = db.lines.find(l => l.tag === toTag);
                endPos = getPortPosition(toObj, puertoId);
            } else {
                endPos = getPortPosition(toObj, toPort);
                if (!endPos) {
                    _notifyUI(`Puerto destino ${toPort} no encontrado en ${toTag}`, true);
                    return null;
                }
                nuevoPuertoId = toPort;
            }
        } else {
            endPos = getPortPosition(toObj, toPort);
            if (!endPos) {
                _notifyUI(`Puerto destino ${toPort} no encontrado en ${toTag}`, true);
                return null;
            }
        }
        if (!endPos) {
            _notifyUI("No se pudo determinar posición destino", true);
            return null;
        }
        const finalMat = material || toObj.material || 'PPR';
        const finalSpec = spec || toObj.spec || 'PPR_PN12_5';
        const dist = _dist(startPos, endPos);

        // ** NUEVO: Para distancias menores de 1000 mm, usar ruta directa **
        let route;
        let usarRutaDirecta = dist < 1000;
        if (usarRutaDirecta) {
            route = [startPos, endPos];
        } else {
            route = calculateRoute(startPos, endPos, ['x','z','y']);
        }

        let comps = injectElbowsInRoute(route, finalMat);

        // Codos en extremos (ángulo > 15°)
        const dirFrom = getPortDirection(fromObj, fromPort);
        const firstSeg = _norm(_sub(route[1], route[0]));
        const angleFrom = angleBetweenVectors(dirFrom, firstSeg);
        if (angleFrom >= 15) {
            const elbow = findElbow(finalMat, angleFrom);
            if (elbow) comps.push({ type: elbow, tag: `${elbow}-${Date.now().toString(36)}`, param: 0.0, angle: Math.round(angleFrom) });
        }

        const dirTo = getPortDirection(toObj, nuevoPuertoId);
        const lastSeg = _norm(_sub(endPos, route[route.length-2]));
        const angleTo = angleBetweenVectors(dirTo, lastSeg);
        if (angleTo >= 15) {
            const elbow = findElbow(finalMat, angleTo);
            if (elbow) comps.push({ type: elbow, tag: `${elbow}-${Date.now().toString(36)}`, param: 1.0, angle: Math.round(angleTo) });
        }

        // Reductor solo si hay diferencia real de diámetros (>0.01)
        const diamOrig = parseFloat((fromObj.puertos?.find(p => p.id === fromPort)?.diametro) || diameter);
        const diamDest = parseFloat((toObj.puertos?.find(p => p.id === nuevoPuertoId)?.diametro) || diameter);
        if (Math.abs(diamOrig - diamDest) > 0.01) {
            comps.push({
                type: 'CONCENTRIC_REDUCER',
                tag: `RED-${Date.now().toString(36)}`,
                param: 0.95,
                fromDiam: diamOrig,
                toDiam: diamDest
            });
        }

        const newTag = `L-${db.lines.length + 1}`;
        const newLine = {
            tag: newTag,
            diameter,
            material: finalMat,
            spec: finalSpec,
            points: route,
            _cachedPoints: route,
            waypoints: route.slice(1, -1),
            origin: { objType: fromObj.posX !== undefined ? 'equipment' : 'line', equipTag: fromTag, portId: fromPort },
            destination: { objType: toObj.posX !== undefined ? 'equipment' : 'line', equipTag: toTag, portId: nuevoPuertoId },
            components: comps
        };

        _core.addLine(newLine);

        // Marcar puertos conectados
        const fromPortObj = fromObj.puertos?.find(p => p.id === fromPort);
        if (fromPortObj) { fromPortObj.status = 'connected'; fromPortObj.connectedLine = newTag; }
        if (toObj.puertos) {
            const toPortObj = toObj.puertos.find(p => p.id === nuevoPuertoId);
            if (toPortObj) { toPortObj.status = 'connected'; toPortObj.connectedLine = newTag; }
        }
        _core.syncPhysicalData();
        _core._saveState();
        _notifyUI(`Ruta ${newTag} creada (${fromTag}.${fromPort} → ${toTag}.${nuevoPuertoId}) ${usarRutaDirecta ? '(línea recta)' : '(ortogonal)'} con ${comps.length} accesorios`, false);
        return newLine;
    }

    function init(core, catalog, notifyFn) {
        _core = core;
        _catalog = catalog;
        if (notifyFn) _notifyUI = notifyFn;
        console.log("Router v7.4 con ruta directa < 1000 mm listo");
    }

    return {
        init,
        getPortPosition,
        getPortDirection,
        routeBetweenPorts,
        insertarAccesorioEnLinea,
        calculateRoute
    };
})();
