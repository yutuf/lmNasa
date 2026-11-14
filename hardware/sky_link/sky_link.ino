// LunaNav sky link: an LED ring that shows, live, where the Sun and Earth are for the rover (or lander) in the web app.
//
// The web app (Rover / Lander view -> "Sky compass" button, Chrome or Edge) sends one line ~10 times a second over USB:
//   L <sunAz> <sunLevel> <earthAz> <earthOn> <battery> <psr>\n
//     sunAz, earthAz : degrees clockwise from the vehicle's nose (0..359), so LED 0 should point forward
//     sunLevel       : 0..255, visible fraction of the solar disk above the real terrain horizon
//     earthOn        : 1 if Earth's centre is above the terrain horizon (direct radio link possible)
//     battery        : 0..100 %
//     psr            : 1 if the vehicle is inside a permanently shadowed region
//
// Hardware: any ESP32 / ESP32-C3 / ESP32-S3 (or Arduino with enough RAM) + a WS2812B ("NeoPixel") ring.
// Wiring: ring DIN -> 330 ohm -> LED_PIN, ring 5V -> board 5V (USB), ring GND -> GND, 470..1000 uF across 5V/GND.
// Library: Adafruit NeoPixel (Arduino Library Manager).
// Also works with hardware/horizon_compass (24 LEDs, GPIO10 on the ESP32-C3 devkit).

#include <Adafruit_NeoPixel.h>

#ifndef LED_PIN
#define LED_PIN 10        // ESP32-C3 devkit board in hardware/horizon_compass; use 5 on a classic ESP32 devkit
#endif
#ifndef RING_LEDS
#define RING_LEDS 24      // 12, 16 and 24 LED rings all work
#endif
const uint8_t MAX_LEVEL = 70;   // of 255: stays well inside what a USB port can supply

Adafruit_NeoPixel ring(RING_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

struct Sky { int sunAz = 0, sunLevel = 0, earthAz = 0, earthOn = 0, battery = 100, psr = 0; };
Sky sky;
unsigned long lastLine = 0;
char buf[64];
uint8_t len = 0;

uint16_t ledFor(int az) {
  az = ((az % 360) + 360) % 360;
  return (uint16_t)((az * RING_LEDS + 180) / 360) % RING_LEDS;
}

void parse(const char *s) {
  Sky k;
  if (sscanf(s, "L %d %d %d %d %d %d", &k.sunAz, &k.sunLevel, &k.earthAz, &k.earthOn, &k.battery, &k.psr) == 6) {
    sky = k;
    lastLine = millis();
  }
}

void draw() {
  uint8_t r[RING_LEDS] = {0}, g[RING_LEDS] = {0}, b[RING_LEDS] = {0};
  unsigned long now = millis();
  if (now - lastLine > 3000) {
    // no data: slow white breathing so you can tell it is powered
    uint8_t v = (uint8_t)(6 + 6 * sin(now / 900.0));
    for (uint16_t i = 0; i < RING_LEDS; i++) r[i] = g[i] = b[i] = v;
  } else {
    if (sky.psr) for (uint16_t i = 0; i < RING_LEDS; i++) b[i] = 3;          // faint blue: permanent shadow
    uint8_t sun = (uint16_t)constrain(sky.sunLevel, 0, 255) * MAX_LEVEL / 255;
    uint16_t s = ledFor(sky.sunAz);
    r[s] = max(r[s], sun);
    g[s] = max(g[s], (uint8_t)(sun * 7 / 10));
    if (sky.earthOn) b[ledFor(sky.earthAz)] = MAX_LEVEL;
    else b[ledFor(sky.earthAz)] = max(b[ledFor(sky.earthAz)], (uint8_t)4);     // dim: Earth behind terrain
    if (sky.battery < 20 && (now / 400) % 2) r[0] = MAX_LEVEL;                // low battery: blink the nose LED red
  }
  for (uint16_t i = 0; i < RING_LEDS; i++) ring.setPixelColor(i, ring.Color(r[i], g[i], b[i]));
  ring.show();
}

void setup() {
  Serial.begin(115200);
  ring.begin();
  ring.clear();
  ring.show();
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || len == sizeof(buf) - 1) { buf[len] = 0; parse(buf); len = 0; }
    else if (c != '\r') buf[len++] = c;
  }
  static unsigned long lastDraw = 0;
  if (millis() - lastDraw >= 30) { lastDraw = millis(); draw(); }
}
