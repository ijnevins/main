// State
let totalScore = 0;
let dicePool = [];
let currentEquation = [];
let highScores = JSON.parse(localStorage.getItem('mathDiceHighScores')) || [];

// DOM
const scoreDisplay = document.getElementById('score');
const dicePoolContainer = document.getElementById('dice-pool');
const equationDisplay = document.getElementById('equation-display');
const btnRoll = document.getElementById('btn-roll');
const btnClear = document.getElementById('btn-clear');
const btnSubmit = document.getElementById('btn-submit');
const btnEndGame = document.getElementById('btn-end-game');
const messageBox = document.getElementById('message');
const leaderboardList = document.getElementById('leaderboard-list');

function generateDice() {
    const newDice = [];
    let idCounter = 0;
    
    // 7 Number Dice (0-9)
    for (let i = 0; i < 7; i++) {
        newDice.push({
            id: idCounter++,
            type: 'number',
            value: Math.floor(Math.random() * 10).toString()
        });
    }
    
    // 3 Operator Dice (+, -, ×, ÷)
    const ops = ['+', '-', '×', '÷'];
    for (let i = 0; i < 3; i++) {
        newDice.push({
            id: idCounter++,
            type: 'operator',
            value: ops[Math.floor(Math.random() * ops.length)]
        });
    }
    
    // 1 Equals Die (=)
    newDice.push({
        id: idCounter++,
        type: 'equals',
        value: '='
    });
    
    // Shuffle
    return newDice.sort(() => Math.random() - 0.5);
}

let initialDicePool = [];

function rollDice() {
    dicePool = generateDice();
    initialDicePool = [...dicePool];
    currentEquation = [];
    hideMessage();
    btnSubmit.disabled = false;
    
    render(true);
}

function render(isRolling = false) {
    scoreDisplay.innerText = totalScore;
    
    // Render Pool
    dicePoolContainer.innerHTML = '';
    dicePool.forEach(die => {
        const btn = createDiceElement(die);
        if (isRolling) btn.classList.add('rolling');
        dicePoolContainer.appendChild(btn);
    });
    
    // Render Equation
    equationDisplay.innerHTML = '';
    if (currentEquation.length === 0) {
        equationDisplay.innerHTML = '<div class="placeholder">Click or drag dice to build equation...</div>';
    } else {
        currentEquation.forEach(die => {
            const btn = createDiceElement(die);
            equationDisplay.appendChild(btn);
        });
    }
}

function createDiceElement(die) {
    const btn = document.createElement('button');
    btn.className = `dice ${die.type}`;
    btn.innerText = die.value;
    btn.dataset.id = die.id;
    btn.draggable = true;
    
    // Click to move
    btn.onclick = () => {
        if (dicePool.find(d => d.id === die.id)) moveToEquation(die);
        else moveToPool(die);
    };

    // Drag events
    btn.addEventListener('dragstart', () => {
        btn.classList.add('dragging');
    });

    btn.addEventListener('dragend', () => {
        btn.classList.remove('dragging');
        updateStateFromDOM();
    });

    return btn;
}

function moveToEquation(die) {
    dicePool = dicePool.filter(d => d.id !== die.id);
    currentEquation.push(die);
    hideMessage();
    render();
}

function moveToPool(die) {
    currentEquation = currentEquation.filter(d => d.id !== die.id);
    dicePool.push(die);
    hideMessage();
    render();
}

btnClear.addEventListener('click', () => {
    if (currentEquation.length === 0) return;
    dicePool = [...dicePool, ...currentEquation];
    currentEquation = [];
    hideMessage();
    render();
});

btnRoll.addEventListener('click', () => {
    rollDice();
});

function evaluateSide(diceArray) {
    if (diceArray.length === 0) return null;
    
    let tokens = [];
    let currentNum = '';
    
    for (let d of diceArray) {
        if (d.type === 'number') {
            currentNum += d.value;
        } else {
            if (currentNum !== '') {
                // Reject leading zeros
                if (currentNum.length > 1 && currentNum.startsWith('0')) {
                    return 'LEADING_ZERO';
                }
                tokens.push(currentNum);
                currentNum = '';
            }
            let op = d.value;
            if (op === '×') op = '*';
            if (op === '÷') op = '/';
            tokens.push(op);
        }
    }
    if (currentNum !== '') {
        if (currentNum.length > 1 && currentNum.startsWith('0')) {
            return 'LEADING_ZERO';
        }
        tokens.push(currentNum);
    }
    
    let evalStr = tokens.join(' ');
    if (evalStr.trim() === '') return null;
    
    try {
        let result = new Function(`return ${evalStr}`)();
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) return null;
        return result;
    } catch (e) {
        return null;
    }
}

btnSubmit.addEventListener('click', () => {
    if (currentEquation.length === 0) {
        showMessage("Equation is empty!", "error");
        return;
    }
    
    // 1. Check for exactly one '='
    const equalsDice = currentEquation.filter(d => d.type === 'equals');
    if (equalsDice.length !== 1) {
        showMessage("Equation must have exactly one '=' sign!", "error");
        return;
    }
    
    // 2. Split left and right
    const equalsIndex = currentEquation.findIndex(d => d.type === 'equals');
    const leftSide = currentEquation.slice(0, equalsIndex);
    const rightSide = currentEquation.slice(equalsIndex + 1);
    
    if (leftSide.length === 0 || rightSide.length === 0) {
        showMessage("Both sides of the '=' must have numbers!", "error");
        return;
    }
    
    // 3. Evaluate both sides
    const leftResult = evaluateSide(leftSide);
    const rightResult = evaluateSide(rightSide);
    
    if (leftResult === 'LEADING_ZERO' || rightResult === 'LEADING_ZERO') {
        showMessage("Numbers cannot have leading zeros!", "error");
        return;
    }
    
    if (leftResult === null || rightResult === null) {
        showMessage("Invalid math expression!", "error");
        return;
    }
    
    // Disallow fractions/decimals
    if (!Number.isInteger(leftResult) || !Number.isInteger(rightResult)) {
        showMessage("Decimals and fractions are not allowed!", "error");
        return;
    }
    
    // 4. Compare
    // Handle floating point precision
    if (Math.abs(leftResult - rightResult) < 0.0001) {
        // Custom scoring curve that scales up nicely but isn't too extreme
        const scoreTable = {
            3: 10,
            4: 20,
            5: 30,
            6: 40,
            7: 60,
            8: 80,
            9: 100,
            10: 120,
            11: 150
        };
        const points = scoreTable[currentEquation.length] || 0;
        
        totalScore += points;
        showMessage(`Valid Equation! +${points} points.\nFinding longest possible...`, "success");
        btnSubmit.disabled = true;
        render();
        
        // Find longest asynchronously so we don't freeze the UI
        setTimeout(() => {
            let digits = initialDicePool.filter(d => d.type === 'number').map(d => d.value);
            let ops = initialDicePool.filter(d => d.type === 'operator').map(d => d.value);
            let longest = findLongestEquation(digits, ops);
            
            if (longest) {
                longest = longest.replace(/\*/g, '×').replace(/\//g, '÷');
                let msg = `Valid Equation! +${points} points.`;
                if (longest.length > currentEquation.length) {
                    msg += `\n(You could have made: ${longest})`;
                } else {
                    msg += `\n(You found the longest one!)`;
                }
                showMessage(msg, "success");
            }
        }, 50);
    } else {
        showMessage(`Incorrect: ${leftResult} ≠ ${rightResult}`, "error");
    }
});

// Solver logic
function findLongestEquation(digits, ops) {
    let opMap = {'+':'+', '-':'-', '×':'*', '÷':'/'};
    let normOps = ops.map(o => opMap[o] || o);
    
    digits = [...digits].sort();
    normOps = [...normOps].sort();
    
    // Search from max possible length down to 3
    for (let targetLen = digits.length + normOps.length + 1; targetLen >= 3; targetLen--) {
        let result = null;
        
        function backtrack(eq, usedDigitsMask, usedOpsMask, hasEquals, lastCharType) {
            if (result) return;
            
            if (eq.length === targetLen) {
                if (hasEquals && lastCharType === 1) {
                    let parts = eq.split('=');
                    if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
                        let left = evalExpr(parts[0]);
                        let right = evalExpr(parts[1]);
                        if (left !== null && right !== null && Number.isInteger(left) && Number.isInteger(right) && Math.abs(left - right) < 0.0001) {
                            result = eq;
                        }
                    }
                }
                return;
            }
            
            // Try adding a digit
            for (let i = 0; i < digits.length; i++) {
                if (!(usedDigitsMask & (1 << i))) {
                    // Skip identical digits to avoid redundant branches
                    if (i > 0 && digits[i] === digits[i-1] && !(usedDigitsMask & (1 << (i-1)))) continue;
                    backtrack(eq + digits[i], usedDigitsMask | (1 << i), usedOpsMask, hasEquals, 1);
                }
            }
            
            // Try adding an operator or equals
            if (lastCharType === 1) {
                for (let i = 0; i < normOps.length; i++) {
                    if (!(usedOpsMask & (1 << i))) {
                        // Skip identical operators
                        if (i > 0 && normOps[i] === normOps[i-1] && !(usedOpsMask & (1 << (i-1)))) continue;
                        backtrack(eq + normOps[i], usedDigitsMask, usedOpsMask | (1 << i), hasEquals, 0);
                    }
                }
                
                if (!hasEquals) {
                    backtrack(eq + '=', usedDigitsMask, usedOpsMask, true, 0);
                }
            }
        }
        
        backtrack("", 0, 0, false, 0);
        if (result) return result;
    }
    return null;
}

function evalExpr(str) {
    let tokens = [];
    let num = "";
    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (char === '+' || char === '-' || char === '*' || char === '/') {
            if (num.length > 1 && num.startsWith('0')) return null;
            tokens.push(Number(num));
            tokens.push(char);
            num = "";
        } else {
            num += char;
        }
    }
    if (num.length > 1 && num.startsWith('0')) return null;
    tokens.push(Number(num));
    
    let stack = [tokens[0]];
    for (let i = 1; i < tokens.length; i += 2) {
        let op = tokens[i];
        let nextNum = tokens[i+1];
        if (op === '*') {
            stack.push(stack.pop() * nextNum);
        } else if (op === '/') {
            if (nextNum === 0) return null;
            stack.push(stack.pop() / nextNum);
        } else {
            stack.push(op);
            stack.push(nextNum);
        }
    }
    
    let res = stack[0];
    for (let i = 1; i < stack.length; i += 2) {
        let op = stack[i];
        let nextNum = stack[i+1];
        if (op === '+') res += nextNum;
        else if (op === '-') res -= nextNum;
    }
    return res;
}

function showMessage(msg, type) {
    messageBox.innerText = msg;
    messageBox.className = `message ${type}`;
    messageBox.classList.remove('hidden');
}

function hideMessage() {
    messageBox.classList.add('hidden');
}

function renderLeaderboard() {
    leaderboardList.innerHTML = '';
    if (highScores.length === 0) {
        leaderboardList.innerHTML = '<li><span style="color: #888; text-align: center; width: 100%;">No scores yet. Play a game!</span></li>';
        return;
    }
    
    highScores.forEach(scoreObj => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="score-name">${scoreObj.name}</span>
            <span class="score-val">${scoreObj.score} pts</span>
            <span class="score-date">${scoreObj.date}</span>
        `;
        leaderboardList.appendChild(li);
    });
}

btnEndGame.addEventListener('click', () => {
    if (totalScore === 0) {
        showMessage("You need more than 0 points to save a score!", "error");
        return;
    }
    
    const playerName = prompt("Game Over! Enter your initials (max 3 letters):", "AAA");
    if (playerName) {
        const name = playerName.substring(0, 3).toUpperCase() || "???";
        const newScore = {
            name: name,
            score: totalScore,
            date: new Date().toLocaleDateString()
        };
        
        highScores.push(newScore);
        highScores.sort((a, b) => b.score - a.score);
        highScores = highScores.slice(0, 10); // Keep top 10
        
        localStorage.setItem('mathDiceHighScores', JSON.stringify(highScores));
        
        totalScore = 0;
        rollDice(); // Resets everything and renders
        renderLeaderboard();
        showMessage("Score saved!", "success");
    }
});

// Start game
setupDropZones();
rollDice();
renderLeaderboard();

// --- Drag and Drop Logic ---

function setupDropZones() {
    const zones = [dicePoolContainer, equationDisplay];
    
    zones.forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault(); // Allow dropping
            
            const draggable = document.querySelector('.dragging');
            if (!draggable) return;
            
            // Remove placeholder if dragging into empty equation display
            const placeholder = zone.querySelector('.placeholder');
            if (placeholder) placeholder.remove();
            
            const afterElement = getDragAfterElement(zone, e.clientX, e.clientY);
            
            if (afterElement == null) {
                zone.appendChild(draggable);
            } else {
                zone.insertBefore(draggable, afterElement);
            }
        });
    });
}

function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.dice:not(.dragging)')];
    
    for (let child of draggableElements) {
        const box = child.getBoundingClientRect();
        // Check if cursor is before this element in reading order
        const isBefore = (y >= box.top && y <= box.bottom && x < box.left + box.width / 2) || (y < box.top);
        if (isBefore) {
            return child;
        }
    }
    return null;
}

function updateStateFromDOM() {
    const allCurrentDice = [...dicePool, ...currentEquation];
    
    const newPoolIds = [...dicePoolContainer.querySelectorAll('.dice')].map(el => parseInt(el.dataset.id));
    const newEqIds = [...equationDisplay.querySelectorAll('.dice')].map(el => parseInt(el.dataset.id));
    
    dicePool = newPoolIds.map(id => allCurrentDice.find(d => d.id === id)).filter(Boolean);
    currentEquation = newEqIds.map(id => allCurrentDice.find(d => d.id === id)).filter(Boolean);
    
    hideMessage();
    render();
}