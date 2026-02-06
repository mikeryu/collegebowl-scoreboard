# Game-Flow Handwritten Diagram: OCR + Interpretation Notes

Source file: `resources/Game-Flow.pdf`

Status: handwritten diagram, image-based PDF (not directly text-selectable).  
Method used: `pdftoppm` + `tesseract` OCR, then manual normalization.

## What Was Reliably Extracted

- Document timestamp header:
  - `Thursday, October 10, 2024`
  - `10:56 AM`
- Repeated role label in many nodes:
  - `Moderator` (OCR often misread as `M odurator`, `Modicator`, etc.)
- Core phase labels:
  - `Toss-up question`
  - `Follow-up question`
- Repeated action labels:
  - `Timer starts`
  - `Timer sounds`
  - `flip to answer screen` (OCR noisy, but repeated)
  - `acknowledge correct answer`
  - `awards Team A/B ... pts`
- Timing and scoring values align with rules doc:
  - Toss-up: `45 sec`
  - Follow-up: `2 minutes`
  - Toss-up correct: `1 pt`
  - Follow-up correct: `2 pts`

## Normalized Process Flow (Best-Effort)

1. Moderator projects and reads toss-up question.
2. Toss-up timer starts (45s), with warning beep near end.
3. Moderator manages answer attempts while timer is active.
4. If toss-up answer is correct:
   - acknowledge correct answer
   - award 1 point to Team A/B
   - mark that team as having follow-up claim/priority
   - transition to answer/solution display
5. If toss-up answer is incorrect or no valid answer:
   - process alternate team path if eligible/time remains
   - continue to follow-up stage
6. Moderator projects and reads follow-up question.
7. Follow-up timer starts (2:00), with warning beep near end.
8. Claimed team answers first; if incorrect, other team may answer (single-attempt style).
9. On correct follow-up answer, award 2 points to Team A/B.
10. Transition to next toss-up and repeat cycle.

## Confidence Notes

- High confidence:
  - Phase names (`toss-up`, `follow-up`)
  - Timer lengths (`45s`, `2m`)
  - Point values (`1` and `2`)
  - Moderator-centered flow with branching for correct/incorrect answers
- Medium confidence:
  - Exact wording of branch conditions in each node
  - Exact UI gesture text (there appears to be a handwritten note about preventing accidental flips)
- Low confidence:
  - Any node text that only appeared once in OCR and had low OCR confidence

## Cross-Check Against `Game-Rules-Old.pdf`

The normalized flow above is consistent with `resources/Game-Rules-Old.pdf`, which explicitly defines:

- toss-up = 45 seconds
- follow-up = 2 minutes
- 10-second warning beep
- scoring: toss-up +1, follow-up +2
- claim/priority handling for follow-up answering order

## App Mapping Snapshot (Current `script.js`)

- Timer values are aligned with rules:
  - `SHORT_TIMER_SECS = 45 - 1`
  - `LONG_TIMER_SECS = 120 - 1`
- Round timer default is 15 minutes (consistent with final-round guidance).
- Keyboard controls exist for:
  - toss-up start, follow-up start (left/right claim), reset
  - pause/unpause
  - manual claim indicator toggles
  - score updates

