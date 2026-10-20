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
`uni-calendar`, die ausschließlich Links von `rapla.dhbw.de` annimmt. Der Link
bleibt nur auf dem Gerät gespeichert und wird nicht in Netlify hinterlegt.
Hap lädt den Plan alle 6 Stunden und bei der Rückkehr zur App neu.

## Profil für die Essensplanung

Profil (Alter, Größe, Gewicht, Ziel, Vorlieben) und Trainingstage werden mit dem
App-Zugang an die Function `meal-profile` gesendet und in Netlify Blobs gespeichert.
Die wöchentliche Erstellung hängt diesen Text an MEAL_PLAN_PROMPT an, damit
Kalorien, Protein und Trainingstage berücksichtigt werden.

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
ist der Essensplan daher bewusst leer, und der Rapla-Import im Browser braucht
`npx netlify dev` (in der nativen App funktioniert er direkt). Die Backend-Tests verwenden simulierte
API-Antworten; ein echter KI-Aufruf erfordert die obigen Zugangsdaten.
