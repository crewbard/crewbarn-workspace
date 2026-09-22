import type { ComponentType } from 'react'
import {
  IconSparkles, IconUserPlus, IconFlame, IconPhone, IconPhoneOff, IconMail, IconMessage,
  IconClipboardText, IconFileDollar,
  IconCalendarEvent, IconCalendarCheck, IconCalendarTime, IconBell, IconHourglass, IconClock,
  IconUserCheck, IconTruckDelivery, IconMapPin, IconLogin, IconTool, IconHammer, IconCamera,
  IconSearch, IconPlayerPause, IconPackage, IconShoppingCart, IconAlertTriangle, IconBan, IconShieldX,
  IconCircleCheck, IconChecks, IconListCheck, IconWritingSign, IconThumbUp, IconTrophy,
  IconFileInvoice, IconSend, IconReceipt, IconCreditCard, IconCash, IconCoin, IconAlarm, IconArrowBackUp,
  IconCircleX, IconThumbDown, IconFlag, IconBolt, IconStar, IconShieldCheck, IconRefresh, IconRepeat,
  IconHome, IconBuilding, IconKey, IconCar, IconFileText, IconPin,
  IconLock, IconLockOpen, IconDoor, IconDoorEnter, IconFingerprint, IconShieldLock,
  IconHierarchy, IconSitemap, IconCopy, IconId, IconKeyboard, IconScan,
  IconSnowflake, IconDroplet, IconPlug, IconBulb, IconTools,
  IconBuildingBank, IconRoute, IconWind, IconAdjustments,
  IconShield, IconQrcode, IconBarcode, IconBuildingWarehouse, IconBuildingStore,
  IconGauge, IconBattery, IconAntenna, IconBrush, IconPalette, IconPlant, IconTree,
  IconLeaf, IconBug, IconTrash, IconBriefcase, IconBox, IconMap2, IconNavigation,
  IconCompass, IconNotes, IconPower, IconTemperature, IconLink,
  IconShieldHalf, IconKeyOff, IconUserShield, IconBellRinging, IconDeviceCctv,
  IconDoorExit, IconWindow, IconStairs, IconElevator, IconBuildingCommunity, IconBuildingCottage,
  IconAirConditioning, IconTemperatureSnow, IconTemperatureSun,
  IconDroplets, IconRipple, IconBucket, IconWash,
  IconBatteryCharging, IconPlugConnected, IconBoltOff,
  IconPaint, IconSpray, IconColorSwatch, IconPlant2, IconTrees, IconSeeding, IconFlower, IconShovel, IconBubble,
  IconForklift, IconGps, IconStopwatch, IconHeadset,
} from '@tabler/icons-react'

type TablerIcon = ComponentType<{ size?: number | string; stroke?: number; className?: string }>

/**
 * Curated field-service icon set for job statuses. Keys are the values stored
 * on JobStatus.icon (a short name like "truck-delivery"); the map renders a
 * clean Tabler line icon. Anything not in the map (e.g. a legacy emoji) falls
 * back to rendering the raw string, so existing statuses keep working until
 * they're re-picked.
 */
const ICONS: Record<string, TablerIcon> = {
  // Intake and sales
  'sparkles': IconSparkles, 'user-plus': IconUserPlus, 'flame': IconFlame,
  'phone': IconPhone, 'phone-off': IconPhoneOff, 'mail': IconMail, 'message': IconMessage,
  'clipboard-text': IconClipboardText, 'file-dollar': IconFileDollar,
  // Scheduling
  'calendar-event': IconCalendarEvent, 'calendar-check': IconCalendarCheck, 'calendar-time': IconCalendarTime,
  'bell': IconBell, 'hourglass': IconHourglass, 'clock': IconClock,
  // Dispatch and field
  'user-check': IconUserCheck, 'truck-delivery': IconTruckDelivery, 'map-pin': IconMapPin,
  'login': IconLogin, 'tool': IconTool, 'hammer': IconHammer, 'camera': IconCamera, 'search': IconSearch,
  'player-pause': IconPlayerPause, 'package': IconPackage, 'shopping-cart': IconShoppingCart,
  'alert-triangle': IconAlertTriangle, 'ban': IconBan, 'shield-x': IconShieldX,
  // Completion and sign-off
  'circle-check': IconCircleCheck, 'checks': IconChecks, 'list-check': IconListCheck,
  'writing-sign': IconWritingSign, 'thumb-up': IconThumbUp, 'trophy': IconTrophy,
  // Billing
  'file-invoice': IconFileInvoice, 'send': IconSend, 'receipt': IconReceipt,
  'credit-card': IconCreditCard, 'cash': IconCash, 'coin': IconCoin, 'alarm': IconAlarm, 'arrow-back-up': IconArrowBackUp,
  // Outcomes, flags and types
  'circle-x': IconCircleX, 'thumb-down': IconThumbDown, 'flag': IconFlag, 'bolt': IconBolt, 'star': IconStar,
  'shield-check': IconShieldCheck, 'refresh': IconRefresh, 'repeat': IconRepeat,
  'home': IconHome, 'building': IconBuilding, 'key': IconKey, 'car': IconCar, 'file-text': IconFileText, 'pin': IconPin,
  // Trades — locksmith, plus general field-service tools (shared with job types)
  'lock': IconLock, 'lock-open': IconLockOpen, 'door': IconDoor, 'door-enter': IconDoorEnter,
  'fingerprint': IconFingerprint, 'shield-lock': IconShieldLock, 'hierarchy': IconHierarchy, 'sitemap': IconSitemap,
  'copy': IconCopy, 'id': IconId, 'keyboard': IconKeyboard, 'scan': IconScan,
  'snowflake': IconSnowflake, 'droplet': IconDroplet, 'plug': IconPlug, 'bulb': IconBulb,
  'tools': IconTools, 'building-bank': IconBuildingBank,
  'route': IconRoute, 'wind': IconWind, 'adjustments': IconAdjustments,
  // More trades + generic (second gallery)
  'shield': IconShield, 'qrcode': IconQrcode, 'barcode': IconBarcode,
  'building-warehouse': IconBuildingWarehouse, 'building-store': IconBuildingStore,
  'gauge': IconGauge, 'battery': IconBattery, 'antenna': IconAntenna,
  'brush': IconBrush, 'palette': IconPalette, 'plant': IconPlant, 'tree': IconTree, 'leaf': IconLeaf,
  'bug': IconBug, 'trash': IconTrash, 'briefcase': IconBriefcase, 'box': IconBox,
  'map-2': IconMap2, 'navigation': IconNavigation, 'compass': IconCompass, 'notes': IconNotes,
  'power': IconPower, 'temperature': IconTemperature, 'link': IconLink,
  // Second gallery — the rest
  'shield-half': IconShieldHalf, 'key-off': IconKeyOff, 'user-shield': IconUserShield,
  'bell-ringing': IconBellRinging, 'device-cctv': IconDeviceCctv,
  'door-exit': IconDoorExit, 'window': IconWindow, 'stairs': IconStairs, 'elevator': IconElevator,
  'building-community': IconBuildingCommunity, 'building-cottage': IconBuildingCottage,
  'air-conditioning': IconAirConditioning, 'temperature-snow': IconTemperatureSnow, 'temperature-sun': IconTemperatureSun,
  'droplets': IconDroplets, 'ripple': IconRipple, 'bucket': IconBucket, 'wash': IconWash,
  'battery-charging': IconBatteryCharging, 'plug-connected': IconPlugConnected, 'bolt-off': IconBoltOff,
  'paint': IconPaint, 'spray': IconSpray, 'color-swatch': IconColorSwatch, 'plant-2': IconPlant2,
  'trees': IconTrees, 'seeding': IconSeeding, 'flower': IconFlower, 'shovel': IconShovel, 'bubble': IconBubble,
  'forklift': IconForklift, 'gps': IconGps, 'stopwatch': IconStopwatch, 'headset': IconHeadset,
}

/** Ordered list of the curated icon names for the status editor's picker. */
export const STATUS_ICON_NAMES: string[] = Object.keys(ICONS)

/**
 * Curated icon set for the JOB TYPE picker — trade-forward (locksmith first),
 * then general field-service, then generic. Reuses the same ICONS map, so
 * StatusIcon renders these too.
 */
export const TRADE_ICON_NAMES: string[] = [
  'lock-open', 'key', 'lock', 'shield-lock', 'fingerprint', 'scan', 'keyboard', 'id',
  'car', 'door', 'door-enter', 'home', 'building', 'building-bank',
  'hierarchy', 'sitemap', 'copy',
  'tool', 'tools', 'hammer', 'bolt', 'plug', 'bulb', 'flame', 'snowflake', 'droplet', 'wind', 'adjustments',
  'camera', 'map-pin', 'route', 'map-2', 'navigation', 'compass', 'truck-delivery',
  'calendar-event', 'clock', 'list-check', 'clipboard-text', 'notes', 'briefcase', 'box',
  'shield', 'shield-half', 'user-shield', 'key-off', 'bell-ringing', 'device-cctv',
  'qrcode', 'barcode', 'door-exit', 'window', 'stairs', 'elevator',
  'building-warehouse', 'building-store', 'building-community', 'building-cottage',
  'air-conditioning', 'gauge', 'temperature', 'temperature-snow', 'temperature-sun',
  'droplets', 'ripple', 'bucket', 'wash',
  'battery', 'battery-charging', 'antenna', 'power', 'plug-connected', 'bolt-off',
  'brush', 'paint', 'spray', 'palette', 'color-swatch',
  'plant', 'plant-2', 'tree', 'trees', 'leaf', 'seeding', 'flower', 'shovel',
  'bubble', 'bug', 'trash', 'forklift', 'gps', 'stopwatch', 'headset',
  'file-invoice', 'receipt', 'star', 'flag', 'alert-triangle',
]

/** True when a stored icon value is one of our Tabler names (vs a legacy emoji). */
export function isStatusIconName(value: string | null | undefined): boolean {
  return !!value && value in ICONS
}

/**
 * Render a status icon. A Tabler name → the line icon; a legacy emoji (or any
 * unmapped string) → the raw glyph; empty → nothing.
 */
export function StatusIcon({
  name,
  size = 20,
  className,
}: {
  name: string | null | undefined
  size?: number
  className?: string
}) {
  if (!name) return null
  const Cmp = ICONS[name]
  if (Cmp) return <Cmp size={size} stroke={2} className={className} />
  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1 }} aria-hidden>
      {name}
    </span>
  )
}
