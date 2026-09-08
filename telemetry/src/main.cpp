#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include <RTClib.h>
#include <TinyGPS++.h>

// =====================================================
// WIFI
// =====================================================

const char *WIFI_SSID = "Pradnya";
const char *WIFI_PASSWORD = "ironman3000";

// Your Supabase Edge Function
const char *SUPABASE_FUNCTION_URL =
    "https://lgdxtaabcgjocfnxhxee.supabase.co/functions/v1/receive-telemetry";

// =====================================================
// VEHICLE
// =====================================================

const char *VEHICLE_ID = "VEHICLE_01";
const char *DEVICE_ID = "ESP32_01";

// =====================================================
// PIN DEFINITIONS
// =====================================================

// HC-SR04
#define TRIG_PIN 5
#define ECHO_PIN 18

// GPS NEO-6M
// ESP32 RX <- GPS TX
#define GPS_RX 17

// ESP32 TX -> GPS RX
#define GPS_TX 16

// I2C
#define SDA_PIN 21
#define SCL_PIN 22

// =====================================================
// OBJECTS
// =====================================================

RTC_DS1307 rtc;
TinyGPSPlus gps;

HardwareSerial GPSserial(2);

// =====================================================
// STATUS
// =====================================================

bool rtcOK = false;

// =====================================================
// WIFI CONNECTION
// =====================================================

void connectWiFi()
{
  Serial.println();
  Serial.println("========================================");
  Serial.println("Connecting to WiFi");
  Serial.println("========================================");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30)
  {
    delay(500);

    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("WiFi connected!");

    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    Serial.print("Signal strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  }
  else
  {
    Serial.println("WiFi connection FAILED!");
  }
}

// =====================================================
// HC-SR04
// =====================================================

float readDistance()
{
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(
      ECHO_PIN,
      HIGH,
      30000);

  if (duration == 0)
  {
    return -1;
  }

  float distance = duration * 0.0343 / 2.0;

  return distance;
}

// =====================================================
// GPS
// =====================================================

void readGPS()
{
  while (GPSserial.available())
  {
    char c = GPSserial.read();

    gps.encode(c);
  }
}

// =====================================================
// RTC TIMESTAMP
// =====================================================

String getTimestamp()
{
  if (!rtcOK)
  {
    return "";
  }

  DateTime now = rtc.now();

  char timestamp[30];

  snprintf(
      timestamp,
      sizeof(timestamp),
      "%04d-%02d-%02dT%02d:%02d:%02dZ",
      now.year(),
      now.month(),
      now.day(),
      now.hour(),
      now.minute(),
      now.second());

  return String(timestamp);
}

// =====================================================
// SEND TELEMETRY TO SUPABASE
// =====================================================

void sendTelemetry(
    float distanceCm,
    double latitude,
    double longitude,
    double speed)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi not connected.");
    return;
  }

  WiFiClientSecure client;

  // TEMPORARY DEVELOPMENT SETTING
  // We will secure this properly later.
  client.setInsecure();

  HTTPClient http;

  Serial.println();
  Serial.println("========================================");
  Serial.println("Sending telemetry to Supabase...");
  Serial.println("========================================");

  if (!http.begin(client, SUPABASE_FUNCTION_URL))
  {
    Serial.println("HTTP connection failed!");
    return;
  }

  http.addHeader(
      "Content-Type",
      "application/json");

  // -------------------------------------------------
  // GPS values
  // -------------------------------------------------

  double lat = 0;
  double lng = 0;

  if (gps.location.isValid())
  {
    lat = gps.location.lat();
    lng = gps.location.lng();
  }

  // -------------------------------------------------
  // Speed
  // -------------------------------------------------

  double vehicleSpeed = 0;

  if (gps.speed.isValid())
  {
    vehicleSpeed = gps.speed.kmph();
  }

  // -------------------------------------------------
  // Timestamp
  // -------------------------------------------------

  String timestamp = getTimestamp();

  // -------------------------------------------------
  // JSON
  // -------------------------------------------------

  String json = "{";

  json += "\"vehicleId\":\"";
  json += VEHICLE_ID;
  json += "\",";

  json += "\"deviceId\":\"";
  json += DEVICE_ID;
  json += "\",";

  json += "\"fuelLevel\":null,";

  json += "\"distanceCm\":";
  json += String(distanceCm, 2);
  json += ",";

  json += "\"latitude\":";
  json += String(lat, 6);
  json += ",";

  json += "\"longitude\":";
  json += String(lng, 6);
  json += ",";

  json += "\"speed\":";
  json += String(vehicleSpeed, 2);
  json += ",";

  json += "\"timestamp\":\"";
  json += timestamp;
  json += "\"";

  json += "}";

  Serial.println("JSON:");
  Serial.println(json);

  // -------------------------------------------------
  // POST
  // -------------------------------------------------

  int httpCode = http.POST(json);

  Serial.print("HTTP Response Code: ");
  Serial.println(httpCode);

  if (httpCode > 0)
  {
    String response = http.getString();

    Serial.println("Server response:");
    Serial.println(response);
  }
  else
  {
    Serial.print("HTTP error: ");
    Serial.println(
        http.errorToString(httpCode));
  }

  http.end();
}

// =====================================================
// SETUP
// =====================================================

void setup()
{
  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("       FUELGUARD ESP32");
  Serial.println("========================================");

  // =================================================
  // HC-SR04
  // =================================================

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  digitalWrite(TRIG_PIN, LOW);

  Serial.println();
  Serial.println("[HC-SR04]");
  Serial.println("TRIG = GPIO 5");
  Serial.println("ECHO = GPIO 18");
  Serial.println("HC-SR04 initialized");

  // =================================================
  // I2C
  // =================================================

  Serial.println();
  Serial.println("[I2C]");

  Wire.begin(
      SDA_PIN,
      SCL_PIN);

  Serial.println("SDA = GPIO 21");
  Serial.println("SCL = GPIO 22");

  // =================================================
  // RTC
  // =================================================

  Serial.println();
  Serial.println("[RTC DS1307]");

  if (rtc.begin())
  {
    rtcOK = true;

    Serial.println("RTC detected!");

    if (!rtc.isrunning())
    {
      Serial.println("RTC is not running.");

      Serial.println(
          "Setting RTC to compile time...");

      rtc.adjust(
          DateTime(
              F(__DATE__),
              F(__TIME__)));
    }
  }
  else
  {
    Serial.println("RTC NOT detected!");
  }

  // =================================================
  // GPS
  // =================================================

  Serial.println();
  Serial.println("[GPS NEO-6M]");

  GPSserial.begin(
      9600,
      SERIAL_8N1,
      GPS_RX,
      GPS_TX);

  Serial.println("GPS initialized.");
  Serial.println("GPS TX -> GPIO 17");
  Serial.println("GPS RX -> GPIO 16");

  // =================================================
  // WIFI
  // =================================================

  connectWiFi();

  // =================================================
  // READY
  // =================================================

  Serial.println();
  Serial.println("========================================");
  Serial.println("SYSTEM READY");
  Serial.println("========================================");
}

// =====================================================
// LOOP
// =====================================================

void loop()
{
  // Continuously process GPS data
  readGPS();

  // -------------------------------------------------
  // Read distance
  // -------------------------------------------------

  float distance = readDistance();

  // -------------------------------------------------
  // GPS
  // -------------------------------------------------

  double latitude = 0;
  double longitude = 0;
  double speed = 0;

  if (gps.location.isValid())
  {
    latitude = gps.location.lat();
    longitude = gps.location.lng();
  }

  if (gps.speed.isValid())
  {
    speed = gps.speed.kmph();
  }

  // -------------------------------------------------
  // Print sensor data
  // -------------------------------------------------

  Serial.println();
  Serial.println("----------------------------------------");

  Serial.print("Distance: ");

  if (distance < 0)
  {
    Serial.println("No echo");
  }
  else
  {
    Serial.print(distance);
    Serial.println(" cm");
  }

  Serial.print("Latitude: ");
  Serial.println(latitude, 6);

  Serial.print("Longitude: ");
  Serial.println(longitude, 6);

  Serial.print("Speed: ");
  Serial.print(speed);
  Serial.println(" km/h");

  Serial.print("RTC: ");
  Serial.println(getTimestamp());

  // -------------------------------------------------
  // Send to Supabase
  // -------------------------------------------------

  sendTelemetry(
      distance,
      latitude,
      longitude,
      speed);

  // -------------------------------------------------
  // Wait
  // -------------------------------------------------

  delay(10000);
}