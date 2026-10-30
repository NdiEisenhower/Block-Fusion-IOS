// Game Engine
class GameEngine {
    constructor(worldId, levelNum) {
        this.worldId = worldId;
        this.levelNum = levelNum;
        this.goal = CONFIG.getLevelGoal(worldId, levelNum);
        this.targetMoves = CONFIG.getTargetMoves(worldId, levelNum);
        this.reward = CONFIG.getLevelReward(worldId, levelNum);
        this.board = Array.from({ length: 4 }, () => Array(4).fill(0));
        this.moves = 0;
        this.powerUpsUsed = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.undoStack = [];
        this.mergedThisMove = new Set();
        this.mergedTileMap = {};
        this.lastSpawnedPos = null;
        this.lastMergeCount = 0;
        
        console.log(`🎮 New Game: World ${worldId+1}, Level ${levelNum}`);
        console.log(`   Goal: ${this.goal}, Target Moves: ${this.targetMoves}, Reward: ${this.reward} coins`);
        
        this.spawnInitialTiles();
    }

    spawnInitialTiles() {
        const count = this.goal >= 2048 ? 4 : this.goal >= 512 ? 3 : 2;
        for (let i = 0; i < count; i++) {
            this.spawnTile();
        }
        
        if (this.goal >= 4096) this.placeHigherTile(128);
        if (this.goal >= 8192) this.placeHigherTile(256);
        if (this.goal >= 16384) this.placeHigherTile(512);
    }

    placeHigherTile(value) {
        const empty = this.getEmptyCells();
        if (empty.length > 0) {
            const [r, c] = empty[Math.floor(Math.random() * empty.length)];
            this.board[r][c] = value;
        }
    }

    getEmptyCells() {
        const cells = [];
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (this.board[r][c] === 0) cells.push([r, c]);
        return cells;
    }

    spawnTileAndGetPos() {
        const empty = this.getEmptyCells();
        if (empty.length === 0) return null;
        const [r, c] = empty[Math.floor(Math.random() * empty.length)];
        const val = Math.random() < 0.9 ? 2 : 4;
        this.board[r][c] = val;
        return { r, c };
    }

    spawnTile() {
        return !!this.spawnTileAndGetPos();
    }

    saveUndoState() {
        this.undoStack.push({
            board: this.board.map(row => [...row]),
            moves: this.moves,
            powerUpsUsed: this.powerUpsUsed,
        });
        if (this.undoStack.length > 10) this.undoStack.shift();
    }

    undo() {
        if (this.undoStack.length === 0) return false;
        const state = this.undoStack.pop();
        this.board = state.board;
        this.moves = state.moves;
        this.powerUpsUsed = state.powerUpsUsed;
        this.gameOver = false;
        this.gameWon = false;
        this.mergedThisMove.clear();
        this.mergedTileMap = {};
        return true;
    }

    shuffle() {
        const tiles = [];
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (this.board[r][c] > 0) tiles.push(this.board[r][c]);
        
        for (let i = tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }
        
        let idx = 0;
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++) {
                this.board[r][c] = idx < tiles.length ? tiles[idx++] : 0;
            }
        this.mergedThisMove.clear();
        this.mergedTileMap = {};
    }

    removeLowestTile() {
        let minVal = Infinity, minPos = null;
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (this.board[r][c] > 0 && this.board[r][c] < minVal) {
                    minVal = this.board[r][c];
                    minPos = [r, c];
                }
        if (minPos) {
            this.board[minPos[0]][minPos[1]] = 0;
            return true;
        }
        return false;
    }

    // SUPER SWAP - swap any two tiles
    swapTiles(r1, c1, r2, c2) {
        if (r1 === r2 && c1 === c2) return false;
        if (this.board[r1][c1] === 0 || this.board[r2][c2] === 0) return false;
        [this.board[r1][c1], this.board[r2][c2]] = [this.board[r2][c2], this.board[r1][c1]];
        this.mergedThisMove.clear();
        this.mergedTileMap = {};
        return true;
    }

    _slideLine(line) {
        const nonZeros = line.filter(v => v > 0);
        const result = [];
        const mergedIndices = [];
        let i = 0;
        while (i < nonZeros.length) {
            if (i + 1 < nonZeros.length && nonZeros[i] === nonZeros[i + 1]) {
                const mergedVal = nonZeros[i] * 2;
                result.push(mergedVal);
                mergedIndices.push(result.length - 1);
                i += 2;
            } else {
                result.push(nonZeros[i]);
                i++;
            }
        }
        while (result.length < 4) {
            result.push(0);
        }
        return { result, mergedIndices };
    }

    move(direction) {
        if (this.gameOver || this.gameWon) return false;

        this.saveUndoState();
        this.mergedThisMove.clear();
        this.mergedTileMap = {};
        this.lastSpawnedPos = null;
        this.lastMergeCount = 0;

        const newBoard = Array.from({ length: 4 }, () => Array(4).fill(0));

        if (direction === 'left') {
            for (let r = 0; r < 4; r++) {
                const line = [this.board[r][0], this.board[r][1], this.board[r][2], this.board[r][3]];
                const { result, mergedIndices } = this._slideLine(line);
                for (let c = 0; c < 4; c++) {
                    newBoard[r][c] = result[c];
                }
                mergedIndices.forEach(idx => {
                    this.mergedThisMove.add(`${r}-${idx}`);
                    this.mergedTileMap[`${r}-${idx}`] = result[idx];
                    this.lastMergeCount++;
                });
            }
        } else if (direction === 'right') {
            for (let r = 0; r < 4; r++) {
                const line = [this.board[r][3], this.board[r][2], this.board[r][1], this.board[r][0]];
                const { result, mergedIndices } = this._slideLine(line);
                for (let idx = 0; idx < 4; idx++) {
                    newBoard[r][3 - idx] = result[idx];
                }
                mergedIndices.forEach(idx => {
                    const c = 3 - idx;
                    this.mergedThisMove.add(`${r}-${c}`);
                    this.mergedTileMap[`${r}-${c}`] = result[idx];
                    this.lastMergeCount++;
                });
            }
        } else if (direction === 'up') {
            for (let c = 0; c < 4; c++) {
                const line = [this.board[0][c], this.board[1][c], this.board[2][c], this.board[3][c]];
                const { result, mergedIndices } = this._slideLine(line);
                for (let idx = 0; idx < 4; idx++) {
                    newBoard[idx][c] = result[idx];
                }
                mergedIndices.forEach(idx => {
                    const r = idx;
                    this.mergedThisMove.add(`${r}-${c}`);
                    this.mergedTileMap[`${r}-${c}`] = result[idx];
                    this.lastMergeCount++;
                });
            }
        } else if (direction === 'down') {
            for (let c = 0; c < 4; c++) {
                const line = [this.board[3][c], this.board[2][c], this.board[1][c], this.board[0][c]];
                const { result, mergedIndices } = this._slideLine(line);
                for (let idx = 0; idx < 4; idx++) {
                    newBoard[3 - idx][c] = result[idx];
                }
                mergedIndices.forEach(idx => {
                    const r = 3 - idx;
                    this.mergedThisMove.add(`${r}-${c}`);
                    this.mergedTileMap[`${r}-${c}`] = result[idx];
                    this.lastMergeCount++;
                });
            }
        } else {
            return false;
        }

        // Check if board state changed
        let moved = false;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.board[r][c] !== newBoard[r][c]) {
                    moved = true;
                    break;
                }
            }
            if (moved) break;
        }

        if (moved) {
            this.board = newBoard;
            this.moves++;
            this.lastSpawnedPos = this.spawnTileAndGetPos();
            this.checkWinLose();
        } else {
            this.undoStack.pop();
        }

        return moved;
    }

    _rotateBoard(board, times) {
        let b = board.map(r => [...r]);
        for (let t = 0; t < times; t++) {
            b = b[0].map((_, i) => b.map(row => row[i]).reverse());
        }
        return b;
    }

    checkWinLose() {
        // Check for goal tile
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.board[r][c] >= this.goal) {
                    this.gameWon = true;
                    console.log(`🏆 WIN! Tile ${this.board[r][c]} >= Goal ${this.goal}`);
                    
                    if (typeof App !== 'undefined' && App.state) {
                        if (this.board[r][c] > App.state.highestTileEver) {
                            App.state.highestTileEver = this.board[r][c];
                        }
                    }
                    return;
                }
            }
        }

        // Check if any moves possible
        if (this.getEmptyCells().length > 0) return;
        
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (c < 3 && this.board[r][c] === this.board[r][c + 1]) return;
                if (r < 3 && this.board[r][c] === this.board[r + 1][c]) return;
            }
        }
        
        this.gameOver = true;
        console.log('💀 GAME OVER - No moves left');
    }

    getStars() {
        if (!this.gameWon) return 0;
        if (this.powerUpsUsed === 0 && this.moves <= this.targetMoves) return 3;
        if (this.powerUpsUsed <= 1 && this.moves <= this.targetMoves * 1.5) return 2;
        return 1;
    }

    getBoardData() {
        return this.board.map(row => [...row]);
    }
}
