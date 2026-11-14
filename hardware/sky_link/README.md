# Sky link: a physical sky for the rover

An LED ring on your desk that shows, live, where the Sun and Earth are for the rover you are driving in the
LunaNav web app (Rover or Lander view). LED 0 is the rover's nose; the yellow LED is the Sun (brighter = more of the
solar disk above the real terrain horizon), the blue LED is Earth (bright = radio link possible, dim = behind
terrain). Inside a permanently shadowed region the whole ring glows faint blue; below 20 % battery the nose LED
blinks red.

## Parts

- Any ESP32 board (ESP32-C3, classic ESP32 devkit, ESP32-S3) or an Arduino with USB serial
- A WS2812B ("NeoPixel") ring: 12, 16 or 24 LEDs
- 330 Ω resistor, 470–1000 µF capacitor, three jumper wires, a USB data cable
- Optional: `hardware/horizon_compass` board (24 LEDs around an ESP32-C3) and its printed stand

## Wiring

| Ring | Board |
|---|---|
| DIN | 330 Ω → `LED_PIN` (GPIO10 on the horizon-compass board, GPIO5 on a classic ESP32 devkit) |
| 5V  | 5V (USB) |
| GND | GND |

Capacitor across 5V and GND near the ring.

## Flash

1. Arduino IDE → install the ESP32 board package and the *Adafruit NeoPixel* library.
2. Open `sky_link.ino`, set `LED_PIN` and `RING_LEDS` at the top, upload.
3. The ring breathes dim white while it waits for data.

## Use

Open the web app in Chrome or Edge (Web Serial), open a site in **Stand on the lander** or **Drive a rover here**,
press **🔌 Sky compass** and pick the board's port. Drive around: the Sun and Earth LEDs move as the rover turns,
dim when they slip behind a ridge, and the ring turns blue when you enter permanent shadow.

Protocol (115200 baud, one line ~10 times per second):
`L <sunAz> <sunLevel 0-255> <earthAz> <earthOn 0/1> <battery 0-100> <psr 0/1>` with azimuths in degrees clockwise
from the vehicle's nose.

Status: compiles for ESP32-C3 and classic ESP32 with arduino-cli 1.6 (esp32 core, Adafruit NeoPixel 1.15.5); not yet run on a real board.
