
// ============================================================
// MÓDULO: SMARTFLOW CATALOG v3.0 (Catálogo de Ingeniería + Factoría 3D)
// Archivo: js/catalog.js
// ============================================================

const SmartFlowCatalog = (function() {
    
    // -------------------- 1. ESPECIFICACIONES DE MATERIALES --------------------
    const specs = {
        "PPR_PN12_5": { material: "PPR", norma: "IRAM 13471", presion: "PN 12.5", color: 0x7c3aed, conexion: "TERMOFUSION" },
        "ACERO_SCH80": { material: "Acero al Carbono", norma: "ASTM A106 Gr. B", schedule: "SCH 80", color: 0x94a3b8, conexion: "NPT" },
        "ACERO_150_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "150", cara: "RF", color: 0x64748b, conexion: "BRIDADA" },
        "CS_300_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "300", cara: "RF", color: 0x475569, conexion: "BRIDADA" },
        "SS_150_RF": { material: "Acero Inoxidable 316L", norma: "ASTM A182 F316L", clase: "150", cara: "RF", color: 0x94a3b8, conexion: "BRIDADA" },
        "SS_SANITARY": { material: "Acero Inoxidable 316L", norma: "3A / ASME BPE", acabado: "Ra < 0.8 µm", color: 0xe2e8f0, conexion: "TRI-CLAMP" },
        "PTFE_LINED": { material: "Acero al Carbono Revestido PTFE", norma: "ASTM A395", color: 0xa78bfa, conexion: "BRIDADA" },
        "HDPE_PE100": { material: "HDPE", norma: "PE100", presion: "PN 10", color: 0x22c55e, conexion: "ELECTROFUSION" },
        "PVC_SCH80": { material: "PVC", norma: "ASTM D1785", schedule: "SCH 80", color: 0xeab308, conexion: "CEMENTADO" }
    };

    // -------------------- 2. DEFINICIÓN DE EQUIPOS --------------------
    const equipment = {
        tanque_v: { 
            nombre: 'Tanque Vertical', categoria: 'almacenamiento', forma: 'cilindro',
            generarPuertos: (eq) => {
                const alturaRelativaSalida = eq.altura_salida_desde_base !== undefined ? eq.altura_salida_desde_base - eq.altura/2 : -eq.altura/2;
                return [
                    { id: 'N1', label: 'Salida de Fondo / Succión', relX: 0, relY: alturaRelativaSalida, relZ: 0, diametro: eq.diametro_salida || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                    { id: 'N2', label: 'Entrada Superior', relX: 0, relY: eq.altura/2, relZ: 0, diametro: eq.diametro_entrada || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 0, dy: 1, dz: 0 } }
                ];
            }
        },
        tanque_h: { 
            nombre: 'Tanque Horizontal', categoria: 'almacenamiento', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'N1', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_salida || 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'N2', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_entrada || 4, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } }
            ]
        },
        bomba: { 
            nombre: 'Bomba Centrífuga', categoria: 'rotativo', forma: 'rectangular',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_succion || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_descarga || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        bomba_dosificacion: { 
            nombre: 'Bomba Dosificadora', categoria: 'rotativo', forma: 'rectangular',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -200, relY: 0, relZ: 0, diametro: 1, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: 200, relY: 0, relZ: 0, diametro: 1, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        intercambiador: { 
            nombre: 'Intercambiador de Calor', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN1', label: 'Entrada Caliente', relX: -eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT1', label: 'Salida Caliente', relX: eq.largo/2, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        torre: { 
            nombre: 'Torre de Destilación', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: 0, relZ: eq.diametro/2, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                { id: 'TOP', label: 'Tope', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'BOT', label: 'Fondo', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        reactor: { 
            nombre: 'Reactor', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        caldera: { 
            nombre: 'Caldera', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'AGUA', label: 'Entrada Agua', relX: -eq.largo/2, relY: eq.altura/4, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'VAPOR', label: 'Salida Vapor', relX: eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 1, dz: 0 } }
            ]
        },
        compresor: { 
            nombre: 'Compresor', categoria: 'rotativo', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        separador: { 
            nombre: 'Separador', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'GAS', label: 'Salida Gas', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'LIQ', label: 'Salida Líquido', relX: eq.largo/2, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: -1, dz: 0 } }
            ]
        },
        clarificador: { 
            nombre: 'Clarificador', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        filtro_arena: { 
            nombre: 'Filtro de Arena', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        osmosis: { 
            nombre: 'Ósmosis Inversa', categoria: 'tratamiento', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'PERM', label: 'Permeado', relX: eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 1, dz: 0 } }
            ]
        },
        bomba_sumergible: { 
            nombre: 'Bomba Sumergible', categoria: 'rotativo', forma: 'circulo',
            generarPuertos: (eq) => [
                { id: 'DESC', label: 'Descarga', relX: 0, relY: 500, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: 0, dy: 1, dz: 0 } }
            ]
        },
        tanque_acero: { 
            nombre: 'Tanque Acero Inoxidable', categoria: 'almacenamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        pasteurizador: { 
            nombre: 'Pasteurizador', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        homogeneizador: { 
            nombre: 'Homogeneizador', categoria: 'proceso', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        colector: {
            nombre: 'Colector / Manifold', categoria: 'distribucion', forma: 'linea',
            generarPuertos: (eq) => {
                const puertos = [];
                for (let i = 0; i < (eq.num_entradas || 2); i++) {
                    puertos.push({
                        id: `IN${i+1}`, label: `Entrada ${i+1}`, relX: i * (eq.spacing || 3000), relY: 0, relZ: 0,
                        diametro: eq.diametro_entrada || 3, tipoConexion: 'TERMOFUSION', orientacion: { dx: 0, dy: -1, dz: 0 }
                    });
                }
                let salidaRelX = eq.salida_pos === 'left' ? 0 : (eq.salida_pos === 'right' ? (eq.num_entradas - 1) * eq.spacing : (eq.num_entradas - 1) * eq.spacing / 2);
                puertos.push({
                    id: 'OUT', label: 'Salida', relX: salidaRelX, relY: 0, relZ: 0,
                    diametro: eq.diametro_salida || 4, tipoConexion: 'TERMOFUSION', orientacion: { dx: 1, dy: 0, dz: 0 }
                });
                return puertos;
            }
        }
    };

    // -------------------- 3. COMPONENTES DE TUBERÍA --------------------
    const components = {
        TEE_EQUAL_CS: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB' },
        TEE_REDUCING_CS: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora', spec: 'ACERO_150_RF' },
        CROSS_CS: { tipo: 'CROSS', nombre: 'Cruz', spec: 'ACERO_150_RF' },
        PIPE_PPR_PN12_5: { tipo: 'PIPE', nombre: 'Tubo PPR', spec: 'PPR_PN12_5' },
        PIPE_CS_SCH80: { tipo: 'PIPE', nombre: 'Tubo Acero Carbono SCH80', spec: 'ACERO_SCH80' },
        PIPE_SS_SANITARY: { tipo: 'PIPE', nombre: 'Tubo Acero Inox Sanitario', spec: 'SS_SANITARY' },
        PIPE_HDPE_PE100: { tipo: 'PIPE', nombre: 'Tubo HDPE PE100', spec: 'HDPE_PE100' },
        PIPE_PVC_SCH80: { tipo: 'PIPE', nombre: 'Tubo PVC SCH80', spec: 'PVC_SCH80' },
        GATE_VALVE_CS_150: { tipo: 'GATE_VALVE', nombre: 'Válvula Compuerta', spec: 'ACERO_150_RF', clase: '150', norma: 'API 600', material: 'Acero al Carbono' },
        GLOBE_VALVE_CS_150: { tipo: 'GLOBE_VALVE', nombre: 'Válvula Globo Acero al Carbono 150#', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        GLOBE_VALVE_SS_300: { tipo: 'GLOBE_VALVE', nombre: 'Válvula Globo', spec: 'SS_150_RF', clase: '300', norma: 'BS 1873', material: 'Acero Inoxidable 316L' },
        BUTTERFLY_VALVE_WAFER: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa Wafer', spec: 'SS_150_RF', clase: '150', conexion: 'WAFER', material: 'Acero Inoxidable 316L' },
        BUTTERFLY_VALVE_CS_150: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa Acero al Carbono 150#', spec: 'ACERO_150_RF', clase: '150', conexion: 'WAFER', material: 'Acero al Carbono' },
        BALL_VALVE_CS_150: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        BALL_VALVE_PPR: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        BUTTERFLY_VALVE_PPR: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        CHECK_VALVE_SWING_CS: { tipo: 'CHECK_VALVE', subtipo: 'SWING', nombre: 'Válvula Check Swing', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        CHECK_VALVE_WAFER_SS: { tipo: 'CHECK_VALVE', subtipo: 'WAFER', nombre: 'Válvula Check Wafer', spec: 'SS_150_RF', material: 'Acero Inoxidable 316L' },
        CHECK_VALVE_PPR: { tipo: 'CHECK_VALVE', subtipo: 'SWING', nombre: 'Válvula Check PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        DIAPHRAGM_VALVE_PTFE: { tipo: 'DIAPHRAGM_VALVE', nombre: 'Válvula de Diafragma', spec: 'PTFE_LINED', clase: '150', material: 'Acero al Carbono Revestido PTFE' },
        CONTROL_VALVE_CS: { tipo: 'CONTROL_VALVE', nombre: 'Válvula de Control', spec: 'ACERO_150_RF', actuador: 'DIAFRAGMA', material: 'Acero al Carbono' },
        PRESSURE_RELIEF_VALVE: { tipo: 'PRESSURE_RELIEF', nombre: 'Válvula de Alivio', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        SAFETY_VALVE: { tipo: 'SAFETY_VALVE', nombre: 'Válvula de Seguridad', spec: 'SS_150_RF', clase: '150', material: 'Acero Inoxidable' },
        BUTTERFLY_VALVE_TRI_CLAMP: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa Sanitaria', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: 'Acero Inoxidable 316L' },
        BALL_VALVE_3A: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola Sanitaria 3A', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: 'Acero Inoxidable 316L' },
        CONCENTRIC_REDUCER_CS: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB' },
        ECCENTRIC_REDUCER_CS: { tipo: 'ECCENTRIC_REDUCER', nombre: 'Reductor Excéntrico', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB' },
        ELBOW_90_LR_CS: { tipo: 'ELBOW_90_LR', nombre: 'Codo 90° Radio Largo', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB', radio: '1.5D' },
        ELBOW_90_SR_CS: { tipo: 'ELBOW_90_SR', nombre: 'Codo 90° Radio Corto', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB', radio: '1.0D' },
        ELBOW_45_CS: { tipo: 'ELBOW_45', nombre: 'Codo 45°', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB' },
        ELBOW_90_PPR: { tipo: 'ELBOW_90_PPR', nombre: 'Codo 90° PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', angulo: 90, material: 'PPR' },
        ELBOW_45_PPR: { tipo: 'ELBOW_45_PPR', nombre: 'Codo 45° PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', angulo: 45, material: 'PPR' },
        ELBOW_90_HDPE: { tipo: 'ELBOW_90_HDPE', nombre: 'Codo 90° HDPE', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', angulo: 90, material: 'HDPE' },
        ELBOW_90_PVC: { tipo: 'ELBOW_90_PVC', nombre: 'Codo 90° PVC', spec: 'PVC_SCH80', conexion: 'CEMENTADO', angulo: 90, material: 'PVC' },
        ELBOW_90_SANITARY: { tipo: 'ELBOW_90_SR', nombre: 'Codo 90° Sanitario', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP' },
        CODO_90_ACERO_3IN: { tipo: 'ELBOW_90_ACERO', nombre: 'Codo 90° Acero 3 pulgadas', spec: 'ACERO_SCH80', conexion: 'NPT_HEMBRA', material: 'Acero al Carbono', angulo: 90 },
        WELD_NECK_FLANGE_150: { tipo: 'WELD_NECK_FLANGE', nombre: 'Brida Cuello Soldable', spec: 'ACERO_150_RF', clase: '150', norma: 'ASME B16.5' },
        SLIP_ON_FLANGE_150: { tipo: 'SLIP_ON_FLANGE', nombre: 'Brida Slip-On', spec: 'ACERO_150_RF', clase: '150', norma: 'ASME B16.5' },
        BLIND_FLANGE_150: { tipo: 'BLIND_FLANGE', nombre: 'Brida Ciega', spec: 'ACERO_150_RF', clase: '150', norma: 'ASME B16.5' },
        LAP_JOINT_FLANGE_150: { tipo: 'LAP_JOINT_FLANGE', nombre: 'Brida Loca Acero', spec: 'ACERO_150_RF', clase: '150', norma: 'ASME B16.5', material: 'Acero al Carbono' },
        STUB_END_PPR: { tipo: 'STUB_END', nombre: 'Portabrida PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        STUB_END_HDPE: { tipo: 'STUB_END', nombre: 'Portabrida HDPE', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        TEE_PPR: { tipo: 'TEE_EQUAL', nombre: 'Tee PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION' },
        TEE_REDUCING_PPR: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        CONCENTRIC_REDUCER_PPR: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        TEE_HDPE: { tipo: 'TEE_EQUAL', nombre: 'Tee HDPE', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION' },
        TEE_PVC: { tipo: 'TEE_EQUAL', nombre: 'Tee PVC', spec: 'PVC_SCH80', conexion: 'CEMENTADO' },
        CAP_CS: { tipo: 'CAP', nombre: 'Tapón', spec: 'ACERO_150_RF' },
        CAP_PPR: { tipo: 'CAP', nombre: 'Tapón PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION' },
        TRANSITION_PPR_NPT: { tipo: 'TRANSITION', nombre: 'Adaptador Macho PPR x NPT', spec_origen: 'PPR_PN12_5', spec_destino: 'ACERO_SCH80', conexion_origen: 'TERMOFUSION', conexion_destino: 'NPT_MACHO' },
        ADAPTADOR_MACHO_PPR_3IN: { tipo: 'TRANSITION', nombre: 'Adaptador Macho PPR 90mm x 3 NPT', spec_origen: 'PPR_PN12_5', spec_destino: 'ACERO_SCH80', conexion_origen: 'TERMOFUSION', conexion_destino: 'NPT_MACHO' },
        ADAPTADOR_HEMBRA_PPR_3IN: { tipo: 'TRANSITION', nombre: 'Adaptador Hembra PPR 90mm x 3 NPT', spec_origen: 'PPR_PN12_5', spec_destino: 'ACERO_SCH80', conexion_origen: 'TERMOFUSION', conexion_destino: 'NPT_HEMBRA' },
        TRANSITION_HDPE_STEEL: { tipo: 'TRANSITION', nombre: 'Transición HDPE x Acero', spec_origen: 'HDPE_PE100', spec_destino: 'ACERO_150_RF', conexion_origen: 'ELECTROFUSION', conexion_destino: 'BRIDADA' },
        UNION_PPR: { tipo: 'UNION', nombre: 'Unión Universal PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION' },
        UNION_CS_3000: { tipo: 'UNION', nombre: 'Unión Universal Acero 3000', spec: 'ACERO_SCH80', conexion: 'NPT_HEMBRA' },
        UNION_UNIVERSAL_ACERO_3IN: { tipo: 'UNION_ACERO', nombre: 'Unión Universal Acero 3 pulgadas', spec: 'ACERO_SCH80', conexion: 'NPT_HEMBRA', material: 'Acero Galvanizado' },
        UNION_HDPE: { tipo: 'UNION', nombre: 'Unión Universal HDPE', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION' },
        BULKHEAD_PE_3IN: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty 3 pulgadas', material: 'PP_EPDM', conexion: 'NPT_HEMBRA', diametro: 3 },
        BULKHEAD_PE_4IN: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty 4 pulgadas', material: 'PP_EPDM', conexion: 'NPT_HEMBRA', diametro: 4 },
        BULKHEAD: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty', material: 'PP_EPDM', conexion: 'NPT_HEMBRA' },
        NIPLE_ACERO_3IN_150MM: { tipo: 'NIPPLE', nombre: 'Niple Acero 3 x 150 mm', spec: 'ACERO_SCH80', conexion: 'NPT_MACHO', material: 'Acero al Carbono' },
        NIPLE_ACERO_3IN_100MM: { tipo: 'NIPPLE', nombre: 'Niple Acero 3 x 100 mm', spec: 'ACERO_SCH80', conexion: 'NPT_MACHO', material: 'Acero al Carbono' },
        EXPANSION_JOINT_PPR: { tipo: 'EXPANSION_JOINT', nombre: 'Junta de Expansión PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR_EPDM' },
        EXPANSION_JOINT_CS: { tipo: 'EXPANSION_JOINT', nombre: 'Junta de Expansión Acero', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        Y_STRAINER_CS: { tipo: 'Y_STRAINER', nombre: 'Filtro Tipo Y', spec: 'ACERO_150_RF', clase: '150', malla: '40 Mesh' },
        Y_STRAINER_PPR: { tipo: 'Y_STRAINER', nombre: 'Filtro Tipo Y PPR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', malla: '40 Mesh' },
        T_STRAINER: { tipo: 'T_STRAINER', nombre: 'Filtro Tipo T', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        BASKET_STRAINER: { tipo: 'BASKET_STRAINER', nombre: 'Filtro Canasta', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        STEAM_TRAP_THERMODYNAMIC: { tipo: 'STEAM_TRAP', subtipo: 'THERMODYNAMIC', nombre: 'Trampa de Vapor Termodinámica', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        STEAM_TRAP_FLOAT: { tipo: 'STEAM_TRAP', subtipo: 'FLOAT', nombre: 'Trampa de Vapor de Flotador', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        STEAM_TRAP_BUCKET: { tipo: 'STEAM_TRAP', subtipo: 'BUCKET', nombre: 'Trampa de Vapor de Cubeta', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        PRESSURE_GAUGE: { tipo: 'PRESSURE_GAUGE', nombre: 'Manómetro', rango: '0-100 psi', conexion: '1/2 NPT' },
        TEMPERATURE_GAUGE: { tipo: 'TEMPERATURE_GAUGE', nombre: 'Termómetro', rango: '0-150 °C' },
        FLOW_METER_MAG: { tipo: 'FLOW_METER', subtipo: 'MAGNETICO', nombre: 'Caudalímetro Magnético', conexion: 'BRIDADA' },
        FLOW_METER_VORTEX: { tipo: 'FLOW_METER', subtipo: 'VORTEX', nombre: 'Caudalímetro Vortex', conexion: 'BRIDADA' },
        FLOW_METER_CORIOLIS: { tipo: 'FLOW_METER', subtipo: 'CORIOLIS', nombre: 'Caudalímetro Coriolis', conexion: 'BRIDADA' },
        PRESSURE_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Presión', señal: '4-20 mA' },
        LEVEL_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Nivel', señal: '4-20 mA' },
        TEMPERATURE_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Temperatura', señal: '4-20 mA' },
        ROTAMETER: { tipo: 'INSTRUMENT', nombre: 'Rotámetro', conexion: 'ROSCADO' },
        SIGHT_GLASS: { tipo: 'INSTRUMENT', nombre: 'Visor de Flujo', conexion: 'ROSCADO' },
        LEVEL_SWITCH_RANA: { tipo: 'LEVEL_SWITCH_RANA', nombre: 'Switch de Nivel Tipo Rana', conexion: '1/2 NPT' },
        PIPE_SHOE: { tipo: 'PIPE_SHOE', nombre: 'Zapata', material: 'Acero al Carbono' },
        U_BOLT: { tipo: 'U_BOLT', nombre: 'Abrazadera U-Bolt', material: 'Acero Galvanizado' },
        GUIDE: { tipo: 'GUIDE', nombre: 'Guía', material: 'Acero al Carbono' },
        ANCHOR: { tipo: 'ANCHOR', nombre: 'Anclaje Fijo', material: 'Acero al Carbono' },
        HANGER: { tipo: 'HANGER', nombre: 'Colgador', material: 'Acero al Carbono' },
        SPRING_HANGER: { tipo: 'SPRING_HANGER', nombre: 'Colgador de Resorte', material: 'Acero al Carbono' },
        PIPE_CLAMP: { tipo: 'PIPE_CLAMP', nombre: 'Abrazadera', material: 'Acero al Carbono' },
        CAMLOCK_MALE: { tipo: 'CAMLOCK', subtipo: 'MALE', nombre: 'Acople Camlock Macho', material: 'Acero Inoxidable' },
        CAMLOCK_FEMALE: { tipo: 'CAMLOCK', subtipo: 'FEMALE', nombre: 'Acople Camlock Hembra', material: 'Acero Inoxidable' },
        QUICK_CONNECT: { tipo: 'QUICK_CONNECT', nombre: 'Conexión Rápida', material: 'Acero Inoxidable' },
        FLEXIBLE_HOSE: { tipo: 'HOSE', nombre: 'Manguera Flexible', material: 'EPDM' },
        METALLIC_HOSE: { tipo: 'HOSE', subtipo: 'METALLIC', nombre: 'Manguera Metálica', material: 'Acero Inoxidable' },
        PTFE_HOSE: { tipo: 'HOSE', subtipo: 'PTFE', nombre: 'Manguera PTFE', material: 'PTFE' },
        SILENCER: { tipo: 'SILENCER', nombre: 'Silenciador', material: 'Acero al Carbono' },
        VENT_SILENCER: { tipo: 'SILENCER', subtipo: 'VENT', nombre: 'Silenciador de Venteo', material: 'Acero Inoxidable' },
        FLAME_ARRESTER: { tipo: 'FLAME_ARRESTER', nombre: 'Arrestador de Llama', material: 'Acero Inoxidable' },
        VACUUM_BREAKER: { tipo: 'VACUUM_BREAKER', nombre: 'Rompedor de Vacío', material: 'Acero Inoxidable' },
        DRAIN_VALVE: { tipo: 'DRAIN_VALVE', nombre: 'Válvula de Purga', spec: 'ACERO_SCH80', conexion: 'NPT', material: 'Acero al Carbono' },
        AIR_RELEASE_VALVE: { tipo: 'AIR_RELEASE', nombre: 'Válvula de Liberación de Aire', material: 'Acero Inoxidable' },
        SAMPLE_COOLER: { tipo: 'SAMPLE_COOLER', nombre: 'Enfriador de Muestra', material: 'Acero Inoxidable' },
        SAMPLE_VALVE: { tipo: 'SAMPLE_VALVE', nombre: 'Válvula de Muestreo', material: 'Acero Inoxidable' }
    };

    // ==================== 4. GENERACIÓN DE PUERTOS PARA ACCESORIOS ====================
    function calculateLineDirection(line, param) {
        const pts = line._cachedPoints || line.points3D;
        if (!pts || pts.length < 2) return { dx: 1, dy: 0, dz: 0 };
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            let d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return { dx: 1, dy: 0, dz: 0 };
        const targetLen = totalLen * param;
        let currentAccum = 0, segIndex = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) { segIndex = i; break; }
            currentAccum += lengths[i];
        }
        const p1 = pts[segIndex], p2 = pts[segIndex + 1];
        const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        return { dx: dx/len, dy: dy/len, dz: dz/len };
    }

    function getPerpendicularVector(dir) {
        if (Math.abs(dir.dy) > 0.9) {
            return { dx: 1, dy: 0, dz: 0 };
        }
        let perp = { dx: -dir.dy, dy: dir.dx, dz: 0 };
        const len = Math.hypot(perp.dx, perp.dy, perp.dz);
        if (len < 0.1) perp = { dx: 1, dy: 0, dz: 0 };
        else { perp.dx /= len; perp.dy /= len; perp.dz /= len; }
        return perp;
    }

    // Extendemos los componentes base con generadores de puertos
    components.TEE_EQUAL = {
        ...components.TEE_EQUAL_CS,
        generarPuertos: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp = getPerpendicularVector(dir);
            return [
                { id: 'RUN1', label: 'Entrada', relPos: { x: -dir.dx*50, y: -dir.dy*50, z: -dir.dz*50 }, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relPos: { x: dir.dx*50, y: dir.dy*50, z: dir.dz*50 }, orientacion: dir, diametro },
                { id: 'BRANCH', label: 'Derivación', relPos: { x: perp.dx*50, y: perp.dy*50, z: perp.dz*50 }, orientacion: perp, diametro }
            ];
        }
    };

    components.TEE_REDUCING = {
        ...components.TEE_REDUCING_CS,
        generarPuertos: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp = getPerpendicularVector(dir);
            return [
                { id: 'RUN1', label: 'Entrada', relPos: { x: -dir.dx*50, y: -dir.dy*50, z: -dir.dz*50 }, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relPos: { x: dir.dx*50, y: dir.dy*50, z: dir.dz*50 }, orientacion: dir, diametro },
                { id: 'BRANCH', label: 'Derivación', relPos: { x: perp.dx*50, y: perp.dy*50, z: perp.dz*50 }, orientacion: perp, diametro: diametro * 0.75 }
            ];
        }
    };

    components.CROSS = {
        ...components.CROSS_CS,
        generarPuertos: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp1 = getPerpendicularVector(dir);
            const perp2 = {
                dx: dir.dy * perp1.dz - dir.dz * perp1.dy,
                dy: dir.dz * perp1.dx - dir.dx * perp1.dz,
                dz: dir.dx * perp1.dy - dir.dy * perp1.dx
            };
            return [
                { id: 'RUN1', label: 'Entrada', relPos: { x: -dir.dx*50, y: -dir.dy*50, z: -dir.dz*50 }, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relPos: { x: dir.dx*50, y: dir.dy*50, z: dir.dz*50 }, orientacion: dir, diametro },
                { id: 'BRANCH1', label: 'Derivación 1', relPos: { x: perp1.dx*50, y: perp1.dy*50, z: perp1.dz*50 }, orientacion: perp1, diametro },
                { id: 'BRANCH2', label: 'Derivación 2', relPos: { x: perp2.dx*50, y: perp2.dy*50, z: perp2.dz*50 }, orientacion: perp2, diametro }
            ];
        }
    };

    // Herencia de generadores de puertos para variantes de materiales
    const teeBase = components.TEE_EQUAL;
    const teeRedBase = components.TEE_REDUCING;
    if (teeBase && teeBase.generarPuertos) {
        ['TEE_PPR', 'TEE_HDPE', 'TEE_PVC', 'TEE_EQUAL_CS'].forEach(key => {
            if (components[key] && !components[key].generarPuertos) {
                components[key].generarPuertos = teeBase.generarPuertos;
            }
        });
    }
    if (teeRedBase && teeRedBase.generarPuertos) {
        ['TEE_REDUCING_PPR'].forEach(key => {
            if (components[key] && !components[key].generarPuertos) {
                components[key].generarPuertos = teeRedBase.generarPuertos;
            }
        });
    }

    // -------------------- 5. DIMENSIONES ESTÁNDAR (UNIFICADAS) --------------------
    const dimensiones = {
        "codo_90": { 2: 152, 3: 229, 4: 305, 6: 457, 8: 610 },
        "codo_45": { 2: 80, 3: 110, 4: 150, 6: 230 },
        "tee": { 2: 127, 3: 152, 4: 178, 6: 229, 8: 279 },
        "valvula_compuerta": { 2: 178, 3: 203, 4: 229, 6: 267 },
        "reduccion": { "4x3": 102, "6x4": 152, "3x2": 89 },
        "insercion_ppr": { 2: 45, 3: 60, 4: 75, 6: 90 },
        "insercion_hdpe": { 2: 50, 3: 65, 4: 80, 6: 100 },
        "union_universal": { 2: 70, 3: 90, 4: 110, 6: 140 },
        "adaptador_macho": { 2: 45, 3: 60, 4: 75, 6: 90 },
        "brida_espesor_150": { 2: 12, 3: 15, 4: 18, 6: 22 },
        "stub_end_longitud": { 2: 50, 3: 60, 4: 75, 6: 90 }
    };

    // ==================== 6. GENERADORES DE ACCESORIOS (FITTINGS) ====================
    const fittingGenerators = {
        "TEE_EQUAL": (diam, spec) => {
            const dist = dimensiones.tee[diam] || 100;
            return [
                { id: 'P1', relX: -dist, relY: 0, relZ: 0, orientacion: {dx:-1, dy:0, dz:0}, diametro: diam, spec, status: 'open' },
                { id: 'P2', relX: dist, relY: 0, relZ: 0, orientacion: {dx:1, dy:0, dz:0}, diametro: diam, spec, status: 'open' },
                { id: 'P3', relX: 0, relY: dist, relZ: 0, orientacion: {dx:0, dy:1, dz:0}, diametro: diam, spec, status: 'open' }
            ];
        },
        "REDUCCION_CONCENTRICA": (d_mayor, d_menor, spec) => {
            const key = `${d_mayor}x${d_menor}`;
            const largo = dimensiones.reduccion[key] || 100;
            return [
                { id: 'P1', relX: -largo/2, relY: 0, relZ: 0, orientacion: {dx:-1, dy:0, dz:0}, diametro: d_mayor, spec, status: 'open' },
                { id: 'P2', relX: largo/2, relY: 0, relZ: 0, orientacion: {dx:1, dy:0, dz:0}, diametro: d_menor, spec, status: 'open' }
            ];
        }
    };

    let _fittingCounter = 1;

    // ==================== 7. FACTORÍA VISUAL 3D (NUEVO) ====================
    function createEquipmentMesh(eq) {
        let geometry, material;
        const spec = specs[eq.spec] || specs["ACERO_150_RF"];
        const color = spec ? spec.color : 0x7c3aed;
        const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.4 });
        
        switch(eq.tipo) {
            case 'tanque_v':
            case 'torre':
            case 'reactor':
                const radius = (eq.diametro || 1000) / 2;
                const height = eq.altura || 1500;
                geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
                break;
            case 'tanque_h':
                const rx = (eq.largo || 2000) / 2;
                const ry = (eq.diametro || 1000) / 2;
                geometry = new THREE.BoxGeometry(rx*2, ry*2, ry*2);
                break;
            case 'bomba':
            case 'bomba_dosificacion':
            case 'intercambiador':
            case 'caldera':
            case 'compresor':
            case 'osmosis':
            case 'pasteurizador':
            case 'homogeneizador':
                const width = eq.largo || 800;
                const heightBox = eq.altura || 800;
                const depth = eq.ancho || 800;
                geometry = new THREE.BoxGeometry(width, heightBox, depth);
                break;
            case 'colector':
                const largo = eq.largo || 1000;
                geometry = new THREE.BoxGeometry(largo, 100, 100);
                break;
            default:
                geometry = new THREE.BoxGeometry(1000, 1000, 1000);
        }
        
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set(eq.posX || 0, eq.posY || 0, eq.posZ || 0);
        mesh.userData = { tag: eq.tag, type: 'equipment' };
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        return mesh;
    }
    
    function createLineMesh(lineData) {
        // Delegar en el Router si está disponible, si no, grupo vacío
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.createLineMesh) {
            return SmartFlowRouter.createLineMesh(lineData);
        }
        console.warn("Router no disponible para crear línea volumétrica");
        return new THREE.Group();
    }

    // ==================== 8. API PÚBLICA ====================
    return {
        getSpecs: function() { return specs; },
        getSpec: function(id) { return specs[id] || null; },
        getEquipment: function(tipo) { return equipment[tipo] || null; },
        getComponent: function(id) { return components[id] || null; },
        getDimension: function(tipo, diametro) { return dimensiones[tipo]?.[diametro] || null; },
        listEquipmentTypes: function() { return Object.keys(equipment); },
        listComponentTypes: function() { return Object.keys(components); },
        listSpecs: function() { return Object.keys(specs); },
        
        createEquipment: function(tipo, tag, x, y, z, opciones = {}) {
            const def = equipment[tipo];
            if (!def) return null;
            let base = {
                tag, tipo, posX: x, posY: y, posZ: z,
                diametro: opciones.diametro || 1000,
                altura: opciones.altura || 1500,
                material: opciones.material || 'CS',
                spec: opciones.spec || 'ACERO_150_RF',
                largo: opciones.largo || 1000,
                ancho: opciones.ancho || 1000
            };
            base.puertos = def.generarPuertos(base).map(p => ({
                ...p, spec: base.spec, status: 'open', diametro: p.diametro || 3
            }));
            return base;
        },
        
        createComponent: function(compId, opciones = {}) {
            const def = components[compId];
            if (!def) return null;
            return { ...def, ...opciones, id: compId };
        },

        createFitting: function(tipo, diam, spec, pos) {
            const generator = fittingGenerators[tipo];
            if (!generator) return null;
            return {
                tag: `FIT-${_fittingCounter++}`,
                tipo: tipo,
                posX: pos.x, posY: pos.y, posZ: pos.z,
                isFitting: true,
                puertos: generator(diam, spec)
            };
        },

        getFittingForConnection: function(d_origen, d_destino, spec) {
            if (d_origen === d_destino) return { tipo: 'TEE_EQUAL', diam: d_origen };
            return { tipo: 'REDUCCION_CONCENTRICA', d_mayor: Math.max(d_origen, d_destino), d_menor: Math.min(d_origen, d_destino) };
        },

        getTransitionAccessories: function(lineMaterial, componentMaterial, diameter) {
            const from = (lineMaterial || '').toUpperCase().trim();
            const to   = (componentMaterial || '').toUpperCase().trim();
            if (!to) return null;
            if (from === to) return null;
            const plasticFamilies = [
                ['PPR', 'PP', 'PPR', 'PP-EPDM', 'PP_EPDM'],
                ['PE', 'PE100', 'HDPE', 'PE_EPDM'],
                ['PVC', 'CPVC']
            ];
            const isPlasticCompatible = plasticFamilies.some(family => 
                family.some(m => from.includes(m)) && family.some(m => to.includes(m))
            );
            if (isPlasticCompatible) return null;
            const transitionMap = {
                'PPR->ACERO AL CARBONO': { left: 'ADAPTADOR_MACHO_PPR_3IN', right: 'UNION_CS_3000' },
                'ACERO AL CARBONO->PPR': { left: 'UNION_CS_3000', right: 'ADAPTADOR_HEMBRA_PPR_3IN' },
                'PPR->ACERO INOXIDABLE 316L': { left: 'ADAPTADOR_MACHO_PPR_3IN', right: 'UNION_CS_3000' },
                'ACERO INOXIDABLE 316L->PPR': { left: 'UNION_CS_3000', right: 'ADAPTADOR_HEMBRA_PPR_3IN' },
                'HDPE->ACERO AL CARBONO': { left: 'TRANSITION_HDPE_STEEL', right: null },
                'ACERO AL CARBONO->HDPE': { left: null, right: 'TRANSITION_HDPE_STEEL' },
                'PVC->ACERO AL CARBONO': { left: 'UNION_CS_3000', right: null },
                'ACERO AL CARBONO->PVC': { left: null, right: 'UNION_CS_3000' },
                'ACERO AL CARBONO->ACERO INOXIDABLE 316L': { left: 'UNION_CS_3000', right: null },
                'ACERO INOXIDABLE 316L->ACERO AL CARBONO': { left: null, right: 'UNION_CS_3000' }
            };
            const key = `${from}->${to}`;
            if (transitionMap[key]) return transitionMap[key];
            const metalMaterials = ['ACERO', 'INOXIDABLE', 'INOX', 'CARBONO', 'CS', 'SS'];
            const fromIsMetal = metalMaterials.some(m => from.includes(m));
            const toIsMetal = metalMaterials.some(m => to.includes(m));
            if (fromIsMetal && toIsMetal) return { left: 'UNION_UNIVERSAL_ACERO_3IN', right: 'UNION_UNIVERSAL_ACERO_3IN' };
            return null;
        },
        
        // Factoría visual (para el Core)
        createEquipmentMesh: createEquipmentMesh,
        createLineMesh: createLineMesh
    };
})();
