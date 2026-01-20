// TYSON — muscles (groups + detailed)
export const MUSCLES = [
  {
    "id": "pecs",
    "name": "Pectorals (Group)",
    "region": "Chest",
    "type": "group",
    "members": [
      "pec_major_clav",
      "pec_major_sternal",
      "pec_minor"
    ],
    "syn": [
      "chest",
      "pec"
    ],
    "actions": [
      "horizontal adduction",
      "pressing"
    ]
  },
  {
    "id": "pec_major_clav",
    "name": "Pectoralis Major (Clavicular)",
    "region": "Chest",
    "syn": [
      "upper pec",
      "upper chest"
    ]
  },
  {
    "id": "pec_major_sternal",
    "name": "Pectoralis Major (Sternal)",
    "region": "Chest",
    "syn": [
      "mid pec",
      "lower chest"
    ]
  },
  {
    "id": "pec_minor",
    "name": "Pectoralis Minor",
    "region": "Chest"
  },
  {
    "id": "serratus_anterior",
    "name": "Serratus Anterior",
    "region": "Chest/Core",
    "syn": [
      "serratus"
    ],
    "actions": [
      "scapular protraction",
      "upward rotation"
    ]
  },
  {
    "id": "intercostals",
    "name": "Intercostals",
    "region": "Chest/Core"
  },
  {
    "id": "delts",
    "name": "Deltoids (Group)",
    "region": "Shoulders",
    "type": "group",
    "members": [
      "delt_ant",
      "delt_lat",
      "delt_post"
    ],
    "syn": [
      "shoulders",
      "delts"
    ]
  },
  {
    "id": "delt_ant",
    "name": "Deltoid (Anterior)",
    "region": "Shoulders",
    "syn": [
      "front delt"
    ]
  },
  {
    "id": "delt_lat",
    "name": "Deltoid (Lateral)",
    "region": "Shoulders",
    "syn": [
      "side delt"
    ]
  },
  {
    "id": "delt_post",
    "name": "Deltoid (Posterior)",
    "region": "Shoulders",
    "syn": [
      "rear delt"
    ]
  },
  {
    "id": "rotator_cuff",
    "name": "Rotator Cuff (Group)",
    "region": "Shoulders",
    "type": "group",
    "members": [
      "supraspinatus",
      "infraspinatus",
      "teres_minor",
      "subscapularis"
    ],
    "syn": [
      "rc",
      "rotator cuff"
    ]
  },
  {
    "id": "supraspinatus",
    "name": "Supraspinatus",
    "region": "Shoulders"
  },
  {
    "id": "infraspinatus",
    "name": "Infraspinatus",
    "region": "Shoulders"
  },
  {
    "id": "teres_minor",
    "name": "Teres Minor",
    "region": "Shoulders"
  },
  {
    "id": "subscapularis",
    "name": "Subscapularis",
    "region": "Shoulders"
  },
  {
    "id": "teres_major",
    "name": "Teres Major",
    "region": "Shoulders/Back"
  },
  {
    "id": "upper_back",
    "name": "Upper Back (Group)",
    "region": "Back",
    "type": "group",
    "members": [
      "rhomboids",
      "traps_mid",
      "traps_lower",
      "levator_scapulae"
    ],
    "syn": [
      "upper back",
      "scapular retractors"
    ]
  },
  {
    "id": "lats",
    "name": "Latissimus Dorsi",
    "region": "Back",
    "syn": [
      "lat"
    ],
    "actions": [
      "shoulder extension",
      "adduction"
    ]
  },
  {
    "id": "rhomboids",
    "name": "Rhomboids",
    "region": "Back",
    "actions": [
      "scapular retraction"
    ]
  },
  {
    "id": "traps",
    "name": "Trapezius (Group)",
    "region": "Back",
    "type": "group",
    "members": [
      "traps_upper",
      "traps_mid",
      "traps_lower"
    ],
    "syn": [
      "traps"
    ]
  },
  {
    "id": "traps_upper",
    "name": "Trapezius (Upper)",
    "region": "Back"
  },
  {
    "id": "traps_mid",
    "name": "Trapezius (Middle)",
    "region": "Back"
  },
  {
    "id": "traps_lower",
    "name": "Trapezius (Lower)",
    "region": "Back"
  },
  {
    "id": "levator_scapulae",
    "name": "Levator Scapulae",
    "region": "Back/Neck"
  },
  {
    "id": "rear_chain",
    "name": "Posterior Chain (Group)",
    "region": "Back/Hips",
    "type": "group",
    "members": [
      "spinal_erectors",
      "glute_max",
      "hamstrings"
    ],
    "syn": [
      "posterior chain"
    ]
  },
  {
    "id": "spinal_erectors",
    "name": "Erector Spinae (Group)",
    "region": "Back",
    "type": "group",
    "members": [
      "iliocostalis",
      "longissimus",
      "spinalis"
    ],
    "syn": [
      "erectors",
      "lower back"
    ]
  },
  {
    "id": "iliocostalis",
    "name": "Iliocostalis",
    "region": "Back"
  },
  {
    "id": "longissimus",
    "name": "Longissimus",
    "region": "Back"
  },
  {
    "id": "spinalis",
    "name": "Spinalis",
    "region": "Back"
  },
  {
    "id": "multifidus",
    "name": "Multifidus",
    "region": "Back/Core"
  },
  {
    "id": "quadratus_lumborum",
    "name": "Quadratus Lumborum",
    "region": "Back/Core",
    "syn": [
      "QL"
    ]
  },
  {
    "id": "lower_back",
    "name": "Lower Back (Stabilizers)",
    "region": "Back",
    "type": "group",
    "members": [
      "multifidus",
      "quadratus_lumborum",
      "spinal_erectors"
    ]
  },
  {
    "id": "neck_extensors",
    "name": "Neck Extensors",
    "region": "Neck/Other"
  },
  {
    "id": "biceps_group",
    "name": "Elbow Flexors (Group)",
    "region": "Arms",
    "type": "group",
    "members": [
      "biceps_brachii",
      "brachialis",
      "brachioradialis"
    ],
    "syn": [
      "biceps",
      "elbow flexors"
    ]
  },
  {
    "id": "biceps_brachii",
    "name": "Biceps Brachii",
    "region": "Arms",
    "syn": [
      "biceps"
    ]
  },
  {
    "id": "brachialis",
    "name": "Brachialis",
    "region": "Arms"
  },
  {
    "id": "brachioradialis",
    "name": "Brachioradialis",
    "region": "Forearms/Grip"
  },
  {
    "id": "triceps_group",
    "name": "Triceps (Group)",
    "region": "Arms",
    "type": "group",
    "members": [
      "triceps_long",
      "triceps_lateral",
      "triceps_medial"
    ],
    "syn": [
      "triceps"
    ]
  },
  {
    "id": "triceps_long",
    "name": "Triceps (Long Head)",
    "region": "Arms"
  },
  {
    "id": "triceps_lateral",
    "name": "Triceps (Lateral Head)",
    "region": "Arms"
  },
  {
    "id": "triceps_medial",
    "name": "Triceps (Medial Head)",
    "region": "Arms"
  },
  {
    "id": "forearms_group",
    "name": "Forearms (Group)",
    "region": "Forearms/Grip",
    "type": "group",
    "members": [
      "forearm_flexors",
      "forearm_extensors",
      "wrist_radial_deviators",
      "wrist_ulnar_deviators"
    ],
    "syn": [
      "forearms",
      "grip"
    ]
  },
  {
    "id": "forearm_flexors",
    "name": "Forearm Flexors",
    "region": "Forearms/Grip",
    "actions": [
      "wrist flexion",
      "grip"
    ]
  },
  {
    "id": "forearm_extensors",
    "name": "Forearm Extensors",
    "region": "Forearms/Grip",
    "actions": [
      "wrist extension"
    ]
  },
  {
    "id": "wrist_radial_deviators",
    "name": "Radial Deviators",
    "region": "Forearms/Grip"
  },
  {
    "id": "wrist_ulnar_deviators",
    "name": "Ulnar Deviators",
    "region": "Forearms/Grip"
  },
  {
    "id": "core_group",
    "name": "Core (Group)",
    "region": "Core",
    "type": "group",
    "members": [
      "rectus_abdominis",
      "obliques_ext",
      "obliques_int",
      "transverse_abdominis",
      "erector_spinae_core",
      "pelvic_floor",
      "diaphragm"
    ],
    "syn": [
      "core",
      "abs"
    ]
  },
  {
    "id": "rectus_abdominis",
    "name": "Rectus Abdominis",
    "region": "Core",
    "syn": [
      "abs"
    ]
  },
  {
    "id": "obliques_ext",
    "name": "External Obliques",
    "region": "Core"
  },
  {
    "id": "obliques_int",
    "name": "Internal Obliques",
    "region": "Core"
  },
  {
    "id": "transverse_abdominis",
    "name": "Transverse Abdominis",
    "region": "Core"
  },
  {
    "id": "erector_spinae_core",
    "name": "Spinal Stabilizers (Erectors)",
    "region": "Core",
    "type": "group",
    "members": [
      "multifidus",
      "quadratus_lumborum"
    ],
    "syn": [
      "core erectors"
    ]
  },
  {
    "id": "diaphragm",
    "name": "Diaphragm",
    "region": "Core"
  },
  {
    "id": "pelvic_floor",
    "name": "Pelvic Floor",
    "region": "Core"
  },
  {
    "id": "glutes_group",
    "name": "Glutes (Group)",
    "region": "Hips/Glutes",
    "type": "group",
    "members": [
      "glute_max",
      "glute_med",
      "glute_min"
    ],
    "syn": [
      "glutes"
    ]
  },
  {
    "id": "glute_max",
    "name": "Gluteus Maximus",
    "region": "Hips/Glutes"
  },
  {
    "id": "glute_med",
    "name": "Gluteus Medius",
    "region": "Hips/Glutes"
  },
  {
    "id": "glute_min",
    "name": "Gluteus Minimus",
    "region": "Hips/Glutes"
  },
  {
    "id": "hip_flexors",
    "name": "Hip Flexors (Iliopsoas)",
    "region": "Hips/Glutes",
    "syn": [
      "iliopsoas",
      "hip flexor"
    ],
    "type": "group",
    "members": [
      "iliopsoas_group",
      "rectus_femoris",
      "tfl",
      "sartorius"
    ]
  },
  {
    "id": "tfl",
    "name": "Tensor Fasciae Latae",
    "region": "Hips/Glutes",
    "syn": [
      "TFL"
    ]
  },
  {
    "id": "hip_external_rotators",
    "name": "Hip External Rotators (Group)",
    "region": "Hips/Glutes",
    "type": "group",
    "members": [
      "piriformis",
      "gemellus_sup",
      "gemellus_inf",
      "obturator_int",
      "obturator_ext",
      "quadratus_femoris"
    ]
  },
  {
    "id": "piriformis",
    "name": "Piriformis",
    "region": "Hips/Glutes"
  },
  {
    "id": "gemellus_sup",
    "name": "Gemellus Superior",
    "region": "Hips/Glutes"
  },
  {
    "id": "gemellus_inf",
    "name": "Gemellus Inferior",
    "region": "Hips/Glutes"
  },
  {
    "id": "obturator_int",
    "name": "Obturator Internus",
    "region": "Hips/Glutes"
  },
  {
    "id": "obturator_ext",
    "name": "Obturator Externus",
    "region": "Hips/Glutes"
  },
  {
    "id": "quadratus_femoris",
    "name": "Quadratus Femoris",
    "region": "Hips/Glutes"
  },
  {
    "id": "adductors_group",
    "name": "Hip Adductors (Group)",
    "region": "Hips/Glutes",
    "type": "group",
    "members": [
      "adductor_longus",
      "adductor_brevis",
      "adductor_magnus",
      "gracilis",
      "pectineus"
    ]
  },
  {
    "id": "adductor_longus",
    "name": "Adductor Longus",
    "region": "Hips/Glutes"
  },
  {
    "id": "adductor_brevis",
    "name": "Adductor Brevis",
    "region": "Hips/Glutes"
  },
  {
    "id": "adductor_magnus",
    "name": "Adductor Magnus",
    "region": "Hips/Glutes"
  },
  {
    "id": "gracilis",
    "name": "Gracilis",
    "region": "Hips/Glutes/Thigh"
  },
  {
    "id": "pectineus",
    "name": "Pectineus",
    "region": "Hips/Glutes/Thigh"
  },
  {
    "id": "quads",
    "name": "Quadriceps (Group)",
    "region": "Thighs",
    "type": "group",
    "members": [
      "rectus_femoris",
      "vastus_lateralis",
      "vastus_medialis",
      "vastus_intermedius"
    ],
    "syn": [
      "quads"
    ]
  },
  {
    "id": "rectus_femoris",
    "name": "Rectus Femoris",
    "region": "Thighs"
  },
  {
    "id": "vastus_lateralis",
    "name": "Vastus Lateralis",
    "region": "Thighs"
  },
  {
    "id": "vastus_medialis",
    "name": "Vastus Medialis",
    "region": "Thighs"
  },
  {
    "id": "vastus_intermedius",
    "name": "Vastus Intermedius",
    "region": "Thighs"
  },
  {
    "id": "hamstrings",
    "name": "Hamstrings (Group)",
    "region": "Thighs",
    "type": "group",
    "members": [
      "biceps_femoris_long",
      "biceps_femoris_short",
      "semitendinosus",
      "semimembranosus"
    ],
    "syn": [
      "hams",
      "hamstrings"
    ]
  },
  {
    "id": "biceps_femoris_long",
    "name": "Biceps Femoris (Long Head)",
    "region": "Thighs"
  },
  {
    "id": "biceps_femoris_short",
    "name": "Biceps Femoris (Short Head)",
    "region": "Thighs"
  },
  {
    "id": "semitendinosus",
    "name": "Semitendinosus",
    "region": "Thighs"
  },
  {
    "id": "semimembranosus",
    "name": "Semimembranosus",
    "region": "Thighs"
  },
  {
    "id": "calves",
    "name": "Calves (Group)",
    "region": "Lower Leg",
    "type": "group",
    "members": [
      "gastroc_medial",
      "gastroc_lateral",
      "soleus",
      "plantaris"
    ],
    "syn": [
      "calves"
    ]
  },
  {
    "id": "gastroc_medial",
    "name": "Gastrocnemius (Medial)",
    "region": "Lower Leg"
  },
  {
    "id": "gastroc_lateral",
    "name": "Gastrocnemius (Lateral)",
    "region": "Lower Leg"
  },
  {
    "id": "soleus",
    "name": "Soleus",
    "region": "Lower Leg"
  },
  {
    "id": "plantaris",
    "name": "Plantaris",
    "region": "Lower Leg"
  },
  {
    "id": "tibialis_anterior",
    "name": "Tibialis Anterior",
    "region": "Lower Leg",
    "syn": [
      "tib ant"
    ]
  },
  {
    "id": "tibialis_posterior",
    "name": "Tibialis Posterior",
    "region": "Lower Leg"
  },
  {
    "id": "fibularis",
    "name": "Fibularis/Peroneals (Group)",
    "region": "Lower Leg",
    "type": "group",
    "members": [
      "fibularis_longus",
      "fibularis_brevis"
    ]
  },
  {
    "id": "fibularis_longus",
    "name": "Fibularis Longus",
    "region": "Lower Leg"
  },
  {
    "id": "fibularis_brevis",
    "name": "Fibularis Brevis",
    "region": "Lower Leg"
  },
  {
    "id": "neck_flexors",
    "name": "Neck Flexors",
    "region": "Neck/Other"
  },
  {
    "id": "sternocleidomastoid",
    "name": "Sternocleidomastoid",
    "region": "Neck/Other"
  },
  {
    "id": "traps_upper_neck",
    "name": "Upper Traps (Neck Support)",
    "region": "Neck/Other"
  },
  {
    "id": "abs",
    "name": "Abs (Rectus)",
    "region": "Core",
    "type": "alias",
    "members": [
      "rectus_abdominis"
    ]
  },
  {
    "id": "obliques",
    "name": "Obliques (Group)",
    "region": "Core",
    "type": "alias",
    "members": [
      "obliques_ext",
      "obliques_int"
    ]
  },
  {
    "id": "transverse",
    "name": "Transverse Abdominis",
    "region": "Core",
    "type": "alias",
    "members": [
      "transverse_abdominis"
    ]
  },
  {
    "id": "serratus",
    "name": "Serratus Anterior",
    "region": "Core",
    "type": "alias",
    "members": [
      "serratus_anterior"
    ]
  },
  {
    "id": "abductors",
    "name": "Hip Abductors (Group)",
    "region": "Hips/Glutes",
    "type": "alias",
    "members": [
      "glute_med",
      "glute_min",
      "tfl"
    ]
  },
  {
    "id": "adductors",
    "name": "Hip Adductors (Group)",
    "region": "Hips/Glutes",
    "type": "alias",
    "members": [
      "adductors_group"
    ]
  },
  {
    "id": "neck",
    "name": "Neck (Group)",
    "region": "Neck/Other",
    "type": "alias",
    "members": [
      "sternocleidomastoid",
      "neck_flexors",
      "neck_extensors"
    ]
  },
  {
    "id": "anconeus",
    "name": "Anconeus",
    "region": "Arms"
  },
  {
    "id": "pronators_group",
    "name": "Forearm Pronators (Group)",
    "region": "Forearms/Grip",
    "type": "group",
    "members": [
      "pronator_teres",
      "pronator_quadratus"
    ]
  },
  {
    "id": "pronator_teres",
    "name": "Pronator Teres",
    "region": "Forearms/Grip"
  },
  {
    "id": "pronator_quadratus",
    "name": "Pronator Quadratus",
    "region": "Forearms/Grip"
  },
  {
    "id": "supinator",
    "name": "Supinator",
    "region": "Forearms/Grip"
  },
  {
    "id": "flexor_carpi_radialis",
    "name": "Flexor Carpi Radialis",
    "region": "Forearms/Grip"
  },
  {
    "id": "flexor_carpi_ulnaris",
    "name": "Flexor Carpi Ulnaris",
    "region": "Forearms/Grip"
  },
  {
    "id": "palmaris_longus",
    "name": "Palmaris Longus",
    "region": "Forearms/Grip"
  },
  {
    "id": "flexor_digitorum",
    "name": "Finger Flexors (Group)",
    "region": "Forearms/Grip",
    "type": "group",
    "members": [
      "flexor_digitorum_superficialis",
      "flexor_digitorum_profundus"
    ]
  },
  {
    "id": "flexor_digitorum_superficialis",
    "name": "Flexor Digitorum Superficialis",
    "region": "Forearms/Grip"
  },
  {
    "id": "flexor_digitorum_profundus",
    "name": "Flexor Digitorum Profundus",
    "region": "Forearms/Grip"
  },
  {
    "id": "extensor_digitorum",
    "name": "Finger Extensors (Group)",
    "region": "Forearms/Grip",
    "type": "group",
    "members": [
      "extensor_digitorum_communis"
    ]
  },
  {
    "id": "extensor_digitorum_communis",
    "name": "Extensor Digitorum",
    "region": "Forearms/Grip"
  },
  {
    "id": "extensor_carpi_radialis_longus",
    "name": "Extensor Carpi Radialis Longus",
    "region": "Forearms/Grip"
  },
  {
    "id": "extensor_carpi_radialis_brevis",
    "name": "Extensor Carpi Radialis Brevis",
    "region": "Forearms/Grip"
  },
  {
    "id": "extensor_carpi_ulnaris",
    "name": "Extensor Carpi Ulnaris",
    "region": "Forearms/Grip"
  },
  {
    "id": "sartorius",
    "name": "Sartorius",
    "region": "Thighs"
  },
  {
    "id": "iliopsoas_group",
    "name": "Iliopsoas (Group)",
    "region": "Hips/Glutes",
    "type": "group",
    "members": [
      "psoas_major",
      "iliacus"
    ],
    "syn": [
      "iliopsoas"
    ]
  },
  {
    "id": "psoas_major",
    "name": "Psoas Major",
    "region": "Hips/Glutes"
  },
  {
    "id": "iliacus",
    "name": "Iliacus",
    "region": "Hips/Glutes"
  },
  {
    "id": "biceps",
    "name": "Biceps (Alias)",
    "region": "Arms",
    "type": "alias",
    "members": [
      "biceps_group"
    ]
  },
  {
    "id": "forearms",
    "name": "Forearms (Alias)",
    "region": "Forearms/Grip",
    "type": "alias",
    "members": [
      "forearms_group"
    ]
  },
  {
    "id": "tibialis",
    "name": "Tibialis (Alias)",
    "region": "Lower Leg",
    "type": "alias",
    "members": [
      "tibialis_anterior",
      "tibialis_posterior"
    ]
  },
  {
    "id": "calves_gastroc",
    "name": "Calves (Gastrocnemius)",
    "region": "Lower Leg",
    "type": "alias",
    "members": [
      "gastroc_medial",
      "gastroc_lateral"
    ]
  },
  {
    "id": "calves_soleus",
    "name": "Calves (Soleus)",
    "region": "Lower Leg",
    "type": "alias",
    "members": [
      "soleus"
    ]
  },
  {
    "id": "triceps_lat",
    "name": "Triceps (Lateral Head)",
    "region": "Arms",
    "type": "alias",
    "members": [
      "triceps_lateral"
    ]
  }
];
