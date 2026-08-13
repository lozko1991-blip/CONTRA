class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return null;

    const top = this.items[0];
    const last = this.items.pop();

    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return top;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = (index - 1) >> 1;

      if (this.items[parent].f <= this.items[index].f) {
        break;
      }

      [this.items[parent], this.items[index]] =
        [this.items[index], this.items[parent]];

      index = parent;
    }
  }

  bubbleDown(index) {
    const length = this.items.length;

    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;

      let best = index;

      if (left < length && this.items[left].f < this.items[best].f) {
        best = left;
      }

      if (right < length && this.items[right].f < this.items[best].f) {
        best = right;
      }

      if (best === index) {
        break;
      }

      [this.items[best], this.items[index]] =
        [this.items[index], this.items[best]];

      index = best;
    }
  }
}

/**
 * GridNavMesh — спрощений навмеш на основі сітки.
 *
 * Працює як 2D navigation grid:
 * - клітини можуть бути walkable / blocked;
 * - A* шукає шлях;
 * - перешкоди додаються як AABB-блоки.
 */
export class GridNavMesh {
  constructor({
    minX = -40,
    maxX = 40,
    minZ = -40,
    maxZ = 40,
    cellSize = 1
  } = {}) {
    this.minX = minX;
    this.maxX = maxX;
    this.minZ = minZ;
    this.maxZ = maxZ;
    this.cellSize = cellSize;

    this.cols = Math.max(1, Math.ceil((maxX - minX) / cellSize));
    this.rows = Math.max(1, Math.ceil((maxZ - minZ) / cellSize));

    this.walkable = new Uint8Array(this.cols * this.rows).fill(1);
  }

  index(cx, cz) {
    return cz * this.cols + cx;
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  worldToCell(x, z) {
    let cx = Math.floor((x - this.minX) / this.cellSize);
    let cz = Math.floor((z - this.minZ) / this.cellSize);

    cx = this.clamp(cx, 0, this.cols - 1);
    cz = this.clamp(cz, 0, this.rows - 1);

    return { cx, cz };
  }

  cellToWorld(cx, cz) {
    return {
      x: this.minX + (cx + 0.5) * this.cellSize,
      y: 0,
      z: this.minZ + (cz + 0.5) * this.cellSize
    };
  }

  isWalkableCell(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) {
      return false;
    }

    return this.walkable[this.index(cx, cz)] === 1;
  }

  isWalkableWorld(x, z) {
    const { cx, cz } = this.worldToCell(x, z);
    return this.isWalkableCell(cx, cz);
  }

  setBlocked(cx, cz, blocked = true) {
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) {
      return;
    }

    this.walkable[this.index(cx, cz)] = blocked ? 0 : 1;
  }

  addBoxFromCenter(position, size, inflate = 0.4) {
    const px = Array.isArray(position) ? position[0] : position.x;
    const pz = Array.isArray(position) ? position[2] : position.z;

    const sx = Array.isArray(size) ? size[0] : size.x;
    const sz = Array.isArray(size) ? size[2] : size.z;

    const minX = px - sx * 0.5 - inflate;
    const maxX = px + sx * 0.5 + inflate;
    const minZ = pz - sz * 0.5 - inflate;
    const maxZ = pz + sz * 0.5 + inflate;

    const a = this.worldToCell(minX, minZ);
    const b = this.worldToCell(maxX, maxZ);

    for (let cz = a.cz; cz <= b.cz; cz++) {
      for (let cx = a.cx; cx <= b.cx; cx++) {
        this.setBlocked(cx, cz, true);
      }
    }
  }

  findNearestWalkable(x, z, maxRadius = 10) {
    const start = this.worldToCell(x, z);

    if (this.isWalkableCell(start.cx, start.cz)) {
      return this.cellToWorld(start.cx, start.cz);
    }

    const maxCells = Math.ceil(maxRadius / this.cellSize);

    for (let r = 1; r <= maxCells; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) {
            continue;
          }

          const cx = start.cx + dx;
          const cz = start.cz + dz;

          if (this.isWalkableCell(cx, cz)) {
            return this.cellToWorld(cx, cz);
          }
        }
      }
    }

    return null;
  }

  heuristic(ax, az, bx, bz) {
    const dx = Math.abs(ax - bx);
    const dz = Math.abs(az - bz);

    const D = 1;
    const D2 = Math.SQRT2;

    return D * (dx + dz) + (D2 - 2 * D) * Math.min(dx, dz);
  }

  findPath(start, goal) {
    const nearestStart = this.findNearestWalkable(start.x, start.z, 8);
    const nearestGoal = this.findNearestWalkable(goal.x, goal.z, 8);

    if (!nearestStart || !nearestGoal) {
      return [];
    }

    const startCell = this.worldToCell(nearestStart.x, nearestStart.z);
    const goalCell = this.worldToCell(nearestGoal.x, nearestGoal.z);

    const startIndex = this.index(startCell.cx, startCell.cz);
    const goalIndex = this.index(goalCell.cx, goalCell.cz);

    if (startIndex === goalIndex) {
      return [nearestGoal];
    }

    const total = this.cols * this.rows;

    const gScore = new Float32Array(total).fill(Infinity);
    const fScore = new Float32Array(total).fill(Infinity);
    const cameFrom = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);

    const open = new MinHeap();

    gScore[startIndex] = 0;
    fScore[startIndex] = this.heuristic(
      startCell.cx,
      startCell.cz,
      goalCell.cx,
      goalCell.cz
    );

    open.push({
      index: startIndex,
      f: fScore[startIndex]
    });

    const directions = [
      { dx: 1, dz: 0, cost: 1 },
      { dx: -1, dz: 0, cost: 1 },
      { dx: 0, dz: 1, cost: 1 },
      { dx: 0, dz: -1, cost: 1 },
      { dx: 1, dz: 1, cost: Math.SQRT2 },
      { dx: 1, dz: -1, cost: Math.SQRT2 },
      { dx: -1, dz: 1, cost: Math.SQRT2 },
      { dx: -1, dz: -1, cost: Math.SQRT2 }
    ];

    while (open.size > 0) {
      const current = open.pop();

      if (!current) break;

      if (closed[current.index]) {
        continue;
      }

      if (current.index === goalIndex) {
        break;
      }

      closed[current.index] = 1;

      const cx = current.index % this.cols;
      const cz = Math.floor(current.index / this.cols);

      for (const dir of directions) {
        const nx = cx + dir.dx;
        const nz = cz + dir.dz;

        if (!this.isWalkableCell(nx, nz)) {
          continue;
        }

        /**
         * Не ріжемо кути по діагоналі.
         */
        if (dir.dx !== 0 && dir.dz !== 0) {
          if (
            !this.isWalkableCell(cx + dir.dx, cz) ||
            !this.isWalkableCell(cx, cz + dir.dz)
          ) {
            continue;
          }
        }

        const neighborIndex = this.index(nx, nz);

        if (closed[neighborIndex]) {
          continue;
        }

        const tentativeG = gScore[current.index] + dir.cost;

        if (tentativeG < gScore[neighborIndex]) {
          cameFrom[neighborIndex] = current.index;
          gScore[neighborIndex] = tentativeG;

          fScore[neighborIndex] =
            tentativeG +
            this.heuristic(nx, nz, goalCell.cx, goalCell.cz);

          open.push({
            index: neighborIndex,
            f: fScore[neighborIndex]
          });
        }
      }
    }

    if (cameFrom[goalIndex] === -1) {
      return [];
    }

    const path = [];

    let current = goalIndex;

    while (current !== -1) {
      const cx = current % this.cols;
      const cz = Math.floor(current / this.cols);

      path.push(this.cellToWorld(cx, cz));

      current = cameFrom[current];
    }

    path.reverse();

    return path;
  }
}
