
// ============================================================
// SMARTFLOW I/O v1.0 - Módulo de Importación/Exportación
// Archivo: js/modules/smartflow_io.js
// Dependencia: SmartFlowCore v5.6+
// Independiente de: commands.js, renderer.js, catalog.js
// ============================================================
// 
// Maneja TODAS las operaciones de entrada/salida:
//   - Exportación: PCF, JSON (proyecto), CSV (MTO)
//   - Importación: PCF, JSON (proyecto)
//
// ============================================================

const SmartFlowIO = (function() {
    
    // ================================================================
    //  REFERENCIAS EXTERNAS (inyectadas en init)
    // ================================================================
    let _core = null;
    let _notifyFn = null;
    
    // ================================================================
    //  DICCIONARIOS DE MAPEO SKEY ↔ TIPO INTERNO
    // ================================================================
    
    /**
     * SKEY → Tipo Interno (usado en importación)
     */
    const SKEY_TO_INTERNAL = {
        'TANK': { type: 'equipment', internal: 'tanque_v' },
        'PUMP': { type: 'equipment', internal: 'bomba' },
        'VESS': { type: 'equipment', internal: 'tanque_v' },
        'PIPE': { type: 'pipe', internal: 'PIPE' },
        'STRA': { type: 'pipe', internal: 'PIPE' },
        'VALV': { type: 'component', internal: 'GATE_VALVE' },
        'VAGF': { type: 'component', internal: 'GATE_VALVE' },
        'VGLF': { type: 'component', internal: 'GLOBE_VALVE' },
        'VBAL': { type: 'component', internal: 'BALL_VALVE' },
        'VBAF': { type: 'component', internal: 'BUTTERFLY_VALVE' },
        'VCFF': { type: 'component', internal: 'CHECK_VALVE' },
        'VDIA': { type: 'component', internal: 'DIAPHRAGM_VALVE' },
        'VCON': { type: 'component', internal: 'CONTROL_VALVE' },
        'VPRV': { type: 'component', internal: 'PRESSURE_RELIEF' },
        'VSFT': { type: 'component', internal: 'SAFETY_VALVE' },
        'ELBW': { type: 'component', internal: 'ELBOW_90_LR' },
        'ELBS': { type: 'component', internal: 'ELBOW_90_SR' },
        'ELL4': { type: 'component', internal: 'ELBOW_45' },
        'ELLL': { type: 'component', internal: 'ELBOW_90_LR' },
        'ELLS': { type: 'component', internal: 'ELBOW_90_SR' },
        'TEES': { type: 'component', internal: 'TEE_EQUAL' },
        'TEER': { type: 'component', internal: 'TEE_REDUCING' },
        'CROS': { type: 'component', internal: 'CROSS' },
        'FLWN': { type: 'component', internal: 'WELD_NECK_FLANGE' },
        'FLSO': { type: 'component', internal: 'SLIP_ON_FLANGE' },
        'FLBL': { type: 'component', internal: 'BLIND_FLANGE' },
        'FLLJ': { type: 'component', internal: 'LAP_JOINT_FLANGE' },
        'REDC': { type: 'component', internal: 'CONCENTRIC_REDUCER' },
        'REDE': { type: 'component', internal: 'ECCENTRIC_REDUCER' },
        'CAPF': { type: 'component', internal: 'CAP' },
        'SHOE': { type: 'component', internal: 'PIPE_SHOE' },
        'UBOL': { type: 'component', internal: 'U_BOLT' },
        'GUID': { type: 'component', internal: 'GUIDE' },
        'ANCH': { type: 'component', internal: 'ANCHOR' },
        'STRY': { type: 'component', internal: 'Y_STRAINER' },
        'TRAN': { type: 'component', internal: 'TRANSITION' },
        'UNIO': { type: 'component', internal: 'UNION' },
        'BULK': { type: 'component', internal: 'BULKHEAD' },
        'INSI': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INPG': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INTG': { type: 'component', internal: 'TEMPERATURE_GAUGE' },
        'INFM': { type: 'component', internal: 'FLOW_METER' },
        'INLV': { type: 'component', internal: 'LEVEL_SWITCH_RANA' },
        'INSLS': { type: 'component', internal: 'LEVEL_SWITCH_RANA' }
    };
    
    /**
     * Tipo Interno → SKEY (usado en exportación)
     */
    const INTERNAL_TO_SKEY = {
        'PIPE': 'PIPE',
        'GATE_VALVE': 'VAGF', 'GLOBE_VALVE': 'VGLF', 'BUTTERFLY_VALVE': 'VBAF',
        'BALL_VALVE': 'VBAL', 'VALVE_BALL': 'VBAL',
        'CHECK_VALVE': 'VCFF', 'CHECK_VALVE_SANITARY': 'VCFF', 'SANITARY_CHECK_VALVE': 'VCFF',
        'DIAPHRAGM_VALVE': 'VDIA', 'ASEPTIC_VALVE': 'VDIA',
        'CONTROL_VALVE': 'VCON', 'PRESSURE_RELIEF': 'VPRV',
        'PRESSURE_SAFETY_VALVE': 'VSFT', 'SAFETY_VALVE': 'VSFT',
        'DRAIN_VALVE': 'VAGF', 'SAMPLE_VALVE': 'VAGF', 'SAMPLE_VALVE_SANITARY': 'VAGF',
        'PISTON_SAMPLE_VALVE': 'VAGF', 'PLUG_VALVE': 'VAGF', 'CHOKE_VALVE': 'VAGF',
        'CRYOGENIC_VALVE': 'VAGF', 'AIR_RELEASE': 'VAGF', 'AIR_RELEASE_VALVE': 'VAGF',
        'ELBOW_90_LR': 'ELBW', 'ELBOW_90_SR': 'ELBS', 'ELBOW_45': 'ELL4',
        'ELBOW_90_PPR': 'ELBW', 'ELBOW_45_PPR': 'ELL4',
        'ELBOW_90_HDPE': 'ELBW', 'ELBOW_45_HDPE': 'ELL4',
        'ELBOW_90_PVC': 'ELBW', 'ELBOW_45_PVC': 'ELL4',
        'ELBOW_90_LR_SS': 'ELBW', 'ELBOW_90_SANITARY': 'ELBW',
        'TEE_EQUAL': 'TEES', 'TEE_REDUCING': 'TEER', 'CROSS': 'CROS',
        'WELD_NECK_FLANGE': 'FLWN', 'SLIP_ON_FLANGE': 'FLSO',
        'BLIND_FLANGE': 'FLBL', 'LAP_JOINT_FLANGE': 'FLLJ', 'LOOSE_FLANGE': 'FLLJ',
        'RTJ_FLANGE': 'FLWN', 'ORIFICE_FLANGE': 'FLWN',
        'CONCENTRIC_REDUCER': 'RECN', 'ECCENTRIC_REDUCER': 'REEC',
        'CAP': 'CAPF',
        'PIPE_SHOE': 'SHOE', 'U_BOLT': 'UBOL', 'GUIDE': 'GUID', 'ANCHOR': 'ANCH',
        'HANGER': 'GUID', 'PIPE_CLAMP': 'GUID', 'SPRING_HANGER': 'GUID',
        'Y_STRAINER': 'STRY', 'T_STRAINER': 'STRY', 'BASKET_STRAINER': 'STRY',
        'DUPLEX_STRAINER': 'STRY', 'SANITARY_STRAINER': 'STRY', 'STRAINER': 'STRY',
        'TRANSITION': 'TRAN', 'UNION': 'UNIO', 'UNION_ACERO': 'UNIO', 'BULKHEAD': 'BULK',
        'PRESSURE_GAUGE': 'INPG', 'PRESSURE_GAUGE_SANITARY': 'INPG',
        'TEMPERATURE_GAUGE': 'INTG', 'FLOW_METER': 'INFM',
        'FLOW_METER_MAG': 'INFM', 'CORIOLIS_METER': 'INFM',
        'PRESSURE_TRANSMITTER': 'INPG', 'LEVEL_TRANSMITTER': 'INLV',
        'TEMPERATURE_TRANSMITTER': 'INTG', 'LEVEL_SWITCH_RANA': 'INSLS', 'LEVEL_SWITCH': 'INSLS',
        'NIPPLE': 'PIPE', 'STUB_END': 'FLWN', 'STUB_END_PPR': 'FLWN', 'STUB_END_HDPE': 'FLWN',
        'EXPANSION_JOINT': 'TRAN', 'FLEXIBLE_HOSE': 'TRAN', 'METALLIC_HOSE': 'TRAN', 'PTFE_HOSE': 'TRAN',
        'CAMLOCK': 'UNIO', 'CAMLOCK_MALE': 'UNIO', 'CAMLOCK_FEMALE': 'UNIO', 'QUICK_CONNECT': 'UNIO',
        'SILENCER': 'TRAN', 'VENT_SILENCER': 'TRAN',
        'FLAME_ARRESTER': 'TRAN', 'DETONATION_ARRESTER': 'TRAN',
        'VACUUM_BREAKER': 'VAGF', 'SAMPLE_COOLER': 'TRAN',
        'INSULATING_JOINT': 'TRAN', 'SPECTACLE_BLIND': 'FLBL', 'RUPTURE_DISC': 'FLBL',
        'SPRAY_BALL': 'TRAN', 'STATIC_MIXER': 'TRAN',
        'AIR_DIFFUSER': 'TRAN', 'CHLORINE_EJECTOR': 'TRAN', 'CHEMICAL_INJECTOR': 'TRAN',
        'ROTAMETER': 'INFM', 'ROTAMETRO': 'INFM',
        'SIGHT_GLASS': 'TRAN', 'SIGHT_GLASS_SANITARY': 'TRAN',
        'STEAM_TRAP': 'VAGF', 'STEAM_TRAP_THERMODYNAMIC': 'VAGF',
        'STEAM_TRAP_FLOAT': 'VAGF', 'STEAM_TRAP_BUCKET': 'VAGF', 'STEAM_TRAP_SANITARY': 'VAGF'
    };
    
    const COMPONENT_CATEGORIES = {
        'GATE_VALVE': 'VALVE', 'GLOBE_VALVE': 'VALVE', 'BALL_VALVE': 'VALVE',
        'BUTTERFLY_VALVE': 'VALVE', 'CHECK_VALVE': 'VALVE', 'DIAPHRAGM_VALVE': 'VALVE',
        'CONTROL_VALVE': 'VALVE', 'PRESSURE_RELIEF': 'VALVE', 'SAFETY_VALVE': 'VALVE',
        'DRAIN_VALVE': 'VALVE', 'SAMPLE_VALVE': 'VALVE', 'PLUG_VALVE': 'VALVE',
        'CHOKE_VALVE': 'VALVE', 'CRYOGENIC_VALVE': 'VALVE', 'AIR_RELEASE': 'VALVE',
        'VACUUM_BREAKER': 'VALVE', 'STEAM_TRAP': 'VALVE',
        'ELBOW_90_LR': 'ELBOW', 'ELBOW_90_SR': 'ELBOW', 'ELBOW_45': 'ELBOW',
        'TEE_EQUAL': 'TEE', 'TEE_REDUCING': 'TEE', 'CROSS': 'TEE',
        'WELD_NECK_FLANGE': 'FLANGE', 'SLIP_ON_FLANGE': 'FLANGE',
        'BLIND_FLANGE': 'FLANGE', 'LAP_JOINT_FLANGE': 'FLANGE', 'LOOSE_FLANGE': 'FLANGE',
        'CONCENTRIC_REDUCER': 'REDUCER', 'ECCENTRIC_REDUCER': 'REDUCER',
        'Y_STRAINER': 'STRAINER', 'T_STRAINER': 'STRAINER',
        'PRESSURE_GAUGE': 'INSTRUMENT', 'TEMPERATURE_GAUGE': 'INSTRUMENT',
        'FLOW_METER': 'INSTRUMENT', 'LEVEL_SWITCH': 'INSTRUMENT',
        'PRESSURE_TRANSMITTER': 'INSTRUMENT', 'LEVEL_TRANSMITTER': 'INSTRUMENT'
    };
    
    // ================================================================
    //  UTILIDADES GEOMÉTRICAS
    // ================================================================
    
    function getLinePoints(line) {
        if (!line) return [];
        if (_core && typeof _core.getLinePoints === 'function') {
            return _core.getLinePoints(line) || [];
        }
        return line._cachedPoints || line.points3D || line.points || [];
    }
    
    function getNozzleWorldPosition(equipo, nozzleId) {
        if (!equipo || !equipo.puertos) return null;
        const nozzle = equipo.puertos.find(function(p) { return p.id === nozzleId; });
        if (!nozzle) return null;
        return {
            x: (equipo.posX || 0) + (nozzle.relX || 0),
            y: (equipo.posY || 0) + (nozzle.relY || 0),
            z: (equipo.posZ || 0) + (nozzle.relZ || 0),
            orientacion: nozzle.orientacion || { dx: 1, dy: 0, dz: 0 },
            diametro: nozzle.diametro || equipo.diametro || 4
        };
    }
    
    function getParametricPoint(line, param) {
        const pts = getLinePoints(line);
        if (!pts || pts.length < 2) return null;
        let totalLen = 0;
        const lengths = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d);
            totalLen += d;
        }
        if (totalLen === 0) return { x: pts[0].x, y: pts[0].y, z: pts[0].z };
        const target = totalLen * Math.max(0, Math.min(1, param));
        let accum = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (accum + lengths[i] >= target || i === lengths.length - 1) {
                const t = lengths[i] > 0 ? (target - accum) / lengths[i] : 0;
                const pA = pts[i], pB = pts[i+1];
                return {
                    x: pA.x + (pB.x - pA.x) * t,
                    y: pA.y + (pB.y - pA.y) * t,
                    z: pA.z + (pB.z - pA.z) * t
                };
            }
            accum += lengths[i];
        }
        return { x: pts[pts.length-1].x, y: pts[pts.length-1].y, z: pts[pts.length-1].z };
    }
    
    function getDirection(p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
        return { dx: dx/len, dy: dy/len, dz: dz/len };
    }
    
    function calculateAngle(p1, p2, p3) {
        const dir1 = getDirection(p1, p2), dir2 = getDirection(p2, p3);
        const dot = dir1.dx*dir2.dx + dir1.dy*dir2.dy + dir1.dz*dir2.dz;
        return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    }
    
    function notify(msg, isError) {
        if (typeof _notifyFn === 'function') _notifyFn(msg, isError || false);
        else console.log(msg);
    }
    
    // ================================================================
    //  SECCIÓN 1: EXPORTACIÓN A PCF
    // ================================================================
    
    function exportLineToPCF(line) {
        const pts = getLinePoints(line);
        if (!pts || pts.length < 2) return null;
        
        const diamMM = Math.round((line.diameter || 4) * 25.4);
        const spec = line.spec || 'STD';
        const material = line.material || 'PPR';
        let pcf = [];
        let itemCode = 1;
        
        pcf.push('ISOGEN-FILES');
        pcf.push('UNITS-BORE INCH');
        pcf.push('UNITS-COORDS MM');
        pcf.push('UNITS-WEIGHT KGS');
        pcf.push('PIPELINE-REFERENCE ' + line.tag);
        pcf.push('PIPING-SPEC ' + spec);
        pcf.push('MATERIAL ' + material);
        pcf.push('DIAMETER ' + diamMM);
        pcf.push('REVISION ' + (line.revision || '0'));
        pcf.push('');
        
        if (line.origin && line.origin.objTag && _core) {
            const sourceObj = _core.findObjectByTag(line.origin.objTag);
            if (sourceObj) {
                const nozzlePos = getNozzleWorldPosition(sourceObj, line.origin.portId);
                if (nozzlePos) {
                    pcf.push('# CONNECTION TO EQUIPMENT ' + sourceObj.tag);
                    pcf.push('# NOZZLE ' + line.origin.portId);
                    pts[0] = { x: nozzlePos.x, y: nozzlePos.y, z: nozzlePos.z };
                }
            }
        }
        
        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i], p2 = pts[i+1];
            if (p1.isControlPoint || p2.isControlPoint) continue;
            const length = Math.hypot(p2.x-p1.x, p2.y-p1.y, p2.z-p1.z);
            if (length < 1) continue;
            
            pcf.push('PIPE');
            pcf.push("    PCF_ELEM_SKEY 'PIPE'");
            pcf.push('    END-POINT ' + p1.x.toFixed(3) + ' ' + p1.y.toFixed(3) + ' ' + p1.z.toFixed(3) + ' ' + p2.x.toFixed(3) + ' ' + p2.y.toFixed(3) + ' ' + p2.z.toFixed(3) + ' ' + diamMM);
            pcf.push('    ITEM-CODE PIPE-' + (itemCode++));
            pcf.push('    FABRICATION-ITEM');
            pcf.push('');
            
            if (i < pts.length - 2) {
                const p3 = pts[i+2];
                if (!p3.isControlPoint) {
                    const angle = calculateAngle(p1, p2, p3);
                    if (angle > 0.5) {
                        let skey = 'ELBW';
                        if (angle <= 50) skey = 'ELL4';
                        pcf.push('ELBOW');
                        pcf.push("    PCF_ELEM_SKEY '" + skey + "'");
                        pcf.push('    END-POINT ' + p2.x.toFixed(3) + ' ' + p2.y.toFixed(3) + ' ' + p2.z.toFixed(3) + ' ' + p2.x.toFixed(3) + ' ' + p2.y.toFixed(3) + ' ' + p2.z.toFixed(3) + ' ' + diamMM);
                        pcf.push('    ITEM-CODE ELBOW-' + (itemCode++));
                        pcf.push('    ANGLE ' + angle.toFixed(1));
                        pcf.push('    TYPE LR');
                        pcf.push('    FABRICATION-ITEM');
                        pcf.push('');
                    }
                }
            }
        }
        
        if (line.components && line.components.length > 0) {
            const sorted = line.components.slice().sort(function(a, b) { return (a.param||0) - (b.param||0); });
            for (let c = 0; c < sorted.length; c++) {
                const comp = sorted[c];
                const pos = getParametricPoint(line, comp.param || 0.5);
                if (!pos) continue;
                const skey = INTERNAL_TO_SKEY[comp.type] || comp.type || 'MISC';
                const category = COMPONENT_CATEGORIES[comp.type] || comp.type;
                
                pcf.push(category);
                pcf.push("    PCF_ELEM_SKEY '" + skey + "'");
                pcf.push('    END-POINT ' + pos.x.toFixed(3) + ' ' + pos.y.toFixed(3) + ' ' + pos.z.toFixed(3) + ' ' + pos.x.toFixed(3) + ' ' + pos.y.toFixed(3) + ' ' + pos.z.toFixed(3) + ' ' + diamMM);
                pcf.push('    ITEM-CODE ' + (comp.tag || skey + '-' + itemCode));
                if (comp.description) pcf.push('    ITEM-DESCRIPTION ' + comp.description);
                if (comp.material) pcf.push('    MATERIAL ' + comp.material);
                pcf.push('    FABRICATION-ITEM');
                pcf.push('');
                itemCode++;
                
                if (comp.type === 'STUB_END' || comp.type === 'STUB_END_PPR' || comp.type === 'STUB_END_HDPE') {
                    pcf.push('FLANGE');
                    pcf.push("    PCF_ELEM_SKEY 'FLLJ'");
                    pcf.push('    END-POINT ' + pos.x.toFixed(3) + ' ' + pos.y.toFixed(3) + ' ' + pos.z.toFixed(3) + ' ' + pos.x.toFixed(3) + ' ' + pos.y.toFixed(3) + ' ' + pos.z.toFixed(3) + ' ' + diamMM);
                    pcf.push('    ITEM-CODE BL-' + (comp.tag || 'STUB'));
                    pcf.push('    ITEM-DESCRIPTION Brida Loca ' + (line.diameter||'?') + '"');
                    pcf.push('    MATERIAL Acero Galvanizado');
                    pcf.push('    FABRICATION-ITEM');
                    pcf.push('');
                    itemCode++;
                }
            }
        }
        
        if (line.destination && line.destination.objTag && _core) {
            const destObj = _core.findObjectByTag(line.destination.objTag);
            if (destObj) {
                const nozzlePos = getNozzleWorldPosition(destObj, line.destination.portId);
                if (nozzlePos) {
                    const lastPt = pts[pts.length-1];
                    pcf.push('# CONNECTION TO EQUIPMENT ' + destObj.tag);
                    pcf.push('# NOZZLE ' + line.destination.portId);
                    pcf.push('# END-POINT ' + lastPt.x.toFixed(3) + ' ' + lastPt.y.toFixed(3) + ' ' + lastPt.z.toFixed(3) + ' ' + nozzlePos.x.toFixed(3) + ' ' + nozzlePos.y.toFixed(3) + ' ' + nozzlePos.z.toFixed(3) + ' ' + diamMM);
                }
            }
        }
        
        return pcf.join('\n');
    }
    
    function exportAllToPCF(includeEquipment) {
        if (!_core) { notify('Error: Core no inicializado', true); return ''; }
        const db = _core.getDb();
        const lines = db.lines || [];
        if (lines.length === 0) { notify('No hay lineas para exportar', true); return ''; }
        
        let pcfContent = [];
        pcfContent.push('ISOGEN-FILES');
        pcfContent.push('UNITS-BORE INCH');
        pcfContent.push('UNITS-COORDS MM');
        pcfContent.push('UNITS-WEIGHT KGS');
        pcfContent.push('PROJECT-IDENTIFIER ' + (db.projectName || window.currentProjectName || 'SMARTFLOW'));
        pcfContent.push('DATE ' + new Date().toISOString().slice(0,10));
        pcfContent.push('');
        
        if (includeEquipment !== false) {
            const equipos = db.equipos || [];
            if (equipos.length > 0) {
                pcfContent.push('# ========================================');
                pcfContent.push('# EQUIPMENT REFERENCE');
                pcfContent.push('# ========================================');
                pcfContent.push('');
                for (let e = 0; e < equipos.length; e++) {
                    const eq = equipos[e];
                    pcfContent.push('# EQUIPMENT: ' + eq.tag);
                    pcfContent.push('#   TYPE: ' + (eq.tipo || 'Desconocido'));
                    pcfContent.push('#   POSITION: ' + (eq.posX||0) + ', ' + (eq.posY||0) + ', ' + (eq.posZ||0));
                    if (eq.diametro) pcfContent.push('#   DIAMETER: ' + eq.diametro + 'mm');
                    if (eq.altura) pcfContent.push('#   HEIGHT: ' + eq.altura + 'mm');
                    if (eq.material) pcfContent.push('#   MATERIAL: ' + eq.material);
                    if (eq.puertos && eq.puertos.length > 0) {
                        pcfContent.push('#   PORTS:');
                        for (let p = 0; p < eq.puertos.length; p++) {
                            const puerto = eq.puertos[p];
                            const absPos = getNozzleWorldPosition(eq, puerto.id);
                            if (absPos) {
                                pcfContent.push('#     ' + puerto.id + ': ' + absPos.x.toFixed(0) + ',' + absPos.y.toFixed(0) + ',' + absPos.z.toFixed(0) + ' DIA:' + puerto.diametro + '"');
                            }
                        }
                    }
                    pcfContent.push('');
                }
                pcfContent.push('# ========================================');
                pcfContent.push('# PIPING LINES');
                pcfContent.push('# ========================================');
                pcfContent.push('');
            }
        }
        
        for (let l = 0; l < lines.length; l++) {
            const line = lines[l];
            const linePCF = exportLineToPCF(line);
            if (linePCF) {
                pcfContent.push('# ====== LINE: ' + line.tag + ' ======');
                pcfContent.push('# SPEC: ' + (line.spec||'STD') + ' | MATERIAL: ' + (line.material||'N/D') + ' | DIAMETER: ' + (line.diameter||'?') + '"');
                pcfContent.push(linePCF);
                pcfContent.push('');
            }
        }
        
        return pcfContent.join('\n');
    }
    
    function downloadPCF(filename) {
        const content = exportAllToPCF(true);
        if (!content) return;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'SMARTFLOW_' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.pcf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('📁 PCF exportado: ' + a.download, false);
    }
    
    // ================================================================
    //  SECCIÓN 2: IMPORTACIÓN DESDE PCF
    // ================================================================
    
    function importPCFContent(fileContent, runFittingFn) {
        if (!_core) { notify('Error: Core no inicializado', true); return { equipos: 0, lineas: 0 }; }
        
        const lines_raw = fileContent.split('\n');
        let currentLine = null, puntos = [], componentes = [];
        const equiposMap = new Map(), lineasMap = new Map();
        let currentComponent = null;
        
        function processComponent() {
            if (!currentComponent || !currentComponent.skey) return;
            const mapping = SKEY_TO_INTERNAL[currentComponent.skey];
            if (!mapping) return;
            
            if (mapping.type === 'equipment') {
                const pos = currentComponent.pos || { x:0, y:0, z:0 };
                const tag = currentComponent.itemCode || (mapping.internal + '_' + (equiposMap.size+1));
                if (!equiposMap.has(tag) && _core) {
                    const equipo = {
                        tag: tag, tipo: mapping.internal,
                        posX: pos.x, posY: pos.y, posZ: pos.z,
                        diametro: currentComponent.diameter || 1000,
                        altura: currentComponent.height || 1500,
                        material: currentComponent.material || 'PPR',
                        puertos: []
                    };
                    equiposMap.set(tag, equipo);
                    _core.addEquipment(equipo);
                }
            } else if (mapping.type === 'component' && currentLine) {
                componentes.push({
                    type: mapping.internal,
                    tag: currentComponent.itemCode || (mapping.internal + '_' + (componentes.length+1)),
                    param: 0.5,
                    description: currentComponent.description || '',
                    material: currentComponent.material || ''
                });
            }
            currentComponent = null;
        }
        
        function finalizeLine() {
            if (!currentLine || puntos.length < 2) return;
            if (!currentLine.tag) currentLine.tag = 'L-' + (lineasMap.size+1);
            currentLine._cachedPoints = puntos;
            currentLine.components = componentes;
            
            if (_core && typeof _core.addLine === 'function') {
                _core.addLine(currentLine);
                const db = _core.getDb();
                const lReg = db.lines.find(function(l) { return l.tag === currentLine.tag; }) || currentLine;
                if (typeof runFittingFn === 'function') {
                    runFittingFn(lReg, null, null, null, null, lReg.diameter||4, lReg.material||'PPR', lReg.spec||'PPR_PN12_5');
                }
                if (typeof _core.updateLine === 'function') _core.updateLine(lReg.tag, lReg);
                lineasMap.set(currentLine.tag, lReg);
            }
            currentLine = null; puntos = []; componentes = [];
        }
        
        for (let i = 0; i < lines_raw.length; i++) {
            let line_str = lines_raw[i].trim();
            if (line_str.startsWith('!') || line_str.startsWith('#') || line_str.length === 0) continue;
            
            const parts = line_str.split(/\s+/);
            const firstWord = parts[0];
            const newBlockWords = ['PIPE','VALVE','TEE','TANK','PUMP','INSTRUMENT','ELBOW','FLANGE','STRA','REDUCER','STRAINER'];
            
            if (newBlockWords.indexOf(firstWord) !== -1) {
                processComponent();
                if (firstWord === 'PIPE' || firstWord === 'STRA') {
                    finalizeLine();
                    currentLine = { tag:'', diameter:4, material:'PPR', spec:'PPR_PN12_5' };
                } else {
                    currentComponent = { type: firstWord };
                }
                continue;
            }
            
            if (line_str.startsWith('END-POINT') && parts.length >= 7) {
                const p1 = { x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) };
                const p2 = { x: parseFloat(parts[4]), y: parseFloat(parts[5]), z: parseFloat(parts[6]) };
                const diam = parts.length >= 8 ? parseFloat(parts[7]) : null;
                if (currentLine) {
                    if (puntos.length === 0) puntos.push(p1);
                    puntos.push(p2);
                    if (diam && !currentLine.diameter) currentLine.diameter = diam / 25.4;
                }
                if (currentComponent) { currentComponent.pos = p1; if (diam) currentComponent.diameter = diam; }
            }
            else if (line_str.startsWith('PCF_ELEM_SKEY')) {
                const skey = parts[1] ? parts[1].replace(/'/g,'') : '';
                if (currentComponent) currentComponent.skey = skey;
                else if (currentLine) currentLine.skey = skey;
            }
            else if (line_str.startsWith('ITEM-CODE')) {
                const code = line_str.substring(line_str.indexOf('ITEM-CODE')+9).trim().replace(/'/g,'');
                if (currentComponent) currentComponent.itemCode = code;
                else if (currentLine) currentLine.tag = code;
            }
            else if (line_str.startsWith('MATERIAL')) {
                const mat = parts[1] ? parts[1].replace(/'/g,'') : '';
                if (currentComponent) currentComponent.material = mat;
                else if (currentLine) currentLine.material = mat;
            }
            else if (line_str.startsWith('DIAMETER')) {
                if (currentComponent) currentComponent.diameter = parseFloat(parts[1]);
            }
            else if (line_str.startsWith('PIPING-SPEC')) {
                const spec = parts.slice(1).join(' ').replace(/'/g,'');
                if (currentLine) currentLine.spec = spec;
            }
            else if (line_str.startsWith('ITEM-DESCRIPTION')) {
                const desc = parts.slice(1).join(' ').replace(/'/g,'');
                if (currentComponent) currentComponent.description = desc;
            }
        }
        
        processComponent();
        finalizeLine();
        
        if (_core && typeof _core.rebuildIndexes === 'function') _core.rebuildIndexes();
        if (_core && typeof _core.syncPhysicalData === 'function') _core.syncPhysicalData();
        
        const stats = { equipos: equiposMap.size, lineas: lineasMap.size };
        notify('✅ PCF importado: ' + stats.equipos + ' equipos, ' + stats.lineas + ' lineas', false);
        return stats;
    }
    
    function uploadAndImportPCF(runFittingFn) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pcf,.txt,.idf';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) { importPCFContent(ev.target.result, runFittingFn); };
            reader.onerror = function() { notify('❌ Error al leer el archivo', true); };
            reader.readAsText(file);
        };
        input.click();
    }
    
    // ================================================================
    //  SECCIÓN 3: EXPORTACIÓN MTO (CSV)
    // ================================================================
    
    function exportMTOToCSV() {
        if (!_core) { notify('Error: Core no inicializado', true); return ''; }
        const lines = _core.getLines();
        if (lines.length === 0) { notify('No hay lineas para generar MTO', true); return ''; }
        
        const rows = [];
        rows.push('"LINEA","ITEM","CANTIDAD","UM","DESCRIPCION","SPEC","MATERIAL","NORMA","CONEXION","JUNTAS_EST"');
        
        for (let l = 0; l < lines.length; l++) {
            const line = lines[l];
            if (typeof _core.getSpoolReport !== 'function') continue;
            const spool = _core.getSpoolReport(line.tag);
            if (!spool || !spool.bomItems) continue;
            for (let i = 0; i < spool.bomItems.length; i++) {
                const item = spool.bomItems[i];
                rows.push([
                    '"' + line.tag + '"',
                    item.item,
                    item.qty,
                    '"' + item.unit + '"',
                    '"' + item.desc + '"',
                    '"' + (line.spec||'STD') + '"',
                    '"' + (line.material||'N/D') + '"',
                    '"' + (spool.fittingNorm||'N/A') + '"',
                    '"' + (spool.connectionType||'N/A') + '"',
                    spool.juntasEstimadas || 0
                ].join(','));
            }
        }
        return rows.join('\n');
    }
    
    function downloadMTO(filename) {
        const csv = exportMTOToCSV();
        if (!csv) return;
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'MTO_' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('📊 MTO exportado: ' + a.download, false);
    }
    
    // ================================================================
    //  SECCIÓN 4: EXPORTACIÓN/IMPORTACIÓN JSON
    // ================================================================
    
    function exportProjectJSON() {
        if (!_core) { notify('Error: Core no inicializado', true); return '{}'; }
        if (typeof _core.exportProject === 'function') return _core.exportProject();
        const db = _core.getDb();
        return JSON.stringify({
            equipos: db.equipos || [],
            lines: db.lines || [],
            projectName: db.projectName || window.currentProjectName || 'Sin nombre',
            exportDate: new Date().toISOString(),
            version: '1.0'
        }, null, 2);
    }
    
    function downloadJSON(filename) {
        const json = exportProjectJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'SMARTFLOW_' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('📁 Proyecto exportado: ' + a.download, false);
    }
    
    function uploadAndImportJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const state = JSON.parse(ev.target.result);
                    if (!_core) { notify('Error: Core no inicializado', true); return; }
                    if (typeof _core.importState === 'function') {
                        _core.importState(state);
                        notify('✅ Proyecto importado desde ' + file.name, false);
                    } else {
                        notify('❌ Funcion importState no disponible', true);
                    }
                } catch(err) {
                    notify('❌ Error al importar JSON: ' + err.message, true);
                }
            };
            reader.onerror = function() { notify('❌ Error al leer el archivo', true); };
            reader.readAsText(file);
        };
        input.click();
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, notifyFn) {
        _core = coreInstance;
        _notifyFn = notifyFn || null;
        console.log('SmartFlowIO v1.0 inicializado | Core: ' + (_core ? '✅' : '❌'));
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        SKEY_TO_INTERNAL: SKEY_TO_INTERNAL,
        INTERNAL_TO_SKEY: INTERNAL_TO_SKEY,
        exportLineToPCF: exportLineToPCF,
        exportAllToPCF: exportAllToPCF,
        downloadPCF: downloadPCF,
        importPCFContent: importPCFContent,
        uploadAndImportPCF: uploadAndImportPCF,
        exportMTOToCSV: exportMTOToCSV,
        downloadMTO: downloadMTO,
        exportProjectJSON: exportProjectJSON,
        downloadJSON: downloadJSON,
        uploadAndImportJSON: uploadAndImportJSON,
        getLinePoints: getLinePoints,
        getNozzleWorldPosition: getNozzleWorldPosition,
        getParametricPoint: getParametricPoint
    };
})();
