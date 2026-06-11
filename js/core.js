
// Archivo: js/core.js

const SmartFlowCore = (function() {
    
    let _db = {
        equipos: [],
        lines: [],
        specs: {
            "PPR_PN12_5": {
                mat: "PPR",
                norma: "IRAM 13471",
                presion: "PN 12.5",
                connectionType: "THERMOFUSION",
                fittingNorm: "DIN 16962"
            },
            "A1A": {
                mat: "Acero al Carbono",
                rating: 150,
                sch: "STD",
                connectionType: "BUTT_WELD",
                fittingNorm: "ASME B16.9"
            },
            "A3B": {
                mat: "Acero Inoxidable",
                rating: 300,
                sch: "40S",
                connectionType: "BUTT_WELD",
                fittingNorm: "ASME B16.9"
            },
            "ACERO_SCH80": {
                mat: "Acero al Carbono",
                schedule: "SCH 80",
                connectionType: "BUTT_WELD",
                fittingNorm: "ASME B16.9"
            },
            "HDPE_PN10": {
                mat: "HDPE",
                norma: "ISO 4427",
                presion: "PN 10",
                connectionType: "BUTT_WELD",
                fittingNorm: "ISO 8085"
            },
            "PVC_SCH80": {
                mat: "PVC",
                schedule: "SCH 80",
                connectionType: "SOLVENT_CEMENT",
                fittingNorm: "ASTM D2467"
            }
        }
    };

    let _equiposMap = new Map();
    let _linesMap = new Map();
    let _allObjectsMap = new Map();

    function rebuildIndexes() {
        _equiposMap.clear();
        _linesMap.clear();
        _allObjectsMap.clear();
        if (_db.equipos) _db.equipos.forEach(function(e) {
            _equiposMap.set(e.tag, e);
            _allObjectsMap.set(e.tag, e);
        });
        if (_db.lines) _db.lines.forEach(function(l) {
            _linesMap.set(l.tag, l);
            _allObjectsMap.set(l.tag, l);
        });
    }

    let _datumElevation = 0;
    let _datumNorth = 0;
    let _datumEast = 0;
    let _selectedElement = null;
    let _history = { past: [], future: [], maxSize: 50 };
    let _voiceEnabled = true;
    let _currentElevation = 0;

    const _listeners = {
        modelChanged: [],
        selectionChanged: [],
        notification: []
    };

    function on(eventName, callback) {
        if (_listeners[eventName]) {
            _listeners[eventName].push(callback);
        }
    }

    function off(eventName, callback) {
        if (_listeners[eventName]) {
            _listeners[eventName] = _listeners[eventName].filter(function(cb) { return cb !== callback; });
        }
    }

    function emit(eventName, data) {
        if (_listeners[eventName]) {
            _listeners[eventName].forEach(function(cb) {
                setTimeout(function() {
                    try { cb(data); } catch (e) { console.error('Error en listener ' + eventName + ':', e); }
                }, 0);
            });
        }
    }

    let _notifyUI = function(msg, isErr) {
        console.log(msg);
        emit('notification', { message: msg, isError: isErr });
    };
    let _renderUI = function() {};
    let _onSelectionChanged = function(obj) {};

    const _deepClone = function(obj) {
        try { return structuredClone(obj); }
        catch (e) { return JSON.parse(JSON.stringify(obj)); }
    };

    function getLinePoints(line) {
        if (!line) return null;
        return line.points3D || line._cachedPoints || line.points || null;
    }

    function findObjectByTag(tag) {
        return _allObjectsMap.get(tag) || null;
    }

    function getObjectPosition(obj) {
        if (obj.posX !== undefined) return { x: obj.posX, y: obj.posY, z: obj.posZ };
        const pts = getLinePoints(obj);
        if (pts && pts.length > 0) return pts[0];
        return { x: 0, y: 0, z: 0 };
    }

    function getAbsolutePosition(obj) {
        const pos = getObjectPosition(obj);
        return {
            east: pos.x + _datumEast,
            north: pos.z + _datumNorth,
            elevation: pos.y + _datumElevation
        };
    }

    function checkCompatibility(portA, portB) {
        const alerts = [];
        if (portA.diametro !== portB.diametro) alerts.push("Diferencia de diámetro: " + portA.diametro + "\" vs " + portB.diametro + "\"");
        if (portA.constraints && portA.constraints.spec && portB.constraints && portB.constraints.spec && portA.constraints.spec !== portB.constraints.spec)
            alerts.push("Diferencia de especificación: " + portA.constraints.spec + " vs " + portB.constraints.spec);
        return { isCompatible: alerts.length === 0, alerts: alerts };
    }

    function syncPhysicalData() {
        _db.lines.forEach(function(line) {
            if (line.origin && line.origin.objTag) {
                const sourceObj = findObjectByTag(line.origin.objTag);
                if (sourceObj) {
                    const puerto = sourceObj.puertos ? sourceObj.puertos.find(function(p) { return p.id === line.origin.portId; }) : null;
                    if (puerto) {
                        const posBase = getObjectPosition(sourceObj);
                        const newStart = {
                            x: posBase.x + (puerto.relX || (puerto.relPos ? puerto.relPos.x : 0) || 0),
                            y: posBase.y + (puerto.relY || (puerto.relPos ? puerto.relPos.y : 0) || 0),
                            z: posBase.z + (puerto.relZ || (puerto.relPos ? puerto.relPos.z : 0) || 0)
                        };
                        const pts = getLinePoints(line);
                        if (pts && pts.length > 0) pts[0] = newStart;
                    }
                }
            }
            if (line.destination && line.destination.objTag) {
                const targetObj = findObjectByTag(line.destination.objTag);
                if (targetObj) {
                    const puerto = targetObj.puertos ? targetObj.puertos.find(function(p) { return p.id === line.destination.portId; }) : null;
                    if (puerto) {
                        const posBase = getObjectPosition(targetObj);
                        const newEnd = {
                            x: posBase.x + (puerto.relX || (puerto.relPos ? puerto.relPos.x : 0) || 0),
                            y: posBase.y + (puerto.relY || (puerto.relPos ? puerto.relPos.y : 0) || 0),
                            z: posBase.z + (puerto.relZ || (puerto.relPos ? puerto.relPos.z : 0) || 0)
                        };
                        const pts = getLinePoints(line);
                        if (pts && pts.length > 0) pts[pts.length - 1] = newEnd;
                    }
                }
            }
        });
        emit('modelChanged', { type: 'sync' });
        _renderUI();
    }

    function _findSegmentAtPoint(line, clickPoint, tolerance) {
        tolerance = tolerance || 500;
        const pts = getLinePoints(line);
        if (!pts || pts.length < 2) return -1;
        let minDist = Infinity, bestIndex = -1;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i+1];
            const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
            const ap = { x: clickPoint.x - a.x, y: clickPoint.y - a.y, z: clickPoint.z - a.z };
            const len2 = ab.x*ab.x + ab.y*ab.y + ab.z*ab.z;
            if (len2 === 0) continue;
            const t = Math.max(0, Math.min(1, (ap.x*ab.x + ap.y*ab.y + ap.z*ab.z) / len2));
            const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
            const dist = Math.hypot(clickPoint.x - proj.x, clickPoint.y - proj.y, clickPoint.z - proj.z);
            if (dist < minDist && dist < tolerance) { minDist = dist; bestIndex = i; }
        }
        return bestIndex;
    }

    function pointInBox(p, box) { 
        return p.x >= box.xMin && p.x <= box.xMax && p.y >= box.yMin && p.y <= box.yMax && p.z >= box.zMin && p.z <= box.zMax; 
    }
    
    function segmentIntersectsBox(p1, p2, box) {
        if (pointInBox(p1, box) || pointInBox(p2, box)) return true;
        const segMin = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), z: Math.min(p1.z, p2.z) };
        const segMax = { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y), z: Math.max(p1.z, p2.z) };
        return !(segMax.x < box.xMin || segMin.x > box.xMax || segMax.y < box.yMin || segMin.y > box.yMax || segMax.z < box.zMin || segMin.z > box.zMax);
    }

    function _splitLineSegment(lineTag, param) {
        const line = _linesMap.get(lineTag);
        if (!line) return null;
        const pts = getLinePoints(line);
        if (!pts || pts.length < 2) return null;
        let totalLen = 0, lengths = [];
        for (let i = 0; i < pts.length-1; i++) { 
            const d = Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z); 
            lengths.push(d); 
            totalLen += d; 
        }
        const targetLen = totalLen*param; 
        let accum = 0, segIdx = 0, t = 0;
        for (let i = 0; i < lengths.length; i++) { 
            if (accum+lengths[i] >= targetLen || i === lengths.length-1) { 
                segIdx = i; 
                t = (targetLen-accum)/(lengths[i]||1); 
                break; 
            } 
            accum += lengths[i]; 
        }
        const pA = pts[segIdx], pB = pts[segIdx+1];
        const punto = { x: pA.x+(pB.x-pA.x)*t, y: pA.y+(pB.y-pA.y)*t, z: pA.z+(pB.z-pA.z)*t };
        return { punto: punto, segIdx: segIdx, t: t };
    }

    function _getPerpendicular(dir) {
        let perp = { dx: -dir.dy, dy: dir.dx, dz: 0 };
        const len = Math.hypot(perp.dx, perp.dy, perp.dz);
        if (len < 0.1) perp = { dx: 1, dy: 0, dz: 0 };
        else { perp.dx /= len; perp.dy /= len; perp.dz /= len; }
        return perp;
    }

    function _countAutoElbows(points) {
        if (!points || points.length < 3) return 0;
        let count = 0;
        for (let i = 1; i < points.length - 1; i++) {
            const v1 = { x: points[i].x - points[i-1].x, y: points[i].y - points[i-1].y, z: points[i].z - points[i-1].z };
            const v2 = { x: points[i+1].x - points[i].x, y: points[i+1].y - points[i].y, z: points[i+1].z - points[i].z };
            const len1 = Math.hypot(v1.x, v1.y, v1.z) || 1;
            const len2 = Math.hypot(v2.x, v2.y, v2.z) || 1;
            const dot = (v1.x*v2.x + v1.y*v2.y + v1.z*v2.z) / (len1 * len2);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
            if (angle > 30) count++;
        }
        return count;
    }

    function auditCollisions() {
        const collisions = [];
        _db.lines.forEach(function(line) {
            const pts = getLinePoints(line); 
            if (!pts || pts.length < 2) return;
            _db.equipos.forEach(function(eq) {
                if ((line.origin && line.origin.objTag === eq.tag) || (line.destination && line.destination.objTag === eq.tag)) return;
                let box;
                if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
                    const r = eq.diametro/2, hh = eq.altura/2;
                    box = { xMin: eq.posX-r, xMax: eq.posX+r, yMin: eq.posY-hh, yMax: eq.posY+hh, zMin: eq.posZ-r, zMax: eq.posZ+r };
                } else if (eq.tipo === 'tanque_h') {
                    const hl = eq.largo/2, hd = eq.diametro/2;
                    box = { xMin: eq.posX-hl, xMax: eq.posX+hl, yMin: eq.posY-hd, yMax: eq.posY+hd, zMin: eq.posZ-hd, zMax: eq.posZ+hd };
                } else {
                    const hl = (eq.largo||1000)/2, hw = (eq.ancho||eq.diametro||1000)/2, hh = (eq.altura||1000)/2;
                    box = { xMin: eq.posX-hl, xMax: eq.posX+hl, yMin: eq.posY-hh, yMax: eq.posY+hh, zMin: eq.posZ-hw, zMax: eq.posZ+hw };
                }
                for (let i = 0; i < pts.length-1; i++) {
                    if (segmentIntersectsBox(pts[i], pts[i+1], box)) { 
                        collisions.push({ line1: line.tag, equipment: eq.tag, type: 'LINE_EQUIPMENT' }); 
                        break; 
                    }
                }
            });
        });
        for (let i = 0; i < _db.lines.length; i++) {
            const lineA = _db.lines[i], ptsA = getLinePoints(lineA); 
            if (!ptsA || ptsA.length < 2) continue;
            for (let j = i+1; j < _db.lines.length; j++) {
                const lineB = _db.lines[j], ptsB = getLinePoints(lineB); 
                if (!ptsB || ptsB.length < 2) continue;
                const share = (lineA.origin && lineB.origin && lineA.origin.objTag === lineB.origin.objTag) || 
                              (lineA.origin && lineB.destination && lineA.origin.objTag === lineB.destination.objTag) || 
                              (lineA.destination && lineB.origin && lineA.destination.objTag === lineB.origin.objTag) || 
                              (lineA.destination && lineB.destination && lineA.destination.objTag === lineB.destination.objTag);
                if (share) continue;
                let col = false;
                for (let a = 0; a < ptsA.length-1 && !col; a++) {
                    for (let b = 0; b < ptsB.length-1 && !col; b++) {
                        const sA1 = ptsA[a], sA2 = ptsA[a+1], sB1 = ptsB[b], sB2 = ptsB[b+1];
                        const boxA = { xMin: Math.min(sA1.x,sA2.x), xMax: Math.max(sA1.x,sA2.x), yMin: Math.min(sA1.y,sA2.y), yMax: Math.max(sA1.y,sA2.y), zMin: Math.min(sA1.z,sA2.z), zMax: Math.max(sA1.z,sA2.z) };
                        const boxB = { xMin: Math.min(sB1.x,sB2.x), xMax: Math.max(sB1.x,sB2.x), yMin: Math.min(sB1.y,sB2.y), yMax: Math.max(sB1.y,sB2.y), zMin: Math.min(sB1.z,sB2.z), zMax: Math.max(sB1.z,sB2.z) };
                        if (!(boxA.xMax < boxB.xMin || boxA.xMin > boxB.xMax || boxA.yMax < boxB.yMin || boxA.yMin > boxB.yMax || boxA.zMax < boxB.zMin || boxA.zMin > boxB.zMax)) { 
                            collisions.push({ line1: lineA.tag, line2: lineB.tag, type: 'LINE_LINE' }); 
                            col = true; 
                        }
                    }
                }
            }
        }
        return collisions;
    }

    function auditJointSpacing(minDistance) {
        minDistance = minDistance || 50;
        const issues = [];
        _db.lines.forEach(function(line) {
            const pts = getLinePoints(line);
            if (!pts || pts.length < 2) return;
            const joints = [];
            if (line.components) {
                line.components.forEach(function(comp) {
                    if (comp.param !== undefined && comp.param >= 0 && comp.param <= 1) {
                        joints.push(comp.param);
                    }
                });
            }
            if (line.origin) joints.push(0);
            if (line.destination) joints.push(1);
            joints.sort(function(a,b) { return a - b; });
            for (let i = 1; i < joints.length; i++) {
                const prev = joints[i-1], curr = joints[i];
                let totalLen = 0;
                for (let k = 0; k < pts.length-1; k++) totalLen += Math.hypot(pts[k+1].x-pts[k].x, pts[k+1].y-pts[k].y, pts[k+1].z-pts[k].z);
                const dist = totalLen * (curr - prev);
                if (dist < minDistance) {
                    issues.push({ line: line.tag, joint1: prev.toFixed(2), joint2: curr.toFixed(2), distance: dist.toFixed(1) });
                }
            }
        });
        return issues;
    }

    let _auditDebounceTimer = null;
    let _lastAuditResults = null;

    function runAllAudits(silent) {
        silent = silent || false;
        const collisions = auditCollisions();
        const jointIssues = auditJointSpacing(50);
        _lastAuditResults = { collisions: collisions, jointIssues: jointIssues, timestamp: Date.now() };
        
        let report = "--- REPORTE DE AUDITORÍA DE INGENIERÍA ---\n";
        let errors = 0, warnings = 0;
        _db.lines.forEach(function(line) {
            const diamLinea = line.diameter;
            if (line.origin && line.origin.objTag) {
                const obj = findObjectByTag(line.origin.objTag);
                const nz = obj && obj.puertos ? obj.puertos.find(function(p) { return p.id === line.origin.portId; }) : null;
                if (nz && nz.diametro !== diamLinea) {
                    errors++;
                    report += "⚠️ ERROR [" + line.tag + "]: Diámetro línea (" + diamLinea + "\") no coincide con puerto " + nz.id + " (" + nz.diametro + "\")\n";
                }
            }
            if (line.destination && line.destination.objTag) {
                const obj = findObjectByTag(line.destination.objTag);
                const nz = obj && obj.puertos ? obj.puertos.find(function(p) { return p.id === line.destination.portId; }) : null;
                if (nz && nz.diametro !== diamLinea) {
                    errors++;
                    report += "⚠️ ERROR [" + line.tag + "]: Diámetro línea (" + diamLinea + "\") no coincide con puerto " + nz.id + " (" + nz.diametro + "\")\n";
                }
            }
            if (!getLinePoints(line) || getLinePoints(line).length < 2) {
                errors++;
                report += "⚠️ ERROR [" + line.tag + "]: Línea sin geometría definida.\n";
            }
        });
        collisions.forEach(function(c) {
            if (c.type === 'LINE_EQUIPMENT') report += "⚠️ COLISIÓN: Línea " + c.line1 + " interfiere con equipo " + c.equipment + "\n";
            else report += "⚠️ COLISIÓN: Línea " + c.line1 + " interfiere con línea " + c.line2 + "\n";
            warnings++;
        });
        jointIssues.forEach(function(j) {
            report += "⚠️ JUNTAS CERCANAS [" + j.line + "]: " + j.joint1 + " y " + j.joint2 + " a " + j.distance + "mm (mínimo 50mm)\n";
            warnings++;
        });
        if (errors === 0 && warnings === 0) report += "✅ Modelo íntegro. Sin discrepancias de diámetro, colisiones o juntas cercanas.";
        else report += "Se encontraron " + errors + " errores y " + warnings + " advertencias.";
        
        if (!silent) _notifyUI(report, errors > 0);
        return { collisions: collisions, jointIssues: jointIssues, report: report };
    }

    function scheduleAudit() {
        if (_auditDebounceTimer) clearTimeout(_auditDebounceTimer);
        _auditDebounceTimer = setTimeout(function() {
            runAllAudits(true);
            emit('modelChanged', { type: 'audit' });
        }, 500);
    }

    function getSpoolReport(lineTag) {
        const line = _linesMap.get(lineTag);
        if (!line) return null;
        const pts = getLinePoints(line);
        if (!pts || pts.length < 2) return null;
        let totalLen = 0;
        for (let i = 0; i < pts.length-1; i++) totalLen += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
        const manualElbows = (line.components && line.components.filter(function(c) { return c.type && c.type.includes('ELBOW'); }).length) || 0;
        const autoElbows = _countAutoElbows(pts);
        const codos = manualElbows + autoElbows;
        const tees = (line.components && line.components.filter(function(c) { return c.type && c.type.includes('TEE'); }).length) || 0;
        const reducers = (line.components && line.components.filter(function(c) { return c.type && c.type.includes('REDUCER'); }).length) || 0;
        const flanges = (line.components && line.components.filter(function(c) { return c.type && c.type.includes('FLANGE'); }).length) || 0;
        const valves = (line.components && line.components.filter(function(c) { return c.type && c.type.includes('VALVE'); }).length) || 0;
        const otros = (line.components ? line.components.length : 0) - manualElbows - tees - reducers - flanges - valves;
        const connectionType = (_db.specs[line.spec] && _db.specs[line.spec].connectionType) || 'BUTT_WELD';
        const fittingNorm = (_db.specs[line.spec] && _db.specs[line.spec].fittingNorm) || 'ASME B16.9';
        const bomItems = [];
        let itemNum = 1;
        bomItems.push({ item: itemNum++, qty: (totalLen/1000).toFixed(2), unit: "m", desc: "Tubería " + (line.material||'N/D') + " " + (line.diameter||'?') + "\" " + (line.spec||'STD') });
        if (codos > 0) bomItems.push({ item: itemNum++, qty: codos, unit: "und", desc: "Codo 90° " + (line.material||'N/D') + " " + connectionType });
        if (tees > 0) bomItems.push({ item: itemNum++, qty: tees, unit: "und", desc: "Tee " + (line.material||'N/D') + " " + connectionType });
        if (reducers > 0) bomItems.push({ item: itemNum++, qty: reducers, unit: "und", desc: "Reductor " + (line.material||'N/D') + " " + connectionType });
        if (flanges > 0) bomItems.push({ item: itemNum++, qty: flanges, unit: "und", desc: "Brida " + (line.material||'N/D') });
        if (valves > 0) bomItems.push({ item: itemNum++, qty: valves, unit: "und", desc: "Válvula " + (line.material||'N/D') });
        if (otros > 0) bomItems.push({ item: itemNum++, qty: otros, unit: "und", desc: "Otros " + (line.material||'N/D') });
        const juntas = codos*2 + tees*3 + reducers*2 + flanges*2 + valves*2 + (line.origin?1:0) + (line.destination?1:0);
        return {
            tag: lineTag,
            longitudTotalM: (totalLen/1000).toFixed(2),
            bomItems: bomItems,
            juntasEstimadas: juntas,
            connectionType: connectionType,
            fittingNorm: fittingNorm
        };
    }

    function setDatum(elevation, north, east) {
        _datumElevation = elevation || 0;
        _datumNorth = north || 0;
        _datumEast = east || 0;
        _notifyUI("Datum actualizado: EL=" + _datumElevation + "m, N=" + _datumNorth + ", E=" + _datumEast, false);
    }

    function calcularPuntoParametrico(lineTag, param) {
        const result = _splitLineSegment(lineTag, param);
        return result ? result.punto : null;
    }

    return {
        init: function(notifyFn, renderFn, propertyPanelFn) {
            _notifyUI = notifyFn || _notifyUI;
            _renderUI = renderFn || _renderUI;
            _onSelectionChanged = propertyPanelFn || (function() {});
            rebuildIndexes();
            this._saveState();
        },

        on: on,
        off: off,
        emit: emit,

        _saveState: function() {
            const state = _deepClone({ equipos: _db.equipos, lines: _db.lines });
            _history.past.push(state);
            if (_history.past.length > _history.maxSize) _history.past.shift();
            _history.future = [];
        },
        
        rebuildIndexes: rebuildIndexes,

        addEquipment: function(equipo) {
            if (!equipo.tag) return _notifyUI("Error: Tag requerido.", true);
            if (_allObjectsMap.has(equipo.tag)) return _notifyUI("Error: El equipo " + equipo.tag + " ya existe.", true);
            if (equipo.puertos) equipo.puertos.forEach(function(p) { 
                if (!p.status) p.status = 'open'; 
                if (!p.flow) p.flow = 'bi'; 
                if (!p.constraints) p.constraints = { spec: equipo.spec || 'STD', diametro: p.diametro || 3 }; 
            });
            _db.equipos.push(equipo);
            _equiposMap.set(equipo.tag, equipo);
            _allObjectsMap.set(equipo.tag, equipo);
            this._saveState();
            _notifyUI("Equipo " + equipo.tag + " añadido.", false);
            _renderUI();
            emit('modelChanged', { type: 'addEquipment', tag: equipo.tag });
            scheduleAudit();
            return true;
        },
        
        addLine: function(linea) {
            if (!linea.tag) return _notifyUI("Error: Tag de línea requerido.", true);
            if (_allObjectsMap.has(linea.tag)) return _notifyUI("Error: La línea " + linea.tag + " ya existe.", true);
            if (linea.spec && _db.specs[linea.spec]) { 
                const s = _db.specs[linea.spec]; 
                linea.material = linea.material || s.mat; 
                linea.rating = s.rating; 
                linea.schedule = s.sch; 
            }
            
            if (!linea.puertos) linea.puertos = [];
            const pts = getLinePoints(linea);
            if (pts && pts.length >= 2) {
                if (!linea.puertos.find(function(p) { return p.id === '0'; })) {
                    const dirStart = { dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y, dz: pts[1].z - pts[0].z };
                    const len = Math.hypot(dirStart.dx, dirStart.dy, dirStart.dz) || 1;
                    linea.puertos.push({ id: '0', relX: 0, relY: 0, relZ: 0, orientacion: { dx: dirStart.dx/len, dy: dirStart.dy/len, dz: dirStart.dz/len }, diametro: linea.diameter || 4, status: 'connected', flow: 'in' });
                }
                if (!linea.puertos.find(function(p) { return p.id === '1'; })) {
                    const n = pts.length;
                    const dirEnd = { dx: pts[n-1].x - pts[n-2].x, dy: pts[n-1].y - pts[n-2].y, dz: pts[n-1].z - pts[n-2].z };
                    const len = Math.hypot(dirEnd.dx, dirEnd.dy, dirEnd.dz) || 1;
                    linea.puertos.push({ id: '1', relX: 0, relY: 0, relZ: 0, orientacion: { dx: dirEnd.dx/len, dy: dirEnd.dy/len, dz: dirEnd.dz/len }, diametro: linea.diameter || 4, status: 'connected', flow: 'out' });
                }
            }
            
            _db.lines.push(linea);
            _linesMap.set(linea.tag, linea);
            _allObjectsMap.set(linea.tag, linea);
            this._saveState();
            _notifyUI("Línea " + linea.tag + " creada correctamente.", false);
            _renderUI();
            emit('modelChanged', { type: 'addLine', tag: linea.tag });
            scheduleAudit();
            return true;
        },
        
        syncPhysicalData: syncPhysicalData,

        updateEquipment: function(tag, datos) {
            const eq = _equiposMap.get(tag);
            if (!eq) return _notifyUI("Equipo " + tag + " no encontrado.", true);
            Object.assign(eq, datos);
            syncPhysicalData();
            this._saveState();
            _renderUI();
            emit('modelChanged', { type: 'updateEquipment', tag: tag });
            scheduleAudit();
            return true;
        },
        
        updateLine: function(tag, datos) {
            const line = _linesMap.get(tag);
            if (!line) return _notifyUI("Línea " + tag + " no encontrada.", true);
            Object.assign(line, datos);
            this._saveState();
            _renderUI();
            emit('modelChanged', { type: 'updateLine', tag: tag });
            scheduleAudit();
            return true;
        },
        
        updatePuerto: function(ownerTag, puertoId, cambios) {
            const owner = findObjectByTag(ownerTag);
            if (!owner) return _notifyUI("Objeto " + ownerTag + " no encontrado.", true);
            const puerto = owner.puertos ? owner.puertos.find(function(p) { return p.id === puertoId; }) : null;
            if (!puerto) return _notifyUI("Puerto " + puertoId + " no encontrado.", true);
            if (cambios.status !== undefined) puerto.status = cambios.status;
            if (cambios.connectedTo !== undefined) puerto.connectedTo = cambios.connectedTo;
            if (cambios.flow !== undefined) puerto.flow = cambios.flow;
            if (cambios.constraints !== undefined) puerto.constraints = Object.assign({}, puerto.constraints || {}, cambios.constraints);
            if (cambios.diametro !== undefined) puerto.diametro = cambios.diametro;
            if (cambios.pos) { puerto.relX = cambios.pos.x; puerto.relY = cambios.pos.y; puerto.relZ = cambios.pos.z; }
            if (cambios.dir) { 
                const dx = cambios.dir.dx, dy = cambios.dir.dy, dz = cambios.dir.dz;
                const len = Math.sqrt(dx*dx+dy*dy+dz*dz); 
                if (len > 0) puerto.orientacion = { dx: dx/len, dy: dy/len, dz: dz/len }; 
            }
            syncPhysicalData();
            this._saveState();
            _renderUI();
            emit('modelChanged', { type: 'updatePuerto', tag: ownerTag, portId: puertoId });
            return true;
        },

        nuevoProyecto: function() {
            const oldSpecs = _db.specs;
            _db = { equipos: [], lines: [], specs: oldSpecs };
            _selectedElement = null;
            _history = { past: [], future: [], maxSize: 50 };
            _lastAuditResults = null;
            rebuildIndexes();
            this._saveState();
            _renderUI();
            _notifyUI("Nuevo proyecto creado.", false);
            emit('modelChanged', { type: 'newProject' });
        },
        
        importState: function(state) {
            const data = typeof state === 'string' ? JSON.parse(state) : state;
            let equipos = data.equipos || (data.data && data.data.equipos) || [];
            let lines = data.lines || (data.data && data.data.lines) || [];
            if (!Array.isArray(equipos)) equipos = [];
            if (!Array.isArray(lines)) lines = [];
            _db.equipos = _deepClone(equipos);
            _db.lines = _deepClone(lines);
            _selectedElement = null;
            _lastAuditResults = null;
            rebuildIndexes();
            this._saveState();
            syncPhysicalData();
            _renderUI();
            _notifyUI("Proyecto importado correctamente.", false);
            emit('modelChanged', { type: 'import' });
            scheduleAudit();
            return true;
        },
        
        exportProject: function() {
            return JSON.stringify({ equipos: _db.equipos, lines: _db.lines });
        },

        removeEquipment: function(tag) {
            const eq = _equiposMap.get(tag);
            if (!eq) {
                _notifyUI("Equipo " + tag + " no encontrado.", true);
                return false;
            }
            
            this._saveState();
            
            const lineasConectadas = _db.lines.filter(function(line) {
                return (line.origin && line.origin.equipTag === tag) ||
                       (line.destination && line.destination.equipTag === tag) ||
                       (line.origin && line.origin.objTag === tag) ||
                       (line.destination && line.destination.objTag === tag);
            });
            
            lineasConectadas.forEach(function(linea) {
                const otroExtremo = (linea.origin && (linea.origin.equipTag === tag || linea.origin.objTag === tag)) ? 
                    linea.destination : linea.origin;
                if (otroExtremo && (otroExtremo.equipTag || otroExtremo.objTag)) {
                    const otroTag = otroExtremo.equipTag || otroExtremo.objTag;
                    const otroObj = findObjectByTag(otroTag);
                    if (otroObj && otroObj.puertos) {
                        const puerto = otroObj.puertos.find(function(p) { return p.id === otroExtremo.portId; });
                        if (puerto) {
                            puerto.status = 'open';
                            puerto.flow = 'bi';
                            delete puerto.connectedTo;
                            delete puerto.connectedLine;
                        }
                    }
                }
            });
            
            _db.lines = _db.lines.filter(function(line) {
                return !lineasConectadas.includes(line);
            });
            
            _db.equipos = _db.equipos.filter(function(e) { return e.tag !== tag; });
            
            rebuildIndexes();
            
            syncPhysicalData();
            _renderUI();
            
            var count = lineasConectadas.length;
            _notifyUI("Equipo " + tag + " eliminado" + (count > 0 ? " + " + count + " línea(s) conectada(s)" : "") + ".", false);
            emit('modelChanged', { type: 'removeEquipment', tag: tag });
            scheduleAudit();
            return true;
        },
        
        removeLine: function(tag) {
            const line = _linesMap.get(tag);
            if (!line) {
                _notifyUI("Línea " + tag + " no encontrada.", true);
                return false;
            }
            
            this._saveState();
            
            if (line.origin && (line.origin.equipTag || line.origin.objTag)) {
                const origenTag = line.origin.equipTag || line.origin.objTag;
                const objOrigen = findObjectByTag(origenTag);
                if (objOrigen && objOrigen.puertos) {
                    const puerto = objOrigen.puertos.find(function(p) { return p.id === line.origin.portId; });
                    if (puerto) {
                        puerto.status = 'open';
                        puerto.flow = 'bi';
                        delete puerto.connectedTo;
                        delete puerto.connectedLine;
                    }
                }
            }
            
            if (line.destination && (line.destination.equipTag || line.destination.objTag)) {
                const destinoTag = line.destination.equipTag || line.destination.objTag;
                const objDestino = findObjectByTag(destinoTag);
                if (objDestino && objDestino.puertos) {
                    const puerto = objDestino.puertos.find(function(p) { return p.id === line.destination.portId; });
                    if (puerto) {
                        puerto.status = 'open';
                        puerto.flow = 'bi';
                        delete puerto.connectedTo;
                        delete puerto.connectedLine;
                    }
                }
            }
            
            _db.lines = _db.lines.filter(function(l) { return l.tag !== tag; });
            
            rebuildIndexes();
            
            syncPhysicalData();
            _renderUI();
            
            _notifyUI("Línea " + tag + " eliminada. Puertos liberados.", false);
            emit('modelChanged', { type: 'removeLine', tag: tag });
            scheduleAudit();
            return true;
        },

        undo: function() {
            if (_history.past.length <= 1) return _notifyUI("Nada que deshacer.", true);
            const current = _deepClone({ equipos: _db.equipos, lines: _db.lines });
            _history.future.push(current);
            _history.past.pop();
            const prev = _history.past[_history.past.length-1];
            _db.equipos = _deepClone(prev.equipos);
            _db.lines = _deepClone(prev.lines);
            _selectedElement = null;
            rebuildIndexes();
            syncPhysicalData();
            _renderUI();
            _notifyUI("Acción deshecha.", false);
            emit('modelChanged', { type: 'undo' });
            scheduleAudit();
        },
        
        redo: function() {
            if (_history.future.length === 0) return _notifyUI("Nada que rehacer.", true);
            const next = _history.future.pop();
            _history.past.push(_deepClone(next));
            _db.equipos = _deepClone(next.equipos);
            _db.lines = _deepClone(next.lines);
            _selectedElement = null;
            rebuildIndexes();
            syncPhysicalData();
            _renderUI();
            _notifyUI("Acción rehecha.", false);
            emit('modelChanged', { type: 'redo' });
            scheduleAudit();
        },

        auditModel: function() { return runAllAudits().report; },
        
        recalculateAll: function() {
            syncPhysicalData();
            const result = runAllAudits(true);
            if (result.collisions.length > 0) _notifyUI("Recálculo completado. " + result.collisions.length + " posibles interferencias.", true);
            else _notifyUI("Recálculo completado. Sin interferencias.", false);
            _renderUI();
            emit('modelChanged', { type: 'recalculateAll' });
        },
        
        getLastAuditResults: function() { return _lastAuditResults; },

        connectSmart: function(source, target) {
            const objS = findObjectByTag(source.tag), objT = findObjectByTag(target.tag);
            if (!objS || !objT) return _notifyUI("Objeto no encontrado.", true);
            const pS = objS.puertos ? objS.puertos.find(function(p) { return p.id === source.portId; }) : null;
            const pT = objT.puertos ? objT.puertos.find(function(p) { return p.id === target.portId; }) : null;
            if (!pS || !pT) return _notifyUI("Puerto no encontrado.", true);
            const validation = checkCompatibility(pS, pT);
            if (!validation.isCompatible) _notifyUI("⚠️ Advertencia: " + validation.alerts.join(", "), false);
            pS.status = "connected"; pS.connectedTo = { tag: target.tag, portId: target.portId };
            pT.status = "connected"; pT.connectedTo = { tag: source.tag, portId: source.portId };
            syncPhysicalData();
            this._saveState();
            _notifyUI("Conexión lógica: " + source.tag + ":" + source.portId + " ↔ " + target.tag + ":" + target.portId, false);
            emit('modelChanged', { type: 'connect' });
            scheduleAudit();
            return true;
        },
        
        injectAccessory: function(lineTag, param, accesorioDef) {
            const result = _splitLineSegment(lineTag, param);
            if (!result) return null;
            if (accesorioDef && accesorioDef.generarPuertos) {
                const line = _linesMap.get(lineTag);
                if (line) {
                    const nuevosPuertos = accesorioDef.generarPuertos(line, param, line.diameter);
                    line.puertos = line.puertos.filter(function(p) { return !p.id.startsWith('ACC-'); });
                    nuevosPuertos.forEach(function(p, idx) { p.id = (accesorioDef.tag||'ACC') + '_' + idx; line.puertos.push(p); });
                    _notifyUI("Accesorio " + (accesorioDef.tag||'ACC') + " inyectado en " + lineTag, false);
                }
            }
            this._saveState();
            syncPhysicalData();
            _renderUI();
            emit('modelChanged', { type: 'injectAccessory', lineTag: lineTag });
            scheduleAudit();
            return result;
        },
        
        splitLine: function(lineTag, point, config) {
            const line = _linesMap.get(lineTag);
            if (!line) { _notifyUI("Línea no encontrada.", true); return null; }
            const segmentIndex = _findSegmentAtPoint(line, point);
            if (segmentIndex === -1) { _notifyUI("El punto no está sobre la línea o está demasiado lejos.", true); return null; }
            const pts = getLinePoints(line);
            const a = pts[segmentIndex], b = pts[segmentIndex + 1];
            const dir = { dx: b.x - a.x, dy: b.y - a.y, dz: b.z - a.z };
            const len = Math.hypot(dir.dx, dir.dy, dir.dz) || 1;
            const dirUnit = { dx: dir.dx/len, dy: dir.dy/len, dz: dir.dz/len };
            let perp = _getPerpendicular(dirUnit);
            const accessoryTag = "TEE-" + Date.now().toString().slice(-6);
            const nuevoAccesorio = {
                tag: accessoryTag,
                tipo: (config && config.type) || 'TEE_EQUAL',
                posX: point.x, posY: point.y, posZ: point.z,
                diametro: line.diameter,
                material: line.material,
                spec: line.spec,
                branchDirection: perp,
                puertos: [
                    { id: 'P1', relX: -dirUnit.dx*100, relY: -dirUnit.dy*100, relZ: -dirUnit.dz*100, orientacion: { dx: -dirUnit.dx, dy: -dirUnit.dy, dz: -dirUnit.dz }, status: 'connected', connectedTo: { tag: lineTag, portId: 'S1' }, diametro: line.diameter, flow: 'in', constraints: { spec: line.spec||'STD', diametro: line.diameter } },
                    { id: 'P2', relX: dirUnit.dx*100, relY: dirUnit.dy*100, relZ: dirUnit.dz*100, orientacion: { dx: dirUnit.dx, dy: dirUnit.dy, dz: dirUnit.dz }, status: 'connected', connectedTo: { tag: lineTag, portId: 'S2' }, diametro: line.diameter, flow: 'out', constraints: { spec: line.spec||'STD', diametro: line.diameter } },
                    { id: 'P3', relX: perp.dx*100, relY: perp.dy*100, relZ: perp.dz*100, orientacion: { dx: perp.dx, dy: perp.dy, dz: perp.dz }, status: 'open', diametro: line.diameter, flow: 'bi', constraints: { spec: line.spec||'STD', diametro: line.diameter } }
                ]
            };
            pts.splice(segmentIndex+1, 0, point);
            line._cachedPoints = pts;
            if (!line.puertos) line.puertos = [];
            if (!line.puertos.find(function(p) { return p.id === 'S1'; })) line.puertos.push({ id: 'S1', relX: 0, relY: 0, relZ: 0, status: 'connected', connectedTo: { tag: accessoryTag, portId: 'P1' }, diametro: line.diameter });
            if (!line.puertos.find(function(p) { return p.id === 'S2'; })) line.puertos.push({ id: 'S2', relX: 0, relY: 0, relZ: 0, status: 'connected', connectedTo: { tag: accessoryTag, portId: 'P2' }, diametro: line.diameter });
            _db.equipos.push(nuevoAccesorio);
            _equiposMap.set(accessoryTag, nuevoAccesorio);
            _allObjectsMap.set(accessoryTag, nuevoAccesorio);
            this._saveState();
            syncPhysicalData();
            _renderUI();
            _notifyUI("Línea " + lineTag + " dividida. Accesorio " + accessoryTag + " insertado.", false);
            emit('modelChanged', { type: 'splitLine', lineTag: lineTag });
            scheduleAudit();
            return { componente: nuevoAccesorio, linea: line };
        },

        setSelected: function(element) {
            if (element && element.obj && !findObjectByTag(element.obj.tag)) {
                _selectedElement = null;
                _onSelectionChanged(null);
                _renderUI();
                return;
            }
            _selectedElement = element;
            _renderUI();
            if (_selectedElement && _selectedElement.obj) {
                const info = this.getPropertyInfo(_selectedElement.obj.tag);
                _onSelectionChanged(info);
            } else {
                _onSelectionChanged(null);
            }
        },
        
        getPropertyInfo: function(tag) {
            const obj = findObjectByTag(tag);
            if (!obj) return null;
            const isLine = _linesMap.has(tag);
            const isEquipment = _equiposMap.has(tag);
            return {
                tag: obj.tag,
                tipo: obj.tipo || (isLine ? 'Tubería' : (isEquipment ? 'Equipo' : 'Desconocido')),
                spec: obj.spec || 'N/A',
                material: obj.material || 'N/A',
                diametro: obj.diameter || obj.diametro || 'N/A',
                dimensiones: obj.posX !== undefined ? {
                    posX: obj.posX, posY: obj.posY, posZ: obj.posZ,
                    diametro: obj.diametro, altura: obj.altura, largo: obj.largo
                } : null,
                puertos: obj.puertos ? obj.puertos.map(function(p) { return {
                    id: p.id,
                    status: p.status || 'open',
                    connectedTo: (p.connectedTo && p.connectedTo.tag) || 'Libre',
                    diametro: p.diametro,
                    orientacion: p.orientacion
                }; }) : [],
                spool: isLine ? getSpoolReport(tag) : null
            };
        },
        
        updateFromPanel: function(tag, field, newValue) {
            const obj = findObjectByTag(tag);
            if (!obj) { _notifyUI("Objeto no encontrado.", true); return false; }
            if (field === 'tag') {
                if (_allObjectsMap.has(newValue)) {
                    _notifyUI("Error: El Tag ya existe.", true);
                    return false;
                }
                _db.lines.forEach(function(line) {
                    if (line.origin && line.origin.objTag === tag) line.origin.objTag = newValue;
                    if (line.destination && line.destination.objTag === tag) line.destination.objTag = newValue;
                });
                if (_equiposMap.has(tag)) { _equiposMap.delete(tag); _allObjectsMap.delete(tag); obj.tag = newValue; _equiposMap.set(newValue, obj); _allObjectsMap.set(newValue, obj); }
                else if (_linesMap.has(tag)) { _linesMap.delete(tag); _allObjectsMap.delete(tag); obj.tag = newValue; _linesMap.set(newValue, obj); _allObjectsMap.set(newValue, obj); }
            } else {
                obj[field] = newValue;
            }
            if (['posX', 'posY', 'posZ', 'diametro', 'altura', 'largo', 'diameter'].indexOf(field) !== -1) {
                syncPhysicalData();
            }
            this._saveState();
            _renderUI();
            _notifyUI("Propiedad '" + field + "' actualizada.", false);
            emit('modelChanged', { type: 'updateProperty', tag: tag, field: field });
            scheduleAudit();
            return true;
        },

        auditCollisions: auditCollisions,
        auditJointSpacing: auditJointSpacing,
        getSpoolReport: getSpoolReport,
        setDatum: setDatum,
        getAbsolutePosition: getAbsolutePosition,
        getLinePoints: getLinePoints,
        findObjectByTag: findObjectByTag,
        calcularPuntoParametrico: calcularPuntoParametrico,
        getDb: function() { return _db; },
        getEquipos: function() { return _db.equipos; },
        getLines: function() { return _db.lines; },
        getSpecs: function() { return Object.keys(_db.specs); },
        getSelected: function() { return _selectedElement; },
        setElevation: function(level) { _currentElevation = level; },
        getElevation: function() { return _currentElevation; },
        setVoice: function(enabled) { _voiceEnabled = enabled; },
        isVoiceEnabled: function() { return _voiceEnabled; },
        
        get equiposMap() { return _equiposMap; },
        get linesMap() { return _linesMap; },
        get allObjectsMap() { return _allObjectsMap; }
    };
})();
