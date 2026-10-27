# Hap auf Netlify

Die Web-App enthält Tagesaufgaben, Monatskalender, Kategorien, Wiederholungen,
lokale Speicherung, Backup, XP, Level und Tagesfortschritt. Die Essensplanung
erstellt neue Pläne über die OpenAI-API. Bestehende ChatGPT-Chats werden nicht ausgelesen.

## Einmal einrichten

1. Projekt als Git-Repository zu Netlify verbinden. Die vorhandene netlify.toml
   setzt Build-Befehl, dist-Verzeichnis und Functions. Ein reiner Drag-and-drop-Upload
   von dist richtet die serverseitigen Functions nicht ein.
2. In Netlify folgende geheime Umgebungsvariablen für Functions hinterlegen:
   - OPENAI_API_KEY: Dein OpenAI-API-Schlüssel.
   - OPENAI_MODEL: Ein für deinen API-Account verfügbares Modell, das Responses
     und Structured Outputs unterstützt.
   - MEAL_PLAN_PROMPT: Die Anweisungen aus „Weekly Meal Plan and Groceries“,
     einschließlich Personenanzahl, Budget, Vorlieben und ggf. Unverträglichkeiten.
     Diese Informationen werden zur Planerstellung an die OpenAI-API übertragen.
   - HAP_ACCESS_TOKEN: Zufälliges eigenes Token mit mindestens 32 Zeichen.
     Dieses schützt den Lesezugriff auf deinen Essensplan.
   - HAP*JOB_SECRET: Ein ANDERES zufälliges Token mit mindestens 32 Zeichen.
     Dieses schützt die kostenpflichtige Planerstellung. Niemals in die App eintragen.
     Keine dieser Variablen mit EXPO_PUBLIC* beginnen lassen.
3. Produktionsdeployment starten. Netlify Blobs wird zur Laufzeit automatisch verbunden.
4. In Netlify unter Functions die Funktion weekly-meals einmal mit „Run now“ starten.
   Danach in den Logs von generate-meals-background prüfen, ob der Plan gespeichert wurde.
5. In Hap unter Einstellungen HAP_ACCESS_TOKEN als „Persönlicher App-Zugang“
   eingeben und speichern. Auf derselben Website kann die Netlify-Adresse leer bleiben.
   Danach lädt die App den Plan automatisch.

## Ablauf

Netlify prüft täglich um 06:00 UTC (07:00 bzw. 08:00 Uhr in Berlin).
Sonntags wird die kommende Woche erzeugt. An anderen Tagen wird ein fehlender Plan
für die aktuelle Woche nachgeholt. Existiert der Wochenplan schon, erfolgt kein
neuer KI-Aufruf. Ein bedingter Schreibzugriff verhindert das Überschreiben vorhandener
Wochen. Das Zeitfenster-Lock vermeidet normale parallele Aufrufe; ein Absturz
oder eine Zeitfenstergrenze kann im Ausnahmefall einen weiteren API-Aufruf verursachen.

Der Lese-Endpunkt bevorzugt die laufende Woche und zeigt den neuen Plan ab Montag.
Hap aktualisiert beim Start, bei der Rückkehr und alle 15 Minuten. Pro neuer Woche
werden Frühstück, Mittagessen und Abendessen automatisch als 21 einzelne Aufgaben
eingetragen. Eigene Bearbeitungen und Löschungen werden nicht beim nächsten Abruf
überschrieben. Die vier Startaufgaben sind bearbeitbare Beispiele; die Beispielaufgabe
„Abendessen & Feierabend“ kannst du löschen, sobald du die konkreten Mahlzeiten nutzt.

Die OpenAI-API und Netlify können nutzungsabhängige Kosten verursachen.
Es erfolgt kein wöchentliches Deployment; nur gespeicherte Inhalte ändern sich.

## Stundenplan (DHBW Rapla)

Unter Einstellungen den persönlichen Rapla-Link einfügen. Rapla bietet für diese
Links keinen iCal-Export, darum liest Hap die Wochenansicht (bis zu 20 Wochen ab
zwei Wochen in der Vergangenheit) und erkennt Vorlesungen, Räume, Dozierende und
die Klausurwoche. Die native App ruft Rapla direkt ab. Im Browser blockiert Rapla
direkte Abrufe (CORS), deshalb läuft der Import dort über die Function
`uni-calendar` (lokal stellt der Expo-Server sie bereit), die ausschließlich Links von `rapla.dhbw.de` annimmt. Der Link
bleibt nur auf dem Gerät gespeichert und wird nicht in Netlify hinterlegt.
Hap lädt den Plan alle 6 Stunden und bei der Rückkehr zur App neu.

## Kalender-Abos (Reisen, Google, Outlook, iCloud, TripIt)

Unter Einstellungen → Kalender-Abos beliebige iCal-Links (`webcal://` oder
`https://…`) abonnieren. Hap lädt sie alle 2 Stunden und beim Öffnen neu und
zeigt die Termine im Zeitplan, optional mit Erinnerung (z. B. 3 Std. vor Flügen).
Im Browser läuft der Abruf über die Function `ical` (braucht den App-Zugang und
ruft keine internen Netzwerkadressen ab), in der nativen App direkt.

Für Bahn und Flug: im iPhone-Kalender einen eigenen Kalender „Reisen“ anlegen,
als öffentlichen Kalender teilen und den Link abonnieren; Reisen aus dem
DB Navigator mit „In Kalender übernehmen“ dort eintragen. Alternativ
Buchungsmails an TripIt weiterleiten und dessen „Calendar Feed“ abonnieren.

## Profil für die Essensplanung

Profil (Alter, Größe, Gewicht, Ziel, Vorlieben) und Trainingstage werden mit dem
App-Zugang an die Function `meal-profile` gesendet und in Netlify Blobs gespeichert.
Die wöchentliche Erstellung hängt diesen Text an MEAL_PLAN_PROMPT an, damit
Kalorien, Protein und Trainingstage berücksichtigt werden.

## Hap auf dem Home-Bildschirm (ohne App Store)

Hap ist eine installierbare Web-App mit eigenem Logo:

- iPhone (iOS 16.4 oder neuer): Hap in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
- Android (Chrome): Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

Danach Hap über das Icon öffnen und unter Einstellungen → Benachrichtigungen
die Erinnerungen einschalten. Auf dem iPhone geht Push nur in der App vom
Home-Bildschirm, nicht im normalen Safari-Tab.

### Push einrichten (einmalig)

1. Lokal Schlüssel erzeugen: `npx web-push generate-vapid-keys`
2. In Netlify (Scope Functions) hinterlegen: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
   und VAPID_SUBJECT (z. B. `mailto:deine-adresse`). Den privaten Schlüssel nie in die App eintragen.
3. Neu deployen. HAP_ACCESS_TOKEN muss in der App unter Einstellungen eingetragen sein.

Die App schickt ihre anstehenden Erinnerungen (nächste 4 Tage) an die Function
`push`. Die geplante Function `push-dispatch` läuft alle 2 Minuten und versendet,
was fällig ist – Erinnerungen kommen also bis zu etwa 2 Minuten später als geplant.
Änderungen am Plan werden beim nächsten Öffnen von Hap übertragen.

## Kalorien per Foto

Unter Essen → Heute schickt Hap ein verkleinertes Foto (max. 1024 px, JPEG) oder
eine kurze Beschreibung an die Function `food-scan`. Sie fragt die OpenAI-API
(Modell `FOOD_MODEL`, sonst `OPENAI_MODEL`; es muss Bilder verstehen) und gibt
geschätzte kcal, Protein, Kohlenhydrate und Fett zurück. Fotos werden nicht
gespeichert (`store: false`). Ein Tageslimit von 40 Analysen schützt vor
unerwarteten Kosten. Mit `gpt-6-luna` kostet ein Foto rund 0,05 Cent.

## Sync zwischen Geräten

Mit dem App-Zugang synchronisiert Hap alle Daten über Netlify Blobs
(`hap-backup`): nach jeder Änderung, alle 2 Minuten und beim Öffnen. Jedes Gerät
merkt sich den zuletzt synchronisierten Stand; Änderungen von Handy und Laptop
werden zusammengeführt (neue, erledigte und gelöschte Einträge von beiden
Seiten bleiben erhalten; ändern beide denselben Eintrag, gewinnt das Gerät, das
gerade synchronisiert). Ein Gerät schreibt nur, wenn es den neuesten Stand
kennt, sonst führt es erst zusammen. Nicht synchronisiert werden: App-Zugang,
Benachrichtigungs-Einstellungen, laufende Fokusrunde/Training und die
Kalender-Feeds (die lädt jedes Gerät selbst). Auf einem neuen Gerät fragt Hap,
ob die Cloud-Daten übernommen werden sollen.

## Weitere KI-Funktionen (alle mit Tageslimit)

- `groceries`: Einkaufsliste nach geänderten Gerichten neu berechnen (15/Tag).
- `module-scan`: Module aus Screenshot, PDF (max. ca. 3 MB) oder Text lesen und
  Lernstunden vorschlagen (10/Tag).
- `plan-parse`: Freitext wie „nach der Vorlesung 2 h lernen, danach Gym“ mit
  Blick auf den Kalender der nächsten 7 Tage in Aufgaben umwandeln (60/Tag).

Barcodes werden direkt bei Open Food Facts nachgeschlagen (kostenlos, ohne Netlify).

## ETF-Kurse (Geld)

`quotes` sucht zu einer ISIN die Euro-Notierung (Xetra bevorzugt) und liefert den
aktuellen Kurs plus ein Jahr Tagesschlusskurse von Yahoo Finance. Kostenlos, ohne
API-Schlüssel, nur mit `HAP_ACCESS_TOKEN`. Das ist keine offizielle Schnittstelle:
Findet sie einen ETF nicht, trägt man in Hap das Börsenkürzel ein (z. B. `VWCE.DE`).

## Offline

Der Service Worker speichert die App-Dateien, damit Hap auch ohne Netz startet.
Die Seite selbst wird immer zuerst aus dem Netz geladen, ein neues Deployment
ist also sofort sichtbar. Daten-Abrufe (`/.netlify/…`) werden nie zwischengespeichert.

## Benachrichtigungen

In der nativen App plant Hap lokale Erinnerungen für die nächsten 4 Tage
(Vorlesungen, Aufgaben, Training, Klausuren/Abgaben, Morgen-Briefing,
Tagesabschluss, Ende einer Fokusrunde). Dafür ist ein Development Build nötig
(`npx expo run:android` / `npx expo run:ios` oder `eas build --profile development`),
in Expo Go funktionieren lokale Erinnerungen ebenfalls. Im Browser gibt es
Erinnerungen nur, solange Hap in einem Tab geöffnet ist.

## Speicherung und Grenzen

Aufgaben und Häkchen werden lokal auf dem jeweiligen Gerät gespeichert. Das ist
keine Cloud-Synchronisierung. Eine andere Domain, ein anderer Browser oder ein
anderes Gerät hat einen separaten Datenbestand. Bei gelöschten Browserdaten helfen
die JSON-Backups unter Einstellungen. Der Zugangstoken wird nicht mit exportiert.

Die Netlify-Verbindung ist für die Web-App auf derselben Domain ausgelegt.
Für native Apps kann die vollständige Netlify-Adresse eingetragen werden.
Eine fremde Web-Domain wird ohne zusätzliche CORS-Konfiguration nicht unterstützt.
Der gespeicherte Essensplan ist nach dem ersten Abruf lokal verfügbar; das erstmalige
Laden der Website ohne Internet ist noch nicht als Offline-PWA eingerichtet.

## Lokal prüfen

- npm run typecheck
- npm run lint
- npm test
- npm run build:web
- npm run web

Die reine Expo-Vorschau enthält keine Netlify-Functions. Ohne eingerichtetes Netlify
ist der Essensplan daher bewusst leer. Der Rapla-Import funktioniert trotzdem:
`metro.config.js` stellt die Function `uni-calendar` auch auf dem lokalen
Expo-Server bereit. Die Backend-Tests verwenden simulierte
API-Antworten; ein echter KI-Aufruf erfordert die obigen Zugangsdaten.
