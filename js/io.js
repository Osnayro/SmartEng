
// ============================================================
// MÓDULO: SMARTFLOW IO v1.0 (Importación/Exportación profesional)
// Archivo: js/io.js
// Dependencias: Core, Catalog, Router (para geometrías)
// ============================================================

const SmartFlowIO = (function() {
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    
    // ------------------------------------------------------------
    // 1. MAPEO DE TIPOS PCF -> INTERNOS (extendido desde commands.js)
    // ------------------------------------------------------------
    const skeyToInternal = {
        // Equipos
        'TANK': { type: 'equipment', internal: 'tanque_v' },
        'PUMP': { type: 'equipment', internal: 'bomba' },
        'VESS': { type: 'equipment', internal: 'tanque_v' },
        'COMPRESSOR': { type: 'equipment', internal: 'compresor' },
        'HEAT_EXCHANGER': { type: 'equipment', internal: 'intercambiador' },
        // Tuberías
        'STRA': { type: 'pipe', internal: 'PIPE' },
        // Válvulas
        'VALV': { type: 'component', internal: 'GATE_VALVE' },
        'VAGF': { type: 'component', internal: 'GATE_VALVE' },
        'VGLF': { type: 'component', internal: 'GLOBE_VALVE' },
        'VBAL': { type: 'component', internal: 'BALL_VALVE' },
        'VBAF': { type: 'component', internal: 'BUTTERFLY_VALVE' },
        'VCFF': { type: 'component', internal: 'CHECK_VALVE' },
        'VDIA': { type: 'component', internal: 'DIAPHRAGM_VALVE' },
        'VCON': { type: 'component', internal: 'CONTROL_VALVE' },
        'VPRV': { type: 'component', internal: 'PRESSURE_RELIEF_VALVE' },
        'VSFT': { type: 'component', internal: 'SAFETY_VALVE' },
        // Codos
        'ELBW': { type: 'component', internal: 'ELBOW_90_LR_CS' },
        'ELL4': { type: 'component', internal: 'ELBOW_45_CS' },
        'ELLL': { type: 'component', internal: 'ELBOW_90_LR_CS' },
        'ELLS': { type: 'component', internal: 'ELBOW_90_SR_CS' },
        // Tees y cruces
        'TEES': { type: 'component', internal: 'TEE_EQUAL' },
        'TEER': { type: 'component', internal: 'TEE_REDUCING' },
        'CROS': { type: 'component', internal: 'CROSS' },
        // Reductores
        'RECN': { type: 'component', internal: 'CONCENTRIC_REDUCER' },
        'REEC': { type: 'component', internal: 'ECCENTRIC_REDUCER' },
        // Bridas
        'FLWN': { type: 'component', internal: 'WELD_NECK_FLANGE' },
        'FLSO': { type: 'component', internal: 'SLIP_ON_FLANGE' },
        'FLBL': { type: 'component', internal: 'BLIND_FLANGE' },
        'FLLJ': { type: 'component', internal: 'LAP_JOINT_FLANGE' },
        // Tapas
        'CAPF': { type: 'component', internal: 'CAP' },
        // Instrumentos
        'INPG': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INTG': { type: 'component', internal: 'TEMPERATURE_GAUGE' },
        'INFM': { type: 'component', internal: 'FLOW_METER' },
        'INLV': { type: 'component', internal: 'LEVEL_SWITCH_RANA' },
        'INPT': { type: 'component', internal: 'PRESSURE_TRANSMITTER' },
        'INTT': { type: 'component', internal: 'TEMPERATURE_TRANSMITTER' },
        // Otros
        'STRY': { type: 'component', internal: 'Y_STRAINER' },
        'TRAP': { type: 'component', internal: 'STEAM_TRAP' },
        'UNIO': { type: 'component', internal: 'UNION' },
        'BULK': { type: 'component', internal: 'BULKHEAD' }
    };
    
    // Mapeo inverso para exportación PCF (componente interno -> clave PCF)
    const internalToSkey = {};
    for (let [skey, val] of Object.entries(skeyToInternal)) {
        if (val.type === 'component') internalToSkey[val.internal] = skey;
    }
    // Añadir algunos comunes
    internalToSkey['ELBOW_90_LR_CS'] = 'ELBW';
    internalToSkey['ELBOW_45_CS'] = 'ELL4';
    internalToSkey['CONCENTRIC_REDUCER'] = 'REDC';
    internalToSkey['ECCENTRIC_REDUCER'] = 'REDE';
    
    // ------------------------------------------------------------
    // 2. CALCULAR POSICIÓN DE COMPONENTE EN LÍNEA (para exportación PCF)
    // ------------------------------------------------------------
    function calculateComponentPosition(line, param) {
        const pts = line.points || line._cachedPoints;
        if (!pts || pts.length < 2) return null;
        let totalLen = 0, lengths = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d);
            totalLen += d;
        }
        if (totalLen === 0) return null;
        const targetLen = totalLen * Math.min(1, Math.max(0, param));
        let accum = 0, segIdx = 0, t = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (accum + lengths[i] >= targetLen || i === lengths.length - 1) {
                segIdx = i;
                t = (targetLen - accum) / (lengths[i] || 1);
                break;
            }
            accum += lengths[i];
        }
        const p1 = pts[segIdx], p2 = pts[segIdx + 1];
        const punto = {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
            z: p1.z + (p2.z - p1.z) * t
        };
        // Para PCF se necesita un segmento de longitud cero, pero con posición
        return { p1: punto, p2: punto };
    }
    
    // ------------------------------------------------------------
    // 3. EXPORTACIÓN PCF (ISOGEN COMPLETO)
    // ------------------------------------------------------------
    function exportPCF() {
        const db = _core.getDb();
        const lines = db.lines || [];
        const equipos = db.equipos || [];
        if (lines.length === 0 && equipos.length === 0) {
            _notifyUI("No hay elementos para exportar.", true);
            return;
        }
        
        let pcfContent = "";
        const projectName = window.currentProjectName || 'SmartFlow_Project';
        const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
        
        // Cabecera ISOGEN
        pcfContent += `ISOGEN-FILES PCF.STYLE\n`;
        pcfContent += `UNITS-BORMM             MM\n`;
        pcfContent += `UNITS-COOR              MM\n`;
        pcfContent += `PROJECT-IDENTIFIER      ${projectName}\n`;
        pcfContent += `ATTRIBUTE1              SMARTFLOW_3D\n`;
        pcfContent += `ATTRIBUTE2              ${timestamp}\n`;
        pcfContent += `END-POSITION-CHECK      OFF\n\n`;
        
        // ---- NOZZLES (equipos) ----
        equipos.forEach(eq => {
            if (!eq.puertos) return;
            eq.puertos.forEach(port => {
                const pos = {
                    x: eq.posX + (port.relX || 0),
                    y: eq.posY + (port.relY || 0),
                    z: eq.posZ + (port.relZ || 0)
                };
                const dir = port.orientacion || { dx: 0, dy: 0, dz: 1 };
                const diamMM = (port.diametro || eq.diametro || 4) * 25.4;
                pcfContent += `NOZZLE\n`;
                pcfContent += `    COMPONENT-IDENTIFIER ${eq.tag}-${port.id}\n`;
                pcfContent += `    END-POINT           ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}  ${diamMM.toFixed(2)}\n`;
                pcfContent += `    DIRECTION           ${dir.dx.toFixed(3)} ${dir.dy.toFixed(3)} ${dir.dz.toFixed(3)}\n`;
                pcfContent += `    SKEY                NOZZ\n`;
                pcfContent += `    ITEM-DESCRIPTION    Boquilla ${port.id}\n\n`;
            });
        });
        
        // ---- LÍNEAS Y COMPONENTES ----
        lines.forEach(line => {
            const pts = line.points || line._cachedPoints;
            if (!pts || pts.length < 2) return;
            const diamMM = (line.diameter || 4) * 25.4;
            
            pcfContent += `PIPELINE-REFERENCE      ${line.tag}\n`;
            pcfContent += `REVISION                ${line.revision || '0'}\n`;
            pcfContent += `PROJECT-IDENTIFIER      ${projectName}\n`;
            pcfContent += `ATTRIBUTE1              ${line.service || 'PROCESS'}\n`;
            pcfContent += `ATTRIBUTE2              ${line.spec || 'UNSPECIFIED'}\n\n`;
            
            // Segmentos de tubería
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i], p2 = pts[i+1];
                const dirVec = { dx: p2.x - p1.x, dy: p2.y - p1.y, dz: p2.z - p1.z };
                const len = Math.hypot(dirVec.dx, dirVec.dy, dirVec.dz) || 1;
                const dir = { dx: dirVec.dx/len, dy: dirVec.dy/len, dz: dirVec.dz/len };
                
                pcfContent += `PIPE\n`;
                pcfContent += `    END-POINT           ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${p1.z.toFixed(2)}  ${diamMM.toFixed(2)}\n`;
                pcfContent += `    END-POINT           ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} ${p2.z.toFixed(2)}  ${diamMM.toFixed(2)}\n`;
                pcfContent += `    ENTRY               ${dir.dx.toFixed(3)} ${dir.dy.toFixed(3)} ${dir.dz.toFixed(3)}\n`;
                pcfContent += `    EXIT                ${dir.dx.toFixed(3)} ${dir.dy.toFixed(3)} ${dir.dz.toFixed(3)}\n`;
                pcfContent += `    ITEM-CODE           PIPE-${line.material || 'PPR'}-${line.diameter}IN\n`;
                pcfContent += `    SKEY                PIPE\n`;
                pcfContent += `    FABRICATION-ITEM\n\n`;
            }
            
            // Componentes
            if (line.components && line.components.length) {
                line.components.forEach(comp => {
                    const pos = calculateComponentPosition(line, comp.param || 0.5);
                    if (!pos) return;
                    const skey = internalToSkey[comp.type] || 'MISC';
                    pcfContent += `${comp.type}\n`;
                    pcfContent += `    END-POINT           ${pos.p1.x.toFixed(2)} ${pos.p1.y.toFixed(2)} ${pos.p1.z.toFixed(2)}  ${diamMM.toFixed(2)}\n`;
                    pcfContent += `    END-POINT           ${pos.p2.x.toFixed(2)} ${pos.p2.y.toFixed(2)} ${pos.p2.z.toFixed(2)}  ${diamMM.toFixed(2)}\n`;
                    pcfContent += `    SKEY                ${skey}\n`;
                    pcfContent += `    ITEM-CODE           ${comp.tag || comp.type}\n`;
                    pcfContent += `    ITEM-DESCRIPTION    ${comp.type}\n`;
                    pcfContent += `    FABRICATION-ITEM\n\n`;
                });
            }
            pcfContent += `\n`;
        });
        
        const blob = new Blob([pcfContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}_PCF_${timestamp}.pcf`;
        a.click();
        URL.revokeObjectURL(url);
        _notifyUI(`PCF exportado con ${lines.length} líneas y ${equipos.length} equipos.`, false);
    }
    
    // ------------------------------------------------------------
    // 4. EXPORTACIÓN PDF (captura de pantalla 3D + metadatos)
    // ------------------------------------------------------------
    function exportPDF() {
        const canvas = document.querySelector('#canvas-container canvas');
        if (!canvas || typeof jspdf === 'undefined') {
            _notifyUI("No se pudo generar PDF: canvas o jsPDF no disponible.", true);
            return;
        }
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        try {
            const imgData = canvas.toDataURL('image/png', 1.0);
            doc.addImage(imgData, 'PNG', 10, 10, 277, 150);
            doc.setFontSize(16);
            doc.text("SmartFlow 3D - Reporte Isométrico", 10, 175);
            doc.text(`Proyecto: ${window.currentProjectName || 'SmartFlow'}`, 10, 185);
            doc.text(`Fecha: ${new Date().toLocaleString()}`, 10, 195);
            doc.text("AcQuaBlue International Corp.", 10, 205);
            doc.save(`${window.currentProjectName || 'Proyecto'}_3D_${Date.now()}.pdf`);
            _notifyUI("PDF generado correctamente.", false);
        } catch(e) {
            _notifyUI("Error al generar PDF: " + e.message, true);
        }
    }
    
    // ------------------------------------------------------------
    // 5. EXPORTACIÓN MTO (Lista de Materiales) - versión completa
    // ------------------------------------------------------------
    function exportMTO() {
        const db = _core.getDb();
        const lines = db.lines || [];
        const equipos = db.equipos || [];
        let items = [];
        
        // Equipos
        equipos.forEach(eq => {
            items.push({
                tipo: 'EQUIPO',
                tag: eq.tag,
                descripcion: `${eq.tipo} ${eq.material || ''} ${eq.spec || ''}`,
                cantidad: 1,
                unidad: 'Und'
            });
        });
        
        // Tuberías (cálculo de longitud real en metros)
        const pipeMap = new Map(); // key: diámetro-material-spec
        lines.forEach(line => {
            const pts = line.points || line._cachedPoints;
            if (!pts || pts.length < 2) return;
            let lengthMM = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                lengthMM += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            }
            const lengthM = lengthMM / 1000;
            const key = `${line.diameter}"-${line.material || 'PPR'}-${line.spec || 'STD'}`;
            if (pipeMap.has(key)) pipeMap.get(key).length += lengthM;
            else pipeMap.set(key, {
                diametro: line.diameter,
                material: line.material || 'PPR',
                spec: line.spec || 'STD',
                length: lengthM
            });
        });
        for (let [key, data] of pipeMap.entries()) {
            items.push({
                tipo: 'TUBERIA',
                tag: '',
                descripcion: `Tubo ${data.material} ${data.diametro}" ${data.spec}`,
                cantidad: data.length.toFixed(2),
                unidad: 'm'
            });
        }
        
        // Componentes
        const compMap = new Map();
        lines.forEach(line => {
            if (line.components) {
                line.components.forEach(comp => {
                    const key = `${comp.type}-${line.diameter}"`;
                    compMap.set(key, (compMap.get(key) || 0) + 1);
                });
            }
        });
        for (let [key, count] of compMap.entries()) {
            const [type, diam] = key.split('-');
            items.push({
                tipo: 'COMPONENTE',
                tag: '',
                descripcion: `${type} ${diam}`,
                cantidad: count,
                unidad: 'Und'
            });
        }
        
        if (items.length === 0) {
            _notifyUI("No hay elementos para exportar.", true);
            return;
        }
        
        // Convertir a CSV o XLSX (usamos XLSX si está disponible)
        const wsData = [["Tipo", "Tag", "Descripción", "Cantidad", "Unidad"]];
        items.forEach(item => {
            wsData.push([item.tipo, item.tag, item.descripcion, item.cantidad, item.unidad]);
        });
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, `MTO_${window.currentProjectName || 'Proyecto'}_${Date.now()}.xlsx`);
        _notifyUI(`MTO exportado con ${items.length} ítems.`, false);
    }
    
    // ------------------------------------------------------------
    // 6. IMPORTACIÓN PCF (completa, con mapeo extenso)
    // ------------------------------------------------------------
    function importPCF(fileContent) {
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
                            material: currentComponent.material || 'CS'
                        });
                        if (equipo) {
                            equiposMap.set(tag, equipo);
                            _core.addEquipment(equipo);
                        }
                    }
                } else if (mapping.type === 'component' && currentLine) {
                    componentes.push({
                        type: mapping.internal,
                        tag: currentComponent.itemCode || `${mapping.internal}_${componentes.length + 1}`,
                        param: 0.5,
                        description: currentComponent.description,
                        material: currentComponent.material,
                        diameter: currentComponent.diameter
                    });
                }
            }
            currentComponent = null;
        }
        
        function finalizeLine() {
            if (currentLine && puntos.length >= 2) {
                if (!currentLine.tag) currentLine.tag = `L-${(lineasMap.size + 1)}`;
                currentLine.points = puntos;
                currentLine._cachedPoints = puntos;
                currentLine.components = componentes;
                _core.addLine(currentLine);
                lineasMap.set(currentLine.tag, currentLine);
            }
            currentLine = null;
            puntos = [];
            componentes = [];
        }
        
        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('!') || line.length === 0) continue;
            const parts = line.split(/\s+/);
            const firstWord = parts[0];
            const newBlockWords = ['PIPE', 'VALVE', 'TEE', 'TANK', 'PUMP', 'INSTRUMENT', 'ELBOW', 'FLANGE', 'STRA', 'REDUCER', 'CAP', 'CROSS'];
            if (newBlockWords.includes(firstWord)) {
                processAccumulatedComponent();
                if (firstWord === 'PIPE' || firstWord === 'STRA') {
                    finalizeLine();
                    currentLine = {
                        tag: '',
                        diameter: 4,
                        material: 'PPR',
                        spec: 'PPR_PN12_5',
                        points: [],
                        components: []
                    };
                    puntos = [];
                    componentes = [];
                } else {
                    currentComponent = { type: firstWord };
                }
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
                    if (currentComponent && !currentComponent.pos) currentComponent.pos = p1;
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
            } else if (line.startsWith('HEIGHT') && currentComponent) {
                currentComponent.height = parseFloat(parts[1]);
            } else if (line.startsWith('DIAMETER') && currentComponent) {
                currentComponent.diameter = parseFloat(parts[1]);
            } else if (line.startsWith('PIPING-SPEC')) {
                const spec = parts.slice(1).join(' ').replace(/'/g, '');
                if (currentLine) currentLine.spec = spec;
            }
        }
        
        processAccumulatedComponent();
        finalizeLine();
        _core.syncPhysicalData();
        _core._saveState();
        _notifyUI(`✅ PCF importado: ${equiposMap.size} equipos, ${lineasMap.size} líneas.`, false);
    }
    
    // ------------------------------------------------------------
    // 7. INICIALIZACIÓN Y REGISTRO
    // ------------------------------------------------------------
    function init(coreInstance, catalogInstance, notifyFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _notifyUI = notifyFn || console.log;
        console.log("✔ SmartFlowIO v1.0 listo (importación/exportación profesional)");
    }
    
    return {
        init,
        exportPCF,
        exportPDF,
        exportMTO,
        importPCF
    };
})();
```

---

🔧 Integración en main.js

1. Añadir inicialización después de los otros módulos (dentro de initModules):

```javascript
SmartFlowIO.init(SmartFlowCore, SmartFlowCatalog, notify);
```

1. Reemplazar los botones en bindEvents:

```javascript
vincular('btnMTO', () => SmartFlowIO.exportMTO());
vincular('btnPDF', () => SmartFlowIO.exportPDF());
vincular('btnExportPCF', () => SmartFlowIO.exportPCF());
vincular('btnImportPCF', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pcf,.txt';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => SmartFlowIO.importPCF(ev.target.result);
            reader.readAsText(file);
        }
    };
    input.click();
});
