# SESDNR Admin

Android-приложение для управления сайтом sesdnr.ru — заявки и чаты.

## Установка и запуск для тестирования

### 1. Установите Expo Go на Android

Скачайте **Expo Go** из Google Play Store на ваш Android телефон.

### 2. Запустите локальный сервер Next.js

```bash
cd C:\Users\admin\Desktop\sitesesdnr
npm run dev
```

Сервер запустится на порту 3001. Узнайте локальный IP компьютера:
```
ipconfig
```
Запомните IPv4-адрес (например `192.168.1.42`).

### 3. Запустите приложение

```bash
cd C:\Users\admin\Desktop\sesdnr-admin
npx expo start
```

Отсканируйте QR-код в Expo Go на телефоне (телефон и ПК должны быть в одной WiFi-сети).

### 4. Настройка при первом запуске

При первом открытии приложение спросит:
- **Ваше имя** — будет отображаться клиентам в чате (например: `Дмитрий`)
- **Адрес сервера** — `http://192.168.1.42:3001` (ваш локальный IP)
- **Токен** — `sesdnr-app-2026`

### Изменить настройки

Вкладка **Настройки** → обновите адрес сервера → **Сохранить настройки**.

## Структура

```
app/
  (tabs)/
    index.tsx      — Заявки
    chats.tsx      — Чаты
    settings.tsx   — Настройки
  chat/[sessionId].tsx  — Диалог с клиентом
  setup.tsx             — Первый запуск
components/
  BookingCard.tsx   — Карточка заявки
  ChatItem.tsx      — Элемент списка чатов
lib/
  api.ts    — HTTP-клиент к серверу
  db.ts     — SQLite (локальная база на устройстве)
  store.ts  — Состояние (Zustand)
  types.ts  — TypeScript типы
```

## Переменные сервера (.env.local)

```
APP_SECRET_TOKEN=sesdnr-app-2026
```
