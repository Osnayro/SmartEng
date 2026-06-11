
// ============================================================
// SMARTFLOW ROUTER v3.6.4 - Enrutador de Tuberías Inteligente
// Archivo: js/router.js
// Compatible: SmartFlowCore v5.6 + SmartFlowCommands v3.6
// Correcciones v3.6.4:
//   - Bandas fittingInsertedAtOrigin/Destination sin guion bajo
//     (no se pierden al serializar en addLine)
//   - ensureFittings respeta fittingInsertedAtOrigin (no inyecta codo/reductor en origen)
//   - ensureFittings respeta fittingInsertedAtDestination (no inyecta codo/reductor en destino)
//   - CODO EN FIN: detecta llegada coaxial, NO inyecta codo innecesario
//   - insertarAccesorioEnLinea recibe y aplica branchOrientation
//   - Fallback de generación de puertos si el catálogo no lo hace
//   - calculateBranchDirection: función auxiliar
// ============================================================

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

    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================

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

    function notifyUser(message, isError) {
        isError = isError || false;
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        var statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        speakText(message);
    }

    // ================================================================
    //  UTILIDADES GEOMÉTRICAS
    // ================================================================

    function distance(p1, p2) { return Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z); }
    function addPoints(p1, p2) { return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z }; }
    function subtractPoints(p1, p2) { return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }; }
    function scalePoint(p, factor) { return { x: p.x * factor, y: p.y * factor, z: p.z * factor }; }
    
    function normalizeVector(v) {
        var len = Math.hypot(v.x, v.y, v.z);
        if (len === 0) return { x: 1, y: 0, z: 0, dx: 1, dy: 0, dz: 0 };
        var n = { x: v.x / len, y: v.y / len, z: v.z / len };
        n.dx = n.x; n.dy = n.y; n.dz = n.z;
        return n;
    }
    
    function dotProduct(v1, v2) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    function crossProduct(v1, v2) { return { x: v1.y * v2.z - v1.z * v2.y, y: v1.z * v2.x - v1.x * v2.z, z: v1.x * v2.y - v1.y * v2.x }; }
    
    function projectPointOnSegment(p, a, b) {
        var ab = subtractPoints(b, a);
        var ap = subtractPoints(p, a);
        var len2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
        if (len2 === 0) return { point: a, t: 0, distance: distance(p, a) };
        var t = dotProduct(ap, ab) / len2;
        t = Math.max(0, Math.min(1, t));
        var proj = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
        return { point: proj, t: t, distance: distance(p, proj) };
    }

    function getPointAtParam(pts, param) {
        if (!pts || pts.length < 2) return pts && pts[0] ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : null;
        var lengths = [], totalLen = 0;
        for (var i = 0; i < pts.length - 1; i++) { var d = distance(pts[i], pts[i+1]); lengths.push(d); totalLen += d; }
        if (totalLen === 0) return { x: pts[0].x, y: pts[0].y, z: pts[0].z };
        var targetDist = totalLen * Math.max(0, Math.min(1, param));
        var accumDist = 0;
        for (var j = 0; j < lengths.length; j++) {
            if (accumDist + lengths[j] >= targetDist || j === lengths.length - 1) {
                var segParam = lengths[j] > 0 ? (targetDist - accumDist) / lengths[j] : 0;
                segParam = Math.max(0, Math.min(1, segParam));
                return { x: pts[j].x + (pts[j+1].x - pts[j].x) * segParam, y: pts[j].y + (pts[j+1].y - pts[j].y) * segParam, z: pts[j].z + (pts[j+1].z - pts[j].z) * segParam };
            }
            accumDist += lengths[j];
        }
        return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: pts[pts.length - 1].z };
    }

    function getDirectionAtParam(pts, param) {
        if (!pts || pts.length < 2) return { dx: 1, dy: 0, dz: 0, x: 1, y: 0, z: 0 };
        var lengths = [], totalLen = 0;
        for (var i = 0; i < pts.length - 1; i++) { var d = distance(pts[i], pts[i+1]); lengths.push(d); totalLen += d; }
        if (totalLen === 0) return { dx: 1, dy: 0, dz: 0, x: 1, y: 0, z: 0 };
        var targetDist = totalLen * Math.max(0, Math.min(1, param));
        var accumDist = 0;
        for (var j = 0; j < lengths.length; j++) {
            if (accumDist + lengths[j] >= targetDist || j === lengths.length - 1) {
                var dx = pts[j+1].x - pts[j].x, dy = pts[j+1].y - pts[j].y, dz = pts[j+1].z - pts[j].z;
                var len = Math.hypot(dx, dy, dz) || 1;
                return { dx: dx/len, dy: dy/len, dz: dz/len, x: dx/len, y: dy/len, z: dz/len };
            }
            accumDist += lengths[j];
        }
        var lastIdx = pts.length - 1;
        var dx2 = pts[lastIdx].x - pts[lastIdx-1].x, dy2 = pts[lastIdx].y - pts[lastIdx-1].y, dz2 = pts[lastIdx].z - pts[lastIdx-1].z;
        var len2 = Math.hypot(dx2, dy2, dz2) || 1;
        return { dx: dx2/len2, dy: dy2/len2, dz: dz2/len2, x: dx2/len2, y: dy2/len2, z: dz2/len2 };
    }

    function calculateOrthogonalIntersection(portPos, portDir, targetPos) {
        if (!portPos || !portDir || !targetPos) {
            return { intersection: portPos || { x: 0, y: 0, z: 0 }, lateralDistance: 0, isOrthogonal: true, angleDeg: 0, needsElbow: false,
                lateralVector: { x: 0, y: 0, z: 0 }, lateralDir: { dx: 0, dy: 0, dz: 0, x: 0, y: 0, z: 0 } };
        }
        var dir = normalizeVector(portDir);
        if (Math.hypot(dir.x, dir.y, dir.z) < 0.0001) {
            return { intersection: portPos, lateralDistance: 0, isOrthogonal: true, angleDeg: 0, needsElbow: false,
                lateralVector: { x: 0, y: 0, z: 0 }, lateralDir: { dx: 0, dy: 0, dz: 0, x: 0, y: 0, z: 0 } };
        }
        var toTarget = subtractPoints(targetPos, portPos);
        var targetDist = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
        if (targetDist === 0 || isNaN(targetDist)) {
            return { intersection: portPos, lateralDistance: 0, isOrthogonal: true, angleDeg: 0, needsElbow: false,
                lateralVector: { x: 0, y: 0, z: 0 }, lateralDir: { dx: 0, dy: 0, dz: 0, x: 0, y: 0, z: 0 } };
        }
        var projLength = dotProduct(toTarget, dir);
        if (isNaN(projLength)) {
            var toTargetDir = normalizeVector(toTarget);
            return { intersection: portPos, lateralVector: toTarget,
                lateralDir: { dx: toTargetDir.x, dy: toTargetDir.y, dz: toTargetDir.z, x: toTargetDir.x, y: toTargetDir.y, z: toTargetDir.z },
                lateralDistance: targetDist, isOrthogonal: false, angleDeg: 90, needsElbow: true };
        }
        var intersection = addPoints(portPos, scalePoint(dir, projLength));
        var lateralVector = subtractPoints(targetPos, intersection);
        var lateralDistance = Math.hypot(lateralVector.x, lateralVector.y, lateralVector.z);
        var toTargetDir2 = normalizeVector(toTarget);
        var cosAngle = Math.max(-1, Math.min(1, dotProduct(dir, toTargetDir2)));
        var angleDeg = Math.acos(cosAngle) * 180 / Math.PI;
        var isOrthogonal = lateralDistance < ORTHOGONAL_TOLERANCE || Math.abs(projLength) < ORTHOGONAL_TOLERANCE;
        var lateralDir = lateralDistance > 0 ? normalizeVector(lateralVector) : { dx: 0, dy: 0, dz: 0, x: 0, y: 0, z: 0 };
        return { intersection: intersection, lateralVector: lateralVector, lateralDir: lateralDir,
            lateralDistance: lateralDistance, isOrthogonal: isOrthogonal, angleDeg: angleDeg,
            needsElbow: !isOrthogonal && (angleDeg > MIN_ANGLE_FOR_ELBOW) };
    }

    function calculateBranchDirection(teePosition, targetPosition, waypoints) {
        var target;
        if (waypoints && waypoints.length > 0) { target = waypoints[0]; }
        else if (targetPosition) { target = targetPosition; }
        else { return { dx: 0, dy: 1, dz: 0 }; }
        var dx = target.x - teePosition.x, dy = target.y - teePosition.y, dz = target.z - teePosition.z;
        var len = Math.hypot(dx, dy, dz);
        if (len < 0.01) { return { dx: 0, dy: 1, dz: 0 }; }
        return { dx: dx / len, dy: dy / len, dz: dz / len };
    }

    // ================================================================
    //  CONSULTA DE PUERTOS Y DIRECCIONES
    // ================================================================

    function isParametricPortId(portId) {
        if (portId === '0' || portId === '1' || portId === 0 || portId === 1) return false;
        if (String(portId) === '0.0' || String(portId) === '1.0') return false;
        var paramValue = parseFloat(portId);
        return !isNaN(paramValue) && paramValue > 0 && paramValue < 1;
    }

    function getPortPosition(obj, portId) {
        if (!obj) return null;
        if (obj.posX !== undefined) {
            var puerto = obj.puertos ? obj.puertos.find(function(p) { return p.id === portId; }) : null;
            if (!puerto) return null;
            return { x: obj.posX + (puerto.relX || (puerto.relPos ? puerto.relPos.x : 0) || 0), 
                     y: obj.posY + (puerto.relY || (puerto.relPos ? puerto.relPos.y : 0) || 0), 
                     z: obj.posZ + (puerto.relZ || (puerto.relPos ? puerto.relPos.z : 0) || 0) };
        }
        if (obj.pos && obj.pos.x !== undefined) {
            var puerto2 = obj.puertos ? obj.puertos.find(function(p) { return p.id === portId; }) : null;
            if (!puerto2) return null;
            return { x: obj.pos.x + (puerto2.relX || (puerto2.relPos ? puerto2.relPos.x : 0) || 0),
                     y: obj.pos.y + (puerto2.relY || (puerto2.relPos ? puerto2.relPos.y : 0) || 0),
                     z: obj.pos.z + (puerto2.relZ || (puerto2.relPos ? puerto2.relPos.z : 0) || 0) };
        }
        var pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points);
        if (!pts || pts.length === 0) return null;
        if (obj.puertos) { var puerto3 = obj.puertos.find(function(p) { return p.id === portId; }); if (puerto3 && puerto3.pos) return puerto3.pos; }
        if (isParametricPortId(portId)) { var paramValue = parseFloat(portId); return getPointAtParam(pts, paramValue); }
        if (portId === '0') return { x: pts[0].x, y: pts[0].y, z: pts[0].z };
        if (portId === '1') return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: pts[pts.length - 1].z };
        var midIdx = Math.floor(pts.length / 2);
        return { x: pts[midIdx].x, y: pts[midIdx].y, z: pts[midIdx].z };
    }

    function getPortDirection(obj, portId) {
        var defaultDir = { dx: 1, dy: 0, dz: 0, x: 1, y: 0, z: 0 };
        if (!obj) return defaultDir;
        if (obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined)) {
            var puerto = obj.puertos ? obj.puertos.find(function(p) { return p.id === portId; }) : null;
            if (puerto) {
                var ori = puerto.orientacion || puerto.dir || puerto.normal || puerto.vector;
                if (ori) {
                    var x = parseFloat(ori.dx !== undefined ? ori.dx : (ori.x !== undefined ? ori.x : 1));
                    var y = parseFloat(ori.dy !== undefined ? ori.dy : (ori.y !== undefined ? ori.y : 0));
                    var z = parseFloat(ori.dz !== undefined ? ori.dz : (ori.z !== undefined ? ori.z : 0));
                    return { dx: x, dy: y, dz: z, x: x, y: y, z: z };
                }
            }
            return defaultDir;
        }
        var pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points);
        if (pts && Array.isArray(pts) && pts.length >= 2) {
            try {
                if (isParametricPortId(portId)) { var paramValue = parseFloat(portId); return getDirectionAtParam(pts, paramValue); }
                var pBase, pSig;
                if (portId === '0' || portId === 0) { pBase = pts[0]; pSig = pts[1]; }
                else if (portId === '1' || portId === 1 || portId === String(pts.length - 1)) { pBase = pts[pts.length - 2]; pSig = pts[pts.length - 1]; }
                else { pBase = pts[0]; pSig = pts[1]; }
                if (pBase && pSig && pBase.x !== undefined && pSig.x !== undefined) {
                    var vSub = { x: pSig.x - pBase.x, y: pSig.y - pBase.y, z: pSig.z - pBase.z };
                    var vNorm = normalizeVector(vSub);
                    return { dx: vNorm.x, dy: vNorm.y, dz: vNorm.z, x: vNorm.x, y: vNorm.y, z: vNorm.z };
                }
            } catch (err) { console.warn('Error de orientación en línea para puerto ' + portId + ':', err); }
        }
        return defaultDir;
    }

    function getPortDirectionLocal(obj, portId) { return getPortDirection(obj, portId); }

    function getPortDiameter(obj, portId) {
        if (!obj) return null;
        if (obj.puertos) { var puerto = obj.puertos.find(function(p) { return p.id === portId; }); if (puerto && puerto.diametro) return parseFloat(puerto.diametro); }
        if (obj.diameter) return parseFloat(obj.diameter);
        if (obj.diametro) return parseFloat(obj.diametro);
        return null;
    }

    function necesitaReductor(diam1, diam2, tolerancia) {
        tolerancia = tolerancia || 0.15;
        if (!diam1 || !diam2) return false;
        return Math.abs(diam1 - diam2) > tolerancia;
    }

    function getFittingLength(componentType, diameter) {
        var catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return 0;
        try {
            var comp = catalog.getComponent(componentType);
            if (!comp) return 0;
            var dims = comp.dimensiones || comp.dimensions;
            if (!dims) return 0;
            var diamKey = diameter + '"' || String(diameter);
            var dimForDiam = dims[diamKey] || dims[diameter] || dims.DEFAULT;
            if (dimForDiam && dimForDiam.centerToFace) return dimForDiam.centerToFace;
            var typicalLengths = { 'ELBOW_90': 38, 'ELBOW_45': 25, 'TEE': 50, 'TEE_EQUAL': 50, 'TEE_REDUCING': 55, 'CONCENTRIC_REDUCER': 75 };
            var keys = Object.keys(typicalLengths);
            for (var k = 0; k < keys.length; k++) { if (componentType.toUpperCase().indexOf(keys[k]) !== -1) return typicalLengths[keys[k]]; }
        } catch (e) { console.warn('Error obteniendo fitting length:', e); }
        return 50;
    }

    function getExpectedSpecForMaterial(material) {
        if (!material) return null;
        var mat = material.toUpperCase();
        if (mat.indexOf('PPR') !== -1) return 'PPR_PN12_5';
        if (mat.indexOf('HDPE') !== -1 || mat.indexOf('PE100') !== -1) return 'HDPE_PE100';
        if (mat.indexOf('PVC') !== -1 && mat.indexOf('CPVC') === -1) return 'PVC_SCH80';
        if (mat.indexOf('CPVC') !== -1) return 'CPVC_SCH80';
        if (mat.indexOf('INOX') !== -1 || mat.indexOf('SS') !== -1 || mat.indexOf('STAINLESS') !== -1) return 'SS_150_RF';
        if (mat.indexOf('ACERO') !== -1 || mat.indexOf('CARBONO') !== -1 || mat.indexOf('CS') !== -1) return 'ACERO_150_RF';
        return null;
    }

    // ================================================================
    //  BÚSQUEDA EN CATÁLOGO
    // ================================================================

    function findComponentInCatalog(desiredType, lineMaterial, fallbackTypes) {
        ensureInitialized();
        var catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) { notifyUser('Catálogo no disponible', true); return null; }
        var allTypes = catalog.listComponentTypes();
        var materialUpper = (lineMaterial || '').toUpperCase();
        fallbackTypes = fallbackTypes || [];
        var TYPE_SYNONYMS = {
            'TEE': ['TEE_EQUAL', 'TEE_PPR', 'TEE_CS', 'TEE_SS', 'EQUAL_TEE'],
            'TEE_EQUAL': ['TEE', 'TEE_PPR', 'TEE_CS', 'TEE_SS', 'EQUAL_TEE'],
            'TEE_REDUCING': ['TEE_REDUCER', 'REDUCING_TEE', 'TEE_RED'],
            'CONCENTRIC_REDUCER': ['REDUCER_CONCENTRIC', 'REDC', 'CONC_REDUCER', 'REDUCER'],
            'ECCENTRIC_REDUCER': ['REDUCER_ECCENTRIC', 'REDE', 'ECC_REDUCER'],
            'ELBOW_90_LR': ['ELBOW_90', 'ELBOW', 'ELBW', '90DEG_ELBOW'],
            'ELBOW_45': ['ELBOW_45_LR', '45DEG_ELBOW', 'ELL4'],
            'WELD_NECK_FLANGE': ['FLANGE_WN', 'FLWN', 'WN_FLANGE'],
            'SLIP_ON_FLANGE': ['FLANGE_SO', 'FLSO', 'SO_FLANGE'],
            'GATE_VALVE': ['VALVE_GATE', 'VAGF', 'GATE'],
            'BALL_VALVE': ['VALVE_BALL', 'VBAL', 'BALL'],
            'CHECK_VALVE': ['VALVE_CHECK', 'VCFF', 'CHECK']
        };
        var candidates = [];
        var synonyms = TYPE_SYNONYMS[desiredType] || [];
        for (var i = 0; i < synonyms.length; i++) { candidates.push(synonyms[i] + '_' + materialUpper); candidates.push(synonyms[i]); }
        for (var j = 0; j < fallbackTypes.length; j++) { candidates.push(fallbackTypes[j] + '_' + materialUpper); candidates.push(fallbackTypes[j]); }
        candidates.push(desiredType);
        for (var m = 0; m < candidates.length; m++) { if (allTypes.indexOf(candidates[m]) !== -1) return candidates[m]; }
        var baseName = desiredType.split('_')[0];
        for (var n = 0; n < allTypes.length; n++) { if (allTypes[n].toUpperCase().indexOf(baseName.toUpperCase()) !== -1 && allTypes[n].toUpperCase().indexOf(materialUpper) !== -1) return allTypes[n]; }
        for (var p = 0; p < allTypes.length; p++) { if (allTypes[p].toUpperCase().indexOf(baseName.toUpperCase()) !== -1) return allTypes[p]; }
        return null;
    }

    function findElbowForLine(material, diameter, angleDeg) {
        var catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return null;
        var allTypes = catalog.listComponentTypes();
        var mat = (material || '').toUpperCase();
        var expectedSpec = getExpectedSpecForMaterial(material);
        var elbowTypes = allTypes.filter(function(t) { return t.toUpperCase().indexOf('ELBOW') !== -1; });
        var bestMatch = null, bestDiff = Infinity;
        for (var i = 0; i < elbowTypes.length; i++) {
            var comp = catalog.getComponent(elbowTypes[i]);
            if (!comp || typeof comp.angulo === 'undefined') continue;
            if (expectedSpec && comp.spec && comp.spec.toUpperCase() !== expectedSpec.toUpperCase()) continue;
            var diff = Math.abs(comp.angulo - angleDeg);
            if (diff < bestDiff && diff < 15) { bestDiff = diff; bestMatch = elbowTypes[i]; }
        }
        if (!bestMatch) {
            for (var j = 0; j < elbowTypes.length; j++) {
                var t = elbowTypes[j]; var comp2 = catalog.getComponent(t); if (!comp2) continue;
                var compName = t.toUpperCase(); var compMat = (comp2.material || '').toUpperCase();
                if (mat.indexOf('PPR') !== -1 && (compName.indexOf('PPR') !== -1 || compMat.indexOf('PPR') !== -1)) { bestMatch = t; break; }
                if ((mat.indexOf('HDPE') !== -1) && (compName.indexOf('HDPE') !== -1)) { bestMatch = t; break; }
                if ((mat.indexOf('ACERO') !== -1 || mat.indexOf('CS') !== -1) && (compName.indexOf('CS') !== -1 || compName.indexOf('LR') !== -1) && compName.indexOf('SS') === -1) { bestMatch = t; break; }
                if ((mat.indexOf('INOX') !== -1 || mat.indexOf('SS') !== -1) && (compName.indexOf('SS') !== -1 || compName.indexOf('SANITARY') !== -1)) { bestMatch = t; break; }
            }
        }
        if (!bestMatch) {
            bestDiff = Infinity;
            for (var k = 0; k < elbowTypes.length; k++) {
                var comp3 = catalog.getComponent(elbowTypes[k]);
                if (!comp3 || typeof comp3.angulo === 'undefined') continue;
                var diff3 = Math.abs(comp3.angulo - angleDeg);
                if (diff3 < bestDiff && diff3 < 15) { bestDiff = diff3; bestMatch = elbowTypes[k]; }
            }
        }
        return bestMatch;
    }

    function findReducerForDiameters(diamLarge, diamSmall, material) {
        var catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return null;
        var allTypes = catalog.listComponentTypes();
        var materialUpper = (material || '').toUpperCase();
        var expectedSpec = getExpectedSpecForMaterial(material);
        var candidates = [];
        if (materialUpper.indexOf('PPR') !== -1) { candidates.push('CONCENTRIC_REDUCER_PPR', 'REDUCER_CONCENTRIC_PPR'); }
        else if (materialUpper.indexOf('ACERO') !== -1 || materialUpper.indexOf('CS') !== -1) { candidates.push('CONCENTRIC_REDUCER_CS', 'CONCENTRIC_REDUCER'); }
        else if (materialUpper.indexOf('INOX') !== -1 || materialUpper.indexOf('SS') !== -1) { candidates.push('CONCENTRIC_REDUCER_SS'); }
        candidates.push('CONCENTRIC_REDUCER', 'ECCENTRIC_REDUCER', 'REDUCER');
        if (expectedSpec) { for (var i = 0; i < candidates.length; i++) { if (allTypes.indexOf(candidates[i]) !== -1) { var comp = catalog.getComponent(candidates[i]); if (comp && comp.spec && comp.spec.toUpperCase() === expectedSpec.toUpperCase()) return candidates[i]; } } }
        for (var j = 0; j < candidates.length; j++) { if (allTypes.indexOf(candidates[j]) !== -1) return candidates[j]; }
        var reducerTypes = allTypes.filter(function(t) { return t.toUpperCase().indexOf('REDUC') !== -1 || t.toUpperCase().indexOf('REDC') !== -1; });
        for (var r = 0; r < reducerTypes.length; r++) { if (reducerTypes[r].toUpperCase().indexOf('CONC') !== -1) return reducerTypes[r]; }
        return reducerTypes.length > 0 ? reducerTypes[0] : null;
    }

    // ================================================================
    //  ENSUREFITTINGS v3.6.4
    // ================================================================

    function ensureFittings(lineObj, fromObj, fromPortId, toObj, toPortId, diameter, material, spec) {
        if (!lineObj) return { added: [], message: ' | ⚠️ Sin objeto de línea' };
        var puntos = lineObj._cachedPoints || lineObj.points3D || [];
        if (puntos.length < 2) return { added: [], message: ' | ⚠️ Puntos insuficientes' };
        lineObj.components = lineObj.components || [];
        var inicialCount = lineObj.components.length;
        var addedFittings = [];
        var effectiveSpec = spec || lineObj.spec || getExpectedSpecForMaterial(material) || 'PPR_PN12_5';
        
        function existeComponenteSimilar(tipo, param, tolerancia) {
            tolerancia = tolerancia || 0.03;
            return lineObj.components.some(function(c) { 
                return c.type && c.type.toUpperCase().indexOf(tipo.toUpperCase()) !== -1 && Math.abs((c.param || 0) - param) < tolerancia; 
            });
        }
        
        // ✅ v3.6.4: Banderas sin guion bajo
        var skipOriginFittings = lineObj.fittingInsertedAtOrigin === true;
        var skipDestFittings = lineObj.fittingInsertedAtDestination === true;
        
        // --- REDUCTOR EN ORIGEN ---
        if (fromObj && fromPortId && !skipOriginFittings) {
            var diamPuertoOrigen = getPortDiameter(fromObj, fromPortId);
            var diamLineaOrig = parseFloat(lineObj.diameter || diameter);
            if (diamPuertoOrigen && necesitaReductor(diamPuertoOrigen, diamLineaOrig)) {
                var reducerType = findReducerForDiameters(Math.max(diamPuertoOrigen, diamLineaOrig), Math.min(diamPuertoOrigen, diamLineaOrig), material);
                if (reducerType && !existeComponenteSimilar('REDUCER', 0.0)) {
                    lineObj.components.push({ type: reducerType, tag: 'RED-' + lineObj.tag + '-START-' + Date.now().toString(36), param: 0.0, material: material || 'PPR', spec: effectiveSpec });
                    addedFittings.push(lineObj.components[lineObj.components.length - 1].tag);
                }
            }
        }
        
        // --- REDUCTOR EN DESTINO ---
        if (toObj && toPortId && !skipDestFittings) {
            var diamPuertoDestino = getPortDiameter(toObj, toPortId);
            var diamLinea = parseFloat(lineObj.diameter || diameter);
            if (diamPuertoDestino && necesitaReductor(diamLinea, diamPuertoDestino)) {
                var reducerType2 = findReducerForDiameters(Math.max(diamLinea, diamPuertoDestino), Math.min(diamLinea, diamPuertoDestino), material);
                if (reducerType2 && !existeComponenteSimilar('REDUCER', 1.0)) {
                    lineObj.components.push({ type: reducerType2, tag: 'RED-' + lineObj.tag + '-END-' + Date.now().toString(36), param: 1.0, material: material || 'PPR', spec: effectiveSpec });
                    addedFittings.push(lineObj.components[lineObj.components.length - 1].tag);
                }
            }
        }
        
        // --- CODO EN INICIO ---
        if (fromObj && fromPortId && puntos.length >= 2 && !skipOriginFittings) {
            var dirPuerto = getPortDirection(fromObj, fromPortId);
            var vInicial = { x: puntos[1].x - puntos[0].x, y: puntos[1].y - puntos[0].y, z: puntos[1].z - puntos[0].z };
            var lenInic = Math.hypot(vInicial.x, vInicial.y, vInicial.z) || 1;
            var dotInicio = (dirPuerto.x * vInicial.x + dirPuerto.y * vInicial.y + dirPuerto.z * vInicial.z) / lenInic;
            var angleDegInicio = Math.acos(Math.max(-1, Math.min(1, dotInicio))) * 180 / Math.PI;
            if (angleDegInicio > MIN_ANGLE_FOR_ELBOW && !existeComponenteSimilar('ELBOW', 0.0, 0.05)) {
                var elbowType = findElbowForLine(material, diameter, angleDegInicio);
                if (elbowType) {
                    lineObj.components.push({ type: elbowType, tag: 'ELB-' + lineObj.tag + '-START-' + Date.now().toString(36), param: 0.0, diameter: diameter || 4, material: material || 'PPR', spec: effectiveSpec, angle: angleDegInicio });
                    addedFittings.push(lineObj.components[lineObj.components.length - 1].tag);
                }
            }
        }
        
        // --- CODOS INTERMEDIOS ---
        var totalLen = 0;
        for (var i = 0; i < puntos.length - 1; i++) { totalLen += Math.hypot(puntos[i+1].x - puntos[i].x, puntos[i+1].y - puntos[i].y, puntos[i+1].z - puntos[i].z); }
        for (var i2 = 1; i2 < puntos.length - 1; i2++) {
            var pAnt = puntos[i2 - 1], pAct = puntos[i2], pSig = puntos[i2 + 1];
            var v1 = { x: pAct.x - pAnt.x, y: pAct.y - pAnt.y, z: pAct.z - pAnt.z };
            var v2 = { x: pSig.x - pAct.x, y: pSig.y - pAct.y, z: pSig.z - pAct.z };
            var len1 = Math.hypot(v1.x, v1.y, v1.z) || 1, len2 = Math.hypot(v2.x, v2.y, v2.z) || 1;
            var dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (len1 * len2);
            var angleDegInter = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
            if (angleDegInter > MIN_ANGLE_FOR_ELBOW) {
                var accum = 0;
                for (var j = 0; j < i2; j++) { accum += Math.hypot(puntos[j+1].x - puntos[j].x, puntos[j+1].y - puntos[j].y, puntos[j+1].z - puntos[j].z); }
                var paramValue = totalLen > 0 ? (accum / totalLen) : 0.5;
                if (!existeComponenteSimilar('ELBOW', paramValue)) {
                    var elbowType2 = findElbowForLine(material, diameter, angleDegInter);
                    if (elbowType2) {
                        lineObj.components.push({ type: elbowType2, tag: 'ELB-' + lineObj.tag + '-P' + i2 + '-' + Date.now().toString(36), param: paramValue, diameter: diameter || 4, material: material || 'PPR', spec: effectiveSpec, angle: angleDegInter });
                        addedFittings.push(lineObj.components[lineObj.components.length - 1].tag);
                    }
                }
            }
        }
        
        // --- CODO EN FIN ---
        if (toObj && toPortId && puntos.length >= 2 && !skipDestFittings) {
            var dirPuertoDest = getPortDirection(toObj, toPortId);
            var dirLlegada = { x: puntos[puntos.length - 1].x - puntos[puntos.length - 2].x, y: puntos[puntos.length - 1].y - puntos[puntos.length - 2].y, z: puntos[puntos.length - 1].z - puntos[puntos.length - 2].z };
            var lenLlegada = Math.hypot(dirLlegada.x, dirLlegada.y, dirLlegada.z) || 1;
            var dirLlegadaUnit = { dx: dirLlegada.x / lenLlegada, dy: dirLlegada.y / lenLlegada, dz: dirLlegada.z / lenLlegada };
            var dotCoaxial = dirLlegadaUnit.dx * dirPuertoDest.dx + dirLlegadaUnit.dy * dirPuertoDest.dy + dirLlegadaUnit.dz * dirPuertoDest.dz;
            var esCoaxial = Math.abs(Math.abs(dotCoaxial) - 1) < 0.001;
            if (!esCoaxial) {
                var dirPuertoInv = { x: -dirPuertoDest.x, y: -dirPuertoDest.y, z: -dirPuertoDest.z };
                var dotFin = (dirPuertoInv.x * dirLlegadaUnit.dx + dirPuertoInv.y * dirLlegadaUnit.dy + dirPuertoInv.z * dirLlegadaUnit.dz);
                var angleDegFin = Math.acos(Math.max(-1, Math.min(1, dotFin))) * 180 / Math.PI;
                if (angleDegFin > MIN_ANGLE_FOR_ELBOW && !existeComponenteSimilar('ELBOW', 1.0, 0.05)) {
                    var elbowType3 = findElbowForLine(material, diameter, angleDegFin);
                    if (elbowType3) {
                        lineObj.components.push({ type: elbowType3, tag: 'ELB-' + lineObj.tag + '-END-' + Date.now().toString(36), param: 1.0, diameter: diameter || 4, material: material || 'PPR', spec: effectiveSpec, angle: angleDegFin });
                        addedFittings.push(lineObj.components[lineObj.components.length - 1].tag);
                    }
                }
            }
        }
        
        var delta = lineObj.components.length - inicialCount;
        var msgs = [];
        if (delta > 0) {
            var codosCount = 0, redsCount = 0;
            for (var a = 0; a < addedFittings.length; a++) {
                if (addedFittings[a].indexOf('ELB') !== -1) codosCount++;
                if (addedFittings[a].indexOf('RED') !== -1) redsCount++;
            }
            if (codosCount > 0) msgs.push(codosCount + ' codo(s)');
            if (redsCount > 0) msgs.push(redsCount + ' reductor(es)');
            return { added: addedFittings, message: ' | 🛠️ Inyectado: ' + msgs.join(' + ') };
        }
        return { added: [], message: ' | 📐 Continuidad geométrica OK' };
    }

    // ================================================================
    //  INSERTAR ACCESORIO EN LÍNEA
    // ================================================================

    function insertarAccesorioEnLinea(lineTag, puntoConexion, diametroNuevaLinea, forzarTee, branchOrientation) {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        forzarTee = forzarTee || false;
        var db = _core.getDb();
        var linea = db.lines.find(function(l) { return l.tag === lineTag; });
        if (!linea) { notifyUser('Línea ' + lineTag + ' no encontrada', true); return null; }
        var pts = _core.getLinePoints(linea) || linea._cachedPoints || linea.points3D || linea.points;
        if (!pts || pts.length < 2) { notifyUser('Línea ' + lineTag + ' sin geometría', true); return null; }
        
        var lengths = [], totalLen = 0;
        for (var i = 0; i < pts.length - 1; i++) { var d = distance(pts[i], pts[i+1]); lengths.push(d); totalLen += d; }
        var minDist = Infinity, bestSegIdx = 0, bestT = 0;
        for (var i2 = 0; i2 < lengths.length; i2++) { var proj = projectPointOnSegment(puntoConexion, pts[i2], pts[i2+1]); if (proj.distance < minDist) { minDist = proj.distance; bestSegIdx = i2; bestT = proj.t; } }
        var accumBefore = 0;
        for (var i3 = 0; i3 < bestSegIdx; i3++) accumBefore += lengths[i3];
        var param = totalLen > 0 ? (accumBefore + bestT * lengths[bestSegIdx]) / totalLen : 0.5;
        
        var esInicio = (bestSegIdx === 0 && bestT < 0.1);
        var esFin = (bestSegIdx === lengths.length - 1 && bestT > 0.9);
        var esExtremo = !forzarTee && (esInicio || esFin);
        var diamLinea = linea.diameter || 4;
        var diffDiam = necesitaReductor(diametroNuevaLinea, diamLinea);
        var lineMaterial = linea.material || 'PPR';
        var lineSpec = linea.spec || getExpectedSpecForMaterial(lineMaterial) || 'PPR_PN12_5';
        var tipoAccesorio, descripcion;
        
        if (esExtremo && diffDiam) { tipoAccesorio = 'CONCENTRIC_REDUCER'; descripcion = 'Reductor'; }
        else if (!esExtremo && diffDiam) { tipoAccesorio = 'TEE_REDUCING'; descripcion = 'Tee reductora'; }
        else if (!esExtremo) { tipoAccesorio = 'TEE'; descripcion = 'Tee igual ' + diamLinea + '"'; }
        else { 
            var puertoExtremo = linea.puertos ? linea.puertos.find(function(p) { return esInicio ? p.id === '0' : p.id === '1'; }) : null; 
            if (puertoExtremo) { puertoExtremo.status = 'connected'; } 
            _core.updateLine(lineTag, { puertos: linea.puertos }); 
            return puertoExtremo ? puertoExtremo.id : (esInicio ? '0' : '1'); 
        }
        
        var compEnCatalogo = findComponentInCatalog(tipoAccesorio, lineMaterial, []);
        if (!compEnCatalogo) { notifyUser('Componente no encontrado: ' + tipoAccesorio, true); return null; }
        if (!linea.components) linea.components = [];
        
        var existeDuplicado = linea.components.some(function(c) { return c.type === compEnCatalogo && Math.abs((c.param || 0) - param) < 0.02; });
        if (existeDuplicado) { 
            var puertoExistente = linea.puertos ? linea.puertos.find(function(p) { return p.id.indexOf(compEnCatalogo) !== -1; }) : null; 
            return puertoExistente ? puertoExistente.id : null; 
        }
        
        if (!branchOrientation) { branchOrientation = { dx: 0, dy: 1, dz: 0 }; }
        var bLen = Math.hypot(branchOrientation.dx, branchOrientation.dy, branchOrientation.dz);
        if (bLen > 0) { branchOrientation.dx /= bLen; branchOrientation.dy /= bLen; branchOrientation.dz /= bLen; }
        else { branchOrientation = { dx: 0, dy: 1, dz: 0 }; }
        
        var comp = { type: compEnCatalogo, tag: compEnCatalogo + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4), param: param, diameter: diamLinea, material: lineMaterial, spec: lineSpec, branchOrientation: branchOrientation };
        linea.components.push(comp);
        
        // ✅ v3.6.4: Fallback de generación de puertos
        var puertosGenerados = false;
        if (typeof _catalog !== 'undefined' && _catalog.getComponent) {
            var compDef = _catalog.getComponent(compEnCatalogo);
            if (compDef && typeof compDef.generarPuertos === 'function') {
                var nuevosPuertos = compDef.generarPuertos(linea, param, diamLinea, branchOrientation);
                if (nuevosPuertos && nuevosPuertos.length > 0) {
                    if (!linea.puertos) linea.puertos = [];
                    nuevosPuertos.forEach(function(p, idx) { p.id = comp.tag + '_' + idx; linea.puertos.push(p); });
                    puertosGenerados = true;
                }
            }
        }
        
        if (!puertosGenerados) {
            if (!linea.puertos) linea.puertos = [];
            if (tipoAccesorio === 'TEE' || tipoAccesorio === 'TEE_REDUCING' || tipoAccesorio === 'TEE_EQUAL') {
                linea.puertos.push({ id: comp.tag + '_0', relX: 0, relY: 0, relZ: 0, orientacion: { dx: 1, dy: 0, dz: 0 }, diametro: diamLinea, status: 'connected', flow: 'in' });
                linea.puertos.push({ id: comp.tag + '_1', relX: 0, relY: 0, relZ: 0, orientacion: { dx: -1, dy: 0, dz: 0 }, diametro: diamLinea, status: 'connected', flow: 'out' });
                linea.puertos.push({ id: comp.tag + '_2', relX: 0, relY: 0, relZ: 0, orientacion: branchOrientation || { dx: 0, dy: 1, dz: 0 }, diametro: diamLinea, status: 'open', flow: 'bi' });
            } else if (tipoAccesorio === 'CONCENTRIC_REDUCER' || tipoAccesorio === 'ECCENTRIC_REDUCER') {
                linea.puertos.push({ id: comp.tag + '_0', relX: 0, relY: 0, relZ: 0, diametro: diamLinea, status: 'connected' });
                linea.puertos.push({ id: comp.tag + '_1', relX: 0, relY: 0, relZ: 0, diametro: diametroNuevaLinea, status: 'open' });
            }
        }
        
        _core.updateLine(lineTag, { components: linea.components, puertos: linea.puertos });
        notifyUser('✅ ' + descripcion + ' (' + compEnCatalogo + ') insertado en ' + lineTag + ' @' + param.toFixed(3), false);
        
        var lineaActualizada = db.lines.find(function(l) { return l.tag === lineTag; });
        if (lineaActualizada && lineaActualizada.puertos && lineaActualizada.puertos.length > 0) { 
            var nuevoPuerto = lineaActualizada.puertos.find(function(p2) { return p2.id.indexOf(comp.tag) !== -1; }); 
            if (nuevoPuerto) return nuevoPuerto.id; 
            return lineaActualizada.puertos[lineaActualizada.puertos.length - 1].id; 
        }
        return null;
    }

    // ================================================================
    //  PROCESAR INTERSECCIONES DE LÍNEA
    // ================================================================

    function procesarInterseccionesDeLinea(nuevaLinea) {
        ensureInitialized();
        if (!_core) return;
        var db = _core.getDb();
        var lineasExistentes = db.lines.filter(function(l) { return l.tag !== nuevaLinea.tag; });
        if (lineasExistentes.length === 0) return;
        var ptsNueva = _core.getLinePoints(nuevaLinea) || nuevaLinea._cachedPoints || nuevaLinea.points3D || nuevaLinea.points;
        if (!ptsNueva || ptsNueva.length < 2) return;
        var tolerancia = 100;
        for (var i = 0; i < lineasExistentes.length; i++) {
            var lineaExistente = lineasExistentes[i];
            var ptsExistente = _core.getLinePoints(lineaExistente) || lineaExistente._cachedPoints || lineaExistente.points3D || lineaExistente.points;
            if (!ptsExistente || ptsExistente.length < 2) continue;
            for (var j = 0; j < ptsNueva.length - 1; j++) {
                var a1 = ptsNueva[j], a2 = ptsNueva[j+1];
                for (var k = 0; k < ptsExistente.length - 1; k++) {
                    var b1 = ptsExistente[k], b2 = ptsExistente[k+1];
                    var midNuevo = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2, z: (a1.z + a2.z) / 2 };
                    var proj = projectPointOnSegment(midNuevo, b1, b2);
                    if (proj.distance < tolerancia) {
                        var puertoId = insertarAccesorioEnLinea(lineaExistente.tag, proj.point, nuevaLinea.diameter || 4, true);
                        if (puertoId) {
                            var updatedLine = JSON.parse(JSON.stringify(nuevaLinea));
                            updatedLine.destination = { objType: 'line', equipTag: lineaExistente.tag, portId: puertoId };
                            var ptsActualizados = ptsNueva.slice(); ptsActualizados[ptsActualizados.length - 1] = proj.point;
                            updatedLine._cachedPoints = ptsActualizados;
                            _core.updateLine(updatedLine.tag, updatedLine);
                            if (lineaExistente.puertos) { var puerto = lineaExistente.puertos.find(function(p) { return p.id === puertoId; }); if (puerto) { puerto.connectedLine = updatedLine.tag; puerto.status = 'connected'; } }
                        }
                        return;
                    }
                }
            }
        }
    }

    // ================================================================
    //  GENERAR TAG ÚNICO
    // ================================================================

    function generateUniqueLineTag() {
        if (!_core) return 'L-' + Date.now();
        var db = _core.getDb();
        var existingTags = new Set();
        for (var i = 0; i < db.lines.length; i++) { existingTags.add(db.lines[i].tag); }
        var counter = db.lines.length + 1;
        var tag;
        do { tag = 'L-' + counter; counter++; } while (existingTags.has(tag) && counter < 10000);
        return tag;
    }

    // ================================================================
    //  RUTEO ENTRE PUERTOS (v3.6.4)
    // ================================================================

    function routeBetweenPorts(fromEquipTag, fromPortId, toEquipTag, toPortId, diameter, material, spec, options) {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        options = options || {};
        diameter = diameter || 3; material = material || 'PPR'; spec = spec || 'PPR_PN12_5';
        if (material.toUpperCase().indexOf('PPR') !== -1) spec = 'PPR_PN12_5';
        
        var db = _core.getDb();
        var fromObj = _core.findObjectByTag(fromEquipTag) || db.equipos.find(function(e) { return e.tag === fromEquipTag; }) || db.lines.find(function(l) { return l.tag === fromEquipTag; });
        var toObj = _core.findObjectByTag(toEquipTag) || db.equipos.find(function(e) { return e.tag === toEquipTag; }) || db.lines.find(function(l) { return l.tag === toEquipTag; });
        if (!fromObj) { notifyUser('Origen ' + fromEquipTag + ' no encontrado', true); return null; }
        if (!toObj) { notifyUser('Destino ' + toEquipTag + ' no encontrado', true); return null; }
        
        var startPos = getPortPosition(fromObj, fromPortId);
        if (!startPos) { notifyUser('Puerto origen ' + fromPortId + ' no encontrado', true); return null; }
        
        var endPos, nuevoPuertoId = toPortId;
        var ptsTo = _core.getLinePoints(toObj) || toObj._cachedPoints || toObj.points3D || toObj.points;
        var isToLine = ptsTo && ptsTo.length >= 2;
        var isFromLine = _core.getLinePoints(fromObj) && _core.getLinePoints(fromObj).length >= 2;
        var fittingInserted = false;
        
        var originBranchDirection = null;
        if (isFromLine && isParametricPortId(fromPortId)) {
            originBranchDirection = options.branchOrientation || (endPos ? calculateBranchDirection(startPos, endPos) : { dx: 0, dy: 1, dz: 0 });
        }
        
        var destBranchDirection = null;
        if (isToLine) {
            if (!toPortId || toPortId === '') {
                var minDist = Infinity, bestPoint = ptsTo[0];
                for (var i = 0; i < ptsTo.length - 1; i++) { var proj = projectPointOnSegment(startPos, ptsTo[i], ptsTo[i+1]); if (proj.distance < minDist) { minDist = proj.distance; bestPoint = proj.point; } }
                endPos = bestPoint;
                destBranchDirection = calculateBranchDirection(endPos, startPos);
            } else if (isParametricPortId(toPortId)) {
                endPos = getPointAtParam(ptsTo, parseFloat(toPortId));
                destBranchDirection = calculateBranchDirection(endPos, startPos);
            } else if (toPortId === '0' || toPortId === '1') {
                endPos = toPortId === '0' ? ptsTo[0] : ptsTo[ptsTo.length - 1];
            } else {
                endPos = getPortPosition(toObj, toPortId);
            }
        } else {
            endPos = getPortPosition(toObj, toPortId);
        }
        if (!endPos) { notifyUser('Puerto destino no encontrado', true); return null; }
        
        if (isFromLine && isParametricPortId(fromPortId)) {
            var puertoInsertado = insertarAccesorioEnLinea(fromEquipTag, startPos, diameter, true, originBranchDirection);
            if (!puertoInsertado) return null;
            fromPortId = puertoInsertado;
            fromObj = _core.findObjectByTag(fromEquipTag) || db.lines.find(function(l) { return l.tag === fromEquipTag; });
        }
        
        if (isToLine && (isParametricPortId(toPortId) || !toPortId || toPortId === '')) {
            var puertoInsertado2 = insertarAccesorioEnLinea(toEquipTag, endPos, diameter, true, destBranchDirection);
            if (!puertoInsertado2) return null;
            nuevoPuertoId = puertoInsertado2;
            toObj = _core.findObjectByTag(toEquipTag) || db.lines.find(function(l) { return l.tag === toEquipTag; });
            fittingInserted = true;
        }
        
        var startDirRaw = getPortDirection(fromObj, fromPortId);
        var startDir = normalizeVector(startDirRaw);
        var orthoResultStart = calculateOrthogonalIntersection(startPos, startDir, endPos);
        var waypoints = [startPos];
        var extStart = addPoints(startPos, scalePoint(startDir, EXTENSION_DISTANCE));
        if (orthoResultStart.isOrthogonal) { waypoints.push(extStart); waypoints.push(orthoResultStart.intersection); }
        else { waypoints.push(extStart); waypoints.push(orthoResultStart.intersection); waypoints.push(endPos); }
        var uniqueWaypoints = waypoints.filter(function(pt, i, arr) { return i === 0 || distance(pt, arr[i-1]) > 1; });
        if (uniqueWaypoints.length < 2) uniqueWaypoints = [startPos, endPos];
        
        var tag = generateUniqueLineTag();
        var isFromEquip = fromObj.posX !== undefined || (fromObj.pos && fromObj.pos.x !== undefined);
        var isToEquip = toObj.posX !== undefined || (toObj.pos && toObj.pos.x !== undefined);
        
        // ✅ v3.6.4: Banderas sin guion bajo
        var nuevaLinea = {
            tag: tag, diameter: diameter, material: material, spec: spec,
            origin: { objType: isFromEquip ? 'equipment' : 'line', equipTag: fromEquipTag, portId: fromPortId },
            destination: { objType: isToEquip ? 'equipment' : 'line', equipTag: toEquipTag, portId: nuevoPuertoId },
            waypoints: uniqueWaypoints.slice(1, -1), _cachedPoints: uniqueWaypoints.slice(),
            points3D: uniqueWaypoints.slice(), points: uniqueWaypoints.slice(), components: [],
            fittingInsertedAtOrigin: isFromLine && isParametricPortId(fromPortId),
            fittingInsertedAtDestination: fittingInserted || isToEquip
        };
        
        _core.addLine(nuevaLinea);
        var lineaRegistrada = db.lines.find(function(l) { return l.tag === tag; }) || nuevaLinea;
        var fittingInfo = ensureFittings(lineaRegistrada, fromObj, fromPortId, toObj, nuevoPuertoId, diameter, material, spec);
        if (_core.updateLine) { _core.updateLine(tag, lineaRegistrada); }
        if (fromObj.puertos) { var pFrom = fromObj.puertos.find(function(p) { return p.id === fromPortId; }); if (pFrom) pFrom.connectedLine = tag; }
        if (toObj.puertos) { var pTo = toObj.puertos.find(function(p) { return p.id === nuevoPuertoId; }); if (pTo) pTo.connectedLine = tag; }
        notifyUser('✅ Ruta: ' + tag + ' (' + fromEquipTag + '.' + fromPortId + ' → ' + toEquipTag + '.' + nuevoPuertoId + ') | ' + material + ' ' + diameter + '" ' + spec + (fittingInfo.message || ''), false);
        if (_renderUI) _renderUI();
        return lineaRegistrada;
    }

    // ================================================================
    //  RUTEO CON WAYPOINTS (v3.6.4)
    // ================================================================

    function routeWithWaypoints(fromEquipTag, fromPortId, toEquipTag, toPortId, waypoints, diameter, material, spec, options) {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        
        options = options || {};
        diameter = diameter || 3; material = material || 'PPR'; spec = spec || 'PPR_PN12_5';
        if (material.toUpperCase().indexOf('PPR') !== -1) spec = 'PPR_PN12_5';
        
        var db = _core.getDb();
        var fromObj = _core.findObjectByTag(fromEquipTag) || db.equipos.find(function(e) { return e.tag === fromEquipTag; }) || db.lines.find(function(l) { return l.tag === fromEquipTag; });
        var toObj = _core.findObjectByTag(toEquipTag) || db.equipos.find(function(e) { return e.tag === toEquipTag; }) || db.lines.find(function(l) { return l.tag === toEquipTag; });
        if (!fromObj) { notifyUser('Origen ' + fromEquipTag + ' no encontrado', true); return null; }
        if (!toObj) { notifyUser('Destino ' + toEquipTag + ' no encontrado', true); return null; }

        var startPos = getPortPosition(fromObj, fromPortId);
        if (!startPos) { notifyUser('Puerto origen ' + fromPortId + ' no encontrado', true); return null; }
        
        var endPos, nuevoPuertoId = toPortId;
        var ptsTo = _core.getLinePoints(toObj) || toObj._cachedPoints || toObj.points3D || toObj.points;
        var isToLine = ptsTo && ptsTo.length >= 2;
        var isFromLine = _core.getLinePoints(fromObj) && _core.getLinePoints(fromObj).length >= 2;
        var fittingInserted = false;
        
        var originBranchDirection = null;
        if (isFromLine && isParametricPortId(fromPortId)) {
            originBranchDirection = options.branchOrientation || calculateBranchDirection(startPos, endPos, waypoints);
        }
        
        var destBranchDirection = null;
        if (isToLine) {
            if (!toPortId || toPortId === '') {
                var minDist = Infinity, bestPoint = ptsTo[0];
                for (var i = 0; i < ptsTo.length - 1; i++) { var proj = projectPointOnSegment(startPos, ptsTo[i], ptsTo[i+1]); if (proj.distance < minDist) { minDist = proj.distance; bestPoint = proj.point; } }
                endPos = bestPoint;
                destBranchDirection = calculateBranchDirection(endPos, startPos);
            } else if (isParametricPortId(toPortId)) {
                endPos = getPointAtParam(ptsTo, parseFloat(toPortId));
                destBranchDirection = calculateBranchDirection(endPos, startPos);
            } else if (toPortId === '0') { endPos = ptsTo[0]; }
            else if (toPortId === '1') { endPos = ptsTo[ptsTo.length - 1]; }
            else { endPos = getPortPosition(toObj, toPortId); }
        } else { endPos = getPortPosition(toObj, toPortId); }
        if (!endPos) { notifyUser('Puerto destino no encontrado', true); return null; }
        
        if (isFromLine && isParametricPortId(fromPortId)) {
            var puertoInsertado = insertarAccesorioEnLinea(fromEquipTag, startPos, diameter, true, originBranchDirection);
            if (!puertoInsertado) return null;
            fromPortId = puertoInsertado;
            fromObj = _core.findObjectByTag(fromEquipTag) || db.lines.find(function(l) { return l.tag === fromEquipTag; });
        }
        
        if (isToLine && (isParametricPortId(toPortId) || !toPortId || toPortId === '')) {
            var puertoInsertado3 = insertarAccesorioEnLinea(toEquipTag, endPos, diameter, true, destBranchDirection);
            if (!puertoInsertado3) return null;
            nuevoPuertoId = puertoInsertado3;
            toObj = _core.findObjectByTag(toEquipTag) || db.lines.find(function(l) { return l.tag === toEquipTag; });
            fittingInserted = true;
        }
        
        var allPoints = [startPos];
        if (waypoints && Array.isArray(waypoints)) { for (var w = 0; w < waypoints.length; w++) { allPoints.push({ x: waypoints[w].x, y: waypoints[w].y, z: waypoints[w].z }); } }
        allPoints.push({ x: endPos.x, y: endPos.y, z: endPos.z });
        
        var cleanPoints = [allPoints[0]];
        for (var i2 = 1; i2 < allPoints.length; i2++) {
            if (distance(allPoints[i2], cleanPoints[cleanPoints.length - 1]) > 10) {
                cleanPoints.push({ x: allPoints[i2].x, y: allPoints[i2].y, z: allPoints[i2].z });
            }
        }
        if (cleanPoints.length < 2) { notifyUser('Se requieren al menos 2 puntos distintos', true); return null; }
        
        var tag = generateUniqueLineTag();
        var isFromEquip = fromObj.posX !== undefined || (fromObj.pos && fromObj.pos.x !== undefined);
        var isToEquip = toObj.posX !== undefined || (toObj.pos && toObj.pos.x !== undefined);
        
        // ✅ v3.6.4: Banderas sin guion bajo
        var nuevaLinea = {
            tag: tag, diameter: diameter, material: material, spec: spec,
            origin: { objType: isFromEquip ? 'equipment' : 'line', equipTag: fromEquipTag, portId: fromPortId },
            destination: { objType: isToLine ? 'line' : 'equipment', equipTag: toEquipTag, portId: nuevoPuertoId },
            waypoints: cleanPoints.slice(1, -1), _cachedPoints: cleanPoints.slice(),
            points3D: cleanPoints.slice(), points: cleanPoints.slice(), components: [],
            fittingInsertedAtOrigin: isFromLine && isParametricPortId(fromPortId),
            fittingInsertedAtDestination: fittingInserted || isToEquip
        };
        
        _core.addLine(nuevaLinea);
        var lineaRegistrada = db.lines.find(function(l) { return l.tag === tag; }) || nuevaLinea;
        var fittingInfo = ensureFittings(lineaRegistrada, fromObj, fromPortId, toObj, nuevoPuertoId, diameter, material, spec);
        if (_core.updateLine) { _core.updateLine(tag, lineaRegistrada); }
        if (fromObj.puertos) { var pFrom = fromObj.puertos.find(function(p) { return p.id === fromPortId; }); if (pFrom) pFrom.connectedLine = tag; }
        if (toObj.puertos) { var pTo = toObj.puertos.find(function(p) { return p.id === nuevoPuertoId; }); if (pTo) pTo.connectedLine = tag; }
        
        var codosInyectados = 0;
        if (lineaRegistrada.components) { for (var c = 0; c < lineaRegistrada.components.length; c++) { if (lineaRegistrada.components[c].type && lineaRegistrada.components[c].type.toUpperCase().indexOf('ELBOW') !== -1) codosInyectados++; } }
        notifyUser('✅ Ruta: ' + tag + ' (' + fromEquipTag + '.' + fromPortId + ' → ' + cleanPoints.length + ' pts → ' + toEquipTag + '.' + nuevoPuertoId + ') | ' + material + ' ' + diameter + '" ' + spec + (fittingInfo.message || '') + (codosInyectados > 0 ? ' | 🔧 ' + codosInyectados + ' codo(s)' : ''), false);
        if (_renderUI) _renderUI();
        return lineaRegistrada;
    }

    // ================================================================
    //  HANDLER DE SNAP / COMANDOS DIRECTOS / INIT / API
    // ================================================================

    function handleSnapClick(snapData) {
        if (!snapData) return;
        ensureInitialized();
        _core.setSelected({ type: 'PUERTO', obj: snapData.port, parent: snapData.item });
        notifyUser('Puerto seleccionado: ' + snapData.item.tag + ' - ' + snapData.port.id);
    }

    function executeCommand(cmdLine) {
        ensureInitialized();
        var parts = cmdLine.trim().split(/\s+/);
        var action = parts[0] ? parts[0].toLowerCase() : '';
        var args = parts.slice(1);
        switch(action) {
            case 'conectar': if (args.length >= 4) { routeBetweenPorts(args[0], args[1], args[2], args[3]); } else { notifyUser('Formato: conectar [Origen] [Puerto] [Destino] [Puerto]', true); } break;
            case 'split': if (args.length >= 2) { var lineTag = args[0]; var param = parseFloat(args[1]); if (!isNaN(param) && _core.injectAccessory) { _core.injectAccessory(lineTag, param, { tag: 'TEE', generarPuertos: function(line, p, d) { var cat = _catalog || window.SmartFlowCatalog; var comp = cat ? cat.getComponent('TEE_EQUAL') : null; return comp && comp.generarPuertos ? comp.generarPuertos({diameter: d}) : []; } }); } } else { notifyUser('Formato: split [Línea] [Posición 0-1]', true); } break;
            case 'limpiar': if (_core.nuevoProyecto) _core.nuevoProyecto(); notifyUser('Proyecto limpiado.', false); break;
            default: notifyUser('Comando router no reconocido: ' + action, true);
        }
    }

    function init(coreInstance, catalogInstance, notifyFn, renderFn) {
        _core = coreInstance; _catalog = catalogInstance;
        _notifyUI = notifyFn || _notifyUI; _renderUI = renderFn || _renderUI;
    }

    return {
        init: init, routeBetweenPorts: routeBetweenPorts, routeWithWaypoints: routeWithWaypoints,
        insertarAccesorioEnLinea: insertarAccesorioEnLinea, procesarInterseccionesDeLinea: procesarInterseccionesDeLinea,
        getPortPosition: getPortPosition, getPortDirection: getPortDirection,
        getPortDirectionLocal: getPortDirectionLocal, getPortDiameter: getPortDiameter,
        findComponentInCatalog: findComponentInCatalog, findElbowForLine: findElbowForLine,
        findReducerForDiameters: findReducerForDiameters, calculateOrthogonalIntersection: calculateOrthogonalIntersection,
        calculateBranchDirection: calculateBranchDirection, getFittingLength: getFittingLength,
        ensureFittings: ensureFittings, necesitaReductor: necesitaReductor,
        generateUniqueLineTag: generateUniqueLineTag, handleSnapClick: handleSnapClick,
        executeCommand: executeCommand, getExpectedSpecForMaterial: getExpectedSpecForMaterial,
        getPointAtParam: getPointAtParam, getDirectionAtParam: getDirectionAtParam,
        isParametricPortId: isParametricPortId
    };
})();

if (typeof window !== 'undefined') window.SmartFlowRouter = SmartFlowRouter;
