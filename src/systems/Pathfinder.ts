import { Waypoint } from '../entities/Coworker';
import { Furniture } from '../entities/Furniture';
import { GAME_WIDTH, GAME_HEIGHT, OFFICE_Y_TOP } from '../config';
const CELL_SIZE = 30;
const COLS = Math.ceil(GAME_WIDTH / CELL_SIZE);
const ROWS = Math.ceil(GAME_HEIGHT / CELL_SIZE);

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

export class Pathfinder {
  private grid: boolean[][] = []; // true if blocked

  constructor(furniture: Furniture[], tempFurniture?: { x: number, y: number, radius: number }) {
    this.buildGrid(furniture, tempFurniture);
  }

  private buildGrid(furniture: Furniture[], tempFurniture?: { x: number, y: number, radius: number }) {
    this.grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
    
    // Add extra padding to furniture radius so enemies don't clip too hard
    const PADDING = 18; 

    const markSolid = (x: number, y: number, r: number) => {
      const radius = r + PADDING;
      const minC = Math.max(0, Math.floor((x - radius) / CELL_SIZE));
      const maxC = Math.min(COLS - 1, Math.floor((x + radius) / CELL_SIZE));
      const minR = Math.max(0, Math.floor((y - radius) / CELL_SIZE));
      const maxR = Math.min(ROWS - 1, Math.floor((y + radius) / CELL_SIZE));

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const cx = c * CELL_SIZE + CELL_SIZE / 2;
          const cy = r * CELL_SIZE + CELL_SIZE / 2;
          if (Math.hypot(cx - x, cy - y) <= radius) {
            this.grid[r][c] = true;
          }
        }
      }
    };

    for (const f of furniture) {
      markSolid(f.x, f.y, f.radius);
    }
    if (tempFurniture) {
      markSolid(tempFurniture.x, tempFurniture.y, tempFurniture.radius);
    }
  }

  public findPath(startX: number, startY: number, targetX: number, targetY: number): Waypoint[] | null {
    const startC = Math.floor(startX / CELL_SIZE);
    const startR = Math.floor(startY / CELL_SIZE);
    const targetC = Math.floor(targetX / CELL_SIZE);
    const targetR = Math.floor(targetY / CELL_SIZE);

    if (startC < 0 || startC >= COLS || startR < 0 || startR >= ROWS || 
        targetC < 0 || targetC >= COLS || targetR < 0 || targetR >= ROWS) {
      return null;
    }

    const openList: Node[] = [];
    const closedList: boolean[][] = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
    
    openList.push({ x: startC, y: startR, g: 0, h: 0, f: 0, parent: null });

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;
      
      if (current.x === targetC && current.y === targetR) {
        return this.reconstructPath(current, targetX, targetY);
      }

      closedList[current.y][current.x] = true;

      const neighbors = [
        { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
      ];

      for (const offset of neighbors) {
        const nx = current.x + offset.x;
        const ny = current.y + offset.y;

        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        if (closedList[ny][nx] || this.grid[ny][nx]) continue;

        // Prevent diagonal movement through tight corners
        if (offset.x !== 0 && offset.y !== 0) {
          if (this.grid[current.y][nx] || this.grid[ny][current.x]) continue;
        }

        const g = current.g + (offset.x === 0 || offset.y === 0 ? 10 : 14);
        const h = (Math.abs(nx - targetC) + Math.abs(ny - targetR)) * 10;
        
        let existing = openList.find(n => n.x === nx && n.y === ny);
        if (!existing) {
          openList.push({ x: nx, y: ny, g, h, f: g + h, parent: current });
        } else if (g < existing.g) {
          existing.g = g;
          existing.f = g + existing.h;
          existing.parent = current;
        }
      }
    }
    
    return null; // No path found
  }

  private reconstructPath(node: Node, targetX: number, targetY: number): Waypoint[] {
    const path: Waypoint[] = [];
    let curr: Node | null = node;
    while (curr) {
      path.push({
        x: curr.x * CELL_SIZE + CELL_SIZE / 2,
        y: Math.max(OFFICE_Y_TOP, curr.y * CELL_SIZE + CELL_SIZE / 2)
      });
      curr = curr.parent;
    }
    path.reverse();
    // Replace the very last point with the exact target
    path[path.length - 1] = { x: targetX, y: targetY };
    return path;
  }
}
