# HOW TO USE THE SCOREBOARD APP

 Developed by Assistant Professor Mike Ryu (https://www.mikeryu.com)

This application was developed for the Math Field Day event at Westmont College, Santa Barbara.

  ---

## Startup

Open up `index.html` in your browser. `script.js` and `style.css` must be in the same directory (folder) as the `index.html`.

At the start-up, an alert pop-up will ask the following question:

> Number of minutes in game?  

Enter the number of minutes in integer format (e.g., 15), or simply press enter to use the default round duration of 15 minutes.

**The scoreboard will initialize in a PAUSED state.** Press the `ESC` key to unpause the round timer to begin the round.

## Pause Functionalities

The scoreboard allows pausing both the round timer and the question timer.

 - Pausing the round timer automatically pauses the question timer as well.
   - While the round timer is paused, all question and claim indicator controls are disabled.
   - Unpausing the round timer does not automatically unpause the question timer; it must be manually unpaused.

 - Pausing the question timer does not automatically pause the round timer, but it can still be manually paused.
   - While the question timer is paused, only the question controls are diabled.
   - Claim indicator controls remain enabled while the question timer is paused.

 - Score controls remain active at all times regardless of the pause states.

---

## Keyboard Commands

### Basic Timer Controls  

Round and question timer function independently of each other. To pause or unpause both timers at once, simply hit both keys at the same time.

- `ESC`: pause/unpause the round timer (top).
- `SPACEBAR`: pause/unpause the question timer.

#### Question Timer Controls

Note that the question control via arrow keys are *not* available while the question timer is paused.

- `UP` arrow key: start a toss-up timer (20 seconds).
- `RIGHT` arrow key: start a follow-up timer for the RIGHT team (90 seconds).
- `LEFT` arrow key: start a follow-up timer for the LEFT team (90 seconds).
- `DOWN` arrow key: reset the timer to the initial blank state.

### Scoring

Scoring now requires two-key combination based on the common gaming movement keys (WASD).

- Hold `a`: "select" the LEFT team as the team to modify the score for (indicated by score box color change).
- Hold `d`: "select" the RIGHT team as the team to modify the score for (indicated by score box color change).
- `w`: increment the score of the selected team(s) by 1.
- `s`: decrement the score of the selected team(s) by 1.

### Claim (Left/Right) Indicator Controls  

These controls are available to you as additional controls in case the "claim" of the teams over questions switches and you wish to indicate the switch manually.

- `[`: enable the LEFT team indicator (does nothing if already enabled).
- `]`: enable the RIGHT team indicator (does nothing if already enabled).
- `\`: disable both team indicators.

---

## Advanced Config

First lines of `script.js` contains a few default values you can edit. To edit the key bindings for keyboard commands, edit the lines 200-300 of the script file. You can find key codes to use using [this web application](https://www.toptal.com/developers/keycode).

---

## Credits

The following resources was utilized as the starting template for this application: https://codingartistweb.com/2023/10/scoreboard/.