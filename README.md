# PDFJS word and sentence highlight demo

![](./README-DEMO.gif)

## Get up and running
1. Clone
2.
```bash
cd <path-to-cloned-repo>
npm install
npm run dev
```
3. And open a localhost link provided by `npm run dev`.

## Use case
- Soon we'll have a text-to-speech functionality, so we need to have a way of visualizing what is being currently read by a voice. Highlighting boundaries of a sentences; and current spoken word.
    - Speechify is a good example and implementation

## Requirements
- Make as much calculations on the front-end side as possible
- Precisely highlight sentences and words
-
- Demo viewer (this repo)
- Demo integration with Next.js
-
- Handle resizes properly
- Doesn't interfere with annotations nor search
-
- For POC #1, use a simple react + vite + ts template
- For POC #2, use a simple next.js template
-
- Verify WebKit, Blink and Gecko on Desktop
- Verify Webkit on iOS
- Verify Chrome-based (Blink) and Firefox (Gecko) on Android

## Remarks
- Possible implementations for word and sentence highlight:
    - With Canvas: Simple; easy scaling; animations and transitions will be harder to achieve;
    - With DOM elements: Simple, but harder to scale; animation and transitions are a breeze; can't use compound shapes;
    - With SVG: Highly flexible customizable; compound shapes; animation and transitions;
- SVG is chosen 
- Pdfjs `textContent` doesn't provide info to work with
    - Opted for client-side OCR
    - OCR, however, isn't ideal, and doesn't recognize some text. Example: gray text.
      - Needs investigation and tinkering
    - Much more reliable info, but a normalization required (done)
- Firefox has a weird first-time PDF rendering issue
- Mobiles need further investigation
- In dev mode, Pdfjs leaves a `console.error` message, but that's bc of React doing some magic under the hood, e.g. rendering twice: one real and one virtual to help devs to ensure the code has no side-effects
    - In prod, it doesn't happen. Source — React docs
- A bunch of demo PDFs are included
- A sentence boundaries check requires more work. Example: `I'm not Dr. Watson.`. The `Dr.` should not be a sentence terminator.
- Could've forgotten about something else

## Not doing
- Zoom in / out
    - With SVG layer, should be a piece of cake
- Scrolling across all pages
    - It's not clear when to run an OCR to highlight anything, when you scroll here and there
- Changing pages, as it's just a POC

## Out of scope
It's just a proof of concept and feasibility check, e.g. playground. Thus to speed the things up, some things are left out.
- ❌ Proper testing
- ❌ Linter and formatting settings
- ❌ Common abstractions for PDF, ePub, Mobi, etc.
- ❌ Optimizations
- ❌ Decoupling, etc.
- ❌ Edge-cases
- etc..