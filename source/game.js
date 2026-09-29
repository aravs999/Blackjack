
/* ======================================================================
   RULES — edit this block to change the game's logic without touching
   rendering code. This is the whole "house rules" of the game.
   ====================================================================== */
const RULES = {
    bustAt: 21,               // going over this busts
    dealerStandsOn: 17,       // dealer hits until reaching this total
    aceLow: 1,
    aceHigh: 11,
    blackjackPayoutMultiplier: 1.5, // natural 21 on first two cards
    winPayoutMultiplier: 1,
    startingBankroll: 200,
    suits: ['♠', '♥', '♦', '♣'],
    ranks: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
    rankValue(rank) {
        if (rank === 'A') return RULES.aceHigh; // resolved dynamically in scoring
        if (['J', 'Q', 'K'].includes(rank)) return 10;
        return parseInt(rank, 10);
    }
};

/* ======================================================================
   CARD RENDERING — fully custom SVG faces. Change suitGlyph() or the
   color tokens above to reskin the deck.
   ====================================================================== */
function suitColor(suit) {
    return (suit === '♥' || suit === '♦') ? 'var(--red)' : 'var(--ink)';
}

function cardFaceSVG(card) {
    const color = suitColor(card.suit);
    return `
    <svg viewBox="0 0 74 104" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="72" height="102" rx="7" fill="var(--cream)" stroke="${color}" stroke-width="1.2" opacity="0.5"/>
      <text x="8" y="20" font-family="Georgia, serif" font-size="15" font-weight="700" fill="${color}">${card.rank}</text>
      <text x="8" y="34" font-family="Georgia, serif" font-size="14" fill="${color}">${card.suit}</text>
      <text x="66" y="94" font-family="Georgia, serif" font-size="15" font-weight="700" fill="${color}" text-anchor="end" transform="rotate(180 66 94)">${card.rank}</text>
      <text x="66" y="80" font-family="Georgia, serif" font-size="14" fill="${color}" text-anchor="end" transform="rotate(180 66 80)">${card.suit}</text>
      <text x="37" y="62" font-family="Georgia, serif" font-size="30" fill="${color}" text-anchor="middle">${card.suit}</text>
    </svg>`;
}

function renderCard(card, faceDown = false) {
    const el = document.createElement('div');
    el.className = 'card' + (faceDown ? ' back' : '');
    if (!faceDown) el.innerHTML = cardFaceSVG(card);
    return el;
}

/* ======================================================================
   GAME STATE
   ====================================================================== */
let deck = [];
let player = [];
let dealer = [];
let bankroll = RULES.startingBankroll;
let currentBet = 0;
let round = 0;
let inRound = false;
let wins = 0;
let losses = 0;

const els = {
    dealerHand: document.getElementById('dealerHand'),
    playerHand: document.getElementById('playerHand'),
    dealerScore: document.getElementById('dealerScore'),
    playerScore: document.getElementById('playerScore'),
    status: document.getElementById('status'),
    dealBtn: document.getElementById('dealBtn'),
    hitBtn: document.getElementById('hitBtn'),
    standBtn: document.getElementById('standBtn'),
    bankroll: document.getElementById('bankroll'),
    currentBet: document.getElementById('currentBet'),
    roundNum: document.getElementById('roundNum'),
    wins: document.getElementById('wins'),
    losses: document.getElementById('losses'),
    betRow: document.getElementById('betRow'),
};

function freshDeck() {
    const d = [];
    for (const suit of RULES.suits) {
        for (const rank of RULES.ranks) {
            d.push({ suit, rank });
        }
    }
    // shuffle (Fisher-Yates)
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

function scoreHand(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
        if (c.rank === 'A') { aces++; total += RULES.aceHigh; }
        else total += RULES.rankValue(c.rank);
    }
    while (total > RULES.bustAt && aces > 0) {
        total -= (RULES.aceHigh - RULES.aceLow);
        aces--;
    }
    return total;
}

function isBlackjack(hand) {
    return hand.length === 2 && scoreHand(hand) === RULES.bustAt;
}

function draw() {
    if (deck.length === 0) deck = freshDeck();
    return deck.pop();
}

function setStatus(text, cls = '') {
    els.status.textContent = text;
    els.status.className = 'status' + (cls ? ' ' + cls : '');
}

function renderHands(revealDealer) {
    els.playerHand.innerHTML = '';
    player.forEach(c => els.playerHand.appendChild(renderCard(c)));
    els.playerScore.textContent = scoreHand(player);

    els.dealerHand.innerHTML = '';
    dealer.forEach((c, i) => {
        const hide = (!revealDealer && i === 1);
        els.dealerHand.appendChild(renderCard(c, hide));
    });
    els.dealerScore.textContent = revealDealer ? scoreHand(dealer) : '?';
}

function updateStats() {
    els.bankroll.textContent = bankroll;
    els.currentBet.textContent = currentBet;
    els.roundNum.textContent = round;
    els.wins.textContent = wins;
    els.losses.textContent = losses;
}

function setBet(v) {
    if (inRound) return;
    if (currentBet + v > bankroll) return;
    currentBet += v;
    updateStats();
}

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => setBet(parseInt(chip.dataset.v, 10)));
});
document.getElementById('clearBet').addEventListener('click', () => {
    if (inRound) return;
    currentBet = 0;
    updateStats();
});

function startRound() {
    if (currentBet <= 0) {
        setStatus('Place a bet first.', '');
        return;
    }
    inRound = true;
    round++;
    deck = deck.length < 15 ? freshDeck() : deck;
    player = [draw(), draw()];
    dealer = [draw(), draw()];
    renderHands(false);
    updateStats();

    els.dealBtn.disabled = true;
    els.hitBtn.disabled = false;
    els.standBtn.disabled = false;
    els.betRow.style.pointerEvents = 'none';
    els.betRow.style.opacity = 0.5;

    if (isBlackjack(player) || isBlackjack(dealer)) {
        endRound();
    } else {
        setStatus('Hit or stand.');
    }
}

function hit() {
    if (!inRound) return;
    player.push(draw());
    renderHands(false);
    if (scoreHand(player) > RULES.bustAt) {
        endRound();
    }
}

function dealerPlay() {
    while (scoreHand(dealer) < RULES.dealerStandsOn) {
        dealer.push(draw());
    }
}

function endRound() {
    inRound = false;
    els.hitBtn.disabled = true;
    els.standBtn.disabled = true;

    const playerBust = scoreHand(player) > RULES.bustAt;
    if (!playerBust) dealerPlay();

    renderHands(true);

    const pScore = scoreHand(player);
    const dScore = scoreHand(dealer);
    const playerBJ = isBlackjack(player);
    const dealerBJ = isBlackjack(dealer);
    const dealerBust = dScore > RULES.bustAt;

    let outcome, cls, delta;

    if (playerBust) {
        outcome = `Bust at ${pScore}. Dealer takes the pot.`; cls = 'lose'; delta = -currentBet;
    } else if (playerBJ && dealerBJ) {
        outcome = `Both twenty-one. Push.`; cls = 'push'; delta = 0;
    } else if (playerBJ) {
        delta = Math.floor(currentBet * RULES.blackjackPayoutMultiplier);
        outcome = `Twenty-one! You win ${delta}.`; cls = 'win';
    } else if (dealerBJ) {
        outcome = `Dealer has twenty-one. You lose.`; cls = 'lose'; delta = -currentBet;
    } else if (dealerBust) {
        delta = Math.floor(currentBet * RULES.winPayoutMultiplier);
        outcome = `Dealer busts at ${dScore}. You win ${delta}.`; cls = 'win';
    } else if (pScore > dScore) {
        delta = Math.floor(currentBet * RULES.winPayoutMultiplier);
        outcome = `${pScore} beats ${dScore}. You win ${delta}.`; cls = 'win';
    } else if (pScore < dScore) {
        outcome = `${dScore} beats ${pScore}. You lose.`; cls = 'lose'; delta = -currentBet;
    } else {
        outcome = `Push at ${pScore}.`; cls = 'push'; delta = 0;
    }

    if (cls === 'win') wins++;
    if (cls === 'lose') losses++;
    bankroll += delta;
    setStatus(outcome, cls);
    currentBet = 0;
    updateStats();

    els.dealBtn.disabled = bankroll <= 0;
    els.betRow.style.pointerEvents = 'auto';
    els.betRow.style.opacity = 1;

    if (bankroll <= 0) {
        setStatus('Out of chips. Refresh to play again.', 'lose');
    }
}

function stand() {
    endRound();
}

els.dealBtn.addEventListener('click', startRound);
els.hitBtn.addEventListener('click', hit);
els.standBtn.addEventListener('click', stand);

updateStats();