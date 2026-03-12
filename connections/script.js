// State
let allWords = [];
let setupWords = [];
let setupSelected = [];
let categories = []; // { name: string, words: string[] }

let playWords = [];
let playSelected = [];
let solvedCategories = [];
let mistakes = 4;

// DOM Elements
const setupPhase = document.getElementById('setup-phase');
const playPhase = document.getElementById('play-phase');
const setupGrid = document.getElementById('setup-grid');
const playGrid = document.getElementById('play-grid');
const setupCategoriesDiv = document.getElementById('setup-categories');
const playCategoriesDiv = document.getElementById('play-categories');

const categoryNameInput = document.getElementById('category-name');
const btnGroup = document.getElementById('btn-group');
const btnStartGame = document.getElementById('btn-start-game');

const btnShuffle = document.getElementById('btn-shuffle');
const btnDeselect = document.getElementById('btn-deselect');
const btnSubmit = document.getElementById('btn-submit');
const mistakesDots = document.querySelectorAll('.dot');
const gameOverMessage = document.getElementById('game-over-message');
const endTitle = document.getElementById('end-title');
const btnRestart = document.getElementById('btn-restart');
const toast = document.getElementById('toast');

// Initialize
function init() {
    try {
        // Pick 16 random words
        const shuffledPool = [...WORD_POOL].sort(() => 0.5 - Math.random());
        allWords = shuffledPool.slice(0, 16);
    } catch (error) {
        console.error("Failed to load words database:", error);
        showToast("Error loading words!");
        return;
    }
    
    // Reset state
    setupWords = [...allWords];
    setupSelected = [];
    categories = [];
    
    playWords = [];
    playSelected = [];
    solvedCategories = [];
    mistakes = 4;
    
    // Reset UI
    setupCategoriesDiv.innerHTML = '';
    playCategoriesDiv.innerHTML = '';
    categoryNameInput.value = '';
    categoryNameInput.disabled = true;
    btnGroup.disabled = true;
    btnStartGame.classList.add('hidden');
    gameOverMessage.classList.add('hidden');
    
    mistakesDots.forEach(dot => dot.classList.remove('lost'));
    
    // Show setup phase
    playPhase.classList.remove('active');
    playPhase.classList.add('hidden');
    setupPhase.classList.remove('hidden');
    setupPhase.classList.add('active');
    document.getElementById('subtitle').innerText = "Create your own game for a friend!";
    
    renderSetupGrid();
}

// --- SETUP PHASE ---

function renderSetupGrid() {
    setupGrid.innerHTML = '';
    setupWords.forEach(word => {
        const btn = document.createElement('button');
        btn.className = `tile ${setupSelected.includes(word) ? 'selected' : ''}`;
        btn.innerText = word;
        btn.onclick = () => handleSetupClick(word);
        setupGrid.appendChild(btn);
    });
}

function handleSetupClick(word) {
    if (setupSelected.includes(word)) {
        setupSelected = setupSelected.filter(w => w !== word);
    } else {
        if (setupSelected.length < 4) {
            setupSelected.push(word);
        }
    }
    
    const isReady = setupSelected.length === 4;
    categoryNameInput.disabled = !isReady;
    btnGroup.disabled = !isReady || categoryNameInput.value.trim() === '';
    
    renderSetupGrid();
}

categoryNameInput.addEventListener('input', () => {
    btnGroup.disabled = setupSelected.length !== 4 || categoryNameInput.value.trim() === '';
});

btnGroup.addEventListener('click', () => {
    const catName = categoryNameInput.value.trim();
    if (setupSelected.length === 4 && catName) {
        categories.push({
            name: catName,
            words: [...setupSelected]
        });
        
        // Remove selected words from setup pool
        setupWords = setupWords.filter(w => !setupSelected.includes(w));
        setupSelected = [];
        categoryNameInput.value = '';
        categoryNameInput.disabled = true;
        btnGroup.disabled = true;
        
        renderSetupCategories();
        renderSetupGrid();
        
        if (categories.length === 4) {
            setupGrid.classList.add('hidden');
            document.querySelector('.setup-controls').classList.add('hidden');
            btnStartGame.classList.remove('hidden');
        }
    }
});

function renderSetupCategories() {
    setupCategoriesDiv.innerHTML = '';
    categories.forEach((cat, index) => {
        const div = document.createElement('div');
        div.className = `category-row cat-${index}`;
        div.innerHTML = `
            <div class="category-name">${cat.name}</div>
            <div class="category-words">${cat.words.join(', ')}</div>
        `;
        setupCategoriesDiv.appendChild(div);
    });
}

// --- TRANSITION ---

btnStartGame.addEventListener('click', () => {
    setupPhase.classList.remove('active');
    setupPhase.classList.add('hidden');
    
    playPhase.classList.remove('hidden');
    playPhase.classList.add('active');
    document.getElementById('subtitle').innerText = "Hand the device to Player 2!";
    
    // Prepare play state
    playWords = [...allWords].sort(() => 0.5 - Math.random());
    renderPlayGrid();
});

// --- PLAY PHASE ---

function renderPlayGrid() {
    playGrid.innerHTML = '';
    playWords.forEach(word => {
        const btn = document.createElement('button');
        btn.className = `tile ${playSelected.includes(word) ? 'selected' : ''}`;
        btn.innerText = word;
        btn.onclick = () => handlePlayClick(word);
        playGrid.appendChild(btn);
    });
    
    btnSubmit.disabled = playSelected.length !== 4;
}

function handlePlayClick(word) {
    if (playSelected.includes(word)) {
        playSelected = playSelected.filter(w => w !== word);
    } else {
        if (playSelected.length < 4) {
            playSelected.push(word);
        }
    }
    renderPlayGrid();
}

btnShuffle.addEventListener('click', () => {
    playWords.sort(() => 0.5 - Math.random());
    renderPlayGrid();
});

btnDeselect.addEventListener('click', () => {
    playSelected = [];
    renderPlayGrid();
});

btnSubmit.addEventListener('click', () => {
    if (playSelected.length !== 4) return;
    
    // Check if guess matches any category exactly
    let matchedCategory = null;
    let matchedIndex = -1;
    
    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        // Check if all selected words are in this category
        const isMatch = playSelected.every(w => cat.words.includes(w));
        if (isMatch) {
            matchedCategory = cat;
            matchedIndex = i;
            break;
        }
    }
    
    if (matchedCategory) {
        // Correct guess!
        solvedCategories.push({ ...matchedCategory, originalIndex: matchedIndex });
        
        // Remove words from play grid
        playWords = playWords.filter(w => !playSelected.includes(w));
        playSelected = [];
        
        renderPlayCategories();
        renderPlayGrid();
        
        if (solvedCategories.length === 4) {
            endGame(true);
        }
    } else {
        // Incorrect guess
        // Check if 3 words match (One away)
        let isOneAway = false;
        for (let i = 0; i < categories.length; i++) {
            const cat = categories[i];
            const overlap = playSelected.filter(w => cat.words.includes(w)).length;
            if (overlap === 3) {
                isOneAway = true;
                break;
            }
        }
        
        if (isOneAway) {
            showToast("One away!");
        } else {
            showToast("Incorrect.");
        }
        
        mistakes--;
        updateMistakes();
        
        if (mistakes === 0) {
            endGame(false);
        }
    }
});

function renderPlayCategories() {
    playCategoriesDiv.innerHTML = '';
    solvedCategories.forEach(cat => {
        const div = document.createElement('div');
        div.className = `category-row cat-${cat.originalIndex}`;
        div.innerHTML = `
            <div class="category-name">${cat.name}</div>
            <div class="category-words">${cat.words.join(', ')}</div>
        `;
        playCategoriesDiv.appendChild(div);
    });
}

function updateMistakes() {
    for (let i = 0; i < 4; i++) {
        if (i >= mistakes) {
            mistakesDots[3 - i].classList.add('lost');
        }
    }
}

function endGame(isWin) {
    document.querySelector('.play-controls').classList.add('hidden');
    playGrid.classList.add('hidden');
    
    gameOverMessage.classList.remove('hidden');
    if (isWin) {
        endTitle.innerText = "You Win! Perfect Connections!";
    } else {
        endTitle.innerText = "Game Over! Better luck next time.";
        // Reveal remaining categories
        const remainingCats = categories.map((c, i) => ({...c, originalIndex: i}))
            .filter(c => !solvedCategories.find(sc => sc.name === c.name));
        
        solvedCategories = [...solvedCategories, ...remainingCats];
        renderPlayCategories();
    }
}

btnRestart.addEventListener('click', () => {
    document.querySelector('.setup-controls').classList.remove('hidden');
    setupGrid.classList.remove('hidden');
    document.querySelector('.play-controls').classList.remove('hidden');
    playGrid.classList.remove('hidden');
    init();
});

function showToast(msg) {
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

// Start
init();