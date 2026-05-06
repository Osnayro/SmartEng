
// ============================================================
// SMARTFLOW LABELS v1.1 - Etiquetas optimizadas para CSS2DRenderer 3D
// Archivo: js/labels.js
// ============================================================

const SmartFlowLabels = (function() {
    let _core = null;
    let _labelRenderer = null;
    let _labelObjects = [];
    let _scene = null;

    function init(core, labelRenderer, scene) {
        _core = core;
        _labelRenderer = labelRenderer;
        _scene = scene;
        console.log('✅ Labels inicializado');
    }

    function crearLabel(texto, posicion, colorHex = '#ffffff', fontSize = '14px', offsetY = 200) {
        if (!_labelRenderer || !_scene) {
            console.warn('⚠️ LabelRenderer o Scene no disponibles');
            return null;
        }

        const div = document.createElement('div');
        div.textContent = texto;
        div.style.cssText = `
            color: ${colorHex};
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: ${fontSize};
            font-weight: 700;
            text-shadow: 0 0 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.9);
            background: rgba(0,0,0,0.6);
            padding: 4px 10px;
            border-radius: 4px;
            border: 1px solid ${colorHex};
            pointer-events: none;
            white-space: nowrap;
            user-select: none;
            letter-spacing: 1px;
            text-transform: uppercase;
        `;

        const label = new THREE.CSS2DObject(div);
        label.position.copy(posicion);
        label.position.y += offsetY;
        label.userData = { texto, colorHex, fontSize, offsetY, type: 'label' };
        
        _scene.add(label);
        _labelObjects.push(label);
        
        return label;
    }

    function crearLabelEquipo(equipo) {
        if (!equipo) return null;
        
        const pos = {
            x: equipo.posX || (equipo.pos?.x || 0),
            y: equipo.posY || (equipo.pos?.y || 0),
            z: equipo.posZ || (equipo.pos?.z || 0)
        };

        const altura = equipo.altura || 1500;
        const offsetY = altura / 2 + 300;
        
        // Color según tipo de equipo
        let color = '#00f2ff'; // cyan por defecto
        if (equipo.tipo?.includes('bomba')) color = '#f59e0b';
        else if (equipo.tipo?.includes('tanque')) color = '#3b82f6';
        else if (equipo.tipo?.includes('torre')) color = '#ef4444';
        else if (equipo.tipo?.includes('reactor')) color = '#8b5cf6';
        else if (equipo.tipo?.includes('intercambiador')) color = '#10b981';

        return crearLabel(equipo.tag, pos, color, '16px', offsetY);
    }

    function crearLabelLinea(linea) {
        if (!linea) return null;
        
        const pts = linea.points || linea._cachedPoints || linea.points3D || [];
        if (pts.length < 2) return null;
        
        // Punto medio de la línea
        const midIdx = Math.floor(pts.length / 2);
        const pos = { x: pts[midIdx].x, y: pts[midIdx].y + 200, z: pts[midIdx].z };
        
        return crearLabel(linea.tag, pos, '#f59e0b', '12px', 0);
    }

    function crearLabelsProyecto() {
        if (!_core) return;
        
        // Limpiar labels existentes
        limpiarLabels();
        
        const db = _core.getDb();
        
        // Labels de equipos
        (db.equipos || []).forEach(eq => {
            crearLabelEquipo(eq);
        });
        
        // Labels de líneas
        (db.lines || []).forEach(line => {
            crearLabelLinea(line);
        });
        
        console.log(`✅ ${_labelObjects.length} labels creadas`);
    }

    function actualizarLabelPosicion(label, nuevaPos, offsetY) {
        if (!label) return;
        label.position.copy(nuevaPos);
        if (offsetY !== undefined) label.position.y += offsetY;
    }

    function limpiarLabels() {
        if (!_scene) return;
        _labelObjects.forEach(label => {
            _scene.remove(label);
            if (label.element) label.element.remove();
        });
        _labelObjects = [];
    }

    function getLabels() {
        return _labelObjects;
    }

    return {
        init,
        crearLabel,
        crearLabelEquipo,
        crearLabelLinea,
        crearLabelsProyecto,
        actualizarLabelPosicion,
        limpiarLabels,
        getLabels
    };
})();
