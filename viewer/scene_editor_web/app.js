const $ = (selector) => document.querySelector(selector);
const svgNS = "http://www.w3.org/2000/svg";
const TIMELINE_LEFT = 154;
const TIMELINE_RULER_HEIGHT = 28;
const TIMELINE_CHARACTER_HEIGHT = 74;
const TIMELINE_PLAYHEAD_SNAP_PX = 7;
const TIMELINE_ZOOM_MIN = 40;
const TIMELINE_ZOOM_MAX = 220;
const MAX_HISTORY = 80;
const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 430;
const STAGE_SCALE = 90;
const STAGE_ZOOM_MIN = 0.45;
const STAGE_ZOOM_MAX = 3.5;
const WAYPOINT_STACK_RADIUS = 11;
const FIXED_PROXY_ASSET = "SMPL-24 Proxy";
const DEFAULT_CLIP_BLEND_SECONDS = 0.45;
const MAX_TRANSITION_GAP_SECONDS = 0.25;
const CAMERA_ORIGIN_TARGET = "__origin__";
const PREFERRED_IDLE_MOTIONS = ["Preset: Idle stand", "Idle Breathing"];
const DEFAULT_SCENE_NAME = "group_greeting_scene";
const CAMERA_PRESETS = [
  ["slow_orbit", "Slow orbit"],
  ["wide_static", "Wide static"],
  ["front_stage", "Front stage"],
  ["follow_character", "Follow avatar"],
  ["dolly_in", "Dolly in"],
  ["keyframed", "Keyframed"],
  ["top_down", "Top down"],
];
const CAMERA_TARGET_PRESETS = new Set(["slow_orbit", "follow_character", "dolly_in"]);
const DEFAULT_EXPORT = { fps: 24, width: 960, height: 540 };
const FINAL_AVATAR_MAX_FPS = 24;
const FINAL_AVATAR_MAX_WIDTH = 1280;
const FINAL_AVATAR_MAX_HEIGHT = 720;
const BACKGROUND_NEAR_PLANE = 0.03;
const COLOR_PRESETS = [
  { label: "Teal", value: "#2f7f7b" },
  { label: "Azure", value: "#3f7db8" },
  { label: "Indigo", value: "#4e68b8" },
  { label: "Sky", value: "#2f91c2" },
  { label: "Yellow", value: "#d6a72f" },
  { label: "Amber", value: "#a86438" },
  { label: "Orange", value: "#d88c2d" },
  { label: "Red", value: "#c04848" },
  { label: "Violet", value: "#7d6aa8" },
  { label: "Sage", value: "#5d8749" },
  { label: "Emerald", value: "#2f9b72" },
  { label: "Rose", value: "#b85b71" },
  { label: "Slate", value: "#56656f" },
];
const PANEL_RESIZER_WIDTH = 8;
const PANEL_RESIZER_HEIGHT = 8;
const PANEL_MAIN_MIN_WIDTH = 560;
const PANEL_STAGE_MIN_HEIGHT = 260;
const PANEL_INSPECTOR_MIN_HEIGHT = 220;
const PANEL_WIDTH_STORAGE_KEY = "gf5.sceneEditor.panelWidths";
const PANEL_HEIGHT_STORAGE_KEY = "gf5.sceneEditor.panelHeights";
const PANEL_HEIGHT_STORAGE_VERSION = 2;
const PANEL_WIDTH_LIMITS = {
  library: { default: 288, min: 220, max: 420 },
  inspector: { default: 360, min: 280, max: 520 },
};
const PREVIEW_PANEL_LEGACY_MAX = 680;
const PANEL_HEIGHT_LIMITS = {
  timeline: { default: 320, min: 220, max: 620 },
  preview: { default: 1100, min: 300, max: 1100 },
};
const MOTION_CATEGORY_ORDER = ["standing_gesture", "travel_loop", "travel_transition", "turn", "special", "other"];
const MOTION_CATEGORY_LABELS = {
  standing_gesture: "Standing / Gesture",
  travel_loop: "Travel Loops",
  travel_transition: "Travel Transitions",
  turn: "Turns",
  special: "Special Actions",
  other: "Other",
};
const ROOT_CONTRACT_LABELS = {
  spot: "stay on spot",
  fixed: "stay on spot",
  scene_path: "scene path",
  facing_only: "turn in place",
  native_travel: "original travel",
};
const HAND_POSES = new Set(["natural", "fist"]);
const SHOULDER_MASKS = new Set(["normal", "arms_forward"]);
const COURSE_BODY_JOINTS = [
  "pelvis",
  "left_hip",
  "right_hip",
  "spine1",
  "left_knee",
  "right_knee",
  "spine2",
  "left_ankle",
  "right_ankle",
  "spine3",
  "left_foot",
  "right_foot",
  "neck",
  "left_collar",
  "right_collar",
  "head",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hand",
  "right_hand",
];
const COURSE_TO_TOY_JOINT = {
  root: "pelvis",
  spine: "spine1",
  chest: "spine2",
  left_toe: "left_foot",
  right_toe: "right_foot",
};

const app = {
  scene: null,
  motions: [],
  proxyAssets: [],
  proxyAssetPreviews: {},
  avatarAssets: [],
  scenes: [],
  warnings: [],
  selectedCharacterId: null,
  selectedMotion: "Idle Breathing",
  selection: { type: "scene" },
  currentTime: 0,
  motionPreviewTime: 0,
  motionPreviewView: { yaw: 0, pitch: 0.18, distance: 3.05, dragging: false, lastX: 0, lastY: 0 },
  collapsedMotionCategories: new Set(),
  panelWidths: {
    library: PANEL_WIDTH_LIMITS.library.default,
    inspector: PANEL_WIDTH_LIMITS.inspector.default,
  },
  panelHeights: {
    timeline: PANEL_HEIGHT_LIMITS.timeline.default,
    preview: PANEL_HEIGHT_LIMITS.preview.default,
  },
  playing: false,
  pixelsPerSecond: 90,
  stageView: { zoom: 1, panX: 0, panY: 0 },
  hiddenCharacterIds: new Set(),
  timelineSnap: null,
  drag: null,
  controlEdit: null,
  history: { undo: [], redo: [] },
  suppressMotionClick: false,
  lastFrameTime: 0,
  exportStatus: "",
  exportWarning: "",
  exportMode: "",
  exportVideoUrl: "",
  exportVideoPath: "",
  exportInProgress: false,
  hyMotionImportStatus: "",
  hyMotionImportError: false,
  hyMotionImportInProgress: false,
  backgroundImportRotate180: false,
};

const palette = COLOR_PRESETS.map((preset) => preset.value);
const backgroundImageCache = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function snapTime(value) {
  return Math.round(value * 10) / 10;
}

function sceneSnapshot() {
  return JSON.stringify(app.scene);
}

function pushUndoSnapshot() {
  if (!app.scene) return;
  const snapshot = sceneSnapshot();
  if (app.history.undo[app.history.undo.length - 1] === snapshot) return;
  app.history.undo.push(snapshot);
  if (app.history.undo.length > MAX_HISTORY) app.history.undo.shift();
  app.history.redo = [];
  if (app.exportVideoUrl) {
    app.exportVideoUrl = "";
    app.exportVideoPath = "";
    app.exportStatus = "Scene changed; export again for an updated video.";
    app.exportWarning = "";
  }
}

function beginSceneControlEdit(token) {
  if (app.controlEdit === token) return;
  app.controlEdit = token;
  pushUndoSnapshot();
}

function endSceneControlEdit(token) {
  if (!token || app.controlEdit === token) app.controlEdit = null;
}

function loadPanelWidths() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY) || "{}");
    if (Number.isFinite(Number(saved.library))) app.panelWidths.library = Number(saved.library);
    if (Number.isFinite(Number(saved.inspector))) app.panelWidths.inspector = Number(saved.inspector);
  } catch {
    // Local storage is optional; fixed defaults are fine when it is unavailable.
  }
  applyPanelWidths();
}

function loadPanelHeights() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PANEL_HEIGHT_STORAGE_KEY) || "{}");
    const savedVersion = Number(saved.version || 0);
    if (Number.isFinite(Number(saved.timeline))) app.panelHeights.timeline = Number(saved.timeline);
    if (Number.isFinite(Number(saved.preview))) {
      const savedPreview = Number(saved.preview);
      app.panelHeights.preview = savedVersion < PANEL_HEIGHT_STORAGE_VERSION && savedPreview <= PREVIEW_PANEL_LEGACY_MAX
        ? defaultPanelHeight("preview")
        : savedPreview;
    }
  } catch {
    // Local storage is optional; fixed defaults are fine when it is unavailable.
  }
  applyPanelHeights();
}

function savePanelWidths() {
  try {
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, JSON.stringify(app.panelWidths));
  } catch {
    // Ignore private browsing or locked-down storage.
  }
}

function savePanelHeights() {
  try {
    window.localStorage.setItem(PANEL_HEIGHT_STORAGE_KEY, JSON.stringify({ ...app.panelHeights, version: PANEL_HEIGHT_STORAGE_VERSION }));
  } catch {
    // Ignore private browsing or locked-down storage.
  }
}

function clampPanelWidth(kind, width) {
  const limits = PANEL_WIDTH_LIMITS[kind];
  const workspace = $(".workspace");
  let max = limits.max;
  if (workspace) {
    const otherKind = kind === "library" ? "inspector" : "library";
    const otherWidth = app.panelWidths[otherKind] || PANEL_WIDTH_LIMITS[otherKind].default;
    const layoutMax = workspace.clientWidth - otherWidth - PANEL_MAIN_MIN_WIDTH - PANEL_RESIZER_WIDTH * 2;
    max = Math.min(max, Math.max(limits.min, layoutMax));
  }
  return Math.round(clamp(Number(width) || limits.default, limits.min, max));
}

function defaultPanelHeight(kind) {
  const limits = PANEL_HEIGHT_LIMITS[kind];
  if (kind === "preview") {
    const inspector = $(".inspector");
    if (inspector && inspector.clientHeight > limits.min + PANEL_INSPECTOR_MIN_HEIGHT + PANEL_RESIZER_HEIGHT) {
      return Math.round(clamp(inspector.clientHeight - PANEL_INSPECTOR_MIN_HEIGHT - PANEL_RESIZER_HEIGHT, limits.min, limits.max));
    }
  }
  return limits.default;
}

function clampPanelHeight(kind, height) {
  const limits = PANEL_HEIGHT_LIMITS[kind];
  if (kind === "preview") {
    const inspector = $(".inspector");
    let max = limits.max;
    if (inspector) {
      const layoutMax = inspector.clientHeight - PANEL_INSPECTOR_MIN_HEIGHT - PANEL_RESIZER_HEIGHT;
      max = Math.min(max, Math.max(limits.min, layoutMax));
    }
    return Math.round(clamp(Number(height) || defaultPanelHeight(kind), limits.min, max));
  }
  const mainPanel = $(".main-panel");
  let max = limits.max;
  if (mainPanel) {
    const layoutMax = mainPanel.clientHeight - PANEL_STAGE_MIN_HEIGHT - PANEL_RESIZER_HEIGHT;
    max = Math.min(max, Math.max(limits.min, layoutMax));
  }
  return Math.round(clamp(Number(height) || defaultPanelHeight(kind), limits.min, max));
}

function applyPanelWidths() {
  app.panelWidths.library = clampPanelWidth("library", app.panelWidths.library);
  app.panelWidths.inspector = clampPanelWidth("inspector", app.panelWidths.inspector);
  const root = document.documentElement;
  root.style.setProperty("--motion-library-width", `${app.panelWidths.library}px`);
  root.style.setProperty("--inspector-width", `${app.panelWidths.inspector}px`);
  updatePanelResizeHandle("library");
  updatePanelResizeHandle("inspector");
}

function applyPanelHeights() {
  app.panelHeights.timeline = clampPanelHeight("timeline", app.panelHeights.timeline);
  app.panelHeights.preview = clampPanelHeight("preview", app.panelHeights.preview);
  document.documentElement.style.setProperty("--timeline-panel-height", `${app.panelHeights.timeline}px`);
  document.documentElement.style.setProperty("--preview-panel-height", `${app.panelHeights.preview}px`);
  updatePanelResizeHandle("timeline");
  updatePanelResizeHandle("preview");
}

function applyPanelLayout() {
  applyPanelWidths();
  applyPanelHeights();
}

function updatePanelResizeHandle(kind) {
  const handle = kind === "library"
    ? $("#libraryResizeHandle")
    : kind === "inspector"
      ? $("#inspectorResizeHandle")
      : kind === "preview"
        ? $("#rightRailResizeHandle")
        : $("#timelineResizeHandle");
  if (!handle) return;
  const isHeight = kind === "timeline" || kind === "preview";
  const limits = isHeight ? PANEL_HEIGHT_LIMITS[kind] : PANEL_WIDTH_LIMITS[kind];
  const value = isHeight ? app.panelHeights[kind] : app.panelWidths[kind];
  handle.setAttribute("aria-valuemin", String(limits.min));
  handle.setAttribute("aria-valuemax", String(limits.max));
  handle.setAttribute("aria-valuenow", String(value));
}

function restoreSceneSnapshot(snapshot) {
  app.scene = JSON.parse(snapshot);
  normalizeEditorScene();
  pruneHiddenCharacters();
  if (!hasCharacterId(app.selectedCharacterId)) app.selectedCharacterId = app.scene.characters[0]?.id || null;
  if (app.selection.characterId && !hasCharacterId(app.selection.characterId)) app.selection = { type: "scene" };
  if (app.selection.type === "camera_key" && !cameraKeyframes()[app.selection.index]) app.selection = { type: "scene" };
  app.currentTime = clamp(app.currentTime, 0, app.scene.duration);
  app.playing = false;
  renderAll();
}

function undoSceneChange() {
  if (!app.history.undo.length) return false;
  app.history.redo.push(sceneSnapshot());
  restoreSceneSnapshot(app.history.undo.pop());
  return true;
}

function redoSceneChange() {
  if (!app.history.redo.length) return false;
  app.history.undo.push(sceneSnapshot());
  restoreSceneSnapshot(app.history.redo.pop());
  return true;
}

function makeSvg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) node.setAttribute(key, String(value));
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function defaultProxyAsset() {
  return app.proxyAssets.includes(FIXED_PROXY_ASSET) ? FIXED_PROXY_ASSET : app.proxyAssets[0] || FIXED_PROXY_ASSET;
}

function normalizeCharacterColor(value, index = 0) {
  const text = String(value || "").trim().toLowerCase();
  const preset = COLOR_PRESETS.find((item) => item.value.toLowerCase() === text);
  return preset?.value || palette[index % palette.length];
}

function randomAvatarColor() {
  const used = new Set(app.scene.characters.map((character, index) => characterColor(character, index)));
  const unused = COLOR_PRESETS.filter((preset) => !used.has(preset.value));
  const choices = unused.length ? unused : COLOR_PRESETS;
  return choices[Math.floor(Math.random() * choices.length)].value;
}

function normalizeRootPosition(position) {
  const source = Array.isArray(position) ? position : [];
  return [0, 1, 2].map((axis) => {
    const value = Number(source[axis]);
    return Number.isFinite(value) ? value : 0;
  });
}

function normalizeEditorScene() {
  if (!Array.isArray(app.scene?.characters)) return;
  sceneCamera();
  app.scene.characters.forEach((character, index) => {
    character.color = normalizeCharacterColor(character.color, index);
    if (character.tint_avatar_colors === undefined) character.tint_avatar_colors = true;
    if (character.hidden_after !== undefined && character.hidden_after !== null && character.hidden_after !== "") {
      const hiddenAfter = Number(character.hidden_after);
      character.hidden_after = Number.isFinite(hiddenAfter) ? clamp(hiddenAfter, 0, app.scene.duration) : null;
    }
    if (!app.proxyAssets.includes(character.proxy_asset)) character.proxy_asset = defaultProxyAsset();
    if (!Array.isArray(character.root_keys)) character.root_keys = [];
    character.root_keys.forEach((key) => {
      key.position = normalizeRootPosition(key.position);
    });
    if (!Array.isArray(character.track)) character.track = [];
    character.track.forEach((clip) => {
      const motion = motionByLabel(clip.clip);
      clip.trim_start = normalizedClipTrimStart(clip, motion);
      if (hasClipTrimEndValue(clip)) clip.trim_end = normalizedClipTrimEnd(clip, motion);
      clip.hand_pose = normalizedHandPose(clip.hand_pose);
      clip.shoulder_mask = normalizedShoulderMask(clip.shoulder_mask);
      clip.blend_in = normalizedClipBlend(clip, "blend_in");
      clip.blend_out = normalizedClipBlend(clip, "blend_out");
    });
  });
}

function normalizedHandPose(value) {
  const text = String(value || "natural").trim().toLowerCase();
  return HAND_POSES.has(text) ? text : "natural";
}

function normalizedShoulderMask(value) {
  const text = String(value || "normal").trim().toLowerCase();
  return SHOULDER_MASKS.has(text) ? text : "normal";
}

function normalizeCameraPosition(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) ? value : fallback;
  return [0, 1, 2].map((index) => Number(source[index] ?? fallback[index] ?? 0) || 0);
}

function characterColor(character, index = 0) {
  return normalizeCharacterColor(character?.color, index);
}

function hexToRgb(value) {
  const color = normalizeCharacterColor(value, 0);
  return [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
}

function avatarPartColor(colorValue, partColor) {
  const base = hexToRgb(colorValue);
  const source = Array.isArray(partColor) ? partColor : [190, 190, 190];
  const brightness = source.slice(0, 3).reduce((sum, channel) => sum + clamp(Number(channel) || 0, 0, 255), 0) / (255 * 3);
  if (brightness < 0.45) return source.slice(0, 3).map((channel) => Math.round(clamp(Number(channel) || 0, 0, 255)));
  const factor = 0.72 + brightness * 0.44;
  return base.map((channel) => Math.round(clamp(channel * factor, 0, 255)));
}

function avatarDisplayColor(colorValue, partColor, tintColors = true) {
  const source = Array.isArray(partColor) ? partColor : [190, 190, 190];
  if (!tintColors) return source.slice(0, 3).map((channel) => Math.round(clamp(Number(channel) || 0, 0, 255)));
  return avatarPartColor(colorValue, source);
}

function strokeForRgb(color) {
  return `rgba(${Math.max(0, color[0] - 35)}, ${Math.max(0, color[1] - 35)}, ${Math.max(0, color[2] - 35)}, 0.38)`;
}

function characterById(id) {
  return app.scene.characters.find((character) => character.id === id) || app.scene.characters[0];
}

function hasCharacterId(id) {
  return app.scene.characters.some((character) => character.id === id);
}

function characterHiddenAfterValue(character) {
  const raw = character?.hidden_after;
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function isCharacterHidden(characterOrId) {
  const character = typeof characterOrId === "string" ? characterById(characterOrId) : characterOrId;
  const id = character?.id;
  if (id && app.hiddenCharacterIds.has(id)) return true;
  const hiddenAfter = characterHiddenAfterValue(character);
  return hiddenAfter !== null && app.currentTime > hiddenAfter + 1e-6;
}

function pruneHiddenCharacters() {
  const ids = new Set(app.scene.characters.map((character) => character.id));
  app.hiddenCharacterIds = new Set([...app.hiddenCharacterIds].filter((id) => ids.has(id)));
}

function toggleCharacterVisibility(characterId) {
  if (app.hiddenCharacterIds.has(characterId)) app.hiddenCharacterIds.delete(characterId);
  else app.hiddenCharacterIds.add(characterId);
  renderAll();
}

function selectedCharacter() {
  return characterById(app.selectedCharacterId);
}

function exactMotionByLabel(label) {
  return app.motions.find((motion) => motion.label === label) || null;
}

function motionByLabel(label) {
  return exactMotionByLabel(label) || app.motions[0];
}

function isMotionVisible(motion) {
  return motion?.library_visible !== false;
}

function visibleMotions() {
  const visible = app.motions.filter(isMotionVisible);
  return visible.length ? visible : app.motions;
}

function motionCategory(motion) {
  return motion?.category || "other";
}

function motionCategoryLabel(motion) {
  const category = motionCategory(motion);
  return motion?.category_label || MOTION_CATEGORY_LABELS[category] || category.replaceAll("_", " ");
}

function motionCategoryRank(motion) {
  const index = MOTION_CATEGORY_ORDER.indexOf(motionCategory(motion));
  return index < 0 ? MOTION_CATEGORY_ORDER.length : index;
}

function motionSortText(motion) {
  return `${motion?.label || ""} ${motion?.name || ""} ${(motion?.tags || []).join(" ")} ${motion?.id || ""}`
    .replace(/^Preset:\s*/i, "")
    .replace(/^Custom:\s*/i, "")
    .toLowerCase();
}

function motionLibraryRank(motion) {
  const text = motionSortText(motion);
  const category = motionCategory(motion);
  if (category === "standing_gesture") {
    if (/\bidle\s+stand\b/.test(text)) return 0;
    if (/\bidle\b|neutral|breathing/.test(text)) return 1;
    if (/look|around|pose/.test(text)) return 2;
    if (/wave/.test(text)) return 10;
    if (/point|present/.test(text)) return 20;
    if (/clap/.test(text)) return 30;
    if (/bow/.test(text)) return 40;
    return 50;
  }
  if (category === "travel_loop") {
    if (/walk\s+cycle|walk\b/.test(text)) return 0;
    if (/march/.test(text)) return 10;
    if (/jog|run/.test(text)) return 20;
    if (/backward/.test(text)) return 30;
    return 50;
  }
  if (category === "travel_transition") {
    if (/start/.test(text)) return 0;
    if (/stop/.test(text)) return 10;
    if (/side/.test(text)) return 20;
    return 50;
  }
  if (category === "turn") {
    if (/left|right|90/.test(text)) return 0;
    if (/around|180/.test(text)) return 10;
    return 50;
  }
  if (category === "special") {
    if (/jump/.test(text)) return 0;
    if (/squat|bend/.test(text)) return 10;
    if (/dance/.test(text)) return 20;
    if (/celebrate/.test(text)) return 30;
    return 50;
  }
  return 50;
}

function rootContractLabel(motion) {
  const contract = motion?.root_contract || "spot";
  return ROOT_CONTRACT_LABELS[contract] || contract.replaceAll("_", " ");
}

function defaultRootModeForMotion(motion) {
  const mode = motion?.default_root_mode || (motion?.root_contract === "native_travel" ? "native" : "path");
  return mode === "native" ? "native" : "path";
}

function sortedClips(character) {
  return [...character.track].sort((a, b) => a.start - b.start);
}

function sortedKeys(character) {
  character.root_keys.sort((a, b) => a.time - b.time);
  return character.root_keys;
}

function nextKeyId(character) {
  let index = 0;
  const ids = new Set(character.root_keys.map((key) => key.id));
  while (ids.has(`k${index}`)) index += 1;
  return `k${index}`;
}

function segmentMode(value) {
  return ["linear", "curve", "hold"].includes(value) ? value : "linear";
}

function segmentForPair(character, fromKey, toKey) {
  const segments = Array.isArray(character.root_segments) ? character.root_segments : [];
  return segments.find((segment) => segment.from === fromKey.id && segment.to === toKey.id) || null;
}

function segmentModeForPair(character, fromKey, toKey) {
  return segmentMode(segmentForPair(character, fromKey, toKey)?.mode);
}

function setSegmentModeForPair(character, fromKey, toKey, mode) {
  if (!Array.isArray(character.root_segments)) character.root_segments = [];
  let segment = segmentForPair(character, fromKey, toKey);
  if (!segment) {
    segment = { from: fromKey.id, to: toKey.id, mode: "linear", facing: "manual" };
    character.root_segments.push(segment);
  }
  segment.mode = segmentMode(mode);
}

function editableSegmentsForKey(character, key) {
  const keys = sortedKeys(character);
  const index = keys.findIndex((candidate) => candidate.id === key.id);
  if (index < 0) return null;
  return {
    incoming: index > 0 ? { fromKey: keys[index - 1], toKey: keys[index] } : null,
    outgoing: index < keys.length - 1 ? { fromKey: keys[index], toKey: keys[index + 1] } : null,
  };
}

function interpolateFacing(a, b, alpha) {
  const delta = ((b.facing_degrees - a.facing_degrees + 180) % 360) - 180;
  return a.facing_degrees + delta * alpha;
}

function lerpPosition(a, b, alpha) {
  return [
    a[0] * (1 - alpha) + b[0] * alpha,
    a[1] * (1 - alpha) + b[1] * alpha,
    a[2] * (1 - alpha) + b[2] * alpha,
  ];
}

function catmullRomPosition(p0, p1, p2, p3, alpha) {
  const t2 = alpha * alpha;
  const t3 = t2 * alpha;
  return [0, 1, 2].map((axis) => 0.5 * (
    2 * p1[axis]
    + (-p0[axis] + p2[axis]) * alpha
    + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
    + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
  ));
}

function rootAt(character, time) {
  const keys = sortedKeys(character);
  if (keys.length === 0) return { position: [0, 0, 0], facing_degrees: 0 };
  if (time <= keys[0].time) return cloneRoot(keys[0]);
  if (time >= keys[keys.length - 1].time) return cloneRoot(keys[keys.length - 1]);
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    if (time >= a.time && time <= b.time) {
      const alpha = (time - a.time) / Math.max(1e-6, b.time - a.time);
      const mode = segmentModeForPair(character, a, b);
      let position;
      if (mode === "hold") {
        position = alpha >= 1 ? [...b.position] : [...a.position];
      } else if (mode === "curve") {
        const prev = keys[Math.max(0, i - 1)];
        const next = keys[Math.min(keys.length - 1, i + 2)];
        position = catmullRomPosition(prev.position, a.position, b.position, next.position, alpha);
      } else {
        position = lerpPosition(a.position, b.position, alpha);
      }
      return { position, facing_degrees: interpolateFacing(a, b, alpha) };
    }
  }
  return cloneRoot(keys[keys.length - 1]);
}

function cloneRoot(key) {
  return { position: [...key.position], facing_degrees: key.facing_degrees };
}

function sceneCamera() {
  if (!app.scene.camera) {
    app.scene.camera = {
      preset: "slow_orbit",
      target: CAMERA_ORIGIN_TARGET,
      height: 1.35,
      keyframes: [],
      segments: [],
    };
  }
  if (!CAMERA_PRESETS.some(([value]) => value === app.scene.camera.preset)) app.scene.camera.preset = "slow_orbit";
  if (!app.scene.camera.target) app.scene.camera.target = CAMERA_ORIGIN_TARGET;
  if (
    app.scene.camera.target !== CAMERA_ORIGIN_TARGET &&
    !app.scene.characters.some((character) => character.id === app.scene.camera.target)
  ) {
    app.scene.camera.target = CAMERA_ORIGIN_TARGET;
  }
  app.scene.camera.keyframes = cameraKeyframes(app.scene.camera);
  app.scene.camera.segments = cameraSegments(app.scene.camera);
  return app.scene.camera;
}

function cameraKeyframes(camera = sceneCamera()) {
  if (!Array.isArray(camera.keyframes)) camera.keyframes = [];
  camera.keyframes.forEach((key, index) => {
    if (!key.id) key.id = `c${index}`;
    key.time = clamp(Number(key.time) || 0, 0, app.scene?.duration || 0);
    key.position = normalizeCameraPosition(key.position, [0, -4, 2]);
    key.look_at = normalizeCameraPosition(key.look_at, [0, 0, 1]);
    key.fov_degrees = clamp(Number(key.fov_degrees) || 45, 10, 120);
  });
  camera.keyframes.sort((a, b) => Number(a.time || 0) - Number(b.time || 0));
  return camera.keyframes;
}

function nextCameraKeyId(camera = sceneCamera()) {
  const ids = new Set(cameraKeyframes(camera).map((key) => key.id));
  let index = camera.keyframes.length;
  while (ids.has(`c${index}`)) index += 1;
  return `c${index}`;
}

function cameraSegments(camera = sceneCamera()) {
  const keys = cameraKeyframes(camera);
  const keyIds = keys.map((key) => key.id);
  const validIds = new Set(keyIds);
  const segmentByPair = new Map();
  const rawSegments = Array.isArray(camera.segments) ? camera.segments : [];
  rawSegments.forEach((segment) => {
    if (!segment || !validIds.has(segment.from) || !validIds.has(segment.to)) return;
    const mode = ["linear", "curve", "hold"].includes(segment.mode) ? segment.mode : "linear";
    segmentByPair.set(`${segment.from}\n${segment.to}`, { from: segment.from, to: segment.to, mode });
  });
  camera.segments = [];
  for (let index = 0; index < keyIds.length - 1; index += 1) {
    const from = keyIds[index];
    const to = keyIds[index + 1];
    camera.segments.push(segmentByPair.get(`${from}\n${to}`) || { from, to, mode: "linear" });
  }
  return camera.segments;
}

function cameraSegmentModeForPair(camera, first, second) {
  const segment = cameraSegments(camera).find((item) => item.from === first.id && item.to === second.id);
  return segment?.mode || "linear";
}

function setCameraSegmentModeForPair(camera, first, second, mode) {
  const normalizedMode = ["linear", "curve", "hold"].includes(mode) ? mode : "linear";
  const segment = cameraSegments(camera).find((item) => item.from === first.id && item.to === second.id);
  if (segment) segment.mode = normalizedMode;
  else camera.segments.push({ from: first.id, to: second.id, mode: normalizedMode });
}

function editableCameraSegmentsForKey(camera, key) {
  const keys = cameraKeyframes(camera);
  const index = keys.findIndex((candidate) => candidate.id === key.id);
  if (index < 0) return null;
  return {
    incoming: index > 0 ? { fromKey: keys[index - 1], toKey: key } : null,
    outgoing: index < keys.length - 1 ? { fromKey: key, toKey: keys[index + 1] } : null,
  };
}

function sceneExport() {
  if (!app.scene.export) app.scene.export = { ...DEFAULT_EXPORT };
  app.scene.export.fps = clamp(Number(app.scene.export.fps) || DEFAULT_EXPORT.fps, 1, FINAL_AVATAR_MAX_FPS);
  app.scene.export.width = evenNumber(clamp(Number(app.scene.export.width) || DEFAULT_EXPORT.width, 320, FINAL_AVATAR_MAX_WIDTH));
  app.scene.export.height = evenNumber(clamp(Number(app.scene.export.height) || DEFAULT_EXPORT.height, 180, FINAL_AVATAR_MAX_HEIGHT));
  return app.scene.export;
}

function sceneBackground() {
  if (!app.scene.background) app.scene.background = { color: "#f4f1ea", sky_image: "", floor_image: "", wall_front_image: "", wall_back_image: "", wall_left_image: "", wall_right_image: "", show_grid: true, show_floor: true };
  if (!app.scene.background.sky_image && app.scene.background.image_path) app.scene.background.sky_image = app.scene.background.image_path;
  if (!("floor_image" in app.scene.background)) app.scene.background.floor_image = "";
  if (!("wall_front_image" in app.scene.background)) app.scene.background.wall_front_image = "";
  if (!("wall_back_image" in app.scene.background)) app.scene.background.wall_back_image = "";
  if (!("wall_left_image" in app.scene.background)) app.scene.background.wall_left_image = "";
  if (!("wall_right_image" in app.scene.background)) app.scene.background.wall_right_image = "";
  if (!("show_grid" in app.scene.background)) app.scene.background.show_grid = true;
  if (!("show_floor" in app.scene.background)) app.scene.background.show_floor = true;
  return app.scene.background;
}

function validBackgroundUrl(value) {
  const text = String(value || "").trim();
  return /^\/backgrounds\/[A-Za-z0-9_. -]+\.(png|jpg|jpeg|webp)$/i.test(text) && !text.includes("..") && !text.includes("\\");
}

async function uploadBackgroundImage(field) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".jpg,.jpeg,.png,.webp";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const form = new FormData();
    try {
      form.append("file", await prepareBackgroundUploadFile(file));
      const response = await fetch("/api/upload/background", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "Background upload failed.");
      pushUndoSnapshot();
      sceneBackground()[field] = data.url || "";
      renderAll();
    } catch (error) {
      app.exportStatus = error.message || String(error);
      renderExportPanel();
    }
  }, { once: true });
  input.click();
}

function backgroundFieldForFilename(filename) {
  const stem = String(filename || "").replace(/\\/g, "/").split("/").pop().replace(/\.[^.]*$/, "").trim().toLowerCase();
  const aliases = {
    sky: "sky_image",
    floor: "floor_image",
    front: "wall_front_image",
    back: "wall_back_image",
    left: "wall_left_image",
    right: "wall_right_image",
  };
  return aliases[stem] || "";
}

async function uploadBackgroundSet() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".jpg,.jpeg,.png,.webp";
  input.multiple = true;
  input.addEventListener("change", async () => {
    const files = [...(input.files || [])];
    if (!files.length) return;
    const recognized = files.filter((file) => backgroundFieldForFilename(file.name));
    if (!recognized.length) {
      app.exportStatus = "Use filenames sky, floor, front, back, left, or right with PNG/JPG/WEBP extensions.";
      renderExportPanel();
      return;
    }
    const form = new FormData();
    try {
      for (const file of recognized) {
        form.append("file", await prepareBackgroundUploadFile(file));
      }
      const response = await fetch("/api/upload/background", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "Background upload failed.");
      pushUndoSnapshot();
      const background = sceneBackground();
      for (const item of data.files || []) {
        const field = backgroundFieldForFilename(item.filename);
        if (field && item.url) background[field] = item.url;
      }
      renderAll();
    } catch (error) {
      app.exportStatus = error.message || String(error);
      renderExportPanel();
    }
  }, { once: true });
  input.click();
}

async function prepareBackgroundUploadFile(file) {
  return app.backgroundImportRotate180 ? rotateImageFile180(file) : file;
}

async function rotateImageFile180(file) {
  const image = await loadImageFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare background image for rotation.");
  ctx.translate(canvas.width, canvas.height);
  ctx.rotate(Math.PI);
  ctx.drawImage(image, 0, 0);
  URL.revokeObjectURL(image.src);
  const mimeType = file.type && /^image\/(png|jpeg|webp)$/i.test(file.type) ? file.type : "image/png";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, 0.92));
  if (!blob) throw new Error("Could not rotate background image before upload.");
  return new File([blob], file.name, { type: mimeType, lastModified: Date.now() });
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new Error(`Could not read background image ${file.name}.`));
    };
    image.src = URL.createObjectURL(file);
  });
}

function cachedBackgroundImage(url) {
  if (!validBackgroundUrl(url)) return null;
  const cached = backgroundImageCache.get(url);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const image = new Image();
  image.onload = () => renderShotPreview();
  image.onerror = () => backgroundImageCache.delete(url);
  image.src = url;
  backgroundImageCache.set(url, image);
  return null;
}

function completeEnvironmentScenes() {
  return (app.scenes || []).filter((scene) => scene.has_complete_background);
}

async function applyEnvironmentFromScene() {
  const select = $("#environmentSceneSelect");
  const name = select?.value || "";
  if (!name) return;
  try {
    const response = await fetch(`/api/load?name=${encodeURIComponent(name)}`);
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || data.message || "Could not load background scene.");
    const source = data.scene?.background;
    if (!source) throw new Error("Selected scene does not include a background.");
    pushUndoSnapshot();
    const target = sceneBackground();
    target.color = source.color || target.color || "#f4f1ea";
    target.sky_image = validBackgroundUrl(source.sky_image) ? source.sky_image : "";
    target.floor_image = validBackgroundUrl(source.floor_image) ? source.floor_image : "";
    target.wall_front_image = validBackgroundUrl(source.wall_front_image) ? source.wall_front_image : "";
    target.wall_back_image = validBackgroundUrl(source.wall_back_image) ? source.wall_back_image : "";
    target.wall_left_image = validBackgroundUrl(source.wall_left_image) ? source.wall_left_image : "";
    target.wall_right_image = validBackgroundUrl(source.wall_right_image) ? source.wall_right_image : "";
    target.show_grid = source.show_grid !== false;
    target.show_floor = source.show_floor !== false;
    app.exportStatus = `Applied background from ${name}.`;
    renderAll();
  } catch (error) {
    app.exportStatus = error.message || String(error);
    renderExportPanel();
  }
}

function avatarOptionsHtml(character) {
  const value = character.avatar_asset || "";
  const options = [`<option value="" ${value ? "" : "selected"}>${app.avatarAssets.length ? "Not assigned" : "No final avatar sources found"}</option>`];
  let matched = !value;
  for (const asset of app.avatarAssets) {
    const selected = value === asset.label || (value === asset.path && asset.kind === "up2you");
    matched = matched || selected;
    options.push(`<option value="${escapeHtml(asset.label)}" ${selected ? "selected" : ""}>${escapeHtml(asset.label)}</option>`);
  }
  if (value && !matched) {
    options.push(`<option value="${escapeHtml(value)}" selected>${escapeHtml(value)}</option>`);
  }
  return options.join("");
}

function proxyOptionsHtml(character) {
  const value = app.proxyAssets.includes(character.proxy_asset) ? character.proxy_asset : defaultProxyAsset();
  const options = app.proxyAssets.map((asset) => {
    const selected = asset === value;
    return `<option value="${escapeHtml(asset)}" ${selected ? "selected" : ""}>${escapeHtml(asset)}</option>`;
  });
  if (!options.length) {
    options.push(`<option value="${escapeHtml(value)}" selected>${escapeHtml(value)}</option>`);
  }
  return options.join("");
}

function missingFinalAvatarLabels() {
  return app.scene.characters
    .filter((character) => !String(character.avatar_asset || "").trim())
    .map((character) => character.label || character.id);
}

function activeClipAt(character, time) {
  return sortedClips(character).find((clip) => time >= clip.start && time <= clip.start + clip.duration) || null;
}

function clipEndTime(clip) {
  return Number(clip.start || 0) + Math.max(0, Number(clip.duration || 0));
}

function motionSourceDuration(motion) {
  return Math.max(0.001, Number(motion?.duration || motion?.preview?.duration || 1));
}

function hasClipTrimEndValue(clip) {
  return clip?.trim_end !== undefined && clip?.trim_end !== null && clip?.trim_end !== "";
}

function normalizedClipTrimStart(clip, motion) {
  const sourceDuration = motionSourceDuration(motion);
  return clamp(Number(clip?.trim_start || 0), 0, Math.max(0, sourceDuration - 0.001));
}

function normalizedClipTrimEnd(clip, motion) {
  const sourceDuration = motionSourceDuration(motion);
  const trimStart = normalizedClipTrimStart(clip, motion);
  if (!hasClipTrimEndValue(clip)) return sourceDuration;
  const value = Number(clip.trim_end);
  return Number.isFinite(value) ? clamp(value, trimStart + 0.001, sourceDuration) : sourceDuration;
}

function clipSourceSpan(clip, motion) {
  return Math.max(0.001, normalizedClipTrimEnd(clip, motion) - normalizedClipTrimStart(clip, motion));
}

function clipPlaybackSpeed(clip, motion) {
  return clipSourceSpan(clip, motion) / Math.max(0.001, Number(clip.duration || 0));
}

function normalizedClipBlendIn(clip) {
  return normalizedClipBlend(clip, "blend_in");
}

function normalizedClipBlendOut(clip) {
  return normalizedClipBlend(clip, "blend_out");
}

function defaultClipBlend(clip) {
  return Math.min(DEFAULT_CLIP_BLEND_SECONDS, Math.max(0.05, Number(clip.duration || 0) * 0.3));
}

function hasClipBlendValue(clip, key) {
  return clip?.[key] !== undefined && clip?.[key] !== null && clip?.[key] !== "";
}

function normalizedClipBlend(clip, key) {
  const duration = Math.max(0, Number(clip.duration || 0));
  if (!hasClipBlendValue(clip, key)) return defaultClipBlend(clip);
  const value = Number(clip[key]);
  return Number.isFinite(value) ? clamp(value, 0, duration) : defaultClipBlend(clip);
}

function effectiveClipBlendIn(clip) {
  return normalizedClipBlendIn(clip);
}

function effectiveClipBlendOut(clip) {
  return normalizedClipBlendOut(clip);
}

function clipTransitionWindow(first, second) {
  const firstEnd = clipEndTime(first);
  const secondStart = Number(second.start || 0);
  const secondEnd = clipEndTime(second);
  const blendOut = effectiveClipBlendOut(first);
  const blendIn = effectiveClipBlendIn(second);
  const overlapStart = secondStart;
  const overlapEnd = Math.min(firstEnd, secondEnd);
  if (overlapEnd > overlapStart + 1e-6) {
    return {
      start: Math.min(overlapStart, firstEnd - blendOut),
      end: Math.max(overlapEnd, secondStart + blendIn),
    };
  }
  if (secondStart - firstEnd > MAX_TRANSITION_GAP_SECONDS) return null;
  if (blendOut <= 1e-6 && blendIn <= 1e-6) return null;
  return { start: firstEnd - blendOut, end: secondStart + blendIn };
}

function transitionAt(character, time) {
  const clips = sortedClips(character);
  for (let index = 0; index < clips.length - 1; index += 1) {
    const previous = clips[index];
    const next = clips[index + 1];
    const window = clipTransitionWindow(previous, next);
    if (!window || window.end <= window.start + 1e-6) continue;
    if (time >= window.start && time <= window.end) {
      return { previous, next, window };
    }
  }
  return null;
}

function selectedClipRef() {
  if (app.selection.type !== "clip") return null;
  const character = characterById(app.selection.characterId);
  const clip = sortedClips(character)[app.selection.index];
  return clip ? { character, clip } : null;
}

function selectedRootRef() {
  if (app.selection.type !== "root") return null;
  const character = characterById(app.selection.characterId);
  const key = sortedKeys(character)[app.selection.index];
  return key ? { character, key } : null;
}

function selectedCameraKeyRef() {
  if (app.selection.type !== "camera_key") return null;
  const camera = sceneCamera();
  const key = cameraKeyframes(camera)[app.selection.index];
  return key ? { camera, key } : null;
}

function selectClipByRef(character, clip) {
  const index = sortedClips(character).indexOf(clip);
  setSelection({ type: "clip", characterId: character.id, index: Math.max(0, index) });
}

function selectRootById(character, keyId) {
  const index = sortedKeys(character).findIndex((key) => key.id === keyId);
  setSelection({ type: "root", characterId: character.id, index: Math.max(0, index) });
}

function selectCameraKeyById(keyId) {
  const index = cameraKeyframes().findIndex((key) => key.id === keyId);
  setSelection({ type: "camera_key", index: Math.max(0, index) });
}

function replaceSelectedClipMotion(label) {
  const clipRef = selectedClipRef();
  const motion = exactMotionByLabel(label);
  if (!clipRef || !motion) return false;
  app.selectedMotion = motion.label;
  app.motionPreviewTime = 0;
  app.collapsedMotionCategories.delete(motionCategory(motion));
  if (clipRef.clip.clip !== motion.label) {
    pushUndoSnapshot();
    clipRef.clip.clip = motion.label;
    clipRef.clip.root_mode = defaultRootModeForMotion(motion);
  }
  selectClipByRef(clipRef.character, clipRef.clip);
  return true;
}

function syncLibrarySelectionForClip(selection) {
  if (selection.type !== "clip") return;
  const character = characterById(selection.characterId);
  const clip = sortedClips(character)[selection.index];
  const motion = clip ? exactMotionByLabel(clip.clip) : null;
  if (!motion) return;
  app.selectedMotion = motion.label;
  app.motionPreviewTime = 0;
  app.collapsedMotionCategories.delete(motionCategory(motion));
}

function setSelection(selection) {
  app.selection = selection;
  if (selection.characterId) app.selectedCharacterId = selection.characterId;
  syncLibrarySelectionForClip(selection);
  renderAll();
}

async function loadBootstrap() {
  const response = await fetch("/api/bootstrap");
  const data = await response.json();
  app.scene = data.scene;
  app.motions = data.motions;
  app.proxyAssets = data.proxy_assets;
  app.proxyAssetPreviews = data.proxy_asset_previews || {};
  app.avatarAssets = data.avatar_assets || [];
  app.scenes = data.scenes;
  app.warnings = data.warnings || [];
  normalizeEditorScene();
  pruneHiddenCharacters();
  app.selectedCharacterId = app.scene.characters[0]?.id || null;
  app.selectedMotion = visibleMotions()[0]?.label || app.motions[0]?.label || "Idle Breathing";
  loadPanelWidths();
  loadPanelHeights();
  bindStaticEvents();
  renderAll();
  requestAnimationFrame(tick);
}

function bindStaticEvents() {
  $("#startButton").addEventListener("click", () => {
    jumpToStart();
  });
  $("#playButton").addEventListener("click", () => {
    togglePlayback();
  });
  $("#durationInput").addEventListener("input", (event) => {
    beginSceneControlEdit("duration");
    setSceneDuration(Number(event.target.value));
  });
  $("#durationInput").addEventListener("change", () => endSceneControlEdit("duration"));
  $("#durationInput").addEventListener("blur", () => endSceneControlEdit("duration"));
  $("#zoomInput").addEventListener("input", (event) => {
    setTimelineZoom(Number(event.target.value));
  });
  $("#motionFilter").addEventListener("input", renderMotionList);
  $("#importHyMotionButton")?.addEventListener("click", () => $("#hyMotionImportInput")?.click());
  $("#hyMotionImportInput")?.addEventListener("change", importHyMotionClip);
  $("#libraryResizeHandle")?.addEventListener("pointerdown", (event) => startPanelResize(event, "library"));
  $("#inspectorResizeHandle")?.addEventListener("pointerdown", (event) => startPanelResize(event, "inspector"));
  $("#timelineResizeHandle")?.addEventListener("pointerdown", (event) => startPanelResize(event, "timeline"));
  $("#rightRailResizeHandle")?.addEventListener("pointerdown", (event) => startPanelResize(event, "preview"));
  $("#libraryResizeHandle")?.addEventListener("keydown", (event) => handlePanelResizeKey(event, "library"));
  $("#inspectorResizeHandle")?.addEventListener("keydown", (event) => handlePanelResizeKey(event, "inspector"));
  $("#timelineResizeHandle")?.addEventListener("keydown", (event) => handlePanelResizeKey(event, "timeline"));
  $("#rightRailResizeHandle")?.addEventListener("keydown", (event) => handlePanelResizeKey(event, "preview"));
  $("#addCharacterButton").addEventListener("click", addCharacter);
  $("#addWaypointButton").addEventListener("click", addWaypointAtPlayhead);
  $("#deleteSelectionButton").addEventListener("click", deleteSelection);
  $("#stageZoomOutButton").addEventListener("click", () => zoomStageBy(1 / 1.22));
  $("#stageZoomInButton").addEventListener("click", () => zoomStageBy(1.22));
  $("#stageFitButton").addEventListener("click", fitStageToScene);
  $("#undoButton").addEventListener("click", undoSceneChange);
  $("#redoButton").addEventListener("click", redoSceneChange);
  $("#saveButton").addEventListener("click", saveScene);
  $("#loadButton").addEventListener("click", loadSelectedScene);
  $("#stageSvg").addEventListener("pointerdown", stagePointerDown);
  $("#stageSvg").addEventListener("wheel", stageWheel, { passive: false });
  $("#timelineScroller").addEventListener("wheel", timelineWheel, { passive: false });
  $("#timelineScroller").addEventListener("pointerdown", timelineScrollerPointerDown);
  $("#timelineSvg").addEventListener("pointerdown", timelinePointerDown);
  document.addEventListener("pointermove", pointerMove);
  document.addEventListener("pointerup", pointerUp);
  document.addEventListener("pointercancel", pointerUp);
  document.addEventListener("keydown", handleKeyboardShortcuts);
  window.addEventListener("resize", handleEditorLayoutResize);
}

function handleEditorLayoutResize() {
  applyPanelLayout();
  if (!app.scene) return;
  renderStage();
  renderTimeline();
}

function handleKeyboardShortcuts(event) {
  const key = event.key;
  const command = event.metaKey || event.ctrlKey;
  const lowerKey = key.toLowerCase();

  if (command && lowerKey === "s") {
    event.preventDefault();
    saveScene();
    return;
  }

  if (isEditableTarget(event.target)) return;

  if (command && lowerKey === "z") {
    event.preventDefault();
    if (event.shiftKey) redoSceneChange();
    else undoSceneChange();
    return;
  }
  if (command && lowerKey === "y") {
    event.preventDefault();
    redoSceneChange();
    return;
  }
  if (key === " " || key === "Spacebar") {
    event.preventDefault();
    togglePlayback();
    return;
  }
  if (key === "Home") {
    event.preventDefault();
    jumpToStart();
    return;
  }
  if (key === "Delete" || key === "Backspace") {
    event.preventDefault();
    deleteSelection();
    return;
  }
  if (command && lowerKey === "d") {
    event.preventDefault();
    duplicateSelection();
    return;
  }
  if (command && (key === "=" || key === "+")) {
    event.preventDefault();
    zoomTimelineBy(1.18);
    return;
  }
  if (command && (key === "-" || key === "_")) {
    event.preventDefault();
    zoomTimelineBy(1 / 1.18);
    return;
  }
  if (command && key === "0") {
    event.preventDefault();
    fitTimelineToDuration();
    return;
  }
  if (key.startsWith("Arrow") && !command) {
    handleArrowShortcut(event);
  }
}

function isEditableTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, .panel-resizer") || target?.isContentEditable);
}

function togglePlayback() {
  app.playing = !app.playing;
  updateTransportIcon();
}

function jumpToStart() {
  app.currentTime = 0;
  app.playing = false;
  updateTransportIcon();
  renderAll();
  ensureTimelinePlayheadVisible({ center: true });
}

function setCurrentTime(time) {
  app.currentTime = clamp(time, 0, app.scene.duration);
  app.playing = false;
  updateTransportIcon();
  renderAll();
  ensureTimelinePlayheadVisible({ center: true });
}

function setSceneDuration(duration) {
  app.scene.duration = Math.max(1, Number(duration) || 1);
  app.currentTime = clamp(app.currentTime, 0, app.scene.duration);
  renderAll();
  ensureTimelinePlayheadVisible();
}

function shiftSceneTimeKeysAtOrAfter(atTime, amount) {
  const threshold = Math.max(0, Number(atTime) || 0);
  const delta = Math.max(0, Number(amount) || 0);
  if (delta <= 0) return false;
  pushUndoSnapshot();
  app.scene.duration = Math.max(1, Number(app.scene.duration) || 1) + delta;
  app.scene.characters.forEach((character) => {
    if (Array.isArray(character.track)) {
      character.track.forEach((clip) => {
        const start = Number(clip.start) || 0;
        if (start >= threshold - 1e-6) clip.start = Number((start + delta).toFixed(6));
      });
    }
    if (Array.isArray(character.root_keys)) {
      character.root_keys.forEach((key) => {
        const time = Number(key.time) || 0;
        if (time >= threshold - 1e-6) key.time = Number((time + delta).toFixed(6));
      });
    }
  });
  const camera = sceneCamera();
  cameraKeyframes(camera).forEach((key) => {
    const time = Number(key.time) || 0;
    if (time >= threshold - 1e-6) key.time = Number((time + delta).toFixed(6));
  });
  app.currentTime = threshold;
  normalizeEditorScene();
  renderAll();
  ensureTimelinePlayheadVisible({ center: true });
  return true;
}

function insertTimeAtPlayhead() {
  const atTime = clamp(Number(app.currentTime) || 0, 0, Number(app.scene.duration) || 0);
  const input = window.prompt(`Insert how many seconds at ${atTime.toFixed(2)}s?`, "3");
  if (input === null) return;
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0) {
    window.alert("Enter a positive number of seconds.");
    return;
  }
  shiftSceneTimeKeysAtOrAfter(atTime, amount);
}

function timelineScroller() {
  return $("#timelineScroller");
}

function timelineContentWidth() {
  return TIMELINE_LEFT + app.scene.duration * app.pixelsPerSecond + 80;
}

function timelinePlayheadX() {
  return TIMELINE_LEFT + app.currentTime * app.pixelsPerSecond;
}

function setTimelineZoom(value, anchorClientX = null) {
  const scroller = timelineScroller();
  const previousZoom = app.pixelsPerSecond;
  const nextZoom = clamp(Number(value) || previousZoom, TIMELINE_ZOOM_MIN, TIMELINE_ZOOM_MAX);
  const rect = scroller.getBoundingClientRect();
  const anchorOffset = anchorClientX === null ? scroller.clientWidth * 0.5 : clamp(anchorClientX - rect.left, 0, scroller.clientWidth);
  const anchorX = scroller.scrollLeft + anchorOffset;
  const anchorTime = clamp((anchorX - TIMELINE_LEFT) / previousZoom, 0, app.scene.duration);

  app.pixelsPerSecond = nextZoom;
  $("#zoomInput").value = nextZoom;
  updateZoomReadout();
  renderTimeline();

  const nextAnchorX = TIMELINE_LEFT + anchorTime * app.pixelsPerSecond;
  scroller.scrollLeft = Math.max(0, nextAnchorX - anchorOffset);
}

function zoomTimelineBy(factor, anchorClientX = null) {
  setTimelineZoom(app.pixelsPerSecond * factor, anchorClientX);
}

function fitTimelineToDuration() {
  const scroller = timelineScroller();
  const available = Math.max(180, scroller.clientWidth - TIMELINE_LEFT - 80);
  setTimelineZoom(available / Math.max(0.001, app.scene.duration));
  scroller.scrollLeft = 0;
}

function ensureTimelinePlayheadVisible({ center = false } = {}) {
  const scroller = timelineScroller();
  if (!scroller) return;
  const playX = timelinePlayheadX();
  const margin = 48;
  if (center) {
    scroller.scrollLeft = Math.max(0, playX - scroller.clientWidth * 0.5);
  } else if (playX < scroller.scrollLeft + margin) {
    scroller.scrollLeft = Math.max(0, playX - margin);
  } else if (playX > scroller.scrollLeft + scroller.clientWidth - margin) {
    scroller.scrollLeft = Math.max(0, playX - scroller.clientWidth + margin);
  }
}

function timelineWheel(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    event.preventDefault();
    zoomTimelineBy(Math.exp(-event.deltaY * 0.0016), event.clientX);
    return;
  }
  if (event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    event.preventDefault();
    timelineScroller().scrollLeft += event.deltaY;
  }
}

function timelineScrollerPointerDown(event) {
  if (event.target !== timelineScroller()) return;
  event.preventDefault();
  app.selection = { type: "scene" };
  app.timelineSnap = null;
  renderAll();
}

function handleArrowShortcut(event) {
  const coarse = event.shiftKey;
  const timeStep = coarse ? 1 : 0.1;
  const pathStep = coarse ? 0.25 : 0.05;
  let handled = false;

  if (app.selection.type === "clip" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    const delta = event.key === "ArrowLeft" ? -timeStep : timeStep;
    handled = nudgeSelectedClip(delta);
  } else if (app.selection.type === "root" && event.altKey) {
    const dx = event.key === "ArrowLeft" ? -pathStep : event.key === "ArrowRight" ? pathStep : 0;
    const dy = event.key === "ArrowDown" ? -pathStep : event.key === "ArrowUp" ? pathStep : 0;
    handled = nudgeSelectedRootPosition(dx, dy);
  } else if (app.selection.type === "root" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    const delta = event.key === "ArrowLeft" ? -timeStep : timeStep;
    handled = nudgeSelectedRootTime(delta);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const delta = event.key === "ArrowLeft" ? -timeStep : timeStep;
    setCurrentTime(snapTime(app.currentTime + delta));
    handled = true;
  }

  if (handled) event.preventDefault();
}

function tick(timestamp) {
  if (!app.lastFrameTime) app.lastFrameTime = timestamp;
  const dt = (timestamp - app.lastFrameTime) / 1000;
  app.lastFrameTime = timestamp;
  if (app.playing) {
    app.currentTime = (app.currentTime + dt) % Math.max(0.01, app.scene.duration);
    renderStage();
    renderTimeline();
    ensureTimelinePlayheadVisible();
    renderShotPreview();
    updateTimeReadout();
  }
  if ($("#motionPreviewCanvas")) {
    const motion = motionByLabel(app.selectedMotion);
    app.motionPreviewTime = (app.motionPreviewTime + dt) % Math.max(0.001, Number(motion.duration) || 1);
    renderMotionPreview();
  }
  requestAnimationFrame(tick);
}

function renderAll() {
  normalizeEditorScene();
  renderTopbar();
  renderHyMotionImportStatus();
  renderMotionList();
  renderMotionPreviewPanel();
  renderStage();
  renderTimeline();
  renderInspector();
  renderExportPanel();
  renderWarnings();
}

function renderTopbar() {
  const durationInput = $("#durationInput");
  durationInput.max = Math.max(60, Math.ceil(app.scene.duration));
  durationInput.value = app.scene.duration;
  const zoomInput = $("#zoomInput");
  zoomInput.min = TIMELINE_ZOOM_MIN;
  zoomInput.max = TIMELINE_ZOOM_MAX;
  zoomInput.value = app.pixelsPerSecond;
  updateTimeReadout();
  updateDurationReadout();
  updateZoomReadout();
  updateTransportIcon();
  updateHistoryButtons();
  updateTimelineActionButtons();
  const select = $("#sceneSelect");
  select.innerHTML = "";
  for (const scene of app.scenes) {
    const option = document.createElement("option");
    option.value = scene.name;
    option.textContent = scene.name;
    select.appendChild(option);
  }
}

function updateHistoryButtons() {
  const undoButton = $("#undoButton");
  const redoButton = $("#redoButton");
  if (undoButton) undoButton.disabled = app.history.undo.length === 0;
  if (redoButton) redoButton.disabled = app.history.redo.length === 0;
}

function updateTimelineActionButtons() {
  const deleteButton = $("#deleteSelectionButton");
  if (!deleteButton) return;
  const action = selectedDeleteAction();
  deleteButton.disabled = !action.enabled;
  deleteButton.setAttribute("aria-label", action.label);
  deleteButton.setAttribute("title", action.label);
}

function updateTransportIcon() {
  const icon = $("#playIcon");
  if (!icon) return;
  icon.className = `transport-icon ${app.playing ? "icon-pause" : "icon-play"}`;
  $("#playButton").setAttribute("aria-label", app.playing ? "Pause" : "Play");
  $("#playButton").setAttribute("title", app.playing ? "Pause" : "Play");
}

function updateTimeReadout() {
  $("#timeReadout").textContent = `${app.currentTime.toFixed(2)} / ${app.scene.duration.toFixed(2)}s`;
}

function updateDurationReadout() {
  const readout = $("#durationReadout");
  if (readout) readout.textContent = `${app.scene.duration.toFixed(1)}s`;
}

function updateZoomReadout() {
  const readout = $("#zoomReadout");
  if (readout) readout.textContent = `${Math.round(app.pixelsPerSecond)} px/s`;
}

function renderHyMotionImportStatus() {
  const status = $("#hyMotionImportStatus");
  if (status) {
    status.textContent = app.hyMotionImportStatus || "";
    status.classList.toggle("error", app.hyMotionImportError);
  }
  const button = $("#importHyMotionButton");
  if (button) {
    button.disabled = app.hyMotionImportInProgress;
    const label = button.querySelector(".tool-button-label");
    if (label) label.textContent = app.hyMotionImportInProgress ? "Importing..." : "Import HY-Motion";
  }
}

function setHyMotionImportStatus(message, isError = false) {
  app.hyMotionImportStatus = message;
  app.hyMotionImportError = isError;
  renderHyMotionImportStatus();
}

function fileBaseName(name) {
  const normalized = String(name || "").replaceAll("\\", "/");
  return normalized.split("/").pop() || "";
}

function fileSuffix(name) {
  const base = fileBaseName(name);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

function fileStem(name) {
  const base = fileBaseName(name);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

function validateHyMotionFiles(files) {
  if (files.length !== 2) return "Select exactly one HY-Motion .fbx file and one matching .txt file.";
  const fbxFiles = files.filter((file) => fileSuffix(file.name) === ".fbx");
  const txtFiles = files.filter((file) => fileSuffix(file.name) === ".txt");
  if (fbxFiles.length !== 1 || txtFiles.length !== 1) return "HY-Motion import requires one .fbx file and one .txt prompt file.";
  if (fileStem(fbxFiles[0].name) !== fileStem(txtFiles[0].name)) return "The .fbx and .txt files must have the same base filename.";
  return "";
}

async function importHyMotionClip(event) {
  const input = event.target;
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const validationError = validateHyMotionFiles(files);
  if (validationError) {
    setHyMotionImportStatus(validationError, true);
    input.value = "";
    return;
  }

  app.hyMotionImportInProgress = true;
  setHyMotionImportStatus("Importing HY-Motion clip...", false);
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file, file.name));

  try {
    const response = await fetch("/api/import/hy-motion", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    app.motions = data.motions || app.motions;
    if (data.motion?.label) {
      app.selectedMotion = data.motion.label;
      app.motionPreviewTime = 0;
      app.collapsedMotionCategories.delete(motionCategory(data.motion));
    }
    app.hyMotionImportStatus = data.message || "Imported HY-Motion clip.";
    app.hyMotionImportError = false;
  } catch (error) {
    app.hyMotionImportStatus = `Import failed: ${error.message || error}`;
    app.hyMotionImportError = true;
  } finally {
    app.hyMotionImportInProgress = false;
    input.value = "";
    renderAll();
  }
}

function renderMotionList() {
  const list = $("#motionList");
  const filter = $("#motionFilter").value.trim().toLowerCase();
  list.innerHTML = "";
  const motions = visibleMotions()
    .filter((motion) => {
      const text = `${motion.label} ${motionCategoryLabel(motion)} ${rootContractLabel(motion)} ${(motion.tags || []).join(" ")}`;
      return !filter || text.toLowerCase().includes(filter);
    })
    .sort((a, b) => (
      motionCategoryRank(a) - motionCategoryRank(b)
      || motionLibraryRank(a) - motionLibraryRank(b)
      || motionCategoryLabel(a).localeCompare(motionCategoryLabel(b))
      || motionSortText(a).localeCompare(motionSortText(b))
    ));

  const groups = [];
  let currentGroup = null;
  motions.forEach((motion) => {
    const category = motionCategory(motion);
    if (!currentGroup || currentGroup.category !== category) {
      currentGroup = { category, label: motionCategoryLabel(motion), motions: [] };
      groups.push(currentGroup);
    }
    currentGroup.motions.push(motion);
  });

  groups.forEach((group) => {
    const collapsed = !filter && app.collapsedMotionCategories.has(group.category);
    const heading = document.createElement("button");
    heading.type = "button";
    heading.className = `motion-group-heading ${collapsed ? "collapsed" : ""}`;
    heading.setAttribute("aria-expanded", String(!collapsed));
    heading.title = collapsed ? `Show ${group.label}` : `Hide ${group.label}`;
    heading.setAttribute("aria-label", heading.title);

    const label = document.createElement("span");
    label.className = "motion-group-title";
    label.textContent = group.label;
    const count = document.createElement("span");
    count.className = "motion-group-count";
    count.textContent = String(group.motions.length);
    const icon = document.createElement("span");
    icon.className = `toggle-icon ${collapsed ? "icon-chevron-down" : "icon-chevron-up"}`;
    heading.append(label, count, icon);
    heading.addEventListener("click", () => toggleMotionCategory(group.category));
    list.appendChild(heading);

    if (collapsed) return;
    group.motions.forEach((motion) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `motion-item ${motion.label === app.selectedMotion ? "selected" : ""}`;
      button.title = app.selection.type === "clip" ? "Click to replace selected clip, or drag to timeline" : "Drag to timeline or double-click to add";
      const loop = motion.loopable ? " | loop" : "";
      button.innerHTML = `<div class="motion-name">${escapeHtml(motion.label)}</div><div class="motion-meta">${rootContractLabel(motion)} | ${Number(motion.duration).toFixed(1)}s${loop}</div>`;
      button.addEventListener("pointerdown", (event) => startMotionLibraryDrag(event, motion.label, button));
      button.addEventListener("click", (event) => {
        if (app.suppressMotionClick) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (replaceSelectedClipMotion(motion.label)) {
          event.preventDefault();
          return;
        }
        app.selectedMotion = motion.label;
        app.motionPreviewTime = 0;
        list.querySelectorAll(".motion-item.selected").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        renderMotionPreviewPanel();
      });
      button.addEventListener("dblclick", (event) => {
        if (replaceSelectedClipMotion(motion.label)) {
          event.preventDefault();
          return;
        }
        appendClipToSelectedCharacter(motion.label);
      });
      list.appendChild(button);
    });
  });
  const selectedItem = list.querySelector(".motion-item.selected");
  if (selectedItem) requestAnimationFrame(() => selectedItem.scrollIntoView({ block: "nearest" }));
}

function toggleMotionCategory(category) {
  if (app.collapsedMotionCategories.has(category)) app.collapsedMotionCategories.delete(category);
  else app.collapsedMotionCategories.add(category);
  renderMotionList();
}

function stageView() {
  if (!app.stageView) app.stageView = { zoom: 1, panX: 0, panY: 0 };
  app.stageView.zoom = clamp(Number(app.stageView.zoom) || 1, STAGE_ZOOM_MIN, STAGE_ZOOM_MAX);
  app.stageView.panX = Number(app.stageView.panX) || 0;
  app.stageView.panY = Number(app.stageView.panY) || 0;
  return app.stageView;
}

function stageViewportSize(svg = $("#stageSvg")) {
  const rect = svg?.getBoundingClientRect?.();
  const width = Math.max(1, Number(rect?.width || svg?.clientWidth || STAGE_WIDTH));
  const height = Math.max(1, Number(rect?.height || svg?.clientHeight || STAGE_HEIGHT));
  return { width, height };
}

function stageViewBox(size = stageViewportSize()) {
  const view = stageView();
  const width = size.width / view.zoom;
  const height = size.height / view.zoom;
  return {
    x: (size.width - width) / 2 + view.panX,
    y: (size.height - height) / 2 + view.panY,
    width,
    height,
  };
}

function setStageViewFromBox(box, zoom, size = stageViewportSize()) {
  const view = stageView();
  view.zoom = clamp(Number(zoom) || view.zoom, STAGE_ZOOM_MIN, STAGE_ZOOM_MAX);
  const width = size.width / view.zoom;
  const height = size.height / view.zoom;
  view.panX = box.x - (size.width - width) / 2;
  view.panY = box.y - (size.height - height) / 2;
}

function setStageViewBox(svg) {
  const size = stageViewportSize(svg);
  const box = stageViewBox(size);
  svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
}

function updateStageZoomControls() {
  const view = stageView();
  const readout = $("#stageZoomReadout");
  if (readout) readout.textContent = `${Math.round(view.zoom * 100)}%`;
  const zoomOut = $("#stageZoomOutButton");
  const zoomIn = $("#stageZoomInButton");
  if (zoomOut) zoomOut.disabled = view.zoom <= STAGE_ZOOM_MIN + 0.001;
  if (zoomIn) zoomIn.disabled = view.zoom >= STAGE_ZOOM_MAX - 0.001;
}

function renderStage() {
  const svg = $("#stageSvg");
  setStageViewBox(svg);
  updateStageZoomControls();
  clear(svg);
  drawStageGrid(svg);
  app.scene.characters.forEach((character, index) => {
    if (!isCharacterHidden(character)) drawCharacterPath(svg, character, index);
  });
  drawWaypointStackBadges(svg);
  drawCameraOnStage(svg);
}

function drawStageGrid(svg) {
  const size = stageViewportSize(svg);
  const box = stageViewBox(size);
  const originX = size.width / 2;
  const originY = size.height / 2;
  const minWorldX = Math.floor((box.x - originX) / STAGE_SCALE) - 1;
  const maxWorldX = Math.ceil((box.x + box.width - originX) / STAGE_SCALE) + 1;
  const topWorldY = (originY - box.y) / STAGE_SCALE;
  const bottomWorldY = (originY - (box.y + box.height)) / STAGE_SCALE;
  const minWorldY = Math.floor(Math.min(topWorldY, bottomWorldY)) - 1;
  const maxWorldY = Math.ceil(Math.max(topWorldY, bottomWorldY)) + 1;
  for (let x = minWorldX; x <= maxWorldX; x += 1) {
    const stageX = originX + x * STAGE_SCALE;
    svg.appendChild(makeSvg("line", { x1: stageX, y1: box.y, x2: stageX, y2: box.y + box.height, stroke: "#d7dedb", "stroke-width": x === 0 ? 1.8 : 1 }));
  }
  for (let y = minWorldY; y <= maxWorldY; y += 1) {
    const stageY = originY - y * STAGE_SCALE;
    svg.appendChild(makeSvg("line", { x1: box.x, y1: stageY, x2: box.x + box.width, y2: stageY, stroke: "#d7dedb", "stroke-width": y === 0 ? 1.8 : 1 }));
  }
}

function worldToStage(position) {
  const size = stageViewportSize();
  return { x: size.width / 2 + position[0] * STAGE_SCALE, y: size.height / 2 - position[1] * STAGE_SCALE };
}

function stageWaypointRefs() {
  const refs = [];
  for (const character of app.scene.characters) {
    if (isCharacterHidden(character)) continue;
    sortedKeys(character).forEach((key, index) => {
      refs.push({ character, index, key, point: worldToStage(key.position) });
    });
  }
  return refs;
}

function stageDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function stageWaypointRefsNear(point, radius = WAYPOINT_STACK_RADIUS) {
  return stageWaypointRefs().filter((ref) => stageDistance(ref.point, point) <= radius);
}

function stageRefMatchesSelection(ref) {
  return app.selection.type === "root" && app.selection.characterId === ref.character.id && app.selection.index === ref.index;
}

function stageRefMatchesDataset(ref, target) {
  return ref.character.id === target?.dataset?.character && ref.index === Number(target?.dataset?.index);
}

function compactStageRef(ref) {
  return { characterId: ref.character.id, keyId: ref.key.id };
}

function resolveCompactStageRefs(compactRefs) {
  return compactRefs.map((item) => {
    const character = characterById(item.characterId);
    const keys = sortedKeys(character);
    const index = keys.findIndex((key) => key.id === item.keyId);
    return index >= 0 ? { character, index, key: keys[index], point: worldToStage(keys[index].position) } : null;
  }).filter(Boolean);
}

function cycleStageWaypointSelection(compactRefs) {
  const refs = resolveCompactStageRefs(compactRefs);
  if (refs.length <= 1) return;
  const currentIndex = refs.findIndex(stageRefMatchesSelection);
  const next = refs[(Math.max(0, currentIndex) + 1) % refs.length];
  setSelection({ type: "root", characterId: next.character.id, index: next.index });
}

function stageToWorld(point, z = 0) {
  const size = stageViewportSize();
  return [
    (point.x - size.width / 2) / STAGE_SCALE,
    (size.height / 2 - point.y) / STAGE_SCALE,
    Number.isFinite(Number(z)) ? Number(z) : 0,
  ];
}

function zoomStageBy(factor) {
  const box = stageViewBox();
  zoomStageAt({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, factor);
}

function zoomStageAt(anchor, factor) {
  const size = stageViewportSize();
  const oldBox = stageViewBox(size);
  const oldZoom = stageView().zoom;
  const nextZoom = clamp(oldZoom * factor, STAGE_ZOOM_MIN, STAGE_ZOOM_MAX);
  if (Math.abs(nextZoom - oldZoom) < 0.001) return;
  const ratioX = clamp((anchor.x - oldBox.x) / oldBox.width, 0, 1);
  const ratioY = clamp((anchor.y - oldBox.y) / oldBox.height, 0, 1);
  const nextWidth = size.width / nextZoom;
  const nextHeight = size.height / nextZoom;
  setStageViewFromBox({
    x: anchor.x - ratioX * nextWidth,
    y: anchor.y - ratioY * nextHeight,
    width: nextWidth,
    height: nextHeight,
  }, nextZoom, size);
  renderStage();
}

function stageWheel(event) {
  event.preventDefault();
  const factor = Math.exp(-event.deltaY * 0.0015);
  zoomStageAt(svgPoint($("#stageSvg"), event), factor);
}

function fitStageToScene() {
  const bounds = stageContentBounds();
  if (!bounds) {
    app.stageView = { zoom: 1, panX: 0, panY: 0 };
    renderStage();
    return;
  }
  const padding = 80;
  const size = stageViewportSize();
  const aspect = size.width / size.height;
  let width = Math.max(240, bounds.maxX - bounds.minX + padding * 2);
  let height = Math.max(160, bounds.maxY - bounds.minY + padding * 2);
  if (width / height > aspect) height = width / aspect;
  else width = height * aspect;

  const zoom = clamp(Math.min(1, size.width / width, size.height / height), STAGE_ZOOM_MIN, 1);
  const viewWidth = size.width / zoom;
  const viewHeight = size.height / zoom;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  setStageViewFromBox({
    x: centerX - viewWidth / 2,
    y: centerY - viewHeight / 2,
    width: viewWidth,
    height: viewHeight,
  }, zoom, size);
  renderStage();
}

function stageContentBounds() {
  const points = [];
  for (const character of app.scene.characters) {
    if (isCharacterHidden(character)) continue;
    for (const key of sortedKeys(character)) points.push(worldToStage(key.position));
    points.push(worldToStage(rootAt(character, app.currentTime).position));
  }
  cameraTrajectorySamples().forEach((sample) => points.push(sample.point));
  if (!points.length) return null;
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function drawCharacterPath(svg, character, index) {
  const color = characterColor(character, index);
  const keys = sortedKeys(character);
  drawCharacterPathSegments(svg, character, keys, color);
  keys.forEach((key, keyIndex) => {
    const p = worldToStage(key.position);
    const selected = app.selection.type === "root" && app.selection.characterId === character.id && app.selection.index === keyIndex;
    const keyNode = makeSvg("circle", {
      cx: p.x,
      cy: p.y,
      r: 8,
      class: `stage-key ${selected ? "selected" : ""}`,
      "data-kind": "stage-key",
      "data-character": character.id,
      "data-index": keyIndex,
    });
    svg.appendChild(keyNode);
    const zValue = Number(key.position?.[2] || 0);
    if (Math.abs(zValue) > 0.001) {
      svg.appendChild(makeSvg("text", {
        x: p.x + 10,
        y: p.y + 18,
        class: "stage-z-label",
        "data-kind": "stage-key",
        "data-character": character.id,
        "data-index": keyIndex,
      }, [document.createTextNode(`z=${zValue.toFixed(2)}`)]));
    }
    const angle = (key.facing_degrees * Math.PI) / 180;
    const end = { x: p.x + Math.sin(angle) * 32, y: p.y - Math.cos(angle) * 32 };
    svg.appendChild(makeSvg("line", {
      x1: p.x,
      y1: p.y,
      x2: end.x,
      y2: end.y,
      class: "facing-arrow",
      "data-kind": "stage-facing",
      "data-character": character.id,
      "data-index": keyIndex,
    }));
  });
  drawClipBoundaryTicks(svg, character, color);
  const root = rootAt(character, app.currentTime);
  const ghost = worldToStage(root.position);
  const activeClip = activeClipAt(character, app.currentTime);
  const facing = root.facing_degrees;
  const group = makeSvg("g", {
    transform: `translate(${ghost.x} ${ghost.y}) rotate(${facing})`,
  });
  group.appendChild(makeSvg("ellipse", { cx: 0, cy: 0, rx: 12, ry: 17, class: "stage-character-body", stroke: color }));
  group.appendChild(makeSvg("circle", { cx: 0, cy: -14, r: 6, class: "stage-character-head", stroke: color }));
  group.appendChild(makeSvg("line", { x1: 0, y1: 0, x2: 0, y2: -28, class: "facing-arrow" }));
  svg.appendChild(group);
  svg.appendChild(makeSvg("text", { x: ghost.x + 16, y: ghost.y - 2, class: "stage-active-label" }, [document.createTextNode(character.label)]));
  if (activeClip) {
    const label = activeClip.clip.replace(/^Preset: /, "").replace(/^Custom: /, "");
    svg.appendChild(makeSvg("text", { x: ghost.x + 16, y: ghost.y + 13, class: "stage-active-label" }, [document.createTextNode(label.slice(0, 24))]));
  }
}

function drawWaypointStackBadges(svg) {
  const refs = stageWaypointRefs();
  const used = new Set();
  refs.forEach((ref, index) => {
    if (used.has(index)) return;
    const group = refs
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(({ candidate, candidateIndex }) => !used.has(candidateIndex) && stageDistance(ref.point, candidate.point) <= WAYPOINT_STACK_RADIUS);
    group.forEach(({ candidateIndex }) => used.add(candidateIndex));
    if (group.length <= 1) return;
    const x = ref.point.x + 11;
    const y = ref.point.y - 11;
    svg.appendChild(makeSvg("circle", { cx: x, cy: y, r: 8, class: "stage-stack-badge" }));
    svg.appendChild(makeSvg("text", { x, y: y + 0.5, class: "stage-stack-badge-text" }, [document.createTextNode(String(group.length))]));
  });
}

function drawCharacterPathSegments(svg, character, keys, color) {
  if (keys.length <= 1) return;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const first = keys[index];
    const second = keys[index + 1];
    const mode = segmentModeForPair(character, first, second);
    const samples = mode === "curve" ? 18 : 1;
    const points = [];
    for (let sample = 0; sample <= samples; sample += 1) {
      const alpha = sample / Math.max(1, samples);
      const time = first.time * (1 - alpha) + second.time * alpha;
      const p = worldToStage(rootAt(character, time).position);
      points.push(`${p.x},${p.y}`);
    }
    svg.appendChild(makeSvg("polyline", {
      points: points.join(" "),
      class: `stage-path stage-path-${mode}`,
      stroke: color,
    }));
  }
}

function drawClipBoundaryTicks(svg, character, color) {
  const boundaries = new Set();
  for (const clip of sortedClips(character)) {
    boundaries.add(clip.start.toFixed(3));
    boundaries.add((clip.start + clip.duration).toFixed(3));
  }
  for (const rawTime of boundaries) {
    const time = Number(rawTime);
    if (time < -0.001 || time > app.scene.duration + 0.001) continue;
    const root = rootAt(character, time);
    const p = worldToStage(root.position);
    svg.appendChild(makeSvg("circle", { cx: p.x, cy: p.y, r: 4, class: "stage-clip-tick", stroke: color }));
  }
}

function drawCameraOnStage(svg) {
  const samples = cameraTrajectorySamples();
  drawCameraTrajectory(svg, samples);
  drawCameraKeyframesOnStage(svg);
  const pose = cameraPoseAt(app.currentTime);
  const cameraPoint = worldToStage([pose.position[0], pose.position[1], 0]);
  const targetPoint = worldToStage([pose.lookAt[0], pose.lookAt[1], 0]);
  svg.appendChild(makeSvg("line", { x1: cameraPoint.x, y1: cameraPoint.y, x2: targetPoint.x, y2: targetPoint.y, class: "stage-camera-line" }));
  svg.appendChild(makeSvg("circle", { cx: targetPoint.x, cy: targetPoint.y, r: 4, class: "stage-camera-target" }));
  svg.appendChild(makeSvg("circle", { cx: cameraPoint.x, cy: cameraPoint.y, r: 7, class: "stage-camera" }));
  const angle = Math.atan2(targetPoint.y - cameraPoint.y, targetPoint.x - cameraPoint.x) * 180 / Math.PI + 90;
  const marker = makeSvg("g", { transform: `translate(${cameraPoint.x} ${cameraPoint.y}) rotate(${angle})`, class: "stage-camera-current" });
  marker.appendChild(makeSvg("path", { d: "M 0 -13 L -9 9 L 0 5 L 9 9 Z", class: "stage-camera-body" }));
  svg.appendChild(marker);
}

function drawCameraKeyframesOnStage(svg) {
  const camera = sceneCamera();
  if (camera.preset !== "keyframed") return;
  cameraKeyframes(camera).forEach((key, index) => {
    const cameraPoint = worldToStage(key.position);
    const targetPoint = worldToStage(key.look_at);
    const selected = app.selection.type === "camera_key" && app.selection.index === index;
    svg.appendChild(makeSvg("line", {
      x1: cameraPoint.x,
      y1: cameraPoint.y,
      x2: targetPoint.x,
      y2: targetPoint.y,
      class: `stage-camera-key-line ${selected ? "selected" : ""}`,
    }));
    svg.appendChild(makeSvg("circle", {
      cx: targetPoint.x,
      cy: targetPoint.y,
      r: 7,
      class: `stage-camera-target-key ${selected ? "selected" : ""}`,
      "data-kind": "stage-camera-target",
      "data-index": index,
    }));
    svg.appendChild(makeSvg("circle", {
      cx: cameraPoint.x,
      cy: cameraPoint.y,
      r: 8,
      class: `stage-camera-key ${selected ? "selected" : ""}`,
      "data-kind": "stage-camera-key",
      "data-index": index,
    }));
    svg.appendChild(makeSvg("text", {
      x: cameraPoint.x + 10,
      y: cameraPoint.y - 10,
      class: "stage-camera-key-label",
      "data-kind": "stage-camera-key",
      "data-index": index,
    }, [document.createTextNode(`${key.time.toFixed(1)}s`)]));
  });
}

function cameraTrajectorySamples() {
  const duration = Math.max(0.001, Number(app.scene?.duration) || 0.001);
  const count = Math.max(2, Math.min(72, Math.ceil(duration * 4) + 1));
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    const time = duration * index / Math.max(1, count - 1);
    const pose = cameraPoseAt(time);
    samples.push({
      time,
      point: worldToStage([pose.position[0], pose.position[1], 0]),
      target: worldToStage([pose.lookAt[0], pose.lookAt[1], 0]),
    });
  }
  return samples;
}

function drawCameraTrajectory(svg, samples) {
  if (samples.length === 0) return;
  const first = samples[0].point;
  const last = samples[samples.length - 1].point;
  const moving = samples.some((sample) => Math.hypot(sample.point.x - first.x, sample.point.y - first.y) > 0.5);
  if (moving) {
    svg.appendChild(makeSvg("polyline", {
      points: samples.map((sample) => `${sample.point.x},${sample.point.y}`).join(" "),
      class: "stage-camera-trajectory",
    }));
    const step = Math.max(1, Math.floor((samples.length - 1) / 4));
    for (let index = step; index < samples.length - 1; index += step) {
      const point = samples[index].point;
      svg.appendChild(makeSvg("circle", { cx: point.x, cy: point.y, r: 3.2, class: "stage-camera-step" }));
    }
  } else {
    svg.appendChild(makeSvg("circle", { cx: first.x, cy: first.y, r: 14, class: "stage-camera-static" }));
  }
  svg.appendChild(makeSvg("circle", { cx: first.x, cy: first.y, r: 4.5, class: "stage-camera-start" }));
  svg.appendChild(makeSvg("rect", { x: last.x - 4.5, y: last.y - 4.5, width: 9, height: 9, transform: `rotate(45 ${last.x} ${last.y})`, class: "stage-camera-end" }));
}

function sceneCenterAndRadius() {
  const roots = [];
  for (const character of app.scene.characters) {
    for (const key of sortedKeys(character)) roots.push(key.position);
  }
  if (!roots.length) return { center: [0, 0, 0.8], radius: 2.4 };
  const center = [
    roots.reduce((sum, point) => sum + point[0], 0) / roots.length,
    roots.reduce((sum, point) => sum + point[1], 0) / roots.length,
    0.8,
  ];
  const radius = Math.max(2.4, roots.reduce((value, point) => Math.max(value, Math.hypot(point[0] - center[0], point[1] - center[1])), 0) + 2);
  return { center, radius };
}

function cameraPoseAt(time) {
  const camera = sceneCamera();
  if (camera.preset === "keyframed") {
    const pose = keyframedCameraPoseAt(camera, time);
    if (pose) return pose;
  }
  const { center, radius } = sceneCenterAndRadius();
  const height = Math.max(0.4, Number(camera.height) || 1.35);
  let lookAt = [center[0], center[1], Math.max(0.6, height * 0.72)];
  let position;
  const target = cameraTargetLookAt(camera, time, height);
  if (camera.preset === "front_stage") {
    position = [lookAt[0], lookAt[1] + radius, lookAt[2] + height * 0.85];
  } else if (camera.preset === "slow_orbit") {
    if (target) lookAt = target;
    const angle = 2 * Math.PI * (time / Math.max(0.001, app.scene.duration));
    position = [lookAt[0] + Math.sin(angle) * radius, lookAt[1] + Math.cos(angle) * radius, lookAt[2] + height * 0.9];
  } else if (camera.preset === "follow_character") {
    if (target) lookAt = target;
    position = [lookAt[0], lookAt[1] - 2.35, lookAt[2] + height * 0.55];
  } else if (camera.preset === "dolly_in") {
    if (target) lookAt = target;
    const alpha = clamp(time / Math.max(0.001, app.scene.duration), 0, 1);
    position = [lookAt[0] + 0.25 * radius, lookAt[1] + radius * (1.55 - 0.45 * alpha), lookAt[2] + height * 0.85];
  } else if (camera.preset === "top_down") {
    position = [center[0], center[1] + 0.001, radius * 1.75];
    lookAt = [center[0], center[1], 0];
  } else {
    position = [lookAt[0] + 0.45 * radius, lookAt[1] + 1.15 * radius, lookAt[2] + height * 0.95];
  }
  return { position, lookAt, fovDegrees: camera.preset === "top_down" ? 38 : 45 };
}

function keyframedCameraPoseAt(camera, time) {
  const keys = cameraKeyframes(camera);
  if (!keys.length) return null;
  if (time <= keys[0].time) return cameraPoseFromKey(keys[0]);
  if (time >= keys[keys.length - 1].time) return cameraPoseFromKey(keys[keys.length - 1]);
  for (let index = 0; index < keys.length - 1; index += 1) {
    const first = keys[index];
    const second = keys[index + 1];
    if (first.time <= time && time <= second.time) {
      const mode = cameraSegmentModeForPair(camera, first, second);
      if (mode === "hold") {
        return cameraPoseFromKey(time >= second.time - 0.001 ? second : first);
      }
      const alpha = (time - first.time) / Math.max(0.001, second.time - first.time);
      if (mode === "curve") {
        const prev = keys[Math.max(0, index - 1)];
        const next = keys[Math.min(keys.length - 1, index + 2)];
        return {
          position: catmullRomPosition(prev.position, first.position, second.position, next.position, alpha),
          lookAt: catmullRomPosition(prev.look_at, first.look_at, second.look_at, next.look_at, alpha),
          fovDegrees: catmullRomScalar(prev.fov_degrees, first.fov_degrees, second.fov_degrees, next.fov_degrees, alpha),
        };
      }
      return {
        position: lerpPosition(first.position, second.position, alpha),
        lookAt: lerpPosition(first.look_at, second.look_at, alpha),
        fovDegrees: first.fov_degrees * (1 - alpha) + second.fov_degrees * alpha,
      };
    }
  }
  return cameraPoseFromKey(keys[keys.length - 1]);
}

function cameraPoseFromKey(key) {
  return {
    position: [...key.position],
    lookAt: [...key.look_at],
    fovDegrees: key.fov_degrees,
  };
}

function catmullRomScalar(p0, p1, p2, p3, alpha) {
  const t2 = alpha * alpha;
  const t3 = t2 * alpha;
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * alpha
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function cameraTargetLookAt(camera, time, height) {
  if (!CAMERA_TARGET_PRESETS.has(camera.preset)) return null;
  if (camera.target === CAMERA_ORIGIN_TARGET) return [0, 0, Math.max(0.75, height * 0.72)];
  const character = app.scene.characters.find((item) => item.id === camera.target);
  if (!character) return null;
  const root = rootAt(character, time);
  return [root.position[0], root.position[1], Math.max(0.75, height * 0.72)];
}

function normalizeVec(vector) {
  const length = Math.max(1e-9, Math.hypot(vector[0], vector[1], vector[2]));
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function crossVec(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dotVec(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function addVec(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subVec(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function matVec(matrix, vector) {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

function matMul(a, b) {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0] + a[0][2] * b[2][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1] + a[0][2] * b[2][1],
      a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2] * b[2][2],
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0] + a[1][2] * b[2][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1] + a[1][2] * b[2][1],
      a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2] * b[2][2],
    ],
    [
      a[2][0] * b[0][0] + a[2][1] * b[1][0] + a[2][2] * b[2][0],
      a[2][0] * b[0][1] + a[2][1] * b[1][1] + a[2][2] * b[2][1],
      a[2][0] * b[0][2] + a[2][1] * b[1][2] + a[2][2] * b[2][2],
    ],
  ];
}

function identityMatrix() {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
}

function rotationXMatrix(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}

function rotationYMatrix(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
}

function rotationZMatrix(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

function rootYawRadians(rotation) {
  const forward = matVec(rotation, [0, 1, 0]);
  return Math.atan2(forward[0], forward[1]);
}

function sceneFacingMatrix(facingDegrees) {
  return rotationZMatrix(-facingDegrees * Math.PI / 180);
}

function normalizeMotionSampleForRootMode(sample, reference, rootMode) {
  if (!sample || rootMode === "native") return sample;
  const normalized = {
    jointOrder: sample.jointOrder,
    rootOffset: [...sample.rootOffset],
    localRotations: sample.localRotations.map((rotation) => rotation.map((row) => [...row])),
  };
  normalized.rootOffset[0] = 0;
  normalized.rootOffset[1] = 0;
  if (normalized.localRotations.length > 0 && reference?.localRotations?.length > 0) {
    normalized.localRotations[0] = matMul(
      rotationZMatrix(-rootYawRadians(reference.localRotations[0])),
      normalized.localRotations[0],
    );
  }
  return normalized;
}

function sampleMotionPreviewForRootMode(motion, sourceTime, rootMode, referenceTime = 0) {
  const preview = motion?.preview;
  if (!preview || !Array.isArray(preview.keyframes) || preview.keyframes.length === 0) return null;
  const loop = Boolean(motion?.loopable);
  const sample = sampleMotionPreview(preview, sourceTime, loop);
  const reference = rootMode === "native" ? null : sampleMotionPreview(preview, referenceTime, loop);
  return normalizeMotionSampleForRootMode(sample, reference, rootMode);
}

function matrixToQuaternion(matrix) {
  const m = matrix;
  const trace = m[0][0] + m[1][1] + m[2][2];
  let w;
  let x;
  let y;
  let z;
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    w = 0.25 * scale;
    x = (m[2][1] - m[1][2]) / scale;
    y = (m[0][2] - m[2][0]) / scale;
    z = (m[1][0] - m[0][1]) / scale;
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const scale = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    w = (m[2][1] - m[1][2]) / scale;
    x = 0.25 * scale;
    y = (m[0][1] + m[1][0]) / scale;
    z = (m[0][2] + m[2][0]) / scale;
  } else if (m[1][1] > m[2][2]) {
    const scale = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    w = (m[0][2] - m[2][0]) / scale;
    x = (m[0][1] + m[1][0]) / scale;
    y = 0.25 * scale;
    z = (m[1][2] + m[2][1]) / scale;
  } else {
    const scale = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
    w = (m[1][0] - m[0][1]) / scale;
    x = (m[0][2] + m[2][0]) / scale;
    y = (m[1][2] + m[2][1]) / scale;
    z = 0.25 * scale;
  }
  const length = Math.max(1e-9, Math.hypot(w, x, y, z));
  return [w / length, x / length, y / length, z / length];
}

function quaternionToMatrix(quaternion) {
  const [w, x, y, z] = quaternion;
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}

function slerpQuaternion(a, b, alpha) {
  let q1 = b;
  let dot = a[0] * q1[0] + a[1] * q1[1] + a[2] * q1[2] + a[3] * q1[3];
  if (dot < 0) {
    q1 = q1.map((value) => -value);
    dot = -dot;
  }
  dot = clamp(dot, -1, 1);
  if (dot > 0.9995) {
    const mixed = a.map((value, index) => value * (1 - alpha) + q1[index] * alpha);
    const length = Math.max(1e-9, Math.hypot(...mixed));
    return mixed.map((value) => value / length);
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * alpha;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const scale0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const scale1 = sinTheta / sinTheta0;
  return a.map((value, index) => value * scale0 + q1[index] * scale1);
}

function projectShot(point, pose, width, height, topDown) {
  const basis = shotProjectionBasis(pose);
  const rel = [point[0] - pose.position[0], point[1] - pose.position[1], point[2] - pose.position[2]];
  const depth = dotVec(rel, basis.forward);
  if (depth <= BACKGROUND_NEAR_PLANE) return null;
  return projectShotRelative(rel, depth, basis, pose, width, height, topDown);
}

function shotProjectionBasis(pose) {
  const forward = normalizeVec([pose.lookAt[0] - pose.position[0], pose.lookAt[1] - pose.position[1], pose.lookAt[2] - pose.position[2]]);
  let right = crossVec(forward, [0, 0, 1]);
  if (Math.hypot(...right) < 1e-5) right = [1, 0, 0];
  else right = normalizeVec(right);
  const up = normalizeVec(crossVec(right, forward));
  return { forward, right, up };
}

function projectShotRelative(rel, depth, basis, pose, width, height, topDown) {
  const fov = clamp(Number(pose.fovDegrees) || (topDown ? 38 : 45), 10, 120) * Math.PI / 180;
  const focal = 0.5 * height / Math.tan(fov * 0.5);
  return {
    x: width * 0.5 + dotVec(rel, basis.right) * focal / depth,
    y: height * 0.54 - dotVec(rel, basis.up) * focal / depth,
    scale: focal / depth,
  };
}

function projectShotBackgroundPlane(worldCorners, pose, width, height, topDown) {
  const basis = shotProjectionBasis(pose);
  const relPoints = worldCorners.map((point) => [point[0] - pose.position[0], point[1] - pose.position[1], point[2] - pose.position[2]]);
  const depths = relPoints.map((point) => dotVec(point, basis.forward));
  if (Math.max(...depths) <= BACKGROUND_NEAR_PLANE) return null;
  return relPoints.map((rel, index) => projectShotRelative(rel, Math.max(depths[index], BACKGROUND_NEAR_PLANE), basis, pose, width, height, topDown));
}

function renderShotPreview() {
  const svg = $("#shotPreviewSvg");
  if (!svg) return;
  const width = 360;
  const height = 203;
  const pose = cameraPoseAt(app.currentTime);
  const camera = sceneCamera();
  const topDown = camera.preset === "top_down";
  const background = sceneBackground();
  renderShotBackgroundCanvas(pose, width, height, topDown, background);
  clear(svg);
  if (background.show_grid !== false && background.show_floor !== false) drawShotGrid(svg, pose, width, height, topDown);
  const items = app.scene.characters.map((character, index) => {
    if (isCharacterHidden(character)) return null;
    const root = rootAt(character, app.currentTime);
    const center = projectShot([root.position[0], root.position[1], root.position[2] + 0.8], pose, width, height, topDown);
    return { character, index, root, depth: center?.scale || 0 };
  }).filter((item) => item && item.depth > 0).sort((a, b) => a.depth - b.depth);
  for (const item of items) drawShotCharacter(svg, item.character, item.index, item.root, pose, width, height, topDown);
}

function renderShotBackgroundCanvas(pose, width, height, topDown, background) {
  const canvas = $("#shotPreviewCanvas");
  if (!canvas) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background.color || "#f4f1ea";
  ctx.fillRect(0, 0, width, height);
  drawShotSkyImages(ctx, pose, width, height, topDown);
  drawShotWallImages(ctx, pose, width, height, topDown);
  drawShotFloorImage(ctx, pose, width, height, topDown);
}

function drawShotFloorImage(ctx, pose, width, height, topDown) {
  const background = sceneBackground();
  if (background.show_floor === false || !validBackgroundUrl(background.floor_image)) return;
  const { center, radius } = sceneCenterAndRadius();
  const extent = Math.ceil(radius + 1);
  drawShotImagePlane(ctx, background.floor_image, [
    [center[0] - extent, center[1] - extent, 0],
    [center[0] + extent, center[1] - extent, 0],
    [center[0] + extent, center[1] + extent, 0],
    [center[0] - extent, center[1] + extent, 0],
  ], pose, width, height, topDown);
}

function drawShotSkyImages(ctx, pose, width, height, topDown) {
  const background = sceneBackground();
  if (background.show_floor === false || !validBackgroundUrl(background.sky_image)) return;
  const { center, radius } = sceneCenterAndRadius();
  const extent = Math.ceil(radius + 1);
  const skyExtent = extent * 2;
  const wallHeight = Math.max(2.8, extent * 0.9);
  const skyHeight = wallHeight * 2;
  const planes = [
    [
      [center[0] - skyExtent, center[1] - skyExtent, skyHeight],
      [center[0] + skyExtent, center[1] - skyExtent, skyHeight],
      [center[0] + skyExtent, center[1] + skyExtent, skyHeight],
      [center[0] - skyExtent, center[1] + skyExtent, skyHeight],
    ],
    [
      [center[0] - extent, center[1] - extent, wallHeight],
      [center[0] + extent, center[1] - extent, wallHeight],
      [center[0] + skyExtent, center[1] - skyExtent, skyHeight],
      [center[0] - skyExtent, center[1] - skyExtent, skyHeight],
    ],
    [
      [center[0] + extent, center[1] + extent, wallHeight],
      [center[0] - extent, center[1] + extent, wallHeight],
      [center[0] - skyExtent, center[1] + skyExtent, skyHeight],
      [center[0] + skyExtent, center[1] + skyExtent, skyHeight],
    ],
    [
      [center[0] - extent, center[1] + extent, wallHeight],
      [center[0] - extent, center[1] - extent, wallHeight],
      [center[0] - skyExtent, center[1] - skyExtent, skyHeight],
      [center[0] - skyExtent, center[1] + skyExtent, skyHeight],
    ],
    [
      [center[0] + extent, center[1] - extent, wallHeight],
      [center[0] + extent, center[1] + extent, wallHeight],
      [center[0] + skyExtent, center[1] + skyExtent, skyHeight],
      [center[0] + skyExtent, center[1] - skyExtent, skyHeight],
    ],
  ];
  for (const corners of planes) drawShotImagePlane(ctx, background.sky_image, corners, pose, width, height, topDown);
}

function drawShotWallImages(ctx, pose, width, height, topDown) {
  const background = sceneBackground();
  if (background.show_floor === false) return;
  const { center, radius } = sceneCenterAndRadius();
  const extent = Math.ceil(radius + 1);
  const wallHeight = Math.max(2.8, extent * 0.9);
  const planes = [
    [background.wall_front_image, [
      [center[0] - extent, center[1] - extent, 0],
      [center[0] + extent, center[1] - extent, 0],
      [center[0] + extent, center[1] - extent, wallHeight],
      [center[0] - extent, center[1] - extent, wallHeight],
    ]],
    [background.wall_back_image, [
      [center[0] + extent, center[1] + extent, 0],
      [center[0] - extent, center[1] + extent, 0],
      [center[0] - extent, center[1] + extent, wallHeight],
      [center[0] + extent, center[1] + extent, wallHeight],
    ]],
    [background.wall_left_image, [
      [center[0] - extent, center[1] + extent, 0],
      [center[0] - extent, center[1] - extent, 0],
      [center[0] - extent, center[1] - extent, wallHeight],
      [center[0] - extent, center[1] + extent, wallHeight],
    ]],
    [background.wall_right_image, [
      [center[0] + extent, center[1] - extent, 0],
      [center[0] + extent, center[1] + extent, 0],
      [center[0] + extent, center[1] + extent, wallHeight],
      [center[0] + extent, center[1] - extent, wallHeight],
    ]],
  ];
  for (const [url, corners] of planes) drawShotImagePlane(ctx, url, corners, pose, width, height, topDown);
}

function drawShotImagePlane(ctx, url, worldCorners, pose, width, height, topDown) {
  if (!validBackgroundUrl(url)) return;
  const image = cachedBackgroundImage(url);
  if (!image) return;
  drawPerspectiveImagePlane(ctx, image, worldCorners, pose, width, height, topDown);
}

function drawPerspectiveImagePlane(ctx, image, worldCorners, pose, width, height, topDown) {
  const basis = shotProjectionBasis(pose);
  const segments = 14;
  const pointAt = (u, v) => [
    worldCorners[0][0] * (1 - u) * (1 - v) + worldCorners[1][0] * u * (1 - v) + worldCorners[2][0] * u * v + worldCorners[3][0] * (1 - u) * v,
    worldCorners[0][1] * (1 - u) * (1 - v) + worldCorners[1][1] * u * (1 - v) + worldCorners[2][1] * u * v + worldCorners[3][1] * (1 - u) * v,
    worldCorners[0][2] * (1 - u) * (1 - v) + worldCorners[1][2] * u * (1 - v) + worldCorners[2][2] * u * v + worldCorners[3][2] * (1 - u) * v,
  ];
  const projected = [];
  for (let y = 0; y <= segments; y += 1) {
    const row = [];
    for (let x = 0; x <= segments; x += 1) {
      row.push(projectBackgroundPoint(pointAt(x / segments, y / segments), pose, basis, width, height, topDown));
    }
    projected.push(row);
  }
  for (let y = 0; y < segments; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const p00 = projected[y][x];
      const p10 = projected[y][x + 1];
      const p11 = projected[y + 1][x + 1];
      const p01 = projected[y + 1][x];
      if (!p00.visible && !p10.visible && !p11.visible && !p01.visible) continue;
      const sx0 = image.naturalWidth * x / segments;
      const sx1 = image.naturalWidth * (x + 1) / segments;
      const sy0 = image.naturalHeight * y / segments;
      const sy1 = image.naturalHeight * (y + 1) / segments;
      drawImageTriangle(ctx, image, [sx0, sy0], [sx1, sy0], [sx1, sy1], p00, p10, p11);
      drawImageTriangle(ctx, image, [sx0, sy0], [sx1, sy1], [sx0, sy1], p00, p11, p01);
    }
  }
}

function projectBackgroundPoint(point, pose, basis, width, height, topDown) {
  const rel = [point[0] - pose.position[0], point[1] - pose.position[1], point[2] - pose.position[2]];
  const depth = dotVec(rel, basis.forward);
  return {
    ...projectShotRelative(rel, Math.max(depth, BACKGROUND_NEAR_PLANE), basis, pose, width, height, topDown),
    visible: depth > BACKGROUND_NEAR_PLANE,
  };
}

function drawImageTriangle(ctx, image, s0, s1, s2, d0, d1, d2) {
  const denominator = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
  if (Math.abs(denominator) < 1e-6) return;
  const ax = (d0.x * (s1[1] - s2[1]) + d1.x * (s2[1] - s0[1]) + d2.x * (s0[1] - s1[1])) / denominator;
  const bx = (d0.x * (s2[0] - s1[0]) + d1.x * (s0[0] - s2[0]) + d2.x * (s1[0] - s0[0])) / denominator;
  const cx = (d0.x * (s1[0] * s2[1] - s2[0] * s1[1]) + d1.x * (s2[0] * s0[1] - s0[0] * s2[1]) + d2.x * (s0[0] * s1[1] - s1[0] * s0[1])) / denominator;
  const ay = (d0.y * (s1[1] - s2[1]) + d1.y * (s2[1] - s0[1]) + d2.y * (s0[1] - s1[1])) / denominator;
  const by = (d0.y * (s2[0] - s1[0]) + d1.y * (s0[0] - s2[0]) + d2.y * (s1[0] - s0[0])) / denominator;
  const cy = (d0.y * (s1[0] * s2[1] - s2[0] * s1[1]) + d1.y * (s2[0] * s0[1] - s0[0] * s2[1]) + d2.y * (s0[0] * s1[1] - s1[0] * s0[1])) / denominator;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(ax, ay, bx, by, cx, cy);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function drawShotGrid(svg, pose, width, height, topDown) {
  const { center, radius } = sceneCenterAndRadius();
  const extent = Math.ceil(radius + 1);
  for (let i = -extent; i <= extent; i += 1) {
    const lines = [
      [[center[0] + i, center[1] - extent, 0], [center[0] + i, center[1] + extent, 0]],
      [[center[0] - extent, center[1] + i, 0], [center[0] + extent, center[1] + i, 0]],
    ];
    for (const [a, b] of lines) {
      const pa = projectShot(a, pose, width, height, topDown);
      const pb = projectShot(b, pose, width, height, topDown);
      if (pa && pb) svg.appendChild(makeSvg("line", { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, class: "shot-floor" }));
    }
  }
}

function drawShotCharacter(svg, character, index, root, pose, width, height, topDown) {
  if (drawShotBlockyCharacter(svg, character, index, root, pose, width, height, topDown)) return;

  const color = characterColor(character, index);
  const label = activeClipAt(character, app.currentTime)?.clip || "Idle Breathing";
  const skeleton = characterSkeleton(root.position, root.facing_degrees, label, app.currentTime);
  for (const [a, b] of skeleton.segments) {
    const pa = projectShot(a, pose, width, height, topDown);
    const pb = projectShot(b, pose, width, height, topDown);
    if (!pa || !pb) continue;
    svg.appendChild(makeSvg("line", {
      x1: pa.x,
      y1: pa.y,
      x2: pb.x,
      y2: pb.y,
      stroke: color,
      "stroke-width": Math.max(2.2, 0.045 * (pa.scale + pb.scale) * 0.5),
      "stroke-linecap": "round",
    }));
  }
  const chest = projectShot(skeleton.chest, pose, width, height, topDown);
  const head = projectShot(skeleton.head, pose, width, height, topDown);
  if (chest) {
    const r = Math.max(4, 0.13 * chest.scale);
    svg.appendChild(makeSvg("ellipse", { cx: chest.x, cy: chest.y, rx: r, ry: r, class: "shot-character-body", stroke: color }));
  }
  if (head) {
    const r = Math.max(3.5, 0.11 * head.scale);
    svg.appendChild(makeSvg("circle", { cx: head.x, cy: head.y, r, class: "shot-character-head", stroke: color }));
    svg.appendChild(makeSvg("text", { x: head.x + r + 3, y: head.y + 4, class: "shot-label" }, [document.createTextNode(character.label)]));
  }
}

function drawShotBlockyCharacter(svg, character, index, root, pose, width, height, topDown) {
  const assetName = app.proxyAssets.includes(character.proxy_asset) ? character.proxy_asset : defaultProxyAsset();
  const asset = app.proxyAssetPreviews[assetName] || app.proxyAssetPreviews[defaultProxyAsset()];
  if (!asset || !Array.isArray(asset.joints) || !Array.isArray(asset.parts)) return false;
  const clip = activeClipAt(character, app.currentTime);
  const clipLabel = clip?.clip || "Idle Breathing";
  const motionSample = sampleCharacterPreviewPose(character, clip, app.currentTime);
  const blockyPose = blockyPreviewPose(asset, root, clipLabel, app.currentTime, motionSample);
  const faces = [];
  for (const part of asset.parts) {
    const jointIndex = blockyPose.jointLookup[part.joint];
    if (jointIndex === undefined || !Array.isArray(part.vertices) || !Array.isArray(part.faces)) continue;
    const worldVertices = part.vertices.map((vertex) => addVec(
      blockyPose.worldPositions[jointIndex],
      matVec(blockyPose.worldRotations[jointIndex], numericVec3(vertex)),
    ));
    for (const face of part.faces) {
      const projected = face.slice(0, 3).map((vertexIndex) => projectShot(worldVertices[vertexIndex], pose, width, height, topDown));
      if (projected.some((point) => !point)) continue;
      const points = projected.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
      const depth = projected.reduce((value, point) => value + point.scale, 0) / projected.length;
      faces.push({ points, depth, color: avatarDisplayColor(characterColor(character, index), part.color, character.tint_avatar_colors !== false) });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  for (const face of faces) {
    const color = face.color.map((channel) => clamp(Number(channel) || 0, 0, 255));
    svg.appendChild(makeSvg("polygon", {
      points: face.points,
      class: "shot-blocky-face",
      fill: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
      stroke: strokeForRgb(color),
    }));
  }
  const headIndex = blockyPose.jointLookup.head;
  if (headIndex !== undefined) {
    const head = projectShot(addVec(blockyPose.worldPositions[headIndex], [0, 0, 0.13]), pose, width, height, topDown);
    if (head) svg.appendChild(makeSvg("text", { x: head.x + 5, y: head.y + 4, class: "shot-label" }, [document.createTextNode(character.label)]));
  }
  return faces.length > 0;
}

function setupMotionPreviewCanvasControls() {
  const canvas = $("#motionPreviewCanvas");
  if (!canvas) return;
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    app.motionPreviewView.dragging = true;
    app.motionPreviewView.lastX = event.clientX;
    app.motionPreviewView.lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!app.motionPreviewView.dragging) return;
    const dx = event.clientX - app.motionPreviewView.lastX;
    const dy = event.clientY - app.motionPreviewView.lastY;
    app.motionPreviewView.lastX = event.clientX;
    app.motionPreviewView.lastY = event.clientY;
    app.motionPreviewView.yaw += dx * 0.012;
    app.motionPreviewView.pitch = clamp(app.motionPreviewView.pitch + dy * 0.008, -0.35, 0.85);
    renderMotionPreview();
  });
  const endDrag = (event) => {
    app.motionPreviewView.dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = Math.exp(event.deltaY * 0.001);
    app.motionPreviewView.distance = clamp(app.motionPreviewView.distance * factor, 1.65, 5.4);
    renderMotionPreview();
  }, { passive: false });
}

function motionPreviewCanvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || 360));
  const height = Math.max(1, Math.round(rect.height || 203));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function motionPreviewCamera() {
  const view = app.motionPreviewView;
  const target = [0, 0, 0.82];
  const horizontal = Math.cos(view.pitch) * view.distance;
  const position = [
    target[0] + Math.sin(view.yaw) * horizontal,
    target[1] + Math.cos(view.yaw) * horizontal,
    target[2] + Math.sin(view.pitch) * view.distance,
  ];
  return { position, lookAt: target };
}

function renderMotionPreview() {
  const canvas = $("#motionPreviewCanvas");
  if (!canvas) return;
  const { ctx, width, height } = motionPreviewCanvasContext(canvas);
  const motion = motionByLabel(app.selectedMotion);
  const target = selectedCharacter();
  const targetIndex = app.scene.characters.indexOf(target);
  const previewColor = characterColor(target, Math.max(0, targetIndex));
  const asset = app.proxyAssetPreviews[defaultProxyAsset()];
  const pose = motionPreviewCamera();
  const time = app.motionPreviewTime % Math.max(0.001, Number(motion.duration) || 1);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, width, height);
  drawMotionPreviewFloorCanvas(ctx, pose, width, height);
  if (asset && Array.isArray(asset.joints) && Array.isArray(asset.parts)) {
    const root = { position: [0, 0, 0], facing_degrees: 0 };
    const rootMode = defaultRootModeForMotion(motion);
    const sample = sampleMotionPreviewForRootMode(motion, time, rootMode, 0);
    const blockyPose = blockyPreviewPose(asset, root, motion.label, time, sample);
    drawBlockyPreviewFacesCanvas(ctx, asset, blockyPose, pose, width, height, previewColor, target?.tint_avatar_colors !== false);
  } else {
    drawMotionPreviewSkeletonCanvas(ctx, motion, pose, width, height, time, previewColor);
  }
}

function projectMotionPreviewPoint(point, pose, width, height) {
  const forward = normalizeVec([pose.lookAt[0] - pose.position[0], pose.lookAt[1] - pose.position[1], pose.lookAt[2] - pose.position[2]]);
  let right = crossVec(forward, [0, 0, 1]);
  if (Math.hypot(...right) < 1e-5) right = [1, 0, 0];
  else right = normalizeVec(right);
  const up = normalizeVec(crossVec(right, forward));
  const rel = [point[0] - pose.position[0], point[1] - pose.position[1], point[2] - pose.position[2]];
  const depth = dotVec(rel, forward);
  if (depth <= 0.03) return null;
  const fov = 42 * Math.PI / 180;
  const focal = 0.5 * height / Math.tan(fov * 0.5);
  return {
    x: width * 0.5 + dotVec(rel, right) * focal / depth,
    y: height * 0.54 - dotVec(rel, up) * focal / depth,
    scale: focal / depth,
    depth,
  };
}

function drawMotionPreviewFloorCanvas(ctx, pose, width, height) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(36, 43, 45, 0.18)";
  for (let i = -3; i <= 3; i += 1) {
    const lines = [
      [[i * 0.5, -1.5, 0], [i * 0.5, 1.5, 0]],
      [[-1.5, i * 0.5, 0], [1.5, i * 0.5, 0]],
    ];
    for (const [a, b] of lines) {
      const pa = projectMotionPreviewPoint(a, pose, width, height);
      const pb = projectMotionPreviewPoint(b, pose, width, height);
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  }
}

function shadeRgb(color, shade) {
  return color.map((channel) => Math.round(clamp(channel * shade, 0, 255)));
}

function motionPreviewLightDirection(pose) {
  const toCamera = normalizeVec(subVec(pose.position, pose.lookAt));
  return normalizeVec([toCamera[0] * 0.72, toCamera[1] * 0.72, 0.68 + Math.max(0, toCamera[2]) * 0.2]);
}

function drawBlockyPreviewFacesCanvas(ctx, asset, blockyPose, pose, width, height, previewColor, tintColors = true) {
  const light = motionPreviewLightDirection(pose);
  const faces = [];
  for (const part of asset.parts) {
    const jointIndex = blockyPose.jointLookup[part.joint];
    if (jointIndex === undefined || !Array.isArray(part.vertices) || !Array.isArray(part.faces)) continue;
    const worldVertices = part.vertices.map((vertex) => addVec(
      blockyPose.worldPositions[jointIndex],
      matVec(blockyPose.worldRotations[jointIndex], numericVec3(vertex)),
    ));
    for (const face of part.faces) {
      const projected = face.slice(0, 3).map((vertexIndex) => projectMotionPreviewPoint(worldVertices[vertexIndex], pose, width, height));
      if (projected.some((point) => !point)) continue;
      const v0 = worldVertices[face[0]];
      const v1 = worldVertices[face[1]];
      const v2 = worldVertices[face[2]];
      const normal = normalizeVec(crossVec(subVec(v1, v0), subVec(v2, v0)));
      const shade = clamp(0.58 + Math.max(0, dotVec(normal, light)) * 0.38, 0.48, 1.0);
      const baseColor = avatarDisplayColor(previewColor, part.color, tintColors);
      faces.push({
        points: projected,
        depth: projected.reduce((value, point) => value + point.depth, 0) / projected.length,
        color: shadeRgb(baseColor, shade),
        stroke: strokeForRgb(baseColor),
      });
    }
  }
  faces.sort((a, b) => b.depth - a.depth);
  for (const face of faces) {
    ctx.beginPath();
    ctx.moveTo(face.points[0].x, face.points[0].y);
    for (const point of face.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.fillStyle = `rgb(${face.color[0]}, ${face.color[1]}, ${face.color[2]})`;
    ctx.strokeStyle = face.stroke;
    ctx.lineWidth = 0.65;
    ctx.fill();
    ctx.stroke();
  }
}

function drawMotionPreviewSkeletonCanvas(ctx, motion, pose, width, height, time, color = "#2f7f7b") {
  const skeleton = characterSkeleton([0, 0, 0], 0, motion.label, time);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  for (const [a, b] of skeleton.segments) {
    const pa = projectMotionPreviewPoint(a, pose, width, height);
    const pb = projectMotionPreviewPoint(b, pose, width, height);
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
}

function drawMotionPreviewFloor(svg, pose, width, height) {
  for (let i = -2; i <= 2; i += 1) {
    const lines = [
      [[i, -1.2, 0], [i, 1.4, 0]],
      [[-2, i * 0.65, 0], [2, i * 0.65, 0]],
    ];
    for (const [a, b] of lines) {
      const pa = projectShot(a, pose, width, height, false);
      const pb = projectShot(b, pose, width, height, false);
      if (pa && pb) svg.appendChild(makeSvg("line", { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, class: "shot-floor" }));
    }
  }
}

function drawBlockyPreviewFaces(svg, asset, blockyPose, pose, width, height, previewColor, tintColors = true) {
  const faces = [];
  for (const part of asset.parts) {
    const jointIndex = blockyPose.jointLookup[part.joint];
    if (jointIndex === undefined || !Array.isArray(part.vertices) || !Array.isArray(part.faces)) continue;
    const worldVertices = part.vertices.map((vertex) => addVec(
      blockyPose.worldPositions[jointIndex],
      matVec(blockyPose.worldRotations[jointIndex], numericVec3(vertex)),
    ));
    for (const face of part.faces) {
      const projected = face.slice(0, 3).map((vertexIndex) => projectShot(worldVertices[vertexIndex], pose, width, height, false));
      if (projected.some((point) => !point)) continue;
      const points = projected.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
      const depth = projected.reduce((value, point) => value + point.scale, 0) / projected.length;
      faces.push({ points, depth, color: avatarDisplayColor(previewColor, part.color, tintColors) });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  for (const face of faces) {
    const color = face.color.map((channel) => clamp(Number(channel) || 0, 0, 255));
    svg.appendChild(makeSvg("polygon", {
      points: face.points,
      class: "shot-blocky-face",
      fill: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
      stroke: strokeForRgb(color),
    }));
  }
}

function drawMotionPreviewSkeleton(svg, motion, pose, width, height, time, color = "#2f7f7b") {
  const skeleton = characterSkeleton([0, 0, 0], 0, motion.label, time);
  for (const [a, b] of skeleton.segments) {
    const pa = projectShot(a, pose, width, height, false);
    const pb = projectShot(b, pose, width, height, false);
    if (pa && pb) svg.appendChild(makeSvg("line", { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, stroke: color, "stroke-width": 2.6, "stroke-linecap": "round" }));
  }
}

function blockyPreviewPose(asset, root, clipLabel, time, motionSample) {
  const label = clipLabel.toLowerCase();
  const pace = 2 * Math.PI * time;
  const walkSwing = /(walk|jog|march)/.test(label) ? Math.sin(pace * 1.8) * 0.45 : 0;
  const jumpLift = /jump/.test(label) ? Math.max(0, Math.sin(pace * 1.2)) * 0.28 : 0;
  const wave = /(wave|point|clap|dance)/.test(label) ? Math.sin(pace * 2.3) * 0.35 : 0;
  const jointLookup = {};
  asset.joints.forEach((joint, index) => { jointLookup[joint.name] = index; });
  let localRotations = asset.joints.map(() => identityMatrix());
  let rootOffset = [0, 0, jumpLift];

  if (motionSample) {
    localRotations = retargetPreviewRotations(asset, motionSample);
    rootOffset = [...motionSample.rootOffset];
  } else {
    setJointRotation(localRotations, jointLookup, "left_shoulder", matMul(rotationXMatrix(walkSwing * 0.35), rotationYMatrix(-Math.PI * 0.5)));
    setJointRotation(localRotations, jointLookup, "right_shoulder", matMul(rotationXMatrix(-walkSwing * 0.35), rotationYMatrix(Math.PI * 0.5)));
    setJointRotation(localRotations, jointLookup, "left_hip", rotationXMatrix(-walkSwing * 0.5));
    setJointRotation(localRotations, jointLookup, "right_hip", rotationXMatrix(walkSwing * 0.5));
    setJointRotation(localRotations, jointLookup, "left_knee", rotationXMatrix(Math.max(0, walkSwing) * 0.35));
    setJointRotation(localRotations, jointLookup, "right_knee", rotationXMatrix(Math.max(0, -walkSwing) * 0.35));
    if (wave) {
      setJointRotation(localRotations, jointLookup, "right_shoulder", matMul(rotationZMatrix(0.35), rotationYMatrix(-Math.PI * 0.42 - wave * 0.25)));
      setJointRotation(localRotations, jointLookup, "right_elbow", rotationYMatrix(-0.45 - wave * 0.35));
    }
  }

  const facing = sceneFacingMatrix(root.facing_degrees);
  const rootPosition = addVec(root.position, matVec(facing, rootOffset));
  const worldRotations = [];
  const worldPositions = [];
  asset.joints.forEach((joint, index) => {
    const translation = numericVec3(joint.translation);
    if (joint.parent < 0) {
      worldRotations[index] = matMul(facing, localRotations[index]);
      worldPositions[index] = addVec(rootPosition, matVec(facing, translation));
    } else {
      worldRotations[index] = matMul(worldRotations[joint.parent], localRotations[index]);
      worldPositions[index] = addVec(worldPositions[joint.parent], matVec(worldRotations[joint.parent], translation));
    }
  });
  return { jointLookup, worldRotations, worldPositions };
}

function sampleClipPreviewPose(clip, motion, sceneTime) {
  if (!clip || !motion) return null;
  const alpha = clip.duration <= 1e-6 ? 0 : clamp((sceneTime - clip.start) / clip.duration, 0, 1);
  const trimStart = normalizedClipTrimStart(clip, motion);
  const trimEnd = normalizedClipTrimEnd(clip, motion);
  const sourceTime = trimStart + alpha * (trimEnd - trimStart);
  return sampleMotionPreviewForRootMode(motion, sourceTime, clip.root_mode, trimStart);
}

function sampleClipPreviewPoseClamped(clip, motion, sceneTime) {
  return sampleClipPreviewPose(clip, motion, clamp(sceneTime, Number(clip.start || 0), clipEndTime(clip)));
}

function motionSamplesCompatible(first, second) {
  if (!first || !second) return false;
  const firstOrder = first.jointOrder || [];
  const secondOrder = second.jointOrder || [];
  if (first.localRotations?.length !== second.localRotations?.length) return false;
  if (firstOrder.length !== secondOrder.length) return false;
  return firstOrder.every((jointName, index) => jointName === secondOrder[index]);
}

function blendMotionSamples(first, second, alpha) {
  if (!first) return second;
  if (!second) return first;
  const t = smoothstep(alpha);
  if (!motionSamplesCompatible(first, second)) return t >= 0.5 ? second : first;
  return {
    jointOrder: [...(first.jointOrder || [])],
    rootOffset: first.rootOffset.map((value, index) => value * (1 - t) + second.rootOffset[index] * t),
    localRotations: first.localRotations.map((rotation, index) => quaternionToMatrix(slerpQuaternion(
      matrixToQuaternion(rotation),
      matrixToQuaternion(second.localRotations[index]),
      t,
    ))),
  };
}

function smoothstep(alpha) {
  const t = clamp(alpha, 0, 1);
  return t * t * (3 - 2 * t);
}

function sampleCharacterPreviewPose(character, activeClip, sceneTime) {
  const transition = transitionAt(character, sceneTime);
  if (transition) {
    const previousMotion = motionByLabel(transition.previous.clip);
    const nextMotion = motionByLabel(transition.next.clip);
    const previousPose = sampleClipPreviewPoseClamped(transition.previous, previousMotion, sceneTime);
    const nextPose = sampleClipPreviewPoseClamped(transition.next, nextMotion, sceneTime);
    const alpha = (sceneTime - transition.window.start) / (transition.window.end - transition.window.start);
    return blendMotionSamples(previousPose, nextPose, alpha);
  }
  const idleTransition = idleTransitionAt(character, sceneTime);
  if (idleTransition) {
    const motion = motionByLabel(idleTransition.clip.clip);
    const idlePose = sampleSceneIdlePreviewPose(sceneTime);
    if (idleTransition.kind === "in") {
      const clipPose = sampleClipPreviewPoseClamped(idleTransition.clip, motion, idleTransition.clip.start);
      return blendMotionSamples(idlePose, clipPose, idleTransition.alpha);
    }
    const clipPose = sampleClipPreviewPoseClamped(idleTransition.clip, motion, clipEndTime(idleTransition.clip));
    return blendMotionSamples(clipPose, idlePose, idleTransition.alpha);
  }
  const clip = activeClip || activeClipAt(character, sceneTime);
  if (clip) return sampleClipPreviewPose(clip, motionByLabel(clip.clip), sceneTime);
  return sampleSceneIdlePreviewPose(sceneTime);
}

function preferredIdleMotion() {
  return PREFERRED_IDLE_MOTIONS.map(exactMotionByLabel).find(Boolean) || null;
}

function sampleSceneIdlePreviewPose(sceneTime) {
  const motion = preferredIdleMotion();
  if (motion?.preview) {
    return sampleMotionPreviewForRootMode(motion, sceneTime, defaultRootModeForMotion(motion), 0)
      || sampleIdlePreviewPose(sceneTime);
  }
  return sampleIdlePreviewPose(sceneTime);
}

function idleTransitionAt(character, sceneTime) {
  const clips = sortedClips(character);
  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const previous = clips[index - 1] || null;
    const next = clips[index + 1] || null;
    const start = Number(clip.start || 0);
    const end = clipEndTime(clip);
    const blendIn = normalizedClipBlendIn(clip);
    const blendOut = normalizedClipBlendOut(clip);
    if (blendIn > 1e-6 && sceneTime >= start - blendIn && sceneTime < start) {
      const previousEnd = previous ? clipEndTime(previous) : -Infinity;
      if (previous && (sceneTime <= previousEnd + 1e-6 || start - previousEnd <= MAX_TRANSITION_GAP_SECONDS)) continue;
      return { kind: "in", clip, alpha: (sceneTime - (start - blendIn)) / blendIn };
    }
    if (blendOut > 1e-6 && sceneTime > end && sceneTime <= end + blendOut) {
      const nextStart = next ? Number(next.start || 0) : Infinity;
      if (next && (sceneTime >= nextStart - 1e-6 || nextStart - end <= MAX_TRANSITION_GAP_SECONDS)) continue;
      return { kind: "out", clip, alpha: (sceneTime - end) / blendOut };
    }
  }
  return null;
}

function sampleIdlePreviewPose(sceneTime) {
  const phase = Math.sin(sceneTime * 2 * Math.PI / 3);
  const slowPhase = Math.sin(sceneTime * 2 * Math.PI / 5);
  const localRotations = COURSE_BODY_JOINTS.map(() => identityMatrix());
  const jointIndex = {};
  COURSE_BODY_JOINTS.forEach((name, index) => { jointIndex[name] = index; });
  localRotations[jointIndex.spine1] = rotationZMatrix(0.015 * slowPhase);
  localRotations[jointIndex.spine2] = rotationZMatrix(-0.018 * slowPhase);
  localRotations[jointIndex.neck] = rotationZMatrix(0.012 * slowPhase);
  localRotations[jointIndex.left_shoulder] = rotationZMatrix(0.035 + 0.012 * phase);
  localRotations[jointIndex.right_shoulder] = rotationZMatrix(-0.035 - 0.012 * phase);
  return {
    jointOrder: COURSE_BODY_JOINTS,
    rootOffset: [0, 0, 0.006 * phase],
    localRotations,
  };
}

function sampleMotionPreview(preview, sourceTime, loop = true) {
  const keyframes = [...preview.keyframes].sort((a, b) => Number(a.time_sec) - Number(b.time_sec));
  if (!keyframes.length) return null;
  const duration = Math.max(0.001, Number(preview.duration || keyframes[keyframes.length - 1].time_sec || 1));
  let time = Number(sourceTime) || 0;
  if (loop) {
    time %= duration;
    if (time < 0) time += duration;
  }
  if (keyframes.length === 1 || time <= Number(keyframes[0].time_sec)) return poseFromPreviewKeyframe(preview, keyframes[0]);
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const first = keyframes[index];
    const second = keyframes[index + 1];
    const t0 = Number(first.time_sec);
    const t1 = Number(second.time_sec);
    if (time < t0 || time > t1) continue;
    const alpha = Math.abs(t1 - t0) < 1e-6 ? 1 : (time - t0) / (t1 - t0);
    const pose0 = poseFromPreviewKeyframe(preview, first);
    const pose1 = poseFromPreviewKeyframe(preview, second);
    return {
      jointOrder: pose0.jointOrder,
      rootOffset: pose0.rootOffset.map((value, offsetIndex) => value * (1 - alpha) + pose1.rootOffset[offsetIndex] * alpha),
      localRotations: pose0.localRotations.map((rotation, rotationIndex) => quaternionToMatrix(slerpQuaternion(
        matrixToQuaternion(rotation),
        matrixToQuaternion(pose1.localRotations[rotationIndex]),
        alpha,
      ))),
    };
  }
  return poseFromPreviewKeyframe(preview, keyframes[keyframes.length - 1]);
}

function poseFromPreviewKeyframe(preview, keyframe) {
  return {
    jointOrder: preview.joint_order || [],
    rootOffset: numericVec3(keyframe.root_offset),
    localRotations: (keyframe.local_rotation_matrices || []).map((rotation) => numericMat3(rotation)),
  };
}

function retargetPreviewRotations(asset, motionSample) {
  const sourceLookup = {};
  motionSample.jointOrder.forEach((jointName, index) => { sourceLookup[jointName] = index; });
  return asset.joints.map((joint) => {
    const sourceName = sourceLookup[joint.name] === undefined ? COURSE_TO_TOY_JOINT[joint.name] : joint.name;
    const sourceIndex = sourceLookup[sourceName];
    return sourceIndex === undefined || !motionSample.localRotations[sourceIndex] ? identityMatrix() : motionSample.localRotations[sourceIndex];
  });
}

function setJointRotation(localRotations, jointLookup, jointName, rotation) {
  const index = jointLookup[jointName];
  if (index !== undefined) localRotations[index] = rotation;
}

function numericVec3(value) {
  return [
    Number(value?.[0]) || 0,
    Number(value?.[1]) || 0,
    Number(value?.[2]) || 0,
  ];
}

function numericMat3(value) {
  return [
    numericVec3(value?.[0]),
    numericVec3(value?.[1]),
    numericVec3(value?.[2]),
  ];
}

function characterSkeleton(root, facingDegrees, clipLabel, time) {
  const angle = facingDegrees * Math.PI / 180;
  const forward = [Math.sin(angle), Math.cos(angle), 0];
  const right = [Math.cos(angle), -Math.sin(angle), 0];
  const label = clipLabel.toLowerCase();
  const pace = 2 * Math.PI * time;
  const swing = /(walk|jog|march)/.test(label) ? Math.sin(pace * 1.8) * 0.18 : 0;
  const lift = /jump/.test(label) ? Math.max(0, Math.sin(pace * 1.2)) * 0.28 : 0;
  const wave = /(wave|point|clap|dance)/.test(label) ? Math.sin(pace * 2.3) * 0.16 : 0;
  const base = [root[0], root[1], root[2] + lift];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const pelvis = add(base, [0, 0, 0.45]);
  const chest = add(base, [0, 0, 1.05]);
  const neck = add(base, [0, 0, 1.24]);
  const head = add(base, [0, 0, 1.43]);
  const leftShoulder = add(chest, scale(right, -0.22));
  const rightShoulder = add(chest, scale(right, 0.22));
  const leftHip = add(pelvis, scale(right, -0.13));
  const rightHip = add(pelvis, scale(right, 0.13));
  const leftHand = add(add(leftShoulder, scale(forward, 0.04 + swing)), [0, 0, -0.48]);
  let rightHand = add(add(rightShoulder, scale(forward, -0.04 - swing)), [0, 0, -0.48]);
  if (wave) rightHand = add(add(rightShoulder, scale(right, 0.12)), [0, 0, 0.25 + wave]);
  const leftFoot = add(add(leftHip, scale(forward, -swing)), [0, 0, -0.45]);
  const rightFoot = add(add(rightHip, scale(forward, swing)), [0, 0, -0.45]);
  return {
    chest,
    head,
    segments: [
      [pelvis, chest],
      [chest, neck],
      [leftShoulder, rightShoulder],
      [leftShoulder, leftHand],
      [rightShoulder, rightHand],
      [leftHip, rightHip],
      [leftHip, leftFoot],
      [rightHip, rightFoot],
    ],
  };
}

function renderTimeline() {
  const svg = $("#timelineSvg");
  clear(svg);
  const left = TIMELINE_LEFT;
  const rulerH = TIMELINE_RULER_HEIGHT;
  const charH = TIMELINE_CHARACTER_HEIGHT;
  const width = timelineContentWidth();
  const cameraY = rulerH + app.scene.characters.length * charH;
  const height = cameraY + charH + 30;
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  drawRuler(svg, left, width, rulerH, height);
  app.scene.characters.forEach((character, index) => drawTimelineCharacter(svg, character, index, left, rulerH, charH));
  drawTimelineCamera(svg, left, cameraY, charH);
  drawMotionDropPreview(svg, left, rulerH, charH);
  const playX = timelinePlayheadX();
  const snapped = app.drag?.mode === "timeline-scrub" && app.timelineSnap;
  drawTimelineSnapCue(svg, playX, height);
  drawTimelinePlayhead(svg, playX, height, Boolean(snapped));
}

function drawTimelineSnapCue(svg, x, height) {
  if (!(app.drag?.mode === "timeline-scrub" && app.timelineSnap)) return;
  const label = app.timelineSnap.label;
  const labelWidth = Math.max(68, label.length * 7 + 18);
  const labelX = clamp(x + 8, TIMELINE_LEFT + 4, Math.max(TIMELINE_LEFT + 4, timelineContentWidth() - labelWidth - 8));
  svg.appendChild(makeSvg("line", { x1: x, y1: 0, x2: x, y2: height, class: "playhead-snap-line" }));
  svg.appendChild(makeSvg("rect", { x: labelX, y: 4, width: labelWidth, height: 19, rx: 5, class: "playhead-snap-tag" }));
  svg.appendChild(makeSvg("text", { x: labelX + 9, y: 17, class: "playhead-snap-label" }, [document.createTextNode(label)]));
}

function drawTimelinePlayhead(svg, x, height, snapped = false) {
  svg.appendChild(makeSvg("rect", {
    x: x - 7,
    y: 0,
    width: 14,
    height,
    class: "playhead-hit",
    "data-kind": "timeline-playhead",
  }));
  svg.appendChild(makeSvg("line", { x1: x, y1: 0, x2: x, y2: height, class: `playhead ${snapped ? "snapped" : ""}` }));
  const points = `${x - 7},1 ${x + 7},1 ${x + 7},12 ${x},19 ${x - 7},12`;
  svg.appendChild(makeSvg("polygon", { points, class: `playhead-handle ${snapped ? "snapped" : ""}`, "data-kind": "timeline-playhead" }));
}

function drawRuler(svg, left, width, rulerH, height) {
  svg.appendChild(makeSvg("rect", { x: 0, y: 0, width, height: rulerH, fill: "#f2f5f3" }));
  for (let t = 0; t <= app.scene.duration + 0.001; t += 1) {
    const x = left + t * app.pixelsPerSecond;
    svg.appendChild(makeSvg("line", { x1: x, y1: 0, x2: x, y2: height, stroke: t % 5 === 0 ? "#c1cbc7" : "#e2e8e5", "stroke-width": 1 }));
    svg.appendChild(makeSvg("text", { x: x + 3, y: 18, fill: "#657074", "font-size": 12 }, [document.createTextNode(`${t}s`)]));
  }
}

function drawTimelineCharacter(svg, character, index, left, rulerH, charH) {
  const y = rulerH + index * charH;
  const color = characterColor(character, index);
  const hidden = isCharacterHidden(character);
  const laneLabelX = left - 46;
  svg.appendChild(makeSvg("rect", { x: 0, y, width: "100%", height: charH, class: hidden ? "timeline-row-hidden" : "", fill: index % 2 ? "#fbfcfb" : "#ffffff" }));
  drawTrackHeader(svg, character, index, color, y, left, charH, hidden);
  svg.appendChild(makeSvg("text", { x: laneLabelX, y: y + 24, class: "row-label" }, [document.createTextNode("Motion")]));
  svg.appendChild(makeSvg("text", { x: laneLabelX, y: y + 55, class: "row-label" }, [document.createTextNode("Path")]));
  drawIdleGaps(svg, character, left, y + 8, hidden);
  sortedClips(character).forEach((clip, clipIndex) => drawClip(svg, character, clip, clipIndex, left, y + 8, hidden));
  const keyY = y + 50;
  svg.appendChild(makeSvg("line", { x1: left, y1: keyY, x2: left + app.scene.duration * app.pixelsPerSecond, y2: keyY, stroke: "#cbd6d2", "stroke-width": 2 }));
  sortedKeys(character).forEach((key, keyIndex) => {
    const x = left + key.time * app.pixelsPerSecond;
    const selected = app.selection.type === "root" && app.selection.characterId === character.id && app.selection.index === keyIndex;
    const points = `${x},${keyY - 8} ${x + 8},${keyY} ${x},${keyY + 8} ${x - 8},${keyY}`;
    svg.appendChild(makeSvg("polygon", {
      points,
      class: `root-key ${selected ? "selected" : ""} ${hidden ? "timeline-hidden-item" : ""}`,
      fill: color,
      "data-kind": "root-time",
      "data-character": character.id,
      "data-index": keyIndex,
    }));
  });
  svg.appendChild(makeSvg("line", {
    x1: 0,
    y1: y + charH,
    x2: timelineContentWidth(),
    y2: y + charH,
    class: "track-separator",
  }));
}

function drawTimelineCamera(svg, left, y, rowH) {
  const camera = sceneCamera();
  const keys = cameraKeyframes(camera);
  const selected = app.selection.type === "camera_key";
  svg.appendChild(makeSvg("rect", { x: 0, y, width: "100%", height: rowH, fill: "#fbfcfb" }));
  svg.appendChild(makeSvg("rect", {
    x: 0,
    y,
    width: left,
    height: rowH,
    class: `track-header-bg ${selected ? "selected" : ""}`,
    "data-kind": "camera-track-select",
  }));
  svg.appendChild(makeSvg("circle", { cx: 18, cy: y + 24, r: 5, fill: "#b23b36", class: "track-select-dot", "data-kind": "camera-track-select" }));
  svg.appendChild(makeSvg("text", { x: 40, y: y + 28, class: "track-label", "data-kind": "camera-track-select" }, [document.createTextNode("Camera")]));
  svg.appendChild(makeSvg("text", { x: 40, y: y + 55, class: "row-label", "data-kind": "camera-track-select" }, [document.createTextNode(camera.preset === "keyframed" ? `${keys.length} keys` : camera.preset.replace("_", " "))]));

  const keyY = y + 42;
  svg.appendChild(makeSvg("text", { x: left - 46, y: y + 47, class: "row-label" }, [document.createTextNode("Keys")]));
  svg.appendChild(makeSvg("line", { x1: left, y1: keyY, x2: left + app.scene.duration * app.pixelsPerSecond, y2: keyY, stroke: "#d2c3c1", "stroke-width": 2 }));
  if (camera.preset === "keyframed") {
    cameraSegments(camera).forEach((segment) => {
      const first = keys.find((key) => key.id === segment.from);
      const second = keys.find((key) => key.id === segment.to);
      if (!first || !second) return;
      const x1 = left + first.time * app.pixelsPerSecond;
      const x2 = left + second.time * app.pixelsPerSecond;
      svg.appendChild(makeSvg("line", {
        x1,
        y1: keyY,
        x2,
        y2: keyY,
        class: `camera-segment camera-segment-${segment.mode || "linear"}`,
      }));
    });
    keys.forEach((key, keyIndex) => {
      const x = left + key.time * app.pixelsPerSecond;
      const isSelected = app.selection.type === "camera_key" && app.selection.index === keyIndex;
      const points = `${x},${keyY - 9} ${x + 9},${keyY} ${x},${keyY + 9} ${x - 9},${keyY}`;
      svg.appendChild(makeSvg("polygon", {
        points,
        class: `camera-time-key ${isSelected ? "selected" : ""}`,
        "data-kind": "camera-time",
        "data-index": keyIndex,
      }));
      svg.appendChild(makeSvg("text", { x: x + 9, y: keyY - 11, class: "camera-time-label" }, [document.createTextNode(`${key.time.toFixed(1)}s`)]));
    });
  }
  svg.appendChild(makeSvg("line", {
    x1: 0,
    y1: y + rowH,
    x2: timelineContentWidth(),
    y2: y + rowH,
    class: "track-separator",
  }));
}

function drawMotionDropPreview(svg, left, rulerH, charH) {
  if (app.drag?.mode !== "motion-drag" || !app.drag.dropTarget) return;
  const { index, time } = app.drag.dropTarget;
  const motion = motionByLabel(app.drag.motionLabel);
  const y = rulerH + index * charH;
  const start = motionClipStartAt(time);
  const duration = motionClipDurationAt(motion, start);
  const x = left + start * app.pixelsPerSecond;
  const width = Math.max(10, duration * app.pixelsPerSecond);
  svg.appendChild(makeSvg("rect", {
    x: 0,
    y,
    width: timelineContentWidth(),
    height: charH,
    class: "motion-drop-row",
  }));
  svg.appendChild(makeSvg("line", {
    x1: x,
    y1: y + 4,
    x2: x,
    y2: y + charH - 4,
    class: "motion-drop-line",
  }));
  svg.appendChild(makeSvg("rect", {
    x,
    y: y + 8,
    width,
    height: 25,
    class: "motion-drop-preview",
  }));
  if (width > 52) {
    const label = motion.label.replace(/^Preset: /, "").replace(/^Custom: /, "");
    svg.appendChild(makeSvg("text", {
      x: x + 10,
      y: y + 25,
      class: "motion-drop-label",
    }, [document.createTextNode(label.slice(0, Math.max(6, Math.floor(width / 8))))]));
  }
}

function trackDataAttrs(character, kind) {
  return { "data-kind": kind, "data-character": character.id };
}

function drawTrackHeader(svg, character, index, color, y, left, charH, hidden) {
  const selected = app.selection.characterId === character.id;
  const controlX = 18;
  const textX = 40;
  svg.appendChild(makeSvg("rect", {
    x: 0,
    y,
    width: left,
    height: charH,
    class: `track-header-bg ${selected ? "selected" : ""} ${hidden ? "hidden" : ""}`,
    ...trackDataAttrs(character, "track-select"),
  }));
  svg.appendChild(makeSvg("circle", {
    cx: controlX,
    cy: y + 19,
    r: 5,
    fill: color,
    class: `track-select-dot ${hidden ? "timeline-hidden-item" : ""}`,
    ...trackDataAttrs(character, "track-select"),
  }));
  svg.appendChild(makeSvg("text", {
    x: textX,
    y: y + 24,
    class: `track-label ${hidden ? "timeline-hidden-label" : ""}`,
    ...trackDataAttrs(character, "track-select"),
  }, [document.createTextNode(character.label)]));
  const meta = hidden ? "hidden" : `${character.track.length} clips`;
  svg.appendChild(makeSvg("text", {
    x: textX,
    y: y + 55,
    class: `row-label ${hidden ? "hidden-row-label" : ""}`,
    ...trackDataAttrs(character, "track-select"),
  }, [document.createTextNode(meta)]));
  drawTrackVisibilityIcon(svg, character, controlX, y + 51, hidden);
}

function drawTrackVisibilityIcon(svg, character, x, y, hidden) {
  svg.appendChild(makeSvg("rect", {
    x: x - 14,
    y: y - 14,
    width: 28,
    height: 28,
    class: "track-visibility-hit",
    ...trackDataAttrs(character, "track-visibility"),
  }));
  svg.appendChild(makeSvg("ellipse", {
    cx: x,
    cy: y,
    rx: 9,
    ry: 6,
    class: `track-visibility-eye ${hidden ? "hidden" : ""}`,
    ...trackDataAttrs(character, "track-visibility"),
  }));
  svg.appendChild(makeSvg("circle", {
    cx: x,
    cy: y,
    r: 2.5,
    class: `track-visibility-pupil ${hidden ? "hidden" : ""}`,
    ...trackDataAttrs(character, "track-visibility"),
  }));
  if (hidden) {
    svg.appendChild(makeSvg("line", {
      x1: x - 9,
      y1: y + 9,
      x2: x + 9,
      y2: y - 9,
      class: "track-visibility-slash",
      ...trackDataAttrs(character, "track-visibility"),
    }));
  }
}

function drawIdleGaps(svg, character, left, y, hidden = false) {
  const clips = sortedClips(character);
  let cursor = 0;
  for (const clip of clips) {
    if (clip.start > cursor + 0.05) drawIdle(svg, left, y, cursor, clip.start - cursor, hidden);
    cursor = Math.max(cursor, clip.start + clip.duration);
  }
  if (cursor < app.scene.duration - 0.05) drawIdle(svg, left, y, cursor, app.scene.duration - cursor, hidden);
}

function drawIdle(svg, left, y, start, duration, hidden = false) {
  const x = left + start * app.pixelsPerSecond;
  const w = Math.max(4, duration * app.pixelsPerSecond);
  svg.appendChild(makeSvg("rect", { x, y, width: w, height: 25, class: `idle-rect ${hidden ? "timeline-hidden-item" : ""}` }));
  if (w > 38) svg.appendChild(makeSvg("text", { x: x + 8, y: y + 17, class: `idle-label-svg ${hidden ? "timeline-hidden-label" : ""}` }, [document.createTextNode("idle")]));
}

function drawClip(svg, character, clip, clipIndex, left, y, hidden = false) {
  const x = left + clip.start * app.pixelsPerSecond;
  const w = Math.max(8, clip.duration * app.pixelsPerSecond);
  const selected = app.selection.type === "clip" && app.selection.characterId === character.id && app.selection.index === clipIndex;
  const active = app.currentTime >= clip.start && app.currentTime <= clip.start + clip.duration;
  svg.appendChild(makeSvg("rect", {
    x,
    y,
    width: w,
    height: 25,
    class: `clip-rect ${selected ? "selected" : ""} ${active ? "active" : ""} ${hidden ? "timeline-hidden-item" : ""}`,
    "data-kind": "clip-move",
    "data-character": character.id,
    "data-index": clipIndex,
  }));
  const blendInWidth = Math.min(w, normalizedClipBlendIn(clip) * app.pixelsPerSecond);
  const blendOutWidth = Math.min(w, normalizedClipBlendOut(clip) * app.pixelsPerSecond);
  if (blendInWidth > 2) {
    svg.appendChild(makeSvg("path", {
      d: `M ${x} ${y} L ${x + blendInWidth} ${y} L ${x} ${y + 25} Z`,
      class: `clip-blend-zone ${hidden ? "timeline-hidden-item" : ""}`,
    }));
  }
  if (blendOutWidth > 2) {
    svg.appendChild(makeSvg("path", {
      d: `M ${x + w} ${y} L ${x + w} ${y + 25} L ${x + w - blendOutWidth} ${y + 25} Z`,
      class: `clip-blend-zone ${hidden ? "timeline-hidden-item" : ""}`,
    }));
  }
  svg.appendChild(makeSvg("rect", { x, y, width: 8, height: 25, class: "resize-handle", "data-kind": "clip-left", "data-character": character.id, "data-index": clipIndex }));
  svg.appendChild(makeSvg("rect", { x: x + w - 8, y, width: 8, height: 25, class: "resize-handle", "data-kind": "clip-right", "data-character": character.id, "data-index": clipIndex }));
  const label = clip.clip.replace(/^Preset: /, "").replace(/^Custom: /, "");
  svg.appendChild(makeSvg("text", { x: x + 10, y: y + 17, class: `clip-label-svg ${hidden ? "timeline-hidden-label" : ""}` }, [document.createTextNode(label.slice(0, Math.max(6, Math.floor(w / 8))))]));
}

function renderInspector() {
  const panel = $("#inspectorContent");
  const selection = app.selection;
  if (selection.type === "clip") return renderClipInspector(panel, selection);
  if (selection.type === "root") return renderRootInspector(panel, selection);
  if (selection.type === "camera_key") return renderCameraKeyInspector(panel, selection);
  if (selection.type === "character") return renderCharacterInspector(panel, selection);
  return renderSceneInspector(panel);
}

function renderMotionPreviewPanel() {
  const panel = $("#motionPreviewPanel");
  if (!panel) return;
  const motion = motionByLabel(app.selectedMotion);
  if (!motion) {
    panel.innerHTML = "";
    return;
  }
  app.selectedMotion = motion.label;
  const target = selectedCharacter();
  const tags = (motion.tags || []).join(", ");
  const title = motion.name || motion.label.replace(/^Preset: /, "").replace(/^Custom: /, "");
  panel.innerHTML = `
    <canvas id="motionPreviewCanvas" class="motion-preview motion-preview-canvas" aria-label="Motion preview"></canvas>
    <div class="motion-preview-title">${escapeHtml(title)}</div>
    <div class="motion-detail-row"><span>Group</span><strong>${escapeHtml(motionCategoryLabel(motion))}</strong></div>
    <div class="motion-detail-row"><span>Root</span><strong>${escapeHtml(rootContractLabel(motion))}</strong></div>
    <div class="motion-detail-row"><span>Duration</span><strong>${Number(motion.duration || 0).toFixed(1)}s</strong></div>
    <div class="motion-detail-row"><span>Tags</span><strong>${escapeHtml(tags || "motion")}</strong></div>
    ${motion.prompt ? `<div class="motion-preview-prompt">${escapeHtml(motion.prompt)}</div>` : ""}
    <div class="button-row">
      <button id="appendPreviewMotion">Add To ${escapeHtml(target?.label || "Track")}</button>
    </div>
  `;
  $("#appendPreviewMotion").addEventListener("click", () => appendClipToSelectedCharacter(motion.label));
  setupMotionPreviewCanvasControls();
  renderMotionPreview();
}

function renderSceneInspector(panel) {
  const camera = sceneCamera();
  const keyCount = cameraKeyframes(camera).length;
  panel.innerHTML = `
    <div class="field"><label>Camera path</label><div class="readonly-value">${camera.preset === "keyframed" ? `${keyCount} key${keyCount === 1 ? "" : "s"}` : "Use Keyframed camera preset to edit camera keys."}</div></div>
    <div class="button-row">
      <button id="addCameraKeyAtPlayhead" ${camera.preset === "keyframed" ? "" : "disabled"}>Add Camera Key</button>
      <button id="insertTimeAtPlayhead">Insert Time</button>
    </div>
  `;
  $("#addCameraKeyAtPlayhead").addEventListener("click", addCameraKeyAtPlayhead);
  $("#insertTimeAtPlayhead").addEventListener("click", insertTimeAtPlayhead);
}

function renderExportPanel() {
  const panel = $("#exportPanel");
  const camera = sceneCamera();
  const exportSettings = sceneExport();
  const background = sceneBackground();
  const environmentScenes = completeEnvironmentScenes();
  const missingAvatars = missingFinalAvatarLabels();
  const finalDisabled = app.exportInProgress || missingAvatars.length > 0;
  const targetEnabled = CAMERA_TARGET_PRESETS.has(camera.preset);
  const targetLabel = camera.preset === "slow_orbit"
    ? "Orbit target"
    : camera.preset === "follow_character"
      ? "Follow target"
      : camera.preset === "dolly_in"
        ? "Dolly target"
        : "Target";
  const originOption = `<option value="${CAMERA_ORIGIN_TARGET}" ${camera.target === CAMERA_ORIGIN_TARGET ? "selected" : ""}>Scene origin</option>`;
  const avatarOptions = app.scene.characters.map((character) => `<option value="${escapeHtml(character.id)}" ${character.id === camera.target ? "selected" : ""}>${escapeHtml(character.label)}</option>`).join("");
  const targetOptions = `${originOption}${avatarOptions}`;
  const environmentOptions = environmentScenes
    .map((scene) => `<option value="${escapeHtml(scene.name)}">${escapeHtml(scene.name)}</option>`)
    .join("");
  const environmentHelp = environmentScenes.length
    ? "Applies only background images, color, floor, and grid settings."
    : "Save a scene with sky, floor, front, back, left, and right images to list it here.";
  panel.innerHTML = `
    <div class="shot-preview">
      <canvas id="shotPreviewCanvas" class="shot-preview-canvas" width="360" height="203" aria-hidden="true"></canvas>
      <svg id="shotPreviewSvg" class="shot-preview-svg" viewBox="0 0 360 203" aria-label="Camera shot preview"></svg>
    </div>
    <div class="field"><label>Camera</label><select id="cameraPreset">${CAMERA_PRESETS.map(([value, label]) => `<option value="${value}" ${value === camera.preset ? "selected" : ""}>${label}</option>`).join("")}</select></div>
    <div class="field"><label>${targetLabel}</label><select id="cameraTarget" ${targetEnabled ? "" : "disabled"}>${targetOptions}</select></div>
    <div class="field"><label>Camera height</label><input id="cameraHeight" type="number" min="0.4" step="0.05" value="${camera.height}"></div>
    <div class="field"><label>Environment from scene</label><div class="button-row"><select id="environmentSceneSelect" ${environmentScenes.length ? "" : "disabled"}>${environmentOptions || '<option value="">No complete environments</option>'}</select><button id="applyEnvironmentScene" type="button" ${environmentScenes.length ? "" : "disabled"}>Apply</button></div><div class="readonly-value">${escapeHtml(environmentHelp)}</div></div>
    <div class="field"><label>Background set</label><div class="button-row"><button id="uploadBackgroundSet" type="button">Import Set</button></div><div class="readonly-value">Use sky, floor, front, back, left, right filenames.</div></div>
    <div class="field"><label>Rotate imports 180</label><input id="rotateBackgroundImports" type="checkbox" ${app.backgroundImportRotate180 ? "checked" : ""}></div>
    <div class="field"><label>Sky image</label><div class="button-row"><button id="uploadSkyImage" type="button">Upload</button><button id="clearSkyImage" type="button" ${background.sky_image ? "" : "disabled"}>Clear</button></div><div class="readonly-value">${escapeHtml(background.sky_image || "Flat color fallback")}</div></div>
    <div class="field"><label>Floor image</label><div class="button-row"><button id="uploadFloorImage" type="button">Upload</button><button id="clearFloorImage" type="button" ${background.floor_image ? "" : "disabled"}>Clear</button></div><div class="readonly-value">${escapeHtml(background.floor_image || "No floor texture")}</div></div>
    <div class="field"><label>Front wall image</label><div class="button-row"><button id="uploadWallFrontImage" type="button">Upload</button><button id="clearWallFrontImage" type="button" ${background.wall_front_image ? "" : "disabled"}>Clear</button></div><div class="readonly-value">${escapeHtml(background.wall_front_image || "No front wall")}</div></div>
    <div class="field"><label>Back wall image</label><div class="button-row"><button id="uploadWallBackImage" type="button">Upload</button><button id="clearWallBackImage" type="button" ${background.wall_back_image ? "" : "disabled"}>Clear</button></div><div class="readonly-value">${escapeHtml(background.wall_back_image || "No back wall")}</div></div>
    <div class="field"><label>Left wall image</label><div class="button-row"><button id="uploadWallLeftImage" type="button">Upload</button><button id="clearWallLeftImage" type="button" ${background.wall_left_image ? "" : "disabled"}>Clear</button></div><div class="readonly-value">${escapeHtml(background.wall_left_image || "No left wall")}</div></div>
    <div class="field"><label>Right wall image</label><div class="button-row"><button id="uploadWallRightImage" type="button">Upload</button><button id="clearWallRightImage" type="button" ${background.wall_right_image ? "" : "disabled"}>Clear</button></div><div class="readonly-value">${escapeHtml(background.wall_right_image || "No right wall")}</div></div>
    <div class="export-grid">
      <div class="field"><label>Background color</label><input id="backgroundColor" type="color" value="${escapeHtml(background.color || "#f4f1ea")}"></div>
      <div class="field"><label>Show floor</label><input id="showFloor" type="checkbox" ${background.show_floor === false ? "" : "checked"}></div>
      <div class="field"><label>Show grid</label><input id="showGrid" type="checkbox" ${background.show_grid === false ? "" : "checked"}></div>
    </div>
    <div class="export-grid">
      <div class="field"><label>Width</label><input id="exportWidth" type="number" min="320" max="${FINAL_AVATAR_MAX_WIDTH}" step="2" value="${exportSettings.width}"></div>
      <div class="field"><label>Height</label><input id="exportHeight" type="number" min="180" max="${FINAL_AVATAR_MAX_HEIGHT}" step="2" value="${exportSettings.height}"></div>
      <div class="field"><label>FPS</label><input id="exportFps" type="number" min="1" max="${FINAL_AVATAR_MAX_FPS}" step="1" value="${exportSettings.fps}"></div>
    </div>
    <div class="export-limit-note">Final export limit: ${FINAL_AVATAR_MAX_WIDTH}x${FINAL_AVATAR_MAX_HEIGHT}, ${FINAL_AVATAR_MAX_FPS} fps.</div>
    <div class="button-row export-actions">
      <button id="exportDraftButton" class="secondary-action" ${app.exportInProgress ? "disabled" : ""}>${app.exportInProgress && app.exportMode === "blocky_draft" ? "Rendering..." : "Render Draft"}</button>
      <button id="exportFinalButton" class="primary-action" ${finalDisabled ? "disabled" : ""}>${app.exportInProgress && app.exportMode === "avatar_final" ? "Rendering..." : "Render Final"}</button>
    </div>
    <div id="exportStatus" class="export-status">${formatExportStatus()}</div>
  `;
  renderShotPreview();
  $("#cameraPreset").addEventListener("change", (event) => {
    const currentPose = cameraPoseAt(app.currentTime);
    pushUndoSnapshot();
    camera.preset = event.target.value;
    if (camera.preset === "keyframed" && !cameraKeyframes(camera).length) {
      camera.keyframes.push({
        id: nextCameraKeyId(camera),
        time: app.currentTime,
        position: [...currentPose.position],
        look_at: [...currentPose.lookAt],
        fov_degrees: currentPose.fovDegrees || 45,
      });
    }
    renderAll();
  });
  $("#cameraTarget").addEventListener("change", (event) => { pushUndoSnapshot(); camera.target = event.target.value; renderAll(); });
  $("#cameraHeight").addEventListener("change", (event) => { pushUndoSnapshot(); camera.height = Math.max(0.4, Number(event.target.value)); renderAll(); });
  $("#applyEnvironmentScene").addEventListener("click", applyEnvironmentFromScene);
  $("#uploadBackgroundSet").addEventListener("click", uploadBackgroundSet);
  $("#rotateBackgroundImports").addEventListener("change", (event) => { app.backgroundImportRotate180 = Boolean(event.target.checked); });
  $("#uploadSkyImage").addEventListener("click", () => uploadBackgroundImage("sky_image"));
  $("#uploadFloorImage").addEventListener("click", () => uploadBackgroundImage("floor_image"));
  $("#uploadWallFrontImage").addEventListener("click", () => uploadBackgroundImage("wall_front_image"));
  $("#uploadWallBackImage").addEventListener("click", () => uploadBackgroundImage("wall_back_image"));
  $("#uploadWallLeftImage").addEventListener("click", () => uploadBackgroundImage("wall_left_image"));
  $("#uploadWallRightImage").addEventListener("click", () => uploadBackgroundImage("wall_right_image"));
  $("#clearSkyImage").addEventListener("click", () => { pushUndoSnapshot(); background.sky_image = ""; renderAll(); });
  $("#clearFloorImage").addEventListener("click", () => { pushUndoSnapshot(); background.floor_image = ""; renderAll(); });
  $("#clearWallFrontImage").addEventListener("click", () => { pushUndoSnapshot(); background.wall_front_image = ""; renderAll(); });
  $("#clearWallBackImage").addEventListener("click", () => { pushUndoSnapshot(); background.wall_back_image = ""; renderAll(); });
  $("#clearWallLeftImage").addEventListener("click", () => { pushUndoSnapshot(); background.wall_left_image = ""; renderAll(); });
  $("#clearWallRightImage").addEventListener("click", () => { pushUndoSnapshot(); background.wall_right_image = ""; renderAll(); });
  $("#backgroundColor").addEventListener("change", (event) => { pushUndoSnapshot(); background.color = event.target.value || "#f4f1ea"; renderAll(); });
  $("#showFloor").addEventListener("change", (event) => { pushUndoSnapshot(); background.show_floor = Boolean(event.target.checked); renderAll(); });
  $("#showGrid").addEventListener("change", (event) => { pushUndoSnapshot(); background.show_grid = Boolean(event.target.checked); renderAll(); });
  $("#exportFps").addEventListener("change", (event) => { pushUndoSnapshot(); exportSettings.fps = clamp(Number(event.target.value), 1, FINAL_AVATAR_MAX_FPS); renderAll(); });
  $("#exportWidth").addEventListener("change", (event) => { pushUndoSnapshot(); exportSettings.width = evenNumber(clamp(Number(event.target.value), 320, FINAL_AVATAR_MAX_WIDTH)); renderAll(); });
  $("#exportHeight").addEventListener("change", (event) => { pushUndoSnapshot(); exportSettings.height = evenNumber(clamp(Number(event.target.value), 180, FINAL_AVATAR_MAX_HEIGHT)); renderAll(); });
  $("#exportDraftButton").addEventListener("click", () => exportVideo("blocky_draft"));
  $("#exportFinalButton").addEventListener("click", () => exportVideo("avatar_final"));
}

function formatExportStatus() {
  if (app.exportVideoUrl) {
    const warning = app.exportWarning ? `<div class="export-cap-note">${escapeHtml(app.exportWarning)}</div>` : "";
    return `Saved <a href="${escapeHtml(app.exportVideoUrl)}" target="_blank" rel="noopener">${escapeHtml(app.exportVideoPath.split("/").pop() || "video")}</a>${warning}`;
  }
  if (app.exportStatus) {
    const warning = app.exportWarning ? `<div class="export-cap-note">${escapeHtml(app.exportWarning)}</div>` : "";
    return `${escapeHtml(app.exportStatus)}${warning}`;
  }
  const missingAvatars = missingFinalAvatarLabels();
  if (missingAvatars.length) {
    return escapeHtml(`Assign final avatars for ${missingAvatars.join(", ")} before final render.`);
  }
  return "Draft and final render ready.";
}

function evenNumber(value) {
  const rounded = Math.round(value);
  return rounded + (rounded % 2);
}

function finalAvatarExportSettings(exportSettings) {
  const requestedFps = Math.max(1, Math.round(Number(exportSettings.fps) || DEFAULT_EXPORT.fps));
  const requestedWidth = Math.max(2, Math.round(Number(exportSettings.width) || DEFAULT_EXPORT.width));
  const requestedHeight = Math.max(2, Math.round(Number(exportSettings.height) || DEFAULT_EXPORT.height));
  const scale = Math.min(
    1,
    FINAL_AVATAR_MAX_WIDTH / Math.max(1, requestedWidth),
    FINAL_AVATAR_MAX_HEIGHT / Math.max(1, requestedHeight),
  );
  const fps = Math.min(requestedFps, FINAL_AVATAR_MAX_FPS);
  const width = evenNumber(requestedWidth * scale);
  const height = evenNumber(requestedHeight * scale);
  const capped = fps !== requestedFps || scale < 1;
  const adjusted = width !== requestedWidth || height !== requestedHeight;
  let warning = "";
  if (capped) {
    warning = `Final avatar render capped from ${requestedWidth}x${requestedHeight} ${requestedFps} fps to ${width}x${height} ${fps} fps.`;
  } else if (adjusted) {
    warning = `Final avatar render adjusted to even video dimensions: ${requestedWidth}x${requestedHeight} -> ${width}x${height}.`;
  }
  return { fps, width, height, capped, adjusted, warning };
}

function renderCharacterInspector(panel, selection) {
  const character = characterById(selection.characterId);
  const characterIndex = Math.max(0, app.scene.characters.indexOf(character));
  const color = characterColor(character, characterIndex);
  const colorButtons = COLOR_PRESETS.map((preset) => `
    <button type="button" class="color-swatch ${preset.value === color ? "selected" : ""}" style="--swatch-color: ${preset.value}" data-color="${preset.value}" aria-label="${escapeHtml(preset.label)}" title="${escapeHtml(preset.label)}" aria-pressed="${preset.value === color ? "true" : "false"}">
      <span class="color-swatch-chip"></span>
    </button>
  `).join("");
  const hiddenAfter = characterHiddenAfterValue(character);
  const hideStatus = hiddenAfter !== null ? `Hidden after ${hiddenAfter.toFixed(2)}s` : "Visible entire scene";
  panel.innerHTML = `
    <div class="field"><label>Name</label><input id="charLabel" value="${escapeHtml(character.label)}"></div>
    <div class="field"><label>Color</label><div class="color-preset-grid">${colorButtons}</div></div>
    <div class="field"><label><input id="charTintAvatarColors" type="checkbox" ${character.tint_avatar_colors === false ? "" : "checked"}> Tint avatar/proxy colors</label></div>
    <div class="field"><label>Visibility</label><div class="button-row"><button id="hideCharacterAfterPlayhead">Hide After Playhead</button><button id="clearCharacterHide" ${hiddenAfter !== null ? "" : "disabled"}>Clear</button></div><div class="readonly-value">${escapeHtml(hideStatus)}</div></div>
    <div class="field"><label>Preview proxy</label><select id="charProxy">${proxyOptionsHtml(character)}</select></div>
    <div class="field"><label>Final avatar</label><select id="charAvatar">${avatarOptionsHtml(character)}</select></div>
  `;
  $("#charLabel").addEventListener("change", (event) => {
    pushUndoSnapshot();
    character.label = event.target.value;
    renderAll();
  });
  panel.querySelectorAll(".color-swatch").forEach((button) => {
    button.addEventListener("click", () => {
      const nextColor = button.dataset.color;
      if (!nextColor || character.color === nextColor) return;
      pushUndoSnapshot();
      character.color = nextColor;
      renderAll();
    });
  });
  $("#charTintAvatarColors").addEventListener("change", (event) => {
    pushUndoSnapshot();
    character.tint_avatar_colors = event.target.checked;
    renderAll();
  });
  $("#hideCharacterAfterPlayhead").addEventListener("click", () => {
    pushUndoSnapshot();
    character.hidden_after = Number(app.currentTime.toFixed(6));
    renderAll();
  });
  $("#clearCharacterHide").addEventListener("click", () => {
    pushUndoSnapshot();
    delete character.hidden_after;
    renderAll();
  });
  $("#charAvatar").addEventListener("change", (event) => {
    pushUndoSnapshot();
    character.avatar_asset = event.target.value;
    renderAll();
  });
  $("#charProxy").addEventListener("change", (event) => {
    pushUndoSnapshot();
    character.proxy_asset = event.target.value;
    renderAll();
  });
}

function renderClipInspector(panel, selection) {
  const character = characterById(selection.characterId);
  const clip = sortedClips(character)[selection.index];
  if (!clip) return renderCharacterInspector(panel, { characterId: character.id });
  const currentMotion = exactMotionByLabel(clip.clip);
  const motionTitle = currentMotion?.name || clip.clip.replace(/^Preset: /, "").replace(/^Custom: /, "");
  const motionGroup = currentMotion ? motionCategoryLabel(currentMotion) : "Not in library";
  const motionRoot = currentMotion ? rootContractLabel(currentMotion) : "Unknown";
  const trimStart = normalizedClipTrimStart(clip, currentMotion);
  const trimEnd = normalizedClipTrimEnd(clip, currentMotion);
  const sourceDuration = motionSourceDuration(currentMotion);
  const playbackSpeed = clipPlaybackSpeed(clip, currentMotion);
  panel.innerHTML = `
    <div class="field"><label>Motion</label><div class="readonly-value">${escapeHtml(motionTitle)}</div></div>
    <div class="motion-detail-row"><span>Group</span><strong>${escapeHtml(motionGroup)}</strong></div>
    <div class="motion-detail-row"><span>Root</span><strong>${escapeHtml(motionRoot)}</strong></div>
    <div class="field"><label>Start</label><input id="clipStart" type="number" min="0" step="0.1" value="${clip.start}"></div>
    <div class="field"><label>Timeline length</label><input id="clipDuration" type="number" min="0.1" step="0.1" value="${clip.duration}"></div>
    <div class="clip-two-column-row">
      <div class="field"><label>Source in</label><input id="clipTrimStart" type="number" min="0" max="${sourceDuration}" step="0.05" value="${trimStart}"></div>
      <div class="field"><label>Source out</label><input id="clipTrimEnd" type="number" min="0" max="${sourceDuration}" step="0.05" value="${trimEnd}"></div>
    </div>
    <div class="motion-detail-row"><span>Playback speed</span><strong>${playbackSpeed.toFixed(2)}x</strong></div>
    <div class="clip-blend-row">
      <div class="field"><label>Blend in</label><input id="clipBlendIn" type="number" min="0" step="0.05" value="${normalizedClipBlendIn(clip)}"></div>
      <div class="field"><label>Blend out</label><input id="clipBlendOut" type="number" min="0" step="0.05" value="${normalizedClipBlendOut(clip)}"></div>
    </div>
    <div class="field"><label>Root travel</label><select id="clipRoot"><option value="path" ${clip.root_mode === "path" ? "selected" : ""}>Follow scene path</option><option value="native" ${clip.root_mode === "native" ? "selected" : ""}>Use original travel</option></select></div>
    <div class="field"><label>Hand pose</label><select id="clipHandPose"><option value="natural" ${normalizedHandPose(clip.hand_pose) === "natural" ? "selected" : ""}>Natural</option><option value="fist" ${normalizedHandPose(clip.hand_pose) === "fist" ? "selected" : ""}>Fist</option></select></div>
    <div class="field"><label>Shoulder mask</label><select id="clipShoulderMask"><option value="normal" ${normalizedShoulderMask(clip.shoulder_mask) === "normal" ? "selected" : ""}>Normal</option><option value="arms_forward" ${normalizedShoulderMask(clip.shoulder_mask) === "arms_forward" ? "selected" : ""}>Arms forward</option></select></div>
    <div class="button-row">
      <button id="duplicateClip">Duplicate</button>
    </div>
  `;
  $("#clipStart").addEventListener("change", (event) => { pushUndoSnapshot(); clip.start = clamp(Number(event.target.value), 0, app.scene.duration); renderAll(); });
  $("#clipDuration").addEventListener("change", (event) => { pushUndoSnapshot(); clip.duration = Math.max(0.1, Number(event.target.value)); renderAll(); });
  $("#clipTrimStart").addEventListener("change", (event) => {
    pushUndoSnapshot();
    const motion = exactMotionByLabel(clip.clip);
    const sourceEnd = normalizedClipTrimEnd(clip, motion);
    clip.trim_start = clamp(Number(event.target.value) || 0, 0, Math.max(0, sourceEnd - 0.001));
    renderAll();
  });
  $("#clipTrimEnd").addEventListener("change", (event) => {
    pushUndoSnapshot();
    const motion = exactMotionByLabel(clip.clip);
    const duration = motionSourceDuration(motion);
    const trimStartValue = normalizedClipTrimStart(clip, motion);
    const value = clamp(Number(event.target.value) || duration, trimStartValue + 0.001, duration);
    clip.trim_end = value >= duration - 0.001 ? null : value;
    renderAll();
  });
  $("#clipBlendIn").addEventListener("change", (event) => { pushUndoSnapshot(); clip.blend_in = clamp(Number(event.target.value) || 0, 0, clip.duration); renderAll(); });
  $("#clipBlendOut").addEventListener("change", (event) => { pushUndoSnapshot(); clip.blend_out = clamp(Number(event.target.value) || 0, 0, clip.duration); renderAll(); });
  $("#clipRoot").addEventListener("change", (event) => { pushUndoSnapshot(); clip.root_mode = event.target.value; renderAll(); });
  $("#clipHandPose").addEventListener("change", (event) => { pushUndoSnapshot(); clip.hand_pose = normalizedHandPose(event.target.value); renderAll(); });
  $("#clipShoulderMask").addEventListener("change", (event) => { pushUndoSnapshot(); clip.shoulder_mask = normalizedShoulderMask(event.target.value); renderAll(); });
  $("#duplicateClip").addEventListener("click", () => duplicateClip(character, clip));
}

function renderRootInspector(panel, selection) {
  const character = characterById(selection.characterId);
  const key = sortedKeys(character)[selection.index];
  if (!key) return renderCharacterInspector(panel, { characterId: character.id });
  const segmentRefs = editableSegmentsForKey(character, key);
  const incomingMode = segmentRefs?.incoming ? segmentModeForPair(character, segmentRefs.incoming.fromKey, segmentRefs.incoming.toKey) : "";
  const outgoingMode = segmentRefs?.outgoing ? segmentModeForPair(character, segmentRefs.outgoing.fromKey, segmentRefs.outgoing.toKey) : "";
  const segmentField = segmentRefs?.incoming || segmentRefs?.outgoing ? `
    <div class="segment-mode-row">
    ${segmentRefs?.incoming ? segmentModeSelectHtml("Incoming path", "keyIncomingMode", incomingMode) : ""}
    ${segmentRefs?.outgoing ? segmentModeSelectHtml("Outgoing path", "keyOutgoingMode", outgoingMode) : ""}
    </div>
  ` : "";
  panel.innerHTML = `
    <div class="field"><label>Time</label><input id="keyTime" type="number" min="0" step="0.1" value="${key.time}"></div>
    <div class="field"><label>X</label><input id="keyX" type="number" step="0.05" value="${key.position[0]}"></div>
    <div class="field"><label>Y</label><input id="keyY" type="number" step="0.05" value="${key.position[1]}"></div>
    <div class="field"><label>Z</label><input id="keyZ" type="number" step="0.05" value="${key.position?.[2] || 0}"></div>
    <div class="field">
      <label>Facing degrees</label>
      <div class="inline-field-action">
        <input id="keyFacing" type="number" step="5" value="${key.facing_degrees}">
        <button id="facePathButton">Face Along Segment</button>
      </div>
    </div>
    ${segmentField}
    <div class="button-row">
      <button id="snapKeyToPlayhead">Move To Playhead</button>
    </div>
  `;
  $("#keyTime").addEventListener("change", (event) => { pushUndoSnapshot(); key.time = clamp(Number(event.target.value), 0, app.scene.duration); renderAll(); });
  $("#keyX").addEventListener("change", (event) => { pushUndoSnapshot(); key.position[0] = Number(event.target.value); renderAll(); });
  $("#keyY").addEventListener("change", (event) => { pushUndoSnapshot(); key.position[1] = Number(event.target.value); renderAll(); });
  $("#keyZ").addEventListener("change", (event) => {
    pushUndoSnapshot();
    if (!Array.isArray(key.position)) key.position = [0, 0, 0];
    while (key.position.length < 3) key.position.push(0);
    key.position[2] = Number(event.target.value) || 0;
    renderAll();
  });
  $("#keyFacing").addEventListener("change", (event) => { pushUndoSnapshot(); key.facing_degrees = Number(event.target.value); renderAll(); });
  $("#facePathButton").addEventListener("click", faceSelectedWaypointAlongPath);
  if (segmentRefs?.incoming) {
    $("#keyIncomingMode").addEventListener("change", (event) => {
      pushUndoSnapshot();
      setSegmentModeForPair(character, segmentRefs.incoming.fromKey, segmentRefs.incoming.toKey, event.target.value);
      renderAll();
    });
  }
  if (segmentRefs?.outgoing) {
    $("#keyOutgoingMode").addEventListener("change", (event) => {
      pushUndoSnapshot();
      setSegmentModeForPair(character, segmentRefs.outgoing.fromKey, segmentRefs.outgoing.toKey, event.target.value);
      renderAll();
    });
  }
  $("#snapKeyToPlayhead").addEventListener("click", () => { pushUndoSnapshot(); key.time = app.currentTime; renderAll(); });
}

function renderCameraKeyInspector(panel, selection) {
  const camera = sceneCamera();
  const key = cameraKeyframes(camera)[selection.index];
  if (!key) return renderSceneInspector(panel);
  const segmentRefs = editableCameraSegmentsForKey(camera, key);
  const incomingMode = segmentRefs?.incoming ? cameraSegmentModeForPair(camera, segmentRefs.incoming.fromKey, segmentRefs.incoming.toKey) : "";
  const outgoingMode = segmentRefs?.outgoing ? cameraSegmentModeForPair(camera, segmentRefs.outgoing.fromKey, segmentRefs.outgoing.toKey) : "";
  const segmentField = segmentRefs?.incoming || segmentRefs?.outgoing ? `
    <div class="segment-mode-row">
    ${segmentRefs?.incoming ? segmentModeSelectHtml("Incoming camera", "cameraIncomingMode", incomingMode) : ""}
    ${segmentRefs?.outgoing ? segmentModeSelectHtml("Outgoing camera", "cameraOutgoingMode", outgoingMode) : ""}
    </div>
  ` : "";
  panel.innerHTML = `
    <div class="field"><label>Time</label><input id="cameraKeyTime" type="number" min="0" step="0.1" value="${key.time}"></div>
    <div class="field"><label>Camera X</label><input id="cameraKeyX" type="number" step="0.05" value="${key.position[0]}"></div>
    <div class="field"><label>Camera Y</label><input id="cameraKeyY" type="number" step="0.05" value="${key.position[1]}"></div>
    <div class="field"><label>Camera Z</label><input id="cameraKeyZ" type="number" step="0.05" value="${key.position[2]}"></div>
    <div class="field"><label>Look-at X</label><input id="cameraLookX" type="number" step="0.05" value="${key.look_at[0]}"></div>
    <div class="field"><label>Look-at Y</label><input id="cameraLookY" type="number" step="0.05" value="${key.look_at[1]}"></div>
    <div class="field"><label>Look-at Z</label><input id="cameraLookZ" type="number" step="0.05" value="${key.look_at[2]}"></div>
    <div class="field"><label>FOV degrees</label><input id="cameraFovDegrees" type="number" min="10" max="120" step="1" value="${key.fov_degrees}"></div>
    ${segmentField}
    <div class="button-row">
      <button id="snapCameraKeyToPlayhead">Move To Playhead</button>
      <button id="duplicateCameraKey">Duplicate</button>
    </div>
  `;
  $("#cameraKeyTime").addEventListener("change", (event) => {
    pushUndoSnapshot();
    key.time = clamp(Number(event.target.value), 0, app.scene.duration);
    selectCameraKeyById(key.id);
  });
  $("#cameraKeyX").addEventListener("change", (event) => { pushUndoSnapshot(); key.position[0] = Number(event.target.value) || 0; renderAll(); });
  $("#cameraKeyY").addEventListener("change", (event) => { pushUndoSnapshot(); key.position[1] = Number(event.target.value) || 0; renderAll(); });
  $("#cameraKeyZ").addEventListener("change", (event) => { pushUndoSnapshot(); key.position[2] = Number(event.target.value) || 0; renderAll(); });
  $("#cameraLookX").addEventListener("change", (event) => { pushUndoSnapshot(); key.look_at[0] = Number(event.target.value) || 0; renderAll(); });
  $("#cameraLookY").addEventListener("change", (event) => { pushUndoSnapshot(); key.look_at[1] = Number(event.target.value) || 0; renderAll(); });
  $("#cameraLookZ").addEventListener("change", (event) => { pushUndoSnapshot(); key.look_at[2] = Number(event.target.value) || 0; renderAll(); });
  $("#cameraFovDegrees").addEventListener("change", (event) => { pushUndoSnapshot(); key.fov_degrees = clamp(Number(event.target.value) || 45, 10, 120); renderAll(); });
  if (segmentRefs?.incoming) {
    $("#cameraIncomingMode").addEventListener("change", (event) => {
      pushUndoSnapshot();
      setCameraSegmentModeForPair(camera, segmentRefs.incoming.fromKey, segmentRefs.incoming.toKey, event.target.value);
      renderAll();
    });
  }
  if (segmentRefs?.outgoing) {
    $("#cameraOutgoingMode").addEventListener("change", (event) => {
      pushUndoSnapshot();
      setCameraSegmentModeForPair(camera, segmentRefs.outgoing.fromKey, segmentRefs.outgoing.toKey, event.target.value);
      renderAll();
    });
  }
  $("#snapCameraKeyToPlayhead").addEventListener("click", () => {
    pushUndoSnapshot();
    key.time = app.currentTime;
    selectCameraKeyById(key.id);
  });
  $("#duplicateCameraKey").addEventListener("click", () => duplicateCameraKey(key));
}

function segmentModeSelectHtml(label, id, value) {
  return `
    <div class="field segment-mode-field"><label>${label}</label><select id="${id}">
      <option value="linear" ${value === "linear" ? "selected" : ""}>Linear</option>
      <option value="curve" ${value === "curve" ? "selected" : ""}>Curve</option>
      <option value="hold" ${value === "hold" ? "selected" : ""}>Hold start</option>
    </select></div>
  `;
}

function renderWarnings() {
  const warnings = localWarnings();
  const list = $("#warningList");
  if (!list) return;
  list.classList.toggle("has-warnings", warnings.length > 0);
  list.innerHTML = warnings.length ? warnings.map((warning) => `<div>${escapeHtml(warning)}</div>`).join("") : "<div>No warnings.</div>";
}

function localWarnings() {
  const warnings = [];
  for (const character of app.scene.characters) {
    const clips = sortedClips(character);
    clips.forEach((clip, index) => {
      if (clip.start + clip.duration > app.scene.duration + 0.001) warnings.push(`${character.label}: clip extends past scene`);
      if (index > 0) {
        const previous = clips[index - 1];
        if (clip.start < previous.start + previous.duration - 0.001) warnings.push(`${character.label}: clips overlap near ${clip.start.toFixed(1)}s`);
      }
    });
    const keys = sortedKeys(character);
    keys.slice(0, -1).forEach((key, index) => {
      const next = keys[index + 1];
      const dx = next.position[0] - key.position[0];
      const dy = next.position[1] - key.position[1];
      const speed = Math.hypot(dx, dy) / Math.max(0.001, next.time - key.time);
      if (speed > 2.2) warnings.push(`${character.label}: fast path segment near ${key.time.toFixed(1)}s`);
    });
  }
  return warnings.slice(0, 8);
}

function stagePointerDown(event) {
  if (event.button !== 0 && event.button !== 1) return;
  event.preventDefault();
  const svg = $("#stageSvg");
  const target = event.target;
  const kind = target?.dataset?.kind;
  if (!kind) {
    app.drag = {
      mode: "stage-pan",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBox: stageViewBox(),
      startZoom: stageView().zoom,
      rect: svg.getBoundingClientRect(),
      moved: false,
    };
    svg.classList.add("panning");
    svg.setPointerCapture?.(event.pointerId);
    return;
  }
  const point = svgPoint(svg, event);
  if (kind === "stage-camera-key" || kind === "stage-camera-target") {
    const index = Number(target.dataset.index);
    const key = cameraKeyframes()[index];
    if (!key) return;
    setSelection({ type: "camera_key", index });
    app.drag = {
      mode: kind,
      index,
      keyId: key.id,
      startPoint: point,
      original: JSON.parse(JSON.stringify(key)),
    };
    svg.setPointerCapture?.(event.pointerId);
    return;
  }
  let character = characterById(target.dataset.character);
  let index = Number(target.dataset.index);
  let cycleRefs = [];
  let cycleOnClick = false;
  if (kind === "stage-key") {
    const nearbyRefs = stageWaypointRefsNear(point);
    const selectedRef = nearbyRefs.find(stageRefMatchesSelection);
    const targetRef = nearbyRefs.find((ref) => stageRefMatchesDataset(ref, target));
    const chosenRef = selectedRef || targetRef;
    if (chosenRef) {
      character = chosenRef.character;
      index = chosenRef.index;
      cycleRefs = nearbyRefs.map(compactStageRef);
      cycleOnClick = nearbyRefs.length > 1 && Boolean(selectedRef);
    }
  }
  setSelection({ type: "root", characterId: character.id, index });
  const key = sortedKeys(character)[index];
  app.drag = {
    mode: kind,
    characterId: character.id,
    index,
    keyId: key.id,
    startPoint: point,
    original: JSON.parse(JSON.stringify(key)),
    cycleRefs,
    cycleOnClick,
  };
  svg.setPointerCapture?.(event.pointerId);
}

function timelinePointerDown(event) {
  const target = event.target.closest?.("[data-kind]") || event.target;
  const kind = target?.dataset?.kind;
  const point = svgPoint($("#timelineSvg"), event);
  if (!kind) {
    event.preventDefault();
    app.selection = { type: "scene" };
    const inRuler = point.y < TIMELINE_RULER_HEIGHT;
    const inTrackRows = point.x >= TIMELINE_LEFT
      && point.y >= TIMELINE_RULER_HEIGHT
      && point.y < TIMELINE_RULER_HEIGHT + app.scene.characters.length * TIMELINE_CHARACTER_HEIGHT;
    if (inRuler || inTrackRows) {
      startTimelineScrub(point, event.pointerId, event);
    } else {
      app.timelineSnap = null;
      renderAll();
    }
    return;
  }
  if (kind === "timeline-playhead") {
    event.preventDefault();
    startTimelineScrub(point, event.pointerId, event);
    return;
  }
  if (kind === "camera-track-select") {
    event.preventDefault();
    setSelection({ type: "scene" });
    return;
  }
  if (kind === "camera-time") {
    event.preventDefault();
    const index = Number(target.dataset.index);
    const key = cameraKeyframes()[index];
    if (!key) return;
    setSelection({ type: "camera_key", index });
    app.drag = {
      mode: "camera-time",
      index,
      keyId: key.id,
      startPoint: point,
      original: JSON.parse(JSON.stringify(key)),
    };
    target.setPointerCapture?.(event.pointerId);
    return;
  }
  const character = characterById(target.dataset.character);
  if (kind === "track-visibility") {
    event.preventDefault();
    toggleCharacterVisibility(character.id);
    return;
  }
  if (kind === "track-select") {
    event.preventDefault();
    setSelection({ type: "character", characterId: character.id });
    return;
  }
  const index = Number(target.dataset.index);
  if (kind.startsWith("clip")) setSelection({ type: "clip", characterId: character.id, index });
  if (kind === "root-time") setSelection({ type: "root", characterId: character.id, index });
  const original = snapshotDragOriginal(kind, character, index);
  const clipRef = kind.startsWith("clip") ? sortedClips(character)[index] : null;
  app.drag = { mode: kind, characterId: character.id, index, keyId: original.id, clipRef, startPoint: point, original };
  target.setPointerCapture?.(event.pointerId);
}

function timelineTimeFromPoint(point) {
  return clamp((point.x - TIMELINE_LEFT) / app.pixelsPerSecond, 0, app.scene.duration);
}

function addPlayheadSnapTarget(targets, time, label, priority) {
  const value = clamp(Number(time), 0, app.scene.duration);
  if (!Number.isFinite(value)) return;
  const existing = targets.find((target) => Math.abs(target.time - value) < 0.001);
  if (existing) {
    if (priority > existing.priority) {
      existing.label = label;
      existing.priority = priority;
    }
    return;
  }
  targets.push({ time: value, label, priority });
}

function playheadSnapTargets() {
  const targets = [];
  addPlayheadSnapTarget(targets, 0, "Scene start", 3);
  addPlayheadSnapTarget(targets, app.scene.duration, "Scene end", 3);
  for (const character of app.scene.characters) {
    for (const clip of sortedClips(character)) {
      addPlayheadSnapTarget(targets, clip.start, "Clip start", 2);
      addPlayheadSnapTarget(targets, clip.start + clip.duration, "Clip end", 2);
    }
    for (const key of sortedKeys(character)) {
      addPlayheadSnapTarget(targets, key.time, "Waypoint", 1);
    }
  }
  if (sceneCamera().preset === "keyframed") {
    for (const key of cameraKeyframes()) {
      addPlayheadSnapTarget(targets, key.time, "Camera key", 1);
    }
  }
  return targets;
}

function shouldBypassTimelineSnap(event) {
  return Boolean(event?.altKey || event?.metaKey);
}

function snappedPlayheadTime(rawTime, event = null) {
  if (shouldBypassTimelineSnap(event)) {
    app.timelineSnap = null;
    return rawTime;
  }
  const threshold = TIMELINE_PLAYHEAD_SNAP_PX / Math.max(1, app.pixelsPerSecond);
  let closest = null;
  for (const target of playheadSnapTargets()) {
    const distance = Math.abs(target.time - rawTime);
    if (distance > threshold) continue;
    if (!closest || distance < closest.distance || (Math.abs(distance - closest.distance) < 0.001 && target.priority > closest.priority)) {
      closest = { ...target, distance };
    }
  }
  app.timelineSnap = closest;
  return closest ? closest.time : rawTime;
}

function motionClipStartAt(time) {
  const maxStart = Math.max(0, app.scene.duration - 0.1);
  return clamp(snapTime(clamp(time, 0, maxStart)), 0, maxStart);
}

function motionClipDurationAt(motion, start) {
  const requested = Math.max(0.1, Number(motion?.duration) || 3);
  return Math.min(requested, Math.max(0.1, app.scene.duration - start));
}

function timelineDropTargetFromEvent(event) {
  const svg = $("#timelineSvg");
  if (!svg || !app.scene?.characters?.length) return null;
  const scrollerRect = timelineScroller().getBoundingClientRect();
  if (event.clientX < scrollerRect.left || event.clientX > scrollerRect.right || event.clientY < scrollerRect.top || event.clientY > scrollerRect.bottom) return null;
  const rect = svg.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
  const point = svgPoint(svg, event);
  const index = Math.floor((point.y - TIMELINE_RULER_HEIGHT) / TIMELINE_CHARACTER_HEIGHT);
  if (index < 0 || index >= app.scene.characters.length) return null;
  const rowTop = TIMELINE_RULER_HEIGHT + index * TIMELINE_CHARACTER_HEIGHT;
  if (point.y < rowTop || point.y > rowTop + TIMELINE_CHARACTER_HEIGHT) return null;
  const character = app.scene.characters[index];
  return { characterId: character.id, index, time: motionClipStartAt(timelineTimeFromPoint(point)) };
}

function startTimelineScrub(point, pointerId, event) {
  app.currentTime = snappedPlayheadTime(timelineTimeFromPoint(point), event);
  app.playing = false;
  updateTransportIcon();
  app.drag = { mode: "timeline-scrub" };
  $("#timelineSvg").setPointerCapture?.(pointerId);
  renderAll();
  ensureTimelinePlayheadVisible();
}

function snapshotDragOriginal(kind, character, index) {
  if (kind.startsWith("clip")) return { ...sortedClips(character)[index] };
  return JSON.parse(JSON.stringify(sortedKeys(character)[index]));
}

function startMotionLibraryDrag(event, motionLabel, source) {
  if (event.button !== 0 || app.drag) return;
  app.drag = {
    mode: "motion-pending",
    motionLabel,
    source,
    startClientX: event.clientX,
    startClientY: event.clientY,
    clientX: event.clientX,
    clientY: event.clientY,
    dropTarget: null,
  };
  source.setPointerCapture?.(event.pointerId);
}

function activateMotionDrag(event) {
  app.drag.mode = "motion-drag";
  app.drag.source?.classList.add("drag-source");
  app.drag.ghost = createMotionDragGhost(app.drag.motionLabel);
  document.body.classList.add("dragging-motion");
  updateMotionDrag(event);
}

function createMotionDragGhost(motionLabel) {
  const ghost = document.createElement("div");
  ghost.className = "motion-drag-ghost";
  const name = document.createElement("div");
  name.className = "motion-drag-name";
  name.textContent = motionLabel;
  const hint = document.createElement("div");
  hint.className = "motion-drag-hint";
  hint.textContent = "Drop on a timeline row";
  ghost.append(name, hint);
  document.body.appendChild(ghost);
  return ghost;
}

function updateMotionDrag(event) {
  app.drag.clientX = event.clientX;
  app.drag.clientY = event.clientY;
  if (app.drag.ghost) {
    app.drag.ghost.style.left = `${event.clientX}px`;
    app.drag.ghost.style.top = `${event.clientY}px`;
  }
  autoScrollTimelineForMotionDrag(event);
  const nextTarget = timelineDropTargetFromEvent(event);
  const changed = !sameMotionDropTarget(app.drag.dropTarget, nextTarget);
  app.drag.dropTarget = nextTarget;
  updateMotionDragGhostHint(nextTarget);
  if (changed) renderTimeline();
}

function updateMotionDragGhostHint(dropTarget) {
  if (!app.drag.ghost) return;
  app.drag.ghost.classList.toggle("drop-ready", Boolean(dropTarget));
  const hint = app.drag.ghost.querySelector(".motion-drag-hint");
  if (!hint) return;
  if (!dropTarget) {
    hint.textContent = "Drop on a timeline row";
    return;
  }
  const character = characterById(dropTarget.characterId);
  hint.textContent = `${character.label} at ${dropTarget.time.toFixed(1)}s`;
}

function sameMotionDropTarget(a, b) {
  if (!a || !b) return a === b;
  return a.characterId === b.characterId && Math.abs(a.time - b.time) < 0.001;
}

function autoScrollTimelineForMotionDrag(event) {
  const scroller = timelineScroller();
  if (!scroller) return;
  const rect = scroller.getBoundingClientRect();
  if (event.clientY < rect.top || event.clientY > rect.bottom) return;
  const margin = 42;
  const speed = 22;
  let delta = 0;
  if (event.clientX < rect.left + margin) delta = -speed;
  else if (event.clientX > rect.right - margin) delta = speed;
  if (delta) scroller.scrollLeft += delta;
}

function cleanupMotionDrag(drag) {
  drag.source?.classList.remove("drag-source");
  drag.ghost?.remove();
  document.body.classList.remove("dragging-motion");
}

function finishMotionLibraryDrag(drag) {
  const wasDragging = drag.mode === "motion-drag";
  cleanupMotionDrag(drag);
  app.drag = null;
  if (!wasDragging) return false;
  app.suppressMotionClick = true;
  window.setTimeout(() => { app.suppressMotionClick = false; }, 100);
  if (drag.dropTarget) {
    const character = characterById(drag.dropTarget.characterId);
    insertClipOnCharacter(character, drag.motionLabel, drag.dropTarget.time);
  } else {
    renderTimeline();
  }
  return true;
}

function startPanelResize(event, kind) {
  event.preventDefault();
  const handle = event.currentTarget;
  app.drag = {
    mode: "panel-resize",
    kind,
    handle,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startWidth: app.panelWidths[kind],
    startHeight: app.panelHeights[kind],
  };
  handle.classList.add("active");
  document.body.classList.add(kind === "timeline" ? "resizing-rows" : "resizing-columns");
  handle.setPointerCapture?.(event.pointerId);
}

function handlePanelResizeKey(event, kind) {
  const horizontal = (kind === "library" || kind === "inspector") && (event.key === "ArrowLeft" || event.key === "ArrowRight");
  const vertical = (kind === "timeline" || kind === "preview") && (event.key === "ArrowUp" || event.key === "ArrowDown");
  if (!horizontal && !vertical) return;
  event.preventDefault();
  event.stopPropagation();
  const step = event.shiftKey ? 48 : 18;
  if (kind === "timeline" || kind === "preview") {
    const delta = kind === "timeline"
      ? (event.key === "ArrowUp" ? step : -step)
      : (event.key === "ArrowDown" ? step : -step);
    app.panelHeights[kind] = clampPanelHeight(kind, app.panelHeights[kind] + delta);
    applyPanelHeights();
    savePanelHeights();
  } else {
    const arrowDelta = event.key === "ArrowRight" ? step : -step;
    const direction = kind === "library" ? 1 : -1;
    app.panelWidths[kind] = clampPanelWidth(kind, app.panelWidths[kind] + arrowDelta * direction);
    applyPanelWidths();
    savePanelWidths();
  }
}

function pointerMove(event) {
  if (!app.drag) return;
  if (app.drag.mode === "motion-pending" || app.drag.mode === "motion-drag") dragMotionLibrary(event);
  else if (app.drag.mode === "panel-resize") dragPanelResize(event);
  else if (app.drag.mode.startsWith("stage")) dragStage(event);
  else dragTimeline(event);
}

function pointerUp() {
  const drag = app.drag;
  if (drag?.mode === "motion-pending" || drag?.mode === "motion-drag") {
    finishMotionLibraryDrag(drag);
    return;
  }
  if (drag?.mode === "panel-resize") {
    drag.handle?.classList.remove("active");
    document.body.classList.remove("resizing-columns", "resizing-rows");
    if (drag.kind === "timeline" || drag.kind === "preview") savePanelHeights();
    else savePanelWidths();
  }
  if (drag?.mode === "stage-pan") {
    $("#stageSvg").classList.remove("panning");
    if (!drag.moved) setSelection({ type: "scene" });
  }
  if (drag?.mode === "stage-key" && drag.cycleOnClick && !drag.changed) {
    cycleStageWaypointSelection(drag.cycleRefs || []);
  }
  if (drag?.mode === "timeline-scrub" && app.timelineSnap) {
    app.timelineSnap = null;
    renderTimeline();
  }
  app.drag = null;
}

function dragMotionLibrary(event) {
  if (app.drag.mode === "motion-pending") {
    const dx = event.clientX - app.drag.startClientX;
    const dy = event.clientY - app.drag.startClientY;
    if (Math.hypot(dx, dy) < 6) return;
    activateMotionDrag(event);
  }
  event.preventDefault();
  updateMotionDrag(event);
}

function dragPanelResize(event) {
  event.preventDefault();
  if (app.drag.kind === "timeline" || app.drag.kind === "preview") {
    const direction = app.drag.kind === "timeline" ? -1 : 1;
    const nextHeight = app.drag.startHeight + (event.clientY - app.drag.startClientY) * direction;
    app.panelHeights[app.drag.kind] = clampPanelHeight(app.drag.kind, nextHeight);
    applyPanelHeights();
    if (app.drag.kind === "timeline") renderStage();
    return;
  }
  const direction = app.drag.kind === "library" ? 1 : -1;
  const nextWidth = app.drag.startWidth + (event.clientX - app.drag.startClientX) * direction;
  app.panelWidths[app.drag.kind] = clampPanelWidth(app.drag.kind, nextWidth);
  applyPanelWidths();
  renderStage();
  renderTimeline();
}

function recordDragEdit() {
  if (!app.drag || app.drag.changed) return;
  pushUndoSnapshot();
  app.drag.changed = true;
}

function dragStage(event) {
  if (app.drag.mode === "stage-pan") {
    dragStagePan(event);
    return;
  }
  if (app.drag.mode === "stage-camera-key" || app.drag.mode === "stage-camera-target") {
    dragCameraKeyOnStage(event);
    return;
  }
  const character = characterById(app.drag.characterId);
  const key = character.root_keys.find((candidate) => candidate.id === app.drag.keyId) || sortedKeys(character)[app.drag.index];
  const point = svgPoint($("#stageSvg"), event);
  if (app.drag.mode === "stage-key") {
    recordDragEdit();
    key.position = stageToWorld(point, key.position?.[2] || 0);
  } else if (app.drag.mode === "stage-facing") {
    recordDragEdit();
    const origin = worldToStage(key.position);
    const dx = point.x - origin.x;
    const dy = origin.y - point.y;
    key.facing_degrees = (Math.atan2(dx, dy) * 180) / Math.PI;
  }
  renderAll();
}

function dragCameraKeyOnStage(event) {
  const camera = sceneCamera();
  const key = cameraKeyframes(camera).find((candidate) => candidate.id === app.drag.keyId) || camera.keyframes[app.drag.index];
  if (!key) return;
  const point = svgPoint($("#stageSvg"), event);
  recordDragEdit();
  if (app.drag.mode === "stage-camera-key") {
    key.position = stageToWorld(point, key.position?.[2] || 0);
  } else {
    key.look_at = stageToWorld(point, key.look_at?.[2] || 0);
  }
  app.selection.index = Math.max(0, cameraKeyframes(camera).findIndex((candidate) => candidate.id === key.id));
  renderAll();
}

function dragStagePan(event) {
  const dx = event.clientX - app.drag.startClientX;
  const dy = event.clientY - app.drag.startClientY;
  if (Math.hypot(dx, dy) > 3) app.drag.moved = true;
  const rect = app.drag.rect;
  const nextX = app.drag.startBox.x - dx * app.drag.startBox.width / Math.max(1, rect.width);
  const nextY = app.drag.startBox.y - dy * app.drag.startBox.height / Math.max(1, rect.height);
  setStageViewFromBox({
    x: nextX,
    y: nextY,
    width: app.drag.startBox.width,
    height: app.drag.startBox.height,
  }, app.drag.startZoom);
  renderStage();
}

function dragTimeline(event) {
  const point = svgPoint($("#timelineSvg"), event);
  if (app.drag.mode === "timeline-scrub") {
    app.currentTime = snappedPlayheadTime(timelineTimeFromPoint(point), event);
    app.playing = false;
    updateTransportIcon();
    renderAll();
    ensureTimelinePlayheadVisible();
    return;
  }
  const dx = (point.x - app.drag.startPoint.x) / app.pixelsPerSecond;
  if (app.drag.mode === "camera-time") {
    recordDragEdit();
    const camera = sceneCamera();
    const key = camera.keyframes.find((candidate) => candidate.id === app.drag.keyId) || cameraKeyframes(camera)[app.drag.index];
    if (!key) return;
    key.time = clamp(snapTime(app.drag.original.time + dx), 0, app.scene.duration);
    app.selection.index = Math.max(0, cameraKeyframes(camera).findIndex((candidate) => candidate.id === key.id));
    renderAll();
    return;
  }
  const character = characterById(app.drag.characterId);
  if (app.drag.mode.startsWith("clip")) {
    recordDragEdit();
    const clip = app.drag.clipRef || sortedClips(character)[app.drag.index];
    if (app.drag.mode === "clip-move") {
      clip.start = clamp(snapTime(app.drag.original.start + dx), 0, app.scene.duration);
    } else if (app.drag.mode === "clip-left") {
      const end = app.drag.original.start + app.drag.original.duration;
      clip.start = clamp(snapTime(app.drag.original.start + dx), 0, end - 0.1);
      clip.duration = Math.max(0.1, end - clip.start);
    } else if (app.drag.mode === "clip-right") {
      clip.duration = Math.max(0.1, snapTime(app.drag.original.duration + dx));
    }
    app.selection.index = Math.max(0, sortedClips(character).indexOf(clip));
  } else if (app.drag.mode === "root-time") {
    recordDragEdit();
    const key = character.root_keys.find((candidate) => candidate.id === app.drag.keyId) || sortedKeys(character)[app.drag.index];
    key.time = clamp(snapTime(app.drag.original.time + dx), 0, app.scene.duration);
    app.selection.index = Math.max(0, sortedKeys(character).findIndex((candidate) => candidate.id === key.id));
  }
  renderAll();
}

function svgPoint(svg, event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const ctm = svg.getScreenCTM();
  return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
}

function nextCharacterIdentity() {
  let index = app.scene.characters.length + 1;
  let id = `character_${index}`;
  while (app.scene.characters.some((character) => character.id === id)) {
    index += 1;
    id = `character_${index}`;
  }
  return { id, index };
}

function uniqueCharacterLabel(baseLabel) {
  const labels = new Set(app.scene.characters.map((character) => character.label));
  let label = `${baseLabel} Copy`;
  let index = 2;
  while (labels.has(label)) {
    label = `${baseLabel} Copy ${index}`;
    index += 1;
  }
  return label;
}

function addCharacter() {
  const { id, index } = nextCharacterIdentity();
  pushUndoSnapshot();
  app.scene.characters.push({
    id,
    label: `Avatar ${index}`,
    color: randomAvatarColor(),
    tint_avatar_colors: true,
    hidden_after: null,
    proxy_asset: defaultProxyAsset(),
    avatar_asset: "",
    track: [],
    root_keys: [
      { id: "k0", time: 0, position: [0, 0, 0], facing_degrees: 0 },
      { id: "k1", time: app.scene.duration, position: [0, 0, 0], facing_degrees: 0 },
    ],
    root_segments: [],
  });
  setSelection({ type: "character", characterId: id });
}

function removeCharacter(id) {
  if (app.scene.characters.length <= 1) return;
  pushUndoSnapshot();
  app.scene.characters = app.scene.characters.filter((character) => character.id !== id);
  app.hiddenCharacterIds.delete(id);
  app.selectedCharacterId = app.scene.characters[0].id;
  setSelection({ type: "character", characterId: app.selectedCharacterId });
}

function appendClipToSelectedCharacter(label) {
  const character = selectedCharacter();
  const lastEnd = sortedClips(character).reduce((value, clip) => Math.max(value, clip.start + clip.duration), 0);
  insertClipOnCharacter(character, label, lastEnd);
}

function insertClipOnCharacter(character, label, startTime) {
  const motion = motionByLabel(label);
  const start = motionClipStartAt(startTime);
  pushUndoSnapshot();
  const newClip = {
    clip: label,
    start,
    duration: motionClipDurationAt(motion, start),
    trim_start: 0,
    trim_end: null,
    root_mode: defaultRootModeForMotion(motion),
    hand_pose: "natural",
    shoulder_mask: "normal",
    blend_in: DEFAULT_CLIP_BLEND_SECONDS,
    blend_out: DEFAULT_CLIP_BLEND_SECONDS,
  };
  character.track.push(newClip);
  selectClipByRef(character, newClip);
}

function duplicateClip(character, clip) {
  pushUndoSnapshot();
  const newClip = { ...clip, start: clamp(clip.start + clip.duration, 0, app.scene.duration) };
  character.track.push(newClip);
  selectClipByRef(character, newClip);
}

function deleteClip(character, clip) {
  pushUndoSnapshot();
  character.track = character.track.filter((candidate) => candidate !== clip);
  setSelection({ type: "character", characterId: character.id });
}

function duplicateCharacter(character) {
  const { id } = nextCharacterIdentity();
  pushUndoSnapshot();
  const clone = JSON.parse(JSON.stringify(character));
  clone.id = id;
  clone.label = uniqueCharacterLabel(character.label);
  clone.root_keys = clone.root_keys.map((key) => ({
    ...key,
    position: [key.position[0] + 0.35, key.position[1] - 0.25, Number(key.position?.[2] || 0)],
  }));
  app.scene.characters.push(clone);
  setSelection({ type: "character", characterId: clone.id });
}

function addWaypointAtPlayhead() {
  const character = selectedCharacter();
  const root = rootAt(character, app.currentTime);
  const id = nextKeyId(character);
  pushUndoSnapshot();
  character.root_keys.push({
    id,
    time: app.currentTime,
    position: [
      root.position?.[0] || 0,
      root.position?.[1] || 0,
      root.position?.[2] || 0,
    ],
    facing_degrees: root.facing_degrees,
  });
  sortedKeys(character);
  const index = character.root_keys.findIndex((key) => key.id === id);
  setSelection({ type: "root", characterId: character.id, index: Math.max(0, index) });
}

function addCameraKeyAtPlayhead() {
  const camera = sceneCamera();
  if (camera.preset !== "keyframed") return;
  const pose = cameraPoseAt(app.currentTime);
  const id = nextCameraKeyId(camera);
  pushUndoSnapshot();
  camera.keyframes.push({
    id,
    time: app.currentTime,
    position: [...pose.position],
    look_at: [...pose.lookAt],
    fov_degrees: pose.fovDegrees || 45,
  });
  selectCameraKeyById(id);
}

function faceSelectedWaypointAlongPath() {
  if (app.selection.type !== "root") return;
  const character = characterById(app.selection.characterId);
  const keys = sortedKeys(character);
  const key = keys[app.selection.index];
  const neighbor = keys[app.selection.index + 1] || keys[app.selection.index - 1];
  if (!key || !neighbor) return;
  const dx = neighbor.position[0] - key.position[0];
  const dy = neighbor.position[1] - key.position[1];
  if (Math.hypot(dx, dy) < 0.001) return;
  pushUndoSnapshot();
  key.facing_degrees = (Math.atan2(dx, dy) * 180) / Math.PI;
  renderAll();
}

function deleteRootKey(character, key) {
  if (character.root_keys.length <= 1) return;
  pushUndoSnapshot();
  character.root_keys = character.root_keys.filter((candidate) => candidate !== key);
  setSelection({ type: "character", characterId: character.id });
}

function duplicateRootKey(character, key) {
  pushUndoSnapshot();
  const clone = JSON.parse(JSON.stringify(key));
  clone.id = nextKeyId(character);
  const timeOffset = key.time >= app.scene.duration - 0.2 ? -0.2 : 0.2;
  clone.time = clamp(snapTime(key.time + timeOffset), 0, app.scene.duration);
  clone.position = [key.position[0] + 0.15, key.position[1] + 0.15, Number(key.position?.[2] || 0)];
  character.root_keys.push(clone);
  selectRootById(character, clone.id);
}

function duplicateCameraKey(key) {
  const camera = sceneCamera();
  pushUndoSnapshot();
  const clone = JSON.parse(JSON.stringify(key));
  clone.id = nextCameraKeyId(camera);
  const timeOffset = key.time >= app.scene.duration - 0.2 ? -0.2 : 0.2;
  clone.time = clamp(snapTime(key.time + timeOffset), 0, app.scene.duration);
  clone.position = [key.position[0] + 0.15, key.position[1] + 0.15, Number(key.position?.[2] || 0)];
  clone.look_at = [key.look_at[0] + 0.15, key.look_at[1] + 0.15, Number(key.look_at?.[2] || 0)];
  clone.fov_degrees = clamp(Number(key.fov_degrees) || 45, 10, 120);
  camera.keyframes.push(clone);
  selectCameraKeyById(clone.id);
}

function deleteCameraKey(key) {
  const camera = sceneCamera();
  if (cameraKeyframes(camera).length <= 1) return;
  pushUndoSnapshot();
  camera.keyframes = camera.keyframes.filter((candidate) => candidate !== key);
  setSelection({ type: "scene" });
}

function selectedDeleteAction() {
  const clipRef = selectedClipRef();
  if (clipRef) {
    const label = clipRef.clip.clip.replace(/^Preset: /, "").replace(/^Custom: /, "");
    return { enabled: true, label: `Delete motion clip: ${label}` };
  }

  const rootRef = selectedRootRef();
  if (rootRef) {
    return rootRef.character.root_keys.length > 1
      ? { enabled: true, label: "Delete waypoint" }
      : { enabled: false, label: "Keep at least one waypoint" };
  }

  const cameraKeyRef = selectedCameraKeyRef();
  if (cameraKeyRef) {
    return cameraKeyframes(cameraKeyRef.camera).length > 1
      ? { enabled: true, label: "Delete camera key" }
      : { enabled: false, label: "Keep at least one camera key" };
  }

  if (app.selection.type === "character" && app.selection.characterId) {
    const character = characterById(app.selection.characterId);
    const canDelete = Boolean(character && app.scene.characters.length > 1);
    return {
      enabled: canDelete,
      label: canDelete ? `Delete avatar: ${character.label}` : "Keep at least one avatar",
    };
  }

  return { enabled: false, label: "Select an avatar, motion clip, waypoint, or camera key to delete" };
}

function deleteSelection() {
  const clipRef = selectedClipRef();
  if (clipRef) {
    deleteClip(clipRef.character, clipRef.clip);
    return true;
  }

  const rootRef = selectedRootRef();
  if (rootRef) {
    deleteRootKey(rootRef.character, rootRef.key);
    return true;
  }

  const cameraKeyRef = selectedCameraKeyRef();
  if (cameraKeyRef) {
    deleteCameraKey(cameraKeyRef.key);
    return true;
  }

  if (app.selection.type === "character" && app.selection.characterId && app.scene.characters.length > 1) {
    removeCharacter(app.selection.characterId);
    return true;
  }
  return false;
}

function duplicateSelection() {
  const clipRef = selectedClipRef();
  if (clipRef) {
    duplicateClip(clipRef.character, clipRef.clip);
    return true;
  }

  const rootRef = selectedRootRef();
  if (rootRef) {
    duplicateRootKey(rootRef.character, rootRef.key);
    return true;
  }

  const cameraKeyRef = selectedCameraKeyRef();
  if (cameraKeyRef) {
    duplicateCameraKey(cameraKeyRef.key);
    return true;
  }

  if (app.selection.type === "character" && app.selection.characterId) {
    duplicateCharacter(characterById(app.selection.characterId));
    return true;
  }
  return false;
}

function nudgeSelectedClip(delta) {
  const clipRef = selectedClipRef();
  if (!clipRef) return false;
  pushUndoSnapshot();
  clipRef.clip.start = clamp(snapTime(clipRef.clip.start + delta), 0, app.scene.duration);
  selectClipByRef(clipRef.character, clipRef.clip);
  return true;
}

function nudgeSelectedRootTime(delta) {
  const rootRef = selectedRootRef();
  if (!rootRef) return false;
  pushUndoSnapshot();
  rootRef.key.time = clamp(snapTime(rootRef.key.time + delta), 0, app.scene.duration);
  selectRootById(rootRef.character, rootRef.key.id);
  return true;
}

function nudgeSelectedRootPosition(dx, dy) {
  const rootRef = selectedRootRef();
  if (!rootRef) return false;
  pushUndoSnapshot();
  rootRef.key.position[0] = Number((rootRef.key.position[0] + dx).toFixed(3));
  rootRef.key.position[1] = Number((rootRef.key.position[1] + dy).toFixed(3));
  renderAll();
  return true;
}

async function saveScene() {
  const name = $("#sceneNameInput").value || DEFAULT_SCENE_NAME;
  const response = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, scene: app.scene }),
  });
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  app.scene = data.scene;
  pruneHiddenCharacters();
  app.scenes = data.scenes;
  app.warnings = data.warnings || [];
  app.avatarAssets = data.avatar_assets || app.avatarAssets;
  renderAll();
  return data;
}

async function exportVideo(mode = "blocky_draft") {
  if (mode === "avatar_final") {
    const missingAvatars = missingFinalAvatarLabels();
    if (missingAvatars.length) {
      app.exportStatus = `Assign final avatars for ${missingAvatars.join(", ")} before final render.`;
      renderExportPanel();
      return;
    }
  }
  const name = $("#sceneNameInput").value || DEFAULT_SCENE_NAME;
  app.exportInProgress = true;
  app.exportMode = mode;
  app.exportStatus = mode === "avatar_final" ? "Rendering final avatars..." : "Rendering blocky draft...";
  app.exportWarning = mode === "avatar_final" ? finalAvatarExportSettings(sceneExport()).warning : "";
  app.exportVideoUrl = "";
  app.exportVideoPath = "";
  renderExportPanel();
  try {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scene: app.scene, export: sceneExport(), mode }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    applyExportResponse(data);
    if (data.job_id) {
      renderAll();
      await pollExportJob(data.job_id);
    }
  } catch (error) {
    app.exportStatus = `Export failed: ${error.message || error}`;
  } finally {
    app.exportInProgress = false;
    app.exportMode = "";
    renderAll();
  }
}

function applyExportResponse(data) {
  if (data.scene) {
    app.scene = data.scene;
    pruneHiddenCharacters();
  }
  if (data.scenes) app.scenes = data.scenes;
  app.warnings = data.warnings || [];
  app.avatarAssets = data.avatar_assets || app.avatarAssets;
  app.exportWarning = data.export?.warning || "";
  app.exportStatus = data.message || "Rendered video.";
  app.exportVideoUrl = data.video_url || "";
  app.exportVideoPath = data.video_path || "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollExportJob(jobId) {
  while (true) {
    await wait(1000);
    const response = await fetch(`/api/export/status?id=${encodeURIComponent(jobId)}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    if (data.status === "error") throw new Error(data.error || data.message || "Final render failed.");
    applyExportResponse(data);
    renderExportPanel();
    if (data.status === "done") return;
  }
}

async function loadSelectedScene() {
  const name = $("#sceneSelect").value;
  if (!name) return;
  const response = await fetch(`/api/load?name=${encodeURIComponent(name)}`);
  const data = await response.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  app.scene = data.scene;
  pruneHiddenCharacters();
  app.warnings = data.warnings || [];
  app.avatarAssets = data.avatar_assets || app.avatarAssets;
  app.selectedCharacterId = app.scene.characters[0]?.id || null;
  app.selection = { type: "scene" };
  app.currentTime = 0;
  app.history = { undo: [], redo: [] };
  renderAll();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

loadBootstrap().catch((error) => {
  document.body.innerHTML = `<pre>${escapeHtml(error.stack || error)}</pre>`;
});
