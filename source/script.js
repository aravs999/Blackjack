const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

let deck = [], player = [], dealer = [];
let balance = 500, bet = 0, wins = 0, losses = 0;
let inRound = false, busy = false;

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DELAY = 1000; // pause between cards, in milliseconds

function buildDeck() {
  const d = [];
  for (const suit of SUITS) for (const rank of RANKS) d.push({ rank, suit });
  return d;
}

function shuffle(d) {
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function draw() {
  if (deck.length === 0) deck = shuffle(buildDeck());
  return deck.pop();
}

// Aces count 11, then drop to 1 one at a time while the hand is over 21
function score(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    if (c.rank === "A") { total += 11; aces++; }
    else if (["J","Q","K"].includes(c.rank)) total += 10;
    else total += parseInt(c.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function render(hand, el, hideSecond = false) {
  el.innerHTML = "";
  hand.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "card";
    if (hideSecond && i === 1) {
      d.classList.add("back");
    } else {
      if (c.suit === "♥" || c.suit === "♦") d.classList.add("red");
      d.textContent = c.rank + c.suit;
    }
    el.appendChild(d);
  });
}

function refresh() {
  $("balance").textContent = balance;
  $("bet").textContent = bet;
  $("wins").textContent = wins;
  $("losses").textContent = losses;
  $("deal-btn").disabled = inRound || busy || bet === 0;
  $("hit-btn").disabled = !inRound;
  $("stand-btn").disabled = !inRound;
  $("clear-btn").disabled = inRound || busy;
  document.querySelectorAll(".chip").forEach(c => c.disabled = inRound || busy);
}

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const v = parseInt(chip.dataset.v);
    if (bet + v <= balance) { bet += v; refresh(); }
  });
});
$("clear-btn").addEventListener("click", () => { bet = 0; refresh(); });

async function startRound() {
  busy = true;
  deck = shuffle(buildDeck());
  player = [];
  dealer = [];
  $("message").textContent = "Dealing...";
  $("dealer-total").textContent = "?";
  refresh();
  // one card at a time: you, dealer, you, dealer (dealer's second card stays face down)
  for (const hand of [player, dealer, player, dealer]) {
    hand.push(draw());
    render(player, $("player-cards"));
    render(dealer, $("dealer-cards"), true);
    $("player-total").textContent = score(player);
    await sleep(DELAY);
  }
  inRound = true;
  busy = false;
  $("message").textContent = "Hit or stand?";
  refresh();
  if (score(player) === 21) finish();
}

function hit() {
  player.push(draw());
  render(player, $("player-cards"));
  const t = score(player);
  $("player-total").textContent = t;
  if (t >= 21) finish();
}

async function finish() {
  inRound = false;
  busy = true;
  refresh();
  render(dealer, $("dealer-cards"));
  $("dealer-total").textContent = score(dealer);
  await sleep(DELAY); // let the flipped card be seen

  const p = score(player);
  const playerBJ = player.length === 2 && p === 21;
  const dealerBJ = dealer.length === 2 && score(dealer) === 21;

  if (p <= 21 && !playerBJ) {
    while (score(dealer) < 17) {
      dealer.push(draw());
      render(dealer, $("dealer-cards"));
      $("dealer-total").textContent = score(dealer);
      await sleep(DELAY);
    }
  }

  const d = score(dealer);
  let msg, delta;
  if (p > 21)                { delta = -bet; msg = `Bust at ${p}. You lose $${bet}.`; }
  else if (playerBJ && dealerBJ) { delta = 0; msg = "Both have blackjack. Push."; }
  else if (playerBJ)         { delta = Math.floor(bet * 1.5); msg = `Blackjack! You win $${delta}.`; }
  else if (dealerBJ)         { delta = -bet; msg = `Dealer has blackjack. You lose $${bet}.`; }
  else if (d > 21)           { delta = bet; msg = `Dealer busts at ${d}. You win $${bet}.`; }
  else if (p > d)            { delta = bet; msg = `${p} beats ${d}. You win $${bet}.`; }
  else if (p < d)            { delta = -bet; msg = `${d} beats ${p}. You lose $${bet}.`; }
  else                       { delta = 0; msg = `Push at ${p}.`; }

  balance += delta;
  if (delta > 0) wins++;
  if (delta < 0) losses++;
  bet = 0;
  if (balance <= 0) { balance = 500; msg += " Out of chips, so your balance was reset to $500."; }

  $("message").textContent = msg;
  busy = false;
  refresh();
}

$("deal-btn").addEventListener("click", startRound);
$("hit-btn").addEventListener("click", hit);
$("stand-btn").addEventListener("click", finish);
refresh();
