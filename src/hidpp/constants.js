// Protocol constants: receiver IDs, error codes, device kinds, feature and control names.
import { hx } from '../core/util.js';

export const VID = 0x046d, SW = 0x0b;
export const RECEIVERS = {
  0xc52b:'Unifying', 0xc532:'Unifying',
  0xc548:'Bolt',
  0xc539:'Lightspeed', 0xc53a:'Lightspeed', 0xc53d:'Lightspeed', 0xc53f:'Lightspeed', 0xc541:'Lightspeed', 0xc545:'Lightspeed', 0xc547:'Lightspeed', 0xc54d:'Lightspeed',
  0xc52f:'Nano', 0xc531:'Nano', 0xc534:'Nano', 0xc535:'Nano', 0xc537:'Nano', 0xc542:'Nano',
  0xc517:'27 MHz', 0xc51a:'Nano', 0xc51b:'Nano', 0xc521:'Nano', 0xc525:'Nano', 0xc526:'Nano'
};
export const ERR10 = {1:'invalid sub-ID',2:'invalid address',3:'invalid value',4:'connection failed',5:'too many devices',6:'already exists',7:'busy',8:'unknown device',9:'device not reachable',10:'request unavailable',11:'invalid parameter',12:'wrong PIN code'};
export const ERR20 = {1:'unknown error',2:'invalid argument',3:'out of range',4:'hardware error',5:'internal error',6:'invalid feature index',7:'invalid function',8:'busy',9:'unsupported'};
export const PAIR_ERR = {1:'Pairing timed out — no device was detected.',2:'This device type is not supported by the receiver.',3:'The receiver already holds the maximum number of devices. Unpair one first.',6:'Pairing sequence timed out.'};
export const BOLT_ERR = {1:'The device timed out.',2:'Pairing failed.'};
export const KIND10 = {1:'keyboard',2:'mouse',3:'numpad',4:'presenter',7:'remote',8:'trackball',9:'touchpad'};
export const KIND20 = {0:'keyboard',1:'remote',2:'numpad',3:'mouse',4:'touchpad',5:'trackball',6:'presenter',7:'receiver',8:'headset',9:'webcam',10:'steering wheel',11:'joystick',12:'gamepad',13:'dock',14:'speaker',15:'microphone',16:'light',17:'controller',18:'pedals',19:'adapter'};
export const FEATURES = {
  0x0000:'Root',0x0001:'Feature set',0x0002:'Feature info',0x0003:'Device firmware info',0x0004:'Device unit ID',0x0005:'Device name & type',0x0006:'Device groups',0x0007:'Device friendly name',0x0008:'Keep alive',0x0020:'Config change',0x0021:'Unique random ID',0x0030:'Target software',0x0080:'Wireless signal strength',
  0x00c0:'DFU control (legacy)',0x00c1:'DFU control (unsigned)',0x00c2:'DFU control (signed)',0x00c3:'DFU control',0x00d0:'DFU',
  0x1000:'Battery status',0x1001:'Battery voltage',0x1004:'Unified battery',0x1010:'Charging control',0x1300:'LED control',0x1802:'Device reset',0x1805:'OOB state',0x1806:'Configurable device properties',0x1814:'Change host (Easy-Switch)',0x1815:'Hosts info',
  0x1981:'Backlight',0x1982:'Backlight 2',0x1983:'Backlight 3',0x1990:'Illumination',0x1a00:'Presenter control',0x1a01:'Sensor 3D',0x1b00:'Reprogrammable keys',0x1b01:'Reprogrammable keys v2',0x1b02:'Reprogrammable keys v3',0x1b03:'Reprogrammable keys v3',0x1b04:'Reprogrammable keys v4',0x1bc0:'Report HID usage',0x1c00:'Persistent remappable action',0x1d4b:'Wireless device status',0x1df0:'Remaining pairings',0x1e00:'Enable hidden features',0x1e22:'SPI direct access',0x1f1f:'Firmware properties',0x1f20:'ADC measurement',
  0x2001:'Left/right swap',0x2005:'Swap button cancel',0x2006:'Pointer axis orientation',0x2100:'Vertical scrolling',0x2110:'SmartShift',0x2111:'SmartShift enhanced',0x2120:'Hi-res scrolling',0x2121:'Hi-res wheel',0x2130:'Low-res wheel',0x2150:'Thumbwheel',0x2200:'Mouse pointer',0x2201:'Adjustable DPI',0x2202:'Extended adjustable DPI',0x2205:'Pointer speed',0x2230:'Angle snapping',0x2240:'Surface tuning',0x2250:'XY stats',0x2251:'Wheel stats',0x2400:'Hybrid tracking',
  0x40a0:'Fn inversion',0x40a2:'Fn inversion (new)',0x40a3:'Fn inversion (K375s)',0x4100:'Encryption',0x4220:'Lock key state',0x4301:'Solar dashboard',0x4520:'Keyboard layout',0x4521:'Disable keys',0x4522:'Disable keys by usage',0x4530:'Dual platform',0x4531:'Multi-platform',0x4540:'Keyboard international layouts',0x4600:'Crown',
  0x6010:'Touchpad FW items',0x6011:'Touchpad SW items',0x6012:'Touchpad Win8 FW items',0x6020:'Tap enable',0x6021:'Tap enable extended',0x6030:'Cursor ballistic',0x6040:'Touchpad resolution',0x6100:'Touchpad raw XY',0x6110:'Touchmouse raw points',0x6120:'Touchmouse 6120',0x6500:'Gestures',0x6501:'Gestures 2',
  0x8010:'G-keys',0x8020:'M-keys',0x8030:'MR key',0x8040:'Brightness control',0x8060:'Report rate',0x8061:'Extended report rate',0x8070:'Color LED effects',0x8071:'RGB effects',0x8080:'Per-key lighting',0x8081:'Per-key lighting v2',0x8090:'Mode status',0x8100:'Onboard profiles',0x8110:'Mouse button spy',0x8111:'Latency monitoring',0x8120:'Gaming attachments',0x8123:'Force feedback',0x8300:'Sidetone',0x8310:'Equalizer',0x8320:'Headset out'
};
export const CID = {
  0x0001:'Volume Up',0x0002:'Volume Down',0x0003:'Mute',0x0004:'Play/Pause',0x0005:'Next Track',0x0006:'Previous Track',0x0007:'Stop',0x0008:'App Switcher',0x000a:'Calculator',0x000b:'Calendar',0x000c:'Close',0x000d:'Eject',0x000e:'Mail',
  0x0050:'Left Click',0x0051:'Right Click',0x0052:'Middle Click',0x0053:'Back',0x0056:'Forward',0x005b:'Scroll Left',0x005d:'Scroll Right',0x00c3:'Gesture Button',0x00c4:'SmartShift',0x00d7:'Virtual Gesture Button',0x00fd:'DPI Switch'
};
export const cidName = c => CID[c] || `Control 0x${hx(c,4)}`;
