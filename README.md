# Can You Diagnose Me? — Live Q&A Activity

A host/participant web app for the **"Can You Diagnose Me?"** classroom activity. The host advances six sequential case questions; participants see one question at a time with **newly added context highlighted**, lock in an answer, and get a **private end summary** of how their answers changed.

## How it works

1. **Host** opens `/host`, creates a room, shares the QR / room code.
2. **Participants** open `/client` (or scan the QR) and join.
3. Host taps **Start session** → Question 1 is sent to everyone.
4. Participants select an answer, optionally change it, then **Lock in**.
5. Host taps **Next question** to reveal the next clue (highlighted on phones).
6. After Question 6 is locked, each participant sees only their own change history.

**Privacy:** Full change history stays on the participant's phone. At the end, the host sees **aggregated** answer letters (A–E) per question so the room can watch how diagnoses shifted. Individual phones still show only their own path.

## Prerequisites

- Free [Supabase](https://supabase.com) project (Realtime enabled by default)
- Optional: [Netlify](https://netlify.com) or [Vercel](https://vercel.com) for hosting

## Setup

1. Create a Supabase project.
2. Copy Project URL and anon key from **Project Settings → API**.
3. Local config:

```bash
cp js/config.example.js js/config.js
# Edit js/config.js with SUPABASE_URL, SUPABASE_ANON_KEY, HOST_PASSWORD
```

4. Serve locally:

```bash
npx serve .
```

- Host: `http://localhost:3000/host`
- Participant: `http://localhost:3000/client?room=CODE`

## Deploy

Set environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `HOST_PASSWORD`. Build runs `node scripts/generate-config.js`.

Clean URLs:

- `/host` → host page
- `/client?room=CODE` → participant page

## Project structure

```
├── index.html
├── host.html
├── client.html
├── css/styles.css
├── js/
│   ├── config.example.js
│   ├── config.js
│   ├── questions.js          # 6 case questions + highlighted segments
│   ├── supabase-client.js
│   ├── host.js
│   ├── client.js
│   └── bg.js
└── scripts/generate-config.js
```

## Activity notes

Questions and options are taken from `Topics Project Activity.docx`. Options A–E stay consistent; Questions 5–6 use the “underlying mental disorder” wording for option E.
