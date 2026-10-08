// WW1 RTS - MakeCode Arcade starter (paste into the JavaScript view of a new project)
// Controls: D-pad = move cursor | A = select unit / move order / train at your HQ | B = cycle unit to build
// Goal: destroy the enemy HQ.

namespace SpriteKind {
    export const Unit = SpriteKind.create()
    export const Base = SpriteKind.create()
}

// ---------- DATA ----------
const FACTIONS = ["UK", "France", "Germany", "Italy", "Austria", "Russia", "China", "Thailand"]
const FCOLORS = [8, 9, 15, 3, 10, 2, 4, 1]
const MAPS = ["Western Front (Europe)", "Eastern Front (Europe)", "Chinese Coast (Asia)", "Gulf of Siam (Asia)"]
const LAND = [7, 7, 13, 13]
// water rectangles per map: x, y, w, h
const WATER = [[0, 95, 160, 25], [0, 0, 160, 25], [0, 85, 160, 35], [50, 90, 60, 30]]

// unit types: 0 Troop, 1 Tank, 2 Plane, 3 U-boat
const NAMES = ["Troops", "Tank", "Plane", "U-boat"]
const COST = [20, 60, 80, 70]
const HP = [30, 100, 50, 80]
const SPD = [20, 14, 45, 22]
const RANGE = [30, 40, 35, 50]
const DMG = [4, 10, 6, 9]

// ---------- STATE ----------
let stage = 0 // 0 faction, 1 map, 2 playing
let fIdx = 0
let mIdx = 0
let pc = 0
let ec = 0
let money = 100
let emoney = 100
let build = 0
let cursor: Sprite = null
let sel: Sprite = null
let pBase: Sprite = null
let eBase: Sprite = null
let water = [0, 0, 0, 0]

// ---------- DATA HELPERS (replace the sprite-data extension) ----------
function setNum(s: Sprite, key: string, v: number) {
    s.data[key] = v
}
function getNum(s: Sprite, key: string): number {
    return s.data[key]
}

// ---------- MENU ----------
function drawMenu() {
    let b = image.create(160, 120)
    b.fill(15)
    if (stage == 0) {
        b.print("WW1 RTS - Pick faction", 4, 4, 1)
        for (let i = 0; i < FACTIONS.length; i++) {
            b.print((i == fIdx ? "> " : "  ") + FACTIONS[i], 10, 18 + i * 10, i == fIdx ? 5 : 1)
        }
    } else {
        b.print("Pick map", 4, 4, 1)
        for (let i = 0; i < MAPS.length; i++) {
            b.print((i == mIdx ? "> " : "  ") + MAPS[i], 6, 20 + i * 12, i == mIdx ? 5 : 1)
        }
    }
    scene.setBackgroundImage(b)
}

controller.up.onEvent(ControllerButtonEvent.Pressed, function () {
    if (stage == 0) fIdx = (fIdx + FACTIONS.length - 1) % FACTIONS.length
    else if (stage == 1) mIdx = (mIdx + MAPS.length - 1) % MAPS.length
    if (stage < 2) drawMenu()
})
controller.down.onEvent(ControllerButtonEvent.Pressed, function () {
    if (stage == 0) fIdx = (fIdx + 1) % FACTIONS.length
    else if (stage == 1) mIdx = (mIdx + 1) % MAPS.length
    if (stage < 2) drawMenu()
})

// ---------- IMAGES ----------
function makeImg(t: number, c: number): Image {
    let i = image.create(10, 10)
    if (t == 0) { // troops
        i.fillRect(3, 3, 4, 7, c)
        i.fillRect(4, 0, 2, 3, 1)
    } else if (t == 1) { // tank
        i.fillRect(0, 4, 10, 5, c)
        i.fillRect(3, 1, 4, 3, c)
        i.drawLine(6, 2, 9, 2, 15)
    } else if (t == 2) { // plane
        i.fillRect(4, 0, 2, 10, c)
        i.fillRect(0, 4, 10, 2, c)
        i.fillRect(3, 8, 4, 2, c)
    } else { // u-boat
        i.fillRect(0, 5, 10, 3, c)
        i.fillRect(4, 2, 2, 3, c)
        i.drawLine(5, 0, 5, 2, 15)
    }
    return i
}

function makeBase(team: number, x: number, y: number, c: number): Sprite {
    let i = image.create(16, 16)
    i.fill(c)
    i.drawRect(0, 0, 16, 16, 15)
    i.fillRect(7, 2, 2, 12, 1)
    let s = sprites.create(i, SpriteKind.Base)
    s.setPosition(x, y)
    setNum(s, "team", team)
    setNum(s, "hp", 300)
    return s
}

// ---------- RULES ----------
function inWater(x: number, y: number): boolean {
    return x >= water[0] && x <= water[0] + water[2] && y >= water[1] && y <= water[1] + water[3]
}

function canGo(t: number, x: number, y: number): boolean {
    if (t == 2) return true
    if (t == 3) return inWater(x, y)
    return !inWater(x, y)
}

function spawn(team: number, t: number): Sprite {
    let x = team == 0 ? 32 : 128
    let y = 55 + randint(-12, 12)
    if (t == 3) {
        x = team == 0 ? 24 : 136
        y = water[1] + water[3] / 2
    }
    let s = sprites.create(makeImg(t, team == 0 ? pc : ec), SpriteKind.Unit)
    s.setPosition(x, y)
    setNum(s, "team", team)
    setNum(s, "type", t)
    setNum(s, "hp", HP[t])
    setNum(s, "tx", x)
    setNum(s, "ty", y)
    return s
}

function hit(target: Sprite, d: number) {
    let hp = getNum(target, "hp") - d
    setNum(target, "hp", hp)
    target.startEffect(effects.spray, 100)
    if (hp <= 0) {
        if (target.kind() == SpriteKind.Base) {
            game.over(target == eBase)
        } else {
            if (target == sel) sel = null
            target.destroy(effects.fire, 200)
        }
    }
}

function updateLabel() {
    cursor.sayText(NAMES[build] + " $" + COST[build])
}

function train() {
    if (money < COST[build]) {
        pBase.sayText("Need $" + COST[build], 1000)
        return
    }
    money -= COST[build]
    info.setScore(money)
    spawn(0, build)
}

function selectUnit(u: Sprite) {
    if (sel) sel.sayText("")
    sel = u
    sel.sayText("v")
}

// ---------- START ----------
function startGame() {
    stage = 2
    pc = FCOLORS[fIdx]
    let e = randint(0, FACTIONS.length - 1)
    while (e == fIdx) e = randint(0, FACTIONS.length - 1)
    ec = FCOLORS[e]
    water = WATER[mIdx]
    let bg = image.create(160, 120)
    bg.fill(LAND[mIdx])
    bg.fillRect(water[0], water[1], water[2], water[3], 8)
    scene.setBackgroundImage(bg)
    pBase = makeBase(0, 16, 55, pc)
    eBase = makeBase(1, 144, 55, ec)
    let c = image.create(7, 7)
    c.drawLine(3, 0, 3, 6, 1)
    c.drawLine(0, 3, 6, 3, 1)
    cursor = sprites.create(c, SpriteKind.Player)
    cursor.z = 100
    cursor.setPosition(80, 60)
    cursor.setStayInScreen(true)
    controller.moveSprite(cursor, 70, 70)
    info.setScore(money)
    updateLabel()
    game.splash("You: " + FACTIONS[fIdx], "Enemy: " + FACTIONS[e])
}

// ---------- INPUT ----------
controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    if (stage == 0) {
        stage = 1
        drawMenu()
        return
    }
    if (stage == 1) {
        startGame()
        return
    }
    if (cursor.overlapsWith(pBase)) {
        train()
        return
    }
    for (let u of sprites.allOfKind(SpriteKind.Unit)) {
        if (getNum(u, "team") == 0 && cursor.overlapsWith(u)) {
            selectUnit(u)
            return
        }
    }
    if (sel) {
        let t = getNum(sel, "type")
        if (canGo(t, cursor.x, cursor.y)) {
            setNum(sel, "tx", cursor.x)
            setNum(sel, "ty", cursor.y)
        } else {
            cursor.sayText("Can't go there", 700)
        }
    }
})

controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    if (stage != 2) return
    build = (build + 1) % NAMES.length
    updateLabel()
})

// ---------- LOOPS ----------
game.onUpdate(function () {
    if (stage != 2) return
    for (let s of sprites.allOfKind(SpriteKind.Unit)) {
        let t = getNum(s, "type")
        let dx = getNum(s, "tx") - s.x
        let dy = getNum(s, "ty") - s.y
        let d = Math.sqrt(dx * dx + dy * dy)
        if (d < 2) {
            s.vx = 0
            s.vy = 0
        } else {
            s.vx = dx / d * SPD[t]
            s.vy = dy / d * SPD[t]
        }
    }
})

// income
game.onUpdateInterval(1000, function () {
    if (stage != 2) return
    money += 8
    emoney += 8
    info.setScore(money)
})

// combat: every unit hits the nearest enemy in range
game.onUpdateInterval(700, function () {
    if (stage != 2) return
    let all = sprites.allOfKind(SpriteKind.Unit).concat(sprites.allOfKind(SpriteKind.Base))
    for (let a of sprites.allOfKind(SpriteKind.Unit)) {
        if (getNum(a, "hp") <= 0) continue
        let t = getNum(a, "type")
        let team = getNum(a, "team")
        let best: Sprite = null
        let bd = RANGE[t] + 1
        for (let b of all) {
            if (getNum(b, "team") != team && getNum(b, "hp") > 0) {
                let dx = a.x - b.x
                let dy = a.y - b.y
                let d = Math.sqrt(dx * dx + dy * dy)
                if (d < bd) {
                    bd = d
                    best = b
                }
            }
        }
        if (best) hit(best, DMG[t])
    }
})

// very simple enemy AI: buy a random unit and send it at your HQ
game.onUpdateInterval(4000, function () {
    if (stage != 2) return
    let t = randint(0, 3)
    if (emoney < COST[t]) return
    emoney -= COST[t]
    let s = spawn(1, t)
    if (t == 3) {
        setNum(s, "tx", 30)
        setNum(s, "ty", water[1] + water[3] / 2)
    } else {
        setNum(s, "tx", pBase.x + 12)
        setNum(s, "ty", pBase.y)
    }
})

drawMenu() 