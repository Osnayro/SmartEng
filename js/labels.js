
// SmartFlowLabels v1.2 - Corregido removeFromParent
const SmartFlowLabels = (function() {
    let _core = null;
    let _scene = null;
    let _labelRenderer = null;
    let _itemsMap = new Map();

    const _config = {
        lineColor: 0x00f2ff,
        dashSize: 6,
        gapSize: 4,
        offset: new THREE.Vector3(250, 200, 250),
        fontSize: '12px',
        fontFamily: 'monospace',
        textColor: '#00f2ff',
        bgColor: 'rgba(15, 23, 42, 0.85)',
        borderColor: '#00f2ff',
        borderRadius: '4px',
        padding: '2px 8px'
    };

    function createConnectorLine(start, end) {
        if (typeof THREE === 'undefined') return null;
        const geom = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
        const mat = new THREE.LineDashedMaterial({
            color: _config.lineColor,
            dashSize: _config.dashSize,
            gapSize: _config.gapSize,
            linewidth: 1
        });
        const line = new THREE.Line(geom, mat);
        line.computeLineDistances();
        return line;
    }

    function createLabel(text, position) {
        if (typeof THREE === 'undefined' || !THREE.CSS2DObject) return null;
        const div = document.createElement('div');
        div.innerHTML = text.replace(/\n/g, '<br>');
        Object.assign(div.style, {
            color: _config.textColor,
            fontFamily: _config.fontFamily,
            fontSize: _config.fontSize,
            fontWeight: 'bold',
            background: _config.bgColor,
            border: `1px solid ${_config.borderColor}`,
            borderRadius: _config.borderRadius,
            padding: _config.padding,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
            textAlign: 'center'
        });
        const label = new THREE.CSS2DObject(div);
        label.position.copy(position);
        return label;
    }

    function getEquipmentLabelData(eq) {
        let anchor = new THREE.Vector3(eq.posX, eq.posY, eq.posZ);
        let offset = _config.offset.clone();
        let text = eq.tag;
        if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
            const diam = eq.diametro || 0, alt = eq.altura || 0;
            text += `\n⌀${diam}mm H=${alt}mm`;
            anchor = new THREE.Vector3(eq.posX, eq.posY + alt/2, eq.posZ);
            offset = new THREE.Vector3(300, 300, 0);
        } else if (eq.tipo === 'tanque_h') {
            const largo = eq.largo || 0, diam = eq.diametro || 0;
            text += `\nL=${largo}mm ⌀${diam}mm`;
            offset = new THREE.Vector3(350, 0, 350);
        } else if (eq.tipo === 'bomba' || eq.tipo === 'bomba_dosificacion') {
            const alto = eq.altura || 800;
            text += `\n${alto}x${eq.ancho||800}mm`;
            anchor = new THREE.Vector3(eq.posX, eq.posY + alto/2, eq.posZ);
            offset = new THREE.Vector3(300, 200, 300);
        }
        const endPoint = anchor.clone().add(offset);
        return { anchor, endPoint, text };
    }

    function getLineLabelData(line) {
        const pts = line.points || line._cachedPoints;
        if (!pts || pts.length < 2) return null;
        let mid = new THREE.Vector3(0,0,0);
        pts.forEach(p => mid.add(new THREE.Vector3(p.x, p.y, p.z)));
        mid.divideScalar(pts.length);
        let totalLen = 0;
        for (let i=0; i<pts.length-1; i++) {
            totalLen += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
        }
        const diam = line.diameter || 4;
        const material = line.material || 'PPR';
        const text = `${line.tag}\n${diam}" ${material}\nL=${(totalLen/1000).toFixed(2)}m`;
        const offset = new THREE.Vector3(0, 200, 0);
        const endPoint = mid.clone().add(offset);
        return { anchor: mid, endPoint, text };
    }

    function removeLabelForTag(tag) {
        if (!_itemsMap.has(tag)) return;
        const item = _itemsMap.get(tag);
        if (item.line && _scene) _scene.remove(item.line);
        if (item.label) {
            // Verificar si tiene removeFromParent (CSS2DObject)
            if (typeof item.label.removeFromParent === 'function') {
                item.label.removeFromParent();
            } else if (item.label.parent) {
                // Fallback: remover del padre manualmente
                item.label.parent.remove(item.label);
            }
        }
        _itemsMap.delete(tag);
    }

    function updateLabelForObject(obj) {
        const tag = obj.tag;
        let data;
        if (obj.posX !== undefined) {
            data = getEquipmentLabelData(obj);
        } else {
            data = getLineLabelData(obj);
        }
        if (!data) {
            removeLabelForTag(tag);
            return;
        }
        removeLabelForTag(tag);
        const { anchor, endPoint, text } = data;
        const line = createConnectorLine(anchor, endPoint);
        const label = createLabel(text, endPoint);
        if (!line || !label) return;
        _scene.add(line);
        _scene.add(label);
        _itemsMap.set(tag, { line, label });
    }

    function updateAllLabels() {
        if (!_core || !_scene) return;
        const db = _core.getDb();
        const currentTags = new Set();
        db.equipos.forEach(eq => {
            currentTags.add(eq.tag);
            updateLabelForObject(eq);
        });
        db.lines.forEach(line => {
            currentTags.add(line.tag);
            updateLabelForObject(line);
        });
        for (let tag of _itemsMap.keys()) {
            if (!currentTags.has(tag)) {
                removeLabelForTag(tag);
            }
        }
    }

    function init(coreInstance) {
        _core = coreInstance;
        _scene = _core.getScene();
        if (!_scene) {
            console.warn("Labels: escena no disponible");
            return;
        }
        if (typeof THREE === 'undefined' || !THREE.CSS2DRenderer || !THREE.CSS2DObject) {
            console.warn("Labels: CSS2DRenderer/CSS2DObject no disponible. Etiquetas deshabilitadas.");
            return;
        }
        const container = document.getElementById('canvas-container');
        if (!container) {
            console.warn("Labels: canvas-container no encontrado");
            return;
        }
        _labelRenderer = new THREE.CSS2DRenderer();
        _labelRenderer.setSize(window.innerWidth, window.innerHeight);
        _labelRenderer.domElement.style.position = 'absolute';
        _labelRenderer.domElement.style.top = '0px';
        _labelRenderer.domElement.style.left = '0px';
        _labelRenderer.domElement.style.pointerEvents = 'none';
        container.appendChild(_labelRenderer.domElement);

        // Engancharse al bucle de animación del Core
        const originalAnimate = _core.getAnimate();
        if (originalAnimate) {
            const newAnimate = function() {
                originalAnimate();
                if (_labelRenderer && _core.getCamera()) {
                    _labelRenderer.render(_scene, _core.getCamera());
                }
            };
            _core.setAnimate(newAnimate);
        }

        _core.subscribe(() => {
            updateAllLabels();
        });

        updateAllLabels();

        window.addEventListener('resize', () => {
            if (_labelRenderer) {
                _labelRenderer.setSize(window.innerWidth, window.innerHeight);
            }
        });

        console.log("Labels v1.2 corregido listo");
    }

    return { init };
})();
