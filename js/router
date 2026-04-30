
// ============================================================
// SMARTFLOW ROUTER v6.1 (Volumetric Generator + Ortogonal Routing)
// Archivo: js/router.js
// ============================================================

const SmartFlowRouter = (function() {
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    
    // Configuración de tubería
    const _config = {
        segments: 12,           // segmentos circulares del tubo
        defaultRadiusMM: 50,    // radio por defecto (mm) – se recalcula según diámetro
        elbowRadiusFactor: 1.5  // radio de curvatura del codo (veces diámetro)
    };
    
    // --- Helper: distancia euclidiana ---
    const _dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    
    // --- Helper: clonar punto ---
    const _clonePoint = (p) => ({ x: p.x, y: p.y, z: p.z });
    
    // ==================== 1. CREACIÓN DE MALLA VOLUMÉTRICA ====================
    function createLineMesh(lineData) {
        // Obtener puntos desde lineData (puede estar en 'points' o '_cachedPoints')
        const points = lineData.points || lineData._cachedPoints;
        if (!points || points.length < 2) {
            console.warn("Router: línea sin puntos suficientes", lineData.tag);
            return new THREE.Group();
        }
        
        // Convertir a Vector3
        const vectors = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        
        // Determinar radio del tubo (diámetro en pulgadas -> mm / 2)
        let diamMM = (parseFloat(lineData.diameter) || 4) * 25.4;
        const radius = Math.max(5, diamMM / 2);
        
        // Crear curva suave pero que pasa exactamente por los puntos (tensión 0)
        const curve = new THREE.CatmullRomCurve3(vectors);
        curve.curveType = 'catmullrom';
        curve.tension = 0;          // 0 = pasa exactamente por los puntos
        curve.closed = false;
        
        // Segmentos a lo largo del tubo (al menos 32, o más si hay muchos puntos)
        const tubularSegments = Math.max(32, vectors.length * 8);
        const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, _config.segments, false);
        
        // Color según especificación o material
        let color = 0x71717a; // gris por defecto
        if (lineData.spec && _catalog && _catalog.getSpec) {
            const spec = _catalog.getSpec(lineData.spec);
            if (spec && spec.color) color = spec.color;
        } else if (lineData.material) {
            const mat = lineData.material.toUpperCase();
            if (mat.includes('PPR')) color = 0x7c3aed;
            else if (mat.includes('ACERO')) color = 0x94a3b8;
            else if (mat.includes('HDPE')) color = 0x22c55e;
            else if (mat.includes('PVC')) color = 0xeab308;
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.7,
            roughness: 0.3,
            emissive: 0x000000
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { tag: lineData.tag, type: 'line', diameter: lineData.diameter };
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        return mesh;
    }
    
    // ==================== 2. ENRUTAMIENTO ORTOGONAL ====================
    /**
     * Calcula una ruta ortogonal entre dos puntos, respetando el orden de ejes prioritario.
     * Por defecto prioriza X, luego Z, luego Y (horizontal primero, vertical al final).
     */
    function calculateRoute(start, end, axisPriority = ['x', 'z', 'y']) {
        const points = [];
        points.push(_clonePoint(start));
        let current = _clonePoint(start);
        
        for (const axis of axisPriority) {
            if (Math.abs(current[axis] - end[axis]) > 0.1) {
                current[axis] = end[axis];
                points.push(_clonePoint(current));
            }
        }
        
        // Eliminar puntos duplicados consecutivos (misma posición)
        const unique = [];
        for (let i = 0; i < points.length; i++) {
            if (i === 0 || _dist(points[i], points[i-1]) > 1) {
                unique.push(points[i]);
            }
        }
        return unique;
    }
    
    // ==================== 3. OBTENER POSICIÓN DE NOZZLE ====================
    function getNozzlePosition(equipTag, portId) {
        if (!_core) return null;
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === equipTag);
        if (!eq || !eq.puertos) return null;
        const port = eq.puertos.find(p => p.id === portId);
        if (!port) return null;
        
        return {
            x: eq.posX + (port.relX || 0),
            y: eq.posY + (port.relY || 0),
            z: eq.posZ + (port.relZ || 0)
        };
    }
    
    // ==================== 4. DIRECCIÓN DE PUERTO (para codos) ====================
    function getPortDirection(equipTag, portId) {
        if (!_core) return { dx: 1, dy: 0, dz: 0 };
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === equipTag);
        if (!eq || !eq.puertos) return { dx: 1, dy: 0, dz: 0 };
        const port = eq.puertos.find(p => p.id === portId);
        if (port && port.orientacion) return port.orientacion;
        return { dx: 1, dy: 0, dz: 0 };
    }
    
    // ==================== 5. INSERCIÓN DE ACCESORIOS EN LÍNEA ====================
    /**
     * Inserta un accesorio (Tee o reductor) en una línea existente en un punto dado.
     * Retorna el ID del puerto virtual creado en la línea para conectar una derivación.
     */
    function insertarAccesorioEnLinea(lineTag, puntoConexion, diametroNuevaLinea, forzarTee = false) {
        if (!_core) {
            _notifyUI("Router: Core no disponible", true);
            return null;
        }
        const db = _core.getDb();
        const line = db.lines.find(l => l.tag === lineTag);
        if (!line) {
            _notifyUI(`Router: Línea ${lineTag} no encontrada`, true);
            return null;
        }
        
        let points = line.points || line._cachedPoints;
        if (!points || points.length < 2) {
            _notifyUI(`Router: Línea ${lineTag} sin geometría`, true);
            return null;
        }
        
        // Encontrar el segmento más cercano al punto de conexión e insertar el punto
        let minDist = Infinity;
        let insertIdx = -1;
        let bestProj = null;
        
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i+1];
            const abx = b.x - a.x;
            const aby = b.y - a.y;
            const abz = b.z - a.z;
            const len2 = abx*abx + aby*aby + abz*abz;
            if (len2 === 0) continue;
            
            const t = ((puntoConexion.x - a.x)*abx + (puntoConexion.y - a.y)*aby + (puntoConexion.z - a.z)*abz) / len2;
            if (t >= 0 && t <= 1) {
                const proj = {
                    x: a.x + t * abx,
                    y: a.y + t * aby,
                    z: a.z + t * abz
                };
                const d = _dist(puntoConexion, proj);
                if (d < minDist) {
                    minDist = d;
                    insertIdx = i + 1;
                    bestProj = proj;
                }
            }
        }
        
        if (insertIdx === -1 || !bestProj) {
            _notifyUI(`Router: No se pudo insertar accesorio en ${lineTag} - punto fuera de la línea`, true);
            return null;
        }
        
        // Insertar el punto en la línea
        points.splice(insertIdx, 0, bestProj);
        
        // Determinar tipo de accesorio
        const diamLinea = line.diameter || 4;
        const diffDiam = Math.abs(diametroNuevaLinea - diamLinea) > 0.1;
        const esExtremo = (insertIdx === 0 || insertIdx === points.length - 1);
        const tipoAccesorio = (forzarTee || (!esExtremo && diffDiam)) ? 'TEE_REDUCING' : (esExtremo && diffDiam) ? 'CONCENTRIC_REDUCER' : 'TEE_EQUAL';
        
        // Buscar el componente en el catálogo
        let compEnCatalogo = null;
        if (_catalog) {
            const allTypes = _catalog.listComponentTypes();
            if (tipoAccesorio === 'TEE_EQUAL') {
                compEnCatalogo = allTypes.find(t => t.includes('TEE_EQUAL') && !t.includes('REDUCING')) || 'TEE_EQUAL_CS';
            } else if (tipoAccesorio === 'TEE_REDUCING') {
                compEnCatalogo = allTypes.find(t => t.includes('TEE_REDUCING')) || 'TEE_REDUCING_CS';
            } else {
                compEnCatalogo = allTypes.find(t => t.includes('CONCENTRIC_REDUCER')) || 'CONCENTRIC_REDUCER_CS';
            }
        }
        if (!compEnCatalogo) {
            _notifyUI(`Router: No se encontró componente ${tipoAccesorio} en el catálogo`, true);
            return null;
        }
        
        // Registrar el componente en la línea
        const param = insertIdx / (points.length - 1);
        const compTag = `${compEnCatalogo}-${Date.now()}`;
        line.components = line.components || [];
        line.components.push({
            type: compEnCatalogo,
            tag: compTag,
            param: param,
            description: `${tipoAccesorio} insertado en ${lineTag}`
        });
        
        // Crear puerto virtual en la línea para conectar derivación
        const puertoId = `ACC-${compTag}`;
        const refPoint = points[0] || { x: 0, y: 0, z: 0 };
        line.puertos = line.puertos || [];
        line.puertos.push({
            id: puertoId,
            label: 'Derivación',
            relX: bestProj.x - refPoint.x,
            relY: bestProj.y - refPoint.y,
            relZ: bestProj.z - refPoint.z,
            diametro: diametroNuevaLinea,
            status: 'open',
            orientacion: { dx: 0, dy: 1, dz: 0 } // dirección por defecto
        });
        
        // Actualizar la línea en el Core (regenerará la malla)
        _core.updateLine(lineTag, { points: points, _cachedPoints: points, components: line.components, puertos: line.puertos });
        
        _notifyUI(`✅ Accesorio ${tipoAccesorio} (${compEnCatalogo}) insertado en ${lineTag}`, false);
        return puertoId;
    }
    
    // ==================== 6. ENRUTAMIENTO ENTRE PUERTOS (COMANDO ROUTE) ====================
    function routeBetweenPorts(fromEquipTag, fromPortId, toEquipTag, toPortId, diameter = 4, material = 'PPR', spec = 'PPR_PN12_5') {
        if (!_core) {
            _notifyUI("Router: Core no inicializado", true);
            return null;
        }
        
        const startPos = getNozzlePosition(fromEquipTag, fromPortId);
        const endPos = getNozzlePosition(toEquipTag, toPortId);
        if (!startPos || !endPos) {
            _notifyUI("Router: No se pudieron obtener las posiciones de los puertos", true);
            return null;
        }
        
        // Calcular ruta ortogonal (prioridad X, Z, Y para tuberías horizontales primero)
        const points = calculateRoute(startPos, endPos, ['x', 'z', 'y']);
        
        // Generar tag único
        const db = _core.getDb();
        const tag = `L-${db.lines.length + 1}`;
        
        const newLine = {
            tag: tag,
            diameter: diameter,
            material: material,
            spec: spec,
            points: points,
            _cachedPoints: points,
            waypoints: points.slice(1, -1),
            origin: { objType: 'equipment', equipTag: fromEquipTag, portId: fromPortId },
            destination: { objType: 'equipment', equipTag: toEquipTag, portId: toPortId },
            components: []
        };
        
        // Añadir la línea al Core (esto generará la malla visual)
        _core.addLine(newLine);
        
        // Marcar puertos como conectados
        const fromEq = db.equipos.find(e => e.tag === fromEquipTag);
        if (fromEq) {
            const port = fromEq.puertos.find(p => p.id === fromPortId);
            if (port) port.connectedLine = tag;
        }
        const toEq = db.equipos.find(e => e.tag === toEquipTag);
        if (toEq) {
            const port = toEq.puertos.find(p => p.id === toPortId);
            if (port) port.connectedLine = tag;
        }
        
        _notifyUI(`✅ Ruta creada: ${tag} (${fromEquipTag}.${fromPortId} → ${toEquipTag}.${toPortId})`, false);
        return newLine;
    }
    
    // ==================== 7. DETECCIÓN DE INTERSECCIONES (placeholder) ====================
    function procesarInterseccionesDeLinea(nuevaLinea) {
        // En versión futura: buscar líneas existentes que crucen y crear conexiones automáticas
        _notifyUI(`Intersecciones de ${nuevaLinea.tag} procesadas (pendiente implementación completa)`, false);
    }
    
    // ==================== 8. OBTENER COMPONENTE CODO SEGÚN MATERIAL ====================
    function findElbowForLine(material, diameter, angleDeg) {
        const mat = material.toUpperCase();
        const is90 = Math.abs(angleDeg - 90) < 15;
        const is45 = Math.abs(angleDeg - 45) < 15;
        if (!is90 && !is45) return null;
        
        if (!_catalog) return null;
        const allTypes = _catalog.listComponentTypes();
        
        if (mat.includes('PPR')) {
            const target = is90 ? 'ELBOW_90_PPR' : 'ELBOW_45_PPR';
            return allTypes.includes(target) ? target : null;
        } else if (mat.includes('HDPE')) {
            return is90 ? (allTypes.includes('ELBOW_90_HDPE') ? 'ELBOW_90_HDPE' : null) : null;
        } else if (mat.includes('PVC')) {
            return is90 ? (allTypes.includes('ELBOW_90_PVC') ? 'ELBOW_90_PVC' : null) : null;
        } else if (mat.includes('ACERO') || mat.includes('INOX')) {
            return is90 ? (allTypes.includes('ELBOW_90_LR_CS') ? 'ELBOW_90_LR_CS' : null) : (allTypes.includes('ELBOW_45_CS') ? 'ELBOW_45_CS' : null);
        }
        return is90 ? (allTypes.includes('ELBOW_90_LR_CS') ? 'ELBOW_90_LR_CS' : null) : null;
    }
    
    // ==================== 9. INICIALIZACIÓN ====================
    function init(coreInstance, catalogInstance, notifyFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        if (notifyFn) _notifyUI = notifyFn;
        console.log("✔ SmartFlowRouter v6.1 inicializado (Volumetric Generator)");
    }
    
    // API pública
    return {
        init,
        createLineMesh,
        calculateRoute,
        getNozzlePosition,
        getPortDirection,
        routeBetweenPorts,
        insertarAccesorioEnLinea,
        procesarInterseccionesDeLinea,
        findElbowForLine
    };
})();
