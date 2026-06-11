
// ============================================================
// SMARTFLOW CATALOG v4.1.2 - Catálogo Industrial Unificado
// Archivo: js/catalog.js
// Industrias: Agua • Oil&Gas • Petroquímica • Química • Alimentos
// Novedades v4.1.2:
//   - Añadida variante bomba_z (succión +Z, descarga +Y superior)
// ============================================================

const SmartFlowCatalog = (function() {
    
    // ================================================================
    // 1. ESPECIFICACIONES DE MATERIALES
    // ================================================================
    const specs = {
        "PPR_PN12_5": { material: "PPR", norma: "IRAM 13471", presion: "PN 12.5", color: 0x7c3aed, conexion: "TERMOFUSION" },
        "ACERO_SCH80": { material: "Acero al Carbono", norma: "ASTM A106 Gr. B", schedule: "SCH 80", color: 0x94a3b8, conexion: "NPT" },
        "ACERO_150_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "150", cara: "RF", color: 0x64748b, conexion: "BRIDADA" },
        "CS_300_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "300", cara: "RF", color: 0x475569, conexion: "BRIDADA" },
        "SS_150_RF": { material: "Acero Inoxidable 316L", norma: "ASTM A182 F316L", clase: "150", cara: "RF", color: 0x94a3b8, conexion: "BRIDADA" },
        "SS_SANITARY": { material: "Acero Inoxidable 316L", norma: "3A / ASME BPE", acabado: "Ra < 0.8 µm", color: 0xe2e8f0, conexion: "TRI-CLAMP" },
        "PTFE_LINED": { material: "Acero al Carbono Revestido PTFE", norma: "ASTM A395", color: 0xa78bfa, conexion: "BRIDADA" },
        "HDPE_PE100": { material: "HDPE", norma: "PE100", presion: "PN 10", color: 0x22c55e, conexion: "ELECTROFUSION" },
        "PVC_SCH80": { material: "PVC", norma: "ASTM D1785", schedule: "SCH 80", color: 0xeab308, conexion: "CEMENTADO" },
        "CS_600_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "600", cara: "RF", color: 0x334155, conexion: "BRIDADA" },
        "CS_900_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "900", cara: "RF", color: 0x1e293b, conexion: "BRIDADA" },
        "CS_1500_RTJ": { material: "Acero al Carbono", norma: "ASTM A105", clase: "1500", cara: "RTJ", color: 0x0f172a, conexion: "BRIDADA" },
        "SS_300_RF": { material: "Acero Inoxidable 316L", norma: "ASTM A182 F316L", clase: "300", cara: "RF", color: 0x78909c, conexion: "BRIDADA" },
        "SS_600_RF": { material: "Acero Inoxidable 316L", norma: "ASTM A182 F316L", clase: "600", cara: "RF", color: 0x5c7a89, conexion: "BRIDADA" },
        "DUPLEX_150_RF": { material: "Acero Dúplex 2205", norma: "ASTM A182 F51", clase: "150", cara: "RF", color: 0xcbd5e1, conexion: "BRIDADA" },
        "ALLOY20_150_RF": { material: "Alloy 20", norma: "ASTM B462", clase: "150", cara: "RF", color: 0xfbbf24, conexion: "BRIDADA" },
        "HASTELLOY_150_RF": { material: "Hastelloy C276", norma: "ASTM B574", clase: "150", cara: "RF", color: 0xf59e0b, conexion: "BRIDADA" },
        "CS_CRYO": { material: "Acero al Carbono Criogénico", norma: "ASTM A333 Gr.6", clase: "150", cara: "RF", color: 0x6366f1, conexion: "BRIDADA" },
        "PVC_SCH40": { material: "PVC", norma: "ASTM D1785", schedule: "SCH 40", color: 0xfacc15, conexion: "CEMENTADO" },
        "CPVC_SCH80": { material: "CPVC", norma: "ASTM F441", schedule: "SCH 80", color: 0xfb923c, conexion: "CEMENTADO" },
        "PVDF_PN16": { material: "PVDF", norma: "ISO 10931", presion: "PN 16", color: 0xef4444, conexion: "TERMOFUSION" },
        "FRP": { material: "Fibra de Vidrio (FRP)", norma: "ASTM D2996", color: 0x8b5cf6, conexion: "LAMINADO" },
        "RUBBER_LINED": { material: "Acero Revestido Goma", norma: "ASTM A395", color: 0xec4899, conexion: "BRIDADA" },
        "GLASS_LINED": { material: "Acero Revestido Vidrio", norma: "DIN 2873", color: 0xf0f9ff, conexion: "BRIDADA" },
        "HORMIGON_ESTRUCTURAL": { material: "Concreto Armado", norma: "ACI 318", resistencia: "f'c=28 MPa", color: 0x9ca3af, conexion: "ANCLADO" },
        "ALUMINIO_ESTRUCTURAL": { material: "Aluminio Estructural 6061-T6", norma: "ASTM B308", color: 0xd1d5db, conexion: "PERNADO" },
        "MADERA_ESTRUCTURAL": { material: "Madera Estructural", norma: "NDS 2018", color: 0x8b6914, conexion: "CLAVADO/PERNADO" }
    };

    // ================================================================
    // 2. DEFINICIÓN DE EQUIPOS (COMPLETO)
    // ================================================================
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
            nombre: 'Bomba Centrífuga (Succión -X, Descarga +X)', 
            categoria: 'rotativo', 
            forma: 'rectangular',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_succion || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_descarga || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        bomba_z: { 
            nombre: 'Bomba Centrífuga (Succión +Z, Descarga +Y superior)', 
            categoria: 'rotativo', 
            forma: 'rectangular',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: 0, relY: 0, relZ: eq.largo/2, diametro: eq.diametro_succion || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                { id: 'DESC', label: 'Descarga', relX: 0, relY: eq.altura/2, relZ: 0, diametro: eq.diametro_descarga || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 0, dy: 1, dz: 0 } }
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
        plataforma: {
            nombre: 'Plataforma Estructural',
            categoria: 'estructura',
            forma: 'rect',
            generarPuertos: (eq) => []
        },
        desgasificador: {
            nombre: 'Desgasificador', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Agua', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida Agua', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'VENT', label: 'Venteo Gas', relX: 0, relY: eq.altura/2 + 500, relZ: 0, diametro: 3, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } }
            ]
        },
        desmineralizador: {
            nombre: 'Desmineralizador (Lecho Mixto)', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Agua', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida Tratada', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'REGEN', label: 'Regeneración', relX: eq.diametro/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        suavizador: {
            nombre: 'Suavizador', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Agua Dura', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida Agua Suave', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'BRINE', label: 'Salmuera', relX: eq.diametro/2, relY: 0, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        filtro_carbon: {
            nombre: 'Filtro Carbón Activado', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'BACKWASH', label: 'Retrolavado', relX: eq.diametro/2, relY: eq.altura/4, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        dosificador_quimico: {
            nombre: 'Dosificador Químico', categoria: 'tratamiento', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión Químico', relX: -eq.largo/2, relY: -eq.altura/4, relZ: 0, diametro: 1, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 1, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        canaleta_parshall: {
            nombre: 'Canaleta Parshall', categoria: 'tratamiento', forma: 'canal',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 12, tipoConexion: 'ABIERTA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 12, tipoConexion: 'ABIERTA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        espesador: {
            nombre: 'Espesador', categoria: 'tratamiento', forma: 'cono',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OVERFLOW', label: 'Rebose', relX: eq.diametro/2, relY: eq.altura/3, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'UNDERFLOW', label: 'Descarga Fondo', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        floculador: {
            nombre: 'Floculador', categoria: 'tratamiento', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        celda_electrolitica: {
            nombre: 'Celda Electrolítica', categoria: 'tratamiento', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida Tratada', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'VENT', label: 'Venteo H2', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 0, dy: 1, dz: 0 } }
            ]
        },
        separador_trifasico: {
            nombre: 'Separador Trifásico', categoria: 'proceso', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Producción', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 10, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'GAS', label: 'Salida Gas', relX: 0, relY: eq.diametro/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OIL', label: 'Salida Petróleo', relX: eq.largo/2, relY: 0, relZ: -eq.diametro/4, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: -1 } },
                { id: 'WATER', label: 'Salida Agua', relX: eq.largo/2, relY: 0, relZ: -eq.diametro/2, diametro: 3, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: -1 } }
            ]
        },
        slug_catcher: {
            nombre: 'Slug Catcher', categoria: 'proceso', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 16, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'GAS', label: 'Gas', relX: eq.largo/2, relY: eq.diametro/2, relZ: 0, diametro: 12, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 1, dz: 0 } },
                { id: 'LIQ', label: 'Líquido', relX: eq.largo/2, relY: -eq.diametro/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: -1, dz: 0 } }
            ]
        },
        calentador_fuego_directo: {
            nombre: 'Calentador Fuego Directo (Heater Treater)', categoria: 'termico', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Emulsión', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OIL', label: 'Salida Petróleo', relX: eq.largo/2, relY: eq.diametro/3, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'WATER', label: 'Salida Agua', relX: eq.largo/2, relY: -eq.diametro/3, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'GAS', label: 'Gas Combustible', relX: 0, relY: 0, relZ: -eq.diametro/2, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 0, dy: 0, dz: -1 } }
            ]
        },
        antorcha: {
            nombre: 'Antorcha (Flare)', categoria: 'seguridad', forma: 'torre',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Gas de Venteo', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 12, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'PILOT', label: 'Gas Piloto', relX: 0, relY: eq.altura/2 - 1000, relZ: eq.diametro/2, diametro: 1, tipoConexion: 'NPT', orientacion: { dx: 0, dy: 0, dz: 1 } }
            ]
        },
        skid_inyeccion: {
            nombre: 'Skid Inyección Química', categoria: 'proceso', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión Químico', relX: -eq.largo/2, relY: -eq.altura/4, relZ: 0, diametro: 1, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Inyección', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 1, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        filtro_duplex: {
            nombre: 'Filtro Dúplex', categoria: 'filtracion', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        columna_fraccionadora: {
            nombre: 'Columna Fraccionadora', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: -eq.altura/4, relZ: eq.diametro/2, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                { id: 'TOP', label: 'Destilado', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'BOT', label: 'Fondos', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'REF', label: 'Reflujo', relX: eq.diametro/2, relY: eq.altura/3, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        condensador: {
            nombre: 'Condensador', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'VAP_IN', label: 'Entrada Vapor', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'COND_OUT', label: 'Salida Condensado', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'CW_IN', label: 'Entrada Agua Enfriamiento', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'CW_OUT', label: 'Salida Agua Enfriamiento', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        evaporador: {
            nombre: 'Evaporador', categoria: 'termico', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: eq.altura/3, relZ: eq.diametro/2, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                { id: 'VAPOR', label: 'Vapor', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'CONC', label: 'Concentrado', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        cristalizador: {
            nombre: 'Cristalizador', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'PROD', label: 'Producto Cristalizado', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        secador_rotativo: {
            nombre: 'Secador Rotativo', categoria: 'termico', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Sólidos Húmedos', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida Sólidos Secos', relX: eq.largo/2, relY: -eq.diametro/4, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'AIR_IN', label: 'Entrada Aire Caliente', relX: eq.largo/3, relY: eq.diametro/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'AIR_OUT', label: 'Salida Aire Húmedo', relX: -eq.largo/3, relY: eq.diametro/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } }
            ]
        },
        absorbedor: {
            nombre: 'Absorbedor', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'GAS_IN', label: 'Entrada Gas', relX: 0, relY: -eq.altura/4, relZ: eq.diametro/2, diametro: 10, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                { id: 'GAS_OUT', label: 'Salida Gas Tratado', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 10, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'LEAN_IN', label: 'Entrada Solvente Pobre', relX: eq.diametro/2, relY: eq.altura/3, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'RICH_OUT', label: 'Salida Solvente Rico', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        stripper: {
            nombre: 'Stripper / Despojador', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: eq.altura/3, relZ: eq.diametro/2, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                { id: 'STEAM', label: 'Vapor Despojo', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'OVHD', label: 'Producto Cima', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'BOT', label: 'Fondos', relX: eq.diametro/2, relY: -eq.altura/3, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        reactor_encamisado: {
            nombre: 'Reactor Encamisado', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'PROD', label: 'Producto', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'JACK_IN', label: 'Entrada Chaqueta', relX: eq.diametro/2 + 100, relY: 0, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'JACK_OUT', label: 'Salida Chaqueta', relX: -(eq.diametro/2 + 100), relY: eq.altura/4, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } }
            ]
        },
        autoclave: {
            nombre: 'Autoclave', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'STEAM', label: 'Vapor', relX: eq.diametro/2, relY: 0, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        centrifuga: {
            nombre: 'Centrífuga', categoria: 'rotativo', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'SOLIDS', label: 'Sólidos', relX: eq.largo/2, relY: -eq.diametro/4, relZ: 0, diametro: 4, tipoConexion: 'ABIERTA', orientacion: { dx: 1, dy: -1, dz: 0 } },
                { id: 'LIQUID', label: 'Líquido', relX: eq.largo/2, relY: eq.diametro/4, relZ: 0, diametro: 3, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        filtro_prensa: {
            nombre: 'Filtro Prensa', categoria: 'filtracion', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Lodo', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'FILT', label: 'Salida Filtrado', relX: eq.largo/2, relY: -eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'NPT', orientacion: { dx: 1, dy: -1, dz: 0 } }
            ]
        },
        agitador: {
            nombre: 'Agitador / Mezclador', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN1', label: 'Entrada 1', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'IN2', label: 'Entrada 2', relX: eq.diametro/2, relY: eq.altura/3, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        molino: {
            nombre: 'Molino', categoria: 'rotativo', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: eq.diametro/4, relZ: 0, diametro: 8, tipoConexion: 'ABIERTA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: -eq.diametro/4, relZ: 0, diametro: 6, tipoConexion: 'ABIERTA', orientacion: { dx: 1, dy: -1, dz: 0 } }
            ]
        },
        filtro_tambor: {
            nombre: 'Filtro Tambor Rotativo', categoria: 'filtracion', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Suspensión', relX: -eq.largo/2, relY: -eq.diametro/4, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'FILT', label: 'Filtrado', relX: eq.largo/2, relY: 0, relZ: -eq.diametro/2, diametro: 3, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 0, dz: -1 } },
                { id: 'CAKE', label: 'Torta', relX: eq.largo/2, relY: 0, relZ: eq.diametro/2, diametro: 4, tipoConexion: 'ABIERTA', orientacion: { dx: 1, dy: 0, dz: 1 } }
            ]
        },
        tanque_aseptico: {
            nombre: 'Tanque Aséptico', categoria: 'almacenamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Producto', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida Producto', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: -1, dz: 0 } },
                { id: 'CIP', label: 'CIP', relX: eq.diametro/2, relY: eq.altura/3, relZ: 0, diametro: 2, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        tina_quesera: {
            nombre: 'Tina Quesera', categoria: 'proceso', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Leche', relX: -eq.largo/2, relY: eq.altura/3, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida Suero', relX: eq.largo/2, relY: -eq.altura/4, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: -1, dz: 0 } }
            ]
        },
        centrifuga_discos: {
            nombre: 'Centrífuga de Discos', categoria: 'rotativo', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'LIGHT', label: 'Fase Ligera', relX: eq.diametro/2, relY: eq.altura/3, relZ: 0, diametro: 2, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'HEAVY', label: 'Fase Pesada', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 2, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        homogeneizador_ap: {
            nombre: 'Homogeneizador Alta Presión', categoria: 'proceso', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        esterilizador_uht: {
            nombre: 'Esterilizador UHT', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Producto', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida Esterilizado', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'STEAM', label: 'Vapor', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 0, dy: 1, dz: 0 } }
            ]
        },
        llenadora: {
            nombre: 'Llenadora', categoria: 'envasado', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada Producto', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'CIP', label: 'Retorno CIP', relX: eq.largo/2, relY: -eq.altura/4, relZ: 0, diametro: 2, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        }
    };

    // ================================================================
    // 3. COMPONENTES DE TUBERÍA
    // ================================================================
    const components = {
        TEE_EQUAL_CS: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta Acero', abbr: 'TE', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB', material: 'Acero al Carbono' },
        TEE_REDUCING_CS: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora Acero', abbr: 'TR', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        TEE_EQUAL_PPR: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta PPR', abbr: 'TE', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        TEE_REDUCING_PPR: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora PPR', abbr: 'TR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        TEE_EQUAL_HDPE: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta HDPE', abbr: 'TE', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        TEE_EQUAL_PVC: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta PVC', abbr: 'TE', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC' },
        CROSS_CS: { tipo: 'CROSS', nombre: 'Cruz Acero', abbr: 'CR', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        TEE_EQUAL_SS: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta Inoxidable', abbr: 'TE', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        TEE_REDUCING_SS: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora Inoxidable', abbr: 'TR', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        TEE_REDUCING_PVC: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora PVC', abbr: 'TR', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC' },
        TEE_REDUCING_HDPE: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora HDPE', abbr: 'TR', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        PIPE_PPR_PN12_5: { tipo: 'PIPE', nombre: 'Tubo PPR PN12.5', abbr: 'PP', spec: 'PPR_PN12_5' },
        PIPE_CS_SCH80: { tipo: 'PIPE', nombre: 'Tubo Acero SCH80', abbr: 'CS', spec: 'ACERO_SCH80' },
        PIPE_SS_SANITARY: { tipo: 'PIPE', nombre: 'Tubo Sanitario Acero Inox', abbr: 'SS', spec: 'SS_SANITARY' },
        PIPE_HDPE_PE100: { tipo: 'PIPE', nombre: 'Tubo HDPE PE100', abbr: 'PE', spec: 'HDPE_PE100' },
        PIPE_PVC_SCH80: { tipo: 'PIPE', nombre: 'Tubo PVC SCH80', abbr: 'PV', spec: 'PVC_SCH80' },
        GATE_VALVE_CS_150: { tipo: 'GATE_VALVE', nombre: 'Válvula Compuerta Acero 150#', abbr: 'GV', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        GATE_VALVE_PPR: { tipo: 'GATE_VALVE', nombre: 'Válvula Compuerta PPR', abbr: 'GV', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        GLOBE_VALVE_CS_150: { tipo: 'GLOBE_VALVE', nombre: 'Válvula Globo Acero 150#', abbr: 'GL', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        GLOBE_VALVE_SS_300: { tipo: 'GLOBE_VALVE', nombre: 'Válvula Globo Inox 300#', abbr: 'GL', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        BUTTERFLY_VALVE_CS_150: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa Acero 150#', abbr: 'VB', spec: 'ACERO_150_RF', conexion: 'WAFER', material: 'Acero al Carbono' },
        BUTTERFLY_VALVE_PPR: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa PPR', abbr: 'VB', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        BUTTERFLY_VALVE_SS_SANITARY: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa Sanitaria', abbr: 'VB', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: 'Acero Inoxidable' },
        BALL_VALVE_CS_150: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola Acero 150#', abbr: 'BA', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        BALL_VALVE_PPR: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola PPR', abbr: 'BA', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        BALL_VALVE_HDPE: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola HDPE', abbr: 'BA', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        BALL_VALVE_SS: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola Inoxidable', abbr: 'BA', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        CHECK_VALVE_SWING_CS: { tipo: 'CHECK_VALVE', nombre: 'Válvula Check Swing Acero', abbr: 'CK', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        CHECK_VALVE_WAFER_SS: { tipo: 'CHECK_VALVE', nombre: 'Válvula Check Wafer Inox', abbr: 'CK', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        CHECK_VALVE_PPR: { tipo: 'CHECK_VALVE', nombre: 'Válvula Check PPR', abbr: 'CK', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        DIAPHRAGM_VALVE_PTFE: { tipo: 'DIAPHRAGM_VALVE', nombre: 'Válvula de Diafragma PTFE', abbr: 'DV', spec: 'PTFE_LINED', material: 'PTFE' },
        CONTROL_VALVE_CS: { tipo: 'CONTROL_VALVE', nombre: 'Válvula de Control Acero', abbr: 'CV', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        PRESSURE_RELIEF_VALVE: { tipo: 'PRESSURE_RELIEF', nombre: 'Válvula de Alivio', abbr: 'RV', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        SAFETY_VALVE_SS: { tipo: 'SAFETY_VALVE', nombre: 'Válvula de Seguridad Inox', abbr: 'SV', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        ELBOW_90_LR_CS: { tipo: 'ELBOW_90_LR', nombre: 'Codo 90° Radio Largo Acero', abbr: 'EL', spec: 'ACERO_150_RF', material: 'Acero al Carbono', angulo: 90 },
        ELBOW_90_SR_CS: { tipo: 'ELBOW_90_SR', nombre: 'Codo 90° Radio Corto Acero', abbr: 'EL', spec: 'ACERO_150_RF', material: 'Acero al Carbono', angulo: 90 },
        ELBOW_45_CS: { tipo: 'ELBOW_45', nombre: 'Codo 45° Acero', abbr: 'E4', spec: 'ACERO_150_RF', material: 'Acero al Carbono', angulo: 45 },
        ELBOW_90_PPR: { tipo: 'ELBOW_90_PPR', nombre: 'Codo 90° PPR', abbr: 'EL', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR', angulo: 90 },
        ELBOW_45_PPR: { tipo: 'ELBOW_45_PPR', nombre: 'Codo 45° PPR', abbr: 'E4', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR', angulo: 45 },
        ELBOW_90_HDPE: { tipo: 'ELBOW_90_HDPE', nombre: 'Codo 90° HDPE', abbr: 'EL', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE', angulo: 90 },
        ELBOW_45_HDPE: { tipo: 'ELBOW_45_HDPE', nombre: 'Codo 45° HDPE', abbr: 'E4', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE', angulo: 45 },
        ELBOW_90_PVC: { tipo: 'ELBOW_90_PVC', nombre: 'Codo 90° PVC', abbr: 'EL', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC', angulo: 90 },
        ELBOW_45_PVC: { tipo: 'ELBOW_45_PVC', nombre: 'Codo 45° PVC', abbr: 'E4', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC', angulo: 45 },
        ELBOW_90_LR_SS: { tipo: 'ELBOW_90_LR', nombre: 'Codo 90° Radio Largo Inox', abbr: 'EL', spec: 'SS_150_RF', material: 'Acero Inoxidable', angulo: 90 },
        ELBOW_45_SS: { tipo: 'ELBOW_45', nombre: 'Codo 45° Inoxidable', abbr: 'E4', spec: 'SS_150_RF', material: 'Acero Inoxidable', angulo: 45 },
        ELBOW_90_SANITARY: { tipo: 'ELBOW_90_SR', nombre: 'Codo 90° Sanitario', abbr: 'EL', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: 'Acero Inoxidable', angulo: 90 },
        CONCENTRIC_REDUCER_CS: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico Acero', abbr: 'RC', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        ECCENTRIC_REDUCER_CS: { tipo: 'ECCENTRIC_REDUCER', nombre: 'Reductor Excéntrico Acero', abbr: 'RE', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        CONCENTRIC_REDUCER_PPR: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico PPR', abbr: 'RC', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        CONCENTRIC_REDUCER_HDPE: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico HDPE', abbr: 'RC', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        CONCENTRIC_REDUCER_SS: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico Inox', abbr: 'RC', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        CONCENTRIC_REDUCER_PVC: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico PVC', abbr: 'RC', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC' },
        ECCENTRIC_REDUCER_PPR: { tipo: 'ECCENTRIC_REDUCER', nombre: 'Reductor Excéntrico PPR', abbr: 'RE', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        WELD_NECK_FLANGE_150: { tipo: 'WELD_NECK_FLANGE', nombre: 'Brida Cuello Soldable 150#', abbr: 'FL', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        SLIP_ON_FLANGE_150: { tipo: 'SLIP_ON_FLANGE', nombre: 'Brida Slip-On 150#', abbr: 'FL', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        BLIND_FLANGE_150: { tipo: 'BLIND_FLANGE', nombre: 'Brida Ciega 150#', abbr: 'FB', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        LAP_JOINT_FLANGE_150: { tipo: 'LAP_JOINT_FLANGE', nombre: 'Brida Loca Acero', abbr: 'FL', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        STUB_END_PPR: { tipo: 'STUB_END', nombre: 'Portabrida PPR', abbr: 'SE', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        STUB_END_HDPE: { tipo: 'STUB_END', nombre: 'Portabrida HDPE', abbr: 'SE', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        CAP_CS: { tipo: 'CAP', nombre: 'Tapón Acero', abbr: 'CA', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        CAP_PPR: { tipo: 'CAP', nombre: 'Tapón PPR', abbr: 'CA', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        UNION_CS_3000: { tipo: 'UNION', nombre: 'Unión Universal Acero 3000', abbr: 'UN', spec: 'ACERO_SCH80', material: 'Acero al Carbono' },
        UNION_PPR: { tipo: 'UNION', nombre: 'Unión Universal PPR', abbr: 'UN', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        UNION_HDPE: { tipo: 'UNION', nombre: 'Unión Universal HDPE', abbr: 'UN', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        BULKHEAD_PE_3IN: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty 3 pulgadas', abbr: 'BH', material: 'PP_EPDM', conexion: 'NPT_HEMBRA', diametro: 3 },
        BULKHEAD_PE_4IN: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty 4 pulgadas', abbr: 'BH', material: 'PP_EPDM', conexion: 'NPT_HEMBRA', diametro: 4 },
        BULKHEAD: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty', abbr: 'BH', material: 'PP_EPDM', conexion: 'NPT_HEMBRA' },
        ADAPTADOR_MACHO_PPR_3IN: { tipo: 'TRANSITION', nombre: 'Adaptador Macho PPR 90mm x 3 NPT', abbr: 'AM', spec_origen: 'PPR_PN12_5', spec_destino: 'ACERO_SCH80', conexion_origen: 'TERMOFUSION', conexion_destino: 'NPT_MACHO' },
        ADAPTADOR_HEMBRA_PPR_3IN: { tipo: 'TRANSITION', nombre: 'Adaptador Hembra PPR 90mm x 3 NPT', abbr: 'AH', spec_origen: 'PPR_PN12_5', spec_destino: 'ACERO_SCH80', conexion_origen: 'TERMOFUSION', conexion_destino: 'NPT_HEMBRA' },
        TRANSITION_HDPE_STEEL: { tipo: 'TRANSITION', nombre: 'Transición HDPE x Acero', abbr: 'TR', spec_origen: 'HDPE_PE100', spec_destino: 'ACERO_150_RF', conexion_origen: 'ELECTROFUSION', conexion_destino: 'BRIDADA' },
        UNION_UNIVERSAL_ACERO_3IN: { tipo: 'UNION_ACERO', nombre: 'Unión Universal Acero 3 pulgadas', abbr: 'UN', spec: 'ACERO_SCH80', conexion: 'NPT_HEMBRA', material: 'Acero Galvanizado' },
        NIPLE_ACERO_3IN_150MM: { tipo: 'NIPPLE', nombre: 'Niple Acero 3 x 150 mm', abbr: 'NI', spec: 'ACERO_SCH80', conexion: 'NPT_MACHO', material: 'Acero al Carbono', longitud_total: 150 },
        NIPLE_ACERO_3IN_100MM: { tipo: 'NIPPLE', nombre: 'Niple Acero 3 x 100 mm', abbr: 'NI', spec: 'ACERO_SCH80', conexion: 'NPT_MACHO', material: 'Acero al Carbono', longitud_total: 100 },
        EXPANSION_JOINT_PPR: { tipo: 'EXPANSION_JOINT', nombre: 'Junta de Expansión PPR', abbr: 'EJ', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR_EPDM' },
        EXPANSION_JOINT_CS: { tipo: 'EXPANSION_JOINT', nombre: 'Junta de Expansión Acero', abbr: 'EJ', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        Y_STRAINER_CS: { tipo: 'Y_STRAINER', nombre: 'Filtro Tipo Y Acero', abbr: 'YS', spec: 'ACERO_150_RF', clase: '150', malla: '40 Mesh' },
        Y_STRAINER_PPR: { tipo: 'Y_STRAINER', nombre: 'Filtro Tipo Y PPR', abbr: 'YS', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', malla: '40 Mesh' },
        T_STRAINER: { tipo: 'T_STRAINER', nombre: 'Filtro Tipo T', abbr: 'TS', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        BASKET_STRAINER: { tipo: 'BASKET_STRAINER', nombre: 'Filtro Canasta', abbr: 'BS', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        STEAM_TRAP_THERMODYNAMIC: { tipo: 'STEAM_TRAP', subtipo: 'THERMODYNAMIC', nombre: 'Trampa de Vapor Termodinámica', abbr: 'ST', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        STEAM_TRAP_FLOAT: { tipo: 'STEAM_TRAP', subtipo: 'FLOAT', nombre: 'Trampa de Vapor de Flotador', abbr: 'SF', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        STEAM_TRAP_BUCKET: { tipo: 'STEAM_TRAP', subtipo: 'BUCKET', nombre: 'Trampa de Vapor de Cubeta', abbr: 'SB', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        PRESSURE_GAUGE: { tipo: 'PRESSURE_GAUGE', nombre: 'Manómetro', abbr: 'PG', rango: '0-100 psi', conexion: '1/2 NPT' },
        TEMPERATURE_GAUGE: { tipo: 'TEMPERATURE_GAUGE', nombre: 'Termómetro', abbr: 'TG', rango: '0-150 °C' },
        FLOW_METER_MAG: { tipo: 'FLOW_METER', subtipo: 'MAGNETICO', nombre: 'Caudalímetro Magnético', abbr: 'FM', conexion: 'BRIDADA' },
        PRESSURE_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Presión', abbr: 'PT', señal: '4-20 mA' },
        LEVEL_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Nivel', abbr: 'LT', señal: '4-20 mA' },
        TEMPERATURE_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Temperatura', abbr: 'TT', señal: '4-20 mA' },
        ROTAMETER: { tipo: 'INSTRUMENT', nombre: 'Rotámetro', abbr: 'RO', conexion: 'ROSCADO' },
        SIGHT_GLASS: { tipo: 'INSTRUMENT', nombre: 'Visor de Flujo', abbr: 'SG', conexion: 'ROSCADO' },
        LEVEL_SWITCH_RANA: { tipo: 'LEVEL_SWITCH_RANA', nombre: 'Switch de Nivel Tipo Rana', abbr: 'LS', conexion: '1/2 NPT' },
        PIPE_SHOE: { tipo: 'PIPE_SHOE', nombre: 'Zapata', abbr: 'SH', material: 'Acero al Carbono' },
        U_BOLT: { tipo: 'U_BOLT', nombre: 'Abrazadera U-Bolt', abbr: 'UB', material: 'Acero Galvanizado' },
        GUIDE: { tipo: 'GUIDE', nombre: 'Guía', abbr: 'GD', material: 'Acero al Carbono' },
        ANCHOR: { tipo: 'ANCHOR', nombre: 'Anclaje Fijo', abbr: 'AN', material: 'Acero al Carbono' },
        HANGER: { tipo: 'HANGER', nombre: 'Colgador', abbr: 'HG', material: 'Acero al Carbono' },
        SPRING_HANGER: { tipo: 'SPRING_HANGER', nombre: 'Colgador de Resorte', abbr: 'SH', material: 'Acero al Carbono' },
        PIPE_CLAMP: { tipo: 'PIPE_CLAMP', nombre: 'Abrazadera', abbr: 'PC', material: 'Acero al Carbono' },
        CAMLOCK_MALE: { tipo: 'CAMLOCK', subtipo: 'MALE', nombre: 'Acople Camlock Macho', abbr: 'CM', material: 'Acero Inoxidable' },
        CAMLOCK_FEMALE: { tipo: 'CAMLOCK', subtipo: 'FEMALE', nombre: 'Acople Camlock Hembra', abbr: 'CF', material: 'Acero Inoxidable' },
        QUICK_CONNECT: { tipo: 'QUICK_CONNECT', nombre: 'Conexión Rápida', abbr: 'QC', material: 'Acero Inoxidable' },
        FLEXIBLE_HOSE: { tipo: 'HOSE', nombre: 'Manguera Flexible', abbr: 'HO', material: 'EPDM' },
        METALLIC_HOSE: { tipo: 'HOSE', subtipo: 'METALLIC', nombre: 'Manguera Metálica', abbr: 'HM', material: 'Acero Inoxidable' },
        PTFE_HOSE: { tipo: 'HOSE', subtipo: 'PTFE', nombre: 'Manguera PTFE', abbr: 'HP', material: 'PTFE' },
        SILENCER: { tipo: 'SILENCER', nombre: 'Silenciador', abbr: 'SI', material: 'Acero al Carbono' },
        VENT_SILENCER: { tipo: 'SILENCER', subtipo: 'VENT', nombre: 'Silenciador de Venteo', abbr: 'VS', material: 'Acero Inoxidable' },
        FLAME_ARRESTER: { tipo: 'FLAME_ARRESTER', nombre: 'Arrestador de Llama', abbr: 'FA', material: 'Acero Inoxidable' },
        VACUUM_BREAKER: { tipo: 'VACUUM_BREAKER', nombre: 'Rompedor de Vacío', abbr: 'VB', material: 'Acero Inoxidable' },
        DRAIN_VALVE: { tipo: 'DRAIN_VALVE', nombre: 'Válvula de Purga', abbr: 'DV', spec: 'ACERO_SCH80', conexion: 'NPT', material: 'Acero al Carbono' },
        AIR_RELEASE_VALVE: { tipo: 'AIR_RELEASE', nombre: 'Válvula de Liberación de Aire', abbr: 'AR', material: 'Acero Inoxidable' },
        SAMPLE_COOLER: { tipo: 'SAMPLE_COOLER', nombre: 'Enfriador de Muestra', abbr: 'SC', material: 'Acero Inoxidable' },
        SAMPLE_VALVE: { tipo: 'SAMPLE_VALVE', nombre: 'Válvula de Muestreo', abbr: 'SV', material: 'Acero Inoxidable' },
        PLUG_VALVE_LUBRICATED: { tipo: 'PLUG_VALVE', nombre: 'Válvula Tapón Lubricada', abbr: 'PV', spec: 'CS_300_RF', material: 'Acero al Carbono' },
        CHOKE_VALVE: { tipo: 'CHOKE_VALVE', nombre: 'Válvula Choke', abbr: 'CH', spec: 'CS_600_RF', material: 'Acero al Carbono' },
        RTJ_FLANGE_600: { tipo: 'RTJ_FLANGE', nombre: 'Brida RTJ 600#', abbr: 'FR', spec: 'CS_600_RF', cara: 'RTJ', material: 'Acero al Carbono' },
        INSULATING_JOINT: { tipo: 'INSULATING_JOINT', nombre: 'Junta Aislante', abbr: 'IJ', spec: 'CS_300_RF', material: 'Acero al Carbono' },
        DUPLEX_STRAINER: { tipo: 'DUPLEX_STRAINER', nombre: 'Filtro Dúplex', abbr: 'DS', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        PRESSURE_SAFETY_VALVE: { tipo: 'SAFETY_VALVE', subtipo: 'PILOT', nombre: 'PSV Pilotada', abbr: 'PS', spec: 'CS_300_RF', material: 'Acero al Carbono' },
        RUPTURE_DISC: { tipo: 'RUPTURE_DISC', nombre: 'Disco de Ruptura', abbr: 'RD', spec: 'CS_300_RF', material: 'Inconel' },
        BALL_VALVE_TRUNNION: { tipo: 'BALL_VALVE', subtipo: 'TRUNNION', nombre: 'Válvula Bola Trunnion', abbr: 'BT', spec: 'CS_600_RF', material: 'Acero al Carbono' },
        PIPELINE_PIG_LAUNCHER: { tipo: 'PIG_LAUNCHER', nombre: 'Lanzador de Pig', abbr: 'PL', spec: 'CS_600_RF', material: 'Acero al Carbono' },
        AIR_DIFFUSER: { tipo: 'AIR_DIFFUSER', nombre: 'Difusor de Aire', abbr: 'AD', material: 'EPDM', conexion: 'NPT' },
        CHLORINE_EJECTOR: { tipo: 'EJECTOR', nombre: 'Eyector de Cloro', abbr: 'EC', material: 'PVC', conexion: 'NPT' },
        MEDIA_FILTER: { tipo: 'MEDIA', nombre: 'Medio Filtrante', abbr: 'MF', material: 'Arena/Antracita' },
        CHEMICAL_INJECTOR: { tipo: 'INJECTOR', nombre: 'Inyector Químico', abbr: 'CI', material: '316L', conexion: 'NPT' },
        STATIC_MIXER: { tipo: 'STATIC_MIXER', nombre: 'Mezclador Estático', abbr: 'SM', spec: 'PVC_SCH80', material: 'PVC' },
        UV_STERILIZER: { tipo: 'UV_STERILIZER', nombre: 'Esterilizador UV', abbr: 'UV', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        OZONE_GENERATOR: { tipo: 'OZONE_GENERATOR', nombre: 'Generador de Ozono', abbr: 'OZ', material: '316L' },
        CRYOGENIC_VALVE: { tipo: 'CRYOGENIC_VALVE', nombre: 'Válvula Criogénica', abbr: 'CV', spec: 'CS_CRYO', material: 'Acero Criogénico' },
        FUEL_GAS_KNOCKOUT: { tipo: 'KNOCKOUT_DRUM', nombre: 'Fuel Gas Knockout', abbr: 'FG', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        ORIFICE_FLANGE: { tipo: 'ORIFICE_FLANGE', nombre: 'Brida Orificio', abbr: 'FO', spec: 'CS_300_RF', material: 'Acero al Carbono' },
        SPECTACLE_BLIND: { tipo: 'SPECTACLE_BLIND', nombre: 'Juego de Bridas Ciegas (8)', abbr: 'SB', spec: 'CS_300_RF', material: 'Acero al Carbono' },
        STEAM_DESUPERHEATER: { tipo: 'DESUPERHEATER', nombre: 'Desobrecalentador Vapor', abbr: 'DS', spec: 'CS_300_RF', material: 'Acero al Carbono' },
        THERMAL_OIL_HEATER: { tipo: 'THERMAL_HEATER', nombre: 'Calentador Aceite Térmico', abbr: 'TO', spec: 'CS_300_RF', material: 'Acero al Carbono' },
        GLASS_LINED_VALVE: { tipo: 'GLASS_LINED_VALVE', nombre: 'Válvula Revestida Vidrio', abbr: 'GV', spec: 'GLASS_LINED', material: 'Acero Revestido' },
        DETONATION_ARRESTER: { tipo: 'DETONATION_ARRESTER', nombre: 'Arrestador de Detonación', abbr: 'DA', spec: 'ACERO_150_RF', material: 'Acero Inoxidable' },
        PISTON_SAMPLE_VALVE: { tipo: 'PISTON_SAMPLE_VALVE', nombre: 'Válvula Muestreo Pistón', abbr: 'PS', material: '316L', conexion: 'NPT' },
        MAGNETIC_DRIVE_PUMP: { tipo: 'MAG_DRIVE_PUMP', nombre: 'Bomba Accionamiento Magnético', abbr: 'MP', spec: 'PTFE_LINED', material: 'PTFE' },
        CORIOLIS_METER: { tipo: 'FLOW_METER', subtipo: 'CORIOLIS', nombre: 'Caudalímetro Coriolis', abbr: 'CM', spec: 'SS_150_RF', material: '316L' },
        PH_METER: { tipo: 'INSTRUMENT', nombre: 'Medidor de pH', abbr: 'PH', conexion: 'ROSCADO' },
        CONDUCTIVITY_METER: { tipo: 'INSTRUMENT', nombre: 'Conductivímetro', abbr: 'CD', conexion: 'ROSCADO' },
        ASEPTIC_VALVE: { tipo: 'ASEPTIC_VALVE', nombre: 'Válvula Aséptica', abbr: 'AV', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: '316L' },
        SIGHT_GLASS_SANITARY: { tipo: 'SIGHT_GLASS_SANITARY', nombre: 'Mirilla Sanitaria', abbr: 'SG', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: '316L' },
        SPRAY_BALL: { tipo: 'SPRAY_BALL', nombre: 'Spray Ball CIP', abbr: 'SB', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: '316L' },
        SANITARY_STRAINER: { tipo: 'SANITARY_STRAINER', nombre: 'Filtro Sanitario', abbr: 'SS', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: '316L' },
        STEAM_TRAP_SANITARY: { tipo: 'STEAM_TRAP_SANITARY', nombre: 'Trampa Vapor Sanitaria', abbr: 'ST', spec: 'SS_SANITARY', material: '316L' },
        SANITARY_CHECK_VALVE: { tipo: 'CHECK_VALVE_SANITARY', nombre: 'Check Sanitaria', abbr: 'CK', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: '316L' },
        SANITARY_SAMPLE_VALVE: { tipo: 'SAMPLE_VALVE_SANITARY', nombre: 'Válvula Muestreo Sanitaria', abbr: 'SV', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: '316L' },
        SANITARY_PRESSURE_GAUGE: { tipo: 'PRESSURE_GAUGE_SANITARY', nombre: 'Manómetro Sanitario', abbr: 'PG', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP' }
    };

    // ================================================================
    // 4-10. GENERADORES, DIMENSIONES, ALIAS, FACTORÍA, API
    // ================================================================
    // [Se mantiene exactamente igual que en v4.1.1]
    // ... (todo el resto del archivo sin cambios)

    function calculateLineDirection(line, param) {
        if (!line) return { dx: 1, dy: 0, dz: 0 };
        let pts = [];
        if (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getLinePoints) {
            pts = SmartFlowCore.getLinePoints(line) || [];
        } else {
            pts = line._cachedPoints || line.points3D || line.points || [];
        }
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
        let perp1 = { dx: -dir.dz, dy: 0, dz: dir.dx };
        let len1 = Math.hypot(perp1.dx, perp1.dy, perp1.dz);
        if (len1 < 0.1) perp1 = { dx: 1, dy: 0, dz: 0 };
        else { perp1.dx /= len1; perp1.dy /= len1; perp1.dz /= len1; }
        let perp2 = { dx: -dir.dy * dir.dx, dy: dir.dx * dir.dx + dir.dz * dir.dz, dz: -dir.dy * dir.dz };
        let len2 = Math.hypot(perp2.dx, perp2.dy, perp2.dz);
        if (len2 < 0.1) perp2 = { dx: 0, dy: 1, dz: 0 };
        else { perp2.dx /= len2; perp2.dy /= len2; perp2.dz /= len2; }
        return { horizontal: perp1, vertical: perp2 };
    }

    function getComponentOffset(tipo, diametro) {
        const dim = getComponentDimension(tipo, diametro) / 2;
        return dim > 0 ? dim : 50;
    }

    const baseGenerators = {
        TEE_EQUAL: (line, param, diametro, orientacionSugerida) => {
            const dir = calculateLineDirection(line, param);
            const perps = getPerpendicularVector(dir);
            const offset = getComponentOffset('TEE_EQUAL', diametro);
            let perp;
            if (orientacionSugerida) {
                perp = orientacionSugerida;
                const len = Math.hypot(perp.dx, perp.dy, perp.dz) || 1;
                perp = { dx: perp.dx/len, dy: perp.dy/len, dz: perp.dz/len };
            } else { perp = perps.vertical; }
            return [
                { id: 'RUN1', label: 'Entrada', relX: -dir.dx*offset, relY: -dir.dy*offset, relZ: -dir.dz*offset, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relX: dir.dx*offset, relY: dir.dy*offset, relZ: dir.dz*offset, orientacion: dir, diametro },
                { id: 'BRANCH', label: 'Derivación', relX: perp.dx*offset, relY: perp.dy*offset, relZ: perp.dz*offset, orientacion: perp, diametro }
            ];
        },
        TEE_REDUCING: (line, param, diametro, orientacionSugerida) => {
            const dir = calculateLineDirection(line, param);
            const perps = getPerpendicularVector(dir);
            const offset = getComponentOffset('TEE_REDUCING', diametro);
            let perp;
            if (orientacionSugerida) {
                perp = orientacionSugerida;
                const len = Math.hypot(perp.dx, perp.dy, perp.dz) || 1;
                perp = { dx: perp.dx/len, dy: perp.dy/len, dz: perp.dz/len };
            } else { perp = perps.vertical; }
            return [
                { id: 'RUN1', label: 'Entrada', relX: -dir.dx*offset, relY: -dir.dy*offset, relZ: -dir.dz*offset, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relX: dir.dx*offset, relY: dir.dy*offset, relZ: dir.dz*offset, orientacion: dir, diametro },
                { id: 'BRANCH', label: 'Derivación', relX: perp.dx*offset, relY: perp.dy*offset, relZ: perp.dz*offset, orientacion: perp, diametro: diametro * 0.75 }
            ];
        },
        CROSS: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perps = getPerpendicularVector(dir);
            const perp1 = perps.horizontal;
            const perp2 = perps.vertical;
            const offset = getComponentOffset('CROSS', diametro);
            return [
                { id: 'RUN1', label: 'Entrada', relX: -dir.dx*offset, relY: -dir.dy*offset, relZ: -dir.dz*offset, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relX: dir.dx*offset, relY: dir.dy*offset, relZ: dir.dz*offset, orientacion: dir, diametro },
                { id: 'BRANCH1', label: 'Derivación 1', relX: perp1.dx*offset, relY: perp1.dy*offset, relZ: perp1.dz*offset, orientacion: perp1, diametro },
                { id: 'BRANCH2', label: 'Derivación 2', relX: perp2.dx*offset, relY: perp2.dy*offset, relZ: perp2.dz*offset, orientacion: perp2, diametro }
            ];
        },
        VALVE: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const offset = getComponentOffset('VALVE', diametro);
            return [
                { id: 'IN', label: 'Entrada', relX: -dir.dx*offset, relY: -dir.dy*offset, relZ: -dir.dz*offset, orientacion: dir, diametro },
                { id: 'OUT', label: 'Salida', relX: dir.dx*offset, relY: dir.dy*offset, relZ: dir.dz*offset, orientacion: dir, diametro }
            ];
        },
        REDUCER: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const offset = getComponentOffset('REDUCER', diametro);
            const dMenor = diametro * 0.625;
            return [
                { id: 'IN', label: 'Entrada', relX: -dir.dx*offset, relY: -dir.dy*offset, relZ: -dir.dz*offset, orientacion: dir, diametro },
                { id: 'OUT', label: 'Salida', relX: dir.dx*offset, relY: dir.dy*offset, relZ: dir.dz*offset, orientacion: dir, diametro: dMenor }
            ];
        }
    };

    function assignGenerators() {
        const teeEqualKeys = ['TEE_EQUAL_CS', 'TEE_EQUAL_PPR', 'TEE_EQUAL_HDPE', 'TEE_EQUAL_PVC', 'TEE_EQUAL_SS'];
        const teeReducingKeys = ['TEE_REDUCING_CS', 'TEE_REDUCING_PPR', 'TEE_REDUCING_PVC', 'TEE_REDUCING_HDPE', 'TEE_REDUCING_SS'];
        const crossKeys = ['CROSS_CS'];
        for (const key of teeEqualKeys) { if (components[key] && !components[key].generarPuertos) components[key].generarPuertos = baseGenerators.TEE_EQUAL; }
        for (const key of teeReducingKeys) { if (components[key] && !components[key].generarPuertos) components[key].generarPuertos = baseGenerators.TEE_REDUCING; }
        for (const key of crossKeys) { if (components[key] && !components[key].generarPuertos) components[key].generarPuertos = baseGenerators.CROSS; }
        for (const [key, comp] of Object.entries(components)) {
            if (comp.generarPuertos) continue;
            const tipo = comp.tipo || '';
            if (tipo.includes('VALVE') || tipo === 'GATE_VALVE' || tipo === 'GLOBE_VALVE' || tipo === 'BALL_VALVE' || tipo === 'BUTTERFLY_VALVE' || tipo === 'CHECK_VALVE' || tipo === 'DIAPHRAGM_VALVE' || tipo === 'CONTROL_VALVE' || tipo === 'DRAIN_VALVE' || tipo === 'PLUG_VALVE' || tipo === 'CHOKE_VALVE' || tipo === 'CRYOGENIC_VALVE' || tipo === 'GLASS_LINED_VALVE' || tipo === 'ASEPTIC_VALVE' || tipo === 'CHECK_VALVE_SANITARY') {
                comp.generarPuertos = baseGenerators.VALVE;
            } else if (tipo.includes('REDUCER') || tipo.includes('REDUCING')) {
                comp.generarPuertos = baseGenerators.REDUCER;
            }
        }
    }
    assignGenerators();

    const dimensiones = {
        "codo_90": { 2: 152, 3: 229, 4: 305, 6: 457, 8: 610, 10: 762, 12: 914 },
        "codo_45": { 2: 80, 3: 110, 4: 150, 6: 230, 8: 305, 10: 381, 12: 457 },
        "tee": { 2: 127, 3: 152, 4: 178, 6: 229, 8: 279, 10: 330, 12: 381 },
        "tee_reducing": { 3: 160, 4: 190, 6: 240, 8: 290, 10: 340 },
        "cross": { 2: 140, 3: 165, 4: 200, 6: 260, 8: 320 },
        "valvula_compuerta": { 2: 178, 3: 203, 4: 229, 6: 267, 8: 292, 10: 330, 12: 356 },
        "valvula_globo": { 2: 200, 3: 240, 4: 280, 6: 350, 8: 400, 10: 450 },
        "valvula_bola": { 2: 150, 3: 180, 4: 210, 6: 260, 8: 310, 10: 360, 12: 410 },
        "valvula_mariposa": { 2: 100, 3: 120, 4: 140, 6: 180, 8: 220, 10: 260, 12: 300 },
        "reduccion": { "4x3": 102, "6x4": 152, "3x2": 89, "8x6": 203, "6x3": 178, "10x8": 254, "12x10": 305, "default": 120 },
        "insercion_ppr": { 2: 45, 3: 60, 4: 75, 6: 90 },
        "insercion_hdpe": { 2: 50, 3: 65, 4: 80, 6: 100 },
        "union_universal": { 2: 70, 3: 90, 4: 110, 6: 140 },
        "adaptador_macho": { 2: 45, 3: 60, 4: 75, 6: 90 },
        "brida_espesor_150": { 2: 12, 3: 15, 4: 18, 6: 22, 8: 25, 10: 28, 12: 32 }
    };

    function getComponentDimension(tipo, diametro) {
        let lookupTipo = tipo;
        const tipoUpper = (tipo || '').toUpperCase();
        if (tipoUpper.includes('TEE_REDUCING')) lookupTipo = 'tee_reducing';
        else if (tipoUpper.includes('TEE')) lookupTipo = 'tee';
        else if (tipoUpper.includes('CROSS')) lookupTipo = 'cross';
        else if (tipoUpper.includes('ELBOW_90')) lookupTipo = 'codo_90';
        else if (tipoUpper.includes('ELBOW_45')) lookupTipo = 'codo_45';
        else if (tipoUpper.includes('GATE_VALVE')) lookupTipo = 'valvula_compuerta';
        else if (tipoUpper.includes('GLOBE_VALVE')) lookupTipo = 'valvula_globo';
        else if (tipoUpper.includes('BALL_VALVE')) lookupTipo = 'valvula_bola';
        else if (tipoUpper.includes('BUTTERFLY_VALVE')) lookupTipo = 'valvula_mariposa';
        else if (tipoUpper.includes('REDUCER') || tipoUpper.includes('REDUCCION')) lookupTipo = 'reduccion';
        else if (tipoUpper.includes('UNION')) lookupTipo = 'union_universal';
        else if (tipoUpper.includes('TRANSITION')) lookupTipo = 'adaptador_macho';
        else if (tipoUpper.includes('FLANGE')) lookupTipo = 'brida_espesor_150';
        const dims = dimensiones[lookupTipo];
        if (!dims) return 0;
        if (lookupTipo === 'reduccion') {
            if (typeof diametro === 'string' && dims[diametro] !== undefined) return dims[diametro];
            return dims["default"];
        }
        if (dims[diametro] !== undefined) return dims[diametro];
        return 0;
    }

    function getComponentDimensionInterpolated(tipo, diametro) {
        const exact = getComponentDimension(tipo, diametro);
        if (exact > 0) return exact;
        let lookupTipo = tipo;
        const tipoUpper = (tipo || '').toUpperCase();
        if (tipoUpper.includes('TEE_REDUCING')) lookupTipo = 'tee_reducing';
        else if (tipoUpper.includes('TEE')) lookupTipo = 'tee';
        else if (tipoUpper.includes('ELBOW_90')) lookupTipo = 'codo_90';
        else if (tipoUpper.includes('ELBOW_45')) lookupTipo = 'codo_45';
        else if (tipoUpper.includes('GATE_VALVE')) lookupTipo = 'valvula_compuerta';
        else if (tipoUpper.includes('GLOBE_VALVE')) lookupTipo = 'valvula_globo';
        else if (tipoUpper.includes('BALL_VALVE')) lookupTipo = 'valvula_bola';
        else if (tipoUpper.includes('BUTTERFLY_VALVE')) lookupTipo = 'valvula_mariposa';
        else if (tipoUpper.includes('UNION')) lookupTipo = 'union_universal';
        else if (tipoUpper.includes('TRANSITION')) lookupTipo = 'adaptador_macho';
        const dims = dimensiones[lookupTipo];
        if (!dims || typeof dims !== 'object') return 50;
        const diameters = Object.keys(dims).map(Number).sort((a, b) => a - b);
        if (diameters.length === 0) return 50;
        if (diametro <= diameters[0]) return dims[diameters[0]];
        if (diametro >= diameters[diameters.length - 1]) return dims[diameters[diameters.length - 1]];
        for (let i = 0; i < diameters.length - 1; i++) {
            if (diametro >= diameters[i] && diametro <= diameters[i + 1]) {
                const d1 = diameters[i], d2 = diameters[i + 1], v1 = dims[d1], v2 = dims[d2];
                return Math.round(v1 + (v2 - v1) * (diametro - d1) / (d2 - d1));
            }
        }
        return 50;
    }

    const _equipmentAliases = {
        'tanque_vertical': 'tanque_v', 'tanquevertical': 'tanque_v', 'tanque_horizontal': 'tanque_h', 'tanquehorizontal': 'tanque_h',
        'bomba_centrifuga': 'bomba', 'bombacentrifuga': 'bomba',
        'bomba_z': 'bomba_z', 'bomba_succion_z': 'bomba_z',
        'bomba_dosificadora': 'bomba_dosificacion',
        'intercambiador_calor': 'intercambiador', 'intercambiador': 'intercambiador',
        'torre_destilacion': 'torre', 'torredestilacion': 'torre', 'compresor': 'compresor', 'separador': 'separador',
        'caldera': 'caldera', 'clarificador': 'clarificador', 'filtro_arena': 'filtro_arena', 'filtroarena': 'filtro_arena',
        'osmosis': 'osmosis', 'osmosis_inversa': 'osmosis', 'bomba_sumergible': 'bomba_sumergible', 'bombasumergible': 'bomba_sumergible',
        'tanque_acero': 'tanque_acero', 'tanqueacero': 'tanque_acero', 'pasteurizador': 'pasteurizador',
        'homogeneizador': 'homogeneizador', 'plataforma': 'plataforma',
        'pump': 'bomba', 'centrifugal_pump': 'bomba', 'dosing_pump': 'bomba_dosificacion',
        'vertical_tank': 'tanque_v', 'horizontal_tank': 'tanque_h', 'heat_exchanger': 'intercambiador',
        'distillation_tower': 'torre', 'column': 'torre', 'reactor': 'reactor', 'boiler': 'caldera',
        'compressor': 'compresor', 'separator': 'separador', 'clarifier': 'clarificador',
        'sand_filter': 'filtro_arena', 'reverse_osmosis': 'osmosis', 'submersible_pump': 'bomba_sumergible',
        'stainless_tank': 'tanque_acero', 'pasteurizer': 'pasteurizador', 'homogenizer': 'homogeneizador',
        'platform': 'plataforma', 'tk': 'tanque_v', 'tank': 'tanque_v', 'p': 'bomba', 'pu': 'bomba',
        'e': 'intercambiador', 'ex': 'intercambiador', 't': 'torre', 'tw': 'torre', 'r': 'reactor', 'rx': 'reactor',
        'v': 'tanque_v', 'ves': 'tanque_v', 'c': 'compresor', 'cp': 'compresor', 'bo': 'caldera', 'sep': 'separador',
        'cl': 'clarificador', 'sf': 'filtro_arena', 'ro': 'osmosis',
        '3phase_separator': 'separador_trifasico', 'slug': 'slug_catcher', 'flare': 'antorcha',
        'heater_treater': 'calentador_fuego_directo', 'degasifier': 'desgasificador', 'softener': 'suavizador',
        'carbon_filter': 'filtro_carbon', 'acf': 'filtro_carbon', 'thickener': 'espesador', 'flocculator': 'floculador',
        'electrolytic_cell': 'celda_electrolitica', 'fractionator': 'columna_fraccionadora',
        'fractionating_column': 'columna_fraccionadora', 'condenser': 'condensador', 'evaporator': 'evaporador',
        'crystallizer': 'cristalizador', 'rotary_dryer': 'secador_rotativo', 'absorber': 'absorbedor',
        'stripper': 'stripper', 'jacketed_reactor': 'reactor_encamisado', 'autoclave': 'autoclave',
        'centrifuge': 'centrifuga', 'filter_press': 'filtro_prensa', 'agitator': 'agitador', 'mixer': 'agitador',
        'mill': 'molino', 'drum_filter': 'filtro_tambor', 'aseptic_tank': 'tanque_aseptico',
        'cheese_vat': 'tina_quesera', 'disc_centrifuge': 'centrifuga_discos', 'uht': 'esterilizador_uht',
        'filler': 'llenadora', 'hp_homogenizer': 'homogeneizador_ap'
    };

    function resolveEquipmentAlias(tipo) {
        if (!tipo) return null;
        const key = tipo.toLowerCase().replace(/[\s-]+/g, '_');
        if (_equipmentAliases[key]) return _equipmentAliases[key];
        if (equipment[tipo]) return tipo;
        if (equipment[key]) return key;
        for (const eqKey of Object.keys(equipment)) {
            if (eqKey.includes(key) || key.includes(eqKey)) return eqKey;
        }
        return null;
    }

    const _componentCategories = {
        'TEE': ['TEE_EQUAL', 'TEE_REDUCING'], 'CROSS': ['CROSS'], 'PIPE': ['PIPE'],
        'ELBOW': ['ELBOW_90_LR', 'ELBOW_90_SR', 'ELBOW_45', 'ELBOW_90_PPR', 'ELBOW_45_PPR', 'ELBOW_90_HDPE', 'ELBOW_45_HDPE', 'ELBOW_90_PVC', 'ELBOW_45_PVC', 'ELBOW_90_LR_SS', 'ELBOW_45_SS', 'ELBOW_90_SANITARY'],
        'VALVE': ['GATE_VALVE', 'GLOBE_VALVE', 'BUTTERFLY_VALVE', 'BALL_VALVE', 'CHECK_VALVE', 'DIAPHRAGM_VALVE', 'CONTROL_VALVE', 'PRESSURE_RELIEF', 'SAFETY_VALVE', 'DRAIN_VALVE', 'AIR_RELEASE', 'SAMPLE_VALVE', 'PLUG_VALVE', 'CHOKE_VALVE', 'CRYOGENIC_VALVE', 'GLASS_LINED_VALVE', 'ASEPTIC_VALVE', 'CHECK_VALVE_SANITARY', 'SAMPLE_VALVE_SANITARY'],
        'REDUCER': ['CONCENTRIC_REDUCER', 'ECCENTRIC_REDUCER'],
        'FLANGE': ['WELD_NECK_FLANGE', 'SLIP_ON_FLANGE', 'BLIND_FLANGE', 'LAP_JOINT_FLANGE', 'RTJ_FLANGE', 'ORIFICE_FLANGE'],
        'STUB_END': ['STUB_END'], 'CAP': ['CAP'], 'UNION': ['UNION', 'UNION_ACERO'], 'NIPPLE': ['NIPPLE'],
        'BULKHEAD': ['BULKHEAD'], 'TRANSITION': ['TRANSITION'], 'EXPANSION_JOINT': ['EXPANSION_JOINT'],
        'STRAINER': ['Y_STRAINER', 'T_STRAINER', 'BASKET_STRAINER', 'DUPLEX_STRAINER', 'SANITARY_STRAINER'],
        'STEAM_TRAP': ['STEAM_TRAP', 'STEAM_TRAP_SANITARY'],
        'INSTRUMENT': ['PRESSURE_GAUGE', 'TEMPERATURE_GAUGE', 'FLOW_METER', 'PRESSURE_TRANSMITTER', 'LEVEL_TRANSMITTER', 'TEMPERATURE_TRANSMITTER', 'ROTAMETER', 'SIGHT_GLASS', 'LEVEL_SWITCH_RANA', 'CORIOLIS_METER', 'PH_METER', 'CONDUCTIVITY_METER', 'SANITARY_PRESSURE_GAUGE'],
        'SUPPORT': ['PIPE_SHOE', 'U_BOLT', 'GUIDE', 'ANCHOR', 'HANGER', 'SPRING_HANGER', 'PIPE_CLAMP'],
        'QUICK_CONNECT': ['CAMLOCK', 'QUICK_CONNECT'], 'HOSE': ['FLEXIBLE_HOSE', 'METALLIC_HOSE', 'PTFE_HOSE'],
        'SAFETY': ['SILENCER', 'VENT_SILENCER', 'FLAME_ARRESTER', 'VACUUM_BREAKER', 'DETONATION_ARRESTER', 'RUPTURE_DISC'],
        'SAMPLE': ['SAMPLE_COOLER', 'SAMPLE_VALVE', 'PISTON_SAMPLE_VALVE'],
        'INJECTION': ['CHEMICAL_INJECTOR', 'CHLORINE_EJECTOR'], 'MIXER': ['STATIC_MIXER']
    };

    const _componentAliases = {
        'TE': 'TEE_EQUAL', 'TR': 'TEE_REDUCING', 'CR': 'CROSS', 'EL': 'ELBOW_90_LR', 'E4': 'ELBOW_45', 'ES': 'ELBOW_90_SR',
        'GV': 'GATE_VALVE', 'GL': 'GLOBE_VALVE', 'VB': 'BUTTERFLY_VALVE', 'BA': 'BALL_VALVE', 'CK': 'CHECK_VALVE',
        'DV': 'DIAPHRAGM_VALVE', 'CV': 'CONTROL_VALVE', 'RV': 'PRESSURE_RELIEF', 'SV': 'SAFETY_VALVE',
        'RC': 'CONCENTRIC_REDUCER', 'RE': 'ECCENTRIC_REDUCER', 'FL': 'WELD_NECK_FLANGE', 'FB': 'BLIND_FLANGE',
        'CA': 'CAP', 'UN': 'UNION', 'NI': 'NIPPLE', 'BH': 'BULKHEAD', 'AM': 'TRANSITION', 'AH': 'TRANSITION',
        'EJ': 'EXPANSION_JOINT', 'YS': 'Y_STRAINER', 'TS': 'T_STRAINER', 'BS': 'BASKET_STRAINER',
        'ST': 'STEAM_TRAP', 'SF': 'STEAM_TRAP', 'PG': 'PRESSURE_GAUGE', 'TG': 'TEMPERATURE_GAUGE', 'FM': 'FLOW_METER',
        'PT': 'PRESSURE_TRANSMITTER', 'LT': 'LEVEL_TRANSMITTER', 'TT': 'TEMPERATURE_TRANSMITTER',
        'RO': 'ROTAMETER', 'SG': 'SIGHT_GLASS', 'LS': 'LEVEL_SWITCH_RANA', 'SH': 'PIPE_SHOE', 'UB': 'U_BOLT',
        'GD': 'GUIDE', 'AN': 'ANCHOR', 'HG': 'HANGER', 'PC': 'PIPE_CLAMP', 'CM': 'CAMLOCK', 'CF': 'CAMLOCK',
        'QC': 'QUICK_CONNECT', 'HO': 'FLEXIBLE_HOSE', 'HM': 'METALLIC_HOSE', 'HP': 'PTFE_HOSE',
        'SI': 'SILENCER', 'VS': 'SILENCER', 'FA': 'FLAME_ARRESTER', 'SC': 'SAMPLE_COOLER',
        'codo': 'ELBOW_90_LR', 'codo90': 'ELBOW_90_LR', 'codo45': 'ELBOW_45', 'tee': 'TEE_EQUAL', 'te': 'TEE_EQUAL',
        'valvula': 'GATE_VALVE', 'valvula_compuerta': 'GATE_VALVE', 'valvula_globo': 'GLOBE_VALVE',
        'valvula_bola': 'BALL_VALVE', 'valvula_mariposa': 'BUTTERFLY_VALVE', 'valvula_check': 'CHECK_VALVE',
        'brida': 'WELD_NECK_FLANGE', 'brida_cuello': 'WELD_NECK_FLANGE', 'brida_ciega': 'BLIND_FLANGE',
        'brida_slipon': 'SLIP_ON_FLANGE', 'reduccion': 'CONCENTRIC_REDUCER', 'reductor': 'CONCENTRIC_REDUCER',
        'manometro': 'PRESSURE_GAUGE', 'termometro': 'TEMPERATURE_GAUGE', 'caudalimetro': 'FLOW_METER',
        'flujometro': 'FLOW_METER', 'filtro_y': 'Y_STRAINER', 'filtro_canasta': 'BASKET_STRAINER',
        'trampa_vapor': 'STEAM_TRAP', 'soporte': 'PIPE_SHOE', 'abrazadera': 'PIPE_CLAMP', 'colgador': 'HANGER',
        'manguera': 'FLEXIBLE_HOSE', 'silenciador': 'SILENCER', 'union': 'UNION', 'union_universal': 'UNION',
        'niple': 'NIPPLE', 'tapón': 'CAP', 'tapon': 'CAP', 'pasamuros': 'BULKHEAD', 'adaptador': 'TRANSITION',
        'junta_expansion': 'EXPANSION_JOINT', 'valvula_seguridad': 'SAFETY_VALVE', 'valvula_alivio': 'PRESSURE_RELIEF',
        'valvula_purga': 'DRAIN_VALVE', 'valvula_muestreo': 'SAMPLE_VALVE',
        'PV': 'PLUG_VALVE', 'CH': 'CHOKE_VALVE', 'FR': 'RTJ_FLANGE', 'IJ': 'INSULATING_JOINT', 'DS': 'DUPLEX_STRAINER',
        'RD': 'RUPTURE_DISC', 'AD': 'AIR_DIFFUSER', 'EC': 'CHLORINE_EJECTOR', 'SM': 'STATIC_MIXER',
        'CV': 'CRYOGENIC_VALVE', 'FO': 'ORIFICE_FLANGE', 'SB': 'SPECTACLE_BLIND', 'AV': 'ASEPTIC_VALVE',
        'DA': 'DETONATION_ARRESTER', 'valvula_aséptica': 'ASEPTIC_VALVE', 'mirilla_sanitaria': 'SIGHT_GLASS_SANITARY',
        'spray_ball': 'SPRAY_BALL', 'disco_ruptura': 'RUPTURE_DISC'
    };

    function resolveComponentAlias(compName) {
        if (!compName) return null;
        const key = compName.toLowerCase().replace(/[\s-]+/g, '_');
        if (_componentAliases[key]) return _componentAliases[key];
        if (components[compName]) return compName;
        const upper = compName.toUpperCase();
        for (const compKey of Object.keys(components)) {
            if (compKey.toUpperCase() === upper) return compKey;
            if (compKey.toUpperCase().includes(upper)) return compKey;
        }
        return null;
    }

    function findComponentByTypeAndSpec(tipo, specId) {
        const resolved = resolveComponentAlias(tipo);
        if (!resolved) return null;
        for (const [key, comp] of Object.entries(components)) {
            if (comp.tipo === resolved) {
                if (!specId) return { key, component: comp };
                if (comp.spec === specId) return { key, component: comp };
            }
        }
        for (const [key, comp] of Object.entries(components)) {
            if (comp.tipo === resolved) return { key, component: comp };
        }
        return null;
    }

    function getComponentsByCategory(category) {
        const cat = category.toUpperCase();
        const tipos = _componentCategories[cat];
        if (!tipos) return [];
        const result = [];
        for (const [key, comp] of Object.entries(components)) {
            if (tipos.includes(comp.tipo)) result.push({ key, ...comp });
        }
        return result;
    }

    function getComponentsBySpec(specId) {
        const result = [];
        for (const [key, comp] of Object.entries(components)) {
            if (comp.spec === specId) result.push({ key, ...comp });
        }
        return result;
    }

    function validateSpec(specId) {
        if (!specId) return { valid: false, message: 'Spec no especificada' };
        const spec = specs[specId];
        if (!spec) {
            const similares = Object.keys(specs).filter(s => s.toUpperCase().includes(specId.toUpperCase()));
            return { valid: false, message: `Spec "${specId}" no encontrada`, suggestions: similares.length > 0 ? similares : Object.keys(specs).slice(0, 5) };
        }
        return { valid: true, spec: spec, id: specId };
    }

    function createLine(tag, diameter, material, spec, points, options = {}) {
        const specDef = specs[spec] || specs['PPR_PN12_5'];
        const pts = points.map(p => ({ x: p.x || p[0] || 0, y: p.y || p[1] || 0, z: p.z || p[2] || 0 }));
        const line = {
            tag: tag || `L-${Date.now().toString(36).slice(-4)}`,
            diameter: diameter || 4,
            material: material || specDef.material || 'PPR',
            spec: spec || 'PPR_PN12_5',
            _cachedPoints: pts, points3D: pts, waypoints: pts.slice(1, -1),
            components: options.components || [], puertos: options.puertos || [],
            origin: options.origin || null, destination: options.destination || null,
            isoColor: options.color || specDef.color || 0x7c3aed
        };
        if (pts.length >= 2) {
            if (!line.puertos.find(p => p.id === '0' || p.id === 'START')) {
                const dirStart = { dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y, dz: pts[1].z - pts[0].z };
                const len = Math.hypot(dirStart.dx, dirStart.dy, dirStart.dz) || 1;
                line.puertos.push({ id: 'START', label: 'Inicio', relX: 0, relY: 0, relZ: 0, orientacion: { dx: dirStart.dx/len, dy: dirStart.dy/len, dz: dirStart.dz/len }, diametro: diameter, status: 'open' });
            }
            if (!line.puertos.find(p => p.id === '1' || p.id === 'END')) {
                const n = pts.length;
                const dirEnd = { dx: pts[n-1].x - pts[n-2].x, dy: pts[n-1].y - pts[n-2].y, dz: pts[n-1].z - pts[n-2].z };
                const len = Math.hypot(dirEnd.dx, dirEnd.dy, dirEnd.dz) || 1;
                line.puertos.push({ id: 'END', label: 'Fin', relX: 0, relY: 0, relZ: 0, orientacion: { dx: dirEnd.dx/len, dy: dirEnd.dy/len, dz: dirEnd.dz/len }, diametro: diameter, status: 'open' });
            }
        }
        return line;
    }

    function createEquipment(tipo, tag, x, y, z, opciones = {}) {
        const resolved = resolveEquipmentAlias(tipo);
        if (!resolved) return null;
        const def = equipment[resolved];
        if (!def) return null;
        
        let defaultSpec = 'ACERO_150_RF';
        let defaultMaterial = 'CS';
        const material = (opciones.material || '').toUpperCase();
        
        if (material.includes('CONCRETO') || material.includes('CEMENTO') || material.includes('HORMIGON')) {
            defaultSpec = 'HORMIGON_ESTRUCTURAL'; defaultMaterial = 'CONCRETO';
        } else if (material.includes('PPR')) {
            defaultSpec = 'PPR_PN12_5'; defaultMaterial = 'PPR';
        } else if (material.includes('PE') || material.includes('HDPE')) {
            defaultSpec = 'HDPE_PE100'; defaultMaterial = 'HDPE';
        } else if (material.includes('PVC')) {
            defaultSpec = 'PVC_SCH80'; defaultMaterial = 'PVC';
        } else if (material.includes('CPVC')) {
            defaultSpec = 'CPVC_SCH80'; defaultMaterial = 'CPVC';
        } else if (material.includes('PVDF')) {
            defaultSpec = 'PVDF_PN16'; defaultMaterial = 'PVDF';
        } else if (material.includes('ACERO') || material.includes('CS') || material.includes('CARBONO') || material.includes('STEEL') || material.includes('METAL')) {
            defaultSpec = 'ACERO_150_RF'; defaultMaterial = 'CS';
        } else if (material.includes('INOX') || material.includes('STAINLESS')) {
            defaultSpec = 'SS_150_RF'; defaultMaterial = 'SS';
        } else if (material.includes('DUPLEX')) {
            defaultSpec = 'DUPLEX_150_RF'; defaultMaterial = 'DUPLEX';
        } else if (material.includes('HASTELLOY')) {
            defaultSpec = 'HASTELLOY_150_RF'; defaultMaterial = 'HASTELLOY';
        } else if (material.includes('ALUMINIO') || material.includes('ALUMINUM')) {
            defaultSpec = 'ALUMINIO_ESTRUCTURAL'; defaultMaterial = 'ALUMINIO';
        } else if (material.includes('FRP')) {
            defaultSpec = 'FRP'; defaultMaterial = 'FRP';
        } else if (material.includes('MADERA') || material.includes('WOOD')) {
            defaultSpec = 'MADERA_ESTRUCTURAL'; defaultMaterial = 'MADERA';
        }
        
        const specValidation = validateSpec(opciones.spec || defaultSpec);
        const finalSpec = specValidation.valid ? (opciones.spec || defaultSpec) : defaultSpec;
        
        let base = {
            tag, tipo: resolved, posX: x, posY: y, posZ: z,
            diametro: opciones.diametro || 1000,
            altura: opciones.altura || 1500,
            material: opciones.material || defaultMaterial,
            spec: finalSpec,
            largo: opciones.largo || 1000,
            ancho: opciones.ancho || 1000
        };

        if (resolved === 'plataforma') {
            base.largo = opciones.largo || 6000;
            base.ancho = opciones.ancho || 3000;
            base.altura = opciones.altura || 400;
            base.baranda = opciones.baranda !== undefined ? opciones.baranda : true;
            base.escalera = opciones.escalera !== undefined ? opciones.escalera : true;
        }

        base.puertos = def.generarPuertos(base).map(p => ({
            ...p, spec: base.spec, status: 'open', diametro: p.diametro || 3
        }));
        return base;
    }

    return {
        getSpecs: () => specs,
        getSpec: (id) => specs[id] || null,
        getEquipment: (tipo) => { const resolved = resolveEquipmentAlias(tipo); return resolved ? equipment[resolved] : null; },
        listEquipmentTypes: () => Object.keys(equipment),
        getEquipmentAliases: () => _equipmentAliases,
        resolveEquipmentAlias,
        getComponent: (id) => {
            if (components[id]) return components[id];
            const resolved = resolveComponentAlias(id);
            if (resolved && components[resolved]) return components[resolved];
            const byType = findComponentByTypeAndSpec(id);
            return byType ? byType.component : null;
        },
        listComponentTypes: () => Object.keys(components),
        getComponentAliases: () => _componentAliases,
        getComponentCategories: () => _componentCategories,
        resolveComponentAlias,
        findComponentByTypeAndSpec,
        getComponentsByCategory,
        getComponentsBySpec,
        getDimension: (tipo, diametro) => dimensiones[tipo]?.[diametro] || null,
        getComponentDimension,
        getComponentDimensionInterpolated,
        validateSpec,
        listSpecs: () => Object.keys(specs),
        createLine,
        createEquipment,
        createComponent: (compId, opciones = {}) => {
            const def = components[compId] || null;
            if (!def) {
                const resolved = findComponentByTypeAndSpec(compId, opciones.spec);
                if (resolved) return { ...resolved.component, ...opciones, id: resolved.key };
                return null;
            }
            return { ...def, ...opciones, id: compId };
        },
        createFitting: function(tipo, diam, spec, pos) {
            const generator = baseGenerators[tipo] || baseGenerators['TEE_EQUAL'];
            return { tag: `FIT-${Date.now().toString(36).slice(-4)}`, tipo: tipo, posX: pos.x, posY: pos.y, posZ: pos.z, isFitting: true, puertos: generator(null, 0, diam).map(p => ({ ...p, spec, status: 'open' })) };
        },
        getFittingForConnection: function(d_origen, d_destino, spec) {
            if (d_origen === d_destino) return { tipo: 'TEE_EQUAL', diam: d_origen };
            return { tipo: 'REDUCCION_CONCENTRICA', d_mayor: Math.max(d_origen, d_destino), d_menor: Math.min(d_origen, d_destino) };
        },
        getTransitionAccessories: (lineMaterial, componentMaterial, diameter) => {
            const from = (lineMaterial || '').toUpperCase().trim();
            const to = (componentMaterial || '').toUpperCase().trim();
            if (!to || from === to) return null;
            const plasticFamilies = [['PPR', 'PP', 'PPR', 'PP-EPDM', 'PP_EPDM'], ['PE', 'PE100', 'HDPE', 'PE_EPDM'], ['PVC', 'CPVC']];
            const isPlasticCompatible = plasticFamilies.some(family => family.some(m => from.includes(m)) && family.some(m => to.includes(m)));
            if (isPlasticCompatible) return null;
            const transitionMap = {
                'PPR->ACERO AL CARBONO': { left: 'ADAPTADOR_MACHO_PPR_3IN', right: 'UNION_CS_3000' },
                'ACERO AL CARBONO->PPR': { left: 'UNION_CS_3000', right: 'ADAPTADOR_HEMBRA_PPR_3IN' },
                'HDPE->ACERO AL CARBONO': { left: 'TRANSITION_HDPE_STEEL', right: null },
                'ACERO AL CARBONO->HDPE': { left: null, right: 'TRANSITION_HDPE_STEEL' },
                'PVC->ACERO AL CARBONO': { left: 'UNION_CS_3000', right: null },
                'ACERO AL CARBONO->PVC': { left: null, right: 'UNION_CS_3000' },
                'ACERO AL CARBONO->ACERO INOXIDABLE 316L': { left: 'UNION_CS_3000', right: null }
            };
            const key = `${from}->${to}`;
            if (transitionMap[key]) return transitionMap[key];
            const metalMaterials = ['ACERO', 'INOXIDABLE', 'INOX', 'CARBONO', 'CS', 'SS'];
            const fromIsMetal = metalMaterials.some(m => from.includes(m));
            const toIsMetal = metalMaterials.some(m => to.includes(m));
            if (fromIsMetal && toIsMetal) return { left: 'UNION_CS_3000', right: 'UNION_CS_3000' };
            return null;
        }
    };
})();

if (typeof window !== 'undefined') window.SmartFlowCatalog = SmartFlowCatalog;
