const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const STARTING_BALANCE = 500;
const DEALER_STANDS_ON = 17;
const DELAY = 1000;

const STORAGE_KEY = "blackjack-progress";

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return {
      balance: STARTING_BALANCE,
      wins: 0,
      losses: 0
    };
  }

  return JSON.parse(saved);
}

function saveProgress(game) {
  const progress = {
    balance: game.balance,
    wins: game.wins,
    losses: game.losses
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }

  get isRed() {
    return this.suit === "♥" || this.suit === "♦";
  }
}

class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) this.cards.push(new Card(rank, suit));
    }

    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length === 0) this.reset();
    return this.cards.pop();
  }
}

class Hand {
  constructor() {
    this.cards = [];
  }

  add(card) {
    this.cards.push(card);
  }

  get score() {
    let total = 0;
    let aces = 0;

    for (const card of this.cards) {
      if (card.rank === "A") {
        total += 11;
        aces++;
      } else if (["J", "Q", "K"].includes(card.rank)) {
        total += 10;
      } else {
        total += parseInt(card.rank, 10);
      }
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  get isBlackjack() {
    return this.cards.length === 2 && this.score === 21;
  }
}

function createGame(onChange) {
  
  const savedProgress = loadProgress();
  
  const game = {
    deck: new Deck(),
    player: new Hand(),
    dealer: new Hand(),
    dealerRevealed: true,
    balance: savedProgress.balance,
    bet: 0,
    wins: savedProgress.wins,
    losses: savedProgress.losses,
    inRound: false,
    busy: false,
    message: "",
  };

  function notify() {
    saveProgress(game);
    onChange();
  }

  function placeBet(value) {
    if (game.inRound || game.busy || game.bet + value > game.balance) return;
    game.bet += value;
    notify();
  }

  function clearBet() {
    if (game.inRound || game.busy) return;
    game.bet = 0;
    notify();
  }

  async function startRound() {
    if (game.inRound || game.busy || game.bet === 0) return;

    game.busy = true;
    game.deck.reset();
    game.player = new Hand();
    game.dealer = new Hand();
    game.dealerRevealed = false;
    game.message = "Dealing...";
    notify();

    for (const hand of [game.player, game.dealer, game.player, game.dealer]) {
      hand.add(game.deck.draw());
      notify();
      await new Promise(resolve => setTimeout(resolve, DELAY));
    }

    game.inRound = true;
    game.busy = false;
    game.message = "Hit or stand?";
    notify();
    if (game.player.score === 21) await finish();
  }

  async function hit() {
    if (!game.inRound || game.busy) return;
    game.player.add(game.deck.draw());
    notify();
    if (game.player.score >= 21) await finish();
  }

  async function stand() {
    if (!game.inRound || game.busy) return;
    await finish();
  }

  async function doubleDown() {
    if (
      !game.inRound ||
      game.busy ||
      game.player.cards.length !== 2 ||
      game.bet * 2 > game.balance
    ) return;

    game.bet *= 2;
    game.player.add(game.deck.draw());
    notify();
    await finish();
  }

  async function finish() {
    if (!game.inRound) return;

    game.inRound = false;
    game.busy = true;
    game.dealerRevealed = true;
    notify();
    await new Promise(resolve => setTimeout(resolve, DELAY));

    const playerScore = game.player.score;
    const playerBlackjack = game.player.isBlackjack;
    const dealerBlackjack = game.dealer.isBlackjack;

    if (playerScore <= 21 && !playerBlackjack) {
      while (game.dealer.score < DEALER_STANDS_ON) {
        game.dealer.add(game.deck.draw());
        notify();
        await new Promise(resolve => setTimeout(resolve, DELAY));
      }
    }

    const dealerScore = game.dealer.score;
    let message;
    let delta;

    if (playerScore > 21) {
      delta = -game.bet;
      message = `Bust at ${playerScore}. You lose $${game.bet}.`;
    } else if (playerBlackjack && dealerBlackjack) {
      delta = 0;
      message = "Both have blackjack. Push.";
    } else if (playerBlackjack) {
      delta = Math.floor(game.bet * 1.5);
      message = `Blackjack! You win $${delta}.`;
    } else if (dealerBlackjack) {
      delta = -game.bet;
      message = `Dealer has blackjack. You lose $${game.bet}.`;
    } else if (dealerScore > 21) {
      delta = game.bet;
      message = `Dealer busts at ${dealerScore}. You win $${game.bet}.`;
    } else if (playerScore > dealerScore) {
      delta = game.bet;
      message = `${playerScore} beats ${dealerScore}. You win $${game.bet}.`;
    } else if (playerScore < dealerScore) {
      delta = -game.bet;
      message = `${dealerScore} beats ${playerScore}. You lose $${game.bet}.`;
    } else {
      delta = 0;
      message = `Push at ${playerScore}.`;
    }

    game.balance += delta;
    if (delta > 0) game.wins++;
    if (delta < 0) game.losses++;
    game.bet = 0;
    if (game.balance <= 0) {
      game.balance = STARTING_BALANCE;
      message += " Out of chips, so your balance was reset to $500.";
    }

    game.message = message;
    game.busy = false;
    notify();
  }

  game.placeBet = placeBet;
  game.clearBet = clearBet;
  game.startRound = startRound;
  game.hit = hit;
  game.stand = stand;
  game.doubleDown = doubleDown;
  return game;
}

function renderHand(hand, element, hideSecond = false) {
  element.innerHTML = "";
  hand.cards.forEach((card, index) => {
    const cardElement = document.createElement("div");
    cardElement.className = "card";
    if (hideSecond && index === 1) {
      cardElement.classList.add("back");
    } else {
      if (card.isRed) cardElement.classList.add("red");
      cardElement.textContent = card.rank + card.suit;
    }
    element.appendChild(cardElement);
  });
}

function initializeGameUI() {
  const elements = {
    balance: document.getElementById("balance"),
    bet: document.getElementById("bet"),
    wins: document.getElementById("wins"),
    losses: document.getElementById("losses"),
    dealButton: document.getElementById("deal-btn"),
    hitButton: document.getElementById("hit-btn"),
    standButton: document.getElementById("stand-btn"),
    doubleButton: document.getElementById("double-btn"),
    clearButton: document.getElementById("clear-btn"),
    message: document.getElementById("message"),
    dealerTotal: document.getElementById("dealer-total"),
    playerTotal: document.getElementById("player-total"),
    dealerCards: document.getElementById("dealer-cards"),
    playerCards: document.getElementById("player-cards"),
    chips: document.querySelectorAll(".chip"),
  };
  let game;

  function render() {
    elements.balance.textContent = game.balance;
    elements.bet.textContent = game.bet;
    elements.wins.textContent = game.wins;
    elements.losses.textContent = game.losses;
    elements.dealButton.disabled = game.inRound || game.busy || game.bet === 0;
    elements.hitButton.disabled = !game.inRound;
    elements.standButton.disabled = !game.inRound;
    elements.doubleButton.disabled =
      !game.inRound ||
      game.busy ||
      game.player.cards.length !== 2 ||
      game.bet * 2 > game.balance;
    elements.clearButton.disabled = game.inRound || game.busy;
    elements.chips.forEach(chip => {
      chip.disabled = game.inRound || game.busy;
    });

    elements.message.textContent = game.message;
    renderHand(game.player, elements.playerCards);
    renderHand(game.dealer, elements.dealerCards, !game.dealerRevealed);
    elements.playerTotal.textContent = game.player.score;
    elements.dealerTotal.textContent =
      game.dealerRevealed ? game.dealer.score : "?";
  }

  game = createGame(render);

  elements.chips.forEach(chip => {
    chip.addEventListener("click", () => {
      game.placeBet(parseInt(chip.dataset.v, 10));
    });
  });
  elements.clearButton.addEventListener("click", () => game.clearBet());
  elements.dealButton.addEventListener("click", () => game.startRound());
  elements.hitButton.addEventListener("click", () => game.hit());
  elements.standButton.addEventListener("click", () => game.stand());
  elements.doubleButton.addEventListener("click", () => game.doubleDown());
  render();
}

initializeGameUI();
