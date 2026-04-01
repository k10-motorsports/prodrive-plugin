/**
 * Car Model Registry
 *
 * Maps iRacing car names to car classes and 3D model files.
 * Models sourced from Speed Dreams (GPL v2) and free community glTF models.
 */

export type CarClass = 'gt3' | 'gtp' | 'lmp2' | 'formula' | 'sports'

export interface CarClassInfo {
  class: CarClass
  name: string
  description: string
  modelFile: string          // filename in /public/models/cars/
  source: string             // attribution
  license: string
  /** iRacing car folder names that map to this class */
  irCarPatterns: string[]
}

/**
 * Registry of available car classes with their 3D models.
 * Each class has one representative model used for rendering.
 */
export const CAR_CLASSES: CarClassInfo[] = [
  {
    class: 'gt3',
    name: 'GT3',
    description: 'GT3-class sports cars (Porsche 911, BMW M4, Ferrari 296, etc.)',
    modelFile: 'gt3.glb',
    source: 'Speed Dreams LS-GT2 Bavaria G3 GTR',
    license: 'GPL-2.0',
    irCarPatterns: [
      'bmw_m4_gt3', 'porsche_911_gt3_r', 'ferrari_296_gt3',
      'mercedes_amg_gt3', 'lamborghini_huracan_gt3', 'audi_r8_lms_gt3',
      'mclaren_720s_gt3', 'aston_martin_vantage_gt3', 'corvette_c8r_gt3',
      'ford_mustang_gt3',
    ],
  },
  {
    class: 'gtp',
    name: 'GTP / Hypercar',
    description: 'GTP and Hypercar prototypes (Porsche 963, Cadillac V-Series.R, etc.)',
    modelFile: 'gtp.glb',
    source: 'Speed Dreams LS-GT1 Murasama M35',
    license: 'GPL-2.0',
    irCarPatterns: [
      'porsche_963', 'cadillac_v_series_r', 'acura_arx06',
      'bmw_m_hybrid_v8', 'toyota_gr010', 'peugeot_9x8',
      'ferrari_499p', 'lamborghini_sc63',
    ],
  },
  {
    class: 'lmp2',
    name: 'LMP2 / Prototype',
    description: 'LMP2 and prototype endurance cars (Dallara P217, etc.)',
    modelFile: 'lmp2.glb',
    source: 'Speed Dreams LS-P1 Pescy P60',
    license: 'GPL-2.0',
    irCarPatterns: [
      'dallara_p217', 'dallara_lmp2', 'hpd_arx01c',
      'radical_sr8', 'ligier_js_p320',
    ],
  },
  {
    class: 'formula',
    name: 'Formula / Open Wheel',
    description: 'Open wheel racing (Mercedes W13, Dallara IR-04, Formula Vee, etc.)',
    modelFile: 'formula.glb',
    source: 'Speed Dreams MP1 Aichi EJ15',
    license: 'GPL-2.0',
    irCarPatterns: [
      'mercedesw13', 'dallara_ir04', 'dallara_f3',
      'formula_vee', 'usf_2000', 'indy_pro_2000',
      'ir_01', 'ir_04', 'super_formula_sf23',
      'skip_barber_formula_2000',
    ],
  },
  {
    class: 'sports',
    name: 'Sports Car',
    description: 'Production-based sports and touring cars (MX-5, Elantra N TC, etc.)',
    modelFile: 'sports.glb',
    source: 'Community glTF model',
    license: 'CC-BY-4.0',
    irCarPatterns: [
      'mx5_cup', 'mazda_mx5_cup', 'hyundai_elantra_ntc',
      'toyota_gr86', 'porsche_911_cup', 'porsche_992_cup',
      'bmw_m2_cs_racing', 'ferrari_gt3_challenge',
    ],
  },
]

/** Map from car class ID to info */
const CLASS_MAP = new Map<CarClass, CarClassInfo>(
  CAR_CLASSES.map(c => [c.class, c])
)

/**
 * Determine which car class an iRacing car belongs to.
 * Matches against irCarPatterns using case-insensitive substring matching.
 * Falls back to 'sports' if no match found.
 */
export function getCarClass(irCarName: string): CarClass {
  if (!irCarName) return 'sports'
  const lower = irCarName.toLowerCase().replace(/\s+/g, '_')

  for (const cls of CAR_CLASSES) {
    for (const pattern of cls.irCarPatterns) {
      if (lower.includes(pattern) || pattern.includes(lower)) {
        return cls.class
      }
    }
  }

  // Fallback heuristics based on common keywords
  if (lower.includes('gt3')) return 'gt3'
  if (lower.includes('gtp') || lower.includes('hypercar') || lower.includes('963') || lower.includes('499p')) return 'gtp'
  if (lower.includes('lmp') || lower.includes('prototype') || lower.includes('p217')) return 'lmp2'
  if (lower.includes('formula') || lower.includes('ir-04') || lower.includes('w13') || lower.includes('open_wheel')) return 'formula'

  return 'sports'
}

/** Get the model file path for a given car class */
export function getModelPath(carClass: CarClass): string {
  const info = CLASS_MAP.get(carClass)
  return `/models/cars/${info?.modelFile ?? 'sports.glb'}`
}

/** Get full class info */
export function getClassInfo(carClass: CarClass): CarClassInfo | undefined {
  return CLASS_MAP.get(carClass)
}
