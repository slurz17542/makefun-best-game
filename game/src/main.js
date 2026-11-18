// Emberwarden — bootstrap.
//
// Finds the canvas, builds the game and starts its loop. Nothing here is
// game logic: every rule lives in game.js and its modules, so this file
// stays small enough to read at a glance.

import { Game } from './game.js';

const canvas = document.getElementById('game');
if (!canvas) throw new Error('Emberwarden: no #game canvas in the page');

const game = new Game(canvas);
window.emberwarden = game;
game.run();
