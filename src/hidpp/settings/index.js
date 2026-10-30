// All device settings, in the order they are read from the device and shown in the UI.
import pointer from './pointer.js';
import scrolling from './scrolling.js';
import keyboard from './keyboard.js';
import lighting from './lighting.js';
import buttons from './buttons.js';
import connection from './connection.js';

export const SETTINGS = [...pointer, ...scrolling, ...keyboard, ...lighting, ...buttons, ...connection];
export const settingLabel = k => SETTINGS.find(s => s.key === k)?.label || k;
