


// SmartFlowIO v1.1 - Corregido
const SmartFlowIO = (function() {
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);

    const skeyToInternal = {
        'TANK': { type: 'equipment', internal: 'tanque_v' },
        'PUMP': { type: 'equipment', internal: 'bomba' },
        'VESS': { type: 'equipment', internal: 'tanque_v' },
        'STRA': { type: 'pipe', internal: 'PIPE' },
        'VALV': { type: 'component', internal: 'GATE_VALVE' },
        'VAGF': { type: 'component', internal: 'GATE_VALVE' },
        'VGLF': { type: 'component', internal: 'GLOBE_VALVE' },
        'VBAL': { type: 'component', internal: 'BALL_VALVE' },
        'VBAF': { type: 'component', internal: 'BUTTERFLY_VALVE' },
        'VCFF': { type: 'component', internal: 'CHECK_VALVE' },
        'ELBW': { type: 'component', internal: 'ELBOW_90_LR_CS' },
        'ELL4': { type: 'component', internal: 'ELBOW_45_CS' },
        'ELLL': { type: 'component', internal: 'ELBOW_90_LR_CS' },
        'ELLS': { type: 'component', internal: 'ELBOW_90_SR_CS' },
        'TEES': { type: 'component', internal: 'TEE_EQUAL' },
        'TEER': { type: 'component', internal: 'TEE_REDUCING' },
        'CROS': { type: 'component', internal: 'CROSS' },
        'FLWN': { type: 'component', internal: 'WELD_NECK_FLANGE' },
        'FLSO': { type: 'component', internal: 'SLIP_ON_FLANGE' },
        'FLBL': { type: 'component', internal: 'BLIND_FLANGE' },
        'CAPF': { type: 'component', internal: 'CAP' },
        'RECN': { type: 'component', internal: 'CONCENTRIC_REDUCER' },
        'REEC': { type: 'component', internal: 'ECCENTRIC_REDUCER' }
    };

    function exportPCF() {
        try {
            const db = _core.getDb();
            const lines = db.lines || [];
            const equipos = db.equipos || [];
            if (lines.length === 0 && equipos.length === 0) {
                _notifyUI("No hay elementos para exportar", true);
                return;
            }
            const proj = window.currentProjectName || 'SmartFlow';
            const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            let pcf = `ISOGEN-FILES PCF.STYLE\n`;
            pcf += `UNITS-BORMM MM\nUNITS-COOR MM\n`;
            pcf += `PROJECT-IDENTIFIER ${proj}\n`;
            pcf += `ATTRIBUTE1 SMARTFLOW_3D\nATTRIBUTE2 ${ts}\nEND-POSITION-CHECK OFF\n\n`;

            equipos.forEach(eq => {
                if (!eq.puertos) return;
                eq.puertos.forEach(port => {
                    const rx = port.relX || 0;
                    const ry = port.relY || 0;
                    const rz = port.relZ || 0;
                    const pos = {
                        x: (eq.posX || 0) + rx,
                        y: (eq.posY || 0) + ry,
                        z: (eq.posZ || 0) + rz
                    };
                    const diam = port.diametro || eq.diametro || 4;
                    const diamMM = (isNaN(diam) ? 101.6 : diam * 25.4).toFixed(2);
                    const dir = port.orientacion || { dx: 0, dy: 0, dz: 1 };
                    pcf += `NOZZLE\n`;
                    pcf += `    COMPONENT-IDENTIFIER ${eq.tag}-${port.id}\n`;
                    pcf += `    END-POINT ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)} ${diamMM}\n`;
                    pcf += `    DIRECTION ${dir.dx.toFixed(3)} ${dir.dy.toFixed(3)} ${dir.dz.toFixed(3)}\n`;
                    pcf += `    SKEY NOZZ\n\n`;
                });
            });

            lines.forEach(line => {
                const pts = line.points || line._cachedPoints;
                if (!pts || pts.length < 2) return;
                const diam = line.diameter || 4;
                const diamMM = (isNaN(diam) ? 101.6 : diam * 25.4).toFixed(2);
                pcf += `PIPELINE-REFERENCE ${line.tag}\n`;
                for (let i = 0; i < pts.length - 1; i++) {
                    const p1 = pts[i], p2 = pts[i + 1];
                    const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
                    const len = Math.hypot(dx, dy, dz) || 1;
                    pcf += `PIPE\n`;
                    pcf += `    END-POINT ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${p1.z.toFixed(2)} ${diamMM}\n`;
                    pcf += `    END-POINT ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} ${p2.z.toFixed(2)} ${diamMM}\n`;
                    pcf += `    ENTRY ${(dx / len).toFixed(3)} ${(dy / len).toFixed(3)} ${(dz / len).toFixed(3)}\n`;
                    pcf += `    EXIT ${(dx / len).toFixed(3)} ${(dy / len).toFixed(3)} ${(dz / len).toFixed(3)}\n`;
                    pcf += `    SKEY PIPE\n\n`;
                }
                if (line.components && line.components.length) {
                    line.components.forEach(comp => {
                        pcf += `${comp.type}\n`;
                        pcf += `    ITEM-CODE ${comp.tag || comp.type}\n`;
                        pcf += `    SKEY MISC\n\n`;
                    });
                }
            });

            const blob = new Blob([pcf], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${proj}_PCF_${ts}.pcf`;
            a.click();
            URL.revokeObjectURL(a.href);
            _notifyUI(`PCF exportado con ${lines.length} líneas y ${equipos.length} equipos`, false);
        } catch (e) {
            _notifyUI("Error al exportar PCF: " + e.message, true);
        }
    }

    function exportPDF() {
        try {
            if (typeof jspdf === 'undefined') {
                _notifyUI("Librería jsPDF no disponible", true);
                return;
            }
            const canvas = document.querySelector('#canvas-container canvas');
            if (!canvas) {
                _notifyUI("Canvas no encontrado", true);
                return;
            }
            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            const img = canvas.toDataURL('image/png', 1.0);
            doc.addImage(img, 'PNG', 10, 10, 277, 150);
            doc.setFontSize(16);
            doc.text("SmartFlow 3D - Reporte Isométrico", 10, 175);
            doc.text(`Proyecto: ${window.currentProjectName || 'SmartFlow'}`, 10, 185);
            doc.text(`Fecha: ${new Date().toLocaleString()}`, 10, 195);
            doc.text("AcQuaBlue International Corp.", 10, 205);
            doc.save(`${window.currentProjectName || 'Proyecto'}_3D_${Date.now()}.pdf`);
            _notifyUI("PDF generado correctamente", false);
        } catch (e) {
            _notifyUI("Error al generar PDF: " + e.message, true);
        }
    }

    function exportMTO() {
        try {
            const db = _core.getDb();
            const equipos = db.equipos || [];
            const lines = db.lines || [];
            let items = [];

            equipos.forEach(eq => {
                items.push({
                    tipo: 'EQUIPO',
                    tag: eq.tag,
                    descripcion: `${eq.tipo} ${eq.material || ''} ${eq.spec || ''}`,
                    cantidad: 1,
                    unidad: 'Und'
                });
            });

            const pipeMap = new Map();
            lines.forEach(line => {
                const pts = line.points || line._cachedPoints;
                if (pts && pts.length >= 2) {
                    let len = 0;
                    for (let i = 0; i < pts.length - 1; i++) {
                        len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y, pts[i + 1].z - pts[i].z);
                    }
                    const key = `${line.diameter || 4}"-${line.material || 'PPR'}-${line.spec || 'STD'}`;
                    if (pipeMap.has(key)) {
                        pipeMap.get(key).length += len;
                    } else {
                        pipeMap.set(key, {
                            diametro: line.diameter || 4,
                            material: line.material || 'PPR',
                            spec: line.spec || 'STD',
                            length: len
                        });
                    }
                }
                if (line.components) {
                    line.components.forEach(comp => {
                        items.push({
                            tipo: 'COMPONENTE',
                            tag: comp.tag || '',
                            descripcion: comp.type || 'Componente',
                            cantidad: 1,
                            unidad: 'Und'
                        });
                    });
                }
            });

            for (let [key, data] of pipeMap.entries()) {
                items.push({
                    tipo: 'TUBERIA',
                    tag: '',
                    descripcion: `Tubo ${data.material} ${data.diametro}" ${data.spec}`,
                    cantidad: (data.length / 1000).toFixed(2),
                    unidad: 'm'
                });
            }

            if (items.length === 0) {
                _notifyUI("No hay elementos para exportar MTO", true);
                return;
            }

            if (typeof XLSX !== 'undefined') {
                const wsData = [["Tipo", "Tag", "Descripción", "Cantidad", "Unidad"]];
                items.forEach(item => {
                    wsData.push([item.tipo, item.tag, item.descripcion, item.cantidad, item.unidad]);
                });
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "MTO");
                XLSX.writeFile(wb, `MTO_${window.currentProjectName || 'Proyecto'}_${Date.now()}.xlsx`);
                _notifyUI(`MTO exportado en Excel con ${items.length} ítems`, false);
            } else {
                let csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
                items.forEach(item => {
                    csv += `${item.tipo},${item.tag},${item.descripcion},${item.cantidad},${item.unidad}\n`;
                });
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `MTO_${window.currentProjectName || 'Proyecto'}_${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(a.href);
                _notifyUI(`MTO exportado en CSV con ${items.length} ítems`, false);
            }
        } catch (e) {
            _notifyUI("Error al exportar MTO: " + e.message, true);
        }
    }

    function importPCF(fileContent) {
        try {
            const lines = fileContent.split('\n');
            let currentLine = null, puntos = [], componentes = [];
            let currentComp = null;
            const equiposMap = new Map();
            const lineasMap = new Map();

            function finalizeComp() {
                if (!currentComp || !currentComp.skey) return;
                const mapping = skeyToInternal[currentComp.skey];
                if (mapping && mapping.type === 'equipment') {
                    const pos = currentComp.pos || { x: 0, y: 0, z: 0 };
                    const tag = currentComp.itemCode || `${mapping.internal}_${equiposMap.size + 1}`;
                    if (!equiposMap.has(tag) && _catalog) {
                        const equipo = _catalog.createEquipment(mapping.internal, tag, pos.x, pos.y, pos.z, {
                            diametro: currentComp.diameter || 1000,
                            altura: currentComp.height || 1500,
                            material: currentComp.material || 'CS'
                        });
                        if (equipo) {
                            equiposMap.set(tag, equipo);
                            _core.addEquipment(equipo);
                        }
                    }
                } else if (mapping && mapping.type === 'component' && currentLine) {
                    componentes.push({
                        type: mapping.internal,
                        tag: currentComp.itemCode || `${mapping.internal}_${componentes.length + 1}`,
                        param: 0.5,
                        description: currentComp.description,
                        material: currentComp.material,
                        diameter: currentComp.diameter
                    });
                }
                currentComp = null;
            }

            function finalizeLine() {
                if (currentLine && puntos.length >= 2) {
                    if (!currentLine.tag) currentLine.tag = `L-${lineasMap.size + 1}`;
                    currentLine._cachedPoints = puntos;
                    currentLine.components = componentes;
                    _core.addLine(currentLine);
                    lineasMap.set(currentLine.tag, currentLine);
                }
                currentLine = null;
                puntos = [];
                componentes = [];
            }

            const blockStarters = ['PIPE', 'VALVE', 'TEE', 'TANK', 'PUMP', 'ELBOW', 'FLANGE', 'STRA', 'REDUCER', 'CAP', 'CROSS'];

            for (let raw of lines) {
                let line = raw.trim();
                if (!line || line.startsWith('!')) continue;
                line = line.replace(/_/g, '-');
                const parts = line.split(/\s+/);
                const first = parts[0].toUpperCase();

                if (blockStarters.includes(first)) {
                    finalizeComp();
                    if (first === 'PIPE' || first === 'STRA') {
                        finalizeLine();
                        currentLine = { tag: '', diameter: 4, material: 'PPR', spec: 'PPR_PN12_5' };
                    } else {
                        currentComp = { type: first };
                    }
                    continue;
                }

                if (line.startsWith('END-POINT') && parts.length >= 7) {
                    const p1 = { x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) };
                    const p2 = { x: parseFloat(parts[4]), y: parseFloat(parts[5]), z: parseFloat(parts[6]) };
                    const diam = parts.length >= 8 ? parseFloat(parts[7]) : null;
                    if (currentLine) {
                        if (puntos.length === 0) puntos.push(p1);
                        puntos.push(p2);
                        if (diam && !currentLine.diameter) currentLine.diameter = diam / 25.4;
                    }
                    if (currentComp && !currentComp.pos) {
                        currentComp.pos = p1;
                        if (diam) currentComp.diameter = diam / 25.4;
                    }
                } else if (line.startsWith('PCF_ELEM_SKEY') || line.startsWith('SKEY')) {
                    const skey = (parts[1] || '').replace(/'/g, '');
                    if (currentComp) currentComp.skey = skey;
                    else if (currentLine) currentLine.skey = skey;
                } else if (line.startsWith('ITEM-CODE') || line.startsWith('ITEM-CODE')) {
                    const code = line.substring(line.indexOf('ITEM-CODE') + 9).trim().replace(/'/g, '');
                    if (currentComp) currentComp.itemCode = code;
                    else if (currentLine) currentLine.tag = code;
                } else if (line.startsWith('MATERIAL')) {
                    const mat = (parts[1] || '').replace(/'/g, '');
                    if (currentComp) currentComp.material = mat;
                    else if (currentLine) currentLine.material = mat;
                } else if (line.startsWith('HEIGHT') && currentComp) {
                    currentComp.height = parseFloat(parts[1]) || 1500;
                } else if (line.startsWith('DIAMETER') && currentComp) {
                    currentComp.diameter = parseFloat(parts[1]) || 1000;
                } else if (line.startsWith('PIPING-SPEC')) {
                    const spec = parts.slice(1).join(' ').replace(/'/g, '');
                    if (currentLine) currentLine.spec = spec;
                }
            }

            finalizeComp();
            finalizeLine();

            _core.syncPhysicalData();
            _core._saveState();
            _notifyUI(`PCF importado: ${equiposMap.size} equipos, ${lineasMap.size} líneas`, false);
        } catch (e) {
            _notifyUI("Error al importar PCF: " + e.message, true);
        }
    }

    function init(coreInstance, catalogInstance, notifyFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _notifyUI = notifyFn || console.log;
        console.log("IO v1.1 corregido listo");
    }

    return {
        init,
        exportPCF,
        exportPDF,
        exportMTO,
        importPCF
    };
})();
