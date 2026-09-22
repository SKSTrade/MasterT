(() => {
"use strict";

const STORAGE_KEY = "masterTradePracticeJournalV1Records";
const IMAGE_DB_NAME = "masterTradePracticeJournalImages";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE = "chartImages";

const $ = (id) => document.getElementById(id);
const checked = (id) => $(id).checked;
const direction = () =>
  document.querySelector('input[name="direction"]:checked').value;
const recordMode = () =>
  document.querySelector('input[name="recordMode"]:checked').value;

const countChecked = (ids) =>
  ids.filter(
    (id) => checked(id)
  ).length;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recordTradeDate(record) {
  if (record.tradeDate) return record.tradeDate;

  if (record.createdAt) {
    const parsed = new Date(record.createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return localDateString(parsed);
    }
  }

  return "";
}

const TIMEFRAMES = [
  "MN", "W", "D", "4H", "2H", "1H",
  "30M", "15M", "5M", "3M", "1M"
];

const STATES = {
  "健康升勢": {
    type: "healthy",
    bias: "up",
    note: "HH／HL清楚；主結未破；推動有延續；回調正常；突破前高後有follow-through。",
    priorityDeployment: "順勢Long優先：等回調到P1／P2支持、HL或有效突破回測，再配合完整Long Trigger；避免高位追價。",
    secondaryDeployment: "Short只作重大阻力／大局障礙附近嘅短程回調或反轉觀察；一般只限高級位置＋完整Trigger，唔當主劇本。"
  },
  "弱升勢": {
    type: "weak",
    bias: "up",
    note: "升勢主結仍未有效實收跌穿；即使Wick穿／Sweep收返、次結失守或深回調，都最多屬弱升。只有主結有效實收穿先進Transition。",
    priorityDeployment: "Long仍然優先，但只做P1／P2回調位置，唔追延伸段；最好等次級結構重新轉強再部署。",
    secondaryDeployment: "到重大阻力或上方流動性區，可用高質Trigger捕Short回調／反轉；仍要受更高級別方向同前方空間限制。"
  },
  "轉換中－偏升": {
    type: "transition",
    bias: "up",
    note: "原跌勢主結已被有效實收升穿，先正式進入Transition；開始出現HL候選或向上證據，但未正式完成新升勢確認。",
    priorityDeployment: "準備Long優先：等潛在HL、P1／P2支持或突破回測出Long Trigger；確認新升勢前最高仍按轉換權限。",
    secondaryDeployment: "Short可跟尚未完全破壞嘅局部跌勢／回調先行，但只做到潛在HL或主判支持前；一到支持區停止新Short。"
  },
  "轉換中－中性": {
    type: "transition",
    bias: null,
    note: "原趨勢主結已被有效實收穿，舊主導權失效；多空暫時冇清晰優勢，可能形成橫行／Range。",
    priorityDeployment: "優先等清晰區間形成後做P1／P2邊界，或者等有效突破接受＋首次回測再跟新方向。",
    secondaryDeployment: "若更高一級有明確方向，可做順更高級別嘅短程trade；中間位不做，目標以區間另一邊或重大障礙前為主。"
  },
  "轉換中－偏跌": {
    type: "transition",
    bias: "down",
    note: "原升勢主結已被有效實收跌穿，先正式進入Transition；開始出現LH候選或向下證據，但未正式完成新跌勢確認。",
    priorityDeployment: "準備Short優先：等潛在LH、P1／P2阻力或跌破回測出Short Trigger；確認新跌勢前最高仍按轉換權限。",
    secondaryDeployment: "Long可跟尚未完全破壞嘅局部升勢／反彈先行，但只做到潛在LH或主判阻力前；一到阻力區停止新Long。"
  },
  "弱跌勢": {
    type: "weak",
    bias: "down",
    note: "跌勢主結仍未有效實收升穿；即使Wick穿／Sweep收返、次結失守或深回調，都最多屬弱跌。只有主結有效實收穿先進Transition。",
    priorityDeployment: "Short仍然優先，但只做P1／P2回調位置，唔追延伸段；最好等次級結構重新轉弱再部署。",
    secondaryDeployment: "到重大支持或下方流動性區，可用高質Trigger捕Long反彈／反轉；仍要受更高級別方向同前方空間限制。"
  },
  "健康跌勢": {
    type: "healthy",
    bias: "down",
    note: "LH／LL清楚；主結未破；跌段有延續；回調正常；跌穿前低後有follow-through。",
    priorityDeployment: "順勢Short優先：等回調到P1／P2阻力、LH或有效跌破回測，再配合完整Short Trigger；避免低位追空。",
    secondaryDeployment: "Long只作重大支持／大局障礙附近嘅短程反彈或反轉觀察；一般只限高級位置＋完整Trigger，唔當主劇本。"
  }
};


const HSI_OPR_DIRECTION_CONTEXTS = {
  alignedTrend: {
    label: "順向順勢",
    note: "OPR方向＝主判／次判方向＝Trade方向。"
  },
  reverseOprTrend: {
    label: "反向順勢",
    note: "OPR方向逆主判／次判，但Trade方向仍然順主判／次判。"
  }
};

function hsiOprDirectionContextLabel(
  code
) {
  return (
    HSI_OPR_DIRECTION_CONTEXTS[
      code
    ]?.label || ""
  );
}

function hsiOprDirectionContextFromLabel(
  label
) {
  const entry =
    Object.entries(
      HSI_OPR_DIRECTION_CONTEXTS
    ).find(
      ([, info]) =>
        info.label === label
    );

  return entry?.[0] || "";
}

function isHsiOprContinuationRecord(
  record
) {
  return (
    record?.setupTemplate ===
      "hsi_opr_continuation" ||
    record?.setupVariant ===
      "oprContinuation" ||
    String(
      record?.setupTemplateLabel ||
      record?.setupFamily ||
      ""
    ).includes(
      "HSI-C"
    )
  );
}

const P3_CONTEXTS = {
  PB: {
    label: "P3-PB｜Pullback"
  },
  MID: {
    label: "P3-MID｜Neutral / Mid-location"
  },
  EXT: {
    label: "P3-EXT｜Extension"
  }
};

function p3ContextLabel(
  code
) {
  return (
    P3_CONTEXTS[code]?.label ||
    ""
  );
}

function recordRawP(
  record
) {
  return (
    record?.rawP ||
    record?.basePosition ||
    ""
  );
}

function recordP3Context(
  record
) {
  const value =
    String(
      record?.p3Context ||
      ""
    ).toUpperCase();

  return (
    value === "PB" ||
    value === "MID" ||
    value === "EXT"
  )
    ? value
    : "";
}

const MARKET_CONFIG = {
  HSI: {
    label: "HSI",
    preset: "hsi",
    defaultSymbol: "HSI",
    setupCodes: [
      "hsi_opr_2b",
      "hsi_structure_sweep",
      "hsi_opr_continuation",
      "trend_pullback",
      "custom"
    ],
    timeRule: "HSI：10:30後唔開新Setup；已入場倉位只按管理規則處理。"
  },
  UK100: {
    label: "UK100",
    preset: "eu",
    defaultSymbol: "UK100",
    setupCodes: [
      "eu_por_2b",
      "eu_asia_post_open",
      "eu_pure_full_repair",
      "trend_pullback",
      "custom"
    ],
    timeRule: "EU UTC+8：夏令POR 14:00–15:00、15:00開市；冬令POR 15:00–16:00、16:00開市。開市前Asia 2B唔入場。"
  },
  GER40: {
    label: "GER40",
    preset: "eu",
    defaultSymbol: "GER40",
    setupCodes: [
      "eu_por_2b",
      "eu_asia_post_open",
      "eu_pure_full_repair",
      "trend_pullback",
      "custom"
    ],
    timeRule: "EU UTC+8：夏令POR 14:00–15:00、15:00開市；冬令POR 15:00–16:00、16:00開市。開市前Asia 2B唔入場。"
  },
  FX: {
    label: "外匯",
    preset: "fx",
    defaultSymbol: "EURUSD",
    setupCodes: [
      "fx_session_2b",
      "fx_previous_high_low_sweep",
      "fx_liquidity_sweep",
      "fx_breakout_retest",
      "fx_p1_reversal",
      "trend_pullback",
      "custom"
    ],
    timeRule: "外匯：按交易Session及你現有時間規則執行；入場後仍須重新評估Entry-time Q。"
  },
  XAU: {
    label: "黃金",
    preset: "xau",
    defaultSymbol: "XAUUSD",
    setupCodes: [
      "xau_htf_location_sweep",
      "xau_asia_pdh_pdl",
      "xau_london_asia_sweep",
      "trend_pullback",
      "custom"
    ],
    timeRule: "XAU：D大局／4H主判／1H次判／15M或5M Trigger；1M只改善Entry，唔重新判方向。高速大陽／大陰Retest唔可以因低Volume放行。"
  }
};

const SETUP_DEFINITIONS = {
  hsi_opr_2b: {
    marketGroup: "HSI",
    label: "HSI-A｜OPR H／L 2B",
    type: "A",
    variant: "session2B",
    designatedTypeA: true,
    liquidityLabel: "OPR H／L",
    note: "Sweep OPR邊界 → Reclaim → 破1M微結構 → 第一次弱Retest。純OPR原始P3；高質可獲P2-effective待遇。"
  },
  hsi_structure_sweep: {
    marketGroup: "HSI",
    label: "HSI-B｜普通結構Sweep",
    type: "B",
    variant: "sweep",
    note: "Asia H／L、Mon H／L、PDH／PDL或15M局部Swing；冇OPR特殊升級。"
  },
  hsi_opr_continuation: {
    marketGroup: "HSI",
    label: "HSI-C｜OPR Continuation & Retest",
    type: "C",
    classificationLabel: "HSI-C｜OPR Continuation & Retest",
    variant: "oprContinuation",
    provisional: true,
    note: "V1.3 Research／Provisional：主判＋次判必須雙同向，而且Trade方向順主／次判；09:15–09:30 OPR完成；09:30後Full Reclaim OPR H/L＋Acceptance／Follow-through＋First Retest。OPR Direction Context只分順向順勢／反向順勢。Raw P3仍然P3，暫時冇E。"
  },
  hsi_breakout_retest: {
    marketGroup: "HSI_LEGACY",
    label: "舊版｜HSI Breakout＋Acceptance＋First Retest",
    type: "C",
    variant: "breakout",
    nativeP2: true,
    note: "15M／1H重要結構有效突破、Acceptance及第一次弱Retest；原生P2，改變1H狀態可屬P1事件。"
  },
  eu_por_2b: {
    marketGroup: "EU",
    label: "EU-A｜開市後POR H／L 2B",
    type: "A",
    variant: "session2B",
    designatedTypeA: true,
    liquidityLabel: "開市後POR H／L",
    note: "只限正式現貨開市後首次Sweep POR邊界。純POR原始P3；高質可獲P2-effective待遇。"
  },
  eu_asia_full_repair: {
    marketGroup: "EU_LEGACY",
    label: "舊版｜Asia Sweep＋POR Full Repair｜V1.3改作EU-D＋Asia Sweep Tag",
    type: "C",
    classificationLabel: "舊版｜Asia Sweep＋Full Repair",
    variant: "fullRepairAsia",
    nativeP2: true,
    note: "舊版記錄兼容。V1.3開始，Asia Sweep＋POR Repair視為同一Order-flow thesis；核心Setup記EU-D POR Full Repair，Asia Sweep只作Tag，唔Double E／Double Size。"
  },
  eu_pure_full_repair: {
    marketGroup: "EU",
    label: "EU-D｜POR Full Repair",
    type: "C",
    classificationLabel: "EU-D｜POR Full Repair",
    variant: "fullRepairPure",
    nativeP2: true,
    note: "V1.3正式EU-D：POR向一邊expand，cash open後完整repair，再有效Break／Acceptance另一邊POR boundary＋First Retest。Asia Sweep如同日出現只作Tag，唔重複計E／Size。"
  },
  eu_asia_post_open: {
    marketGroup: "EU",
    label: "EU-B｜Asia Sweep＋Post-open Confirmation",
    type: "C",
    classificationLabel: "EU-B｜Asia Sweep＋Post-open Confirmation",
    variant: "postOpenConfirmation",
    note: "V1.3正式EU-B：Asia H/L先被Sweep，cash open後提供獨立反方向confirmation＋First Retest。普通P3可獲P2-effective；同一Order-flow event只計一次E，唔重複升Size。"
  },
  fx_session_2b: {
    marketGroup: "FX",
    label: "FX-A｜Asia／OPR 2B",
    type: "A",
    variant: "session2B",
    designatedTypeA: true,
    liquidityLabel: "Asia／指定OPR H／L",
    note: "Sweep指定Session邊界 → Reclaim → 破15M／5M微結構 → 第一次弱Retest。純邊界原始P3；高質可P2-effective。"
  },
  fx_previous_high_low_sweep: {
    marketGroup: "FX",
    label: "FX-B｜Sweep PDH／PDL 或 PWH／PWL",
    classificationLabel: "FX-B｜Previous H/L Sweep",
    type: "B",
    variant: "sweep",
    previousHLSweepSetup: true,
    note: "外匯Previous H/L Sweep：揀PDH／PDL或PWH／PWL，再記錄Sweep發生喺Asia定Europe／London。仍然要有效Sweep＋Reclaim＋Retest；呢個Setup本身冇自動E或P升級。"
  },
  fx_liquidity_sweep: {
    marketGroup: "FX",
    label: "FX-Other｜普通Liquidity Sweep",
    type: "B",
    variant: "sweep",
    note: "Mon H／L、Europe H／L、局部Swing或其他普通Liquidity；冇自動P／Q升級。"
  },
  fx_breakout_retest: {
    marketGroup: "FX",
    label: "FX-C｜Breakout＋Acceptance＋First Retest",
    type: "C",
    variant: "breakout",
    nativeP2: true,
    note: "1H主結、4H工作結構、大Range邊界或舊支持阻力互換；有效Breakout＋Acceptance＋首次Retest＝原生P2。"
  },
  fx_p1_reversal: {
    marketGroup: "FX",
    label: "FX-D｜P1反轉Setup",
    type: "B",
    variant: "p1ReversalSweep",
    note: "只限Daily／4H主要P1、主判已弱、次判Sweep＋Reclaim＋右側反轉，而且第一段反應仍新鮮。"
  },
  xau_htf_location_sweep: {
    marketGroup: "XAU",
    label: "XAU-A｜HTF Location Sweep",
    type: "B",
    classificationLabel: "XAU-A｜HTF Location Sweep",
    variant: "sweep",
    xauFormalSetup: "A",
    note: "XAU首選：P1／P2，或者有清晰結構語義嘅P3位置（例如次判次結／working structure）＋meaningful liquidity sweep＋Reclaim＋Retest。Raw P3可以直接按P3 Matrix交易；只有合資格Liquidity E／E+先會另外取得P2-effective。Native Q永遠唔會被E改名。"
  },
  xau_asia_pdh_pdl: {
    marketGroup: "XAU",
    label: "XAU-B｜Sweep PDH／PDL 或 PWH／PWL",
    type: "B",
    classificationLabel: "XAU-B｜Previous H/L Sweep",
    variant: "sweep",
    xauFormalSetup: "B",
    previousHLSweepSetup: true,
    note: "XAU-B：揀PDH／PDL或PWH／PWL，再記錄Sweep發生喺Asia定Europe／London。兩者高質Sweep都係E+；Raw P3可獲P2-effective，但Native Q永久保留。"
  },
  xau_london_asia_sweep: {
    marketGroup: "XAU",
    label: "XAU-C｜London Sweep Asia H／L",
    type: "B",
    classificationLabel: "XAU-C｜London Sweep Asia H／L",
    variant: "sweep",
    xauFormalSetup: "C",
    xauFixedLiquidity: "asiaHL",
    xauFixedSession: "london",
    note: "XAU Secondary Setup：London／Europe Sweep Asia H／L → Reclaim → 弱Retest。Asia H／L＝E；Raw P3高質Sweep可獲P2-effective，但Native Q唔升級，整體優先度低過PWH/PWL同PDH/PDL。"
  },
  xau_session_2b: {
    marketGroup: "XAU_LEGACY",
    label: "舊版｜XAU Asia／OPR 2B",
    type: "B",
    variant: "sweep",
    note: "舊版記錄兼容；V1.3起唔再係XAU正式Type A打法。"
  },
  xau_htf_session_sweep: {
    marketGroup: "XAU_LEGACY",
    label: "舊版｜XAU HTF結構＋Session Sweep",
    type: "B",
    variant: "sweep",
    note: "舊版記錄兼容。"
  },
  xau_breakout_retest: {
    marketGroup: "XAU_LEGACY",
    label: "舊版｜XAU Breakout＋Acceptance＋First Retest",
    type: "C",
    variant: "breakout",
    nativeP2: true,
    note: "舊版記錄兼容。"
  },
  trend_pullback: {
    marketGroup: "ALL",
    label: "Type C｜強趨勢Pullback至真正結構",
    type: "C",
    variant: "trendPullback",
    note: "冇Sweep；只限強趨勢Context、真正P1／P2結構、第一次受控Retest及右側控制權確認。"
  },
  custom: {
    marketGroup: "ALL",
    label: "自訂｜按實際Setup分類",
    type: "B",
    variant: "sweep",
    manualType: true,
    note: "自訂Setup預設按Type B。手動揀Type A只係候選；核心Setup本身仍必須係指定Session 2B。即使6／6，自訂Setup亦唔會取得Type A。"
  }
};

const POSITION_INFO = {
  P1: {
    title: "大局級位置",
    note: "Weekly／Daily主要支持阻力、大局層或主判層主結、主判大型Range頂底、會改變主判Market State嘅突破＋回測、次判主結與HTF主要結構重疊，或者W／D 0.618與真實HTF結構重疊。"
  },
  P2: {
    title: "重要工作位置",
    note: "次判主結、主判次結、次判重要Range邊界、Breakout＋Acceptance＋第一次Retest、工作結構Swap、Impulse Origin，或者主要結構與Session Liquidity重疊。"
  },
  P3: {
    title: "普通局部位置",
    note: "次判次結、Trigger層主結、Session liquidity＋普通Local structure、0.618＋ordinary swap、Low-TF range boundary。Raw P同Execution P永久分開；合資格E只可令P3→P2-effective。"
  },
  P4: {
    title: "無價值位置",
    note: "大Range中間、純Fib、純Session線但冇Setup優勢、追價、前方障礙極近、上下距離接近冇Edge，或者冇真實結構支持。P4＝0。"
  }
};

const SIZE_LABELS = {
  0: "0注｜不做",
  0.25: "0.25注",
  0.5: "0.5注",
  1: "1注"
};

const BONUS_IDS = [];

let currentBaseTrigger = null;
let currentAsia2B = null;
let currentDecision = null;
let activeRecordId = null;
let suppressPresetChange = false;
let historySelectionMode = false;
const selectedHistoryRecordIds = new Set();
let currentFilteredHistoryIds = [];

let pendingImageBlobs = [];
let pendingImageUrls = [];
let editingImageBlobs = [];
let editingImageUrls = [];

function isTransition(stateName) {
  return STATES[stateName]?.type === "transition";
}

function isHealthy(stateName) {
  return STATES[stateName]?.type === "healthy";
}

function isWeak(stateName) {
  return STATES[stateName]?.type === "weak";
}

function stateBias(stateName) {
  return STATES[stateName]?.bias ?? null;
}

function biasDirectionLabel(bias) {
  if (bias === "up") return "Long";
  if (bias === "down") return "Short";
  return "中性";
}

function tradeBias() {
  return direction() === "Long" ? "up" : "down";
}

function transitionTypeInfo(
  mainState = $("mainState").value,
  secondaryState = $("secondaryState").value
) {
  const mainTransition =
    isTransition(mainState);
  const secondaryTransition =
    isTransition(secondaryState);

  if (!mainTransition && !secondaryTransition) {
    return {
      code: "N/A",
      label: "N/A｜無Transition",
      aligned: false,
      mixed: false,
      neutral: false
    };
  }

  const mainBias =
    mainTransition
      ? stateBias(mainState)
      : undefined;
  const secondaryBias =
    secondaryTransition
      ? stateBias(secondaryState)
      : undefined;

  if (
    mainTransition &&
    secondaryTransition &&
    (mainBias === null || secondaryBias === null)
  ) {
    return {
      code: "Neutral",
      label: "Neutral｜雙Transition且至少一層中性／Range",
      aligned: false,
      mixed: false,
      neutral: true
    };
  }

  if (mainTransition && secondaryTransition) {
    if (mainBias === secondaryBias) {
      return {
        code: "Aligned",
        label: `Aligned｜雙Transition同向偏${mainBias === "up" ? "升" : "跌"}`,
        aligned: true,
        mixed: false,
        neutral: false
      };
    }

    return {
      code: "Mixed",
      label: "Mixed｜雙Transition Bias相反",
      aligned: false,
      mixed: true,
      neutral: false
    };
  }

  return {
    code: "Single",
    label: "Single Transition｜只有一層處Transition",
    aligned: false,
    mixed: false,
    neutral: false
  };
}

function controlAlignmentInfo(
  secondaryState = $("secondaryState").value,
  tradeDirection = direction()
) {
  const tradeDirectionBias =
    tradeDirection === "Long" ? "up" : "down";
  const secondaryBias =
    stateBias(secondaryState);

  if (isTransition(secondaryState)) {
    return {
      code: "Transitioning",
      label: "Transitioning",
      note: secondaryBias === null
        ? "次判舊方向已失效／中性化，Immediate Control仍未正式建立新Trend。"
        : secondaryBias === tradeDirectionBias
          ? "次判正向交易方向Transition，但未完成正式Trend確認。"
          : "次判仍處Transition；Bias暫時反對交易方向，但未屬Confirmed Opposing Trend。"
    };
  }

  if (secondaryBias === tradeDirectionBias) {
    return {
      code: "Confirmed",
      label: "Confirmed",
      note: "次判已正式建立同交易方向Trend，Immediate Control支持今次交易。"
    };
  }

  return {
    code: "Opposing",
    label: "Opposing",
    note: "次判仍然係交易反方向Trend；Immediate Control反對今次交易。"
  };
}

function timeframeValues() {
  return {
    background: $("backgroundTimeframe").value,
    main: $("mainTimeframe").value,
    secondary: $("secondaryTimeframe").value,
    entry: $("entryTimeframe").value
  };
}

function marketCode(live = false) {
  const id =
    live
      ? "liveMarketCode"
      : "marketCode";

  return $(id)?.value || "FX";
}

function setupTemplateCode(live = false) {
  const id =
    live
      ? "liveSetupTemplate"
      : "setupTemplate";

  return $(id)?.value || "custom";
}

function setupDefinition(live = false) {
  return (
    SETUP_DEFINITIONS[
      setupTemplateCode(live)
    ] ||
    SETUP_DEFINITIONS.custom
  );
}

function setupVariant(live = false) {
  const definition =
    setupDefinition(live);

  if (
    definition.manualType
  ) {
    const selectedType =
      $(
        live
          ? "liveSetupType"
          : "setupType"
      ).value;

    if (selectedType === "C") {
      return "p1NoSweep";
    }

    if (selectedType === "A") {
      return "session2B";
    }

    return "sweep";
  }

  return definition.variant;
}

function isDesignatedTypeASetup(
  live = false
) {
  const definition =
    setupDefinition(live);

  if (!definition.designatedTypeA) {
    return false;
  }

  const market =
    marketCode(live);

  if (
    market === "UK100" ||
    market === "GER40"
  ) {
    return (
      setupTemplateCode(live) ===
      "eu_por_2b"
    );
  }

  return true;
}

function isXauFormalSetupCode(
  code = ""
) {
  return [
    "xau_htf_location_sweep",
    "xau_asia_pdh_pdl",
    "xau_london_asia_sweep"
  ].includes(code);
}

function isPreviousHLSweepSetup(
  live = false
) {
  return !!setupDefinition(live)
    .previousHLSweepSetup;
}

function previousHLSweepInfo(
  live = false
) {
  if (
    !isPreviousHLSweepSetup(live)
  ) {
    return {
      applicable: false,
      eligible: true,
      source: "",
      sourceLabel: "N/A",
      session: "",
      sessionLabel: "N/A",
      reason:
        "Previous H/L Sweep專用欄位不適用。"
    };
  }

  const prefix =
    live ? "livePrevHL" : "prevHL";

  const source =
    $(`${prefix}Source`).value;

  const session =
    $(`${prefix}Session`).value;

  const sourceLabels = {
    pdhPdl:
      "PDH／PDL",
    pwhPwl:
      "PWH／PWL"
  };

  const sessionLabels = {
    asia:
      "Asia時段",
    europe:
      "Europe／London時段"
  };

  const eligible =
    ["pdhPdl", "pwhPwl"]
      .includes(source) &&
    ["asia", "europe"]
      .includes(session);

  return {
    applicable: true,
    eligible,
    source,
    sourceLabel:
      sourceLabels[source] ||
      "未選Liquidity",
    session,
    sessionLabel:
      sessionLabels[session] ||
      "未選Session",
    reason:
      eligible
        ? `${sourceLabels[source]}｜${sessionLabels[session]} Sweep已記錄；Native Q仍由Sweep／Reclaim／Retest Price Action決定。`
        : "請揀PDH／PDL或PWH／PWL，同時揀Asia或Europe／London Sweep。"
  };
}

function syncPreviousHLSweepToXau(
  live = false
) {
  if (
    marketCode(live) !== "XAU" ||
    setupTemplateCode(live) !==
      "xau_asia_pdh_pdl"
  ) {
    return;
  }

  const info =
    previousHLSweepInfo(live);

  const prefix =
    live ? "liveXau" : "xau";

  if (
    ["pdhPdl", "pwhPwl"]
      .includes(info.source)
  ) {
    $(`${prefix}LiquiditySource`)
      .value = info.source;
  }

  if (
    ["asia", "europe"]
      .includes(info.session)
  ) {
    $(`${prefix}SweepSession`)
      .value =
        info.session === "asia"
          ? "asia"
          : "london";
  }
}

function xauLiquiditySourceInfo(
  value = "other"
) {
  const sources = {
    htfMajor: {
      label:
        "HTF主結／Major Swing／HTF Range／重要前Swing",
      rank:
        "第一級｜HTF結構流動性"
    },
    pwhPwl: {
      label:
        "PWH／PWL｜Previous Week High／Low",
      rank:
        "第二級｜PWH／PWL｜XAU高優先Liquidity"
    },
    pdhPdl: {
      label:
        "PDH／PDL",
      rank:
        "第二級｜PDH／PDL｜XAU高優先Liquidity"
    },
    monHL: {
      label:
        "Mon H／Mon L",
      rank:
        "第三級｜Mon H／L｜星期二後更有價值"
    },
    asiaHL: {
      label:
        "Asia H／Asia L",
      rank:
        "第四級｜Asia H／L｜Intraday Secondary"
    },
    oprHL: {
      label:
        "OPR H／OPR L",
      rank:
        "第四級｜OPR H／L｜Intraday Secondary"
    },
    other: {
      label:
        "其他／未指定",
      rank:
        "未分級"
    }
  };

  return sources[value] || sources.other;
}

function xauLiquidityEdgeInfo(
  live = false,
  positionOverride = null
) {
  if (
    marketCode(live) !== "XAU"
  ) {
    return {
      active: false,
      source: "other",
      sourceLabel: "N/A",
      rank: "N/A",
      session: "other",
      sessionLabel: "N/A",
      marker: "",
      markerLabel: "N/A",
      positionLabel:
        positionOverride || "N/A"
    };
  }

  const controlPrefix =
    live ? "liveXau" : "xau";

  const source =
    $(`${controlPrefix}LiquiditySource`)
      .value || "other";

  const session =
    $(`${controlPrefix}SweepSession`)
      .value || "other";

  const basePosition =
    positionOverride ||
    $(
      live
        ? "livePosition"
        : "positionLevel"
    ).value;

  const sourceInfo =
    xauLiquiditySourceInfo(source);

  const sessionLabels = {
    asia:
      "Asia時段",
    london:
      "London／Europe時段",
    other:
      "其他／未指定Session"
  };

  let marker = "";

  if (
    source === "pwhPwl" ||
    source === "pdhPdl"
  ) {
    marker = "E+";
  } else if (
    ["asiaHL", "monHL", "oprHL", "htfMajor"].includes(source)
  ) {
    marker = "E";
  }

  return {
    active: true,
    source,
    sourceLabel:
      sourceInfo.label,
    rank:
      sourceInfo.rank,
    session,
    sessionLabel:
      sessionLabels[session] ||
      sessionLabels.other,
    marker,
    markerLabel:
      marker || "無E標記",
    positionLabel:
      marker
        ? `${basePosition}-${marker}`
        : basePosition
  };
}

function xauLiquidityEnhancementInfo(
  baseTrigger,
  basePosition,
  live = false,
  qualityOverride = null
) {
  if (marketCode(live) !== "XAU") {
    return {
      applicable:false, sourceEligible:false, highQuality:false,
      promotePosition:false, promoteQuality:false, marker:"",
      reason:"XAU Liquidity Enhancement不適用。"
    };
  }

  const edge = xauLiquidityEdgeInfo(live, basePosition);
  const variant = setupVariant(live);
  const sweepModel = ["sweep","session2B","p1ReversalSweep"].includes(variant);
  const sourceEligible = ["pwhPwl","pdhPdl","asiaHL"].includes(edge.source);

  if (!sweepModel || !sourceEligible) {
    return {
      applicable:true, sourceEligible, highQuality:false,
      promotePosition:false, promoteQuality:false, marker:edge.marker,
      reason: !sweepModel
        ? "XAU E／E+位置Enhancement只適用Sweep／Reclaim模型。"
        : "呢個Liquidity來源可記Edge，但V1.3冇P3→P2-effective權力。"
    };
  }

  if (live) {
    const highQuality = checked("liveXauEnhancementCoreValid");
    return {
      applicable:true, sourceEligible:true, highQuality,
      promotePosition: basePosition === "P3" && highQuality,
      promoteQuality:false, marker:edge.marker,
      reason: highQuality
        ? `${edge.sourceLabel} ${edge.marker}高質Sweep：Raw P3可獲P2-effective；Native Q保持${qualityOverride || $("liveTriggerQuality").value}。`
        : `${edge.sourceLabel} ${edge.marker}只係候選Edge；要Sweep＋Reclaim有效、Control transfer成立、Retest未被否定同空間合格先有位置Enhancement。`
    };
  }

  const trigger = baseTrigger || {};
  const reclaimValid = trigger.validSweep === true && trigger.validReclaim === true && trigger.reclaimQuality !== "negated";
  const controlShift = trigger.microStructureShift === true;
  const retestNotInvalid = trigger.retestQuality !== "invalid";

  // V1.28.3：Q2-F／D／S只係Native Q研究Tag，唔取消有效Liquidity Location Enhancement。
  // RR亦由Obstacle層處理；E/E+只唔會救真正Invalid Retest／失效Sweep-Reclaim／冇Control transfer。
  const highQuality = reclaimValid && controlShift && retestNotInvalid;

  let reason = `${edge.sourceLabel} ${edge.marker}未取得位置Enhancement。`;
  if (highQuality) {
    reason = `${edge.sourceLabel} ${edge.marker}高質Sweep成立：可令Raw P3獲P2-effective；Native ${trigger.quality || "Q"}永久保留，E唔會Q2→Q3。`;
  } else if (trigger.retestQuality === "invalid") {
    reason = "Retest已真正Invalid：E／E+唔可以救Setup。Q2-F／D／S本身只係研究Tag，唔會取消Location Enhancement。";
  } else if (trigger.reclaimQuality === "negated") {
    reason = "Reclaim失效：E／E+完全救唔到。";
  } else if (!controlShift) {
    reason = "未有控制權轉移／微結構確認：未達高質Sweep。";
  }

  return {
    applicable:true, sourceEligible:true, highQuality,
    promotePosition: basePosition === "P3" && highQuality,
    promoteQuality:false, marker:edge.marker, reason
  };
}

function xauSetupPriorityLabel(
  code = ""
) {
  const labels = {
    xau_htf_location_sweep:
      "核心首選｜最高優先",
    xau_asia_pdh_pdl:
      "核心第二｜高優先",
    xau_london_asia_sweep:
      "Secondary｜次要打法"
  };

  return labels[code] ||
    "非XAU三個正式打法";
}

function xauSetupEligibilityInfo(
  live = false,
  positionOverride = null
) {
  const code =
    setupTemplateCode(live);

  if (
    marketCode(live) !== "XAU" ||
    !isXauFormalSetupCode(code)
  ) {
    return {
      applicable: false,
      eligible: true,
      reason:
        "XAU專用Setup限制不適用。"
    };
  }

  const basePosition =
    positionOverride ||
    $(
      live
        ? "livePosition"
        : "positionLevel"
    ).value;

  const edge =
    xauLiquidityEdgeInfo(
      live,
      basePosition
    );

  if (
    code ===
      "xau_htf_location_sweep"
  ) {
    const eligible =
      basePosition === "P1" ||
      basePosition === "P2" ||
      basePosition === "P3";

    return {
      applicable: true,
      eligible,
      reason:
        eligible
          ? basePosition === "P3"
            ? "XAU-A位置合格：Raw P3可以直接參與原本P3 × Native Q Matrix；例如次判次結／working structure被Sweep後Reclaim，唔需要先升P2先有交易資格。若另有合資格Liquidity E／E+，先再按既有規則處理P3→P2-effective；Native Q保持不變。"
            : `XAU-A位置合格：原生${basePosition} HTF Location；原生P唔會被E／E+改寫。若Liquidity來源係PWH／PWL或PDH／PDL E+、Asia H/L E，只可按既有規則有限度提升Execution P，Native Q保持不變。`
          : "XAU-A只排除P4／無價值位置；P1、P2、P3都可以按各自原生P × Native Q Matrix交易。"
    };
  }

  if (
    code ===
      "xau_asia_pdh_pdl"
  ) {
    const previousInfo =
      previousHLSweepInfo(live);

    const eligible =
      previousInfo.eligible &&
      (
        edge.source === "pdhPdl" ||
        edge.source === "pwhPwl"
      ) &&
      (
        edge.session === "asia" ||
        edge.session === "london"
      );

    return {
      applicable: true,
      eligible,
      reason:
        eligible
          ? `XAU-B成立：${previousInfo.sourceLabel}｜${previousInfo.sessionLabel} Sweep＝E+候選。Raw ${basePosition}仍照原生P記錄；高質Sweep可P3→P2-effective；Native Q永久保持原級。`
          : "XAU-B必須揀PDH／PDL或PWH／PWL，並記錄係Asia定Europe／London Sweep。"
    };
  }

  const eligible =
    edge.source === "asiaHL" &&
    edge.session === "london";

  return {
    applicable: true,
    eligible,
    reason:
      eligible
        ? `XAU-C成立：London／Europe Sweep Asia H／L＝${edge.markerLabel}候選。高質Sweep可令Raw P3獲P2-effective；Native Q保持原級，並仍受方向、Market cap同障礙限制。`
        : "XAU-C必須係London／Europe Sweep Asia H／L；純Setup名稱唔會自動創造方向或升級。"
  };
}

function applyXauTemplateDefaults(
  live = false
) {
  const panelId =
    live
      ? "liveXauLiquidityPanel"
      : "xauLiquidityPanel";

  if (!$(panelId)) return;

  const isXau =
    marketCode(live) === "XAU";

  $(panelId).classList.toggle(
    "hidden",
    !isXau
  );

  if (!isXau) return;

  const controlPrefix =
    live ? "liveXau" : "xau";

  const sourceSelect =
    $(`${controlPrefix}LiquiditySource`);

  const sessionSelect =
    $(`${controlPrefix}SweepSession`);

  const definition =
    setupDefinition(live);

  const code =
    setupTemplateCode(live);

  const sourceRowId =
    live
      ? "liveXauLiquiditySourceRow"
      : "xauLiquiditySourceRow";

  const sessionRowId =
    live
      ? "liveXauSweepSessionRow"
      : "xauSweepSessionRow";

  const usePreviousHLPanel =
    code ===
      "xau_asia_pdh_pdl";

  $(sourceRowId).classList.toggle(
    "hidden",
    usePreviousHLPanel
  );

  $(sessionRowId).classList.toggle(
    "hidden",
    usePreviousHLPanel
  );

  if (
    definition.xauFixedLiquidity
  ) {
    sourceSelect.value =
      definition.xauFixedLiquidity;
    sourceSelect.disabled = true;
  } else {
    sourceSelect.disabled = false;
    sourceSelect.value =
      code ===
        "xau_htf_location_sweep"
        ? "htfMajor"
        : "other";
  }

  if (
    definition.xauFixedSession
  ) {
    sessionSelect.value =
      definition.xauFixedSession;
    sessionSelect.disabled = true;
  } else {
    sessionSelect.disabled = false;
    sessionSelect.value = "other";
  }

  updateXauLiquidityUI(
    live
  );
}

function updateXauLiquidityUI(
  live = false,
  positionOverride = null
) {
  const panelId =
    live
      ? "liveXauLiquidityPanel"
      : "xauLiquidityPanel";

  if (!$(panelId)) return;

  const isXau =
    marketCode(live) === "XAU";

  $(panelId).classList.toggle(
    "hidden",
    !isXau
  );

  if (!isXau) return;

  const controlPrefix =
    live ? "liveXau" : "xau";

  const edge =
    xauLiquidityEdgeInfo(
      live,
      positionOverride
    );

  const eligibility =
    xauSetupEligibilityInfo(
      live,
      positionOverride
    );

  $(`${controlPrefix}LiquidityRank`)
    .textContent =
      edge.rank;

  $(`${controlPrefix}EdgeMarker`)
    .textContent =
      edge.markerLabel;

  $(`${controlPrefix}PositionEdgeLabel`)
    .textContent =
      edge.positionLabel;

  $(`${controlPrefix}SetupPriority`)
    .textContent =
      xauSetupPriorityLabel(
        setupTemplateCode(live)
      );

  $(`${controlPrefix}LiquidityNote`)
    .textContent =
      `${eligibility.reason} 原生P仍照Raw P記錄；V1.3只有PWH／PWL、PDH／PDL E+或Asia H/L E高質Sweep可P3→P2-effective；Native Q永久保留，永遠唔創造方向權限。`;
}

function populateSetupTemplateSelect(
  market,
  selectId,
  preferredCode = ""
) {
  const select = $(selectId);

  if (!select) return;

  const config =
    MARKET_CONFIG[market] ||
    MARKET_CONFIG.FX;

  const allowed =
    config.setupCodes;

  select.innerHTML = "";

  allowed.forEach((code) => {
    const definition =
      SETUP_DEFINITIONS[code];

    select.add(
      new Option(
        definition.label,
        code
      )
    );
  });

  const next =
    allowed.includes(preferredCode)
      ? preferredCode
      : allowed[0];

  select.value = next;
}

function applySetupTemplate(
  live = false
) {
  const definition =
    setupDefinition(live);

  const typeId =
    live
      ? "liveSetupType"
      : "setupType";

  const typeSelect =
    $(typeId);

  resetSetupTypeOptionLabels(
    typeSelect
  );

  if (!definition.manualType) {
    const typeOption =
      typeSelect.querySelector(
        `option[value="${definition.type}"]`
      );

    if (
      typeOption &&
      definition.classificationLabel
    ) {
      typeOption.textContent =
        definition.classificationLabel;
    }

    typeSelect.value =
      definition.type;
  }

  typeSelect.disabled =
    !definition.manualType;

  const noteId =
    live
      ? "liveSetupTemplateNote"
      : "setupTemplateNote";

  if ($(noteId)) {
    $(noteId).textContent =
      definition.note;
  }

  const typeLabelId =
    live
      ? "liveSetupClassification"
      : "setupClassification";

  if ($(typeLabelId)) {
    $(typeLabelId).textContent =
      setupClassificationLabel(
        live
      );
  }

  applyXauTemplateDefaults(
    live
  );

  const previousHLPanelId =
    live
      ? "livePreviousHLSweepPanel"
      : "previousHLSweepPanel";

  $(previousHLPanelId)
    .classList.toggle(
      "hidden",
      !isPreviousHLSweepSetup(live)
    );

  if (
    isPreviousHLSweepSetup(live)
  ) {
    syncPreviousHLSweepToXau(
      live
    );
  }
}

function applyMarketPreset(
  market,
  live = false
) {
  const config =
    MARKET_CONFIG[market] ||
    MARKET_CONFIG.FX;

  const selectId =
    live
      ? "liveSetupTemplate"
      : "setupTemplate";

  const previous =
    $(selectId)?.value || "";

  populateSetupTemplateSelect(
    market,
    selectId,
    previous
  );

  applySetupTemplate(live);

  if (!live) {
    $("timeframePreset").value =
      config.preset;
    applyTimeframePreset(
      config.preset
    );

    const knownDefaults = [
      "HSI",
      "UK100",
      "GER40",
      "EURUSD",
      "XAUUSD"
    ];

    const currentSymbol =
      $("symbol").value
        .trim()
        .toUpperCase();

    if (
      !currentSymbol ||
      knownDefaults.includes(
        currentSymbol
      )
    ) {
      $("symbol").value =
        config.defaultSymbol;
    }

    $("marketTimeRuleNote")
      .textContent =
        config.timeRule;
  }
}

function setupTypeFromTemplate(
  live = false
) {
  const definition =
    setupDefinition(live);

  const selectedType =
    $(
      live
        ? "liveSetupType"
        : "setupType"
    ).value;

  return definition.manualType
    ? selectedType
    : definition.type;
}

function applyTimeframePreset(value) {
  suppressPresetChange = true;

  if (
    value === "fx" ||
    value === "xau"
  ) {
    $("backgroundTimeframe").value =
      "D";
    $("mainTimeframe").value =
      "4H";
    $("secondaryTimeframe").value =
      "1H";
    $("entryTimeframe").value =
      "15M";
  } else if (
    value === "hsi"
  ) {
    $("backgroundTimeframe").value =
      "4H";
    $("mainTimeframe").value =
      "1H";
    $("secondaryTimeframe").value =
      "15M";
    $("entryTimeframe").value =
      "1M";
  } else if (
    value === "eu"
  ) {
    $("backgroundTimeframe").value =
      "4H";
    $("mainTimeframe").value =
      "1H";
    $("secondaryTimeframe").value =
      "15M";
    $("entryTimeframe").value =
      "5M";
  }

  suppressPresetChange = false;
}

function marketRelation(mainState, secondaryState) {
  const transition =
    transitionTypeInfo(
      mainState,
      secondaryState
    );

  if (transition.code === "Aligned") {
    return "Aligned Transition";
  }

  if (transition.code === "Mixed") {
    return "Mixed Transition";
  }

  if (transition.code === "Neutral") {
    return "Neutral／Range Transition";
  }

  if (transition.code === "Single") {
    return "包含單層Transition";
  }

  const mainBias =
    stateBias(mainState);
  const secondaryBias =
    stateBias(secondaryState);

  if (
    mainBias !== null &&
    mainBias === secondaryBias
  ) {
    return (
      isHealthy(mainState) &&
      isHealthy(secondaryState)
    )
      ? "雙健康同向"
      : "同向有弱勢";
  }

  if (
    mainBias !== null &&
    secondaryBias !== null &&
    mainBias !== secondaryBias
  ) {
    return "方向衝突";
  }

  return "方向未確認";
}

function computeMarketRoute(
  mainState,
  secondaryState,
  tradeDirection
) {
  const relation =
    marketRelation(
      mainState,
      secondaryState
    );

  const mainBias = stateBias(mainState);
  const secondaryBias = stateBias(secondaryState);
  const currentTradeBias =
    tradeDirection === "Long" ? "up" : "down";
  const mainTransition = isTransition(mainState);
  const secondaryTransition = isTransition(secondaryState);
  const transition =
    transitionTypeInfo(mainState, secondaryState);

  const result = (code, label, cap, reason) => ({
    code,
    label,
    cap,
    relation,
    transitionType: transition.code,
    transitionTypeLabel: transition.label,
    reason
  });

  if (transition.code === "Aligned") {
    const commonBias = mainBias;

    if (currentTradeBias === commonBias) {
      return result(
        "alignedTransition",
        `Aligned Transition｜順共同${biasDirectionLabel(commonBias)}`,
        0.5,
        "雙Transition同方向偏向，視為Early Trend Initiation研究類別。Market Cap 0.5；正式Matrix P2＋Native Q3仍只0.25，0.5只做Shadow Test。"
      );
    }

    return result(
      "alignedReverse",
      "Aligned Transition｜反共同偏向",
      0,
      "反Aligned Transition共同偏向正常0；只有既有窄義HTF P1 Probe例外可開0.25。"
    );
  }

  if (transition.code === "Mixed") {
    return result(
      "mixedTransition",
      "Mixed Transition｜Conflict環境",
      0.5,
      "主判＋次判都係Transition但Bias相反；只按邊界P同Native Q部署，預設Trade Objective＝Reaction。"
    );
  }

  if (transition.code === "Neutral") {
    return result(
      "neutralTransition",
      "Neutral／Range Transition｜只做邊界",
      0.5,
      "雙層都係Transition，而且至少一層中性／大型Range；Long優先底25%、Short優先頂25%，真正Range中間固定0。"
    );
  }

  if (mainTransition || secondaryTransition) {
    if (mainTransition && !secondaryTransition) {
      // E / M：主判中性Transition，但次判已Confirmed，唔再歸入neutralTransition。
      if (mainBias === null) {
        if (currentTradeBias === secondaryBias) {
          return result(
            "neutralMainConfirmed",
            `主判中性Transition｜跟次判${biasDirectionLabel(secondaryBias)}`,
            0.5,
            "主判中性Transition冇方向Authority，但次判已Confirmed；常規方向跟次判。Size按P1/P2 0.5/0.25 Matrix，但Trade Objective固定Reaction。"
          );
        }

        return result(
          "neutralMainReverse",
          "主判中性Transition｜逆次判Confirmed",
          0.25,
          "主判中性唔等於反方向有權；逆唯一Confirmed Control正常0，只限清晰HTF P1／主判Range Boundary＋Native Q3作0.25 Reaction Probe。"
        );
      }

      // C：Directional Transition + Confirmed，同方向。
      if (mainBias === secondaryBias) {
        if (currentTradeBias === secondaryBias) {
          return result(
            "transitionConfirmed",
            "主判Transition＋次判Trend同向｜順方向",
            0.5,
            "主判Directional Transition與次判已確認Trend同向；P1／P2＋Q3最高0.5。"
          );
        }
        return result(
          "alignedReverse",
          "主判Transition＋次判Trend同向｜反共同方向",
          0,
          "反共同方向正常0；只有現行窄義HTF P1反轉例外。"
        );
      }

      // J：主判Directional Transition與次判Confirmed反方向；兩個交易方向Size相同，Control tag不同。
      if (
        currentTradeBias === secondaryBias ||
        currentTradeBias === mainBias
      ) {
        const followsConfirmed =
          currentTradeBias === secondaryBias;
        return result(
          "transitionVsConfirmedConflict",
          followsConfirmed
            ? "主判Directional Transition × 次判Confirmed反向｜做次判Confirmed方向"
            : "主判Directional Transition × 次判Confirmed反向｜做主判Transition Bias方向",
          0.5,
          followsConfirmed
            ? "次判Confirmed Control支持，但主判Transition Bias反對；P1 Q3 0.5、P2 Q3 0.25，Objective固定Reaction。"
            : "主判Transition Bias支持，但次判Confirmed Control反對；P1 Q3 0.5、P2 Q3 0.25，Objective固定Reaction。"
        );
      }
    }

    if (!mainTransition && secondaryTransition) {
      if (secondaryBias === null) {
        if (currentTradeBias === mainBias) {
          return result(
            "conflictMain",
            "主判Trend＋次判中性Transition｜順主判",
            0.5,
            "順主判有方向權，但次判Immediate Control只屬Transitioning；唔自動當高質。"
          );
        }
        return result(
          "alignedReverse",
          "主判Trend＋次判中性Transition｜逆主判",
          0,
          "逆主判而次判仍未確認反方向Trend，正常0；現行只保留窄義HTF P1反轉例外。"
        );
      }

      // C：Confirmed + Directional Transition，同方向。
      if (secondaryBias === mainBias) {
        if (currentTradeBias === mainBias) {
          return result(
            "weakAligned",
            "主判Trend＋次判Transition同向｜順共同方向",
            0.5,
            "方向同向但含Transition；最高0.5。"
          );
        }
        return result(
          "alignedReverse",
          "主判Trend＋次判Transition同向｜反共同方向",
          0,
          "反共同方向正常0。"
        );
      }

      // I：順主判、次判Transition Against，保留原規則。
      if (currentTradeBias === mainBias) {
        return result(
          "conflictMain",
          "主判Trend｜順主判、次判Transition反向",
          0.5,
          "順主判有方向權，但Immediate Control處Transitioning／可能反對；Control Alignment只記錄研究，暫時唔直接改Size。"
        );
      }

      // K / L：逆主判，按主判健康/弱勢拆開。
      if (currentTradeBias === secondaryBias) {
        if (isWeak(mainState)) {
          return result(
            "reverseWeakMain",
            "逆弱主判｜次判Transition偏向支持",
            0.25,
            "普通逆弱主判冇自動權限；只限Route A／Route B＋P1/P2/P2-E＋Native Q3，最高0.25。"
          );
        }
        return result(
          "reverseHealthyMain",
          "逆健康主判｜次判Transition偏向支持",
          0.25,
          "健康主判Authority未失效；正常0，只限Active HTF P1第一反應＋P1/P2/P2-E＋Native Q3右側反轉，最高0.25 Reaction Probe。"
        );
      }
    }
  }

  if (relation === "雙健康同向" || relation === "同向有弱勢") {
    const commonBias = mainBias;

    if (currentTradeBias !== commonBias) {
      return result(
        "alignedReverse",
        "雙同向｜反共同方向",
        0,
        `主判＋次判共同${biasDirectionLabel(commonBias)}；正常0，只有現行窄義HTF P1反轉例外可0.25 Probe。`
      );
    }

    if (relation === "雙健康同向") {
      return result(
        "healthyAligned",
        `雙健康同向｜順共同${biasDirectionLabel(commonBias)}`,
        1,
        "主判＋次判健康同向；P1／P2＋Native Q3最高1注。"
      );
    }

    return result(
      "weakAligned",
      `同向有弱勢｜順共同${biasDirectionLabel(commonBias)}`,
      0.5,
      "方向同向但至少一層弱勢；最高0.5。"
    );
  }

  if (relation === "方向衝突") {
    if (currentTradeBias === mainBias) {
      return result(
        "conflictMain",
        `方向衝突｜順主判${biasDirectionLabel(mainBias)}、逆次判`,
        0.5,
        "順主判有方向權，但Immediate Control反對時唔再自動當高質；P1／P2＋Q3最高0.5。"
      );
    }

    if (isWeak(mainState)) {
      return result(
        "reverseWeakMain",
        `逆弱主判｜順次判${biasDirectionLabel(secondaryBias)}`,
        0.25,
        "普通逆弱主判冇自動權限；只限Route A／Route B＋P1/P2/P2-E＋Native Q3，最高0.25。"
      );
    }

    return result(
      "reverseHealthyMain",
      `逆健康主判｜順次判${biasDirectionLabel(secondaryBias)}`,
      0.25,
      "健康主判Authority未失效；正常0，只限Active HTF P1第一反應＋P1/P2/P2-E＋Native Q3右側反轉，最高0.25 Reaction Probe。"
    );
  }

  return result(
    "noRoute",
    "方向未確認｜不做",
    0,
    "主判／次判未形成可分類方向權限。"
  );
}

function marketRouteInfo() {
  return computeMarketRoute(
    $("mainState").value,
    $("secondaryState").value,
    direction()
  );
}

function backgroundRelationInfo() {
  const state =
    $("backgroundState").value;
  const bias =
    stateBias(state);
  const type =
    STATES[state].type;

  if (bias === null) {
    return {
      label: "大局中性",
      note:
        "大局背景暫時冇明確方向；只負責重大位置、空間同風險限制，唔會令低質交易升級。"
    };
  }

  const aligned =
    bias === tradeBias();
  const descriptor =
    type === "transition"
      ? "傾向"
      : "方向";

  return {
    label: aligned
      ? `順大局${descriptor}`
      : `逆大局${descriptor}`,
    note:
      "大局只提供順風／逆風、重大支持阻力同目標空間；方向規則仍由主判 × 次判市場關係決定。"
  };
}

function preferredDirectionInfo() {
  const route = marketRouteInfo();
  const mainBias = stateBias($("mainState").value);
  const secondaryBias = stateBias($("secondaryState").value);

  if (["healthyAligned", "weakAligned", "alignedTransition"].includes(route.code)) {
    return {
      label: `只做共同${biasDirectionLabel(mainBias ?? secondaryBias)}`,
      note: route.reason
    };
  }

  if (route.code === "alignedReverse") {
    return { label: "共同方向優先｜反向只限窄義P1 Probe", note: route.reason };
  }

  if (route.code === "conflictMain") {
    return { label: `順主判${biasDirectionLabel(mainBias)}優先`, note: route.reason };
  }

  if (route.code === "reverseWeakMain") {
    return { label: `主判${biasDirectionLabel(mainBias)}仍係Primary｜逆向只限Route A/B`, note: route.reason };
  }

  if (route.code === "reverseHealthyMain") {
    return { label: `健康主判${biasDirectionLabel(mainBias)}仍係Primary｜逆向只限Active P1 Probe`, note: route.reason };
  }

  if (route.code === "neutralMainConfirmed") {
    return { label: "主判中性｜常規跟次判Confirmed方向", note: route.reason };
  }

  if (route.code === "neutralMainReverse") {
    return { label: "次判Confirmed方向優先｜逆向只限P1/Range Boundary Probe", note: route.reason };
  }

  if (route.code === "transitionVsConfirmedConflict") {
    return { label: "Directional Transition × Confirmed反向｜按Control Alignment研究", note: route.reason };
  }

  if (route.code === "conflictSecondary") {
    return { label: `舊版逆主判Route`, note: route.reason };
  }

  if (route.code === "transitionConfirmed") {
    return { label: "順已確認方向／Immediate Control優先", note: route.reason };
  }

  if (route.code === "transitionReverse") {
    return { label: "已確認方向優先｜反向只作Reaction Probe", note: route.reason };
  }

  if (["mixedTransition", "neutralTransition"].includes(route.code)) {
    return { label: "只做有效邊界／Reaction劇本", note: route.reason };
  }

  return { label: "等待方向權限", note: route.reason };
}

function combinedDeploymentInfo() {
  const route = marketRouteInfo();
  const map = {
    healthyAligned: {priority:"雙健康同向：P1／P2＋Native Q3最高1注。",secondary:"P3低一級；反向正常0。"},
    weakAligned: {priority:"同向含弱勢：P1／P2＋Q3最高0.5。",secondary:"Q2按Matrix降級；避免延伸段追價。"},
    alignedTransition: {priority:"Aligned Transition：Early Trend Initiation；P1 Q3 0.5、P2 Q3正式0.25。",secondary:"P2 Q3→0.5只做Shadow Test，唔影響正式Size。"},
    mixedTransition: {priority:"Mixed Transition：Conflict環境，只做邊界。",secondary:"P1 Q3 0.5、P2 Q3 0.25；Q2大幅收緊，Objective預設Reaction。"},
    neutralTransition: {priority:"Neutral／Range Transition：只做Range邊界。",secondary:"Long底25%、Short頂25%；中間P4＝0。"},
    alignedReverse: {priority:"反共同方向正常0。",secondary:"只有窄義HTF P1＋原生至少P2＋Native Q3＋等價右側確認＋新鮮反應先0.25 Probe。"},
    conflictMain: {priority:"方向衝突順主判：P1／P2＋Q3最高0.5。",secondary:"Control若Opposing要特別記錄；Q2通常0.25／0。"},
    conflictSecondary: {priority:"舊版逆主判Route；新紀錄會拆分Weak／Healthy。",secondary:"保留舊資料兼容。"},
    reverseWeakMain: {priority:"逆弱主判：只有Route A／B＋P1/P2/P2-E＋Native Q3先有權。",secondary:"Route成立一律最高0.25；Q2＝0。"},
    reverseHealthyMain: {priority:"逆健康主判：正常0。",secondary:"Active HTF P1第一反應＋P1/P2/P2-E＋Native Q3先可0.25 Reaction Probe。"},
    neutralMainConfirmed: {priority:"主判中性Transition＋次判Confirmed：常規跟次判，最高0.5。",secondary:"Trade Objective固定Reaction；唔歸neutralTransition。"},
    neutralMainReverse: {priority:"主判中性但逆次判Confirmed：正常0。",secondary:"只限HTF P1／Range Boundary＋Native Q3＝0.25 Reaction Probe。"},
    transitionVsConfirmedConflict: {priority:"主判Directional Transition × 次判Confirmed反向：P1 Q3 0.5、P2 Q3 0.25。",secondary:"兩個交易方向Size相同；Control Alignment分Confirmed／Opposing研究。"},
    transitionConfirmed: {priority:"包含單層Directional Transition但同Confirmed方向一致：最高0.5。",secondary:"Native Q3可Expansion；P2-E＋Q2全局最多0.25。"},
    transitionReverse: {priority:"主判Transition反向部署：只作窄義Reaction Probe。",secondary:"真正P1 Q3或既有方向合格P1 Tailwind例外；最高0.25。"}
  };
  return map[route.code] || {priority:"方向權限未成立：不部署。",secondary:"等待Market State及方向關係清晰。"};
}

function triggerModelLabel() {
  return "Q Trigger｜按Setup Type評確認質素";
}

function setupTypeLabel(code) {
  const labels = {
    A: "Type A｜高質Session 2B",
    B: "Type B｜普通Sweep＋Reclaim",
    C: "Type C｜Breakout／No Sweep"
  };

  return labels[code] || code;
}

function setupClassificationLabel(
  live = false,
  typeOverride = null
) {
  const definition =
    setupDefinition(live);

  const type =
    typeOverride ||
    setupTypeFromTemplate(live);

  if (
    !definition.manualType &&
    type === definition.type &&
    definition.classificationLabel
  ) {
    return definition.classificationLabel;
  }

  return setupTypeLabel(type);
}

function resetSetupTypeOptionLabels(
  select
) {
  const labels = {
    A: "Type A｜高質Session 2B",
    B: "Type B｜普通Sweep＋Reclaim",
    C: "Type C｜Breakout／No Sweep"
  };

  Object.entries(labels).forEach(
    ([value, label]) => {
      const option =
        select.querySelector(
          `option[value="${value}"]`
        );

      if (option) {
        option.textContent =
          label;
      }
    }
  );
}

function positionTreatmentLabel(
  treatment,
  basePosition = "",
  effectivePosition = ""
) {
  if (treatment === "nativeP2") {
    return `${basePosition || "P3"} → 原生P2`;
  }

  if (treatment === "p2Effective") {
    return `${basePosition || "P3"} → P2-effective`;
  }

  return `原生${effectivePosition || basePosition || "未記錄"}`;
}

function counterP2BasisLabel(basis) {
  const labels = {
    p1Tailwind:
      "P1順風｜健康／弱主判均適用",
    healthyTailwind:
      "舊版｜主判健康＋有效P1順風",
    weakBreakRetest:
      "路徑A｜弱主判次結突破＋首次Retest",
    weakFreshSession:
      "路徑B｜健康次判＋新Session獨立確認",
    none:
      "冇"
  };

  return labels[basis] || basis || "冇";
}

function evaluateBaseTrigger() {
  const selectedSetupType =
    setupTypeFromTemplate(false);

  const variant =
    setupVariant(false);

  const failures = [];
  const coreFailures = [];
  const imperfections = [];
  const positives = [];

  const validSweep =
    checked("validSweep");
  const validReclaim =
    checked("validReclaim");
  const reclaimQuality =
    $("reclaimQuality").value;
  const microStructureShift =
    checked("microStructureShift");

  const validBreakout =
    checked("validBreakout");
  const validAcceptance =
    checked("validAcceptance");
  const firstRetest =
    variant === "trendPullback"
      ? checked("trendFirstRetest")
      : checked("firstRetest");
  const breakoutQuality =
    $("breakoutQuality").value;

  const fullRepairComplete =
    checked("fullRepairComplete");
  const fullRepairAsiaSweep =
    checked("fullRepairAsiaSweep");
  const fullRepairEntryOutside =
    checked("fullRepairEntryOutside");
  const fullRepairAcceptedBackInside =
    checked(
      "fullRepairAcceptedBackInside"
    );

  const postOpenAsiaSweep =
    checked("postOpenAsiaSweep");
  const postOpenAfterOpen =
    checked("postOpenAfterOpen");
  const postOpenDriveConfirmed =
    checked("postOpenDriveConfirmed");
  const postOpenPreOpenEntry =
    checked("postOpenPreOpenEntry");

  const openingDriveStatus =
    $("openingDriveStatus").value;

  const noSweepRejection =
    checked("noSweepRejection");
  const strongTrendContext =
    checked("strongTrendContext");
  const trueStructureRetest =
    checked("trueStructureRetest");

  const retestQuality =
    $("retestQuality").value;
  const q2FastRetest =
    checked("q2FastRetest");
  const q2DeepRetest =
    checked("q2DeepRetest");
  const q2StrongRetest =
    checked("q2StrongRetest");
  const tradeSpace =
    $("tradeSpace").value;

  const addCoreFailure = (text) => {
    coreFailures.push(text);
  };

  const addImperfection = (text) => {
    imperfections.push(text);
  };

  const addPositive = (text) => {
    positives.push(text);
  };

  const evaluateSweepCore = () => {
    if (!validSweep) {
      addCoreFailure(
        "冇有效Sweep。"
      );
    } else {
      addPositive(
        "有效Sweep成立。"
      );
    }

    if (!validReclaim) {
      addCoreFailure(
        "冇有效Reclaim。"
      );
    } else {
      addPositive(
        "有效Reclaim成立。"
      );
    }

    if (
      reclaimQuality === "negated"
    ) {
      addCoreFailure(
        "Reclaim被吞噬／否定。"
      );
    } else if (
      reclaimQuality === "ordinary"
    ) {
      addImperfection(
        "Sweep／Reclaim有效，但質素處於邊緣。"
      );
    } else {
      addPositive(
        "Sweep／Reclaim乾淨明確。"
      );
    }

    if (!microStructureShift) {
      addImperfection(
        "未見清晰微結構突破／控制權轉移。"
      );
    } else {
      addPositive(
        "微結構突破／控制權轉移成立。"
      );
    }
  };

  const evaluateBreakoutCore = ({
    acceptanceRequired = true
  } = {}) => {
    if (!validBreakout) {
      addCoreFailure(
        "冇有效Breakout／結構突破。"
      );
    } else {
      addPositive(
        "有效Breakout／結構突破成立。"
      );
    }

    if (acceptanceRequired) {
      if (!validAcceptance) {
        addCoreFailure(
          "Breakout後冇有效Acceptance。"
        );
      } else {
        addPositive(
          "Breakout後Acceptance成立。"
        );
      }
    } else if (validAcceptance) {
      addPositive(
        "開市後推進有額外Acceptance支持。"
      );
    }

    if (!firstRetest) {
      addCoreFailure(
        "唔係同一Opening Drive第一次實質Retest。"
      );
    } else {
      addPositive(
        "同一Opening Drive第一次實質Retest成立。"
      );
    }

    if (
      breakoutQuality === "negated"
    ) {
      addCoreFailure(
        "Opening Drive被吞噬／重新Acceptance返原Range。"
      );
    } else if (
      breakoutQuality === "ordinary"
    ) {
      addImperfection(
        "Opening Drive／Acceptance只屬合格，Follow-through普通。"
      );
    } else {
      addPositive(
        "Opening Drive／Acceptance乾淨明確。"
      );
    }

    if (!microStructureShift) {
      if (acceptanceRequired) {
        addImperfection(
          "控制權轉移／微結構確認未完整。"
        );
      } else {
        addCoreFailure(
          "Post-open Confirmation未破微結構／工作結構。"
        );
      }
    } else {
      addPositive(
        "控制權轉移／微結構確認成立。"
      );
    }
  };

  const evaluateOpeningDriveValidity = () => {
    if (
      openingDriveStatus === "expired"
    ) {
      addCoreFailure(
        "Opening Drive已過期。"
      );
    } else if (
      openingDriveStatus === "delayed"
    ) {
      addPositive(
        "延遲Setup仍屬原Opening Story；Entry-time Q必須按成交落法重新評估。"
      );
    } else {
      addPositive(
        "同一Opening Drive仍新鮮。"
      );
    }
  };

  if (
    variant === "session2B" ||
    variant === "sweep" ||
    variant === "p1ReversalSweep"
  ) {
    evaluateSweepCore();
  } else if (
    variant === "breakout"
  ) {
    evaluateBreakoutCore();
  } else if (
    variant === "oprContinuation"
  ) {
    if (!checked("hsiOprWindowComplete")) {
      addCoreFailure("HSI-C：09:15–09:30 OPR未確認完成。");
    } else {
      addPositive("HSI-C：09:15–09:30 OPR完成。");
    }
    if (!checked("hsiOprAfter0930")) {
      addCoreFailure("HSI-C：Break唔係09:30後。");
    } else {
      addPositive("HSI-C：09:30後先Break OPR。");
    }
    if (!checked("hsiOprTrendAligned")) {
      addCoreFailure("HSI-C：主判＋次判未雙同向，或者Trade方向未順主／次判。");
    } else {
      addPositive("HSI-C：主判＋次判雙同向，而且Trade方向順主／次判。");

      const oprDirectionContext =
        $("hsiOprDirectionContext").value;

      if (oprDirectionContext) {
        addPositive(
          `HSI-C OPR Direction Context：${hsiOprDirectionContextLabel(oprDirectionContext)}。`
        );
      }
    }
    evaluateBreakoutCore();
  } else if (
    variant === "fullRepairAsia" ||
    variant === "fullRepairPure"
  ) {
    if (!fullRepairComplete) {
      addCoreFailure(
        "完整POR Full Repair未完成。"
      );
    } else {
      addPositive(
        "完整POR Full Repair成立。"
      );
    }

    if (
      variant ===
        "fullRepairAsia" &&
      !fullRepairAsiaSweep
    ) {
      addCoreFailure(
        "舊版Asia＋Full Repair缺少POR期間Asia H／L Sweep。"
      );
    } else if (
      variant ===
      "fullRepairAsia"
    ) {
      addPositive(
        "POR期間Asia Sweep成立。"
      );
    }

    evaluateBreakoutCore();

    if (!fullRepairEntryOutside) {
      addCoreFailure(
        "Full Repair入場未企穩POR外側；成交前未重新Reclaim POR邊界。"
      );
    } else {
      addPositive(
        "入場位位於POR外側。"
      );
    }

    if (
      fullRepairAcceptedBackInside
    ) {
      addCoreFailure(
        "價格已喺POR內重新形成Acceptance，Full Repair失效。"
      );
    }

    evaluateOpeningDriveValidity();
  } else if (
    variant === "postOpenConfirmation"
  ) {
    if (!postOpenAsiaSweep) {
      addCoreFailure(
        "EU-B缺少POR期間Asia H／L Sweep背景。"
      );
    } else {
      addPositive(
        "POR期間Asia Sweep背景成立。"
      );
    }

    if (!postOpenAfterOpen) {
      addCoreFailure(
        "EU-B必須等正式開市後確認。"
      );
    } else {
      addPositive(
        "正式現貨開市後確認成立。"
      );
    }

    if (!postOpenDriveConfirmed) {
      addCoreFailure(
        "Opening Drive未確認。"
      );
    } else {
      addPositive(
        "開市後Opening Drive方向清楚。"
      );
    }

    if (postOpenPreOpenEntry) {
      addCoreFailure(
        "開市前Asia 2B不做。"
      );
    }

    evaluateBreakoutCore({
      acceptanceRequired: false
    });
    evaluateOpeningDriveValidity();
  } else if (
    variant === "p1NoSweep"
  ) {
    if (!noSweepRejection) {
      addCoreFailure(
        "No-Sweep Setup缺少真正P1 Rejection。"
      );
    } else {
      addPositive(
        "真正P1 Rejection成立。"
      );
    }

    if (!microStructureShift) {
      addCoreFailure(
        "No-Sweep Setup缺少右側微結構轉向確認。"
      );
    } else {
      addPositive(
        "右側微結構轉向確認成立。"
      );
    }
  } else if (
    variant === "trendPullback"
  ) {
    if (!strongTrendContext) {
      addCoreFailure(
        "未確認強趨勢Context。"
      );
    } else {
      addPositive(
        "強趨勢Context成立。"
      );
    }

    if (!trueStructureRetest) {
      addCoreFailure(
        "Pullback未回到真正結構。"
      );
    } else {
      addPositive(
        "Pullback回到真正結構。"
      );
    }

    if (!firstRetest) {
      addCoreFailure(
        "唔係第一次Retest。"
      );
    } else {
      addPositive(
        "第一次Retest成立。"
      );
    }

    if (!microStructureShift) {
      addImperfection(
        "右側控制權確認未完整。"
      );
    } else {
      addPositive(
        "右側控制權確認成立。"
      );
    }
  }

  const fastDeepStrong =
    q2FastRetest &&
    q2DeepRetest &&
    q2StrongRetest;

  if (
    retestQuality === "invalid" ||
    fastDeepStrong
  ) {
    addCoreFailure(
      "Retest Fast＋Deep＋Strong／高效率到足以否定Reclaim，Q1。"
    );
  } else if (
    q2FastRetest ||
    q2DeepRetest ||
    q2StrongRetest
  ) {
    if (q2FastRetest) {
      addImperfection(
        "Q2-F｜Fast Retest：時間短、overlap少、progression efficiency偏高。"
      );
    }
    if (q2DeepRetest) {
      addImperfection(
        "Q2-D｜Deep Retest：約0.786–0.88但仍未重新Acceptance impulse origin。"
      );
    }
    if (q2StrongRetest) {
      addImperfection(
        "Q2-S｜Strong Retest：反向K／displacement偏強，但未建立完整反方向Control。"
      );
    }
  } else if (
    retestQuality === "imperfect"
  ) {
    addImperfection(
      "Q2 Retest瑕疵｜請用F／D／S subtype進一步標記。"
    );
  } else {
    addPositive(
      "Retest明顯弱過Reclaim／Opening Drive。"
    );
  }

  if (
    tradeSpace === "insufficient"
  ) {
    failures.push(
      "第一真實障礙低於最低可接受約1.5R。"
    );
  } else if (
    tradeSpace === "managed"
  ) {
    addPositive(
      "第一障礙約1.5R至2R；記Q2-RR／Reaction管理，唔將Native Q洗白。"
    );
  } else {
    addPositive(
      "第一真實障礙至少2R。"
    );
  }

  if (
    checked("chasedBreakout")
  ) {
    failures.push(
      "實際入場屬Chase。"
    );
  }

  failures.push(
    ...coreFailures
  );

  let quality = "Q1";

  if (
    failures.length === 0
  ) {
    quality =
      imperfections.length === 0
        ? "Q3"
        : "Q2";
  }

  const typeAUpgradeable = false;
  const typeAUpgradeReason =
    "V1.3已取消所有E／Session Q2→Q3升級；Native Q永久保留。";

  return {
    model:
      variant,
    modelLabel:
      triggerModelLabel(),
    selectedSetupType,
    setupTemplate:
      setupTemplateCode(false),
    setupTemplateLabel:
      setupDefinition(false).label,
    variant,
    quality,
    preBonusQuality:
      quality,
    bonusUpgraded: false,
    failures,
    coreFailures,
    imperfections,
    positives,
    bonusCount: 0,
    bonusDirectRepair: false,
    bonusNoDoubleCount: true,
    tradeSpace,
    validSweep,
    validReclaim,
    reclaimQuality,
    microStructureShift,
    validBreakout,
    validAcceptance,
    firstRetest,
    breakoutQuality,
    fullRepairComplete,
    fullRepairAsiaSweep,
    fullRepairEntryOutside,
    fullRepairAcceptedBackInside,
    postOpenAsiaSweep,
    postOpenAfterOpen,
    postOpenDriveConfirmed,
    postOpenPreOpenEntry,
    openingDriveStatus,
    noSweepRejection,
    noSweepMicroBreak:
      microStructureShift,
    strongTrendContext,
    trueStructureRetest,
    retestQuality,
    q2FastRetest,
    q2DeepRetest,
    q2StrongRetest,
    typeAUpgradeable,
    typeAUpgradeReason,
    modelCoreValid:
      coreFailures.length === 0
  };
}

function q2SubtypeInfo(
  trigger = currentBaseTrigger
) {
  if (!trigger || trigger.quality !== "Q2") {
    return {
      codes: [],
      label: trigger?.quality === "Q3"
        ? "Native Q3"
        : "N/A"
    };
  }

  const codes = [];

  /*
   * Q2-R只代表「今次Setup真正使用嗰段Reclaim／Opening Drive質素普通」。
   * 唔再將未使用嘅quality input當Generic Q2 fallback。
   *
   * Sweep-family：
   *   session2B / sweep / p1ReversalSweep → 只睇 reclaimQuality
   *
   * Breakout-family：
   *   breakout / oprContinuation / fullRepair / postOpenConfirmation
   *   → 只睇 breakoutQuality
   *
   * p1NoSweep / trendPullback本身冇獨立R來源。
   */
  const variant =
    trigger.variant ||
    trigger.model ||
    "";

  const reclaimQualityVariants = [
    "session2B",
    "sweep",
    "p1ReversalSweep"
  ];

  const breakoutQualityVariants = [
    "breakout",
    "oprContinuation",
    "fullRepairAsia",
    "fullRepairPure",
    "postOpenConfirmation"
  ];

  const hasReclaimQualityDefect =
    reclaimQualityVariants.includes(
      variant
    ) &&
    trigger.reclaimQuality ===
      "ordinary";

  const hasBreakoutQualityDefect =
    breakoutQualityVariants.includes(
      variant
    ) &&
    trigger.breakoutQuality ===
      "ordinary";

  if (
    hasReclaimQualityDefect ||
    hasBreakoutQualityDefect
  ) {
    codes.push("R");
  }

  if (trigger.q2FastRetest) {
    codes.push("F");
  }

  if (trigger.q2DeepRetest) {
    codes.push("D");
  }

  if (trigger.q2StrongRetest) {
    codes.push("S");
  }

  const obstacleR =
    firstObstacleRValue();

  if (
    obstacleR >= 1.5 &&
    obstacleR < 2
  ) {
    codes.push("RR");
  }

  const unique =
    [...new Set(codes)];

  return {
    codes: unique,
    label: unique.length
      ? `Q2-${unique.join("+")}`
      : "Q2-General"
  };
}

function evaluateAsia2B(baseTrigger) {
  const selectedSetupType =
    setupTypeFromTemplate(false);

  const definition =
    setupDefinition(false);

  const variant =
    setupVariant(false);

  const basePosition =
    $("positionLevel").value;

  let effectivePosition =
    basePosition;
  let effectiveQuality =
    baseTrigger.quality;

  let positionPromoted = false;
  let nativeP2Applied = false;
  let positionTreatment =
    "native";
  let triggerPromoted = false;

  const reasons = [];
  const warnings = [];

  const type =
    $("asia2BType").value;

  const expectedDirection =
    type === "asiaTop"
      ? "Short"
      : "Long";

  const directionMatches =
    direction() ===
    expectedDirection;

  const criteriaCount = [
    checked("asia2BClearLiquidity"),
    checked("asia2BCleanSweep"),
    checked("asia2BReclaimBreak"),
    checked("asia2BWeakRetest"),
    checked("asia2BVolumeSupport"),
    checked("asia2BNoDoubleSweep")
  ].filter(Boolean).length;

  const designatedTypeA =
    isDesignatedTypeASetup(false);

  const highQuality =
    selectedSetupType === "A" &&
    designatedTypeA &&
    directionMatches &&
    criteriaCount >= 5;

  let typeAQualificationReason =
    "N/A";

  if (
    selectedSetupType === "A"
  ) {
    if (!designatedTypeA) {
      typeAQualificationReason =
        "核心Setup身份唔屬指定Type A";
    } else if (!directionMatches) {
      typeAQualificationReason =
        "2B方向同交易方向唔一致";
    } else if (
      criteriaCount < 5
    ) {
      typeAQualificationReason =
        `只符合${criteriaCount}/6項，未達5項`;
    } else {
      typeAQualificationReason =
        `指定Setup＋方向一致＋${criteriaCount}/6`;
    }
  }

  let effectiveSetupType =
    selectedSetupType;

  if (
    selectedSetupType === "A" &&
    !highQuality
  ) {
    effectiveSetupType = "B";

    if (!designatedTypeA) {
      warnings.push(
        "Type A只限HSI OPR 2B、FX Asia／OPR 2B、UK100／GER40正式開市後POR 2B。XAU V1.3起改用專用A/B/C Liquidity Matrix，唔再享有舊Type A升級。"
      );
    } else {
      warnings.push(
        `Type A候選只符合${criteriaCount}/6項或者方向唔一致；未達高質，今次按Type B處理。`
      );
    }
  }

  if (
    effectiveSetupType === "A"
  ) {
    if (
      basePosition === "P3"
    ) {
      effectivePosition = "P2";
      positionPromoted = true;
      positionTreatment =
        "p2Effective";
      reasons.push(
        "高質Type A Session 2B：原始P3獲P2-effective待遇；原始P級仍記P3。"
      );
    } else if (
      basePosition === "P2"
    ) {
      reasons.push(
        "Type A強化執行Edge，但實際P2唔會升P1。"
      );
    } else if (
      basePosition === "P4"
    ) {
      warnings.push(
        "Type A唔可以救P4。"
      );
    }

    if (
      baseTrigger.typeAUpgradeable
    ) {
      effectiveQuality = "Q3";
      triggerPromoted = true;
      reasons.push(
        "Type A：基礎Q2唯一瑕疵係Sweep／Reclaim質素邊緣，獲Q3待遇。"
      );
    } else if (
      baseTrigger.quality === "Q2"
    ) {
      warnings.push(
        `今次Q維持Q2：${baseTrigger.typeAUpgradeReason}`
      );
    }
  }

  if (
    effectiveSetupType === "B"
  ) {
    reasons.push(
      "Type B普通Sweep＋Reclaim：冇自動P／Q升級。"
    );
  }

  if (
    effectiveSetupType === "C"
  ) {
    const setupCoreValid =
      baseTrigger.modelCoreValid &&
      baseTrigger.quality !== "Q1";

    if (
      variant === "fullRepairAsia" ||
      variant === "fullRepairPure"
    ) {
      if (
        setupCoreValid &&
        basePosition === "P3"
      ) {
        effectivePosition = "P2";
        nativeP2Applied = true;
        positionTreatment =
          "nativeP2";
        reasons.push(
          "EU-D完整POR Full Repair已創造Breakout＋Acceptance＋首次Retest結構：即使原先揀P3，最終按原生P2處理。"
        );
      } else if (
        basePosition === "P1" ||
        basePosition === "P2"
      ) {
        reasons.push(
          `EU-D按實際結構維持${basePosition}；Full Repair唔會將P2再升P1。`
        );
      } else if (
        basePosition === "P4"
      ) {
        warnings.push(
          "EU-D唔可以救P4；完整Full Repair亦要有可交易位置。"
        );
      }

      reasons.push(
        "如同日有Asia Sweep，只係EU-D同一Order-flow thesis Tag；唔Double E／Size。"
      );
    } else if (
      variant ===
        "postOpenConfirmation"
    ) {
      if (
        setupCoreValid &&
        basePosition === "P3"
      ) {
        effectivePosition = "P2";
        positionPromoted = true;
        positionTreatment =
          "p2Effective";
        reasons.push(
          "完整EU-B＝Asia Sweep＋正式開市後Opening Drive確認＋第一次弱Retest：普通P3獲P2-effective待遇。"
        );
      } else if (
        basePosition === "P2" ||
        basePosition === "P1"
      ) {
        reasons.push(
          `EU-B實際入場已有真實Breakout／Swap結構：維持原生${basePosition}，唔會再加一級。`
        );
      } else if (
        basePosition === "P4"
      ) {
        warnings.push(
          "EU-B唔可以救P4。"
        );
      }

      reasons.push(
        "EU-B只可揀一種P來源：原生P1／P2，或者原始P3取得P2-effective；Asia Sweep、Opening Drive同0.618唔可以逐項重複計分。"
      );
      reasons.push(
        "EU-B嘅P2-effective只處理位置待遇；Native Q永久保留，亦唔會創造方向權限。"
      );
    } else if (
      variant === "breakout"
    ) {
      reasons.push(
        "Breakout＋Acceptance＋第一次Retest可構成原生P2；實際改變主判狀態時可按P1。"
      );
    } else {
      reasons.push(
        "No-Sweep Setup：只限真正P1、有效Breakout首次Retest或強趨勢回到真實結構。"
      );
    }
  }

  syncPreviousHLSweepToXau(false);

  const previousHLInfo =
    previousHLSweepInfo(false);

  const xauEdge =
    xauLiquidityEdgeInfo(
      false,
      basePosition
    );

  const xauEligibility =
    xauSetupEligibilityInfo(
      false,
      basePosition
    );

  const xauEnhancement =
    xauLiquidityEnhancementInfo(
      baseTrigger,
      basePosition,
      false
    );

  let xauPositionPromoted = false;
  const xauTriggerPromoted = false;

  if (
    marketCode(false) === "XAU" &&
    baseTrigger.quality === "Q2" &&
    xauEnhancement.sourceEligible
  ) {
    warnings.push(
      `V1.3 Native Q維持${baseTrigger.quality}：E／E+唔再將Q2改名Q3。`
    );
  }

  if (
    marketCode(false) === "XAU" &&
    xauEnhancement.promotePosition &&
    basePosition === "P3"
  ) {
    effectivePosition = "P2";
    positionPromoted = true;
    xauPositionPromoted = true;
    positionTreatment =
      "p2Effective";

    reasons.push(
      `${xauEdge.sourceLabel} ${xauEdge.marker}高質Sweep：Raw P3保留原生P3記錄，但交易執行按P2-effective處理。`
    );
  }

  if (
    marketCode(false) === "XAU" &&
    isXauFormalSetupCode(
      setupTemplateCode(false)
    )
  ) {
    reasons.push(
      `XAU Liquidity：${xauEdge.rank}｜${xauEdge.positionLabel}。Raw P仍記${basePosition}；PWH／PWL、PDH／PDL E+或Asia H/L E只可有限度P3→P2-effective，Native Q永久保留。`
    );
    reasons.push(
      xauEligibility.reason
    );
  }

  if (
    previousHLInfo.applicable &&
    !previousHLInfo.eligible
  ) {
    warnings.push(
      previousHLInfo.reason
    );
  }

  const sharedE = sharedEInfo(false, baseTrigger);
  if (basePosition === "P3" && sharedE.eligible) {
    effectivePosition = "P2";
    positionPromoted = true;
    positionTreatment = "p2Effective";
    reasons.push(`共用 E Source：${sharedE.label}，Raw P3 → P2-E；Native Q不變。`);
  }

  const sessionLabel =
    definition.liquidityLabel ||
    "指定Session H／L";

  const setupLabel =
    selectedSetupType === "A"
      ? type === "asiaTop"
        ? `Sweep ${sessionLabel}頂｜偏Short`
        : `Sweep ${sessionLabel}底｜偏Long`
      : definition.label;

  return {
    type:
      selectedSetupType === "A"
        ? type
        : "none",
    label:
      setupLabel,
    selectedSetupType,
    effectiveSetupType,
    effectiveSetupTypeLabel:
      setupClassificationLabel(
        false,
        effectiveSetupType
      ),
    setupTemplate:
      setupTemplateCode(false),
    setupTemplateLabel:
      definition.label,
    setupVariant:
      variant,
    active:
      selectedSetupType === "A",
    designatedTypeA,
    directionMatches,
    criteriaCount:
      selectedSetupType === "A"
        ? criteriaCount
        : 0,
    highQuality,
    typeAQualificationReason,
    structureOverlap: false,
    basePosition,
    effectivePosition,
    baseQuality:
      baseTrigger.quality,
    effectiveQuality,
    positionPromoted,
    nativeP2Applied,
    positionTreatment,
    triggerPromoted,
    xauLiquiditySource:
      xauEdge.source,
    xauLiquiditySourceLabel:
      xauEdge.sourceLabel,
    xauSweepSession:
      xauEdge.session,
    xauSweepSessionLabel:
      xauEdge.sessionLabel,
    xauLiquidityRank:
      xauEdge.rank,
    xauEdgeMarker:
      xauEdge.marker,
    xauPositionEdgeLabel:
      xauEdge.positionLabel,
    xauSetupPriority:
      xauSetupPriorityLabel(
        setupTemplateCode(false)
      ),
    xauSetupEligible:
      xauEligibility.eligible,
    xauSetupEligibilityReason:
      xauEligibility.reason,
    xauHighQualityLiquidity:
      xauEnhancement.highQuality,
    xauQ2MarginalOnly:
      xauEnhancement.q2MarginalOnly,
    xauPositionPromoted,
    xauTriggerPromoted,
    xauEnhancementReason:
      xauEnhancement.reason,
    sharedE,
    previousHLSweepSource:
      previousHLInfo.source || "",
    previousHLSweepSourceLabel:
      previousHLInfo.sourceLabel || "",
    previousHLSweepSession:
      previousHLInfo.session || "",
    previousHLSweepSessionLabel:
      previousHLInfo.sessionLabel || "",
    previousHLSweepEligible:
      previousHLInfo.eligible !== false,
    previousHLSweepReason:
      previousHLInfo.reason || "",
    reasons,
    warnings
  };
}

function matrixCell(
  routeCode,
  position,
  quality,
  options = {}
) {
  if (quality === "Q1" || position === "P4") return 0;

  if (routeCode === "healthyAligned") {
    if (["P1","P2"].includes(position) && quality === "Q3") return 1;
    if (["P1","P2"].includes(position) && quality === "Q2") return 0.5;
    if (position === "P3" && quality === "Q3") return 0.5;
    if (position === "P3" && quality === "Q2") return 0.25;
    return 0;
  }

  if (["weakAligned","transitionConfirmed","neutralMainConfirmed"].includes(routeCode)) {
    if (["P1","P2"].includes(position) && quality === "Q3") return 0.5;
    if (["P1","P2"].includes(position) && quality === "Q2") return 0.25;
    if (position === "P3" && quality === "Q3") return options.p3AlignedTestable === false ? 0 : 0.25;
    return 0;
  }

  if (routeCode === "alignedTransition") {
    if (position === "P1" && quality === "Q3") return 0.5;
    if (position === "P1" && quality === "Q2") return 0.25;
    if (position === "P2" && quality === "Q3") return 0.25;
    if (position === "P3" && quality === "Q3") return options.alignedTransitionP3Testable === false ? 0 : 0.25;
    return 0;
  }

  if (["mixedTransition","neutralTransition","bothTransition"].includes(routeCode)) {
    if (position === "P1" && quality === "Q3") return 0.5;
    if (position === "P1" && quality === "Q2") return 0.25;
    if (position === "P2" && quality === "Q3") return 0.25;
    if (position === "P3" && quality === "Q3") return options.bothTransitionP3Testable ? 0.25 : 0;
    return 0;
  }

  if (routeCode === "alignedReverse") {
    if (options.htfP1ReversalEligible && ["P1","P2"].includes(options.basePosition) && quality === "Q3") return 0.25;
    return 0;
  }

  if (routeCode === "conflictMain") {
    if (["P1","P2"].includes(position) && quality === "Q3") return 0.5;
    if (["P1","P2"].includes(position) && quality === "Q2") return 0.25;
    if (position === "P3" && quality === "Q3") return options.p3ConflictTestable ? 0.25 : 0;
    return 0;
  }

  if (routeCode === "transitionVsConfirmedConflict") {
    if (position === "P1" && quality === "Q3") return 0.5;
    if (position === "P1" && quality === "Q2") return 0.25;
    if (position === "P2" && quality === "Q3") return 0.25;
    return 0;
  }

  if (routeCode === "neutralMainReverse") {
    if (
      position === "P1" &&
      quality === "Q3" &&
      options.transitionLayerP1
    ) return 0.25;
    return 0;
  }

  if (routeCode === "reverseWeakMain") {
    if (
      ["P1","P2"].includes(position) &&
      quality === "Q3" &&
      options.weakCounterRouteEligible
    ) return 0.25;
    return 0;
  }

  if (routeCode === "reverseHealthyMain") {
    if (
      ["P1","P2"].includes(position) &&
      quality === "Q3" &&
      options.healthyCounterReversalEligible
    ) return 0.25;
    return 0;
  }

  if (routeCode === "conflictSecondary") {
    if (position === "P1" && quality === "Q3") return 0.5;
    if (position === "P2" && quality === "Q3" && options.counterP2Eligible) return 0.25;
    return 0;
  }

  if (routeCode === "transitionReverse") {
    if (position === "P1" && quality === "Q3" && options.transitionLayerP1) return 0.25;
    if (position === "P2" && quality === "Q3" && options.transitionP2TailwindEligible) return 0.25;
    return 0;
  }

  return 0;
}

function numericInputValue(id) {
  const raw =
    String($(id).value || "")
      .trim();

  if (raw === "") {
    return null;
  }

  const value = Number(raw);

  return Number.isFinite(value)
    ? value
    : null;
}

function freshSessionSetupInfo(
  setupResult = null,
  baseTrigger = null
) {
  const resolvedSetup =
    setupResult ||
    currentAsia2B;

  const resolvedTrigger =
    baseTrigger ||
    currentBaseTrigger;

  const code =
    resolvedSetup?.setupTemplate ||
    setupTemplateCode(false);

  const definition =
    SETUP_DEFINITIONS[code] || {};

  const effectiveQuality =
    resolvedSetup?.effectiveQuality ||
    "Q1";

  const coreValid =
    resolvedTrigger?.modelCoreValid ===
      true;

  const openingStatus =
    resolvedTrigger?.openingDriveStatus ||
    "fresh";

  const openingFresh =
    openingStatus === "fresh";

  const autoRecognized =
    code ===
      "eu_asia_post_open" ||
    code ===
      "eu_pure_full_repair" ||
    code ===
      "eu_asia_full_repair" ||
    (
      definition.designatedTypeA &&
      resolvedSetup?.highQuality ===
        true
    );

  const manualEquivalent =
    checked(
      "counterP2WeakEquivalentSessionSetup"
    );

  const recognized =
    autoRecognized ||
    manualEquivalent;

  let label =
    "未確認新Session同級Setup";

  if (
    code === "eu_asia_post_open"
  ) {
    label =
      "EU-B｜Asia Sweep＋Post-open Confirmation";
  } else if (
    code === "eu_pure_full_repair" ||
    code === "eu_asia_full_repair"
  ) {
    label =
      "EU-D｜POR Full Repair";
  } else if (
    definition.designatedTypeA &&
    resolvedSetup?.highQuality
  ) {
    label =
      `${definition.label}｜高質Session Setup`;
  } else if (manualEquivalent) {
    label =
      "手動確認｜其他同級高質開市後Setup";
  }

  return {
    code,
    label,
    recognized,
    autoRecognized,
    manualEquivalent,
    coreValid,
    effectiveQuality,
    openingFresh:
      autoRecognized
        ? openingFresh
        : true
  };
}

function healthyCounterReversalInfo(
  positionOverride = null,
  qualityOverride = null
) {
  const route =
    marketRouteInfo();

  const position =
    positionOverride ||
    $("positionLevel").value;

  const quality =
    qualityOverride ||
    currentAsia2B?.effectiveQuality ||
    "Q1";

  if (
    route.code !==
      "reverseHealthyMain" ||
    !["P1","P2"].includes(
      position
    )
  ) {
    return {
      eligible: false,
      reason:
        "逆健康主判P1例外目前不適用。"
    };
  }

  if (quality !== "Q3") {
    return {
      eligible: false,
      reason:
        "逆健康主判只接受Native Q3右側反轉；任何Q2固定0。"
    };
  }

  const activeP1 =
    $("p1BackgroundTailwind")
      .value === "valid";

  if (!activeP1) {
    return {
      eligible: false,
      reason:
        "健康主判正常0：未有Active HTF P1第一反應／P1 Tailwind。"
    };
  }

  return {
    eligible: true,
    reason:
      `逆健康主判窄義例外成立：Active HTF P1第一反應＋${position}＋Native Q3右側反轉，最高0.25 Reaction Probe。`
  };
}

function weakCounterRouteConfirmationInfo(
  positionOverride = null,
  qualityOverride = null,
  baseTriggerOverride = null,
  setupResultOverride = null
) {
  const route =
    marketRouteInfo();

  const mainState =
    $("mainState").value;

  const secondaryState =
    $("secondaryState").value;

  const position =
    positionOverride ||
    $("positionLevel").value;

  const quality =
    qualityOverride ||
    setupResultOverride?.effectiveQuality ||
    currentAsia2B?.effectiveQuality ||
    "Q1";

  const setupResult =
    setupResultOverride ||
    currentAsia2B;

  const baseTrigger =
    baseTriggerOverride ||
    currentBaseTrigger;

  const path =
    $("counterP2WeakPermissionPath")
      .value;

  const applicable =
    ["reverseWeakMain","conflictSecondary"].includes(
      route.code
    ) &&
    isWeak(mainState) &&
    ["P1","P2"].includes(
      position
    );

  if (!applicable) {
    return {
      applicable: false,
      confirmed: false,
      path,
      basis: "none",
      reason:
        "Route A／B Confirmation目前不適用。",
      missing: []
    };
  }

  if (path === "none") {
    return {
      applicable: true,
      confirmed: false,
      path,
      basis: "none",
      reason:
        position === "P1"
          ? "P1目前未揀Route A／B；逆弱主判正常0。"
          : "P2／P2-E目前未揀Route A／B；逆弱主判正常0。",
      missing: []
    };
  }

  if (quality !== "Q3") {
    return {
      applicable: true,
      confirmed: false,
      path,
      basis: path,
      reason:
        "Route A／B都要求Native Q3；目前Q唔合格。",
      missing: [
        "Native Q3"
      ]
    };
  }

  if (
    path === "weakBreakRetest"
  ) {
    return {
      applicable: true,
      confirmed: true,
      path,
      basis:
        "weakBreakRetest",
      reason:
        `Route A成立：弱主判＋主判次結／工作結構有效Break＋Acceptance＋第一次Retest＋${position}＋Native Q3；逆弱主判一律最高0.25。`,
      missing: []
    };
  }

  if (
    path === "weakFreshSession"
  ) {
    const setupInfo =
      freshSessionSetupInfo(
        setupResult,
        baseTrigger
      );

    const obstacleR =
      numericInputValue(
        "counterP2WeakHardObstacleR"
      );

    const checks = [
      {
        ok:
          isHealthy(
            secondaryState
          ),
        text:
          "次判必須係健康反方向Trend"
      },
      {
        ok:
          checked(
            "counterP2WeakIndependentSession"
          ),
        text:
          "今次必須係全新、獨立Session Confirmation"
      },
      {
        ok:
          setupInfo.recognized,
        text:
          "Setup必須係App識別或手動確認嘅獨立Session Setup"
      },
      {
        ok:
          setupInfo.coreValid,
        text:
          "Session Setup核心確認必須完整"
      },
      {
        ok:
          setupInfo.openingFresh,
        text:
          "Session Confirmation必須仍然新鮮"
      }
    ];

    const missing =
      checks
        .filter(
          (item) =>
            !item.ok
        )
        .map(
          (item) =>
            item.text
        );

    if (
      missing.length === 0
    ) {
      return {
        applicable: true,
        confirmed: true,
        path,
        basis:
          "weakFreshSession",
        reason:
          `Route B成立：弱主判＋健康逆向次判＋${setupInfo.label}新Session獨立Confirmation＋${position}＋Native Q3；逆弱主判一律最高0.25。`,
        missing: [],
        setupInfo,
        obstacleR
      };
    }

    return {
      applicable: true,
      confirmed: false,
      path,
      basis:
        "weakFreshSession",
      reason:
        `Route B未完整：${missing.join("；")}。`,
      missing,
      setupInfo,
      obstacleR
    };
  }

  return {
    applicable: true,
    confirmed: false,
    path,
    basis: "none",
    reason:
      "未識別Route A／B選項。",
    missing: []
  };
}

function counterP2EligibilityInfo(
  positionOverride = null,
  qualityOverride = null,
  baseTriggerOverride = null,
  setupResultOverride = null
) {
  const route =
    marketRouteInfo();

  const position =
    positionOverride ||
    $("positionLevel").value;

  const setupResult =
    setupResultOverride ||
    currentAsia2B;

  const quality =
    qualityOverride ||
    setupResult?.effectiveQuality ||
    "Q1";

  if (
    ![
      "reverseWeakMain",
      "reverseHealthyMain",
      "conflictSecondary"
    ].includes(route.code) ||
    position !== "P2"
  ) {
    return {
      eligible: false,
      basis: "none",
      reason:
        "逆主判P2／P2-E特殊資格目前不適用。",
      missing: []
    };
  }

  if (quality !== "Q3") {
    return {
      eligible: false,
      basis: "none",
      reason:
        "逆主判P2／P2-E只接受Native Q3；Q2固定0注。",
      missing: [
        "Native Q3"
      ]
    };
  }

  if (
    route.code ===
      "reverseHealthyMain"
  ) {
    const healthyInfo =
      healthyCounterReversalInfo(
        position,
        quality
      );

    return {
      eligible:
        healthyInfo.eligible,
      basis:
        healthyInfo.eligible
          ? "p1Tailwind"
          : "none",
      reason:
        healthyInfo.reason,
      missing:
        healthyInfo.eligible
          ? []
          : [
              "Active HTF P1第一反應"
            ]
    };
  }

  const routeConfirmation =
    weakCounterRouteConfirmationInfo(
      position,
      quality,
      baseTriggerOverride,
      setupResultOverride
    );

  if (
    routeConfirmation.confirmed
  ) {
    return {
      eligible: true,
      basis:
        routeConfirmation.basis,
      reason:
        `${routeConfirmation.reason} P2／P2-E最高0.25。`,
      missing: [],
      routeConfirmation
    };
  }

  return {
    eligible: false,
    basis:
      routeConfirmation.basis ||
      "none",
    reason:
      routeConfirmation.path !== "none"
        ? `${routeConfirmation.reason} 所以P2／P2-E仍然0注。`
        : "逆弱主判普通情況冇自動權限；只可以行Route A或Route B，並且Native Q3。",
    missing:
      routeConfirmation.missing?.length
        ? routeConfirmation.missing
        : [
            "Route A或Route B未成立"
          ],
    routeConfirmation
  };
}

function transitionP1TailwindEligibilityInfo(
  positionOverride = null,
  qualityOverride = null
) {
  const route =
    marketRouteInfo();

  const mainState =
    $("mainState").value;

  const position =
    positionOverride ||
    $("positionLevel").value;

  const quality =
    qualityOverride ||
    currentAsia2B?.effectiveQuality ||
    "Q1";

  if (
    route.code !==
      "transitionReverse" ||
    !isTransition(mainState) ||
    position !== "P2"
  ) {
    return {
      eligible: false,
      reason:
        "Transition主判P1順風P2資格目前不適用。",
      directionAllowed: false
    };
  }

  if (
    $("p1BackgroundTailwind")
      .value !== "valid"
  ) {
    return {
      eligible: false,
      reason:
        "Transition主判：P1順風必須仍然有效。",
      directionAllowed: false
    };
  }

  if (quality !== "Q3") {
    return {
      eligible: false,
      reason:
        "Transition主判P1順風只接受P2／P2-E＋Q3；Q2固定0。",
      directionAllowed: false
    };
  }

  const mainBias =
    stateBias(mainState);

  const currentTradeBias =
    tradeBias();

  const neutralTransition =
    mainBias === null;

  const followsMainBias =
    mainBias !== null &&
    currentTradeBias === mainBias;

  const directionAllowed =
    neutralTransition ||
    followsMainBias;

  if (!directionAllowed) {
    return {
      eligible: false,
      reason:
        `Transition主判P1順風方向不合格：主判${mainBias === "up" ? "轉換偏升" : "轉換偏跌"}，今次${direction()}逆主判偏向。`,
      directionAllowed: false,
      neutralTransition,
      followsMainBias
    };
  }

  const transitionLabel =
    mainBias === "up"
      ? "轉換偏升"
      : mainBias === "down"
        ? "轉換偏跌"
        : "轉換中性";

  return {
    eligible: true,
    reason:
      neutralTransition
        ? "主判轉換中性：P1順風仍有效＋P2／P2-E＋Q3，可最高0.25。"
        : `主判${transitionLabel}，今次${direction()}順主判偏向：P1順風仍有效＋P2／P2-E＋Q3，可最高0.25。`,
    directionAllowed: true,
    neutralTransition,
    followsMainBias
  };
}

function htfP1ReversalTriggerInfo(
  baseTrigger
) {
  const trigger =
    baseTrigger || {};

  const variant =
    trigger.variant ||
    trigger.model ||
    setupVariant(false);

  const spaceOk =
    trigger.tradeSpace !==
      "insufficient";

  const coreOk =
    trigger.modelCoreValid ===
      true;

  if (
    variant === "session2B" ||
    variant === "sweep" ||
    variant === "p1ReversalSweep"
  ) {
    const eligible =
      coreOk &&
      trigger.validSweep &&
      trigger.validReclaim &&
      trigger.microStructureShift &&
      spaceOk;

    return {
      eligible,
      model:
        "Sweep＋Reclaim",
      reason:
        eligible
          ? "Sweep＋Reclaim＋微結構轉向完整。"
          : "Sweep類Setup未完整：需要有效Sweep、Reclaim、微結構轉向及足夠空間。"
    };
  }

  if (
    variant === "fullRepairAsia"
  ) {
    const eligible =
      coreOk &&
      trigger.fullRepairComplete &&
      trigger.fullRepairAsiaSweep &&
      trigger.validBreakout &&
      trigger.validAcceptance &&
      trigger.firstRetest &&
      trigger.fullRepairEntryOutside &&
      !trigger.fullRepairAcceptedBackInside &&
      trigger.microStructureShift &&
      trigger.openingDriveStatus !==
        "expired" &&
      spaceOk;

    return {
      eligible,
      model:
        "舊版Asia＋Full Repair",
      reason:
        eligible
          ? "EU-B等價確認完整：Asia Sweep＋Full Repair＋Breakout＋Acceptance＋首次Retest＋控制權轉移。"
          : "EU-B未完整：需要Asia Sweep、完整Full Repair、Breakout＋Acceptance、首次Retest、控制權轉移、POR外有效入場及足夠空間。"
    };
  }

  if (
    variant === "fullRepairPure"
  ) {
    const eligible =
      coreOk &&
      trigger.fullRepairComplete &&
      trigger.validBreakout &&
      trigger.validAcceptance &&
      trigger.firstRetest &&
      trigger.fullRepairEntryOutside &&
      !trigger.fullRepairAcceptedBackInside &&
      trigger.microStructureShift &&
      trigger.openingDriveStatus !==
        "expired" &&
      spaceOk;

    return {
      eligible,
      model:
        "EU-D POR Full Repair",
      reason:
        eligible
          ? "EU-D等價確認完整：POR Full Repair＋Breakout＋Acceptance＋首次Retest＋控制權轉移。"
          : "EU-D未完整：需要完整POR Full Repair、Breakout＋Acceptance、首次Retest、控制權轉移、POR外有效入場及足夠空間。"
    };
  }

  if (
    variant ===
      "postOpenConfirmation"
  ) {
    const eligible =
      coreOk &&
      trigger.postOpenAsiaSweep &&
      trigger.postOpenAfterOpen &&
      trigger.postOpenDriveConfirmed &&
      !trigger.postOpenPreOpenEntry &&
      trigger.validBreakout &&
      trigger.firstRetest &&
      trigger.microStructureShift &&
      trigger.openingDriveStatus !==
        "expired" &&
      spaceOk;

    return {
      eligible,
      model:
        "EU-B Post-open Confirmation",
      reason:
        eligible
          ? "EU-B等價確認完整：Asia Sweep＋正式開市後Opening Drive＋結構突破／控制權轉移＋首次Retest。"
          : "EU-B未完整：需要Asia Sweep背景、正式開市後確認、Opening Drive、結構突破／控制權轉移、首次Retest及足夠空間。"
    };
  }

  if (
    variant === "breakout"
  ) {
    const eligible =
      coreOk &&
      trigger.validBreakout &&
      trigger.validAcceptance &&
      trigger.firstRetest &&
      trigger.microStructureShift &&
      spaceOk;

    return {
      eligible,
      model:
        "Breakout＋Acceptance",
      reason:
        eligible
          ? "Breakout等價確認完整：Breakout＋Acceptance＋首次Retest＋控制權轉移。"
          : "Breakout類Setup未完整：需要Breakout＋Acceptance、首次Retest、控制權轉移及足夠空間。"
    };
  }

  return {
    eligible: false,
    model:
      trigger.modelLabel ||
      variant ||
      "未知",
    reason:
      "呢個Setup模型未列入窄義HTF P1反轉例外嘅等價Trigger名單。"
  };
}

function htfP1ReversalExceptionInfo(
  baseTrigger,
  basePosition,
  effectiveQuality
) {
  const route =
    marketRouteInfo();

  if (
    route.code !==
    "alignedReverse"
  ) {
    return {
      eligible: false,
      reason:
        "窄義HTF P1反轉例外目前不適用。"
    };
  }

  if (
    !checked(
      "htfP1ReversalException"
    )
  ) {
    return {
      eligible: false,
      reason:
        "方向權限為0；未確認窄義HTF P1反轉例外。"
    };
  }

  const nativePositionOk =
    basePosition === "P1" ||
    basePosition === "P2";

  const triggerInfo =
    htfP1ReversalTriggerInfo(
      baseTrigger
    );

  const triggerOk =
    effectiveQuality === "Q3" &&
    triggerInfo.eligible;

  const fresh =
    $("p1BackgroundTailwind")
      .value === "valid";

  if (
    nativePositionOk &&
    triggerOk &&
    fresh
  ) {
    return {
      eligible: true,
      triggerModel:
        triggerInfo.model,
      reason:
        `窄義HTF P1反轉例外成立：原生至少P2＋Q3＋${triggerInfo.model}等價右側確認＋P1第一段新鮮反應，最高0.25 Probe。`
    };
  }

  const missing = [];

  if (!nativePositionOk) {
    missing.push(
      "原生位置至少P2"
    );
  }

  if (
    effectiveQuality !== "Q3"
  ) {
    missing.push(
      "Entry-time Q3"
    );
  }

  if (!triggerInfo.eligible) {
    missing.push(
      triggerInfo.reason
    );
  }

  if (!fresh) {
    missing.push(
      "P1第一段反應仍有效"
    );
  }

  return {
    eligible: false,
    triggerModel:
      triggerInfo.model,
    reason:
      `例外未完整：${missing.join("；").replace(/。+$/u, "")}。Type A／EU-B嘅P3→P2-effective仍然唔會單獨創造方向權限。`
  };
}

function currentMatrixOptions(
  effectivePosition = null,
  baseTrigger = null,
  effectiveQuality = "Q1",
  basePosition = null,
  setupResult = null
) {
  const originalPosition =
    basePosition ||
    $("positionLevel").value;

  const trigger =
    baseTrigger ||
    currentBaseTrigger || {
      validSweep: false,
      validReclaim: false,
      microStructureShift: false,
      tradeSpace: "insufficient"
    };

  return {
    transitionLayerP1:
      checked(
        "transitionLayerP1"
      ),
    transitionP2TailwindEligible:
      transitionP1TailwindEligibilityInfo(
        effectivePosition,
        effectiveQuality
      ).eligible,
    p3ConflictTestable:
      checked(
        "p3ConflictTestable"
      ),
    counterP2Eligible:
      counterP2EligibilityInfo(
        effectivePosition,
        effectiveQuality,
        trigger,
        setupResult
      ).eligible,
    weakCounterRouteEligible:
      weakCounterRouteConfirmationInfo(
        effectivePosition,
        effectiveQuality,
        trigger,
        setupResult
      ).confirmed,
    healthyCounterReversalEligible:
      healthyCounterReversalInfo(
        effectivePosition,
        effectiveQuality
      ).eligible,
    bothTransitionMajorP1:
      checked(
        "bothTransitionMajorP1"
      ),
    bothTransitionP3Testable:
      checked(
        "bothTransitionP3Testable"
      ),
    htfP1ReversalEligible:
      htfP1ReversalExceptionInfo(
        trigger,
        originalPosition,
        effectiveQuality
      ).eligible,
    basePosition:
      originalPosition
  };
}

function applySetupMatrixConstraint(
  size,
  setupResult
) {
  if (
    setupResult.xauSetupEligible ===
      false &&
    isXauFormalSetupCode(
      setupResult.setupTemplate
    )
  ) {
    return {
      size: 0,
      reason:
        setupResult.xauSetupEligibilityReason ||
        "XAU專用Setup條件未完整。"
    };
  }

  const variant =
    setupResult.setupVariant;

  const basePosition =
    setupResult.basePosition;

  const effectivePosition =
    setupResult.effectivePosition;

  const quality =
    setupResult.effectiveQuality;

  if (
    setupResult.effectiveSetupType !==
      "C" &&
    variant !==
      "p1ReversalSweep"
  ) {
    return {
      size,
      reason:
        "Setup類型冇額外位置限制。"
    };
  }

  if (
    variant === "oprContinuation"
  ) {
    return {
      size,
      reason:
        "HSI-C OPR Continuation & Retest屬Research／Provisional；Raw P同Execution P維持原Matrix，暫時冇E。"
    };
  }

  if (
    variant === "breakout" ||
    variant === "fullRepairAsia" ||
    variant === "fullRepairPure"
  ) {
    if (
      effectivePosition === "P1" ||
      effectivePosition === "P2"
    ) {
      return {
        size,
        reason:
          setupResult.nativeP2Applied
            ? "EU-D完整POR Full Repair按原生P2處理。"
            : "Breakout／Full Repair原生P1／P2位置有效。"
      };
    }

    return {
      size: 0,
      reason:
        "Breakout／Full Repair未形成可交易原生P2／P1，或者實際位置係P4。"
    };
  }

  if (
    variant ===
      "postOpenConfirmation"
  ) {
    const allowed =
      effectivePosition === "P1" ||
      effectivePosition === "P2";

    return {
      size:
        allowed
          ? size
          : 0,
      reason:
        allowed
          ? setupResult.positionPromoted
            ? "完整EU-B：原始P3獲P2-effective待遇。"
            : `EU-B按實際結構維持原生${effectivePosition}。`
          : "EU-B必須係原生P1／P2，或者由完整Setup將P3取得P2-effective；P4不做。"
    };
  }

  if (
    variant ===
    "p1NoSweep"
  ) {
    return {
      size:
        basePosition === "P1"
          ? size
          : 0,
      reason:
        basePosition === "P1"
          ? "No-Sweep P1反轉位置有效。"
          : "普通P2／P3 No-Sweep一般不做；只限真正P1。"
    };
  }

  if (
    variant ===
    "trendPullback"
  ) {
    const allowed =
      basePosition === "P1" ||
      (
        basePosition === "P2" &&
        quality === "Q3"
      );

    return {
      size:
        allowed
          ? size
          : 0,
      reason:
        allowed
          ? "強趨勢Pullback回到真正P1／P2結構，位置有效。"
          : "強趨勢No-Sweep Pullback只限真實P1，或原生P2＋Q3。"
    };
  }

  if (
    variant ===
    "p1ReversalSweep"
  ) {
    return {
      size:
        basePosition === "P1"
          ? size
          : 0,
      reason:
        basePosition === "P1"
          ? "P1反轉Setup位置有效。"
          : "FX-D P1反轉Setup只限Daily／4H真正P1位置。"
    };
  }

  return {
    size,
    reason:
      "Setup位置限制維持原Matrix。"
  };
}

function evaluateMatrix(
  effectivePosition,
  effectiveQuality,
  effectiveSetupType = "B",
  setupResult = null,
  baseTrigger = null
) {
  const route =
    marketRouteInfo();

  const resolvedSetup =
    setupResult || {
      effectiveSetupType,
      setupVariant:
        setupVariant(false),
      basePosition:
        $("positionLevel").value,
      effectivePosition,
      effectiveQuality
    };

  const options =
    currentMatrixOptions(
      effectivePosition,
      baseTrigger,
      effectiveQuality,
      resolvedSetup.basePosition,
      resolvedSetup
    );

  let marketCap =
    route.cap;

  if (
    route.code ===
      "alignedReverse" &&
    options
      .htfP1ReversalEligible
  ) {
    marketCap = 0.25;
  }

  const rawCell =
    matrixCell(
      route.code,
      effectivePosition,
      effectiveQuality,
      options
    );

  const constrained =
    applySetupMatrixConstraint(
      rawCell,
      resolvedSetup
    );

  let p2EQualitySize =
    constrained.size;
  let p2EQualityReason = "";

  const p2EFromRawP3 =
    resolvedSetup.basePosition === "P3" &&
    effectivePosition === "P2" &&
    resolvedSetup.positionTreatment === "p2Effective";

  if (
    p2EFromRawP3 &&
    effectiveQuality === "Q2"
  ) {
    p2EQualitySize =
      Math.min(
        p2EQualitySize,
        0.25
      );
    p2EQualityReason =
      "V1.3：P2-E＋Native Q2全局最高0.25；如果該市場情境本身Q2＝0，仍然維持0。Q2 subtype只作研究記錄，唔再額外改Size。";
  }

  const size =
    Math.min(
      p2EQualitySize,
      marketCap
    );

  const combination =
    `${effectivePosition}＋${effectiveQuality}`;

  let cellExplanation =
    `${route.label}；${combination}按市場關係Matrix為${SIZE_LABELS[rawCell]}。${constrained.reason}${p2EQualityReason ? ` ${p2EQualityReason}` : ""}`;

  if (
    route.code ===
    "alignedReverse"
  ) {
    cellExplanation =
      options
        .htfP1ReversalEligible
        ? `正常方向權限為0，但窄義HTF P1反轉例外完整成立；${combination}最高0.25 Probe。`
        : `反共同方向正常0注。${htfP1ReversalExceptionInfo(
            baseTrigger ||
            currentBaseTrigger,
            resolvedSetup.basePosition,
            effectiveQuality
          ).reason}`;
  } else if (
    route.code === "reverseWeakMain"
  ) {
    const confirmation =
      weakCounterRouteConfirmationInfo(
        effectivePosition,
        effectiveQuality,
        baseTrigger || currentBaseTrigger,
        resolvedSetup
      );
    cellExplanation =
      confirmation.confirmed
        ? `逆弱主判Route ${confirmation.basis === "weakBreakRetest" ? "A" : "B"}成立；${combination}最高0.25。${confirmation.reason}`
        : `逆弱主判普通0；Route A／B未完整。${confirmation.reason}`;
  } else if (
    route.code === "reverseHealthyMain"
  ) {
    const healthyInfo =
      healthyCounterReversalInfo(
        effectivePosition,
        effectiveQuality
      );
    cellExplanation =
      healthyInfo.eligible
        ? `${healthyInfo.reason}`
        : `逆健康主判正常0。${healthyInfo.reason}`;
  } else if (
    route.code === "neutralMainConfirmed"
  ) {
    cellExplanation =
      `主判中性Transition＋次判Confirmed，順次判：P1/P2 Q3＝0.5、Q2＝0.25；P3 Q3＝0.25。Trade Objective固定Reaction。${p2EQualityReason ? ` ${p2EQualityReason}` : ""}`;
  } else if (
    route.code === "neutralMainReverse"
  ) {
    cellExplanation =
      options.transitionLayerP1 && effectivePosition === "P1" && effectiveQuality === "Q3"
        ? `主判中性但逆次判Confirmed：清晰HTF P1／Range Boundary＋Native Q3成立，最高0.25 Reaction Probe。`
        : `主判中性唔代表反方向有權；逆次判Confirmed正常0，只限清晰P1／Range Boundary＋Native Q3。`;
  } else if (
    route.code === "transitionVsConfirmedConflict"
  ) {
    cellExplanation =
      `主判Directional Transition × 次判Confirmed反方向：兩個交易方向Size暫時相同；P1 Q3＝0.5、P1 Q2＝0.25、P2 Q3＝0.25、P2 Q2＝0、P3＝0。Control Alignment用嚟分Confirmed／Opposing研究Tag。`;
  } else if (
    route.code ===
      "conflictSecondary" &&
    effectivePosition === "P2"
  ) {
    cellExplanation =
      counterP2EligibilityInfo(
        effectivePosition,
        effectiveQuality,
        baseTrigger ||
          currentBaseTrigger,
        resolvedSetup
      ).eligible
        ? `逆主判P2特殊資格成立；${combination}最高0.25。${counterP2EligibilityInfo(
            effectivePosition,
            effectiveQuality,
            baseTrigger ||
              currentBaseTrigger,
            resolvedSetup
          ).reason}`
        : `逆主判P2正常0。${counterP2EligibilityInfo(
            effectivePosition,
            effectiveQuality,
            baseTrigger ||
              currentBaseTrigger,
            resolvedSetup
          ).reason}`;
  } else if (
    route.code ===
      "conflictSecondary" &&
    effectivePosition === "P1"
  ) {
    cellExplanation =
      effectiveQuality === "Q3"
        ? `${route.label}：P1＋Native Q3最高0.5。`
        : `${route.label}：Counter-main Q2 V1.3暫時0注，只列Research Candidate。`;
  } else if (
    route.code ===
      "transitionReverse"
  ) {
    const transitionTailwindInfo =
      transitionP1TailwindEligibilityInfo(
        effectivePosition,
        effectiveQuality
      );

    if (
      effectivePosition === "P2" &&
      transitionTailwindInfo.eligible
    ) {
      cellExplanation =
        `${transitionTailwindInfo.reason} Transition P1順風只提供0.25資格，唔會升P或升Q。`;
    } else if (
      effectivePosition === "P2"
    ) {
      cellExplanation =
        `主判Transition而逆次判已確認方向：P2／P2-E只限符合Transition P1順風方向規則先可0.25。${transitionTailwindInfo.reason}`;
    } else {
      cellExplanation =
        `主判Transition而逆次判已確認方向：真正Transition P1＋Q3可0.25；P2／P2-E只限符合P1順風方向規則。`;
    }
  } else if (
    route.code === "alignedTransition"
  ) {
    cellExplanation =
      `Aligned Transition正式Matrix：P1 Q3＝0.5、P1 Q2＝0.25、P2 Native Q3＝0.25；P2 Q3→0.5只做Shadow Test。${p2EQualityReason ? ` ${p2EQualityReason}` : ""}`;
  } else if (["mixedTransition","neutralTransition","bothTransition"].includes(route.code)) {
    cellExplanation =
      `${route.label}：邊界P1 Q3＝0.5、P1 Q2＝0.25、P2 Q3＝0.25、P2 Q2＝0；P3 Q3只限明確可測試邊界。`;
  }

  return {
    relation:
      route.relation,
    routeCode:
      route.code,
    routeLabel:
      route.label,
    routeReason:
      route.reason,
    marketCap,
    mode:
      route.code,
    route:
      route.label,
    rawCellSize:
      rawCell,
    p2EQualitySize,
    p2EQualityReason,
    size,
    setupConstraintReason:
      constrained.reason,
    cellExplanation
  };
}

function downgradeOneLevel(size) {
  if (size >= 1) return 0.5;
  if (size >= 0.5) return 0.25;
  if (size >= 0.25) return 0;
  return 0;
}

function insideObstacleCap(position, quality) {
  if (position === "P1" && quality === "Q3") return 0.5;
  if (position === "P2" && quality === "Q3") return 0.25;
  return 0;
}

function applyRangePosition(size) {
  if (
    $("secondaryState").value !==
    "轉換中－中性"
  ) {
    return {
      state: "notApplicable",
      adjustedSize: size,
      explanation:
        "次判唔係轉換中性，Range 25%修正不適用。"
    };
  }

  const state =
    $("secondaryRangePosition")
      .value;

  if (
    state === "favorable"
  ) {
    return {
      state,
      adjustedSize: size,
      explanation:
        "次判轉換中性：Entry位於相應25%（Long底25%／Short頂25%），維持原注碼。"
    };
  }

  if (
    state === "middle"
  ) {
    return {
      state,
      adjustedSize: 0,
      explanation:
        "次判轉換中性：Entry位於真正Range正中／冇邊界Edge，直接0注。"
    };
  }

  const adjusted =
    downgradeOneLevel(size);

  return {
    state,
    adjustedSize: adjusted,
    explanation:
      `次判轉換中性：Entry唔喺相應頂／底25%，注碼降一級：${SIZE_LABELS[size]} → ${SIZE_LABELS[adjusted]}。`
  };
}

function hasFirstObstacle() {
  return checked(
    "hasFirstObstacle"
  );
}

function firstObstacleRValue() {
  if (!hasFirstObstacle()) {
    return null;
  }

  const raw =
    $("firstObstacleR").value
      .trim();

  if (raw === "") {
    return null;
  }

  const value =
    Number(raw);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function obstacleBandFromR(
  firstObstacleR,
  kind = "soft",
  obstaclePresent = true
) {
  if (!obstaclePresent) return "none";
  if (!Number.isFinite(firstObstacleR)) return "pending";
  if (firstObstacleR < 1.5) return "veto";
  if (kind === "hard") return "inside";
  if (firstObstacleR < 2) return "rfManaged";
  return "standard";
}

function obstacleBandLabel(state) {
  const labels = {
    none: "冇第一真實障礙｜正常按Matrix",
    pending: "已Tick障礙｜請填距離",
    standard: "≥2R｜Clean Space｜標準",
    rfManaged: "1.5R–<2R｜Reaction／RF-Partial",
    veto: "<1.5R｜RR Veto",
    inside: "身處重大HTF Obstacle｜降一級",
    partial: "舊版｜1–1.5R｜V1.3已改RR Veto"
  };
  return labels[state] || state;
}

function obstacleManagementLabel(state) {
  const labels = {
    none: "冇障礙限制｜按Matrix／其他條件決定Objective",
    pending: "請先填第一真實障礙距離R",
    standard: "Expansion可考慮固定2R／Runner",
    rfManaged: "Reaction：第一結構／1–1.5R優先RF或Partial",
    veto: "不開新倉",
    inside: "重大HTF obstacle內：Size再降一級",
    partial: "舊版模式｜V1.3唔再使用"
  };
  return labels[state] || state;
}

function applyObstacle(
  matrixSize,
  position,
  quality
) {
  const obstaclePresent =
    hasFirstObstacle();

  const firstObstacleR =
    firstObstacleRValue();

  const kind =
    $("obstacleKind").value;

  const managementChoice =
    $("obstacleManagementChoice")
      .value;

  const state =
    obstacleBandFromR(
      firstObstacleR,
      kind,
      obstaclePresent
    );

  const hardTreatment =
    "downgrade";

  const result = (
    adjustedSize,
    explanation,
    management,
    {
      eligible = true,
      hardVeto = false,
      reason = ""
    } = {}
  ) => ({
    state,
    obstaclePresent,
    firstObstacleR,
    kind,
    hardTreatment,
    managementChoice,
    adjustedSize,
    explanation,
    management,
    managementMode: state,
    eligible,
    hardVeto,
    reason
  });

  if (state === "none") {
    return result(
      matrixSize,
      "冇Tick第一真實障礙：Obstacle層唔降注／唔Veto，維持Matrix／Range修正後Size。",
      "冇特定Obstacle管理；按原本Trade Plan處理。"
    );
  }

  if (state === "pending") {
    return result(
      0,
      "已Tick有第一真實障礙，但未填有效距離R。",
      "先量度Entry至第一真實障礙嘅R距離。",
      {
        eligible: false,
        hardVeto: true,
        reason:
          "已確認有第一真實障礙，但未填距離R。"
      }
    );
  }

  if (state === "veto") {
    return result(
      0,
      `第一真實障礙只有${firstObstacleR.toFixed(2)}R，低於V1.3最低可接受約1.5R。`,
      "Hard Veto：RR不足，不開新倉。",
      {
        eligible: false,
        hardVeto: true,
        reason:
          "第一真實障礙低於約1.5R。"
      }
    );
  }

  if (state === "inside") {
    const adjusted =
      downgradeOneLevel(
        matrixSize
      );

    const management =
      managementChoice === "partial"
        ? "重大HTF障礙：Size降一級；障礙前Partial＋餘倉RF。"
        : managementChoice === "rf"
          ? "重大HTF障礙：Size降一級；到障礙推RF。"
          : "重大HTF障礙：Size降一級；Objective預設Reaction。";

    return result(
      adjusted,
      `有重大HTF／Hard obstacle阻住：V1.3 Size由${SIZE_LABELS[matrixSize]}降一級至${SIZE_LABELS[adjusted]}。`,
      management
    );
  }

  if (state === "rfManaged") {
    const management =
      managementChoice === "partial"
        ? "障礙前Partial＋餘倉RF；Objective預設Reaction。"
        : managementChoice === "rf"
          ? "到第一障礙推RF，再視乎Price Action延伸。"
          : "1.5R–<2R：建議到第一結構／障礙RF或Partial；Objective預設Reaction。";

    return result(
      matrixSize,
      `第一真實障礙${firstObstacleR.toFixed(2)}R：屬1.5R–<2R可交易區，Size唔因距離自動下降。`,
      management
    );
  }

  return result(
    matrixSize,
    `第一真實障礙${firstObstacleR.toFixed(2)}R，而且屬普通／Soft obstacle；≥2R維持${SIZE_LABELS[matrixSize]}。`,
    managementChoice === "partial"
      ? "空間≥2R但計劃Partial＋RF；Size不變。"
      : managementChoice === "rf"
        ? "空間≥2R但計劃到障礙推RF；Size不變。"
        : "標準模式；方向／P／Native Q合格時可列Expansion。"
  );
}

function evaluateHardVeto(
  effectivePosition,
  baseTrigger,
  setupResult,
  obstacle
) {
  const vetoes = [];

  if (
    effectivePosition === "P4" ||
    checked("chasedBreakout")
  ) {
    vetoes.push(
      "P4／Range中間／追價。"
    );
  }

  if (
    !baseTrigger.modelCoreValid
  ) {
    vetoes.push(
      "Setup核心確認失敗：冇有效Sweep／Reclaim，或者冇有效Breakout＋Acceptance Setup。"
    );
  }

  if (
    baseTrigger.retestQuality ===
    "invalid"
  ) {
    vetoes.push(
      "Retest快＋深＋強，已否定原本Reclaim／Opening Drive。"
    );
  }

  if (
    obstacle?.hardVeto
  ) {
    vetoes.push(
      obstacle.reason ||
      "第一真實障礙管理條件未符合。"
    );
  }

  if (
    checked(
      "violatesTradingTime"
    ) ||
    checked(
      "riskLimitExceeded"
    )
  ) {
    vetoes.push(
      "違反交易時間或總風險限制。"
    );
  }


  return vetoes;
}

function enhancementEdgeInfo(
  setupResult = currentAsia2B
) {
  if (!setupResult) return { marker:"", label:"None" };
  if (setupResult.sharedE?.eligible) return {marker:"E",label:`E｜${setupResult.sharedE.label}`};

  if (marketCode(false) === "XAU") {
    return {
      marker: setupResult.xauEdgeMarker || "",
      label: setupResult.xauEdgeMarker
        ? `${setupResult.xauEdgeMarker}｜${setupResult.xauLiquiditySourceLabel}`
        : "None"
    };
  }

  if (
    setupResult.positionTreatment === "p2Effective" &&
    (
      setupResult.effectiveSetupType === "A" ||
      setupResult.setupVariant === "postOpenConfirmation"
    )
  ) {
    return { marker:"E", label:"E｜Session／Instrument-specific Edge" };
  }

  return { marker:"", label:"None" };
}

function objectiveAtEntryCode({
  finalSize,
  routeCode,
  nativeQ,
  position,
  firstObstacleR = null,
  obstacleState = "none",
  controlCode = "",
  transitionTypeCode = "",
  setupVariant = ""
}) {
  if (
    !Number.isFinite(Number(finalSize)) ||
    Number(finalSize) <= 0
  ) {
    return "Skip";
  }

  const nativeQ3 =
    nativeQ === "Q3";

  const highLocation =
    ["P1", "P2"].includes(
      position
    );

  const obstaclePresent =
    firstObstacleR !== null &&
    firstObstacleR !== undefined &&
    firstObstacleR !== "" &&
    Number.isFinite(
      Number(firstObstacleR)
    );

  const cleanSpace =
    (
      !obstaclePresent ||
      Number(firstObstacleR) >= 2
    ) &&
    ["none", "standard"].includes(
      obstacleState
    );

  const controlAllows =
    controlCode !== "Opposing";

  const transitionAllows =
    !["Mixed", "Neutral"].includes(
      transitionTypeCode
    );

  const matureExpansion =
    nativeQ3 &&
    highLocation &&
    cleanSpace &&
    controlAllows &&
    transitionAllows &&
    routeCode === "healthyAligned";

  if (matureExpansion) {
    return "Expansion";
  }

  const clearReactionRoute =
    [
      "conflictMain",
      "conflictSecondary",
      "reverseWeakMain",
      "reverseHealthyMain",
      "neutralMainConfirmed",
      "neutralMainReverse",
      "transitionVsConfirmedConflict",
      "alignedReverse",
      "transitionReverse",
      "mixedTransition",
      "neutralTransition",
      "bothTransition"
    ].includes(routeCode);

  const clearReaction =
    !nativeQ3 ||
    !highLocation ||
    !cleanSpace ||
    !controlAllows ||
    !transitionAllows ||
    clearReactionRoute;

  if (clearReaction) {
    return "Reaction";
  }

  // 方向仍有permission、Q3、位置及Space合格，
  // 但control成熟度未足以正式叫Expansion。
  return "Not sure";
}

function reactionFirstShadowClass({
  tradeObjective,
  routeCode,
  nativeQ,
  position,
  firstObstacleR = null,
  obstacleState = "none",
  controlCode = "",
  transitionTypeCode = ""
}) {
  if (
    tradeObjective !== "Not sure"
  ) {
    return "N/A";
  }

  const obstaclePresent =
    firstObstacleR !== null &&
    firstObstacleR !== undefined &&
    firstObstacleR !== "" &&
    Number.isFinite(
      Number(firstObstacleR)
    );

  const cleanSpace =
    (
      !obstaclePresent ||
      Number(firstObstacleR) >= 2
    ) &&
    ["none", "standard"].includes(
      obstacleState
    );

  const eligible =
    nativeQ === "Q3" &&
    ["P1", "P2"].includes(
      position
    ) &&
    cleanSpace &&
    controlCode !== "Opposing" &&
    !["Mixed", "Neutral"].includes(
      transitionTypeCode
    ) &&
    [
      "weakAligned",
      "alignedTransition",
      "transitionConfirmed"
    ].includes(routeCode);

  return eligible
    ? "Reaction-first / Expansion-eligible"
    : "N/A";
}

function tradeObjectiveInfo({
  finalSize,
  matrixRouteCode,
  setupResult,
  baseTrigger,
  firstObstacleR,
  obstacleState,
  control,
  transitionType
}) {
  const code =
    objectiveAtEntryCode({
      finalSize,
      routeCode:
        matrixRouteCode,
      nativeQ:
        baseTrigger.quality,
      position:
        setupResult.effectivePosition,
      firstObstacleR,
      obstacleState,
      controlCode:
        control.code,
      transitionTypeCode:
        transitionType.code,
      setupVariant:
        setupResult.setupVariant
    });

  const shadowClass =
    reactionFirstShadowClass({
      tradeObjective:
        code,
      routeCode:
        matrixRouteCode,
      nativeQ:
        baseTrigger.quality,
      position:
        setupResult.effectivePosition,
      firstObstacleR,
      obstacleState,
      controlCode:
        control.code,
      transitionTypeCode:
        transitionType.code
    });

  if (code === "Skip") {
    return {
      code,
      label: code,
      shadowClass,
      reason:
        "Final Size＝0／Hard Veto，冇正式Trade Objective。"
    };
  }

  if (code === "Expansion") {
    return {
      code,
      label: code,
      shadowClass,
      reason:
        "方向Alignment成熟＋Native Q3＋P1/P2/P2-E＋Clean ≥2R；有條件期待完整directional expansion。"
    };
  }

  if (code === "Not sure") {
    return {
      code,
      label: code,
      shadowClass,
      reason:
        shadowClass !== "N/A"
          ? "方向、位置、Native Q3同Space合格，但Entry一刻control成熟度未足以正式歸類Expansion；Shadow標記Reaction-first / Expansion-eligible，事後研究有冇upgrade。"
          : "Entry一刻未能清晰歸類Expansion或Reaction；保持Not sure，唔用事後資料反改當時Decision。"
    };
  }

  const reactionReasons = [];
  const obstaclePresent =
    firstObstacleR !== null &&
    firstObstacleR !== undefined &&
    firstObstacleR !== "" &&
    Number.isFinite(
      Number(firstObstacleR)
    );

  if (
    baseTrigger.quality ===
    "Q2"
  ) {
    reactionReasons.push(
      "Native Q2"
    );
  }

  if (
    [
      "conflictMain",
      "conflictSecondary",
      "reverseWeakMain",
      "reverseHealthyMain",
      "neutralMainConfirmed",
      "neutralMainReverse",
      "transitionVsConfirmedConflict",
      "alignedReverse",
      "transitionReverse",
      "mixedTransition",
      "neutralTransition",
      "bothTransition"
    ].includes(
      matrixRouteCode
    )
  ) {
    reactionReasons.push(
      "Direction Conflict／Counter-main／Transition Conflict"
    );
  }

  if (
    control.code ===
    "Opposing"
  ) {
    reactionReasons.push(
      "Immediate Control Opposing"
    );
  }

  if (
    obstaclePresent &&
    Number(firstObstacleR) < 2
  ) {
    reactionReasons.push(
      "第一障礙<2R"
    );
  }

  if (
    obstacleState ===
    "inside"
  ) {
    reactionReasons.push(
      "重大HTF obstacle"
    );
  }

  if (
    ["Mixed", "Neutral"].includes(
      transitionType.code
    )
  ) {
    reactionReasons.push(
      `${transitionType.code} Transition`
    );
  }

  return {
    code,
    label: code,
    shadowClass,
    reason:
      `主要edge係第一段reaction，而唔係成熟directional expansion。${reactionReasons.length ? ` 原因：${reactionReasons.join("、")}。` : ""}`
  };
}


function strongBarAtrRatioValues() {
  // V1.30.11：停止人手輸入ATR Ratio。
  // 保留helper名只為舊版code／backup兼容。
  return {
    reclaimStrongBarAtrRatio: null,
    retestStrongBarAtrRatio: null
  };
}

function recordRetestStrongBarAtrRatio(
  record
) {
  if (
    Number.isFinite(
      record?.retestStrongBarAtrRatio
    )
  ) {
    return record.retestStrongBarAtrRatio;
  }

  if (
    Number.isFinite(
      record?.strongRetestShadowMetric
    )
  ) {
    return record.strongRetestShadowMetric;
  }

  return null;
}


function reclaimInternalStructureLabel(
  code
) {
  if (code === "none") {
    return "None";
  }

  if (code === "structured") {
    return "Structured";
  }

  return "";
}

function normalizeReclaimInternalStructure(
  value
) {
  const raw =
    String(value || "")
      .trim()
      .toLowerCase();

  if (raw === "none") {
    return "none";
  }

  if (
    raw === "structured" ||
    raw === "yes / structured" ||
    raw === "yes"
  ) {
    return "structured";
  }

  return "";
}

function retestVsReclaimStructureLabel(
  code
) {
  if (code === "na") {
    return "N/A";
  }

  if (code === "hold") {
    return "Hold";
  }

  if (code === "sweepReclaim") {
    return "Sweep-Reclaim";
  }

  if (code === "breakAccept") {
    return "Break-Accept";
  }

  return "";
}

function normalizeRetestVsReclaimStructure(
  value
) {
  const raw =
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  if (
    raw === "na" ||
    raw === "n/a"
  ) {
    return "na";
  }

  if (raw === "hold") {
    return "hold";
  }

  if (
    raw === "sweepreclaim" ||
    raw === "sweep reclaim" ||
    raw === "sweep-reclaim" ||
    raw === "sweep / reclaim" ||
    raw === "sweep/reclaim"
  ) {
    return "sweepReclaim";
  }

  if (
    raw === "breakaccept" ||
    raw === "break accept" ||
    raw === "break-accept" ||
    raw === "break + acceptance" ||
    raw === "break+acceptance"
  ) {
    return "breakAccept";
  }

  return "";
}

function resolvedRetestVsReclaimStructure(
  reclaimCode,
  retestVsCode
) {
  const reclaim =
    normalizeReclaimInternalStructure(
      reclaimCode
    );

  const retestVs =
    normalizeRetestVsReclaimStructure(
      retestVsCode
    );

  if (reclaim === "none") {
    return "na";
  }

  if (reclaim !== "structured") {
    return "";
  }

  return [
    "hold",
    "sweepReclaim",
    "breakAccept"
  ].includes(retestVs)
    ? retestVs
    : "";
}


function retestInternalStructureLabel(
  code
) {
  if (code === "none") {
    return "None / One-leg";
  }

  if (code === "structured") {
    return "Yes / Structured";
  }

  return "";
}

function normalizeRetestInternalStructure(
  value
) {
  const raw =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    raw === "none" ||
    raw === "none / one-leg" ||
    raw === "one-leg"
  ) {
    return "none";
  }

  if (
    raw === "structured" ||
    raw === "yes / structured" ||
    raw === "yes"
  ) {
    return "structured";
  }

  return "";
}


function retestAcceptanceLabel(
  code
) {
  if (code === "hold") {
    return "Hold";
  }

  if (code === "closeThrough") {
    return "Close Through";
  }

  return "";
}

function normalizeRetestAcceptance(
  value
) {
  const raw =
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  if (
    raw === "hold"
  ) {
    return "hold";
  }

  if (
    raw === "closethrough" ||
    raw === "close through" ||
    raw === "close-through"
  ) {
    return "closeThrough";
  }

  return "";
}


function capReasonInfo({
  finalSize,
  routeCode,
  rawPosition,
  executionPosition,
  positionTreatment = "",
  nativeQ = "",
  q2SubtypeLabel = "",
  obstacleState = "none",
  matrixSize = 0,
  rangeSize = 0,
  controlCode = ""
}) {
  if (
    Number(finalSize) !==
    0.25
  ) {
    return {
      primary: "N/A",
      flags: []
    };
  }

  const flags = [];

  const p2Effective =
    rawPosition === "P3" &&
    executionPosition === "P2" &&
    positionTreatment ===
      "p2Effective";

  if (p2Effective) {
    flags.push(
      "Raw P3 → P2-E"
    );
  }

  if (nativeQ === "Q2") {
    flags.push(
      q2SubtypeLabel
        ? `Native ${q2SubtypeLabel}`
        : "Native Q2"
    );
  }

  if (
    obstacleState ===
    "rfManaged"
  ) {
    flags.push(
      "Obstacle / RR 1.5–<2R"
    );
  }

  if (
    obstacleState ===
    "inside"
  ) {
    flags.push(
      "重大HTF Obstacle"
    );
  }

  if (
    Number(rangeSize) <
    Number(matrixSize)
  ) {
    flags.push(
      "Range 25% downgrade"
    );
  }

  if (
    controlCode ===
    "Opposing"
  ) {
    flags.push(
      "Opposing Control"
    );
  }

  if (
    [
      "conflictMain",
      "conflictSecondary",
      "transitionVsConfirmedConflict"
    ].includes(routeCode)
  ) {
    flags.push(
      "Direction Conflict"
    );
  }

  let primary =
    "Other";

  if (
    obstacleState ===
      "inside" &&
    Number(rangeSize) >
      0.25
  ) {
    primary =
      "Obstacle / RR";
  } else if (
    routeCode ===
    "alignedTransition"
  ) {
    primary =
      "Aligned Transition";
  } else if (
    routeCode ===
    "reverseWeakMain"
  ) {
    primary =
      "Counter Weak Main";
  } else if (
    [
      "reverseHealthyMain",
      "alignedReverse",
      "neutralMainReverse"
    ].includes(routeCode)
  ) {
    primary =
      "HTF P1 Probe";
  } else if (
    [
      "mixedTransition",
      "neutralTransition",
      "bothTransition",
      "transitionReverse"
    ].includes(routeCode)
  ) {
    primary =
      "Mixed Transition";
  } else if (p2Effective) {
    primary =
      "Raw P3 → P2-E";
  }

  return {
    primary,
    flags:
      [...new Set(flags)]
  };
}

function normalizedRValue(
  actualR,
  finalSize
) {
  if (
    actualR === null ||
    actualR === undefined ||
    actualR === "" ||
    finalSize === null ||
    finalSize === undefined ||
    finalSize === ""
  ) {
    return null;
  }

  const actual =
    Number(actualR);
  const size =
    Number(finalSize);

  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    return null;
  }

  return actual / size;
}

function formatResearchR(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "N/A";
  }

  return Number.isFinite(
    Number(value)
  )
    ? `${Number(value).toFixed(2)}R`
    : "N/A";
}

function syncDeepRFShadowUI(
  editMode = false
) {
  const triggeredId =
    editMode
      ? "editDeepRFTriggered"
      : "deepRFTriggered";

  const detailsId =
    editMode
      ? "editDeepRFDetails"
      : "deepRFDetails";

  const originalSLId =
    editMode
      ? "editDeepRFOriginalSLHit"
      : "deepRFOriginalSLHit";

  const shadowMfeId =
    editMode
      ? "editDeepRFShadowMfeR"
      : "deepRFShadowMfeR";

  const noRfFinalId =
    editMode
      ? "editDeepRFNoRfFinalR"
      : "deepRFNoRfFinalR";

  const enabled =
    $(triggeredId).value ===
    "Yes";

  $(detailsId)
    .classList.toggle(
      "hidden",
      !enabled
    );

  [
    originalSLId,
    shadowMfeId,
    noRfFinalId
  ].forEach((id) => {
    $(id).disabled =
      !enabled;
  });

  if (!enabled) {
    $(originalSLId).value =
      "N/A";
    $(shadowMfeId).value =
      "";
    $(noRfFinalId).value =
      "";
  }
}

function syncObjectiveUpgradeUI(
  editMode = false,
  objectiveAtEntry = ""
) {
  const id =
    editMode
      ? "editPostEntryObjectiveUpgrade"
      : "postEntryObjectiveUpgrade";

  const select =
    $(id);

  const eligible =
    objectiveAtEntry ===
    "Reaction-first";

  select.disabled =
    !eligible;

  if (!eligible) {
    select.value =
      "No";
  }
}

function updateShadowResearchPreview() {
  const decision =
    currentDecision;

  if (!decision) return;

  const actualR =
    optionalNumberFromInput(
      "profitR"
    );

  const normalizedR =
    normalizedRValue(
      actualR,
      decision.finalSize
    );

  const quarterSize =
    Number(
      decision.finalSize
    ) === 0.25;

  $("shadowPrimaryCapReasonRow")
    .classList.toggle(
      "hidden",
      !quarterSize
    );

  $("shadowAdditionalCapFlagsRow")
    .classList.toggle(
      "hidden",
      !quarterSize
    );

  $("shadowPrimaryCapReason")
    .textContent =
      quarterSize
        ? (
            decision.primaryCapReason ||
            "N/A"
          )
        : "N/A";

  $("shadowAdditionalCapFlags")
    .textContent =
      quarterSize &&
      decision.additionalCapFlags
        ?.length
        ? decision.additionalCapFlags
            .join("｜")
        : "N/A";

  const objectiveAtEntry =
    decisionObjectiveAtEntry(
      decision
    );

  $("shadowObjectiveAtEntry")
    .textContent =
      objectiveAtEntry;

  $("shadowNormalizedR")
    .textContent =
      formatResearchR(
        normalizedR
      );

  syncObjectiveUpgradeUI(
    false,
    objectiveAtEntry
  );

  syncDeepRFShadowUI(false);
}

function evaluateDecision(
  baseTrigger,
  setupResult
) {
  const matrix = evaluateMatrix(
    setupResult.effectivePosition,
    setupResult.effectiveQuality,
    setupResult.effectiveSetupType,
    setupResult,
    baseTrigger
  );

  const preferred = preferredDirectionInfo();
  const background = backgroundRelationInfo();
  const control = controlAlignmentInfo();
  const transitionType = transitionTypeInfo();
  const q2Subtype = q2SubtypeInfo(baseTrigger);
  const enhancement = enhancementEdgeInfo(setupResult);

  const range = applyRangePosition(matrix.size);
  const obstacle = applyObstacle(
    range.adjustedSize,
    setupResult.effectivePosition,
    setupResult.effectiveQuality
  );

  const hardVetoes = evaluateHardVeto(
    setupResult.effectivePosition,
    baseTrigger,
    setupResult,
    obstacle
  );

  const finalSize = hardVetoes.length > 0 ? 0 : obstacle.adjustedSize;

  const objective = tradeObjectiveInfo({
    finalSize,
    matrixRouteCode: matrix.routeCode,
    setupResult,
    baseTrigger,
    firstObstacleR: obstacle.firstObstacleR,
    obstacleState: obstacle.state,
    control,
    transitionType
  });

  const shadowAlignedTransitionSize =
    matrix.routeCode === "alignedTransition" &&
    setupResult.effectivePosition === "P2" &&
    baseTrigger.quality === "Q3"
      ? 0.5
      : null;

  const capReason =
    capReasonInfo({
      finalSize,
      routeCode:
        matrix.routeCode,
      rawPosition:
        setupResult.basePosition,
      executionPosition:
        setupResult.effectivePosition,
      positionTreatment:
        setupResult.positionTreatment,
      nativeQ:
        baseTrigger.quality,
      q2SubtypeLabel:
        q2Subtype.label,
      obstacleState:
        obstacle.state,
      matrixSize:
        matrix.size,
      rangeSize:
        range.adjustedSize,
      controlCode:
        control.code
    });

  const reasons = [
    ...setupResult.reasons,
    `① 大局背景：${background.label}。${background.note}`,
    `② 主判／次判 Market State：${$("mainState").value} × ${$("secondaryState").value}；Transition Type＝${transitionType.label}。`,
    `③ Direction Permission：${matrix.routeLabel}；Market Cap ${SIZE_LABELS[matrix.marketCap]}。${matrix.routeReason}`,
    `④ Control Alignment：${control.label}。${control.note}`,
    `⑤ Raw P：${setupResult.basePosition}；${
      setupResult.basePosition === "P3"
        ? `P3 Context＝${p3ContextLabel($("p3Context").value) || "未分類"}（Shadow only）；`
        : ""
    }Execution P：${setupResult.effectivePosition}。`,
    `⑥ Setup／E：${setupResult.setupTemplateLabel}；${enhancement.label}。同一Order-flow event只計一次E；P3-PB／MID／EXT唔會改E升級權或Frozen Size。`,
    `⑦ Native Q：${baseTrigger.quality}${baseTrigger.quality === "Q2" ? `｜${q2Subtype.label}` : ""}；V1.3唔會用E將Q2改名Q3。`,
    `⑧ Obstacle／RR：${obstacle.explanation}`,
    `⑨ Final Size：${SIZE_LABELS[finalSize]}。${matrix.cellExplanation}`,
    `⑩ Objective at Entry：${simplifiedObjectiveAtEntry(objective.code, objective.shadowClass)}。${objective.reason}`
  ];

  const warnings = [
    ...setupResult.warnings,
    preferred.note
  ];

  if (shadowAlignedTransitionSize !== null) {
    warnings.push("Research Shadow：Aligned Transition P2＋Native Q3另記0.5 Shadow Size，但正式Size仍按0.25。")
  }

  if (matrix.routeCode === "alignedReverse") {
    warnings.push(
      htfP1ReversalExceptionInfo(
        baseTrigger,
        setupResult.basePosition,
        setupResult.effectiveQuality
      ).reason
    );
  }

  if (matrix.routeCode === "reverseWeakMain") {
    warnings.push(
      baseTrigger.quality === "Q2"
        ? "逆弱主判Q2固定0；Q2 subtype只作研究記錄。"
        : weakCounterRouteConfirmationInfo(
            setupResult.effectivePosition,
            setupResult.effectiveQuality,
            baseTrigger,
            setupResult
          ).reason
    );
  }

  if (matrix.routeCode === "reverseHealthyMain") {
    warnings.push(
      healthyCounterReversalInfo(
        setupResult.effectivePosition,
        setupResult.effectiveQuality
      ).reason
    );
  }

  if (matrix.routeCode === "neutralMainReverse") {
    warnings.push("主判中性唔等於逆次判有權；只限清晰HTF P1／Range Boundary＋Native Q3 Reaction Probe。")
  }

  if (["mixedTransition","neutralTransition"].includes(matrix.routeCode)) {
    warnings.push("Mixed／Neutral Transition只按邊界部署；Neutral／大型Range中間固定0。")
  }

  if ($("backgroundDirectOverlap").value === "yes" && ["P2","P3"].includes(setupResult.basePosition)) {
    warnings.push("Entry zone同HTF真實價格結構直接交集；重新檢查Raw P有冇低估。")
  }

  if ($("p1BackgroundTailwind").value === "valid") {
    warnings.push("Active P1 Tailwind只提供指定逆向資格；唔會將Raw P2升P1。")
  }

  if (marketCode(false) === "HSI") {
    warnings.push("HSI：10:30後唔開新Setup；HSI-C OPR Continuation & Retest仍屬Research／Provisional，暫時冇E。");

    if (
      setupResult.setupVariant ===
        "oprContinuation" &&
      checked("hsiOprTrendAligned") &&
      !$("hsiOprDirectionContext").value
    ) {
      warnings.push("HSI-C Research：未填OPR Direction Context；請標記順向順勢／反向順勢，方便之後比較Expectancy。");
    }
  }

  if (["UK100","GER40"].includes(marketCode(false))) {
    warnings.push("EU V1.3：正式核心係EU-A POR 2B、EU-B Asia Sweep＋Post-open Confirmation、EU-D POR Full Repair；Asia Sweep＋POR Repair只係同一thesis多個Tag，唔Double E／Size。")
  }

  if (checked("loosenedTriggerBecauseBias")) warnings.push("紀律標籤：曾因方向偏見想放寬Trigger；唔允許。")
  if (checked("emotionalSizing")) warnings.push("紀律標籤：曾因情緒／信心想加注；Final Size仍取最低限制。")

  return {
    relation: matrix.relation,
    marketRoute: matrix.routeLabel,
    marketRouteCode: matrix.routeCode,
    preferredDirection: preferred.label,
    priorityNote: preferred.note,
    backgroundRelation: background.label,
    backgroundRelationNote: background.note,
    transitionType: transitionType.code,
    transitionTypeLabel: transitionType.label,
    controlAlignment: control.code,
    controlAlignmentLabel: control.label,
    controlAlignmentNote: control.note,
    setupType: setupResult.effectiveSetupType,
    setupTypeLabel: setupResult.effectiveSetupTypeLabel,
    setupTemplate: setupResult.setupTemplate,
    setupTemplateLabel: setupResult.setupTemplateLabel,
    setupVariant: setupResult.setupVariant,
    enhancementMarker: enhancement.marker,
    enhancementLabel: enhancement.label,
    rawPosition: setupResult.basePosition,
    executionPosition: setupResult.effectivePosition,
    nativeQ: baseTrigger.quality,
    q2Subtype: q2Subtype.label,
    q2SubtypeCodes: q2Subtype.codes,
    marketCap: matrix.marketCap,
    matrixMode: matrix.mode,
    matrixRoute: matrix.route,
    rawMatrixSize: matrix.size,
    matrixSize: matrix.size,
    positionQualitySize: matrix.size,
    shadowAlignedTransitionSize,
    rangeState: range.state,
    rangeSize: range.adjustedSize,
    obstacleState: obstacle.state,
    hasFirstObstacle: obstacle.obstaclePresent,
    firstObstacleR: obstacle.firstObstacleR,
    obstacleKind: obstacle.kind,
    obstacleManagementChoice: obstacle.managementChoice,
    hardObstacleTreatment: obstacle.hardTreatment,
    obstacleSize: obstacle.adjustedSize,
    obstacleManagement: obstacle.management,
    obstacleManagementMode: obstacle.managementMode,
    obstacleEligible: obstacle.eligible,
    tradeObjective: objective.code,
    tradeObjectiveReason: objective.reason,
    objectiveAtEntry:
      objective.code,
    reactionFirstShadowClass:
      objective.shadowClass,
    primaryCapReason:
      capReason.primary,
    additionalCapFlags:
      capReason.flags,
    finalSize,
    reasons,
    warnings,
    hardVetoes
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderListBlock(title, items, className) {
  if (!items.length) return "";

  return `
    <div class="evaluation-block ${className}">
      <h3>${escapeHtml(title)}</h3>
      <ul>${items
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>
    </div>
  `;
}

function renderBaseTrigger(trigger) {
  $("preBonusTriggerGrade").textContent =
    trigger.quality;

  const grade =
    $("baseTriggerGrade");

  const subtype =
    q2SubtypeInfo(trigger);

  grade.textContent =
    trigger.quality === "Q3"
      ? "Q3｜Native完整高質"
      : trigger.quality === "Q2"
        ? `${subtype.label}｜Native Q2`
        : "Q1｜Setup失效";

  grade.className =
    `grade ${trigger.quality.toLowerCase()}`;

  $("triggerEvaluation").innerHTML = [
    renderListBlock(
      "失效原因",
      trigger.failures,
      "failures"
    ),
    renderListBlock(
      "Q2瑕疵／降級因素",
      trigger.imperfections,
      "imperfections"
    ),
    renderListBlock(
      "已確認",
      trigger.positives,
      "positives"
    )
  ].join("");
}

function renderAsia2B(result) {
  const selectedType =
    setupTypeFromTemplate(false);

  $("typeAPanel")
    .classList.toggle(
      "hidden",
      selectedType !== "A"
    );

  $("typeBPanel")
    .classList.toggle(
      "hidden",
      selectedType !== "B"
    );

  $("typeCPanel")
    .classList.toggle(
      "hidden",
      selectedType !== "C"
    );

  $("effectiveSetupType")
    .textContent =
      result.effectiveSetupTypeLabel;

  $("setupClassification")
    .textContent =
      setupClassificationLabel(
        false
      );

  $("asia2BQuality")
    .textContent =
      result.selectedSetupType === "A"
        ? result.highQuality
          ? `高質｜${result.criteriaCount}/6`
          : `未達A｜${result.criteriaCount}/6｜${result.typeAQualificationReason}｜按Type B`
        : "N/A";

  $("asia2BPositionEffect")
    .textContent =
      positionTreatmentLabel(
        result.positionTreatment,
        result.basePosition,
        result.effectivePosition
      );

  $("asia2BTriggerEffect")
    .textContent =
      result.baseQuality === "Q2"
        ? `Native Q2維持｜V1.3取消E／Session Q2→Q3升級`
        : `維持Native ${result.baseQuality}`;

  const grade =
    $("baseTriggerGrade");

  grade.textContent =
    result.effectiveQuality === "Q3"
      ? "Q3｜Native完整高質"
      : result.effectiveQuality === "Q2"
        ? "Q2｜故事成立但有瑕疵"
        : "Q1｜Setup失效";

  grade.className =
    `grade ${result.effectiveQuality.toLowerCase()}`;
}

function obstacleDisplayLabel(state) {
  const labels = {
    none: "冇第一真實障礙",
    pending: "有障礙｜未填距離",
    standard: "≥2R｜標準2R模式",
    rfManaged: "1.5R–2R｜RF-managed",
    partial: "舊版｜1–1.5R｜V1.3已Veto",
    veto: "<1.5R｜RR Veto",
    inside: "重大障礙區內｜Continuation上限",
    far: "舊版｜完整R:R",
    near: "舊版｜接近障礙",
    insufficient: "舊版｜空間不足"
  };
  return labels[state] || state;
}

function renderHardVetoPreview(vetoes) {
  const container = $("hardVetoPreview");

  if (!vetoes.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <ul>
      ${vetoes
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}
    </ul>
  `;
}

function renderDecision(decision) {
  const timeframes =
    timeframeValues();

  $("marketRelation").textContent =
    decision.relation;
  $("marketRoute").textContent =
    decision.marketRoute;
  $("preferredDirection").textContent =
    decision.preferredDirection;
  $("marketCap").textContent =
    SIZE_LABELS[
      decision.marketCap
    ];
  $("backgroundRelation").textContent =
    decision.backgroundRelation;
  $("priorityNote").textContent =
    decision.priorityNote;
  $("backgroundRelationNote")
    .textContent =
      decision.backgroundRelationNote;

  $("resultMarket").textContent =
    MARKET_CONFIG[
      marketCode(false)
    ].label;
  $("resultSetupTemplate").textContent =
    currentAsia2B
      .setupTemplateLabel;

  $("resultBackground").textContent =
    `${timeframes.background}－${$("backgroundState").value}`;
  $("resultMain").textContent =
    `${timeframes.main}－${$("mainState").value}`;
  $("resultSecondary").textContent =
    `${timeframes.secondary}－${$("secondaryState").value}`;
  $("resultEntryTimeframe").textContent =
    timeframes.entry;
  $("resultRelation").textContent =
    decision.relation;
  $("resultPreferredDirection")
    .textContent =
      decision.preferredDirection;
  $("resultBasePosition").textContent =
    currentAsia2B.basePosition;
  $("resultP3Context").textContent =
    currentAsia2B.basePosition === "P3"
      ? (
          p3ContextLabel(
            $("p3Context").value
          ) ||
          "未分類"
        )
      : "N/A";
  $("resultEffectivePosition")
    .textContent =
      currentAsia2B
        .effectivePosition;
  $("resultP1Background").textContent =
    $("p1BackgroundTailwind").value ===
      "valid"
      ? "有｜仍有效"
      : $("p1BackgroundTailwind").value ===
          "expired"
        ? "曾有｜已失效"
        : "冇";
  $("resultMarketRoute").textContent =
    decision.marketRoute;
  $("resultSetupType").textContent =
    currentAsia2B
      .effectiveSetupTypeLabel;
  $("resultEffectiveTrigger")
    .textContent =
      decision.nativeQ;
  $("resultTransitionType").textContent =
    decision.transitionTypeLabel;
  $("resultControlAlignment").textContent =
    decision.controlAlignmentLabel;
  $("resultEnhancement").textContent =
    decision.enhancementLabel;
  $("resultQ2Subtype").textContent =
    decision.nativeQ === "Q2"
      ? decision.q2Subtype
      : "N/A";
  $("resultTradeObjective").textContent =
    decisionObjectiveAtEntry(
      decision
    );

  const quarterSize =
    Number(
      decision.finalSize
    ) === 0.25;

  $("resultPrimaryCapReasonRow")
    .classList.toggle(
      "hidden",
      !quarterSize
    );
  $("resultAdditionalCapFlagsRow")
    .classList.toggle(
      "hidden",
      !quarterSize
    );

  $("resultPrimaryCapReason").textContent =
    quarterSize
      ? (
          decision.primaryCapReason ||
          "N/A"
        )
      : "N/A";

  $("resultAdditionalCapFlags").textContent =
    quarterSize &&
    decision.additionalCapFlags
      ?.length
      ? decision.additionalCapFlags
          .join("｜")
      : "N/A";

  $("resultShadowSize").textContent =
    decision.shadowAlignedTransitionSize === null
      ? "N/A"
      : `${SIZE_LABELS[decision.shadowAlignedTransitionSize]}｜Research only`;
  $("resultAsia2B").textContent =
    currentAsia2B.selectedSetupType ===
      "A"
      ? `${currentAsia2B.highQuality ? "Type A高質" : "未達Type A"}｜${currentAsia2B.criteriaCount}/6`
      : "N/A";
  $("resultMarketCap").textContent =
    SIZE_LABELS[
      decision.marketCap
    ];
  $("resultMatrixSize").textContent =
    SIZE_LABELS[
      decision.rawMatrixSize
    ];
  $("resultRangeSize").textContent =
    SIZE_LABELS[
      decision.rangeSize
    ];
  const obstacleDistanceLabel =
    Number.isFinite(
      decision.firstObstacleR
    )
      ? `${decision.firstObstacleR.toFixed(2)}R｜`
      : "";

  $("resultObstacleSize").textContent =
    `${obstacleDistanceLabel}${obstacleDisplayLabel(
      decision.obstacleState
    )} → ${SIZE_LABELS[
      decision.obstacleSize
    ]}`;
  $("finalSize").textContent =
    SIZE_LABELS[
      decision.finalSize
    ];

  $("decisionExplanations").innerHTML = [
    renderListBlock(
      "計算原因",
      decision.reasons,
      "decision-block reasons"
    ),
    renderListBlock(
      "警告／管理",
      [
        ...decision.warnings,
        decision.obstacleManagement
      ],
      "decision-block warnings"
    ),
    renderListBlock(
      "硬性否決",
      decision.hardVetoes,
      "decision-block denials"
    )
  ].join("");

  renderHardVetoPreview(
    decision.hardVetoes
  );
}

function syncObstacleModelInputs() {
  const obstaclePresent =
    hasFirstObstacle();

  $("firstObstaclePanel")
    .classList.toggle(
      "hidden",
      !obstaclePresent
    );

  const firstObstacleR =
    firstObstacleRValue();

  const kind =
    $("obstacleKind").value;

  const state =
    obstacleBandFromR(
      firstObstacleR,
      kind,
      obstaclePresent
    );

  $("obstacleState").value =
    state;

  $("insideMajorObstacle")
    .checked =
      obstaclePresent &&
      kind === "hard";

  const managementChoice =
    $("obstacleManagementChoice")
      .value;

  $("obstacleRFPlan").checked =
    obstaclePresent &&
    (
      managementChoice === "rf" ||
      managementChoice === "partial"
    );

  $("obstaclePartialPlan").checked =
    obstaclePresent &&
    managementChoice === "partial";

  $("hardObstacleTreatment").value =
    "downgrade";

  $("tradeSpace").value =
    state === "veto"
      ? "insufficient"
      : state === "rfManaged" ||
          state === "inside" ||
          state === "pending"
        ? "managed"
        : "full";

  $("rfManagedPanel")
    .classList.add("hidden");
  $("partialObstaclePanel")
    .classList.add("hidden");
  $("hardObstacleTreatmentPanel")
    .classList.add("hidden");

  $("obstacleBandLabel")
    .textContent =
      obstacleBandLabel(state);

  $("obstacleManagementLabel")
    .textContent =
      obstacleManagementLabel(state);

  updateObstacleNote();
}

function updateObstacleNote() {
  const obstaclePresent =
    hasFirstObstacle();

  const firstObstacleR =
    firstObstacleRValue();

  const kind =
    $("obstacleKind").value;

  const state =
    obstacleBandFromR(
      firstObstacleR,
      kind,
      obstaclePresent
    );

  const managementChoice =
    $("obstacleManagementChoice")
      .value;

  const managementLabel = {
    normal: "正常／按結構管理",
    rf: "到障礙推RF",
    partial: "障礙前Partial＋餘倉RF"
  }[managementChoice] || managementChoice;

  if (state === "none") {
    $("obstacleNote").textContent =
      "冇第一真實障礙阻住：Obstacle層唔限制Size；Objective仍由方向、P/Q、Control等條件決定。";
    return;
  }

  if (state === "pending") {
    $("obstacleNote").textContent =
      "已Tick有障礙，但未填距離R；未量度清楚之前暫時唔應落單。";
    return;
  }

  const distance =
    firstObstacleR.toFixed(2);

  const notes = {
    standard:
      `${distance}R普通障礙：≥2R，Size正常；管理＝${managementLabel}。`,
    rfManaged:
      `${distance}R普通障礙：1.5R–<2R，Size不自動下降，Objective預設Reaction；管理＝${managementLabel}。`,
    veto:
      `${distance}R：低於1.5R，RR Hard Veto，0注。`,
    inside:
      `${distance}R重大HTF障礙：Size降一級，Objective預設Reaction；管理＝${managementLabel}。`
  };

  $("obstacleNote").textContent =
    notes[state] || "";
}

function updateBackgroundOverlapNote() {
  const overlap =
    $("backgroundDirectOverlap").value;

  if (overlap === "yes") {
    $("backgroundOverlapNote").textContent =
      "大局實際重疊＝Entry zone本身同HTF真實價格結構有空間交集。Hide晒Fib、Asia、OPR、Mon H/L後，裸K仍會獨立畫出呢個區先算；可直接影響P級。";
  } else {
    $("backgroundOverlapNote").textContent =
      "冇HTF實際結構重疊：Fib、OPR、Asia H/L、Mon H/L、PDH／PDL單獨只係Confluence，唔會自行創造P1。";
  }
}

function updateP1TailwindNote() {
  const value =
    $("p1BackgroundTailwind").value;

  if (value === "valid") {
    $("p1TailwindNote").textContent =
      "P1順風仍有效：只限價格觸及P1後第一段真實反應。健康／弱主判可按原規則提供P2／P2-E＋Q3最高0.25；主判Transition時，只限中性轉換，或交易方向順主判偏向。逆主判Transition偏向唔享有P1順風。";
    return;
  }

  if (value === "expired") {
    $("p1TailwindNote").textContent =
      "P1順風已失效：完成一段有效回調、次判確認新Trend、冇形成LH／HL而橫行、或者P1被反覆測試消耗後，唔可以再借用。";
    return;
  }

  $("p1TailwindNote").textContent =
    "P1順風＝價格觸及P1後第一段新鮮反應；Entry zone實際重疊係另一件事。";
}

function updateCounterP2PermissionUI(
  effectivePosition = null,
  effectiveQuality = null,
  baseTrigger = null,
  setupResult = null
) {
  const route =
    marketRouteInfo();

  const mainState =
    $("mainState").value;

  const resolvedPosition =
    effectivePosition ||
    $("positionLevel").value;

  const showCounterPermissionNote =
    ["reverseWeakMain","reverseHealthyMain"].includes(
      route.code
    ) &&
    ["P1","P2"].includes(
      resolvedPosition
    );

  const showCounterContext =
    route.code ===
      "reverseWeakMain" &&
    ["P1","P2"].includes(
      resolvedPosition
    );

  $("counterP2EligibilityNote")
    .classList.toggle(
      "hidden",
      !showCounterPermissionNote
    );

  const showWeakPanel =
    showCounterContext &&
    isWeak(mainState);

  $("counterP2WeakPermissionPanel")
    .classList.toggle(
      "hidden",
      !showWeakPanel
    );

  if (!showWeakPanel) {
    $("counterP2WeakPermissionPath")
      .value = "none";
  }

  $("counterP2WeakPermissionPath")
    .disabled = false;

  const selectedPath =
    $("counterP2WeakPermissionPath")
      .value;

  $("counterP2WeakBreakRetest")
    .checked =
      selectedPath ===
        "weakBreakRetest";

  const showFreshPanel =
    showWeakPanel &&
    selectedPath ===
      "weakFreshSession";

  $("counterP2WeakFreshSessionPanel")
    .classList.toggle(
      "hidden",
      !showFreshPanel
    );

  if (showFreshPanel) {
    const setupInfo =
      freshSessionSetupInfo(
        setupResult,
        baseTrigger
      );

    $("counterP2WeakFreshSessionSetupNote")
      .textContent =
        setupInfo.autoRecognized
          ? `App自動識別：${setupInfo.label}。Route B Size gate只再要求Native Q3＋健康逆向次判＋全新獨立Session Confirmation；其他距離／成熟度欄位只作Research。`
          : setupInfo.manualEquivalent
            ? "已手動確認其他同級獨立Session Setup；其餘距離／成熟度欄位只作Research。"
            : "目前核心Setup未被App識別為獨立Session Confirmation；只有真正同級Setup先可手動確認。";
  }

  if (showCounterPermissionNote) {
    if (route.code === "reverseHealthyMain") {
      $("counterP2EligibilityNote")
        .textContent =
          healthyCounterReversalInfo(
            resolvedPosition,
            effectiveQuality
          ).reason;
    } else if (resolvedPosition === "P1") {
      const confirmation =
        weakCounterRouteConfirmationInfo(
          resolvedPosition,
          effectiveQuality,
          baseTrigger,
          setupResult
        );

      $("counterP2EligibilityNote")
        .textContent =
          `P1逆弱主判：冇Route A／B就0；Route成立＋Native Q3最高0.25。${confirmation.reason}`;
    } else {
      $("counterP2EligibilityNote")
        .textContent =
          counterP2EligibilityInfo(
            resolvedPosition,
            effectiveQuality,
            baseTrigger,
            setupResult
          ).reason;
    }
  }
}

function updateInterface() {
  const timeframes =
    timeframeValues();

  const backgroundState =
    $("backgroundState").value;
  const mainState =
    $("mainState").value;
  const secondaryState =
    $("secondaryState").value;
  const position =
    $("positionLevel").value;
  const selectedSetupType =
    setupTypeFromTemplate(false);
  const variant =
    setupVariant(false);
  const definition =
    setupDefinition(false);

  $("backgroundStateLabel").textContent =
    `大局背景（${timeframes.background}）`;
  $("mainStateLabel").textContent =
    `主判斷（${timeframes.main}）`;
  $("secondaryStateLabel").textContent =
    `次判斷（${timeframes.secondary}）`;

  $("backgroundStateNote").textContent =
    STATES[backgroundState].note;
  $("mainStateNote").textContent =
    STATES[mainState].note;
  $("secondaryStateNote").textContent =
    STATES[secondaryState].note;

  const transitionInfo =
    transitionTypeInfo(
      mainState,
      secondaryState
    );
  const controlInfo =
    controlAlignmentInfo(
      secondaryState,
      direction()
    );

  $("transitionTypeDisplay").textContent =
    transitionInfo.label;
  $("controlAlignmentDisplay").textContent =
    controlInfo.label;
  $("controlAlignmentNote").textContent =
    controlInfo.note;

  const combinedDeployment =
    combinedDeploymentInfo();

  $("combinedPriorityDeployment").textContent =
    combinedDeployment.priority;
  $("combinedSecondaryDeployment").textContent =
    combinedDeployment.secondary;

  const info =
    POSITION_INFO[position];

  $("positionTitle").textContent =
    `${position}｜${info.title}`;
  $("positionNote").textContent =
    info.note;

  $("p3ContextPanel")
    .classList.toggle(
      "hidden",
      position !== "P3"
    );

  if (position !== "P3") {
    $("p3Context").value = "";
  }

  $("setupClassification")
    .textContent =
      setupClassificationLabel(
        false
      );

  $("typeAPanel").classList.toggle(
    "hidden",
    selectedSetupType !== "A"
  );
  $("typeBPanel").classList.toggle(
    "hidden",
    selectedSetupType !== "B"
  );
  $("typeCPanel").classList.toggle(
    "hidden",
    selectedSetupType !== "C"
  );

  const sweepFieldsVisible =
    variant === "session2B" ||
    variant === "sweep" ||
    variant === "p1ReversalSweep";

  $("sweepReclaimTriggerFields")
    .classList.toggle(
      "hidden",
      !sweepFieldsVisible
    );

  const breakoutVisible =
    variant === "breakout" ||
    variant === "oprContinuation" ||
    variant === "fullRepairAsia" ||
    variant === "fullRepairPure" ||
    variant ===
      "postOpenConfirmation";

  $("breakoutSetupPanel")
    .classList.toggle(
      "hidden",
      !breakoutVisible
    );

  const fullRepairVisible =
    variant === "fullRepairAsia" ||
    variant === "fullRepairPure";

  $("fullRepairPanel")
    .classList.toggle(
      "hidden",
      !fullRepairVisible
    );

  $("fullRepairAsiaSweepRow")
    .classList.toggle(
      "hidden",
      !(
        variant === "fullRepairAsia" ||
        variant === "fullRepairPure"
      )
    );

  const postOpenVisible =
    variant ===
      "postOpenConfirmation";

  $("postOpenConfirmationPanel")
    .classList.toggle(
      "hidden",
      !postOpenVisible
    );

  const openingDriveVisible =
    fullRepairVisible ||
    postOpenVisible;

  $("openingDriveValidityPanel")
    .classList.toggle(
      "hidden",
      !openingDriveVisible
    );

  const euOpeningVisible =
    marketCode(false) === "UK100" ||
    marketCode(false) === "GER40";

  $("euOpeningBacktestPanel")
    .classList.toggle(
      "hidden",
      !euOpeningVisible
    );

  $("euDRequiredFields")
    .classList.toggle(
      "hidden",
      !postOpenVisible
    );

  $("p1NoSweepPanel")
    .classList.toggle(
      "hidden",
      variant !==
        "p1NoSweep"
    );

  $("trendPullbackPanel")
    .classList.toggle(
      "hidden",
      variant !==
        "trendPullback"
    );

  $("hsiOprContinuationPanel")
    .classList.toggle(
      "hidden",
      variant !== "oprContinuation"
    );

  if (
    variant !== "oprContinuation"
  ) {
    $("hsiOprDirectionContext")
      .value = "";
  }

  if (
    $("typeCVariantNote")
  ) {
    $("typeCVariantNote")
      .textContent =
        definition.note;
  }

  if (
    $("typeALiquidityNote")
  ) {
    $("typeALiquidityNote")
      .textContent =
        definition.liquidityLabel
          ? `指定流動性：${definition.liquidityLabel}`
          : "Type A只限指定市場Session 2B。";
  }

  const rangeActive =
    secondaryState ===
    "轉換中－中性";

  $("secondaryRangePanel")
    .classList.toggle(
      "hidden",
      !rangeActive
    );

  if (!rangeActive) {
    $("secondaryRangePosition")
      .value = "favorable";
    $("secondaryRangeNote")
      .textContent =
        "次判唔係中性Transition／Range，25%修正不適用。";
  } else {
    const side =
      direction() === "Long"
        ? "底部25%"
        : "頂部25%";

    $("secondaryRangeNote")
      .textContent =
        `次判中性Transition／Range：${direction()}只優先${side}；未進入相關25%降一級，Range中間固定0。`;
  }

  const route =
    marketRouteInfo();

  const showTransitionP1 =
    ["transitionReverse","neutralMainReverse"].includes(
      route.code
    ) &&
    position === "P1";

  $("transitionLayerP1Row")
    .classList.toggle(
      "hidden",
      !showTransitionP1
    );

  if (!showTransitionP1) {
    $("transitionLayerP1")
      .checked = false;
  }

  const showP3Conflict =
    route.code ===
      "conflictMain" &&
    position === "P3";

  $("p3ConflictTestableRow")
    .classList.toggle(
      "hidden",
      !showP3Conflict
    );

  if (!showP3Conflict) {
    $("p3ConflictTestable")
      .checked = false;
  }

  const showHTFException =
    route.code ===
      "alignedReverse";

  $("htfP1ReversalExceptionRow")
    .classList.toggle(
      "hidden",
      !showHTFException
    );

  if (!showHTFException) {
    $("htfP1ReversalException")
      .checked = false;
  }

  const showBothTransitionP1 =
    route.code ===
      "bothTransition" &&
    position === "P1";

  $("bothTransitionMajorP1Row")
    .classList.toggle(
      "hidden",
      !showBothTransitionP1
    );

  if (!showBothTransitionP1) {
    $("bothTransitionMajorP1")
      .checked = false;
  }

  const showBothTransitionP3 =
    route.code ===
      "bothTransition" &&
    position === "P3";

  $("bothTransitionP3TestableRow")
    .classList.toggle(
      "hidden",
      !showBothTransitionP3
    );

  if (!showBothTransitionP3) {
    $("bothTransitionP3Testable")
      .checked = false;
  }

  $("tradingTimeRuleLabel")
    .textContent =
      marketCode(false) === "HSI"
        ? "HSI 10:30後仍開新Setup／其他市場違反時間規則"
        : "違反交易時間限制";

  updateXauLiquidityUI(
    false,
    position
  );

  syncObstacleModelInputs();
  updateBackgroundOverlapNote();
  updateP1TailwindNote();
}

function recalculate() {
  updateInterface();

  currentBaseTrigger =
    evaluateBaseTrigger();
  currentAsia2B =
    evaluateAsia2B(currentBaseTrigger);
  currentDecision =
    evaluateDecision(
      currentBaseTrigger,
      currentAsia2B
    );

  updateCounterP2PermissionUI(
    currentAsia2B.effectivePosition,
    currentAsia2B.effectiveQuality,
    currentBaseTrigger,
    currentAsia2B
  );

  renderBaseTrigger(currentBaseTrigger);
  renderAsia2B(currentAsia2B);
  renderDecision(currentDecision);
  updateShadowResearchPreview();
  updateDualTrack();
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function optionalNumberFromInput(id) {
  const value = $(id).value.trim();

  if (value === "") return null;

  const number = Number(value);
  return Number.isFinite(number)
    ? number
    : null;
}

function parseDurationMinutes(
  value
) {
  const raw =
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

  if (raw === "") {
    return null;
  }

  // Backward-friendly: plain number means minutes.
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const match =
    raw.match(
      /^(?:(\d+)H)?(?:(\d+)M)?$/
    );

  if (
    !match ||
    (
      match[1] === undefined &&
      match[2] === undefined
    )
  ) {
    return Number.NaN;
  }

  const hours =
    Number(match[1] || 0);

  const minutes =
    Number(match[2] || 0);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    minutes < 0
  ) {
    return Number.NaN;
  }

  return (
    hours * 60 +
    minutes
  );
}

function durationMinutesFromInput(
  id
) {
  return parseDurationMinutes(
    $(id).value
  );
}

function formatDurationMinutes(
  value
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(numeric) ||
    numeric < 0
  ) {
    return "N/A";
  }

  const totalMinutes =
    Math.round(numeric);

  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0
      ? `${hours}H${String(minutes).padStart(2, "0")}M`
      : `${hours}H`;
  }

  return `${minutes}M`;
}

function normalizeDurationInput(
  id
) {
  const input =
    $(id);

  const parsed =
    parseDurationMinutes(
      input.value
    );

  if (parsed === null) {
    input.setCustomValidity("");
    return;
  }

  if (
    Number.isNaN(parsed)
  ) {
    input.setCustomValidity(
      "請用例如 11H45M、2H、45M；純數字會當分鐘。"
    );
    return;
  }

  input.setCustomValidity("");
  input.value =
    formatDurationMinutes(
      parsed
    );
}

function triggerChecklistLines() {
  const variant =
    currentBaseTrigger.variant;

  return [
    `Setup：${currentBaseTrigger.setupTemplateLabel}`,
    `Setup Type選擇：${setupTypeLabel(currentBaseTrigger.selectedSetupType)}`,
    `有效Setup Type：${currentAsia2B.effectiveSetupTypeLabel}`,
    `Setup子類型：${variant}`,
    `有效Sweep：${yesNo(currentBaseTrigger.validSweep)}`,
    `有效Reclaim：${yesNo(currentBaseTrigger.validReclaim)}`,
    `有效Breakout：${yesNo(currentBaseTrigger.validBreakout)}`,
    `有效Acceptance：${yesNo(currentBaseTrigger.validAcceptance)}`,
    `第一次Retest：${yesNo(currentBaseTrigger.firstRetest)}`,
    `微結構／控制權轉移：${yesNo(currentBaseTrigger.microStructureShift)}`,
    `Retest質素：${$("retestQuality").selectedOptions[0].textContent}`,
    `基礎Q：${currentBaseTrigger.quality}`,
    `Setup修正後Q：${currentAsia2B.effectiveQuality}`
  ];
}

function checklistSummary() {
  const timeframes =
    timeframeValues();

  const tailwind =
    $("p1BackgroundTailwind").value;

  const counterInfo =
    counterP2EligibilityInfo(
      currentAsia2B.effectivePosition,
      currentAsia2B.effectiveQuality,
      currentBaseTrigger,
      currentAsia2B
    );

  return [
    `交易日期：${$("tradeDate").value}`,
    `市場：${MARKET_CONFIG[marketCode(false)].label}`,
    `品種：${$("symbol").value}`,
    `核心Setup：${currentAsia2B.setupTemplateLabel}`,
    `大局背景層：${timeframes.background}－${$("backgroundState").value}`,
    `主判斷層：${timeframes.main}－${$("mainState").value}`,
    `次判斷層：${timeframes.secondary}－${$("secondaryState").value}`,
    `入場觸發層：${timeframes.entry}`,
    `交易方向：${direction()}`,
    `市場關係：${currentDecision.relation}`,
    `交易路線：${currentDecision.marketRoute}`,
    `市場關係上限：${SIZE_LABELS[currentDecision.marketCap]}`,
    "",
    `Setup Type：${currentAsia2B.effectiveSetupTypeLabel}`,
    `Type A高質：${currentAsia2B.selectedSetupType === "A" ? yesNo(currentAsia2B.highQuality) : "N/A"}`,
    `Type A條件：${currentAsia2B.selectedSetupType === "A" ? `${currentAsia2B.criteriaCount}/6` : "N/A"}`,
    isPreviousHLSweepSetup(false)
      ? `Previous H/L Sweep：${currentAsia2B.previousHLSweepSourceLabel}｜${currentAsia2B.previousHLSweepSessionLabel}`
      : "",
    marketCode(false) === "XAU"
      ? `XAU流動性：${currentAsia2B.xauLiquidityRank}｜${currentAsia2B.xauLiquiditySourceLabel}｜${currentAsia2B.xauSweepSessionLabel}`
      : "",
    marketCode(false) === "XAU"
      ? `XAU E標記：${currentAsia2B.xauPositionEdgeLabel}｜${currentAsia2B.xauSetupPriority}`
      : "",
    "",
    `大局實際結構重疊：${$("backgroundDirectOverlap").value === "yes" ? "有" : "冇"}`,
    `P1順風：${tailwind === "valid" ? "有｜仍有效" : tailwind === "expired" ? "曾有｜已失效" : "冇"}`,
    `Matrix Version：Master Trade Matrix V1.3｜2026/08 Frozen`,
    `Transition Type：${currentDecision?.transitionTypeLabel || transitionTypeInfo().label}`,
    `Control Alignment：${currentDecision?.controlAlignmentLabel || controlAlignmentInfo().label}`,
    `Raw P → P3 Context → E → Execution P：${currentAsia2B.basePosition} → ${
      currentAsia2B.basePosition === "P3"
        ? (p3ContextLabel($("p3Context").value) || "未分類")
        : "N/A"
    } → ${currentDecision?.enhancementLabel || "None"} → ${currentAsia2B.effectivePosition}`,
    `Native Q：${currentBaseTrigger.quality}${currentBaseTrigger.quality === "Q2" ? `｜${q2SubtypeInfo(currentBaseTrigger).label}` : ""}`,
    `Objective at Entry：${decisionObjectiveAtEntry(currentDecision)}`,
    `Transition主判P1順風P2資格：${transitionP1TailwindEligibilityInfo(
      currentAsia2B.effectivePosition,
      currentAsia2B.effectiveQuality
    ).eligible ? "有" : "冇"}｜${transitionP1TailwindEligibilityInfo(
      currentAsia2B.effectivePosition,
      currentAsia2B.effectiveQuality
    ).reason}`,
    `逆主判P2資格：${counterInfo.eligible ? "有" : "冇"}｜${counterInfo.reason}`,
    `逆弱主判路徑：${$("counterP2WeakPermissionPath").value}`,
    `路徑B工作結構突破維持：${yesNo(checked("counterP2WeakWorkStructureHeld"))}`,
    `路徑B獨立Session催化：${yesNo(checked("counterP2WeakIndependentSession"))}`,
    `路徑B其他同級Setup：${yesNo(checked("counterP2WeakEquivalentSessionSetup"))}`,
    `路徑B硬障礙距離：${numericInputValue("counterP2WeakHardObstacleR") ?? "N/A"}R`,
    `路徑B未到成熟腿尾：${yesNo(checked("counterP2WeakNotMatureLeg"))}`,
    `路徑B未貼近主判主結：${yesNo(checked("counterP2WeakNotNearMainStructure"))}`,
    `窄義HTF P1反轉例外：${yesNo(checked("htfP1ReversalException"))}`,
    `主判Transition反向P1：${yesNo(checked("transitionLayerP1"))}`,
    `衝突順主判P3可測試：${yesNo(checked("p3ConflictTestable"))}`,
    `雙轉換P3可測試：${yesNo(checked("bothTransitionP3Testable"))}`,
    "",
    `原始位置：${currentAsia2B.basePosition}`,
    `Setup後有效位置：${currentAsia2B.effectivePosition}`,
    `P待遇來源：${positionTreatmentLabel(
      currentAsia2B.positionTreatment,
      currentAsia2B.basePosition,
      currentAsia2B.effectivePosition
    )}`,
    "",
    ...triggerChecklistLines(),
    "",
    `次判Range修正：${currentDecision.rangeState}`,
    `Range修正後：${SIZE_LABELS[currentDecision.rangeSize]}`,
    `障礙：${obstacleDisplayLabel(currentDecision.obstacleState)}`,
    `P×Q／方向Matrix：${SIZE_LABELS[currentDecision.rawMatrixSize]}`,
    `障礙修正：${SIZE_LABELS[currentDecision.obstacleSize]}`,
    `最終注碼：${SIZE_LABELS[currentDecision.finalSize]}`,
    "",
    `追價：${yesNo(checked("chasedBreakout"))}`,
    `違反交易時間：${yesNo(checked("violatesTradingTime"))}`,
    `總風險超標：${yesNo(checked("riskLimitExceeded"))}`,
    `方向偏見想放寬Setup／Q：${yesNo(checked("loosenedTriggerBecauseBias"))}`,
    `情緒想加注：${yesNo(checked("emotionalSizing"))}`,
    "",
    `Entry-time Q：${$("entryTimeQ").value === "Auto" ? currentAsia2B.effectiveQuality : $("entryTimeQ").value}`,
    `Post-entry Q：${$("postEntryQ").value}`,
    `Post-entry處理：${$("postEntryAction").value}`
  ].join("\n");
}

function loadRecords() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    return Array.isArray(parsed)
      ? parsed.map(Shadow.normalizeRecord)
      : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(records.map(Shadow.normalizeRecord))
  );
}

function openImageDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      IMAGE_DB_NAME,
      IMAGE_DB_VERSION
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(IMAGE_STORE)) {
        database.createObjectStore(IMAGE_STORE);
      }
    };

    request.onsuccess = () =>
      resolve(request.result);
    request.onerror = () =>
      reject(request.error);
  });
}

function normalizeStoredImages(value) {
  if (!value) return [];

  if (value instanceof Blob) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter(
      (item) => item instanceof Blob
    );
  }

  return [];
}

async function putImages(recordId, blobs) {
  const database =
    await openImageDatabase();

  const safeBlobs =
    Array.isArray(blobs)
      ? blobs.filter(
          (item) => item instanceof Blob
        )
      : [];

  return new Promise((resolve, reject) => {
    const transaction =
      database.transaction(
        IMAGE_STORE,
        "readwrite"
      );

    transaction
      .objectStore(IMAGE_STORE)
      .put(safeBlobs, recordId);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function getImages(recordId) {
  const database =
    await openImageDatabase();

  return new Promise((resolve, reject) => {
    const transaction =
      database.transaction(
        IMAGE_STORE,
        "readonly"
      );

    const request = transaction
      .objectStore(IMAGE_STORE)
      .get(recordId);

    request.onsuccess = () => {
      database.close();
      resolve(
        normalizeStoredImages(
          request.result
        )
      );
    };

    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function deleteImages(recordId) {
  const database =
    await openImageDatabase();

  return new Promise((resolve, reject) => {
    const transaction =
      database.transaction(
        IMAGE_STORE,
        "readwrite"
      );

    transaction
      .objectStore(IMAGE_STORE)
      .delete(recordId);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

function compressImage(file) {
  return new Promise((resolve) => {
    const sourceUrl =
      URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const maxDimension = 1800;
      const scale = Math.min(
        1,
        maxDimension /
          Math.max(image.width, image.height)
      );

      const width = Math.max(
        1,
        Math.round(image.width * scale)
      );
      const height = Math.max(
        1,
        Math.round(image.height * scale)
      );

      const canvas =
        document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context =
        canvas.getContext("2d");
      context.drawImage(
        image,
        0,
        0,
        width,
        height
      );

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(sourceUrl);
          resolve(blob || file);
        },
        "image/jpeg",
        0.82
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      resolve(file);
    };

    image.src = sourceUrl;
  });
}

function revokeObjectUrls(urls) {
  urls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore already-revoked URLs.
    }
  });
}

function renderPendingImageGallery() {
  revokeObjectUrls(
    pendingImageUrls
  );

  pendingImageUrls =
    pendingImageBlobs.map(
      (blob) =>
        URL.createObjectURL(blob)
    );

  $("pendingImageCount").textContent =
    `已貼上 ${pendingImageBlobs.length} 張圖片`;

  $("imagePreviewContainer")
    .classList.toggle(
      "hidden",
      pendingImageBlobs.length === 0
    );

  $("imagePreviewGallery").innerHTML =
    pendingImageUrls
      .map(
        (url, index) => `
          <div class="multi-image-item">
            <img
              src="${url}"
              alt="Chart screenshot ${index + 1}"
            >
            <div class="multi-image-item-actions">
              <span>圖片 ${index + 1}</span>
              <button
                type="button"
                class="danger-button mini-button"
                data-remove-pending-image="${index}"
              >移除</button>
            </div>
          </div>
        `
      )
      .join("");
}

function clearPendingImage() {
  revokeObjectUrls(
    pendingImageUrls
  );
  pendingImageUrls = [];
  pendingImageBlobs = [];

  $("imagePreviewGallery").innerHTML =
    "";
  $("pendingImageCount").textContent =
    "已貼上 0 張圖片";
  $("imagePreviewContainer")
    .classList.add("hidden");
}

function removePendingImageAt(index) {
  if (
    index < 0 ||
    index >= pendingImageBlobs.length
  ) {
    return;
  }

  pendingImageBlobs.splice(
    index,
    1
  );

  renderPendingImageGallery();
}

function clipboardImagesFromPasteEvent(event) {
  const items =
    event.clipboardData?.items || [];
  const images = [];

  for (const item of items) {
    if (
      item.kind === "file" &&
      item.type.startsWith("image/")
    ) {
      const file =
        item.getAsFile();

      if (file) {
        images.push(file);
      }
    }
  }

  return images;
}

async function readImagesFromSystemClipboard() {
  if (
    !navigator.clipboard ||
    typeof navigator.clipboard.read !==
      "function"
  ) {
    return [];
  }

  const clipboardItems =
    await navigator.clipboard.read();
  const images = [];

  for (const item of clipboardItems) {
    for (const type of item.types) {
      if (
        type.startsWith("image/")
      ) {
        images.push(
          await item.getType(type)
        );
      }
    }
  }

  return images;
}

async function addPendingImageBlobs(blobs) {
  const validBlobs =
    (Array.isArray(blobs)
      ? blobs
      : [blobs]
    ).filter(
      (blob) =>
        blob instanceof Blob
    );

  if (validBlobs.length === 0) {
    showToast(
      "剪貼簿入面搵唔到圖片"
    );
    return;
  }

  const compressed =
    await Promise.all(
      validBlobs.map(
        (blob) =>
          compressImage(blob)
      )
    );

  pendingImageBlobs.push(
    ...compressed
  );

  renderPendingImageGallery();

  showToast(
    `已新增 ${compressed.length} 張圖片；目前共 ${pendingImageBlobs.length} 張`
  );
}

async function handlePendingImagePaste(event) {
  event.preventDefault();

  const blobs =
    clipboardImagesFromPasteEvent(
      event
    );

  await addPendingImageBlobs(
    blobs
  );
}

async function pastePendingImageFromClipboard() {
  try {
    const blobs =
      await readImagesFromSystemClipboard();

    await addPendingImageBlobs(
      blobs
    );
  } catch (error) {
    console.error(
      "Clipboard image read failed:",
      error
    );

    showToast(
      "未能直接讀取剪貼簿；請點擊貼上區後用系統「貼上」"
    );

    $("chartPasteZone").focus();
  }
}

async function saveDecision(event) {
  event.preventDefault();
  if (!validateDualSave()) return;

  const symbol =
    $("symbol").value
      .trim()
      .toUpperCase();

  if (!symbol) {
    showToast("請輸入品種");
    $("symbol").focus();
    return;
  }

  const tradeDate = $("tradeDate").value;

  if (!tradeDate) {
    showToast("請選擇交易日期");
    $("tradeDate").focus();
    return;
  }

  const timeToRFMinutes =
    durationMinutesFromInput(
      "timeToRF"
    );

  if (
    Number.isNaN(
      timeToRFMinutes
    )
  ) {
    showToast(
      "Time to RF格式錯誤；請輸入例如11H45M、2H或45M"
    );
    $("timeToRF").focus();
    return;
  }

  const profitRValue =
    optionalNumberFromInput(
      "profitR"
    );

  const normalizedR =
    normalizedRValue(
      profitRValue,
      currentDecision?.finalSize
    );

  const timeframes =
    timeframeValues();

  const counterP2Info =
    counterP2EligibilityInfo(
      currentAsia2B.effectivePosition,
      currentAsia2B.effectiveQuality,
      currentBaseTrigger,
      currentAsia2B
    );

  const recordId =
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const record = {
    id: recordId,
    tradeDate,
    createdAt:
      new Date().toISOString(),
    appVersion:
      "PracticeJournal-V1.31.0-DualTrack",
    engineVersion:
      "MasterTradeMatrix-V1.3-r27-SharedE+V1.4-Candidate-r1",
    matrixVersion:
      "Master Trade Matrix V1.3｜2026/08 Frozen",

    recordMode:
      recordMode(),
    marketCode:
      marketCode(false),
    marketLabel:
      MARKET_CONFIG[
        marketCode(false)
      ].label,
    symbol,
    setupTemplate:
      currentAsia2B.setupTemplate,
    setupTemplateLabel:
      currentAsia2B.setupTemplateLabel,
    setupVariant:
      currentAsia2B.setupVariant,
    oprDirectionContext:
      currentAsia2B.setupVariant ===
          "oprContinuation" &&
        checked(
          "hsiOprTrendAligned"
        )
        ? $("hsiOprDirectionContext").value
        : "",
    oprDirectionContextLabel:
      currentAsia2B.setupVariant ===
          "oprContinuation" &&
        checked(
          "hsiOprTrendAligned"
        )
        ? hsiOprDirectionContextLabel(
            $("hsiOprDirectionContext").value
          )
        : "",
    previousHLSweepSource:
      currentAsia2B.previousHLSweepSource || "",
    previousHLSweepSourceLabel:
      currentAsia2B.previousHLSweepSourceLabel || "",
    previousHLSweepSession:
      currentAsia2B.previousHLSweepSession || "",
    previousHLSweepSessionLabel:
      currentAsia2B.previousHLSweepSessionLabel || "",
    xauLiquiditySource:
      currentAsia2B.xauLiquiditySource || "",
    xauLiquiditySourceLabel:
      currentAsia2B.xauLiquiditySourceLabel || "",
    xauSweepSession:
      currentAsia2B.xauSweepSession || "",
    xauSweepSessionLabel:
      currentAsia2B.xauSweepSessionLabel || "",
    xauLiquidityRank:
      currentAsia2B.xauLiquidityRank || "",
    xauEdgeMarker:
      currentAsia2B.xauEdgeMarker || "",
    xauPositionEdgeLabel:
      currentAsia2B.xauPositionEdgeLabel || "",
    xauSetupPriority:
      currentAsia2B.xauSetupPriority || "",
    xauSetupEligible:
      currentAsia2B.xauSetupEligible !== false,
    xauSetupEligibilityReason:
      currentAsia2B.xauSetupEligibilityReason || "",

    backgroundTimeframe:
      timeframes.background,
    mainTimeframe:
      timeframes.main,
    secondaryTimeframe:
      timeframes.secondary,
    entryTimeframe:
      timeframes.entry,

    backgroundState:
      $("backgroundState").value,
    mainState:
      $("mainState").value,
    secondaryState:
      $("secondaryState").value,
    bothTransitionRange:
      "no",

    direction:
      direction(),
    relation:
      currentDecision.relation,
    marketRoute:
      currentDecision.marketRoute,
    marketRouteCode:
      currentDecision.marketRouteCode,
    preferredDirection:
      currentDecision.preferredDirection,
    priorityDeployment:
      combinedDeploymentInfo().priority,
    secondaryDeployment:
      combinedDeploymentInfo().secondary,
    backgroundRelation:
      currentDecision.backgroundRelation,
    transitionType:
      currentDecision.transitionType,
    transitionTypeLabel:
      currentDecision.transitionTypeLabel,
    controlAlignment:
      currentDecision.controlAlignment,
    controlAlignmentLabel:
      currentDecision.controlAlignmentLabel,

    backgroundDirectOverlap:
      $("backgroundDirectOverlap").value,
    p1BackgroundTailwind:
      $("p1BackgroundTailwind").value,

    basePosition:
      currentAsia2B.basePosition,
    position:
      currentAsia2B.effectivePosition,
    rawP:
      currentDecision.rawPosition,
    p3Context:
      currentDecision.rawPosition === "P3"
        ? $("p3Context").value
        : "",
    executionP:
      currentDecision.executionPosition,
    enhancement:
      currentDecision.enhancementMarker,
    enhancementLabel:
      currentDecision.enhancementLabel,
    nativeQ:
      currentDecision.nativeQ,
    q2Subtype:
      currentDecision.q2Subtype,
    q2SubtypeCodes:
      currentDecision.q2SubtypeCodes,
    // Legacy/raw objective retained internally; Objective at Entry is the analysis source of truth.
    tradeObjective:
      currentDecision.tradeObjective,
    tradeObjectiveReason:
      currentDecision.tradeObjectiveReason,
    objectiveAtEntry:
      decisionObjectiveAtEntry(
        currentDecision
      ),
    shadowResearchVersion:
      "2025 H2 Shadow Overlay v7",
    primaryCapReason:
      currentDecision.primaryCapReason ||
      "N/A",
    additionalCapFlags:
      currentDecision.additionalCapFlags ||
      [],
    shadowAlignedTransitionSize:
      currentDecision.shadowAlignedTransitionSize,
    setupFamily:
      currentAsia2B.setupTemplateLabel,
    p2EdgePosition:
      false,
    transitionLayerP1:
      checked("transitionLayerP1"),
    p3Testable:
      checked("p3ConflictTestable"),
    counterP2Eligible:
      counterP2Info.eligible,
    counterP2Basis:
      counterP2Info.basis,
    counterP2Reason:
      counterP2Info.reason,
    counterP2WeakPermissionPath:
      $("counterP2WeakPermissionPath").value,
    counterP2WeakBreakRetest:
      checked(
        "counterP2WeakBreakRetest"
      ),
    counterP2WeakWorkStructureHeld:
      checked(
        "counterP2WeakWorkStructureHeld"
      ),
    counterP2WeakIndependentSession:
      checked(
        "counterP2WeakIndependentSession"
      ),
    counterP2WeakEquivalentSessionSetup:
      checked(
        "counterP2WeakEquivalentSessionSetup"
      ),
    counterP2WeakFreshSessionSetup:
      counterP2Info.setupInfo?.label || "",
    counterP2WeakHardObstacleR:
      numericInputValue(
        "counterP2WeakHardObstacleR"
      ),
    counterP2WeakNotMatureLeg:
      checked(
        "counterP2WeakNotMatureLeg"
      ),
    counterP2WeakNotNearMainStructure:
      checked(
        "counterP2WeakNotNearMainStructure"
      ),
    htfP1ReversalException:
      checked(
        "htfP1ReversalException"
      ),
    bothTransitionMajorP1:
      checked("bothTransitionMajorP1"),
    bothTransitionP3Testable:
      checked(
        "bothTransitionP3Testable"
      ),

    setupTypeSelected:
      currentAsia2B.selectedSetupType,
    setupType:
      currentAsia2B.effectiveSetupType,
    setupTypeLabel:
      currentAsia2B.effectiveSetupTypeLabel,
    noSweepRejection:
      currentBaseTrigger.noSweepRejection,
    noSweepMicroBreak:
      currentBaseTrigger.noSweepMicroBreak,
    microStructureShift:
      currentBaseTrigger.microStructureShift,
    validBreakout:
      currentBaseTrigger.validBreakout,
    validAcceptance:
      currentBaseTrigger.validAcceptance,
    firstRetest:
      currentBaseTrigger.firstRetest,
    breakoutQuality:
      currentBaseTrigger.breakoutQuality,
    fullRepairComplete:
      currentBaseTrigger.fullRepairComplete,
    fullRepairAsiaSweep:
      currentBaseTrigger.fullRepairAsiaSweep,
    fullRepairEntryOutside:
      currentBaseTrigger.fullRepairEntryOutside,
    fullRepairAcceptedBackInside:
      currentBaseTrigger.fullRepairAcceptedBackInside,
    postOpenAsiaSweep:
      currentBaseTrigger.postOpenAsiaSweep,
    postOpenAfterOpen:
      currentBaseTrigger.postOpenAfterOpen,
    postOpenDriveConfirmed:
      currentBaseTrigger.postOpenDriveConfirmed,
    postOpenPreOpenEntry:
      currentBaseTrigger.postOpenPreOpenEntry,
    openingDriveStatus:
      currentBaseTrigger.openingDriveStatus,
    strongTrendContext:
      currentBaseTrigger.strongTrendContext,
    trueStructureRetest:
      currentBaseTrigger.trueStructureRetest,

    triggerModel:
      currentBaseTrigger.model,
    triggerModelLabel:
      currentBaseTrigger.modelLabel,

    validSweep:
      currentBaseTrigger.validSweep,
    validReclaim:
      currentBaseTrigger.validReclaim,
    reclaimQuality:
      currentBaseTrigger.reclaimQuality,
    retestQuality:
      currentBaseTrigger.retestQuality,
    q2FastRetest:
      currentBaseTrigger.q2FastRetest,
    q2DeepRetest:
      currentBaseTrigger.q2DeepRetest,
    q2StrongRetest:
      currentBaseTrigger.q2StrongRetest,

    tradeSpace:
      currentBaseTrigger.tradeSpace,
    bonusCount:
      currentBaseTrigger.bonusCount,
    bonusDirectRepair:
      currentBaseTrigger.bonusDirectRepair,
    bonusNoDoubleCount:
      currentBaseTrigger.bonusNoDoubleCount,
    triggerBonusUpgraded:
      currentBaseTrigger.bonusUpgraded,

    baseTrigger:
      currentBaseTrigger.preBonusQuality,
    trigger:
      currentAsia2B.effectiveQuality,

    asia2BType:
      currentAsia2B.type,
    asia2BLabel:
      currentAsia2B.label,
    asia2BHighQuality:
      currentAsia2B.highQuality,
    asia2BCriteriaCount:
      currentAsia2B.criteriaCount,
    asia2BNoDoubleSweep:
      checked("asia2BNoDoubleSweep"),
    asia2BStructureOverlap:
      currentAsia2B.structureOverlap,
    asia2BPositionPromoted:
      currentAsia2B.positionPromoted,
    nativeP2Applied:
      currentAsia2B.nativeP2Applied,
    positionTreatment:
      currentAsia2B.positionTreatment,
    asia2BTriggerPromoted:
      currentAsia2B.triggerPromoted,

    secondaryRangePosition:
      $("secondaryState").value === "轉換中－中性"
        ? $("secondaryRangePosition").value
        : "notApplicable",
    rangeSize:
      currentDecision.rangeSize,

    obstacleState:
      currentDecision.obstacleState,
    hasFirstObstacle:
      currentDecision.hasFirstObstacle,
    firstObstacleR:
      currentDecision.firstObstacleR,
    obstacleKind:
      currentDecision.obstacleKind,
    obstacleManagementChoice:
      currentDecision.obstacleManagementChoice ||
      $("obstacleManagementChoice").value,
    obstacleManagementMode:
      currentDecision.obstacleManagementMode,
    obstacleManagement:
      currentDecision.obstacleManagement,
    hardObstacleTreatment:
      currentDecision.hardObstacleTreatment,
    obstacleSpaceBeyond:
      checked("obstacleSpaceBeyond"),
    obstacleRFPlan:
      checked("obstacleRFPlan"),
    obstaclePartialPlan:
      checked("obstaclePartialPlan"),
    obstacleClearTransition:
      checked("obstacleClearTransition"),
    insideMajorObstacle:
      checked("insideMajorObstacle"),
    marketCap:
      currentDecision.marketCap,
    rawMatrixSize:
      currentDecision.rawMatrixSize,
    matrixSize:
      currentDecision.matrixSize,
    positionQualitySize:
      currentDecision.positionQualitySize,
    obstacleSize:
      currentDecision.obstacleSize,
    finalSize:
      currentDecision.finalSize,

    chasedBreakout:
      checked("chasedBreakout"),
    violatesTradingTime:
      checked("violatesTradingTime"),
    riskLimitExceeded:
      checked("riskLimitExceeded"),
    loosenedTriggerBecauseBias:
      checked("loosenedTriggerBecauseBias"),
    emotionalSizing:
      checked("emotionalSizing"),

    openingStoryId:
      $("openingStoryId").value.trim(),
    euAsiaSweepDirection:
      $("euAsiaSweepDirection").value,
    euAsiaSweepTime:
      $("euAsiaSweepTime").value,
    euPorSweepStage:
      $("euPorSweepStage").value,
    euOpeningDriveDirection:
      $("euOpeningDriveDirection").value,
    euBrokeMicroStructure:
      checked("euBrokeMicroStructure"),
    euBrokeMainStructure:
      checked("euBrokeMainStructure"),
    euOpeningRetestMinutes:
      optionalNumberFromInput(
        "euOpeningRetestMinutes"
      ),
    euNewStructureCycle:
      checked("euNewStructureCycle"),
    euRetestDepth:
      $("euRetestDepth").value,
    euRetestEfficiency:
      $("euRetestEfficiency").value,
    obstacleOutcome:
      $("obstacleOutcome").value,

    entryStatus:
      $("entryStatus").value,
    entryTimeQ:
      $("entryTimeQ").value === "Auto"
        ? currentAsia2B.effectiveQuality
        : $("entryTimeQ").value,
    postEntryQ:
      $("postEntryQ").value,
    postEntryAction:
      $("postEntryAction").value,
    tpPlan:
      $("tpPlan").value,
    profitR:
      profitRValue,
    actualR:
      profitRValue,
    normalizedR,
    mfeR:
      optionalNumberFromInput("mfeR"),
    maeR:
      optionalNumberFromInput("maeR"),
    timeToRF:
      timeToRFMinutes,
    validCandidate:
      $("validCandidate").value,
    postEntryObjectiveUpgrade:
      normalizePostEntryObjectiveUpgrade(
        $("postEntryObjectiveUpgrade").value
      ),
    retestInternalStructure:
      normalizeRetestInternalStructure(
        $("retestInternalStructure").value
      ),
    retestVsReclaimStructure:
      normalizeRetestVsReclaimStructure(
        $("retestVsReclaimStructure").value
      ) || "na",
    retestAcceptance:
      normalizeRetestAcceptance(
        $("retestAcceptance").value
      ),
    deepRFTriggered:
      $("deepRFTriggered").value,
    deepRFOriginalSLHit:
      $("deepRFOriginalSLHit").value,
    deepRFShadowMfeR:
      optionalNumberFromInput(
        "deepRFShadowMfeR"
      ),
    deepRFNoRfFinalR:
      optionalNumberFromInput(
        "deepRFNoRfFinalR"
      ),
    reachedRF:
      $("reachedRF").value,
    reachedTP2:
      $("reachedTP2").value,
    hasImage:
      pendingImageBlobs.length > 0,
    imageCount:
      pendingImageBlobs.length,

    checklistSummary:
      checklistSummary(),
    note:
      $("note").value.trim()
  };

  Object.assign(record, attachDualRecord(record));
  const records = loadRecords();
  records.unshift(record);
  saveRecords(records);

  if (pendingImageBlobs.length > 0) {
    try {
      await putImages(
        recordId,
        pendingImageBlobs
      );
    } catch (error) {
      console.error(
        "Image save failed:",
        error
      );

      record.hasImage = false;
      record.imageCount = 0;
      saveRecords(records);
      renderHistory();
      showToast(
        "文字紀錄已儲存，但圖片儲存失敗"
      );
      return;
    }
  }

  clearPendingImage();
  frozenDualTrack = null;
  fillV14Outcome();
  $("v14Entry").value = "";
  $("v14SL").value = "";
  $("v14EntryTime").value = "";
  $("profitR").value = "";
  $("mfeR").value = "";
  $("maeR").value = "";
  $("timeToRF").value = "";
  $("validCandidate").value = "No";
  $("postEntryObjectiveUpgrade").value = "No";
  $("retestInternalStructure").value = "";
  $("retestVsReclaimStructure").value = "na";
  $("retestAcceptance").value = "";
  $("deepRFTriggered").value = "No";
  $("deepRFOriginalSLHit").value = "N/A";
  $("deepRFShadowMfeR").value = "";
  $("deepRFNoRfFinalR").value = "";
  $("entryTimeQ").value = "Auto";
  $("postEntryQ").value = "N/A";
  $("postEntryAction").value = "N/A";
  $("reachedRF").value = "No";
  $("reachedTP2").value = "No";
  $("note").value = "";

  recalculate();
  renderHistory();
  showToast(
    "已儲存雙軌Matrix紀錄"
  );
}

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat(
      "zh-HK",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(new Date(iso));
  } catch {
    return iso;
  }
}

function recordModeLabel(mode) {
  return mode === "Live"
    ? "實戰"
    : "練習";
}

function safeSizeLabel(value) {
  const numeric = Number(value);
  return SIZE_LABELS[numeric] ??
    `${value ?? 0}注`;
}

function updateHistoryBulkControls() {
  const selectedCount =
    selectedHistoryRecordIds.size;

  $("historyBulkActions")
    .classList.toggle(
      "hidden",
      !historySelectionMode
    );

  $("historySelectModeToggle")
    .textContent =
      historySelectionMode
        ? "取消選取模式"
        : "選取多個紀錄";

  $("historySelectModeToggle")
    .setAttribute(
      "aria-pressed",
      historySelectionMode
        ? "true"
        : "false"
    );

  $("historySelectedCount")
    .textContent =
      `已選 ${selectedCount} 筆`;

  $("historyClearSelection")
    .disabled =
      selectedCount === 0;

  $("historyDeleteSelected")
    .disabled =
      selectedCount === 0;

  $("historySelectAllFiltered")
    .disabled =
      currentFilteredHistoryIds.length === 0;

  const everyFilteredSelected =
    currentFilteredHistoryIds.length > 0 &&
    currentFilteredHistoryIds.every(
      (id) =>
        selectedHistoryRecordIds.has(id)
    );

  $("historySelectAllFiltered")
    .textContent =
      everyFilteredSelected
        ? "取消目前結果"
        : "全選目前結果";
}

function setHistorySelectionMode(enabled) {
  historySelectionMode =
    Boolean(enabled);

  if (!historySelectionMode) {
    selectedHistoryRecordIds.clear();
  }

  renderHistory();
}

function toggleHistoryRecordSelection(
  recordId
) {
  if (
    selectedHistoryRecordIds.has(
      recordId
    )
  ) {
    selectedHistoryRecordIds.delete(
      recordId
    );
  } else {
    selectedHistoryRecordIds.add(
      recordId
    );
  }

  renderHistory();
}

function toggleSelectAllFilteredHistory() {
  if (
    currentFilteredHistoryIds.length === 0
  ) {
    return;
  }

  const everyFilteredSelected =
    currentFilteredHistoryIds.every(
      (id) =>
        selectedHistoryRecordIds.has(id)
    );

  currentFilteredHistoryIds.forEach(
    (id) => {
      if (everyFilteredSelected) {
        selectedHistoryRecordIds.delete(
          id
        );
      } else {
        selectedHistoryRecordIds.add(
          id
        );
      }
    }
  );

  renderHistory();
}

function clearHistorySelection() {
  selectedHistoryRecordIds.clear();
  renderHistory();
}

async function deleteSelectedHistoryRecords() {
  const records =
    loadRecords();

  const validSelectedIds =
    new Set(
      records
        .filter(
          (record) =>
            selectedHistoryRecordIds.has(
              record.id
            )
        )
        .map(
          (record) =>
            record.id
        )
    );

  const selectedCount =
    validSelectedIds.size;

  if (selectedCount === 0) {
    showToast(
      "請先選取要刪除嘅紀錄"
    );
    return;
  }

  const confirmed = confirm(
    `確定一拼刪除 ${selectedCount} 筆紀錄？相關文字同全部圖片都會永久刪除。`
  );

  if (!confirmed) return;

  const remaining =
    records.filter(
      (record) =>
        !validSelectedIds.has(
          record.id
        )
    );

  saveRecords(remaining);

  const imageDeleteResults =
    await Promise.allSettled(
      [...validSelectedIds].map(
        (recordId) =>
          deleteImages(recordId)
      )
    );

  const imageDeleteFailures =
    imageDeleteResults.filter(
      (result) =>
        result.status === "rejected"
    ).length;

  selectedHistoryRecordIds.clear();
  historySelectionMode = false;
  renderHistory();

  if (imageDeleteFailures > 0) {
    console.error(
      "Some record images could not be deleted:",
      imageDeleteResults
    );
    showToast(
      `已刪除 ${selectedCount} 筆文字紀錄；有 ${imageDeleteFailures} 筆圖片清理失敗`
    );
    return;
  }

  showToast(
    `已一拼刪除 ${selectedCount} 筆紀錄`
  );
}

function simplifiedObjectiveAtEntry(
  rawObjective,
  shadowClass = ""
) {
  const raw =
    String(
      rawObjective || ""
    ).trim();

  if (
    raw === "Reaction-first" ||
    shadowClass ===
      "Reaction-first / Expansion-eligible"
  ) {
    return "Reaction-first";
  }

  if (raw === "Expansion") {
    return "Expansion";
  }

  if (
    raw === "Reaction" ||
    raw === "Not sure"
  ) {
    return "Reaction";
  }

  return "N/A";
}

function decisionObjectiveAtEntry(
  decision
) {
  if (!decision) {
    return "N/A";
  }

  return simplifiedObjectiveAtEntry(
    decision.objectiveAtEntry ||
      decision.tradeObjective,
    decision.reactionFirstShadowClass
  );
}

function recordObjectiveAtEntry(
  record
) {
  return simplifiedObjectiveAtEntry(
    record?.objectiveAtEntry ||
      record?.tradeObjective,
    record?.reactionFirstShadowClass
  );
}

function normalizePostEntryObjectiveUpgrade(
  value
) {
  const raw =
    String(value || "")
      .trim()
      .toLowerCase();

  return (
    raw === "yes" ||
    raw ===
      "reaction→expansion" ||
    raw ===
      "reaction -> expansion" ||
    raw ===
      "reaction→ expansion"
  )
    ? "Yes"
    : "No";
}

function recordRetestVsReclaimStructure(
  record
) {
  const direct =
    normalizeRetestVsReclaimStructure(
      record?.retestVsReclaimStructure
    );

  if (direct) {
    return direct;
  }

  if (
    normalizeReclaimInternalStructure(
      record?.reclaimInternalStructure
    ) === "none"
  ) {
    return "na";
  }

  return "";
}


function recordChronologyTimestamp(
  record
) {
  const created =
    Date.parse(
      record?.createdAt || ""
    );

  if (
    Number.isFinite(created)
  ) {
    return created;
  }

  const tradeDate =
    String(
      recordTradeDate(record) || ""
    ).trim();

  if (tradeDate) {
    const parsedTradeDate =
      Date.parse(
        `${tradeDate}T00:00:00`
      );

    if (
      Number.isFinite(
        parsedTradeDate
      )
    ) {
      return parsedTradeDate;
    }
  }

  return 0;
}

function recordSequenceMap(
  records
) {
  const sorted =
    [...records].sort(
      (a, b) => {
        const timeDiff =
          recordChronologyTimestamp(a) -
          recordChronologyTimestamp(b);

        if (timeDiff !== 0) {
          return timeDiff;
        }

        const dateDiff =
          String(
            recordTradeDate(a) || ""
          ).localeCompare(
            String(
              recordTradeDate(b) || ""
            )
          );

        if (dateDiff !== 0) {
          return dateDiff;
        }

        return String(
          a?.id || ""
        ).localeCompare(
          String(
            b?.id || ""
          )
        );
      }
    );

  return new Map(
    sorted.map(
      (record, index) => [
        record.id,
        index + 1
      ]
    )
  );
}

function updateHistorySymbolFilter(
  records
) {
  const select =
    $("historySymbolFilter");

  const selected =
    select.value || "All";

  const symbols =
    [...new Set(
      records
        .map(
          (record) =>
            String(
              record.symbol ||
              record.marketCode ||
              ""
            ).trim()
        )
        .filter(Boolean)
    )].sort(
      (a, b) =>
        a.localeCompare(
          b,
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        )
    );

  select.innerHTML = [
    '<option value="All">全部商品</option>',
    ...symbols.map(
      (symbol) =>
        `<option value="${escapeHtml(symbol)}">${escapeHtml(symbol)}</option>`
    )
  ].join("");

  select.value =
    symbols.includes(selected)
      ? selected
      : "All";
}

function historyTradeDateValue(
  record
) {
  const value =
    String(
      recordTradeDate(record) || ""
    ).slice(0, 10);

  if (!value) {
    return null;
  }

  const timestamp =
    Date.parse(
      `${value}T00:00:00`
    );

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;
}

function historySortLabel(
  sortMode
) {
  const labels = {
    "created-desc":
      "紀錄時間 最新→最舊",
    "created-asc":
      "紀錄時間 最舊→最新",
    "trade-date-asc":
      "入場／交易日期 最早→最新",
    "trade-date-desc":
      "入場／交易日期 最新→最早",
    "sequence-asc":
      "紀錄編號 #1→#N",
    "sequence-desc":
      "紀錄編號 #N→#1",
    "symbol-asc":
      "商品 A→Z"
  };

  return (
    labels[sortMode] ||
    labels["created-desc"]
  );
}

function sortHistoryRecords(
  records,
  sortMode,
  sequenceMap
) {
  const sorted =
    [...records];

  const compareMissingLast =
    (
      aValue,
      bValue,
      direction = 1
    ) => {
      const aMissing =
        aValue === null ||
        aValue === undefined;

      const bMissing =
        bValue === null ||
        bValue === undefined;

      if (
        aMissing &&
        bMissing
      ) {
        return 0;
      }

      if (aMissing) {
        return 1;
      }

      if (bMissing) {
        return -1;
      }

      return (
        aValue - bValue
      ) * direction;
    };

  sorted.sort((a, b) => {
    let result = 0;

    if (
      sortMode ===
      "created-asc"
    ) {
      result =
        recordChronologyTimestamp(a) -
        recordChronologyTimestamp(b);
    } else if (
      sortMode ===
      "trade-date-asc"
    ) {
      result =
        compareMissingLast(
          historyTradeDateValue(a),
          historyTradeDateValue(b),
          1
        );
    } else if (
      sortMode ===
      "trade-date-desc"
    ) {
      result =
        compareMissingLast(
          historyTradeDateValue(a),
          historyTradeDateValue(b),
          -1
        );
    } else if (
      sortMode ===
      "sequence-asc"
    ) {
      result =
        (
          sequenceMap.get(a.id) ||
          Number.MAX_SAFE_INTEGER
        ) -
        (
          sequenceMap.get(b.id) ||
          Number.MAX_SAFE_INTEGER
        );
    } else if (
      sortMode ===
      "sequence-desc"
    ) {
      result =
        (
          sequenceMap.get(b.id) ||
          Number.MIN_SAFE_INTEGER
        ) -
        (
          sequenceMap.get(a.id) ||
          Number.MIN_SAFE_INTEGER
        );
    } else if (
      sortMode ===
      "symbol-asc"
    ) {
      result =
        String(
          a.symbol ||
          a.marketCode ||
          ""
        ).localeCompare(
          String(
            b.symbol ||
            b.marketCode ||
            ""
          ),
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        );
    } else {
      result =
        recordChronologyTimestamp(b) -
        recordChronologyTimestamp(a);
    }

    if (result !== 0) {
      return result;
    }

    const sequenceA =
      sequenceMap.get(a.id) || 0;

    const sequenceB =
      sequenceMap.get(b.id) || 0;

    if (
      [
        "created-asc",
        "trade-date-asc",
        "sequence-asc"
      ].includes(sortMode)
    ) {
      return (
        sequenceA -
        sequenceB
      );
    }

    return (
      sequenceB -
      sequenceA
    );
  });

  return sorted;
}

function clearHistoryFilters() {
  $("historyModeFilter").value =
    "All";
  $("historyEntryFilter").value =
    "All";
  $("historySymbolFilter").value =
    "All";
  $("historyDateFrom").value =
    "";
  $("historyDateTo").value =
    "";

  renderHistory();
}

function renderHistory() {
  const allRecords = loadRecords();

  const sequenceMap =
    recordSequenceMap(
      allRecords
    );

  $("statCount").textContent =
    allRecords.length;
  $("statEntry").textContent =
    allRecords.filter(
      (record) =>
        record.productionEntry === "Yes"
    ).length;
  $("statMiss").textContent =
    allRecords.filter(
      (record) =>
        record.entryStatus === "Miss"
    ).length;
  $("statSkip").textContent =
    allRecords.filter(
      (record) =>
        record.entryStatus === "Skip"
    ).length;
  $("statLive").textContent =
    allRecords.filter(
      (record) =>
        record.recordMode === "Live"
    ).length;

  const validCandidates =
    allRecords.filter(
      (record) =>
        record.validCandidate === "Yes"
    ).length;
  $("statValidCandidates").textContent =
    validCandidates;

  const winRateTrades =
    allRecords.filter(
      (record) =>
        record.productionEntry === "Yes" &&
        Number.isFinite(record.profitR) &&
        record.profitR !== 0
    );

  if (winRateTrades.length > 0) {
    const wins =
      winRateTrades.filter(
        (record) =>
          record.profitR > 0
      ).length;

    const winRate =
      wins /
      winRateTrades.length *
      100;

    $("statWinRate").textContent =
      `${winRate.toFixed(1)}%｜${wins}/${winRateTrades.length}`;
  } else {
    $("statWinRate").textContent =
      "未有資料";
  }

  const recordsWithR =
    allRecords.filter(
      (record) =>
        record.productionEntry === "Yes" && Number.isFinite(record.profitR)
    );

  if (recordsWithR.length > 0) {
    const averageR =
      recordsWithR.reduce(
        (sum, record) =>
          sum + record.profitR,
        0
      ) / recordsWithR.length;

    $("statAverageR").textContent =
      averageR.toFixed(2);
  } else {
    $("statAverageR").textContent =
      "未有資料";
  }

  const rfApplicable =
    allRecords.filter(
      (record) =>
        record.productionEntry === "Yes" && record.reachedRF !== "N/A"
    );

  const tp2Applicable =
    allRecords.filter(
      (record) =>
        record.productionEntry === "Yes" && Number.isFinite(record.mfeR)
    );

  if (rfApplicable.length > 0) {
    const rfRate =
      rfApplicable.filter(
        (record) =>
          record.reachedRF === "Yes"
      ).length /
      rfApplicable.length *
      100;

    $("statRFRate").textContent =
      `${rfRate.toFixed(1)}%`;
  } else {
    $("statRFRate").textContent =
      "未有資料";
  }

  if (tp2Applicable.length > 0) {
    const tp2Rate =
      tp2Applicable.filter(
        (record) =>
          record.reachedTP2 === "Yes"
      ).length /
      tp2Applicable.length *
      100;

    $("statTP2Rate").textContent =
      `${tp2Rate.toFixed(1)}%`;
  } else {
    $("statTP2Rate").textContent =
      "未有資料";
  }

  updateHistorySymbolFilter(
    allRecords
  );

  const modeFilter =
    $("historyModeFilter").value;
  const entryFilter =
    $("historyEntryFilter").value;
  const symbolFilter =
    $("historySymbolFilter").value;
  const dateFrom =
    $("historyDateFrom").value;
  const dateTo =
    $("historyDateTo").value;
  const sortMode =
    $("historySort").value ||
    "created-desc";

  const filtered =
    sortHistoryRecords(
      allRecords.filter((record) => {
      const modeMatches =
        modeFilter === "All" ||
        record.recordMode ===
          modeFilter;

      const entryMatches =
        entryFilter === "All" ||
        record.entryStatus ===
          entryFilter;

      const recordSymbol =
        String(
          record.symbol ||
          record.marketCode ||
          ""
        ).trim();

      const symbolMatches =
        symbolFilter === "All" ||
        recordSymbol === symbolFilter;

      const tradeDate =
        String(
          recordTradeDate(record) ||
          ""
        ).slice(0, 10);

      const fromMatches =
        !dateFrom ||
        (
          tradeDate &&
          tradeDate >= dateFrom
        );

      const toMatches =
        !dateTo ||
        (
          tradeDate &&
          tradeDate <= dateTo
        );

      return (
        modeMatches &&
        entryMatches &&
        symbolMatches &&
        fromMatches &&
        toMatches
      );
    }),
      sortMode,
      sequenceMap
    );

  renderDualStats(filtered);
  const activeFilterParts = [];

  if (modeFilter !== "All") {
    activeFilterParts.push(
      modeFilter === "Live"
        ? "實戰"
        : "練習"
    );
  }

  if (entryFilter !== "All") {
    activeFilterParts.push(
      entryFilter
    );
  }

  if (symbolFilter !== "All") {
    activeFilterParts.push(
      symbolFilter
    );
  }

  if (dateFrom || dateTo) {
    activeFilterParts.push(
      `${dateFrom || "最早"} → ${dateTo || "最新"}`
    );
  }

  const sortSummary =
    `排序：${historySortLabel(sortMode)}`;

  $("historyFilterSummary")
    .textContent =
      activeFilterParts.length > 0
        ? `顯示 ${filtered.length}/${allRecords.length} 筆｜${activeFilterParts.join("｜")}｜${sortSummary}`
        : `顯示全部 ${allRecords.length} 筆紀錄｜${sortSummary}`;

  currentFilteredHistoryIds =
    filtered.map(
      (record) =>
        record.id
    );

  const existingRecordIds =
    new Set(
      allRecords.map(
        (record) =>
          record.id
      )
    );

  [...selectedHistoryRecordIds]
    .forEach((recordId) => {
      if (
        !existingRecordIds.has(
          recordId
        )
      ) {
        selectedHistoryRecordIds.delete(
          recordId
        );
      }
    });

  const list =
    $("historyList");

  if (filtered.length === 0) {
    list.innerHTML =
      '<article class="card empty-state">未有符合篩選條件嘅紀錄</article>';
    updateHistoryBulkControls();
    return;
  }

  list.innerHTML =
    filtered.map((record) => {
      const recordNumber =
        sequenceMap.get(
          record.id
        ) || "—";

      const profitText =
        Number.isFinite(record.profitR)
          ? `${record.profitR}R`
          : "未填R";

      const imageCount =
        Number.isFinite(record.imageCount)
          ? record.imageCount
          : record.hasImage
            ? 1
            : 0;

      const imageTag =
        imageCount > 0
          ? `<span class="history-tag">📷 ${imageCount}張圖片</span>`
          : "";

      const twoBTag =
        record.asia2BType &&
        record.asia2BType !== "none"
          ? `<span class="history-tag">${escapeHtml(
              record.asia2BHighQuality
                ? "高質OPR／Asia 2B"
                : "OPR／Asia 2B"
            )}</span>`
          : "";

      const engineTag =
        record.engineVersion
          ? `<span class="history-tag">${escapeHtml(
              record.engineVersion.includes(
                "AllMarkets"
              )
                ? "All-Market Matrix"
                : record.engineVersion.includes(
                    "V3.4-SetupType"
                  )
                  ? "Matrix V3.4"
                : record.engineVersion.includes(
                    "V3.3-SimplifiedDirectionRules"
                  )
                  ? "Matrix V3.3"
                  : record.engineVersion.includes(
                      "V3.2-DirectionPermission"
                    )
                    ? "Matrix V3.2"
                    : record.engineVersion.replace(
                        "MasterTradeDecisionMatrix-",
                        "Matrix "
                      )
            )}</span>`
          : "";

      const triggerModelTag =
        record.engineVersion?.includes(
          "AllMarkets"
        )
          ? `<span class="history-tag">${escapeHtml(
              record.setupTemplateLabel ||
              record.setupTypeLabel ||
              setupTypeLabel(
                record.setupType || "B"
              )
            )}</span>`
          : record.engineVersion?.includes(
              "V3.4-SetupType"
            )
            ? `<span class="history-tag">${escapeHtml(
                record.setupTypeLabel ||
                setupTypeLabel(
                  record.setupType || "B"
                )
              )}</span>`
            : record.engineVersion?.includes(
              "V3.3-SimplifiedDirectionRules"
            )
            ? '<span class="history-tag">精簡方向規則</span>'
            : record.engineVersion?.includes(
                "DirectionPermission"
              )
              ? '<span class="history-tag">Direction Permission</span>'
              : record.triggerModelLabel
                ? `<span class="history-tag">${escapeHtml(
                    record.triggerModel === "B"
                      ? "Model B"
                      : "Model A"
                  )}</span>`
                : "";

      const oprContextTag =
        isHsiOprContinuationRecord(
          record
        ) &&
        (
          record.oprDirectionContextLabel ||
          record.oprDirectionContext
        )
          ? `<span class="history-tag">${escapeHtml(
              record.oprDirectionContextLabel ||
              hsiOprDirectionContextLabel(
                record.oprDirectionContext
              )
            )}</span>`
          : "";

      const p3ContextTag =
        recordRawP(record) === "P3" &&
        recordP3Context(record)
          ? `<span class="history-tag">${escapeHtml(
              p3ContextLabel(
                recordP3Context(record)
              )
            )}</span>`
          : "";

      const mainState =
        record.mainState ||
        "未記錄";
      const secondaryState =
        record.secondaryState ||
        "未記錄";
      const tradeDate =
        recordTradeDate(record) ||
        "未記錄日期";

      const isSelected =
        selectedHistoryRecordIds.has(
          record.id
        );

      const selectionControl =
        historySelectionMode
          ? `
            <span
              class="history-select-indicator"
              aria-hidden="true"
            >${isSelected ? "✓" : ""}</span>
          `
          : "";

      return `
        <article
          class="card history-card${isSelected ? " selected" : ""}${historySelectionMode ? " selection-mode" : ""}"
          data-record-id="${escapeHtml(record.id)}"
          role="${historySelectionMode ? "checkbox" : "button"}"
          aria-checked="${historySelectionMode ? String(isSelected) : "false"}"
          tabindex="0"
        >
          ${selectionControl}
          <div class="history-top">
            <div class="history-record-title">
              <span class="history-record-number">#${escapeHtml(recordNumber)}</span>
              <strong>${escapeHtml(record.symbol)}</strong>
            </div>
            <strong>${escapeHtml(profitText)}</strong>
          </div>

          <div class="history-tags">
            <span class="history-tag">${escapeHtml(
              recordModeLabel(
                record.recordMode
              )
            )}</span>
            <span class="history-tag">${escapeHtml(
              record.marketLabel ||
              record.marketCode ||
              "舊版"
            )}</span>
            <span class="history-tag">${escapeHtml(
              record.entryStatus || "未分類"
            )}</span>
            <span class="history-tag">${escapeHtml(
              record.trigger || "未記錄"
            )}</span>
            ${triggerModelTag}
            ${twoBTag}
            ${engineTag}
            ${oprContextTag}
            ${p3ContextTag}
            ${imageTag}
          </div>

          <p class="history-meta">
            ${escapeHtml(
              record.mainTimeframe || ""
            )}
            ${escapeHtml(mainState)}
            ×
            ${escapeHtml(
              record.secondaryTimeframe || ""
            )}
            ${escapeHtml(secondaryState)}
            <br>
            ${escapeHtml(
              record.direction || ""
            )}
            ｜${escapeHtml(
              record.position ||
              record.basePosition ||
              ""
            )}
            ｜最終${escapeHtml(
              safeSizeLabel(
                record.finalSize
              )
            )}
            <br>
            交易日期：${escapeHtml(tradeDate)}
            <br>
            ${escapeHtml(
              record.relation || ""
            )}
            ｜建立：${escapeHtml(
              formatDate(
                record.createdAt
              )
            )}
          </p>
        </article>
      `;
    }).join("");

  list
    .querySelectorAll(
      "[data-record-id]"
    )
    .forEach((card) => {
      const activateCard = () => {
        const recordId =
          card.dataset.recordId;

        if (historySelectionMode) {
          toggleHistoryRecordSelection(
            recordId
          );
          return;
        }

        openRecord(recordId);
      };

      card.addEventListener(
        "click",
        activateCard
      );

      card.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key !== "Enter" &&
            event.key !== " "
          ) {
            return;
          }

          event.preventDefault();
          activateCard();
        }
      );
    });

  updateHistoryBulkControls();
}

function clearRecordImageDisplay() {
  closeRecordImageLightbox();

  revokeObjectUrls(
    editingImageUrls
  );

  editingImageUrls = [];
  editingImageBlobs = [];

  $("recordImageGallery").innerHTML =
    "";
  $("recordImageCount").textContent =
    "0 張圖片";
  $("recordImageContainer")
    .classList.add("hidden");
}

function renderRecordImageGallery() {
  closeRecordImageLightbox();

  revokeObjectUrls(
    editingImageUrls
  );

  editingImageUrls =
    editingImageBlobs.map(
      (blob) =>
        URL.createObjectURL(blob)
    );

  $("recordImageCount").textContent =
    `${editingImageBlobs.length} 張圖片`;

  $("recordImageContainer")
    .classList.toggle(
      "hidden",
      editingImageBlobs.length === 0
    );

  $("recordImageGallery").innerHTML =
    editingImageUrls
      .map(
        (url, index) => `
          <div class="multi-image-item">
            <img
              src="${url}"
              alt="Stored chart screenshot ${index + 1}"
              data-open-record-image="${index}"
              class="record-gallery-zoomable"
              title="點擊放大"
            >
            <div class="multi-image-item-actions">
              <span>圖片 ${index + 1}</span>
              <div class="multi-image-inline-actions">
                <button
                  type="button"
                  class="secondary-button mini-button"
                  data-download-record-image="${index}"
                >下載</button>
                <button
                  type="button"
                  class="danger-button mini-button"
                  data-remove-record-image="${index}"
                >移除</button>
              </div>
            </div>
          </div>
        `
      )
      .join("");
}

function closeRecordImageLightbox() {
  const dialog =
    $("imageLightboxDialog");

  if (dialog.open) {
    dialog.close();
  }

  $("imageLightboxImage")
    .removeAttribute("src");

  $("imageLightboxCaption")
    .textContent =
      "Chart Screenshot";
}

function openRecordImageLightbox(
  index
) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= editingImageUrls.length
  ) {
    return;
  }

  const url =
    editingImageUrls[index];

  if (!url) return;

  $("imageLightboxImage").src =
    url;

  $("imageLightboxCaption")
    .textContent =
      `圖片 ${index + 1} / ${editingImageUrls.length}`;

  const dialog =
    $("imageLightboxDialog");

  if (!dialog.open) {
    dialog.showModal();
  }
}

function handleImageLightboxBackdropClick(
  event
) {
  const dialog =
    $("imageLightboxDialog");

  if (event.target === dialog) {
    closeRecordImageLightbox();
  }
}

async function displayRecordImage(
  recordId
) {
  clearRecordImageDisplay();

  try {
    editingImageBlobs =
      await getImages(recordId);

    renderRecordImageGallery();
  } catch (error) {
    console.error(
      "Image read failed:",
      error
    );
  }
}

async function openRecord(recordId) {
  const allRecords =
    loadRecords();

  const record =
    allRecords.find(
      (item) =>
        item.id === recordId
    );

  if (!record) return;

  const recordNumber =
    recordSequenceMap(
      allRecords
    ).get(record.id) || "—";

  activeRecordId = recordId;

  $("dialogTitle").textContent =
    `${record.symbol}｜${recordModeLabel(
      record.recordMode
    )}`;

  const basePosition =
    record.basePosition ||
    record.position ||
    "未記錄";
  const effectivePosition =
    record.position ||
    basePosition;
  const baseTrigger =
    record.baseTrigger ||
    record.trigger ||
    "未記錄";
  const effectiveTrigger =
    record.trigger ||
    baseTrigger;

  const twoBText =
    record.asia2BType &&
    record.asia2BType !== "none"
      ? `${record.asia2BLabel || "OPR／Asia 2B"}｜${
          record.asia2BHighQuality
            ? "高質"
            : "未達高質"
        }`
      : "無";

  $("recordDetails").innerHTML = `
    <strong>紀錄編號：</strong>
    #${escapeHtml(recordNumber)}
    <br>
    <strong>交易日期：</strong>
    ${escapeHtml(recordTradeDate(record) || "未記錄")}
    <br>
    <strong>建立時間：</strong>
    ${escapeHtml(formatDate(record.createdAt))}
    <br>
    <strong>引擎：</strong>
    ${escapeHtml(
      record.engineVersion ||
      "舊版Matrix"
    )}
    <br>
    <strong>Frozen Matrix：</strong>
    ${escapeHtml(record.matrixVersion || "舊版／未記錄")}
    <br>
    <strong>Transition Type：</strong>
    ${escapeHtml(record.transitionTypeLabel || record.transitionType || "N/A")}
    <br>
    <strong>Control Alignment：</strong>
    ${escapeHtml(record.controlAlignmentLabel || record.controlAlignment || "N/A")}
    <br>
    <strong>市場：</strong>
    ${escapeHtml(
      record.marketLabel ||
      record.marketCode ||
      "舊版未記錄"
    )}
    <br>
    <strong>交易商品／品種：</strong>
    ${escapeHtml(
      record.symbol ||
      "未記錄"
    )}
    <br>
    <strong>核心Setup：</strong>
    ${escapeHtml(
      record.setupTemplateLabel ||
      record.setupTemplate ||
      "舊版未記錄"
    )}
    <br>
    ${
      isHsiOprContinuationRecord(record)
        ? `<strong>OPR Direction Context：</strong>${escapeHtml(
            record.oprDirectionContextLabel ||
            hsiOprDirectionContextLabel(
              record.oprDirectionContext
            ) ||
            "未記錄"
          )}<br>`
        : ""
    }
    <strong>大局背景：</strong>
    ${escapeHtml(
      record.backgroundTimeframe || ""
    )}－${escapeHtml(
      record.backgroundState || ""
    )}
    <br>
    <strong>主判斷：</strong>
    ${escapeHtml(
      record.mainTimeframe || ""
    )}－${escapeHtml(
      record.mainState || ""
    )}
    <br>
    <strong>次判斷：</strong>
    ${escapeHtml(
      record.secondaryTimeframe || ""
    )}－${escapeHtml(
      record.secondaryState || ""
    )}
    <br>
    <strong>入場觸發層：</strong>
    ${escapeHtml(
      record.entryTimeframe || ""
    )}
    <br>
    <strong>主次關係：</strong>
    ${escapeHtml(
      record.relation || ""
    )}
    <br>
    <strong>交易路線：</strong>
    ${escapeHtml(
      record.marketRoute ||
      record.directionPermission ||
      "舊版未記錄"
    )}
    <br>
    <strong>交易優先方向：</strong>
    ${escapeHtml(
      record.preferredDirection || ""
    )}
    <br>
    <strong>實際方向：</strong>
    ${escapeHtml(
      record.direction || ""
    )}
    <br>
    <strong>Setup Type：</strong>
    ${escapeHtml(
      record.setupTypeLabel ||
      setupTypeLabel(
        record.setupType || "B"
      )
    )}
    <br>
    ${
      record.previousHLSweepSource ||
      record.previousHLSweepSession
        ? `<strong>Previous H/L Sweep：</strong>${escapeHtml(
            record.previousHLSweepSourceLabel ||
            record.previousHLSweepSource ||
            "未記錄"
          )}｜${escapeHtml(
            record.previousHLSweepSessionLabel ||
            record.previousHLSweepSession ||
            "未記錄"
          )}<br>`
        : ""
    }
    ${
      record.marketCode === "XAU"
        ? `<strong>XAU Liquidity：</strong>${escapeHtml(
            record.xauLiquidityRank || "舊版未記錄"
          )}｜${escapeHtml(
            record.xauLiquiditySourceLabel ||
            record.xauLiquiditySource ||
            "未記錄"
          )}｜${escapeHtml(
            record.xauSweepSessionLabel ||
            record.xauSweepSession ||
            "未記錄"
          )}<br><strong>XAU E標記：</strong>${escapeHtml(
            record.xauPositionEdgeLabel ||
            (
              record.xauEdgeMarker
                ? `${basePosition}-${record.xauEdgeMarker}`
                : basePosition
            )
          )}｜${escapeHtml(
            record.xauSetupPriority || "舊版未記錄"
          )}<br>`
        : ""
    }
    <strong>大局實際結構重疊：</strong>
    ${record.backgroundDirectOverlap === "yes" ? "有" : "冇"}
    <br>
    <strong>P1順風：</strong>
    ${record.p1BackgroundTailwind === "valid"
      ? "有｜仍有效"
      : record.p1BackgroundTailwind === "expired"
        ? "曾有｜已失效"
        : record.p1BackgroundTailwind === "yes"
          ? "有｜舊版"
          : "冇"}
    <br>
    <strong>路線細節：</strong>
    ${escapeHtml(
      [
        record.transitionLayerP1
          ? "包含轉換反向P1＝Transition層大位"
          : "",
        record.p3Testable
          ? "衝突順主判P3可小注"
          : "",
        record.counterP2Eligible
          ? `逆主判P2特殊資格（${counterP2BasisLabel(record.counterP2Basis)}）`
          : "",
        record.htfP1ReversalException
          ? "窄義HTF P1反轉例外"
          : "",
        record.bothTransitionMajorP1
          ? "雙轉換P1主要邊界"
          : "",
        record.bothTransitionP3Testable
          ? "雙轉換P3可小注"
          : ""
      ].filter(Boolean).join("／") || "無"
    )}
    <br>
    <strong>逆主判P2資格原因：</strong>
    ${escapeHtml(
      record.counterP2Reason ||
      (
        record.counterP2Eligible
          ? counterP2BasisLabel(
              record.counterP2Basis
            )
          : "冇／舊版未記錄"
      )
    )}
    <br>
    <strong>逆弱主判 Route A／B Confirmation：</strong>
    ${escapeHtml(
      record.counterP2WeakPermissionPath ===
        "weakBreakRetest"
        ? "Route A｜Structure Break Route"
        : record.counterP2WeakPermissionPath ===
            "weakFreshSession"
          ? "Route B｜Fresh Session Confirmation"
          : "冇A／B"
    )}
    <br>
    <strong>路徑B資料：</strong>
    ${escapeHtml(
      record.counterP2Basis ===
        "weakFreshSession" ||
      record.counterP2WeakPermissionPath ===
        "weakFreshSession"
        ? [
            record.counterP2WeakFreshSessionSetup ||
              "其他同級Setup",
            Number.isFinite(
              record.counterP2WeakHardObstacleR
            )
              ? `${record.counterP2WeakHardObstacleR}R`
              : "障礙R未記錄",
            record.counterP2WeakNotMatureLeg
              ? "未到成熟腿尾"
              : "成熟度未確認",
            record.counterP2WeakNotNearMainStructure
              ? "未貼近主判主結"
              : "主結距離未確認"
          ].join("／")
        : "N/A"
    )}
    <br>
    <strong>Raw P → P3 Context → E → Execution P：</strong>
    ${escapeHtml(record.rawP || basePosition)}
    → ${escapeHtml(
      (record.rawP || basePosition) === "P3"
        ? (p3ContextLabel(recordP3Context(record)) || "未分類")
        : "N/A"
    )}
    → ${escapeHtml(record.enhancementLabel || record.enhancement || "None")}
    → ${escapeHtml(record.executionP || effectivePosition)}
    <br>
    <strong>原始位置：</strong>
    ${escapeHtml(basePosition)}
    <br>
    <strong>有效位置待遇：</strong>
    ${escapeHtml(effectivePosition)}
    <br>
    <strong>P待遇來源：</strong>
    ${escapeHtml(
      positionTreatmentLabel(
        record.positionTreatment ||
          (
            record.nativeP2Applied
              ? "nativeP2"
              : record.asia2BPositionPromoted
                ? "p2Effective"
                : "native"
          ),
        basePosition,
        effectivePosition
      )
    )}
    <br>
    <strong>Native Q：</strong>
    ${escapeHtml(record.nativeQ || baseTrigger)}${record.q2Subtype ? `｜${escapeHtml(record.q2Subtype)}` : ""}
    <br>
    <strong>舊版／Execution Q欄：</strong>
    ${escapeHtml(effectiveTrigger)}
    <br>
    <strong>Objective at Entry：</strong>
    ${escapeHtml(recordObjectiveAtEntry(record))}
    <br>
    ${
      Number(record.finalSize) === 0.25
        ? `<strong>0.25 Primary Cap Reason：</strong>${escapeHtml(record.primaryCapReason || "N/A")}<br><strong>Additional Cap Flags：</strong>${escapeHtml(Array.isArray(record.additionalCapFlags) ? (record.additionalCapFlags.join("｜") || "N/A") : (record.additionalCapFlags || "N/A"))}<br>`
        : ""
    }
    <strong>Normalized R：</strong>
    ${formatResearchR(
      Number.isFinite(record.normalizedR)
        ? record.normalizedR
        : normalizedRValue(
            Number.isFinite(record.actualR) ? record.actualR : record.profitR,
            record.finalSize
          )
    )}
    <br>
    <strong>Shadow Research Version：</strong>
    ${escapeHtml(record.shadowResearchVersion || "Legacy／N/A")}
    <br>
    <strong>Aligned Transition Shadow：</strong>
    ${Number.isFinite(record.shadowAlignedTransitionSize) ? escapeHtml(safeSizeLabel(record.shadowAlignedTransitionSize)) + "｜Research only" : "N/A"}
    <br>
    <strong>Range位置：</strong>
    ${escapeHtml(record.secondaryRangePosition || "N/A")}
    <br>
    <strong>Type A／2B：</strong>
    ${escapeHtml(twoBText)}
    <br>
    <strong>Entry-time Q：</strong>
    ${escapeHtml(record.entryTimeQ || "未記錄")}
    <br>
    <strong>Post-entry Q：</strong>
    ${escapeHtml(record.postEntryQ || "N/A")}
    <br>
    <strong>Post-entry處理：</strong>
    ${escapeHtml(record.postEntryAction || "N/A")}
    <br>
    <strong>圖片數量：</strong>
    ${escapeHtml(
      Number.isFinite(record.imageCount)
        ? record.imageCount
        : record.hasImage
          ? 1
          : 0
    )}
    <br>
    <strong>第一障礙：</strong>
    ${escapeHtml(
      Number.isFinite(record.firstObstacleR)
        ? `${record.firstObstacleR}R`
        : "舊版未記錄"
    )}｜${escapeHtml(
      obstacleDisplayLabel(
        record.obstacleState || "standard"
      )
    )}｜${escapeHtml(
      record.obstacleKind || "N/A"
    )}
    <br>
    <strong>障礙管理：</strong>
    ${escapeHtml(
      record.obstacleManagement ||
      record.obstacleManagementMode ||
      "舊版未記錄"
    )}
    <br>
    <strong>Opening Story ID：</strong>
    ${escapeHtml(
      record.openingStoryId || "N/A"
    )}
    <br>
    <strong>障礙管理結果：</strong>
    ${escapeHtml(
      record.obstacleOutcome || "N/A"
    )}
    <br>
    <strong>最終注碼：</strong>
    ${escapeHtml(
      safeSizeLabel(
        record.finalSize
      )
    )}
    <br>
    <strong>第一真實障礙：</strong>
    ${record.hasFirstObstacle || Number.isFinite(record.firstObstacleR)
      ? `${Number.isFinite(record.firstObstacleR) ? `${record.firstObstacleR}R` : "有｜未記距離"}｜${escapeHtml(record.obstacleKind === "hard" ? "重大HTF／Hard" : "普通／Soft")}`
      : "冇"}
    <br>
    <strong>MFE／MAE：</strong>
    ${Number.isFinite(record.mfeR) ? `${record.mfeR}R` : "N/A"}／${Number.isFinite(record.maeR) ? `${record.maeR}R` : "N/A"}
    <br>
    <strong>Time to RF：</strong>
    ${formatDurationMinutes(record.timeToRF)}
    <br>
    <strong>Valid Candidate：</strong>
    ${escapeHtml(record.validCandidate || "No")}
    <br>
    <strong>Post-entry Objective Upgrade：</strong>
    ${escapeHtml(normalizePostEntryObjectiveUpgrade(record.postEntryObjectiveUpgrade))}
    <br>
    <strong>Retest Internal Structure：</strong>
    ${escapeHtml(
      retestInternalStructureLabel(
        normalizeRetestInternalStructure(
          record.retestInternalStructure
        )
      ) ||
      "未記錄"
    )}
    <br>
    <strong>Retest vs Reclaim Structure：</strong>
    ${escapeHtml(
      retestVsReclaimStructureLabel(
        recordRetestVsReclaimStructure(
          record
        )
      ) ||
      "未記錄"
    )}
    <br>
    <strong>Retest Acceptance：</strong>
    ${escapeHtml(
      retestAcceptanceLabel(
        normalizeRetestAcceptance(
          record.retestAcceptance
        )
      ) ||
      "未記錄"
    )}
    <br>
    <strong>Deep-RF Triggered：</strong>
    ${escapeHtml(record.deepRFTriggered || "No")}
    <br>
    <strong>RF後原SL被打：</strong>
    ${escapeHtml(record.deepRFOriginalSLHit || "N/A")}
    <br>
    <strong>RF後 Shadow MFE：</strong>
    ${formatResearchR(record.deepRFShadowMfeR)}
    <br>
    <strong>如果冇RF｜最終結果：</strong>
    ${formatResearchR(record.deepRFNoRfFinalR)}
    ${record.reviewedSession ? `<br><strong>Legacy Reviewed Session：</strong>${escapeHtml(record.reviewedSession)}` : ""}
  `;

  $("editTradeDate").value =
    recordTradeDate(record) ||
    localDateString();

  $("editSymbol").value =
    String(
      record.symbol ||
      record.marketCode ||
      ""
    ).trim();

  $("editRecordMode").value =
    record.recordMode ||
    "Practice";
  $("editEntryStatus").value =
    record.entryStatus ||
    "Entry";

  const editIsHsiC =
    isHsiOprContinuationRecord(
      record
    );

  $("editHsiOprDirectionContextRow")
    .classList.toggle(
      "hidden",
      !editIsHsiC
    );

  $("editHsiOprDirectionContext").value =
    editIsHsiC
      ? (
          record.oprDirectionContext ||
          hsiOprDirectionContextFromLabel(
            record.oprDirectionContextLabel
          ) ||
          ""
        )
      : "";

  const editIsRawP3 =
    recordRawP(record) === "P3";

  $("editP3ContextRow")
    .classList.toggle(
      "hidden",
      !editIsRawP3
    );
  $("editP3ContextNote")
    .classList.toggle(
      "hidden",
      !editIsRawP3
    );
  $("editP3Context").value =
    editIsRawP3
      ? recordP3Context(record)
      : "";

  $("editEntryTimeQ").value =
    record.entryTimeQ ||
    "N/A";
  $("editPostEntryQ").value =
    record.postEntryQ ||
    "N/A";
  $("editPostEntryAction").value =
    record.postEntryAction ||
    "N/A";
  $("editTpPlan").value =
    record.tpPlan ||
    "2R全平";
  $("editProfitR").value =
    Number.isFinite(
      record.profitR
    )
      ? record.profitR
      : "";

  $("editMfeR").value =
    Number.isFinite(record.mfeR)
      ? record.mfeR
      : "";

  $("editMaeR").value =
    Number.isFinite(record.maeR)
      ? record.maeR
      : "";

  $("editTimeToRF").value =
    Number.isFinite(record.timeToRF)
      ? formatDurationMinutes(record.timeToRF)
      : "";

  $("editReachedRF").value =
    record.reachedRF ||
    "No";
  $("editReachedTP2").value =
    record.reachedTP2 ||
    "No";
  $("editValidCandidate").value =
    record.validCandidate === "Yes"
      ? "Yes"
      : "No";

  $("editPostEntryObjectiveUpgrade").value =
    normalizePostEntryObjectiveUpgrade(
      record.postEntryObjectiveUpgrade
    );

  $("editRetestInternalStructure").value =
    normalizeRetestInternalStructure(
      record.retestInternalStructure
    );

  $("editRetestVsReclaimStructure").value =
    recordRetestVsReclaimStructure(
      record
    ) || "na";

  $("editRetestAcceptance").value =
    normalizeRetestAcceptance(
      record.retestAcceptance
    );

  $("editDeepRFTriggered").value =
    record.deepRFTriggered ||
    "No";

  $("editDeepRFOriginalSLHit").value =
    record.deepRFOriginalSLHit ||
    "N/A";

  $("editDeepRFShadowMfeR").value =
    Number.isFinite(
      record.deepRFShadowMfeR
    )
      ? record.deepRFShadowMfeR
      : "";

  $("editDeepRFNoRfFinalR").value =
    Number.isFinite(
      record.deepRFNoRfFinalR
    )
      ? record.deepRFNoRfFinalR
      : "";

  syncObjectiveUpgradeUI(
    true,
    recordObjectiveAtEntry(
      record
    )
  );

  syncDeepRFShadowUI(true);

  renderEditDual(record);
  $("editNote").value =
    record.note || "";

  await displayRecordImage(
    recordId
  );

  $("recordDialog")
    .showModal();
}

async function addEditingImageBlobs(blobs) {
  const validBlobs =
    (Array.isArray(blobs)
      ? blobs
      : [blobs]
    ).filter(
      (blob) =>
        blob instanceof Blob
    );

  if (validBlobs.length === 0) {
    showToast(
      "剪貼簿入面搵唔到圖片"
    );
    return;
  }

  const compressed =
    await Promise.all(
      validBlobs.map(
        (blob) =>
          compressImage(blob)
      )
    );

  editingImageBlobs.push(
    ...compressed
  );

  renderRecordImageGallery();

  showToast(
    `已新增 ${compressed.length} 張圖片；儲存修改後會保存，目前共 ${editingImageBlobs.length} 張`
  );
}

async function handleEditingImagePaste(event) {
  event.preventDefault();

  const blobs =
    clipboardImagesFromPasteEvent(
      event
    );

  await addEditingImageBlobs(
    blobs
  );
}

async function pasteEditingImageFromClipboard() {
  try {
    const blobs =
      await readImagesFromSystemClipboard();

    await addEditingImageBlobs(
      blobs
    );
  } catch (error) {
    console.error(
      "Clipboard image read failed:",
      error
    );

    showToast(
      "未能直接讀取剪貼簿；請點擊貼上區後用系統「貼上」"
    );

    $("editChartPasteZone").focus();
  }
}

function removeEditingImageAt(index) {
  if (
    index < 0 ||
    index >= editingImageBlobs.length
  ) {
    return;
  }

  editingImageBlobs.splice(
    index,
    1
  );

  renderRecordImageGallery();

  showToast(
    "圖片已由編輯清單移除；儲存修改後正式生效"
  );
}

function requestRemoveStoredImage() {
  editingImageBlobs = [];
  renderRecordImageGallery();

  showToast(
    "已移除全部圖片；儲存修改後正式生效"
  );
}

function triggerImageDownload(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(blob);
  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body
    .appendChild(link);
  link.click();
  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1000
  );
}

function downloadEditingImageAt(index) {
  const blob =
    editingImageBlobs[index];

  if (!blob) {
    showToast(
      "搵唔到呢張圖片"
    );
    return;
  }

  const record =
    loadRecords().find(
      (item) =>
        item.id ===
        activeRecordId
    );

  triggerImageDownload(
    blob,
    `${record?.symbol || "Trade"}-${activeRecordId}-image-${index + 1}.jpg`
  );
}

async function saveRecordEdit() {
  const records = loadRecords();
  const index =
    records.findIndex(
      (item) =>
        item.id ===
        activeRecordId
    );

  if (index === -1) return;

  const editedSymbol =
    $("editSymbol").value
      .trim()
      .toUpperCase();

  if (!editedSymbol) {
    showToast(
      "請輸入交易商品／品種"
    );
    $("editSymbol").focus();
    return;
  }

  const editedTimeToRF =
    durationMinutesFromInput(
      "editTimeToRF"
    );

  if (
    Number.isNaN(editedTimeToRF)
  ) {
    showToast(
      "Time to RF格式錯誤；請輸入例如11H45M、2H或45M"
    );
    $("editTimeToRF").focus();
    return;
  }

  if (!(records[index].finalSize > 0) && $('editEntryStatus').value === 'Entry') {
    showToast('Production Size = 0，Production Entry 必須 No。'); return;
  }
  if (!(records[index].finalSize > 0) && optionalNumberFromInput('editProfitR') !== null && optionalNumberFromInput('editProfitR') !== 0) {
    showToast('Production = 0；假設結果請填 Shadow Outcome。'); return;
  }

  records[index].tradeDate =
    $("editTradeDate").value ||
    recordTradeDate(records[index]) ||
    localDateString();
  records[index].symbol =
    editedSymbol;
  records[index].recordMode =
    $("editRecordMode").value;
  records[index].entryStatus =
    $("editEntryStatus").value;

  if (
    recordRawP(
      records[index]
    ) === "P3"
  ) {
    records[index].p3Context =
      $("editP3Context").value;
  }

  if (
    isHsiOprContinuationRecord(
      records[index]
    )
  ) {
    records[index].oprDirectionContext =
      $("editHsiOprDirectionContext").value;
    records[index].oprDirectionContextLabel =
      hsiOprDirectionContextLabel(
        records[index].oprDirectionContext
      );
  } else {
    records[index].oprDirectionContext =
      "";
    records[index].oprDirectionContextLabel =
      "";
  }

  records[index].entryTimeQ =
    $("editEntryTimeQ").value;
  records[index].postEntryQ =
    $("editPostEntryQ").value;
  records[index].postEntryAction =
    $("editPostEntryAction").value;
  records[index].tpPlan =
    $("editTpPlan").value;
  records[index].profitR =
    optionalNumberFromInput(
      "editProfitR"
    );
  records[index].actualR =
    records[index].profitR;
  records[index].normalizedR =
    normalizedRValue(
      records[index].actualR,
      records[index].finalSize
    );
  records[index].mfeR =
    optionalNumberFromInput(
      "editMfeR"
    );
  records[index].maeR =
    optionalNumberFromInput(
      "editMaeR"
    );
  records[index].timeToRF =
    editedTimeToRF;
  records[index].reachedRF =
    $("editReachedRF").value;
  records[index].reachedTP2 =
    $("editReachedTP2").value;
  records[index].validCandidate =
    $("editValidCandidate").value;
  records[index].postEntryObjectiveUpgrade =
    normalizePostEntryObjectiveUpgrade(
      $("editPostEntryObjectiveUpgrade").value
    );
  records[index].retestInternalStructure =
    normalizeRetestInternalStructure(
      $("editRetestInternalStructure").value
    );
  records[index].retestVsReclaimStructure =
    normalizeRetestVsReclaimStructure(
      $("editRetestVsReclaimStructure").value
    ) || "na";
  records[index].retestAcceptance =
    normalizeRetestAcceptance(
      $("editRetestAcceptance").value
    );

  records[index].deepRFTriggered =
    $("editDeepRFTriggered").value;
  records[index].deepRFOriginalSLHit =
    $("editDeepRFOriginalSLHit").value;
  records[index].deepRFShadowMfeR =
    optionalNumberFromInput(
      "editDeepRFShadowMfeR"
    );
  records[index].deepRFNoRfFinalR =
    optionalNumberFromInput(
      "editDeepRFNoRfFinalR"
    );
  records[index].note =
    $("editNote").value.trim();
  if (records[index].dualTrackSnapshot) records[index].v14Outcome = readV14Outcome('edit');
  records[index] = Shadow.normalizeRecord(records[index]);

  try {
    if (
      editingImageBlobs.length > 0
    ) {
      await putImages(
        activeRecordId,
        editingImageBlobs
      );
    } else {
      await deleteImages(
        activeRecordId
      );
    }

    records[index].hasImage =
      editingImageBlobs.length > 0;
    records[index].imageCount =
      editingImageBlobs.length;
  } catch (error) {
    console.error(
      "Image update failed:",
      error
    );

    showToast(
      "圖片修改失敗，文字資料未變"
    );
    return;
  }

  saveRecords(records);
  $("recordDialog").close();
  clearRecordImageDisplay();
  renderHistory();
  showToast("已儲存修改");
}

async function deleteActiveRecord() {
  if (!activeRecordId) return;

  const confirmed = confirm(
    "確定刪除呢筆紀錄？文字同全部圖片都會刪除。"
  );

  if (!confirmed) return;

  const remaining =
    loadRecords().filter(
      (record) =>
        record.id !==
        activeRecordId
    );

  saveRecords(remaining);

  try {
    await deleteImages(
      activeRecordId
    );
  } catch (error) {
    console.error(
      "Image delete failed:",
      error
    );
  }

  $("recordDialog").close();
  clearRecordImageDisplay();
  renderHistory();
  showToast("已刪除紀錄");
}

async function downloadActiveRecordImage() {
  if (!activeRecordId) return;

  if (
    editingImageBlobs.length === 0
  ) {
    showToast(
      "呢筆紀錄冇圖片"
    );
    return;
  }

  const record =
    loadRecords().find(
      (item) =>
        item.id ===
        activeRecordId
    );

  editingImageBlobs.forEach(
    (blob, index) => {
      setTimeout(
        () => {
          triggerImageDownload(
            blob,
            `${record?.symbol || "Trade"}-${activeRecordId}-image-${index + 1}.jpg`
          );
        },
        index * 180
      );
    }
  );

  showToast(
    `開始下載 ${editingImageBlobs.length} 張圖片`
  );
}

function csvEscape(value) {
  const string =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  return `"${string.replaceAll('"', '""')}"`;
}

function buildCsv(records) {
  records = records.map(Shadow.normalizeRecord);
  const headers = [
    "紀錄ID",
    "交易日期",
    "建立時間",
    "App版本",
    "Matrix版本",
    "類型",
    "市場分類",
    "市場名稱",
    "品種",
    "核心Setup",
    "Setup代碼",
    "Setup子類型",
    "OPR Direction Context",
    "Previous H/L來源代碼",
    "Previous H/L來源",
    "Previous H/L Sweep Session代碼",
    "Previous H/L Sweep Session",
    "XAU Liquidity來源代碼",
    "XAU Liquidity來源",
    "XAU Sweep時段代碼",
    "XAU Sweep時段",
    "XAU Liquidity級別",
    "XAU E標記",
    "XAU P＋E顯示",
    "XAU Setup優先級",
    "大局背景TF",
    "大局背景狀態",
    "主判TF",
    "主判狀態",
    "次判TF",
    "次判狀態",
    "入場觸發TF",
    "交易方向",
    "主次關係",
    "交易路線",
    "交易優先方向",
    "大局方向關係",
    "大局實際結構重疊",
    "P1順風",
    "原始位置",
    "有效位置",
    "窄義HTF P1反轉例外",
    "主判Transition反向P1",
    "衝突順主判P3可小注",
    "逆主判P2特殊資格",
    "逆主判P2資格基礎",
    "逆主判P2資格原因",
    "逆弱主判Route A/B",
    "主判弱勢次結突破首次Retest",
    "路徑B主判工作結構突破維持",
    "路徑B獨立Session催化",
    "路徑B其他同級Setup",
    "路徑B識別Setup",
    "路徑B硬障礙R",
    "路徑B未到成熟腿尾",
    "路徑B未貼近主判主結",
    "雙轉換P1主要邊界",
    "雙轉換P3可小注",
    "Setup Type選擇",
    "有效Setup Type",
    "No Sweep P1 Rejection",
    "微結構／控制權轉移",
    "有效Sweep",
    "有效Reclaim",
    "Sweep／Reclaim質素",
    "有效Breakout",
    "有效Acceptance",
    "第一次Retest",
    "Breakout／Acceptance質素",
    "Full Repair完整",
    "Full Repair Asia Sweep",
    "Full Repair入場POR外",
    "POR內重新Acceptance",
    "EU-D Asia Sweep",
    "EU-D正式開市後確認",
    "EU-D Opening Drive確認",
    "EU-D開市前直接入場",
    "Opening Drive有效期",
    "強趨勢Context",
    "真正結構Retest",
    "Retest質素",
    "交易空間",
    "第一障礙R",
    "障礙類型",
    "障礙管理模式",
    "硬障礙處理",
    "障礙後有2R空間",
    "到障礙推RF計劃",
    "部分食糊計劃",
    "明確結構轉換Context",
    "Opening Story ID",
    "Asia Sweep方向",
    "Asia Sweep時間",
    "POR Sweep階段",
    "Opening Drive方向",
    "EU記錄破微結構",
    "EU記錄破15M／1H主結",
    "Opening Drive至Retest分鐘",
    "已完成新結構循環",
    "EU Retest深度",
    "EU Retest推進效率",
    "障礙管理結果",
    "基礎Q",
    "最終Q",
    "Type A方向",
    "Type A高質",
    "Type A條件數",
    "P2-effective待遇",
    "原生P2套用",
    "P待遇來源",
    "Type A Q升級",
    "次判Range位置",
    "Range修正後",
    "大局障礙",
    "市場關係上限",
    "P×Q／方向Matrix",
    "大局修正",
    "最終注碼",
    "入市結果",
    "Entry-time Q",
    "Post-entry Q",
    "Post-entry處理",
    "TP計劃",
    "獲利R",
    "去到RF",
    "去到TP2",
    "有圖片",
    "圖片數量",
    "方向偏見標籤",
    "情緒加注標籤",
    "Frozen Matrix Version",
    "Transition Type V1.3",
    "Control Alignment V1.3",
    "Raw P V1.3",
    "P3 Context",
    "Enhancement E V1.3",
    "Execution P V1.3",
    "Native Q V1.3",
    "Q2 Subtype V1.3",
    "Aligned Transition Shadow Size",
    "Setup Family V1.3",
    "MFE R",
    "MAE R",
    "Time to RF",
    "Actual R",
    "Reviewed Session",
    "Valid Candidate",
    "Shadow Research Version",
    "0.25 Primary Cap Reason",
    "0.25 Additional Cap Flags",
    "Normalized R",
    "Objective at Entry",
    "Post-entry Objective Upgrade",
    "Retest Internal Structure",
    "Retest vs Reclaim Structure",
    "Retest Acceptance",
    "Deep-RF Triggered",
    "Deep-RF RF後原SL被打",
    "Deep-RF Shadow MFE R",
    "Deep-RF No-RF Final R",
    "Checklist",
    "備註",
    ...DUAL_COLUMNS.map(([label]) => label)
  ];

  const rows =
    records.map((record) => [
      record.id || "",
      recordTradeDate(record),
      record.createdAt || "",
      record.appVersion || "",
      record.engineVersion || "",
      record.recordMode || "",
      record.marketCode || "",
      record.marketLabel || "",
      record.symbol || "",
      record.setupTemplateLabel ||
        record.setupTemplate ||
        "",
      record.setupTemplate || "",
      record.setupVariant || "",
      record.oprDirectionContextLabel ||
        hsiOprDirectionContextLabel(
          record.oprDirectionContext
        ) ||
        "",
      record.previousHLSweepSource || "",
      record.previousHLSweepSourceLabel || "",
      record.previousHLSweepSession || "",
      record.previousHLSweepSessionLabel || "",
      record.xauLiquiditySource || "",
      record.xauLiquiditySourceLabel || "",
      record.xauSweepSession || "",
      record.xauSweepSessionLabel || "",
      record.xauLiquidityRank || "",
      record.xauEdgeMarker || "",
      record.xauPositionEdgeLabel || "",
      record.xauSetupPriority || "",
      record.backgroundTimeframe || "",
      record.backgroundState || "",
      record.mainTimeframe || "",
      record.mainState || "",
      record.secondaryTimeframe || "",
      record.secondaryState || "",
      record.entryTimeframe || "",
      record.direction || "",
      record.relation || "",
      record.marketRoute ||
        record.directionPermission ||
        "",
      record.preferredDirection || "",
      record.backgroundRelation || "",
      record.backgroundDirectOverlap ===
        "yes"
        ? "有"
        : "冇",
      record.p1BackgroundTailwind ===
        "valid"
        ? "有｜仍有效"
        : record.p1BackgroundTailwind ===
            "expired"
          ? "曾有｜已失效"
          : "冇",
      record.basePosition ||
        record.position ||
        "",
      record.position ||
        record.basePosition ||
        "",
      record.htfP1ReversalException
        ? "Yes"
        : "No",
      record.transitionLayerP1
        ? "Yes"
        : "No",
      record.p3Testable
        ? "Yes"
        : "No",
      record.counterP2Eligible
        ? "Yes"
        : "No",
      record.counterP2Basis || "",
      record.counterP2Reason || "",
      record.counterP2WeakPermissionPath || "",
      record.counterP2WeakBreakRetest
        ? "Yes"
        : "No",
      record.counterP2WeakWorkStructureHeld
        ? "Yes"
        : "No",
      record.counterP2WeakIndependentSession
        ? "Yes"
        : "No",
      record.counterP2WeakEquivalentSessionSetup
        ? "Yes"
        : "No",
      record.counterP2WeakFreshSessionSetup || "",
      Number.isFinite(
        record.counterP2WeakHardObstacleR
      )
        ? record.counterP2WeakHardObstacleR
        : "",
      record.counterP2WeakNotMatureLeg
        ? "Yes"
        : "No",
      record.counterP2WeakNotNearMainStructure
        ? "Yes"
        : "No",
      record.bothTransitionMajorP1
        ? "Yes"
        : "No",
      record.bothTransitionP3Testable
        ? "Yes"
        : "No",
      record.setupTypeSelected ||
        record.setupType ||
        "",
      record.setupType || "",
      record.noSweepRejection
        ? "Yes"
        : "No",
      record.microStructureShift ||
      record.noSweepMicroBreak
        ? "Yes"
        : "No",
      record.validSweep
        ? "Yes"
        : "No",
      record.validReclaim
        ? "Yes"
        : "No",
      record.reclaimQuality || "",
      record.validBreakout
        ? "Yes"
        : "No",
      record.validAcceptance
        ? "Yes"
        : "No",
      record.firstRetest
        ? "Yes"
        : "No",
      record.breakoutQuality || "",
      record.fullRepairComplete
        ? "Yes"
        : "No",
      record.fullRepairAsiaSweep
        ? "Yes"
        : "No",
      record.fullRepairEntryOutside
        ? "Yes"
        : "No",
      record.fullRepairAcceptedBackInside
        ? "Yes"
        : "No",
      record.postOpenAsiaSweep
        ? "Yes"
        : "No",
      record.postOpenAfterOpen
        ? "Yes"
        : "No",
      record.postOpenDriveConfirmed
        ? "Yes"
        : "No",
      record.postOpenPreOpenEntry
        ? "Yes"
        : "No",
      record.openingDriveStatus || "",
      record.strongTrendContext
        ? "Yes"
        : "No",
      record.trueStructureRetest
        ? "Yes"
        : "No",
      record.retestQuality || "",
      record.tradeSpace || "",
      Number.isFinite(
        record.firstObstacleR
      )
        ? record.firstObstacleR
        : "",
      record.obstacleKind || "",
      record.obstacleManagementMode || "",
      record.hardObstacleTreatment || "",
      record.obstacleSpaceBeyond
        ? "Yes"
        : "No",
      record.obstacleRFPlan
        ? "Yes"
        : "No",
      record.obstaclePartialPlan
        ? "Yes"
        : "No",
      record.obstacleClearTransition
        ? "Yes"
        : "No",
      record.openingStoryId || "",
      record.euAsiaSweepDirection || "",
      record.euAsiaSweepTime || "",
      record.euPorSweepStage || "",
      record.euOpeningDriveDirection || "",
      record.euBrokeMicroStructure
        ? "Yes"
        : "No",
      record.euBrokeMainStructure
        ? "Yes"
        : "No",
      Number.isFinite(
        record.euOpeningRetestMinutes
      )
        ? record.euOpeningRetestMinutes
        : "",
      record.euNewStructureCycle
        ? "Yes"
        : "No",
      record.euRetestDepth || "",
      record.euRetestEfficiency || "",
      record.obstacleOutcome || "N/A",
      record.baseTrigger ||
        record.trigger ||
        "",
      record.trigger ||
        record.baseTrigger ||
        "",
      record.asia2BLabel || "",
      record.asia2BHighQuality
        ? "Yes"
        : "No",
      record.asia2BCriteriaCount ??
        "",
      record.asia2BPositionPromoted
        ? "Yes"
        : "No",
      record.nativeP2Applied
        ? "Yes"
        : "No",
      record.positionTreatment ||
        (
          record.nativeP2Applied
            ? "nativeP2"
            : record.asia2BPositionPromoted
              ? "p2Effective"
              : "native"
        ),
      record.asia2BTriggerPromoted
        ? "Yes"
        : "No",
      record.secondaryRangePosition ||
        "notApplicable",
      record.rangeSize ??
        record.matrixSize ??
        "",
      obstacleDisplayLabel(
        record.obstacleState ||
        "standard"
      ),
      record.marketCap ?? "",
      record.rawMatrixSize ??
        record.matrixSize ??
        "",
      record.obstacleSize ??
        record.finalSize ??
        "",
      record.finalSize ?? "",
      record.entryStatus || "",
      record.entryTimeQ || "",
      record.postEntryQ || "",
      record.postEntryAction || "",
      record.tpPlan || "",
      Number.isFinite(record.profitR)
        ? record.profitR
        : "",
      record.reachedRF || "",
      record.reachedTP2 || "",
      record.hasImage
        ? "Yes"
        : "No",
      Number.isFinite(
        record.imageCount
      )
        ? record.imageCount
        : record.hasImage
          ? 1
          : 0,
      record.loosenedTriggerBecauseBias
        ? "Yes"
        : "No",
      record.emotionalSizing
        ? "Yes"
        : "No",
      record.matrixVersion || "",
      record.transitionTypeLabel || record.transitionType || "",
      record.controlAlignmentLabel || record.controlAlignment || "",
      record.rawP || record.basePosition || "",
      recordRawP(record) === "P3"
        ? recordP3Context(record)
        : "",
      record.enhancementLabel || record.enhancement || "",
      record.executionP || record.position || "",
      record.nativeQ || record.baseTrigger || record.trigger || "",
      record.q2Subtype || "",
      Number.isFinite(record.shadowAlignedTransitionSize)
        ? record.shadowAlignedTransitionSize
        : "",
      record.setupFamily || record.setupTemplateLabel || "",
      Number.isFinite(record.mfeR) ? record.mfeR : "",
      Number.isFinite(record.maeR) ? record.maeR : "",
      Number.isFinite(record.timeToRF) ? record.timeToRF : "",
      Number.isFinite(record.actualR)
        ? record.actualR
        : Number.isFinite(record.profitR)
          ? record.profitR
          : "",
      record.reviewedSession || "",
      record.validCandidate || "No",
      record.shadowResearchVersion || "",
      record.primaryCapReason || "",
      Array.isArray(record.additionalCapFlags)
        ? record.additionalCapFlags.join("｜")
        : record.additionalCapFlags || "",
      Number.isFinite(record.normalizedR)
        ? record.normalizedR
        : Number.isFinite(
            normalizedRValue(
              Number.isFinite(record.actualR)
                ? record.actualR
                : record.profitR,
              record.finalSize
            )
          )
          ? normalizedRValue(
              Number.isFinite(record.actualR)
                ? record.actualR
                : record.profitR,
              record.finalSize
            )
          : "",
      recordObjectiveAtEntry(
        record
      ),
      normalizePostEntryObjectiveUpgrade(
        record.postEntryObjectiveUpgrade
      ),
      retestInternalStructureLabel(
        normalizeRetestInternalStructure(
          record.retestInternalStructure
        )
      ),
      retestVsReclaimStructureLabel(
        recordRetestVsReclaimStructure(
          record
        )
      ),
      retestAcceptanceLabel(
        normalizeRetestAcceptance(
          record.retestAcceptance
        )
      ),
      record.deepRFTriggered || "No",
      record.deepRFOriginalSLHit || "N/A",
      Number.isFinite(record.deepRFShadowMfeR)
        ? record.deepRFShadowMfeR
        : "",
      Number.isFinite(record.deepRFNoRfFinalR)
        ? record.deepRFNoRfFinalR
        : "",
      record.checklistSummary || "",
      record.note || "",
      ...dualCsvValues(record)
    ]);

  return [headers, ...rows]
    .map(
      (row) =>
        row
          .map(csvEscape)
          .join(",")
    )
    .join("\n");
}

function downloadBlob(blob, filename) {
  const url =
    URL.createObjectURL(blob);
  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body
    .appendChild(link);
  link.click();
  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1000
  );
}

function exportCsv() {
  const records = loadRecords();

  if (records.length === 0) {
    showToast(
      "未有紀錄可以匯出"
    );
    return;
  }

  const csv =
    buildCsv(records);

  const blob =
    new Blob(
      ["\uFEFF", csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  downloadBlob(
    blob,
    `MasterTrade-AllMarkets-Journal-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
  );

  showToast(
    "CSV已匯出"
  );
}

const ZIP_CRC_TABLE = (() => {
  const table =
    new Uint32Array(256);

  for (
    let number = 0;
    number < 256;
    number += 1
  ) {
    let value = number;

    for (
      let bit = 0;
      bit < 8;
      bit += 1
    ) {
      value =
        value & 1
          ? 0xEDB88320 ^
            (value >>> 1)
          : value >>> 1;
    }

    table[number] =
      value >>> 0;
  }

  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;

  for (const byte of bytes) {
    crc =
      ZIP_CRC_TABLE[
        (crc ^ byte) & 0xFF
      ] ^
      (crc >>> 8);
  }

  return (
    crc ^ 0xFFFFFFFF
  ) >>> 0;
}

function concatUint8Arrays(parts) {
  const totalLength =
    parts.reduce(
      (sum, part) =>
        sum + part.length,
      0
    );

  const result =
    new Uint8Array(
      totalLength
    );

  let offset = 0;

  for (const part of parts) {
    result.set(
      part,
      offset
    );
    offset += part.length;
  }

  return result;
}

function dosDateTime(date = new Date()) {
  const year =
    Math.max(
      1980,
      date.getFullYear()
    );

  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();

  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(
      date.getSeconds() / 2
    );

  return {
    dosDate,
    dosTime
  };
}

async function toUint8Array(value) {
  if (
    value instanceof Uint8Array
  ) {
    return value;
  }

  if (
    value instanceof ArrayBuffer
  ) {
    return new Uint8Array(
      value
    );
  }

  if (value instanceof Blob) {
    return new Uint8Array(
      await value.arrayBuffer()
    );
  }

  return new TextEncoder()
    .encode(
      String(value ?? "")
    );
}

async function buildStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const nameBytes =
      new TextEncoder()
        .encode(entry.name);

    const data =
      await toUint8Array(
        entry.data
      );

    const crc =
      crc32(data);

    const {
      dosDate,
      dosTime
    } = dosDateTime(
      entry.date ||
      new Date()
    );

    const localHeader =
      new Uint8Array(
        30 + nameBytes.length
      );

    const localView =
      new DataView(
        localHeader.buffer
      );

    localView.setUint32(
      0,
      0x04034B50,
      true
    );
    localView.setUint16(
      4,
      20,
      true
    );
    localView.setUint16(
      6,
      0x0800,
      true
    );
    localView.setUint16(
      8,
      0,
      true
    );
    localView.setUint16(
      10,
      dosTime,
      true
    );
    localView.setUint16(
      12,
      dosDate,
      true
    );
    localView.setUint32(
      14,
      crc,
      true
    );
    localView.setUint32(
      18,
      data.length,
      true
    );
    localView.setUint32(
      22,
      data.length,
      true
    );
    localView.setUint16(
      26,
      nameBytes.length,
      true
    );
    localView.setUint16(
      28,
      0,
      true
    );
    localHeader.set(
      nameBytes,
      30
    );

    localParts.push(
      localHeader,
      data
    );

    const centralHeader =
      new Uint8Array(
        46 + nameBytes.length
      );

    const centralView =
      new DataView(
        centralHeader.buffer
      );

    centralView.setUint32(
      0,
      0x02014B50,
      true
    );
    centralView.setUint16(
      4,
      20,
      true
    );
    centralView.setUint16(
      6,
      20,
      true
    );
    centralView.setUint16(
      8,
      0x0800,
      true
    );
    centralView.setUint16(
      10,
      0,
      true
    );
    centralView.setUint16(
      12,
      dosTime,
      true
    );
    centralView.setUint16(
      14,
      dosDate,
      true
    );
    centralView.setUint32(
      16,
      crc,
      true
    );
    centralView.setUint32(
      20,
      data.length,
      true
    );
    centralView.setUint32(
      24,
      data.length,
      true
    );
    centralView.setUint16(
      28,
      nameBytes.length,
      true
    );
    centralView.setUint16(
      30,
      0,
      true
    );
    centralView.setUint16(
      32,
      0,
      true
    );
    centralView.setUint16(
      34,
      0,
      true
    );
    centralView.setUint16(
      36,
      0,
      true
    );
    centralView.setUint32(
      38,
      0,
      true
    );
    centralView.setUint32(
      42,
      localOffset,
      true
    );
    centralHeader.set(
      nameBytes,
      46
    );

    centralParts.push(
      centralHeader
    );

    localOffset +=
      localHeader.length +
      data.length;

    centralSize +=
      centralHeader.length;
  }

  const endRecord =
    new Uint8Array(22);
  const endView =
    new DataView(
      endRecord.buffer
    );

  endView.setUint32(
    0,
    0x06054B50,
    true
  );
  endView.setUint16(
    4,
    0,
    true
  );
  endView.setUint16(
    6,
    0,
    true
  );
  endView.setUint16(
    8,
    entries.length,
    true
  );
  endView.setUint16(
    10,
    entries.length,
    true
  );
  endView.setUint32(
    12,
    centralSize,
    true
  );
  endView.setUint32(
    16,
    localOffset,
    true
  );
  endView.setUint16(
    20,
    0,
    true
  );

  return new Blob(
    [
      concatUint8Arrays(
        localParts
      ),
      concatUint8Arrays(
        centralParts
      ),
      endRecord
    ],
    {
      type:
        "application/zip"
    }
  );
}

function safeZipSegment(value) {
  const cleaned =
    String(value ?? "")
      .trim()
      .replace(
        /[\\/:*?"<>|\x00-\x1F]/g,
        "_"
      )
      .replace(
        /\s+/g,
        "_"
      );

  return (
    cleaned ||
    "unknown"
  ).slice(
    0,
    80
  );
}

function imageExtension(blob) {
  if (
    blob.type ===
    "image/png"
  ) {
    return "png";
  }

  if (
    blob.type ===
    "image/webp"
  ) {
    return "webp";
  }

  return "jpg";
}

async function exportBackupZip() {
  const records = loadRecords();

  if (records.length === 0) {
    showToast(
      "未有紀錄可以匯出"
    );
    return;
  }

  $("exportBackupZip").disabled =
    true;
  $("exportBackupZip").textContent =
    "整理緊…";

  try {
    showToast(
      "正在整理CSV同照片…"
    );

    const csv =
      buildCsv(records);

    const entries = [
      {
        name:
          "trades.csv",
        data:
          `\uFEFF${csv}`
      },
      {
        name:
          "records.json",
        data:
          JSON.stringify(
            records,
            null,
            2
          )
      }
    ];

    let totalImages = 0;

    for (
      const record of records
    ) {
      const images =
        await getImages(
          record.id
        );

      if (
        images.length === 0
      ) {
        continue;
      }

      const folder =
        [
          safeZipSegment(
            recordTradeDate(record)
          ),
          safeZipSegment(
            record.symbol
          ),
          safeZipSegment(
            record.id
          )
        ].join("_");

      images.forEach(
        (blob, index) => {
          totalImages += 1;

          entries.push({
            name:
              `images/${folder}/image-${index + 1}.${imageExtension(blob)}`,
            data:
              blob
          });
        }
      );
    }

    const backupInfo = [
      "Master Trade Practice & Live Journal Backup",
      "",
      `Exported: ${new Date().toISOString()}`,
      `Records: ${records.length}`,
      `Images: ${totalImages}`,
      "",
      "records.json contains the exact journal records for full restore.",
      "trades.csv contains a spreadsheet-friendly copy of the journal records.",
      "images/ contains chart screenshots grouped by trade date, symbol and record ID."
    ].join("\n");

    entries.push({
      name:
        "backup-info.txt",
      data:
        backupInfo
    });

    const zipBlob =
      await buildStoredZip(
        entries
      );

    downloadBlob(
      zipBlob,
      `MasterTrade-AllMarkets-Backup-${new Date()
        .toISOString()
        .slice(0, 10)}.zip`
    );

    showToast(
      `已匯出ZIP：${records.length}筆紀錄＋${totalImages}張圖片`
    );
  } catch (error) {
    console.error(
      "Backup ZIP export failed:",
      error
    );

    showToast(
      "ZIP匯出失敗，請再試一次"
    );
  } finally {
    $("exportBackupZip").disabled =
      false;
    $("exportBackupZip").textContent =
      "匯出CSV＋照片 ZIP";
  }
}


function generateImportedRecordId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `import-${Date.now()}-${Math.random()}`;
}

function stableImportedRecordId(
  record
) {
  const source = [
    record.tradeDate || "",
    record.createdAt || "",
    record.recordMode || "",
    record.symbol || "",
    record.direction || "",
    record.basePosition || "",
    record.position || "",
    record.entryStatus || "",
    Number.isFinite(
      record.profitR
    )
      ? record.profitR
      : "",
    record.checklistSummary || "",
    record.note || ""
  ].join("|");

  if (
    source.replaceAll(
      "|",
      ""
    ) === ""
  ) {
    return generateImportedRecordId();
  }

  let hash =
    2166136261;

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    hash ^=
      source.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return `legacy-${(
    hash >>> 0
  ).toString(16)}`;
}

function parseCsvText(text) {
  const source =
    String(text || "")
      .replace(/^\uFEFF/, "");

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (
          source[index + 1] === '"'
        ) {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (
      char === "\n"
    ) {
      row.push(
        field.replace(/\r$/, "")
      );
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (
    field.length > 0 ||
    row.length > 0
  ) {
    row.push(
      field.replace(/\r$/, "")
    );
    rows.push(row);
  }

  return rows.filter(
    (item) =>
      item.some(
        (value) =>
          String(value).trim() !== ""
      )
  );
}

function csvRowsToObjects(text) {
  const rows =
    parseCsvText(text);

  if (rows.length < 2) {
    return [];
  }

  const headers =
    rows[0].map(
      (header) =>
        String(header).trim()
    );

  return rows
    .slice(1)
    .map((row) => {
      const item = {};

      headers.forEach(
        (header, index) => {
          item[header] =
            row[index] ?? "";
        }
      );

      return item;
    });
}

function firstCsvValue(
  row,
  ...keys
) {
  for (const key of keys) {
    const value =
      row[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function csvBoolean(value) {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  return [
    "yes",
    "true",
    "1",
    "有"
  ].includes(normalized);
}

function csvNumber(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function obstacleStateFromCsv(value) {
  const text =
    String(value || "");

  if (
    text.includes("冇第一真實障礙") ||
    text === "none"
  ) {
    return "none";
  }

  if (
    text.includes("未填距離") ||
    text === "pending"
  ) {
    return "pending";
  }

  if (
    text.includes("<1R") ||
    text.includes("Hard Veto") ||
    text.includes("不足") ||
    text === "veto" ||
    text === "insufficient"
  ) {
    return "veto";
  }

  if (
    text.includes("1R–1.5R") ||
    text.includes("部分食糊") ||
    text === "partial"
  ) {
    return "partial";
  }

  if (
    text.includes("1.5R–2R") ||
    text.includes("RF-managed") ||
    text.includes("接近") ||
    text === "rfManaged" ||
    text === "near"
  ) {
    return "rfManaged";
  }

  if (
    text.includes("障礙區內") ||
    text.includes("重大障礙區") ||
    text === "inside"
  ) {
    return "inside";
  }

  return "standard";
}

function triggerModelFromCsv(value) {
  const text =
    String(value || "");

  return (
    text.includes("Model B") ||
    text.includes("Breakout")
  )
    ? "B"
    : "A";
}

function recordFromCsvRow(row) {
  const triggerModelLabel =
    firstCsvValue(
      row,
      "Trigger Model"
    );

  const triggerModel =
    triggerModelFromCsv(
      triggerModelLabel
    );

  const profitR =
    csvNumber(
      firstCsvValue(
        row,
        "獲利R"
      )
    );

  return Shadow.normalizeRecord({
    ...dualFromCsv(row),
    id:
      String(
        firstCsvValue(
          row,
          "紀錄ID"
        ) || ""
      ).trim(),
    tradeDate:
      firstCsvValue(
        row,
        "交易日期"
      ),
    createdAt:
      firstCsvValue(
        row,
        "建立時間"
      ) ||
      new Date().toISOString(),
    appVersion:
      firstCsvValue(
        row,
        "App版本"
      ) ||
      "Imported-CSV",
    engineVersion:
      firstCsvValue(
        row,
        "Matrix版本"
      ) ||
      "MasterTradeMatrix-AllMarkets-V1.1-EUOpening",
    recordMode:
      firstCsvValue(
        row,
        "類型"
      ) ||
      "Practice",
    marketCode:
      firstCsvValue(
        row,
        "市場分類"
      ) || "FX",
    marketLabel:
      firstCsvValue(
        row,
        "市場名稱"
      ),
    symbol:
      firstCsvValue(
        row,
        "品種"
      ),
    setupTemplateLabel:
      firstCsvValue(
        row,
        "核心Setup"
      ),
    setupTemplate:
      firstCsvValue(
        row,
        "Setup代碼"
      ),
    setupVariant:
      firstCsvValue(
        row,
        "Setup子類型"
      ),
    oprDirectionContextLabel:
      firstCsvValue(
        row,
        "OPR Direction Context"
      ),
    oprDirectionContext:
      hsiOprDirectionContextFromLabel(
        firstCsvValue(
          row,
          "OPR Direction Context"
        )
      ),
    previousHLSweepSource:
      (() => {
        const value =
          firstCsvValue(
            row,
            "Previous H/L來源代碼"
          );
        if (value) return value;

        const setupCode =
          firstCsvValue(
            row,
            "Setup代碼"
          );

        if (
          setupCode ===
            "xau_asia_pdh_pdl"
        ) {
          return firstCsvValue(
            row,
            "XAU Liquidity來源代碼"
          );
        }

        return "";
      })(),
    previousHLSweepSourceLabel:
      (() => {
        const value =
          firstCsvValue(
            row,
            "Previous H/L來源"
          );
        if (value) return value;

        const setupCode =
          firstCsvValue(
            row,
            "Setup代碼"
          );

        if (
          setupCode ===
            "xau_asia_pdh_pdl"
        ) {
          return firstCsvValue(
            row,
            "XAU Liquidity來源"
          );
        }

        return "";
      })(),
    previousHLSweepSession:
      (() => {
        const value =
          firstCsvValue(
            row,
            "Previous H/L Sweep Session代碼"
          );
        if (value) return value;

        const setupCode =
          firstCsvValue(
            row,
            "Setup代碼"
          );

        if (
          setupCode ===
            "xau_asia_pdh_pdl"
        ) {
          const oldSession =
            firstCsvValue(
              row,
              "XAU Sweep時段代碼"
            );

          if (oldSession === "asia") {
            return "asia";
          }

          if (oldSession === "london") {
            return "europe";
          }
        }

        return "";
      })(),
    previousHLSweepSessionLabel:
      (() => {
        const value =
          firstCsvValue(
            row,
            "Previous H/L Sweep Session"
          );
        if (value) return value;

        const setupCode =
          firstCsvValue(
            row,
            "Setup代碼"
          );

        if (
          setupCode ===
            "xau_asia_pdh_pdl"
        ) {
          const oldSession =
            firstCsvValue(
              row,
              "XAU Sweep時段代碼"
            );

          if (oldSession === "asia") {
            return "Asia時段";
          }

          if (oldSession === "london") {
            return "Europe／London時段";
          }
        }

        return "";
      })(),
    xauLiquiditySource:
      firstCsvValue(
        row,
        "XAU Liquidity來源代碼"
      ),
    xauLiquiditySourceLabel:
      firstCsvValue(
        row,
        "XAU Liquidity來源"
      ),
    xauSweepSession:
      firstCsvValue(
        row,
        "XAU Sweep時段代碼"
      ),
    xauSweepSessionLabel:
      firstCsvValue(
        row,
        "XAU Sweep時段"
      ),
    xauLiquidityRank:
      firstCsvValue(
        row,
        "XAU Liquidity級別"
      ),
    xauEdgeMarker:
      firstCsvValue(
        row,
        "XAU E標記"
      ),
    xauPositionEdgeLabel:
      firstCsvValue(
        row,
        "XAU P＋E顯示"
      ),
    xauSetupPriority:
      firstCsvValue(
        row,
        "XAU Setup優先級"
      ),
    backgroundTimeframe:
      firstCsvValue(
        row,
        "大局背景TF"
      ),
    backgroundState:
      firstCsvValue(
        row,
        "大局背景狀態"
      ),
    mainTimeframe:
      firstCsvValue(
        row,
        "主判TF"
      ),
    mainState:
      firstCsvValue(
        row,
        "主判狀態"
      ),
    secondaryTimeframe:
      firstCsvValue(
        row,
        "次判TF"
      ),
    secondaryState:
      firstCsvValue(
        row,
        "次判狀態"
      ),
    entryTimeframe:
      firstCsvValue(
        row,
        "入場觸發TF"
      ),
    direction:
      firstCsvValue(
        row,
        "交易方向"
      ),
    relation:
      firstCsvValue(
        row,
        "主次關係"
      ),
    marketRoute:
      firstCsvValue(
        row,
        "交易路線",
        "Direction Permission"
      ),
    directionPermission:
      firstCsvValue(
        row,
        "Direction Permission"
      ),
    preferredDirection:
      firstCsvValue(
        row,
        "交易優先方向"
      ),
    priorityDeployment:
      firstCsvValue(
        row,
        "優先部署"
      ),
    secondaryDeployment:
      firstCsvValue(
        row,
        "次要部署"
      ),
    backgroundRelation:
      firstCsvValue(
        row,
        "大局方向關係"
      ),
    backgroundDirectOverlap:
      csvBoolean(
        firstCsvValue(
          row,
          "大局實際結構重疊",
          "大局位置實際重疊"
        )
      )
        ? "yes"
        : "no",
    p1BackgroundTailwind:
      (() => {
        const value = firstCsvValue(
          row,
          "P1順風",
          "P1背景"
        );
        if (
          String(value).includes("失效")
        ) return "expired";
        if (
          csvBoolean(value) ||
          String(value).includes("仍有效")
        ) return "valid";
        return "no";
      })(),
    p1ReversalExceptionApplied:
      csvBoolean(
        firstCsvValue(
          row,
          "大局P1反轉例外"
        )
      ),
    htfP1ReversalException:
      csvBoolean(
        firstCsvValue(
          row,
          "窄義HTF P1反轉例外",
          "大局P1反轉例外"
        )
      ),
    basePosition:
      firstCsvValue(
        row,
        "原始位置"
      ),
    position:
      firstCsvValue(
        row,
        "有效位置",
        "最終P位置",
        "2B後位置"
      ),
    p2EdgePosition:
      csvBoolean(
        firstCsvValue(
          row,
          "P2邊緣"
        )
      ),
    transitionLayerP1:
      csvBoolean(
        firstCsvValue(
          row,
          "包含轉換反向P1屬Transition層大位"
        )
      ),
    p3Testable:
      csvBoolean(
        firstCsvValue(
          row,
          "衝突順主判P3可小注",
          "P3可小注測試"
        )
      ),
    counterP2Eligible:
      csvBoolean(
        firstCsvValue(
          row,
          "逆主判P2特殊資格"
        )
      ),
    counterP2Basis:
      firstCsvValue(
        row,
        "逆主判P2資格基礎"
      ),
    counterP2Reason:
      firstCsvValue(
        row,
        "逆主判P2資格原因"
      ),
    counterP2WeakPermissionPath:
      firstCsvValue(
        row,
        "逆弱主判Route A/B",
        "逆弱主判P2權限路徑"
      ) || (
        csvBoolean(
          firstCsvValue(
            row,
            "主判弱勢次結突破首次Retest"
          )
        )
          ? "weakBreakRetest"
          : "none"
      ),
    counterP2WeakBreakRetest:
      csvBoolean(
        firstCsvValue(
          row,
          "主判弱勢次結突破首次Retest"
        )
      ),
    counterP2WeakWorkStructureHeld:
      csvBoolean(
        firstCsvValue(
          row,
          "路徑B主判工作結構突破維持"
        )
      ),
    counterP2WeakIndependentSession:
      csvBoolean(
        firstCsvValue(
          row,
          "路徑B獨立Session催化"
        )
      ),
    counterP2WeakEquivalentSessionSetup:
      csvBoolean(
        firstCsvValue(
          row,
          "路徑B其他同級Setup"
        )
      ),
    counterP2WeakFreshSessionSetup:
      firstCsvValue(
        row,
        "路徑B識別Setup"
      ),
    counterP2WeakHardObstacleR:
      csvNumber(
        firstCsvValue(
          row,
          "路徑B硬障礙R"
        )
      ),
    counterP2WeakNotMatureLeg:
      csvBoolean(
        firstCsvValue(
          row,
          "路徑B未到成熟腿尾"
        )
      ),
    counterP2WeakNotNearMainStructure:
      csvBoolean(
        firstCsvValue(
          row,
          "路徑B未貼近主判主結"
        )
      ),
    counterP1Q2Special:
      csvBoolean(
        firstCsvValue(
          row,
          "逆主判P1Q2特殊可接受"
        )
      ),
    bothTransitionMajorP1:
      csvBoolean(
        firstCsvValue(
          row,
          "雙轉換P1主要邊界"
        )
      ),
    bothTransitionP3Testable:
      csvBoolean(
        firstCsvValue(
          row,
          "雙轉換P3可小注"
        )
      ),
    setupTypeSelected:
      firstCsvValue(
        row,
        "Setup Type選擇"
      ) || "",
    setupType:
      firstCsvValue(
        row,
        "有效Setup Type"
      ) || "",
    noSweepRejection:
      csvBoolean(
        firstCsvValue(
          row,
          "No Sweep P1 Rejection"
        )
      ),
    noSweepMicroBreak:
      csvBoolean(
        firstCsvValue(
          row,
          "No Sweep Micro Break",
          "微結構／控制權轉移"
        )
      ),
    microStructureShift:
      csvBoolean(
        firstCsvValue(
          row,
          "微結構／控制權轉移",
          "No Sweep Micro Break"
        )
      ),
    validBreakout:
      csvBoolean(
        firstCsvValue(
          row,
          "有效Breakout"
        )
      ),
    validAcceptance:
      csvBoolean(
        firstCsvValue(
          row,
          "有效Acceptance"
        )
      ),
    firstRetest:
      csvBoolean(
        firstCsvValue(
          row,
          "第一次Retest"
        )
      ),
    breakoutQuality:
      firstCsvValue(
        row,
        "Breakout／Acceptance質素"
      ),
    fullRepairComplete:
      csvBoolean(
        firstCsvValue(
          row,
          "Full Repair完整"
        )
      ),
    fullRepairAsiaSweep:
      csvBoolean(
        firstCsvValue(
          row,
          "Full Repair Asia Sweep"
        )
      ),
    fullRepairEntryOutside:
      csvBoolean(
        firstCsvValue(
          row,
          "Full Repair入場POR外"
        )
      ),
    fullRepairAcceptedBackInside:
      csvBoolean(
        firstCsvValue(
          row,
          "POR內重新Acceptance"
        )
      ),
    postOpenAsiaSweep:
      csvBoolean(
        firstCsvValue(
          row,
          "EU-D Asia Sweep"
        )
      ),
    postOpenAfterOpen:
      csvBoolean(
        firstCsvValue(
          row,
          "EU-D正式開市後確認"
        )
      ),
    postOpenDriveConfirmed:
      csvBoolean(
        firstCsvValue(
          row,
          "EU-D Opening Drive確認"
        )
      ),
    postOpenPreOpenEntry:
      csvBoolean(
        firstCsvValue(
          row,
          "EU-D開市前直接入場"
        )
      ),
    openingDriveStatus:
      firstCsvValue(
        row,
        "Opening Drive有效期"
      ) || "fresh",
    strongTrendContext:
      csvBoolean(
        firstCsvValue(
          row,
          "強趨勢Context"
        )
      ),
    trueStructureRetest:
      csvBoolean(
        firstCsvValue(
          row,
          "真正結構Retest"
        )
      ),
    triggerModel,
    triggerModelLabel:
      triggerModelLabel ||
      (
        triggerModel === "B"
          ? "Model B｜Breakout／Retest Continuation"
          : "Model A｜Liquidity Reversal"
      ),
    validSweep:
      csvBoolean(
        firstCsvValue(
          row,
          "有效Sweep"
        )
      ),
    validReclaim:
      csvBoolean(
        firstCsvValue(
          row,
          "有效Reclaim"
        )
      ),
    reclaimQuality:
      firstCsvValue(
        row,
        "Sweep／Reclaim質素",
        "Reclaim質素"
      ),
    retestQuality:
      firstCsvValue(
        row,
        "Retest質素",
        "Model A Retest質素"
      ),
    breakoutMeaningful:
      csvBoolean(
        firstCsvValue(
          row,
          "Breakout位置有意義"
        )
      ),
    breakoutAcceptance:
      firstCsvValue(
        row,
        "Acceptance"
      ),
    breakoutMomentum:
      firstCsvValue(
        row,
        "Breakout動能"
      ),
    breakoutRetestQuality:
      firstCsvValue(
        row,
        "Breakout Retest質素"
      ),
    breakoutRetestSupport:
      firstCsvValue(
        row,
        "Breakout Retest結構承接"
      ),
    tradeSpace:
      firstCsvValue(
        row,
        "交易空間"
      ),
    firstObstacleR:
      csvNumber(
        firstCsvValue(
          row,
          "第一障礙R"
        )
      ),
    hasFirstObstacle:
      (() => {
        const r = csvNumber(
          firstCsvValue(
            row,
            "第一障礙R"
          )
        );
        const state = obstacleStateFromCsv(
          firstCsvValue(
            row,
            "大局障礙"
          )
        );
        return Number.isFinite(r) ||
          !["none", "standard"].includes(state);
      })(),
    obstacleKind:
      firstCsvValue(
        row,
        "障礙類型"
      ) || "soft",
    obstacleManagementMode:
      firstCsvValue(
        row,
        "障礙管理模式"
      ),
    obstacleManagementChoice:
      csvBoolean(
        firstCsvValue(
          row,
          "部分食糊計劃"
        )
      )
        ? "partial"
        : csvBoolean(
            firstCsvValue(
              row,
              "到障礙推RF計劃"
            )
          )
          ? "rf"
          : "normal",
    hardObstacleTreatment:
      firstCsvValue(
        row,
        "硬障礙處理"
      ),
    obstacleSpaceBeyond:
      csvBoolean(
        firstCsvValue(
          row,
          "障礙後有2R空間"
        )
      ),
    obstacleRFPlan:
      csvBoolean(
        firstCsvValue(
          row,
          "到障礙推RF計劃"
        )
      ),
    obstaclePartialPlan:
      csvBoolean(
        firstCsvValue(
          row,
          "部分食糊計劃"
        )
      ),
    obstacleClearTransition:
      csvBoolean(
        firstCsvValue(
          row,
          "明確結構轉換Context"
        )
      ),
    openingStoryId:
      firstCsvValue(
        row,
        "Opening Story ID"
      ),
    euAsiaSweepDirection:
      firstCsvValue(
        row,
        "Asia Sweep方向"
      ),
    euAsiaSweepTime:
      firstCsvValue(
        row,
        "Asia Sweep時間"
      ),
    euPorSweepStage:
      firstCsvValue(
        row,
        "POR Sweep階段"
      ),
    euOpeningDriveDirection:
      firstCsvValue(
        row,
        "Opening Drive方向"
      ),
    euBrokeMicroStructure:
      csvBoolean(
        firstCsvValue(
          row,
          "EU記錄破微結構"
        )
      ),
    euBrokeMainStructure:
      csvBoolean(
        firstCsvValue(
          row,
          "EU記錄破15M／1H主結"
        )
      ),
    euOpeningRetestMinutes:
      csvNumber(
        firstCsvValue(
          row,
          "Opening Drive至Retest分鐘"
        )
      ),
    euNewStructureCycle:
      csvBoolean(
        firstCsvValue(
          row,
          "已完成新結構循環"
        )
      ),
    euRetestDepth:
      firstCsvValue(
        row,
        "EU Retest深度"
      ),
    euRetestEfficiency:
      firstCsvValue(
        row,
        "EU Retest推進效率"
      ),
    obstacleOutcome:
      firstCsvValue(
        row,
        "障礙管理結果"
      ) || "N/A",
    bonusCount:
      csvNumber(
        firstCsvValue(
          row,
          "Trigger加分數"
        )
      ) ?? 0,
    baseTrigger:
      firstCsvValue(
        row,
        "基礎Q",
        "加分前Trigger",
        "基礎Trigger"
      ),
    bonusDirectRepair:
      csvBoolean(
        firstCsvValue(
          row,
          "至少1項加分直接補強瑕疵"
        )
      ),
    bonusNoDoubleCount:
      csvBoolean(
        firstCsvValue(
          row,
          "確認冇Double Count"
        )
      ),
    triggerBonusUpgraded:
      csvBoolean(
        firstCsvValue(
          row,
          "Q2升Q3"
        )
      ),
    trigger:
      firstCsvValue(
        row,
        "最終Q",
        "Trigger質素",
        "2B後Trigger"
      ),
    asia2BLabel:
      firstCsvValue(
        row,
        "Type A方向",
        "Asia2B類型"
      ) ||
      "無",
    asia2BHighQuality:
      csvBoolean(
        firstCsvValue(
          row,
          "Type A高質",
          "Asia2B高質"
        )
      ),
    asia2BCriteriaCount:
      csvNumber(
        firstCsvValue(
          row,
          "Type A條件數",
          "OPR／Asia2B條件數",
          "Asia2B條件數"
        )
      ) ?? 0,
    asia2BPositionPromoted:
      csvBoolean(
        firstCsvValue(
          row,
          "P2-effective待遇",
          "Type A位置升級"
        )
      ),
    nativeP2Applied:
      csvBoolean(
        firstCsvValue(
          row,
          "原生P2套用"
        )
      ),
    positionTreatment:
      firstCsvValue(
        row,
        "P待遇來源"
      ) || (
        csvBoolean(
          firstCsvValue(
            row,
            "原生P2套用"
          )
        )
          ? "nativeP2"
          : csvBoolean(
              firstCsvValue(
                row,
                "P2-effective待遇",
                "Type A位置升級"
              )
            )
            ? "p2Effective"
            : "native"
      ),
    asia2BNoDoubleSweep:
      csvBoolean(
        firstCsvValue(
          row,
          "沒有頂底雙邊掃"
        )
      ),
    asia2BStructureOverlap:
      csvBoolean(
        firstCsvValue(
          row,
          "Asia2B結構基礎"
        )
      ),
    secondaryRangePosition:
      firstCsvValue(
        row,
        "次判Range位置"
      ) ||
      "notApplicable",
    rangeSize:
      csvNumber(
        firstCsvValue(
          row,
          "Range修正後"
        )
      ) ?? 0,
    obstacleState:
      obstacleStateFromCsv(
        firstCsvValue(
          row,
          "大局障礙"
        )
      ),
    obstacleManagement:
      firstCsvValue(
        row,
        "障礙管理"
      ),
    marketCap:
      csvNumber(
        firstCsvValue(
          row,
          "市場關係上限",
          "市場注碼上限"
        )
      ) ?? 0,
    rawMatrixSize:
      csvNumber(
        firstCsvValue(
          row,
          "Setup Type＋P × Q",
          "P × Q Matrix",
          "Trigger矩陣許可"
        )
      ) ?? 0,
    matrixSize:
      csvNumber(
        firstCsvValue(
          row,
          "Setup Type＋P × Q",
          "P × Q Matrix",
          "Trigger矩陣許可"
        )
      ) ?? 0,
    positionQualitySize:
      csvNumber(
        firstCsvValue(
          row,
          "Legacy位置修正",
          "位置質素修正"
        )
      ) ?? 0,
    obstacleSize:
      csvNumber(
        firstCsvValue(
          row,
          "大局修正"
        )
      ) ?? 0,
    finalSize:
      csvNumber(
        firstCsvValue(
          row,
          "最終注碼"
        )
      ) ?? 0,
    entryStatus:
      firstCsvValue(
        row,
        "入市結果"
      ) ||
      "Skip",
    entryTimeQ:
      firstCsvValue(
        row,
        "Entry-time Q"
      ) ||
      "",
    postEntryQ:
      firstCsvValue(
        row,
        "Post-entry Q"
      ) ||
      "N/A",
    postEntryAction:
      firstCsvValue(
        row,
        "Post-entry處理"
      ) ||
      "N/A",
    tpPlan:
      firstCsvValue(
        row,
        "TP計劃"
      ),
    profitR,
    reachedRF:
      firstCsvValue(
        row,
        "去到RF"
      ) ||
      "N/A",
    reachedTP2:
      firstCsvValue(
        row,
        "去到TP2"
      ) ||
      "N/A",
    hasImage: false,
    imageCount: 0,
    loosenedTriggerBecauseBias:
      csvBoolean(
        firstCsvValue(
          row,
          "方向偏見標籤"
        )
      ),
    emotionalSizing:
      csvBoolean(
        firstCsvValue(
          row,
          "情緒加注標籤"
        )
      ),
    matrixVersion:
      firstCsvValue(
        row,
        "Frozen Matrix Version"
      ) || "Legacy／Imported",
    transitionTypeLabel:
      firstCsvValue(
        row,
        "Transition Type V1.3"
      ),
    transitionType:
      firstCsvValue(
        row,
        "Transition Type V1.3"
      ),
    controlAlignmentLabel:
      firstCsvValue(
        row,
        "Control Alignment V1.3"
      ),
    controlAlignment:
      firstCsvValue(
        row,
        "Control Alignment V1.3"
      ),
    rawP:
      firstCsvValue(
        row,
        "Raw P V1.3",
        "原始位置"
      ),
    p3Context:
      (() => {
        const value = String(
          firstCsvValue(
            row,
            "P3 Context"
          ) || ""
        ).toUpperCase();

        return (
          value === "PB" ||
          value === "MID" ||
          value === "EXT"
        )
          ? value
          : "";
      })(),
    enhancementLabel:
      firstCsvValue(
        row,
        "Enhancement E V1.3"
      ),
    enhancement:
      firstCsvValue(
        row,
        "Enhancement E V1.3"
      ),
    executionP:
      firstCsvValue(
        row,
        "Execution P V1.3",
        "有效位置"
      ),
    nativeQ:
      firstCsvValue(
        row,
        "Native Q V1.3",
        "基礎Q"
      ),
    q2Subtype:
      firstCsvValue(
        row,
        "Q2 Subtype V1.3"
      ),
    tradeObjective:
      firstCsvValue(
        row,
        "Trade Objective V1.3"
      ),
    shadowAlignedTransitionSize:
      csvNumber(
        firstCsvValue(
          row,
          "Aligned Transition Shadow Size"
        )
      ),
    setupFamily:
      firstCsvValue(
        row,
        "Setup Family V1.3",
        "核心Setup"
      ),
    mfeR:
      csvNumber(firstCsvValue(row, "MFE R")),
    maeR:
      csvNumber(firstCsvValue(row, "MAE R")),
    timeToRF:
      csvNumber(firstCsvValue(row, "Time to RF")),
    timeToMFE:
      csvNumber(firstCsvValue(row, "Time to MFE")),
    actualR:
      csvNumber(firstCsvValue(row, "Actual R")) ?? profitR,
    reviewedSession:
      firstCsvValue(row, "Reviewed Session") || "",
    validCandidate:
      firstCsvValue(row, "Valid Candidate") || "No",
    postEntryPricePattern:
      firstCsvValue(
        row,
        "入市後 Price Pattern"
      ) || "",
    shadowResearchVersion:
      firstCsvValue(
        row,
        "Shadow Research Version"
      ) || "",
    primaryCapReason:
      firstCsvValue(
        row,
        "0.25 Primary Cap Reason"
      ) || "N/A",
    additionalCapFlags:
      String(
        firstCsvValue(
          row,
          "0.25 Additional Cap Flags"
        ) || ""
      )
        .split("｜")
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean),
    normalizedR:
      csvNumber(
        firstCsvValue(
          row,
          "Normalized R"
        )
      ),
    objectiveAtEntry:
      simplifiedObjectiveAtEntry(
        firstCsvValue(
          row,
          "Objective at Entry",
          "Trade Objective V1.3"
        ),
        firstCsvValue(
          row,
          "Reaction-first Shadow Class"
        )
      ),
    reactionFirstShadowClass:
      firstCsvValue(
        row,
        "Reaction-first Shadow Class"
      ) || "N/A",
    postEntryObjectiveUpgrade:
      normalizePostEntryObjectiveUpgrade(
        firstCsvValue(
          row,
          "Post-entry Objective Upgrade"
        )
      ),
    reclaimStrongBarAtrRatio:
      csvNumber(
        firstCsvValue(
          row,
          "Reclaim Strong Bar ATR Ratio"
        )
      ),
    retestStrongBarAtrRatio:
      csvNumber(
        firstCsvValue(
          row,
          "Retest Strong Bar ATR Ratio",
          "Strong Retest Shadow Metric"
        )
      ),
    reclaimInternalStructure:
      normalizeReclaimInternalStructure(
        firstCsvValue(
          row,
          "Reclaim Internal Structure"
        )
      ),
    retestInternalStructure:
      normalizeRetestInternalStructure(
        firstCsvValue(
          row,
          "Retest Internal Structure"
        )
      ),
    retestVsReclaimStructure:
      (() => {
        const direct =
          normalizeRetestVsReclaimStructure(
            firstCsvValue(
              row,
              "Retest vs Reclaim Structure"
            )
          );

        if (direct) {
          return direct;
        }

        return (
          normalizeReclaimInternalStructure(
            firstCsvValue(
              row,
              "Reclaim Internal Structure"
            )
          ) === "none"
        )
          ? "na"
          : "";
      })(),
    retestAcceptance:
      normalizeRetestAcceptance(
        firstCsvValue(
          row,
          "Retest Acceptance"
        )
      ),
    // Legacy V1.30.1 alias retained only for compatibility.
    strongRetestShadowMetric:
      csvNumber(
        firstCsvValue(
          row,
          "Retest Strong Bar ATR Ratio",
          "Strong Retest Shadow Metric"
        )
      ),
    deepRFTriggered:
      firstCsvValue(
        row,
        "Deep-RF Triggered"
      ) || "No",
    deepRFOriginalSLHit:
      firstCsvValue(
        row,
        "Deep-RF RF後原SL被打"
      ) || "N/A",
    deepRFShadowMfeR:
      csvNumber(
        firstCsvValue(
          row,
          "Deep-RF Shadow MFE R"
        )
      ),
    deepRFNoRfFinalR:
      csvNumber(
        firstCsvValue(
          row,
          "Deep-RF No-RF Final R"
        )
      ),
    checklistSummary:
      firstCsvValue(
        row,
        "Checklist"
      ),
    note:
      firstCsvValue(
        row,
        "備註"
      )
  });
}

function mimeTypeForImageName(name) {
  const lower =
    String(name || "")
      .toLowerCase();

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

function findZipEndOfCentralDirectory(
  bytes,
  view
) {
  const minOffset =
    Math.max(
      0,
      bytes.length -
        65557
    );

  for (
    let offset =
      bytes.length - 22;
    offset >= minOffset;
    offset -= 1
  ) {
    if (
      view.getUint32(
        offset,
        true
      ) === 0x06054B50
    ) {
      return offset;
    }
  }

  throw new Error(
    "搵唔到ZIP中央目錄；檔案可能已損壞"
  );
}

async function inflateRawZipData(
  compressed
) {
  if (
    typeof DecompressionStream ===
      "undefined"
  ) {
    throw new Error(
      "呢個瀏覽器未支援標準Deflate ZIP解壓；請用較新版本Chrome／Safari再試"
    );
  }

  let stream;

  try {
    stream =
      new DecompressionStream(
        "deflate-raw"
      );
  } catch (error) {
    throw new Error(
      "瀏覽器未支援ZIP Deflate解壓；請用較新版本Chrome／Safari再試"
    );
  }

  const decompressed =
    new Blob(
      [compressed]
    )
      .stream()
      .pipeThrough(stream);

  return new Uint8Array(
    await new Response(
      decompressed
    ).arrayBuffer()
  );
}

function normalizeBackupZipEntries(
  entries
) {
  const names =
    [...entries.keys()]
      .filter(
        (name) =>
          !name.startsWith(
            "__MACOSX/"
          )
      );

  const candidates =
    names
      .filter(
        (name) =>
          name === "records.json" ||
          name === "trades.csv" ||
          name.endsWith(
            "/records.json"
          ) ||
          name.endsWith(
            "/trades.csv"
          )
      )
      .sort(
        (a, b) =>
          a.length - b.length
      );

  if (
    candidates.length === 0
  ) {
    return entries;
  }

  const anchor =
    candidates[0];

  const slash =
    anchor.lastIndexOf("/");

  const prefix =
    slash >= 0
      ? anchor.slice(
          0,
          slash + 1
        )
      : "";

  if (!prefix) {
    return entries;
  }

  const normalized =
    new Map();

  for (
    const [name, data] of entries
  ) {
    if (
      !name.startsWith(prefix)
    ) {
      continue;
    }

    const stripped =
      name.slice(
        prefix.length
      );

    if (
      !stripped ||
      stripped.startsWith(
        "__MACOSX/"
      )
    ) {
      continue;
    }

    normalized.set(
      stripped,
      data
    );
  }

  return normalized.size > 0
    ? normalized
    : entries;
}

async function readStoredZipEntries(
  file
) {
  const bytes =
    new Uint8Array(
      await file.arrayBuffer()
    );

  const view =
    new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    );

  const endOffset =
    findZipEndOfCentralDirectory(
      bytes,
      view
    );

  const totalEntries =
    view.getUint16(
      endOffset + 10,
      true
    );

  const centralOffset =
    view.getUint32(
      endOffset + 16,
      true
    );

  if (
    centralOffset >=
      bytes.length
  ) {
    throw new Error(
      "ZIP中央目錄位置錯誤"
    );
  }

  const entries =
    new Map();

  let offset =
    centralOffset;

  for (
    let index = 0;
    index < totalEntries;
    index += 1
  ) {
    if (
      offset + 46 >
      bytes.length
    ) {
      throw new Error(
        "ZIP中央目錄不完整"
      );
    }

    if (
      view.getUint32(
        offset,
        true
      ) !== 0x02014B50
    ) {
      throw new Error(
        "ZIP中央目錄格式錯誤"
      );
    }

    const flags =
      view.getUint16(
        offset + 8,
        true
      );

    const method =
      view.getUint16(
        offset + 10,
        true
      );

    const compressedSize =
      view.getUint32(
        offset + 20,
        true
      );

    const uncompressedSize =
      view.getUint32(
        offset + 24,
        true
      );

    const nameLength =
      view.getUint16(
        offset + 28,
        true
      );

    const extraLength =
      view.getUint16(
        offset + 30,
        true
      );

    const commentLength =
      view.getUint16(
        offset + 32,
        true
      );

    const localOffset =
      view.getUint32(
        offset + 42,
        true
      );

    const nameStart =
      offset + 46;

    const nameEnd =
      nameStart +
      nameLength;

    if (
      nameEnd >
      bytes.length
    ) {
      throw new Error(
        "ZIP檔名資料不完整"
      );
    }

    const name =
      new TextDecoder(
        "utf-8"
      ).decode(
        bytes.slice(
          nameStart,
          nameEnd
        )
      );

    offset =
      nameEnd +
      extraLength +
      commentLength;

    if (
      name.endsWith("/")
    ) {
      continue;
    }

    if (flags & 0x0001) {
      throw new Error(
        "唔支援加密／有密碼ZIP"
      );
    }

    if (
      localOffset + 30 >
      bytes.length ||
      view.getUint32(
        localOffset,
        true
      ) !== 0x04034B50
    ) {
      throw new Error(
        `ZIP entry損壞：${name}`
      );
    }

    const localNameLength =
      view.getUint16(
        localOffset + 26,
        true
      );

    const localExtraLength =
      view.getUint16(
        localOffset + 28,
        true
      );

    const dataStart =
      localOffset +
      30 +
      localNameLength +
      localExtraLength;

    const dataEnd =
      dataStart +
      compressedSize;

    if (
      dataEnd >
      bytes.length
    ) {
      throw new Error(
        `ZIP entry資料不完整：${name}`
      );
    }

    const compressed =
      bytes.slice(
        dataStart,
        dataEnd
      );

    let data;

    if (method === 0) {
      data =
        compressed;
    } else if (method === 8) {
      data =
        await inflateRawZipData(
          compressed
        );
    } else {
      throw new Error(
        `ZIP壓縮格式${method}暫未支援；請用一般Deflate／Store ZIP`
      );
    }

    if (
      uncompressedSize > 0 &&
      data.length !==
        uncompressedSize
    ) {
      throw new Error(
        `ZIP entry解壓長度不符：${name}`
      );
    }

    entries.set(
      name,
      data
    );
  }

  return normalizeBackupZipEntries(
    entries
  );
}

function decodeZipText(
  entries,
  name
) {
  const data =
    entries.get(name);

  if (!data) {
    return null;
  }

  return new TextDecoder(
    "utf-8"
  ).decode(data)
    .replace(/^\uFEFF/, "");
}

function csvRecordComparableJson(
  record
) {
  const clone = {
    ...record
  };

  /*
   * Current CSV已prune走以下舊欄。
   * 兩邊比較時移除，避免佢哋嘅import default造成假差異。
   */
  [
    "tradeObjective",
    "timeToMFE",
    "postEntryPricePattern",
    "reactionFirstShadowClass",
    "reclaimStrongBarAtrRatio",
    "retestStrongBarAtrRatio",
    "reclaimInternalStructure",
    "strongRetestShadowMetric",
    "hasImage",
    "imageCount"
  ].forEach(
    (key) => {
      delete clone[key];
    }
  );

  return JSON.stringify(
    clone
  );
}

function mergeEditedCsvOverBackupJson(
  jsonRecords,
  csvText
) {
  const csvObjects =
    csvRowsToObjects(
      csvText
    );

  const csvRecords =
    csvObjects.map(
      recordFromCsvRow
    );

  const jsonById =
    new Map(
      jsonRecords
        .filter(
          (record) =>
            record?.id
        )
        .map(
          (record) => [
            record.id,
            record
          ]
        )
    );

  const editedIds =
    new Set();

  const csvById =
    new Map();

  csvRecords.forEach(
    (record, index) => {
      if (record.id) {
        csvById.set(
          record.id,
          {
            record,
            row:
              csvObjects[index]
          }
        );
      }
    }
  );

  const merged =
    jsonRecords.map(
      (baseRecord) => {
        if (
          !baseRecord?.id ||
          !csvById.has(
            baseRecord.id
          )
        ) {
          return {
            ...baseRecord
          };
        }

        const edited =
          csvById.get(
            baseRecord.id
          ).record;

        const baselineCsvObject =
          csvRowsToObjects(
            buildCsv(
              [baseRecord]
            )
          )[0];

        const baselineParsed =
          recordFromCsvRow(
            baselineCsvObject
          );

        const changed =
          csvRecordComparableJson(
            edited
          ) !==
          csvRecordComparableJson(
            baselineParsed
          );

        if (!changed) {
          return {
            ...baseRecord
          };
        }

        editedIds.add(
          baseRecord.id
        );

        const combined = {
          ...baseRecord,
          ...edited,
          id:
            baseRecord.id
        };

        /*
         * 新版CSV刻意prune走嘅資料由records.json保留。
         * 咁用戶改CSV時唔會意外洗走舊版／隱藏研究資料。
         */
        [
          "tradeObjective",
          "tradeObjectiveReason",
          "timeToMFE",
          "postEntryPricePattern",
          "reactionFirstShadowClass",
          "reclaimStrongBarAtrRatio",
          "retestStrongBarAtrRatio",
          "reclaimInternalStructure",
          "strongRetestShadowMetric",
          "hasImage",
          "imageCount"
        ].forEach(
          (key) => {
            if (
              Object.prototype.hasOwnProperty.call(
                baseRecord,
                key
              )
            ) {
              combined[key] =
                baseRecord[key];
            }
          }
        );

        return combined;
      }
    );

  /*
   * 允許用戶喺CSV尾新增新row。
   * 有ID而records.json冇嘅row會當新紀錄。
   */
  for (
    const csvRecord of csvRecords
  ) {
    if (
      csvRecord.id &&
      !jsonById.has(
        csvRecord.id
      )
    ) {
      merged.push(
        csvRecord
      );
    }
  }

  return {
    records:
      merged,
    editedIds
  };
}


function assignLegacyZipRecordIds(
  records,
  entryNames
) {
  const folders =
    [
      ...new Set(
        entryNames
          .filter(
            (name) =>
              name.startsWith(
                "images/"
              )
          )
          .map(
            (name) =>
              name.split("/")[1]
          )
          .filter(Boolean)
      )
    ];

  const used =
    new Set();

  records.forEach((record) => {
    if (record.id) return;

    const prefix =
      `${safeZipSegment(
        recordTradeDate(record)
      )}_${safeZipSegment(
        record.symbol
      )}_`;

    const folder =
      folders.find(
        (item) =>
          !used.has(item) &&
          item.startsWith(
            prefix
          )
      );

    if (!folder) {
      return;
    }

    used.add(folder);
    record.id =
      folder.slice(
        prefix.length
      );
  });
}

function buildZipImagesByRecord(
  records,
  entries
) {
  const result =
    new Map();

  for (
    const [
      name,
      data
    ] of entries
  ) {
    if (
      !name.startsWith(
        "images/"
      )
    ) {
      continue;
    }

    const parts =
      name.split("/");

    if (
      parts.length < 3
    ) {
      continue;
    }

    const folder =
      parts[1];

    const record =
      records.find(
        (item) =>
          item.id &&
          folder.endsWith(
            `_${safeZipSegment(
              item.id
            )}`
          )
      );

    if (!record) {
      continue;
    }

    if (
      !result.has(record.id)
    ) {
      result.set(
        record.id,
        []
      );
    }

    result
      .get(record.id)
      .push(
        new Blob(
          [data],
          {
            type:
              mimeTypeForImageName(
                name
              )
          }
        )
      );
  }

  return result;
}

async function mergeImportedRecords(
  importedRecords,
  imagesByRecord =
    new Map(),
  options = {}
) {
  const existing =
    loadRecords();

  const updateExistingIds =
    options.updateExistingIds instanceof Set
      ? options.updateExistingIds
      : new Set(
          options.updateExistingIds ||
          []
        );

  const existingIndexById =
    new Map(
      existing
        .map(
          (record, index) => [
            record.id,
            index
          ]
        )
        .filter(
          ([id]) =>
            !!id
        )
    );

  const existingIds =
    new Set(
      existingIndexById.keys()
    );

  const accepted = [];
  let updated = 0;
  let skipped = 0;
  let imageCount = 0;

  for (
    const sourceRecord of
      importedRecords
  ) {
    const record = {
      ...sourceRecord
    };

    if (!record.id) {
      record.id =
        stableImportedRecordId(
          record
        );
    }

    const existingIndex =
      existingIndexById.get(
        record.id
      );

    if (
      existingIndex !== undefined
    ) {
      if (
        !updateExistingIds.has(
          record.id
        )
      ) {
        skipped += 1;
        continue;
      }

      const localRecord =
        existing[
          existingIndex
        ];

      const images =
        imagesByRecord.get(
          record.id
        ) || [];

      const updatedRecord = {
        ...localRecord,
        ...record,
        id:
          localRecord.id
      };

      if (
        images.length > 0
      ) {
        await putImages(
          record.id,
          images
        );

        updatedRecord.hasImage =
          true;
        updatedRecord.imageCount =
          images.length;

        imageCount +=
          images.length;
      } else {
        updatedRecord.hasImage =
          localRecord.hasImage ===
          true;
        updatedRecord.imageCount =
          Number(
            localRecord.imageCount ||
            0
          );
      }

      existing[
        existingIndex
      ] = updatedRecord;

      updated += 1;
      continue;
    }

    existingIds.add(
      record.id
    );

    existingIndexById.set(
      record.id,
      existing.length +
      accepted.length
    );

    const images =
      imagesByRecord.get(
        record.id
      ) || [];

    if (
      images.length > 0
    ) {
      await putImages(
        record.id,
        images
      );

      record.hasImage = true;
      record.imageCount =
        images.length;
      imageCount +=
        images.length;
    } else {
      record.hasImage = false;
      record.imageCount = 0;
    }

    accepted.push(
      record
    );
  }

  if (
    accepted.length > 0 ||
    updated > 0
  ) {
    saveRecords([
      ...existing,
      ...accepted
    ]);
  }

  renderHistory();

  return {
    imported:
      accepted.length,
    updated,
    skipped,
    images:
      imageCount
  };
}

async function importCsvFile(file) {
  const text =
    await file.text();

  const objects =
    csvRowsToObjects(text);

  const records =
    objects.map(
      recordFromCsvRow
    );

  if (
    records.length === 0
  ) {
    throw new Error(
      "CSV入面搵唔到可匯入紀錄"
    );
  }

  const result =
    await mergeImportedRecords(
      records
    );

  return result;
}

async function importBackupZipFile(
  file
) {
  const entries =
    await readStoredZipEntries(
      file
    );

  let records = [];

  let editedIds =
    new Set();

  const recordsJson =
    decodeZipText(
      entries,
      "records.json"
    );

  const csv =
    decodeZipText(
      entries,
      "trades.csv"
    );

  if (recordsJson) {
    const parsed =
      JSON.parse(
        recordsJson
      );

    if (
      !Array.isArray(parsed)
    ) {
      throw new Error(
        "records.json格式錯誤"
      );
    }

    const jsonRecords =
      parsed.map(
        (record) => ({
          ...record
        })
      );

    if (csv) {
      const overlaid =
        mergeEditedCsvOverBackupJson(
          jsonRecords,
          csv
        );

      records =
        overlaid.records;

      editedIds =
        overlaid.editedIds;
    } else {
      records =
        jsonRecords;
    }
  } else {
    if (!csv) {
      throw new Error(
        "ZIP入面搵唔到records.json或trades.csv"
      );
    }

    records =
      csvRowsToObjects(csv)
        .map(
          recordFromCsvRow
        );

    assignLegacyZipRecordIds(
      records,
      [...entries.keys()]
    );
  }

  if (
    records.length === 0
  ) {
    throw new Error(
      "備份ZIP入面冇紀錄"
    );
  }

  const imagesByRecord =
    buildZipImagesByRecord(
      records,
      entries
    );

  return mergeImportedRecords(
    records,
    imagesByRecord,
    {
      updateExistingIds:
        editedIds
    }
  );
}

async function handleCsvImportFile(
  event
) {
  const file =
    event.target.files?.[0];

  event.target.value = "";

  if (!file) return;

  $("importCsvButton").disabled =
    true;
  $("importCsvButton").textContent =
    "匯入緊…";

  try {
    const result =
      await importCsvFile(file);

    showToast(
      `CSV匯入完成：新增${result.imported}筆，跳過${result.skipped}筆重複紀錄`
    );
  } catch (error) {
    console.error(
      "CSV import failed:",
      error
    );

    showToast(
      `CSV匯入失敗：${error.message || "格式不支援"}`
    );
  } finally {
    $("importCsvButton").disabled =
      false;
    $("importCsvButton").textContent =
      "匯入CSV";
  }
}

async function handleBackupZipImportFile(
  event
) {
  const file =
    event.target.files?.[0];

  event.target.value = "";

  if (!file) return;

  $("importBackupZipButton").disabled =
    true;
  $("importBackupZipButton").textContent =
    "匯入緊…";

  try {
    const result =
      await importBackupZipFile(
        file
      );

    showToast(
      `ZIP匯入完成：新增${result.imported}筆、更新${result.updated || 0}筆、圖片${result.images}張，跳過${result.skipped}筆未改重複紀錄`
    );
  } catch (error) {
    console.error(
      "Backup ZIP import failed:",
      error
    );

    showToast(
      `ZIP匯入失敗：${error.message || "格式不支援"}`
    );
  } finally {
    $("importBackupZipButton").disabled =
      false;
    $("importBackupZipButton").textContent =
      "匯入／更新備份ZIP";
  }
}

function setQuickNavOpen(open) {
  $("rulebookQuickNav")
    .classList.toggle(
      "open",
      open
    );

  $("quickNavToggle")
    .setAttribute(
      "aria-expanded",
      open
        ? "true"
        : "false"
    );
}

function scrollToRulebookSection(
  targetId
) {
  const target =
    document.getElementById(
      targetId
    );

  if (!target) return;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  setQuickNavOpen(false);
}



function liveRouteLabel(value) {
  const labels = {
    healthyAligned: "雙健康同向｜順共同方向",
    weakAligned: "同向有弱勢｜順共同方向",
    alignedReverse: "反共同方向｜正常0／窄義P1例外",
    conflictMain: "方向衝突｜順主判、逆次判",
    conflictSecondary: "舊版｜順次判、逆主判",
    reverseWeakMain: "逆弱主判｜Route A/B only",
    reverseHealthyMain: "逆健康主判｜Active P1 Probe only",
    neutralMainConfirmed: "主判中性Transition｜跟次判Confirmed",
    neutralMainReverse: "主判中性Transition｜逆次判Confirmed",
    transitionVsConfirmedConflict: "Directional Transition × Confirmed反向",
    transitionConfirmed: "Single Directional Transition｜同Confirmed方向",
    alignedTransition: "Aligned Transition｜Early Trend",
    mixedTransition: "Mixed Transition｜Conflict",
    neutralTransition: "Neutral／Range Transition｜邊界",
    transitionReverse: "Transition反向Probe"
  };

  return labels[value] || value;
}

function liveRouteCap(value) {
  const caps = {
    healthyAligned: 1,
    weakAligned: 0.5,
    alignedReverse: 0,
    conflictMain: 0.5,
    conflictSecondary: 0.5,
    reverseWeakMain: 0.25,
    reverseHealthyMain: 0.25,
    neutralMainConfirmed: 0.5,
    neutralMainReverse: 0.25,
    transitionVsConfirmedConflict: 0.5,
    transitionConfirmed: 0.5,
    alignedTransition: 0.5,
    mixedTransition: 0.5,
    neutralTransition: 0.5,
    transitionReverse: 0.25
  };

  return caps[value] ?? 0;
}

function syncLiveObstacleInputs() {
  const present =
    checked("liveHasFirstObstacle");

  $("liveFirstObstaclePanel")
    .classList.toggle(
      "hidden",
      !present
    );

  if (!present) {
    $("liveObstacle").value =
      "none";
    return "none";
  }

  const raw =
    $("liveFirstObstacleR")
      .value.trim();

  const r =
    raw === ""
      ? null
      : Number(raw);

  const kind =
    $("liveObstacleKind").value;

  const state =
    obstacleBandFromR(
      Number.isFinite(r) && r >= 0
        ? r
        : null,
      kind,
      true
    );

  $("liveObstacle").value =
    state;

  return state;
}

function recalculateLiveDecision() {
  const routeCode =
    $("liveMarketRoute").value;
  const definition =
    setupDefinition(true);

  syncPreviousHLSweepToXau(true);

  const livePreviousHLInfo =
    previousHLSweepInfo(true);

  const variant =
    setupVariant(true);
  const selectedSetupType =
    setupTypeFromTemplate(true);
  const nativeQuality =
    $("liveTriggerQuality").value;
  const controlAlignment =
    $("liveControlAlignment").value;

  const typeAQualified =
    selectedSetupType === "A" &&
    isDesignatedTypeASetup(true) &&
    checked("liveTypeAQualified");

  const effectiveSetupType =
    selectedSetupType === "A" &&
    !typeAQualified
      ? "B"
      : selectedSetupType;

  $("liveTypeAPanel").classList.toggle(
    "hidden",
    selectedSetupType !== "A"
  );
  $("liveTypeCPanel").classList.toggle(
    "hidden",
    selectedSetupType !== "C"
  );
  $("liveSetupClassification").textContent =
    setupClassificationLabel(true);
  $("liveEffectiveSetupType").textContent =
    setupClassificationLabel(
      true,
      effectiveSetupType
    );
  $("liveTypeCNote").textContent =
    definition.note;

  const euOpeningVariant = [
    "fullRepairAsia",
    "fullRepairPure",
    "postOpenConfirmation"
  ].includes(variant);
  const euPostOpen =
    variant === "postOpenConfirmation";

  $("liveEUOpeningPanel").classList.toggle(
    "hidden",
    !euOpeningVariant
  );
  $("liveEuDConfirmationRows").classList.toggle(
    "hidden",
    !euPostOpen
  );
  if (!euPostOpen) {
    $("liveEuDConfirmed").checked = false;
    $("liveEuDPreOpenEntry").checked = false;
  }

  const basePosition =
    $("livePosition").value;
  updateXauLiquidityUI(
    true,
    basePosition
  );

  // V1.3: Native Q永久保留，E／Session唔再Q2→Q3。
  const effectiveQuality =
    nativeQuality;

  const liveXauEnhancement =
    xauLiquidityEnhancementInfo(
      null,
      basePosition,
      true,
      nativeQuality
    );

  let effectivePosition =
    basePosition;
  let livePositionTreatment =
    "native";
  let liveXauPositionPromoted =
    false;

  if (
    effectiveSetupType === "A" &&
    basePosition === "P3" &&
    typeAQualified
  ) {
    effectivePosition = "P2";
    livePositionTreatment =
      "p2Effective";
  }

  if (
    liveXauEnhancement.promotePosition &&
    basePosition === "P3"
  ) {
    effectivePosition = "P2";
    livePositionTreatment =
      "p2Effective";
    liveXauPositionPromoted = true;
  }

  const liveOpeningFresh =
    !euOpeningVariant ||
    $("liveOpeningDriveStatus").value !==
      "expired";
  const liveSetupCoreUsable =
    nativeQuality !== "Q1" &&
    liveOpeningFresh;

  // V1.3 EU-D = POR Full Repair; native P2 when complete.
  if (
    ["fullRepairAsia","fullRepairPure"].includes(variant) &&
    basePosition === "P3" &&
    liveSetupCoreUsable
  ) {
    effectivePosition = "P2";
    livePositionTreatment =
      "nativeP2";
  }

  // V1.3 EU-B = Asia Sweep + Post-open Confirmation; P3→P2-E once.
  const livePostOpenQualified =
    euPostOpen &&
    liveSetupCoreUsable &&
    checked("liveEuDConfirmed") &&
    !checked("liveEuDPreOpenEntry");

  if (
    livePostOpenQualified &&
    basePosition === "P3"
  ) {
    effectivePosition = "P2";
    livePositionTreatment =
      "p2Effective";
  }

  const liveSharedE = sharedEInfo(true);
  if (basePosition === 'P3' && liveSharedE.eligible) {
    effectivePosition = 'P2';
    livePositionTreatment = 'p2Effective';
  }
  $('livesharedEStatus').textContent = liveSharedE.applicable ? `${liveSharedE.label}｜${liveSharedE.eligible ? '符合共用 E 條件' : '未完整符合共用 E 條件'}` : '沿用原 Setup / XAU E 計法';

  const showTransitionP1 =
    ["transitionReverse","neutralMainReverse"].includes(routeCode) &&
    effectivePosition === "P1";
  $("liveTransitionLayerP1Row").classList.toggle(
    "hidden",
    !showTransitionP1
  );
  if (!showTransitionP1) {
    $("liveTransitionLayerP1").checked = false;
  }

  const showTransitionP2Tailwind =
    routeCode === "transitionReverse" &&
    effectivePosition === "P2";
  $("liveTransitionP2TailwindRow").classList.toggle(
    "hidden",
    !showTransitionP2Tailwind
  );
  if (!showTransitionP2Tailwind) {
    $("liveTransitionP2TailwindAlignment").value = "none";
  }
  const liveTransitionAlignment =
    $("liveTransitionP2TailwindAlignment").value;
  const liveTransitionP2TailwindEligible =
    showTransitionP2Tailwind &&
    $("liveP1Tailwind").value === "valid" &&
    nativeQuality === "Q3" &&
    ["neutral","aligned"].includes(
      liveTransitionAlignment
    );

  const showP3Conflict =
    routeCode === "conflictMain" &&
    effectivePosition === "P3";
  $("liveP3ConflictTestableRow").classList.toggle(
    "hidden",
    !showP3Conflict
  );
  if (!showP3Conflict) {
    $("liveP3ConflictTestable").checked = false;
  }

  const showCounterContext =
    routeCode === "reverseWeakMain" &&
    ["P1","P2"].includes(
      effectivePosition
    );

  const showCounterP2 =
    showCounterContext &&
    effectivePosition === "P2";

  $("liveCounterP2BasisRow").classList.toggle(
    "hidden",
    !showCounterContext
  );

  if (!showCounterContext) {
    $("liveCounterP2Basis").value = "none";
  }

  const liveCounterBasis =
    $("liveCounterP2Basis").value;

  const showLiveFreshSession =
    showCounterContext &&
    liveCounterBasis ===
      "weakFreshSession";

  $("liveWeakFreshSessionPanel").classList.toggle(
    "hidden",
    !showLiveFreshSession
  );

  const freshObstacleR =
    numericInputValue(
      "liveWeakFreshHardObstacleR"
    );

  const freshSessionConfirmationComplete =
    showLiveFreshSession &&
    nativeQuality === "Q3" &&
    checked("liveWeakFreshSecondaryHealthy") &&
    checked("liveWeakFreshIndependentSession");

  const weakBreakConfirmationComplete =
    showCounterContext &&
    liveCounterBasis ===
      "weakBreakRetest" &&
    nativeQuality === "Q3";

  const weakBreakRetestEligible =
    showCounterP2 &&
    weakBreakConfirmationComplete;

  const freshSessionEligible =
    showCounterP2 &&
    freshSessionConfirmationComplete;

  const counterP2Eligible =
    weakBreakRetestEligible ||
    freshSessionEligible;

  const liveHealthyCounterEligible =
    routeCode === "reverseHealthyMain" &&
    ["P1","P2"].includes(effectivePosition) &&
    $("liveP1Tailwind").value === "valid" &&
    nativeQuality === "Q3";

  const showHTFException =
    routeCode === "alignedReverse" &&
    (basePosition === "P1" ||
      basePosition === "P2");
  $("liveHTFP1ReversalExceptionRow").classList.toggle(
    "hidden",
    !showHTFException
  );
  if (!showHTFException) {
    $("liveHTFP1ReversalException").checked = false;
  }
  const htfExceptionEligible =
    showHTFException &&
    checked("liveHTFP1ReversalException") &&
    nativeQuality === "Q3";

  const transitionBoundaryRoute = [
    "alignedTransition",
    "mixedTransition",
    "neutralTransition"
  ].includes(routeCode);
  const showTransitionMajorP1 =
    transitionBoundaryRoute &&
    effectivePosition === "P1";
  $("liveBothTransitionMajorP1Row").classList.toggle(
    "hidden",
    !showTransitionMajorP1
  );
  if (!showTransitionMajorP1) {
    $("liveBothTransitionMajorP1").checked = false;
  }

  const showTransitionP3 =
    transitionBoundaryRoute &&
    effectivePosition === "P3";
  $("liveBothTransitionP3TestableRow").classList.toggle(
    "hidden",
    !showTransitionP3
  );
  if (!showTransitionP3) {
    $("liveBothTransitionP3Testable").checked = false;
  }

  const marketCap =
    liveRouteCap(routeCode);

  let matrixSize =
    matrixCell(
      routeCode,
      effectivePosition,
      nativeQuality,
      {
        basePosition,
        htfP1ReversalEligible:
          htfExceptionEligible,
        counterP2Eligible,
        weakCounterRouteEligible:
          routeCode === "reverseWeakMain" &&
          (weakBreakConfirmationComplete || freshSessionConfirmationComplete),
        healthyCounterReversalEligible:
          liveHealthyCounterEligible,
        transitionLayerP1:
          checked("liveTransitionLayerP1"),
        transitionP2TailwindEligible:
          liveTransitionP2TailwindEligible,
        p3ConflictTestable:
          checked("liveP3ConflictTestable"),
        p3AlignedTestable: true,
        bothTransitionP3Testable:
          checked("liveBothTransitionP3Testable")
      }
    );
  matrixSize = Math.min(
    marketCap,
    matrixSize
  );

  // V1.3 P2-E + Native Q2限制。
  const p2EWithQ2 =
    basePosition === "P3" &&
    effectivePosition === "P2" &&
    livePositionTreatment === "p2Effective" &&
    nativeQuality === "Q2";
  if (p2EWithQ2) {
    matrixSize = Math.min(
      matrixSize,
      0.25
    );
  }

  let rangeSize =
    matrixSize;
  const rangeState =
    $("liveRangePosition").value;
  if (
    rangeState === "middle"
  ) {
    rangeSize = 0;
  } else if (
    rangeState === "outside"
  ) {
    rangeSize =
      downgradeOneLevel(rangeSize);
  }

  const obstacleState =
    syncLiveObstacleInputs();

  const liveObstaclePresent =
    checked("liveHasFirstObstacle");

  const liveObstacleRRaw =
    $("liveFirstObstacleR")
      .value.trim();

  const liveObstacleR =
    liveObstacleRRaw === ""
      ? null
      : Number(liveObstacleRRaw);

  const liveObstacleKind =
    $("liveObstacleKind").value;

  const liveManagementPlan =
    $("liveObstacleManagementPlan")
      .value;

  let obstacleSize =
    rangeSize;
  let obstacleNote = "";
  const obstacleVetoes = [];

  $("liveRFManagedPanel")
    .classList.add("hidden");
  $("livePartialModePanel")
    .classList.add("hidden");
  $("liveHardObstaclePanel")
    .classList.add("hidden");

  if (obstacleState === "pending") {
    obstacleSize = 0;
    obstacleVetoes.push(
      "已Tick有第一真實障礙，但未填有效距離R。"
    );
  } else if (obstacleState === "veto") {
    obstacleSize = 0;
    obstacleVetoes.push(
      "第一真正障礙低於約1.5R，V1.3 RR Veto。"
    );
  } else if (obstacleState === "inside") {
    obstacleSize =
      downgradeOneLevel(
        rangeSize
      );
    obstacleNote =
      `重大HTF障礙：Size降一級；${liveManagementPlan === "partial" ? "Partial＋RF" : liveManagementPlan === "rf" ? "到障礙推RF" : "Objective預設Reaction"}。`;
  } else if (obstacleState === "rfManaged") {
    obstacleNote =
      `第一障礙${liveObstacleR.toFixed(2)}R：Size唔自動降，Objective預設Reaction；${liveManagementPlan === "partial" ? "Partial＋RF" : liveManagementPlan === "rf" ? "到障礙推RF" : "建議RF／Partial管理"}。`;
  } else if (obstacleState === "standard") {
    obstacleNote =
      `第一障礙${liveObstacleR.toFixed(2)}R普通／Soft：≥2R，Size正常。`;
  } else {
    obstacleNote =
      "冇第一真實障礙：Obstacle層唔限制Size。";
  }

  const vetoes = [
    ...obstacleVetoes
  ];

  if (
    livePreviousHLInfo.applicable &&
    !livePreviousHLInfo.eligible
  ) {
    vetoes.push(
      livePreviousHLInfo.reason
    );
  }
  if (effectivePosition === "P4") {
    vetoes.push(
      "P4／Range middle／Chase位置＝0。"
    );
  }
  if (nativeQuality === "Q1") {
    vetoes.push(
      "Native Q1＝Setup失效。"
    );
  }
  if (
    euOpeningVariant &&
    $("liveOpeningDriveStatus").value === "expired"
  ) {
    vetoes.push(
      "Opening Drive已過期。"
    );
  }
  if (euPostOpen) {
    if (!checked("liveEuDConfirmed")) {
      vetoes.push(
        "EU-B未完成正式開市後獨立確認＋首次弱Retest。"
      );
    }
    if (checked("liveEuDPreOpenEntry")) {
      vetoes.push(
        "Asia 2B during POR開市前直接入場已刪除。"
      );
    }
  }
  if (checked("liveChase")) {
    vetoes.push("實際入場屬Chase。");
  }
  if (checked("liveTimeRiskViolation")) {
    vetoes.push(
      "違反交易時間／總風險限制。"
    );
  }

  const finalSize =
    vetoes.length > 0
      ? 0
      : obstacleSize;

  const liveTransitionTypeCode =
    routeCode === "mixedTransition"
      ? "Mixed"
      : routeCode === "neutralTransition"
        ? "Neutral"
        : "";

  const tradeObjective =
    objectiveAtEntryCode({
      finalSize,
      routeCode,
      nativeQ:
        nativeQuality,
      position:
        effectivePosition,
      firstObstacleR:
        liveObstaclePresent
          ? liveObstacleR
          : null,
      obstacleState,
      controlCode:
        controlAlignment,
      transitionTypeCode:
        liveTransitionTypeCode,
      setupVariant:
        variant
    });

  const liveReactionFirstShadow =
    reactionFirstShadowClass({
      tradeObjective,
      routeCode,
      nativeQ:
        nativeQuality,
      position:
        effectivePosition,
      firstObstacleR:
        liveObstaclePresent
          ? liveObstacleR
          : null,
      obstacleState,
      controlCode:
        controlAlignment,
      transitionTypeCode:
        liveTransitionTypeCode
    });

  const liveCapReason =
    capReasonInfo({
      finalSize,
      routeCode,
      rawPosition:
        basePosition,
      executionPosition:
        effectivePosition,
      positionTreatment:
        livePositionTreatment,
      nativeQ:
        nativeQuality,
      q2SubtypeLabel:
        nativeQuality === "Q2"
          ? "Q2"
          : "",
      obstacleState,
      matrixSize,
      rangeSize,
      controlCode:
        controlAlignment
    });

  const shadowSize =
    routeCode === "alignedTransition" &&
    effectivePosition === "P2" &&
    nativeQuality === "Q3"
      ? 0.5
      : null;

  $("liveMarketCap").textContent =
    SIZE_LABELS[marketCap];
  $("liveEffectivePosition").textContent =
    effectivePosition;
  $("liveEffectiveQ").textContent =
    nativeQuality;
  $("liveResultCap").textContent =
    SIZE_LABELS[marketCap];
  $("liveMatrixSize").textContent =
    SIZE_LABELS[matrixSize];
  $("liveRangeSize").textContent =
    SIZE_LABELS[rangeSize];
  $("liveObstacleSize").textContent =
    SIZE_LABELS[obstacleSize];
  $("liveFinalSize").textContent =
    SIZE_LABELS[finalSize];
  const liveObjectiveAtEntry =
    simplifiedObjectiveAtEntry(
      tradeObjective,
      liveReactionFirstShadow
    );

  $("liveTradeObjective").textContent =
    liveObjectiveAtEntry;

  const liveQuarterSize =
    Number(finalSize) === 0.25;

  $("livePrimaryCapReasonRow")
    .classList.toggle(
      "hidden",
      !liveQuarterSize
    );
  $("liveAdditionalCapFlagsRow")
    .classList.toggle(
      "hidden",
      !liveQuarterSize
    );

  $("livePrimaryCapReason").textContent =
    liveQuarterSize
      ? (
          liveCapReason.primary ||
          "N/A"
        )
      : "N/A";

  $("liveAdditionalCapFlags").textContent =
    liveQuarterSize &&
    liveCapReason.flags.length > 0
      ? liveCapReason.flags.join("｜")
      : "N/A";

  $("liveShadowSize").textContent =
    shadowSize === null
      ? "N/A"
      : `${SIZE_LABELS[shadowSize]}｜Research only`;

  const relationNotes = {
    healthyAligned: "雙健康同向：P1／P2 Native Q3最高1。",
    weakAligned: "同向有弱勢：P1／P2 Native Q3最高0.5。",
    alignedReverse: "反共同方向正常0；窄義HTF P1例外最高0.25。",
    conflictMain: "方向衝突順主判：Immediate Control仍Opposing時要保守；P1／P2 Q3最高0.5。",
    conflictSecondary: "舊版逆主判Route。",
    reverseWeakMain: "逆弱主判：只限Route A／B＋P1/P2/P2-E＋Native Q3，最高0.25；Q2＝0。",
    reverseHealthyMain: "逆健康主判：正常0；Active P1第一反應＋P1/P2/P2-E＋Native Q3先0.25。",
    neutralMainConfirmed: "主判中性Transition＋次判Confirmed：跟次判；P1/P2 Q3最高0.5，但Objective固定Reaction。",
    neutralMainReverse: "主判中性但逆次判Confirmed：正常0；清晰P1／Range Boundary＋Q3先0.25。",
    transitionVsConfirmedConflict: "Directional Transition × Confirmed反向：P1 Q3 0.5、P2 Q3 0.25；Objective Reaction。",
    transitionConfirmed: "Single Directional Transition同Confirmed方向：最高0.5。",
    alignedTransition: "Aligned Transition：P2＋Native Q3正式0.25；0.5只Shadow Test。",
    mixedTransition: "Mixed Transition：Conflict邊界；P2 Q3 0.25，Q2 0。",
    neutralTransition: "Neutral／Range Transition：只做邊界；Range middle 0。",
    transitionReverse: "Transition反向Probe：Q3 only，最高0.25。"
  };
  $("liveRelationNote").textContent =
    relationNotes[routeCode] || "";

  const notes = [
    `Matrix V1.3 Frozen｜市場：${MARKET_CONFIG[marketCode(true)].label}。`,
    `Setup：${definition.label}。`,
    showCounterContext
      ? effectivePosition === "P1"
        ? `逆弱主判P1：${liveCounterBasis === "weakBreakRetest" ? "Route A" : liveCounterBasis === "weakFreshSession" ? "Route B" : "冇A/B"}；Route成立＋Native Q3先0.25，冇Route就0。`
        : `逆弱主判P2解鎖：${liveCounterBasis === "weakBreakRetest" ? "Route A" : liveCounterBasis === "weakFreshSession" ? "Route B" : "冇A/B"}；Route成立＋Native Q3先最高0.25。P1 Tailwind只作背景記錄，唔係K嘅第三條Route。`
      : "",
    livePreviousHLInfo.applicable
      ? `Previous H/L Sweep：${livePreviousHLInfo.sourceLabel}｜${livePreviousHLInfo.sessionLabel}。`
      : "",
    `Direction Permission：${liveRouteLabel(routeCode)}｜Cap ${SIZE_LABELS[marketCap]}。`,
    `Control Alignment：${controlAlignment}｜研究欄位，V1.3唔直接改Size。`,
    `Raw P ${basePosition} → Execution P ${effectivePosition}${livePositionTreatment === "p2Effective" ? "-E" : ""}。`,
    marketCode(true) === "XAU"
      ? `XAU Edge：${xauLiquidityEdgeInfo(true, basePosition).positionLabel}；Native Q唔升級。`
      : "",
    `Native Q：${nativeQuality}。`,
    p2EWithQ2
      ? "P2-E＋Native Q2全局最高0.25；如果該route本身Q2＝0仍然0。Q2 subtype只作記錄。"
      : "",
    routeCode === "alignedTransition" && shadowSize !== null
      ? "Aligned Transition P2 Q3：正式0.25；0.5只做Shadow Test。"
      : "",
    ["reverseWeakMain","reverseHealthyMain"].includes(routeCode) && nativeQuality === "Q2"
      ? "Counter-main Q2正式0注；Subtype只作研究記錄。"
      : "",
    variant === "oprContinuation"
      ? "HSI-C OPR Continuation & Retest：Research／Provisional，暫時冇E。"
      : "",
    ["UK100","GER40"].includes(marketCode(true))
      ? "EU V1.3：EU-A POR 2B／EU-B Asia Sweep＋Post-open Confirmation／EU-D POR Full Repair；同一Opening thesis唔Double E／Size。"
      : "",
    obstacleNote,
    `Objective at Entry：${liveObjectiveAtEntry}。`
  ].filter(Boolean);

  if (vetoes.length > 0) {
    notes.push(
      `Hard Veto：${vetoes.join("；")}`
    );
  }

  const liveCandidate = Shadow.calculate({
    route: routeCode === 'conflictMain' && checked('livev14DirectionalNeutral') ? 'directionalNeutral' : routeCode,
    rawP:basePosition, executionP:effectivePosition, positionTreatment:livePositionTreatment, q:nativeQuality,
    p3Context:$('livev14P3Context').value, structured:checked('livev14Structured'), closeThrough:checked('livev14CloseThrough'),
    q2Codes:['R','F','D','S','RR'].filter(k=>checked('livev14Q2'+k)),
    boundary:checked('livev14Boundary')||checked('liveBothTransitionMajorP1')||checked('liveBothTransitionP3Testable')||checked('liveP3ConflictTestable'),
    counterMain:checked('livev14CounterMain'), hardConflict:checked('livev14HardConflict'),
    rangeMiddle:checked('livev14RangeMiddle'), rangeState, obstacleState, firstObstacleR:liveObstaclePresent?liveObstacleR:null,
    hardVetoes:vetoes, controlNegated:checked('livev14ControlNegated'), strongOppositeAcceptance:checked('livev14OppositeAcceptance'),
    activeHtf:checked('livev14ActiveHtf'), controlTransfer:checked('livev14ClearTransfer'), clearSweepReclaim:checked('livev14ClearTransfer'),
    weakCounterEligible:weakBreakConfirmationComplete||freshSessionConfirmationComplete
  });
  $('liveV13Size').textContent=safeSizeLabel(finalSize);
  $('liveV14Size').textContent=safeSizeLabel(liveCandidate.size);
  $('liveV14Objective').textContent='Candidate Valid: '+liveCandidate.valid+'｜'+liveCandidate.objective;
  $('liveV14Runner').textContent='Runner: '+liveCandidate.runnerEligibility;
  $('liveV14Reason').textContent=liveCandidate.reasons.join('；')||'No size modifier';

  $("liveDecisionExplanation").innerHTML =
    `<ul>${notes.map(
      (note) => `<li>${escapeHtml(note)}</li>`
    ).join("")}</ul>`;
}

function setupTabs() {
  document
    .querySelectorAll(
      ".tab-button"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          document
            .querySelectorAll(
              ".tab-button"
            )
            .forEach((item) => {
              item.classList.remove(
                "active"
              );
            });

          document
            .querySelectorAll(
              ".tab-panel"
            )
            .forEach((panel) => {
              panel.classList.remove(
                "active"
              );
            });

          button.classList.add(
            "active"
          );
          $(button.dataset.tab)
            .classList.add(
              "active"
            );

          if (
            button.dataset.tab ===
            "history"
          ) {
            renderHistory();
          }

          if (
            button.dataset.tab !==
            "rulebook"
          ) {
            setQuickNavOpen(false);
          }

          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        }
      );
    });
}

let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent =
    message;
  $("toast").classList.add(
    "show"
  );

  toastTimer =
    setTimeout(() => {
      $("toast").classList.remove(
        "show"
      );
    }, 2300);
}

function populateSelects() {
  [
    "backgroundTimeframe",
    "mainTimeframe",
    "secondaryTimeframe",
    "entryTimeframe"
  ].forEach((id) => {
    TIMEFRAMES.forEach((tf) => {
      $(id).add(
        new Option(tf, tf)
      );
    });
  });

  [
    "backgroundState",
    "mainState",
    "secondaryState"
  ].forEach((id) => {
    Object.keys(STATES)
      .forEach((state) => {
        $(id).add(
          new Option(
            state,
            state
          )
        );
      });
  });

  populateSetupTemplateSelect(
    $("marketCode").value,
    "setupTemplate"
  );

  populateSetupTemplateSelect(
    $("liveMarketCode").value,
    "liveSetupTemplate"
  );

  applySetupTemplate(false);
  applySetupTemplate(true);
}

function syncTypeACriteriaFromChecklist(
  eventTargetId = ""
) {
  if (
    setupTypeFromTemplate(false) !==
    "A"
  ) {
    return;
  }

  if (
    checked("asia2BCleanSweep")
  ) {
    $("validSweep").checked =
      true;
  }

  if (
    checked("asia2BReclaimBreak")
  ) {
    $("validReclaim").checked =
      true;
    $("microStructureShift")
      .checked = true;
  }

  if (
    checked("asia2BWeakRetest")
  ) {
    $("retestQuality").value =
      "weak";
  }
}

function syncTypeACriteriaFromQ(
  eventTargetId = ""
) {
  if (
    setupTypeFromTemplate(false) !==
    "A"
  ) {
    return;
  }

  if (!checked("validSweep")) {
    $("asia2BCleanSweep").checked =
      false;
  }

  if (
    !checked("validReclaim") ||
    !checked("microStructureShift")
  ) {
    $("asia2BReclaimBreak")
      .checked = false;
  } else if (
    eventTargetId ===
      "validReclaim" ||
    eventTargetId ===
      "microStructureShift"
  ) {
    $("asia2BReclaimBreak")
      .checked = true;
  }

  if (
    $("retestQuality").value !==
    "weak"
  ) {
    $("asia2BWeakRetest").checked =
      false;
  } else if (
    eventTargetId ===
    "retestQuality"
  ) {
    $("asia2BWeakRetest").checked =
      true;
  }
}

function resetAllToDefaultsExceptDate() {
  frozenDualTrack = null;
  const preservedTradeDate =
    $("tradeDate").value;

  $("decisionForm").reset();
  $("liveDecisionForm").reset();

  $("tradeDate").value =
    preservedTradeDate;

  $("marketCode").value =
    "FX";
  $("liveMarketCode").value =
    "FX";

  populateSetupTemplateSelect(
    "FX",
    "setupTemplate",
    "fx_liquidity_sweep"
  );

  populateSetupTemplateSelect(
    "FX",
    "liveSetupTemplate",
    "fx_liquidity_sweep"
  );

  applySetupTemplate(false);
  applySetupTemplate(true);

  $("timeframePreset").value =
    "fx";
  applyTimeframePreset("fx");

  $("backgroundState").value =
    "轉換中－中性";
  $("mainState").value =
    "健康跌勢";
  $("secondaryState").value =
    "轉換中－偏跌";

  $("marketTimeRuleNote")
    .textContent =
      MARKET_CONFIG.FX.timeRule;

  clearPendingImage();

  recalculateLiveDecision();
  recalculate();

  showToast(
    "已全部回復預設；交易日期保持不變"
  );
}


function handleRecordDialogBackdropClick(
  event
) {
  const dialog =
    $("recordDialog");

  if (
    !dialog.open ||
    event.target !== dialog
  ) {
    return;
  }

  const rect =
    dialog.getBoundingClientRect();

  const clickedInsideDialog =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (clickedInsideDialog) {
    return;
  }

  dialog.close("cancel");
}

function setupEvents() {
  $("liveMarketCode")
    .addEventListener(
      "change",
      () => {
        applyMarketPreset(
          $("liveMarketCode").value,
          true
        );
        recalculateLiveDecision();
      }
    );

  $("liveSetupTemplate")
    .addEventListener(
      "change",
      () => {
        applySetupTemplate(true);
        recalculateLiveDecision();
      }
    );

  $("marketCode")
    .addEventListener(
      "change",
      () => {
        applyMarketPreset(
          $("marketCode").value,
          false
        );
        recalculate();
      }
    );

  $("setupTemplate")
    .addEventListener(
      "change",
      () => {
        applySetupTemplate(false);
        recalculate();
      }
    );

  $("setupType")
    .addEventListener(
      "change",
      () => {
        if (
          setupDefinition(false)
            .manualType
        ) {
          applySetupTemplate(false);
        }
      }
    );

  $("liveSetupType")
    .addEventListener(
      "change",
      () => {
        if (
          setupDefinition(true)
            .manualType
        ) {
          applySetupTemplate(true);
        }
      }
    );

  $("liveDecisionForm")
    .addEventListener(
      "input",
      recalculateLiveDecision
    );

  $("liveDecisionForm")
    .addEventListener(
      "change",
      recalculateLiveDecision
    );

  $("timeframePreset")
    .addEventListener(
      "change",
      () => {
        applyTimeframePreset(
          $("timeframePreset").value
        );
        recalculate();
      }
    );

  [
    "backgroundTimeframe",
    "mainTimeframe",
    "secondaryTimeframe",
    "entryTimeframe"
  ].forEach((id) => {
    $(id).addEventListener(
      "change",
      () => {
        if (!suppressPresetChange) {
          $("timeframePreset").value =
            "custom";
        }
        recalculate();
      }
    );
  });

  [
    "asia2BCleanSweep",
    "asia2BReclaimBreak",
    "asia2BWeakRetest"
  ].forEach((id) => {
    $(id).addEventListener(
      "change",
      () => {
        syncTypeACriteriaFromChecklist(id);
      }
    );
  });

  [
    "validSweep",
    "validReclaim",
    "microStructureShift",
    "retestQuality"
  ].forEach((id) => {
    $(id).addEventListener(
      "change",
      () => {
        syncTypeACriteriaFromQ(id);
      }
    );
  });

  $("microStructureShift")
    .addEventListener(
      "change",
      () => {
        if (
          setupVariant(false) ===
            "postOpenConfirmation"
        ) {
          $("euBrokeMicroStructure")
            .checked =
              $("microStructureShift")
                .checked;
        }
      }
    );

  $("euBrokeMicroStructure")
    .addEventListener(
      "change",
      () => {
        if (
          setupVariant(false) ===
            "postOpenConfirmation"
        ) {
          $("microStructureShift")
            .checked =
              $("euBrokeMicroStructure")
                .checked;
        }
      }
    );

  $("euNewStructureCycle")
    .addEventListener(
      "change",
      () => {
        if (
          $("euNewStructureCycle")
            .checked
        ) {
          $("openingDriveStatus")
            .value = "expired";
        }
      }
    );

  [
    "hasFirstObstacle",
    "firstObstacleR",
    "obstacleKind",
    "obstacleManagementChoice"
  ].forEach((id) => {
    $(id).addEventListener(
      "input",
      syncObstacleModelInputs
    );
    $(id).addEventListener(
      "change",
      syncObstacleModelInputs
    );
  });

  [
    "prevHLSource",
    "prevHLSession"
  ].forEach((id) => {
    $(id).addEventListener(
      "change",
      () => {
        syncPreviousHLSweepToXau(false);
        recalculate();
      }
    );
  });

  [
    "livePrevHLSource",
    "livePrevHLSession"
  ].forEach((id) => {
    $(id).addEventListener(
      "change",
      () => {
        syncPreviousHLSweepToXau(true);
        recalculateLiveDecision();
      }
    );
  });

  [
    "timeToRF",
    "editTimeToRF"
  ].forEach((id) => {
    $(id).addEventListener(
      "input",
      () => {
        $(id).setCustomValidity("");
      }
    );

    $(id).addEventListener(
      "blur",
      () => {
        normalizeDurationInput(id);
      }
    );
  });

  $("decisionForm")
    .addEventListener(
      "input",
      recalculate
    );

  $("decisionForm")
    .addEventListener(
      "change",
      recalculate
    );

  $("decisionForm")
    .addEventListener(
      "submit",
      saveDecision
    );

  $("deepRFTriggered")
    .addEventListener(
      "change",
      () =>
        syncDeepRFShadowUI(false)
    );

  $("editDeepRFTriggered")
    .addEventListener(
      "change",
      () =>
        syncDeepRFShadowUI(true)
    );

  $("chartPasteZone")
    .addEventListener(
      "paste",
      handlePendingImagePaste
    );

  $("pasteClipboardImage")
    .addEventListener(
      "click",
      pastePendingImageFromClipboard
    );

  $("removePendingImage")
    .addEventListener(
      "click",
      clearPendingImage
    );

  $("imagePreviewGallery")
    .addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "[data-remove-pending-image]"
          );

        if (!button) return;

        removePendingImageAt(
          Number(
            button.dataset
              .removePendingImage
          )
        );
      }
    );

  $("historyModeFilter")
    .addEventListener(
      "change",
      renderHistory
    );

  $("historyEntryFilter")
    .addEventListener(
      "change",
      renderHistory
    );

  $("historySymbolFilter")
    .addEventListener(
      "change",
      renderHistory
    );

  $("historyDateFrom")
    .addEventListener(
      "change",
      renderHistory
    );

  $("historyDateTo")
    .addEventListener(
      "change",
      renderHistory
    );

  $("historySort")
    .addEventListener(
      "change",
      renderHistory
    );

  $("historyClearFilters")
    .addEventListener(
      "click",
      clearHistoryFilters
    );

  $("historySelectModeToggle")
    .addEventListener(
      "click",
      () => {
        setHistorySelectionMode(
          !historySelectionMode
        );
      }
    );

  $("historySelectAllFiltered")
    .addEventListener(
      "click",
      toggleSelectAllFilteredHistory
    );

  $("historyClearSelection")
    .addEventListener(
      "click",
      clearHistorySelection
    );

  $("historyDeleteSelected")
    .addEventListener(
      "click",
      deleteSelectedHistoryRecords
    );

  $("exportCsv")
    .addEventListener(
      "click",
      exportCsv
    );

  $("exportBackupZip")
    .addEventListener(
      "click",
      exportBackupZip
    );

  $("importCsvButton")
    .addEventListener(
      "click",
      () =>
        $("importCsvFile")
          .click()
    );

  $("importBackupZipButton")
    .addEventListener(
      "click",
      () =>
        $("importBackupZipFile")
          .click()
    );

  $("importCsvFile")
    .addEventListener(
      "change",
      handleCsvImportFile
    );

  $("importBackupZipFile")
    .addEventListener(
      "change",
      handleBackupZipImportFile
    );

  $("quickNavToggle")
    .addEventListener(
      "click",
      () => {
        const isOpen =
          $("rulebookQuickNav")
            .classList
            .contains("open");

        setQuickNavOpen(
          !isOpen
        );
      }
    );

  $("quickNavClose")
    .addEventListener(
      "click",
      () =>
        setQuickNavOpen(false)
    );

  $("rulebookQuickNav")
    .addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "[data-scroll-target]"
          );

        if (!button) return;

        scrollToRulebookSection(
          button.dataset
            .scrollTarget
        );
      }
    );

  $("saveRecordEdit")
    .addEventListener(
      "click",
      saveRecordEdit
    );

  $("deleteRecord")
    .addEventListener(
      "click",
      deleteActiveRecord
    );

  $("editChartPasteZone")
    .addEventListener(
      "paste",
      handleEditingImagePaste
    );

  $("pasteEditClipboardImage")
    .addEventListener(
      "click",
      pasteEditingImageFromClipboard
    );

  $("removeStoredImage")
    .addEventListener(
      "click",
      requestRemoveStoredImage
    );

  $("downloadRecordImage")
    .addEventListener(
      "click",
      downloadActiveRecordImage
    );

  $("recordImageGallery")
    .addEventListener(
      "click",
      (event) => {
        const removeButton =
          event.target.closest(
            "[data-remove-record-image]"
          );

        if (removeButton) {
          removeEditingImageAt(
            Number(
              removeButton.dataset
                .removeRecordImage
            )
          );
          return;
        }

        const downloadButton =
          event.target.closest(
            "[data-download-record-image]"
          );

        if (downloadButton) {
          downloadEditingImageAt(
            Number(
              downloadButton.dataset
                .downloadRecordImage
            )
          );
          return;
        }

        const image =
          event.target.closest(
            "[data-open-record-image]"
          );

        if (image) {
          openRecordImageLightbox(
            Number(
              image.dataset
                .openRecordImage
            )
          );
        }
      }
    );

  $("imageLightboxClose")
    .addEventListener(
      "click",
      closeRecordImageLightbox
    );

  $("imageLightboxDialog")
    .addEventListener(
      "click",
      handleImageLightboxBackdropClick
    );

  $("imageLightboxDialog")
    .addEventListener(
      "close",
      () => {
        $("imageLightboxImage")
          .removeAttribute("src");
      }
    );

  $("recordDialog")
    .addEventListener(
      "click",
      handleRecordDialogBackdropClick
    );

  $("recordDialog")
    .addEventListener(
      "close",
      clearRecordImageDisplay
    );

  $("resetAllDefaults")
    .addEventListener(
      "click",
      resetAllToDefaultsExceptDate
    );

  $("backToTop")
    .addEventListener(
      "click",
      () => {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    );

  window.addEventListener(
    "scroll",
    () => {
      $("backToTop").classList.toggle(
        "show",
        window.scrollY > 420
      );
    },
    {
      passive: true
    }
  );
}

function setupServiceWorker() {
  if (
    "serviceWorker" in navigator
  ) {
    window.addEventListener(
      "load",
      () => {
        navigator
          .serviceWorker
          .register(
            "./service-worker.js"
          )
          .catch((error) => {
            console.error(
              "Service worker registration failed:",
              error
            );
          });
      }
    );
  }
}

const Shadow = window.MasterTradeShadow;
let currentCandidate = null;
let frozenDualTrack = null;
let currentDualFingerprint = '';

function sharedEInfo(live = false, trigger = null) {
  const prefix = live ? 'live' : '';
  let source = $(prefix + 'sharedESource').value;
  if (source === 'auto') source = marketCode(live) === 'XAU' ? $(live ? 'liveXauLiquiditySource' : 'xauLiquiditySource').value : 'auto';
  if (source === 'auto' && ['FX','XAU'].includes(marketCode(live)) && isPreviousHLSweepSetup(live) && $(live?'livePrevHLSource':'prevHLSource').value === 'pdhPdl') source='pdhPdl';
  const applicable = ['monHL','oprHL','htfMajor'].includes(source) || (source === 'pdhPdl' && ['FX','XAU'].includes(marketCode(live)));
  const core = live ? checked('livesharedECore') : !!(trigger?.validSweep && trigger?.validReclaim && trigger?.microStructureShift && trigger?.reclaimQuality !== 'negated' && trigger?.retestQuality !== 'invalid');
  const eligible = applicable && ['sweep','session2B','p1ReversalSweep'].includes(setupVariant(live)) && core && checked(prefix+'sharedEFirst') && checked(prefix+'sharedEFresh') && (source !== 'htfMajor' || checked(prefix+'sharedEActive'));
  return {source, applicable, eligible, firstMeaningful:checked(prefix+'sharedEFirst'), fresh:checked(prefix+'sharedEFresh'), activeHtf:checked(prefix+'sharedEActive'), label:{monHL:'Mon H/L',oprHL:'OPR H/L',htfMajor:'Active HTF Structure / Liquidity',pdhPdl:'PDH / PDL'}[source] || 'Existing Setup E', core};
}

function candidateInputs() {
  const d = currentDecision, s = currentAsia2B, t = currentBaseTrigger;
  const opts = currentMatrixOptions(s.effectivePosition,t,t.quality,s.basePosition,s);
  return {
    main:STATES[$('mainState').value], secondary:STATES[$('secondaryState').value], direction:direction(),
    rawP:s.basePosition, executionP:s.effectivePosition, positionTreatment:s.positionTreatment, q:t.quality,
    p3Context:$('p3Context').value, q2Codes:d.q2SubtypeCodes,
    structured:$('retestInternalStructure').value === 'structured', closeThrough:$('retestAcceptance').value === 'closeThrough',
    boundary:checked('v14Boundary') || checked('bothTransitionMajorP1') || checked('bothTransitionP3Testable') || checked('p3ConflictTestable'),
    rangeMiddle:checked('v14RangeMiddle'), rangeState:d.rangeState,
    obstacleState:d.obstacleState, firstObstacleR:d.firstObstacleR, setupCap:applySetupMatrixConstraint(1,s).size,
    hardVetoes:[...d.hardVetoes], controlNegated:checked('v14ControlNegated'), strongOppositeAcceptance:checked('v14OppositeAcceptance'),
    activeHtf:$('p1BackgroundTailwind').value === 'valid' || checked('htfP1ReversalException') || checked('sharedEActive'),
    weakCounterEligible:opts.weakCounterRouteEligible, controlTransfer:t.microStructureShift,
    clearSweepReclaim:t.validSweep && t.validReclaim && t.microStructureShift && t.reclaimQuality !== 'negated',
    openingContext:$('v14OpeningContext').value
  };
}

function dualEntryPayload() {
  const s=currentAsia2B, d=currentDecision;
  return {
    candidateInputs:candidateInputs(), production:{size:d.finalSize, valid:yesNo(d.finalSize>0), objective:decisionObjectiveAtEntry(d), tpPlan:$('tpPlan').value},
    rawP:s.basePosition, executionP:s.effectivePosition, nativeQ:currentBaseTrigger.quality, p3Context:$('p3Context').value,
    sharedE:sharedEInfo(false,currentBaseTrigger), enhancement:d.enhancementLabel, setupTemplate:setupTemplateCode(false), market:marketCode(false),
    direction:direction(), symbol:$('symbol').value.trim().toUpperCase(), tradeDate:$('tradeDate').value,
    entry:optionalNumberFromInput('v14Entry'), sl:optionalNumberFromInput('v14SL'), entryTime:$('v14EntryTime').value,
    timeframes:timeframeValues(), mainState:$('mainState').value, secondaryState:$('secondaryState').value
  };
}

const OUTCOME_IDS = {shadowTrade:'ShadowTrade',mfeR:'MfeR',maeR:'MaeR',baseUnitR:'BaseUnitR',managementUnitR:'ManagementUnitR',reached2R:'Reached2R',gateRecorded:'GateRecorded',runnerExitR:'RunnerExitR',break:'GateBreak',acceptance:'GateAcceptance',hold:'GateHold',extend:'GateExtend',mainTransitionConfirmed:'MainTransitionConfirmed'};
function readV14Outcome(prefix='') {
  const o={};
  for (const [key,suffix] of Object.entries(OUTCOME_IDS)) {
    const el=$(prefix+'v14'+suffix);
    o[key]=el.type==='checkbox'?el.checked:el.type==='number'?optionalNumberFromInput(el.id):el.value;
  }
  return o;
}
function fillV14Outcome(outcome={},prefix='') {
  for (const [key,suffix] of Object.entries(OUTCOME_IDS)) {
    const el=$(prefix+'v14'+suffix);
    if(el.type==='checkbox') el.checked=outcome[key]===true;
    else el.value=outcome[key]??(el.tagName==='SELECT'?'No':'');
  }
}
function outcomePreview(prefix='',snapshot=frozenDualTrack) {
  if (!snapshot) {$(prefix+'v14OutcomePreview').textContent='未有 V1.4 凍結快照；唔會補算歷史 Candidate。';return;}
  const m=Shadow.management(snapshot,readV14Outcome(prefix));
  $(prefix+'v14OutcomePreview').textContent=`Runner activated: ${m.runnerActivated}｜Shadow Management R（未乘 Size）: ${formatResearchR(m.unitR)}｜Shadow R（已乘 Candidate Size）: ${formatResearchR(m.weightedR)}`;
}
function updateDualTrack() {
  if (!currentDecision) return;
  currentCandidate=Shadow.calculate(candidateInputs());
  $('validCandidate').value=yesNo(currentDecision.finalSize>0);
  $('reachedTP2').value=yesNo((optionalNumberFromInput('mfeR')??-Infinity)>3.9);
  $('v13Size').textContent=safeSizeLabel(currentDecision.finalSize);
  $('v13Valid').textContent='Production Valid: '+$('validCandidate').value;
  $('v13Objective').textContent=decisionObjectiveAtEntry(currentDecision);
  $('v14Size').textContent=safeSizeLabel(currentCandidate.size);
  $('v14Valid').textContent='Candidate Valid: '+currentCandidate.valid;
  $('v14Objective').textContent='Objective: '+currentCandidate.objective;
  $('v14Runner').textContent='Runner: '+currentCandidate.runnerEligibility;
  $('v14Reason').textContent=`${currentCandidate.route}｜Negative: ${currentCandidate.negative}｜${currentCandidate.reasons.join('；') || 'No size modifier'}`;
  $('v14Only').textContent=currentDecision.finalSize===0 && currentCandidate.size>0?'V1.4-only Candidate：Production Entry = No；凍結 Shadow Entry / SL 後繼續記錄 Shadow outcome。':'';
  const es=sharedEInfo(false,currentBaseTrigger);
  $('sharedEStatus').textContent=es.applicable?`${es.label}｜${es.eligible?'符合共用 E 條件':'未完整符合共用 E 條件'}`:'沿用原 Setup / XAU E 計法';
  currentDualFingerprint=JSON.stringify(dualEntryPayload());
  const stale=frozenDualTrack && frozenDualTrack.fingerprint!==currentDualFingerprint;
  $('v14FreezeStatus').dataset.frozen=String(!!frozenDualTrack&&!stale);
  $('v14FreezeStatus').dataset.stale=String(!!stale);
  $('v14FreezeStatus').textContent=!frozenDualTrack?'未凍結':stale?'入場條件已改，原快照保留；儲存前請重設再凍結。':`已凍結｜${frozenDualTrack.freezeMode === 'retrospective' ? '事後快照（不入 Prospective A/B）' : 'Prospective'}｜Replay ${frozenDualTrack.entryTime}｜Production ${frozenDualTrack.production.size} / Candidate ${frozenDualTrack.candidate.size}`;
  $('freezeDualTrack').disabled=!!frozenDualTrack;
  if(currentDecision.finalSize===0 && $('entryStatus').value==='Entry') $('entryStatus').value='Skip';
  $('entryStatus').querySelector('option[value="Entry"]').disabled=currentDecision.finalSize===0;
  outcomePreview();
}
function freezeDualEntry() {
  recalculate();
  const payload=dualEntryPayload();
  if(currentCandidate.size>0 || currentDecision.finalSize>0) {
    if(payload.entry===null || payload.sl===null || payload.entry<=0 || payload.sl<=0 || !payload.entryTime || (payload.direction==='Long'?payload.sl>=payload.entry:payload.sl<=payload.entry)) {
      showToast('請填有效 Entry、SL、Replay 時刻；Long SL < Entry，Short SL > Entry。'); return;
    }
  }
  const outcomeKnown = ['profitR','mfeR','maeR','v14MfeR','v14MaeR','v14ManagementUnitR','v14RunnerExitR'].some(id=>optionalNumberFromInput(id)!==null) || $('v14Reached2R').value==='Yes';
  frozenDualTrack=JSON.parse(JSON.stringify({...payload,version:Shadow.VERSION,candidate:currentCandidate,fingerprint:currentDualFingerprint,frozenAt:new Date().toISOString(),freezeMode:outcomeKnown?'retrospective':'pre-outcome'}));
  updateDualTrack();
  showToast('已凍結 Production + Candidate 入場快照');
}
function validateDualSave() {
  recalculate();
  if((currentCandidate.size>0 || currentDecision.finalSize>0) && !frozenDualTrack) {showToast('先凍結入場 Entry / SL / Objective，再儲存結果。');return false;}
  if(frozenDualTrack && frozenDualTrack.fingerprint!==currentDualFingerprint) {showToast('入場條件已改；請先重設未存快照並重新凍結。');return false;}
  if(currentDecision.finalSize===0 && optionalNumberFromInput('profitR')!==null && optionalNumberFromInput('profitR')!==0) {showToast('Production = 0；假設結果請填 V1.4 Shadow Outcome，唔好填 Production Actual R。');return false;}
  return true;
}
function attachDualRecord(record) {
  record.dualTrackSnapshot=frozenDualTrack?JSON.parse(JSON.stringify(frozenDualTrack)):null;
  record.v14Outcome=readV14Outcome();
  record.sharedESource=sharedEInfo(false,currentBaseTrigger).source;
  record.v13Objective=decisionObjectiveAtEntry(currentDecision);
  return Shadow.normalizeRecord(record);
}
function renderEditDual(record) {
  const s=record.dualTrackSnapshot;
  $('editDualTrackSummary').textContent=s?`${s.version}｜Production ${s.production.size} / ${s.production.objective}｜Candidate ${s.candidate.size} / ${s.candidate.objective}｜Runner ${s.candidate.runnerEligibility}｜Entry ${s.entry} / SL ${s.sl}｜Replay ${s.entryTime}｜${s.candidate.reasons.join('；')}`:'舊紀錄：冇當時 V1.4 快照；保留 V1.3，唔事後補算 Candidate。';
  fillV14Outcome(record.v14Outcome,'edit');
  document.querySelectorAll('#recordDialog .v14-outcome input,#recordDialog .v14-outcome select').forEach(el=>el.disabled=!s);
  outcomePreview('edit',s);
  $('editValidCandidate').value=yesNo(record.finalSize>0);
  $('editReachedTP2').value=yesNo((record.mfeR??-Infinity)>3.9);
  $('editEntryStatus').querySelector('option[value="Entry"]').disabled=!(record.finalSize>0);
}
function editDualChanged() {
  const record=loadRecords().find(r=>r.id===activeRecordId);
  if(!record) return;
  $('editValidCandidate').value=yesNo(record.finalSize>0);
  $('editReachedTP2').value=yesNo((optionalNumberFromInput('editMfeR')??-Infinity)>3.9);
  outcomePreview('edit',record.dualTrackSnapshot);
}

// Scalar columns are easy to analyse; JSON preserves the immutable entry snapshot.
const DUAL_COLUMNS = [
  ['V1.3 Production Valid Candidate','v13ProductionValidCandidate'],['V1.3 Production Size','v13ProductionSize'],['V1.3 Objective','v13Objective'],['V1.3 Actual R','v13ActualR'],['Production Entry','productionEntry'],
  ['V1.4 Candidate Valid','v14CandidateValid'],['V1.4 Candidate Size','v14CandidateSize'],['V1.4 Size Change Reason','v14SizeChangeReason'],['V1.4 Objective','v14Objective'],['V1.4 Runner Eligibility','v14RunnerEligibility'],
  ['V1.4 Shadow Trade','v14ShadowTrade'],['V1.4 Shadow Management R (unit)','v14ShadowManagementR'],['V1.4 Shadow R (weighted)','v14ShadowR'],['V1.4 Size-only R','v14SizeOnlyR'],['V1.4 Runner-only R','v14RunnerOnlyR'],['V1.4 Full R','v14FullR'],['V1.4-only Candidate','v14CandidateOnly'],['V1.4-only Base Management R (weighted)','v14CandidateOnlyBaseR'],['V1.4 Size Changed','v14SizeChanged'],['V1.4 Decision Changed','v14DecisionChanged'],['V1.4 Delta R (paired)','v14DeltaR'],['Shared E Source','sharedESource'],
  ['V1.4 Shadow Entry',r=>r.dualTrackSnapshot?.entry],['V1.4 Shadow SL',r=>r.dualTrackSnapshot?.sl],['V1.4 Entry Time',r=>r.dualTrackSnapshot?.entryTime],['V1.4 Frozen At',r=>r.dualTrackSnapshot?.frozenAt],['V1.4 Freeze Mode',r=>r.dualTrackSnapshot?.freezeMode],['V1.4 Opening Context',r=>r.dualTrackSnapshot?.candidateInputs?.openingContext],['V1.4 Negative',r=>r.dualTrackSnapshot?.candidate?.negative],['V1.4 Runner Activated','v14RunnerActivated'],
  ...Object.keys(OUTCOME_IDS).map(k=>['V1.4 Outcome '+k,r=>r.v14Outcome?.[k]]),
  ['Dual Track Entry Snapshot JSON',r=>r.dualTrackSnapshot?JSON.stringify(r.dualTrackSnapshot):'']
];
function dualCsvValues(record) {const r=Shadow.normalizeRecord(record);return DUAL_COLUMNS.map(([,key])=>typeof key==='function'?key(r):r[key]);}
function dualFromCsv(row) {
  const extras={};
  const json=firstCsvValue(row,'Dual Track Entry Snapshot JSON');
  if(json) {
    let s;try{s=JSON.parse(json);}catch {throw new Error('Dual Track Entry Snapshot JSON 格式錯誤');}
    if(!s?.candidate || !s?.production || ![0,.25,.5,1].includes(s.candidate.size) || ![0,.25,.5,1].includes(s.production.size) || !Array.isArray(s.candidate.reasons)) throw new Error('Dual Track snapshot 不完整');
    extras.dualTrackSnapshot=s;
    extras.v14Outcome={};
    for(const k of Object.keys(OUTCOME_IDS)) {
      const v=firstCsvValue(row,'V1.4 Outcome '+k);
      extras.v14Outcome[k]=['break','acceptance','hold','extend','mainTransitionConfirmed'].includes(k)?v==='true':['mfeR','maeR','baseUnitR','managementUnitR','runnerExitR'].includes(k)?Shadow.number(v):v;
    }
  }
  if(Object.prototype.hasOwnProperty.call(row,'Shared E Source')) extras.sharedESource=firstCsvValue(row,'Shared E Source');
  if(Object.prototype.hasOwnProperty.call(row,'V1.3 Objective')) extras.v13Objective=firstCsvValue(row,'V1.3 Objective');
  return extras;
}
function dualMetrics(values) {
  let equity=0, peak=0, dd=0, gain=0, loss=0;
  for(const v of values) {equity+=v;peak=Math.max(peak,equity);dd=Math.max(dd,peak-equity);if(v>0)gain+=v;else loss-=v;}
  const losses=values.filter(v=>v<0).sort((a,b)=>a-b);
  return [values.length,equity,values.length?equity/values.length:null,loss?gain/loss:gain?'∞':null,dd,loss?(-losses.slice(0,5).reduce((a,b)=>a+b,0)/loss*100):0];
}
function renderDualStats(records) {
  const snapshots=records.map(Shadow.normalizeRecord).filter(r=>r.dualTrackSnapshot);
  const all=snapshots.filter(r=>r.dualTrackSnapshot.freezeMode==='pre-outcome');
  const ordered=all.slice().sort((a,b)=>String(a.dualTrackSnapshot.entryTime||a.tradeDate).localeCompare(String(b.dualTrackSnapshot.entryTime||b.tradeDate))||String(a.createdAt).localeCompare(String(b.createdAt)));
  const production=ordered.filter(r=>r.productionEntry==='Yes');
  const paired=production.filter(r=>['v13ActualR','v14SizeOnlyR','v14RunnerOnlyR','v14FullR'].every(k=>Number.isFinite(r[k])));
  const changed=paired.filter(r=>r.v14DecisionChanged==='Yes');
  const only=ordered.filter(r=>r.v14CandidateOnly==='Yes');
  const completedOnly=only.filter(r=>r.v14ShadowTrade==='Yes'&&Number.isFinite(r.v14FullR));
  const fmt=v=>v===null?'—':typeof v==='number'?v.toFixed(2):v;
  const table=(rows)=>'<table><thead><tr><th>Test</th><th>Setup 數</th><th>Total R</th><th>R / Setup</th><th>PF</th><th>Max DD (R)</th><th>最差5單 / 總虧損 %</th></tr></thead><tbody>'+rows.map(([label,values])=>'<tr><th>'+escapeHtml(label)+'</th>'+dualMetrics(values).map(v=>'<td>'+fmt(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  let html=`<p>Prospective 快照 ${all.length} 筆（事後快照 ${snapshots.length-all.length} 筆另存）；Production Entry ${production.length} 筆；四組完整配對 ${paired.length} 筆；未齊結果 ${production.length-paired.length} 筆。統計只用配對完成子樣本，未完成唔當0。</p>`;
  html+=table([['V1.3 Production',paired.map(r=>r.v13ActualR)],['V1.4 Size-only',paired.map(r=>r.v14SizeOnlyR)],['V1.4 Runner-only',paired.map(r=>r.v14RunnerOnlyR)],['V1.4 Full',paired.map(r=>r.v14FullR)]]);
  html+=`<p>Changed trades only：${changed.length} 筆；ΔR ${fmt(changed.reduce((n,r)=>n+r.v14DeltaR,0))}。Runner activated ${paired.filter(r=>r.v14RunnerActivated==='Yes').length}；Runner 到4R ${paired.filter(r=>r.v14RunnerActivated==='Yes'&&r.v14Outcome?.runnerExitR>=4).length}。</p>`;
  const candidateTrades = paired.filter(r=>r.v14CandidateSize>0);
  const runnerTrades = paired.filter(r=>r.v14RunnerActivated==='Yes');
  const runnerTargets = runnerTrades.filter(r=>r.v14Outcome?.runnerExitR>=4);
  html+=`<p>Expectancy / trade：Production ${fmt(paired.length?paired.reduce((n,r)=>n+r.v13ActualR,0)/paired.length:null)}R；Size-only ${fmt(candidateTrades.length?candidateTrades.reduce((n,r)=>n+r.v14SizeOnlyR,0)/candidateTrades.length:null)}R；Runner-only ${fmt(paired.length?paired.reduce((n,r)=>n+r.v14RunnerOnlyR,0)/paired.length:null)}R；Full ${fmt(candidateTrades.length?candidateTrades.reduce((n,r)=>n+r.v14FullR,0)/candidateTrades.length:null)}R。Candidate veto 唔算成交；上表 R / Setup 則保留該0結果。Tail capture（已啟動且有結果 Runner 到4R）：${runnerTargets.length}/${runnerTrades.length}，${runnerTrades.length?fmt(runnerTargets.length/runnerTrades.length*100)+'%':'—'}。</p>`;
  html+='<table><thead><tr><th>改動原因（可能重疊）</th><th>N</th><th>Size-only ΔR</th><th>Full ΔR</th></tr></thead><tbody>';
  for(const tag of ['Mixed Transition Q3 Upgrade','P3-origin cap','Q2 High Negative','Dual Healthy P3→P2-E Q2 Upgrade','Conflict cap']) {
    const group=changed.filter(r=>r.v14SizeChangeReason.includes(tag));
    html+=`<tr><td>${escapeHtml(tag)}</td><td>${group.length}</td><td>${fmt(group.reduce((n,r)=>n+r.v14SizeOnlyR-r.v13ActualR,0))}</td><td>${fmt(group.reduce((n,r)=>n+r.v14DeltaR,0))}</td></tr>`;
  }
  html+='</tbody></table>';
  html+=`<p>V1.4-only：${only.length} 筆，已成交兼完成 ${completedOnly.length} 筆，獨立 Shadow R ${fmt(completedOnly.reduce((n,r)=>n+r.v14FullR,0))}。此組不入 Production／上述配對統計。R / Setup 包含 Candidate veto 的0；PF／DD只屬目前已完成樣本，DD按 Replay Entry時刻排序。比較完整2026 H1請設定日期篩選。</p>`;
  $('dualTrackStats').innerHTML=html;
}
function exportDualAudit() {
  const ids=new Set(currentFilteredHistoryIds);
  const records=loadRecords().filter(r=>ids.has(r.id)&&r.dualTrackSnapshot);
  const headers=['Record ID','Trade Date','Symbol',...DUAL_COLUMNS.map(c=>c[0])];
  const rows=records.map(r=>[r.id,recordTradeDate(r),r.symbol,...dualCsvValues(r)]);
  downloadBlob(new Blob(['\uFEFF'+[headers,...rows].map(row=>row.map(csvEscape).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}),'MasterTrade-DualTrack-AB.csv');
}
function setupDualEvents() {
  $('freezeDualTrack').addEventListener('click',freezeDualEntry);
  $('clearDualTrack').addEventListener('click',()=>{frozenDualTrack=null;fillV14Outcome();updateDualTrack();});
  $('recordDialog').addEventListener('input',editDualChanged);
  $('recordDialog').addEventListener('change',editDualChanged);
  $('exportDualTrackAudit').addEventListener('click',exportDualAudit);
}


function initialize() {
  populateSelects();

  $("tradeDate").value =
    localDateString();

  $("marketCode").value =
    "FX";
  $("liveMarketCode").value =
    "FX";

  populateSetupTemplateSelect(
    "FX",
    "setupTemplate",
    "fx_liquidity_sweep"
  );

  populateSetupTemplateSelect(
    "FX",
    "liveSetupTemplate",
    "fx_liquidity_sweep"
  );

  applySetupTemplate(false);
  applySetupTemplate(true);

  applyMarketPreset(
    "FX",
    false
  );

  $("backgroundState").value =
    "轉換中－中性";
  $("mainState").value =
    "健康跌勢";
  $("secondaryState").value =
    "轉換中－偏跌";

  setupTabs();
  setupEvents();
  setupDualEvents();
  setupServiceWorker();

  recalculateLiveDecision();
  recalculate();
  renderHistory();
}

initialize();
})();
