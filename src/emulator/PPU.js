import Frame from './Frame';

export default class PPU {
    constructor(nes) {
        this.nes = nes;

        this.cycle = 0;
        this.scanline = 0;
        this.frameCounter = 0;

        this.paletteData = new Array(32);
        this.nameTableData = new Array(2048);
        this.oamData = new Array(256);
        this.front = new Frame();
        this.back = new Frame();


        // PPU registers
        this.v = 0 // current vram address (15 bit)
        this.t = 0 // temporary vram address (15 bit)
        this.x = 0   // fine x scroll (3 bit)
        this.w = 0   // write toggle (1 bit)
        this.f = 0   // even/odd frame flag (1 bit)

        // $4000-$FFFF is a copy of $0000-$3FFF

        // background temporary variables
        this.nameTableByte = 0
        this.attributeTableByte = 0
        this.lowTileByte = 0
        this.highTileByte = 0
        this.tileData = 0

        // sprite temporary variables
        this.spriteCount = 0
        this.spritePatterns = new Array(8)
        this.spritePositions = new Array(8)
        this.spritePriorities = new Array(8)
        this.spriteIndexes = new Array(8)

        // $2000 PPUCTRL
        this.flagNameTable = 0 // 0: $2000; 1: $2400; 2: $2800; 3: $2C00
        this.flagIncrement = 0 // 0: add 1; 1: add 32
        this.flagSpriteTable = 0 // 0: $0000; 1: $1000; ignored in 8x16 mode
        this.flagBackgroundTable = 0 // 0: $0000; 1: $1000
        this.flagSpriteSize = 0 // 0: 8x8; 1: 8x16
        this.flagMasterSlave = 0 // 0: read EXT; 1: write EXT

        // $2001 PPUMASK
        this.flagGrayscale = 0 // 0: color; 1: grayscale
        this.flagShowLeftBackground = 0 // 0: hide; 1: show
        this.flagShowLeftSprites = 0 // 0: hide; 1: show
        this.flagShowBackground = 0 // 0: hide; 1: show
        this.flagShowSprites = 0 // 0: hide; 1: show
        this.flagRedTint = 0 // 0: normal; 1: emphasized
        this.flagGreenTint = 0 // 0: normal; 1: emphasized
        this.flagBlueTint = 0 // 0: normal; 1: emphasized

        // $2002 PPUSTATUS
        this.flagSpriteZeroHit = 0
        this.flagSpriteOverflow = 0

        // $2003 OAMADDR
        this.oamAddress = 0

        // $2007 PPUDATA
        this.bufferedData = 0 // for buffered reads

        this.reset();
    }

    getFrontFrame() {
        return this.front;
    }

    getBackFrame() {
       //return this.back.getImage();
       return this.back;
    }

    getFrameCounter() {
        return this.frameCounter;
    }

    // DONE
    reset() {
        this.cycle = 340;
        this.scanLine = 240;
        this.frameCounter = 0;
        this.writeControl(0);
        this.writeMask(0);
        this.writeOAMAddress(0);
    }

    /**
     * readPallette return the palette at the given address
     * @param {*} address 
     */
    readPalette(address) {
        if (address >= 16 && address % 4 == 0) address -= 16
        return this.paletteData[address]
    }

    /**
     * writePalette write value at the given address
     * @param {*} address 
     * @param {*} value 
     */
    writePalette(address, value) {
        if (address >= 16 && address % 4 == 0) address -= 16
        this.paletteData[address] = value
    }

    /**
     * readRegister 
     * @param {*} address 
     */
    readRegister(address) {
        if (address === 0x2002) {
            return this.readStatus()
        } else if (address === 0x2004) {
            return this.readOAMData()
        } else if (address === 0x2007) {
            return this.readData()
        } else {
            return 0;
        }
    }

    writeRegister(address, value) {

        this.register = value;
        if (address === 0x2000) {
            this.writeControl(value);
        } else if (address === 0x2001) {
            this.writeMask(value)
        } else if (address === 0x2003) {
            this.writeOAMAddress(value)
        } else if (address === 0x2004) {
            this.writeOAMData(value)
        } else if (address === 0x2005) {
            this.writeScroll(value)
        } else if (address === 0x2006) {
            this.writeAddress(value)
        } else if (address === 0x2007) {
            this.writeData(value)
        } else if (address === 0x4014) {
            this.writeDMA(value)
        }
    }

    // $2000: PPUCTRL
    writeControl(value) {
        this.flagNameTable = (value >> 0) & 3;
        this.flagIncrement = (value >> 2) & 1;
        this.flagSpriteTable = (value >> 3) & 1;
        this.flagBackgroundTable = (value >> 4) & 1;
        this.flagSpriteSize = (value >> 5) & 1;
        this.flagMasterSlave = (value >> 6) & 1;
        this.nmiOutput = (value >> 7) & 1 == 1;
        this.nmiChange();
        this.t = (this.t & 0xF3FF) | ((value & 0x03) << 10);
    }

    // DONE
    writeMask(value) {
        this.flagGrayscale = (value >> 0) & 1
        this.flagShowLeftBackground = (value >> 1) & 1
        this.flagShowLeftSprites = (value >> 2) & 1
        this.flagShowBackground = (value >> 3) & 1
        this.flagShowSprites = (value >> 4) & 1
        this.flagRedTint = (value >> 5) & 1
        this.flagGreenTint = (value >> 6) & 1
        this.flagBlueTint = (value >> 7) & 1
    }

    // $2002: PPUSTATUS DONE
    readStatus() {
        let result = this.register & 0x1F;
        result |= this.flagSpriteOverflow << 5;
        result |= this.flagSpriteZeroHit << 6;
        if (this.nmiOccurred) result |= 1 << 7;
        this.nmiOccurred = false;
        this.nmiChange();
        this.w = 0;
        return result;
    }

    // $2004: OAMDATA (read)
    readOAMData() {
        return this.oamData[this.oamAddress]
    }

    // $2007: PPUDATA (read)
    readData() {
        let value = this.nes.CPU.memory.readPPU(this.v);
        // emulate buffered reads
        if (this.v % 0x4000 < 0x3F00) {
            let buffered = this.bufferedData
            this.bufferedData = value
            value = buffered
        } else {
            this.bufferedData = this.nes.CPU.memory.readPPU(this.v - 0x1000);
        }
        // increment address
        this.v += this.flagIncrement === 0 ? 1 : 32;
        return value;
    }


    writeOAMAddress(value) {
        this.oamAddress = value
    }

    writeOAMData(value) {
        this.oamData[this.oamAddress] = value;
        this.oamAddress++;
    }

    writeScroll(value) {
        if (this.w === 0) {
            this.t = (this.t & 0xFFE0) | (value >> 3)
            this.x = value & 0x07
            this.w = 1
        } else {
            this.t = (this.t & 0x8FFF) | ((value & 0x07) << 12)
            this.t = (this.t & 0xFC1F) | ((value & 0xF8) << 2)
            this.w = 0
        }
    }

    writeAddress(value) {
        if (this.w === 0) {
            this.t = (this.t & 0x80FF) | ((value & 0x3F) << 8)
            this.w = 1
        } else {
            this.t = (this.t & 0xFF00) | value
            this.v = this.t
            this.w = 0
        }
    }

    writeData(value) {
        this.nes.CPU.memory.writePPU(this.v, value);
        this.v += this.flagIncrement === 0 ? 1 : 32;
    }

    writeDMA(value) {
        let cpu = this.nes.CPU
        let address = value << 8
        for (var i = 0; i < 256; i++) {
            this.oamData[this.oamAddress] = cpu.read(address)
            this.oamAddress++
            address++
        }
        cpu.stall += 513
        if (cpu.cycles % 2 == 1) {
            cpu.stall++
        }
    }

    // NTSC Timing Helper Functions
    incrementX() {
        // increment hori(v)
        // if coarse X == 31
        if (this.v & 0x001F === 31) {
            // coarse X = 0
            this.v &= 0xFFE0
            // switch horizontal nametable
            this.v ^= 0x0400
        } else {
            // increment coarse X
            this.v++
        }
    }

    incrementY() {
        // increment vert(v)
        // if fine Y < 7
        if (this.v & 0x7000 != 0x7000) {
            // increment fine Y
            this.v += 0x1000
        } else {
            // fine Y = 0
            this.v &= 0x8FFF
            // let y = coarse Y
            let y = (this.v & 0x03E0) >> 5
            if (y == 29) {
                // coarse Y = 0
                y = 0
                // switch vertical nametable
                this.v ^= 0x0800
            } else if (y == 31) {
                // coarse Y = 0, nametable not switched
                y = 0
            } else {
                // increment coarse Y
                y++
            }
            // put coarse Y back into v
            this.v = (this.v & 0xFC1F) | (y << 5)
        }
    }

    copyX() {
        // hori(v) = hori(t)
        // v: .....F.. ...EDCBA = t: .....F.. ...EDCBA
        this.v = (this.v & 0xFBE0) | (this.t & 0x041F)
    }

    copyY() {
        // vert(v) = vert(t)
        // v: .IHGF.ED CBA..... = t: .IHGF.ED CBA.....
        this.v = (this.v & 0x841F) | (this.t & 0x7BE0)
    }

    nmiChange() {
        let nmi = this.nmiOutput && this.nmiOccurred
        if (nmi && !this.nmiPrevious) {
            this.nmiDelay = 15
        }
        this.nmiPrevious = nmi
    }

    setVerticalBlank() {
        let tmp;
        this.front = tmp;
        this.front = this.back;
        this.back = tmp;
        this.nmiOccurred = true
        this.nmiChange()
    }

    clearVerticalBlank() {
        this.nmiOccurred = false
        this.nmiChange()
    }

    fetchNameTableByte() {
        let v = this.v
        let address = 0x2000 | (v & 0x0FFF)
        this.nameTableByte = this.nes.CPU.memory.readPPU(address)
    }

    fetchAttributeTableByte() {
        let v = this.v
        let address = 0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07)
        let shift = ((v >> 4) & 4) | (v & 2)
        this.attributeTableByte = ((this.nes.CPU.memory.readPPU(address) >> shift) & 3) << 2
    }

    fetchLowTileByte() {
        let fineY = (this.v >> 12) & 7
        let table = this.flagBackgroundTable
        let tile = this.nameTableByte
        let address = 0x1000 * table + tile * 16 + fineY
        this.lowTileByte = this.nes.CPU.memory.readPPU(address)
    }

    fetchHighTileByte() {
        let fineY = (this.v >> 12) & 7
        let table = this.flagBackgroundTable
        let tile = this.nameTableByte
        let address = 0x1000 * table + tile * 16 + fineY
        this.highTileByte = this.nes.CPU.memory.readPPU(address + 8)
    }

    storeTileData() {
        let data;
        for (var i = 0; i < 8; i++) {
            let a = this.attributeTableByte
            let p1 = (this.lowTileByte & 0x80) >> 7
            let p2 = (this.highTileByte & 0x80) >> 6
            this.lowTileByte <<= 1
            this.highTileByte <<= 1
            data <<= 4
            data |= a | p1 | p2
        }
        this.tileData |= data
    }

    fetchTileData() {
        return this.tileData >> 32
    }

    backgroundPixel() {
        if (this.flagShowBackground == 0) return 0
        let data = this.fetchTileData() >> ((7 - this.x) * 4)
        return data & 0x0F
    }

    spritePixel() {
        if (this.flagShowSprites == 0) {
            return [0, 0]
        }
        for (var i = 0; i < this.spriteCount; i++) {
            let offset = (this.Cycle - 1) - this.spritePositions[i]
            if (offset < 0 || offset > 7) {
                continue
            }
            offset = 7 - offset
            let color = (this.spritePatterns[i] >> (offset * 4)) & 0x0F
            if (color % 4 == 0) {
                continue
            }
            return [i, color]
        }
        return [0, 0]
    }


        

    renderPixel() {
        let x = this.cycle - 1
        let y = this.ScanLine
        let background = this.backgroundPixel()
        let tmp = this.spritePixel();
        let i = tmp[0], sprite = tmp[1]
        if (x < 8 && this.flagShowLeftBackground == 0) background = 0
        if (x < 8 && this.flagShowLeftSprites == 0) sprite = 0
        let b = background % 4 != 0
        let s = sprite % 4 != 0
        var color
        if (!b && !s) {
            color = 0
        } else if (!b && s) {
            color = sprite | 0x10
        } else if (b && !s) {
            color = background
        } else {
            if (this.spriteIndexes[i] == 0 && x < 255) this.flagSpriteZeroHit = 1
            if (this.spritePriorities[i] == 0) {
                color = sprite | 0x10
            } else {
                color = background
            }
        }
        c = this.nes.palette[this.readPalette(color) % 64].getColorRGBA();
        this.back.setRGBA(x, y, c)
        console.log("RENDERING PIXEL")
    }

    fetchSpritePattern(i, row) {
        let tile = this.oamData[i * 4 + 1]
        let attributes = this.oamData[i * 4 + 2]
        var address
        if (this.flagSpriteSize == 0) {
            if (attributes & 0x80 == 0x80) {
                row = 7 - row
            }
            let table = this.flagSpriteTable
            address = 0x1000 * table + tile * 16 + row
        } else {
            if (attributes & 0x80 == 0x80) {
                row = 15 - row
            }
            table = tile & 1
            tile &= 0xFE
            if (row > 7) {
                tile++
                row -= 8
            }
            address = 0x1000 * table + tile * 16 + row
        }
        let a = (attributes & 3) << 2
        let lowTileByte = this.nes.CPU.memory.readPPU(address)
        let highTileByte = this.nes.CPU.memory.readPPU(address + 8)
        var data
        for (var i = 0; i < 8; i++) {
            var p1, p2;
            if (attributes & 0x40 == 0x40) {
                p1 = (lowTileByte & 1) << 0
                p2 = (highTileByte & 1) << 1
                lowTileByte >>= 1
                highTileByte >>= 1
            } else {
                p1 = (lowTileByte & 0x80) >> 7
                p2 = (highTileByte & 0x80) >> 6
                lowTileByte <<= 1
                highTileByte <<= 1
            }
            data <<= 4
            data |= a | p1 | p2
        }
        return data
    }

    evaluateSprites() {
        let h = this.flagSpriteSize === 0 ? 8 : 16;
        let count = 0;

        for (var i = 0; i < 64; i++) {
            let y = this.oamData[i * 4 + 0]
            let a = this.oamData[i * 4 + 2]
            let x = this.oamData[i * 4 + 3]
            let row = this.ScanLine - y
            if (row < 0 || row >= h) {
                continue
            }
            if (count < 8) {
                this.spritePatterns[count] = this.fetchSpritePattern(i, row)
                this.spritePositions[count] = x
                this.spritePriorities[count] = (a >> 5) & 1
                this.spriteIndexes[count] = i
            }
            count++
        }
        if (count > 8) {
            count = 8
            this.flagSpriteOverflow = 1
        }
        this.spriteCount = count
    }

    // tick updates Cycle, ScanLine and Frame counters
    tick() {
        if (this.nmiDelay > 0) {
            this.nmiDelay--
            if (this.nmiDelay == 0 && this.nmiOutput && this.nmiOccurred) {
                this.nes.CPU.triggerNMI()
            }
        }

        if (this.flagShowBackground != 0 || this.flagShowSprites != 0) {
            if (this.f == 1 && this.scanLine == 261 && this.cycle == 339) {
                this.cycle = 0
                this.scanLine = 0
                this.frameCounter++
                this.f ^= 1
                return
            }
        }
        this.cycle++
        if (this.cycle > 340) {
            this.cycle = 0
            this.scanLine++
            if (this.scanLine > 261) {
                this.scanLine = 0
                this.frameCounter++
                this.f ^= 1
            }
        }

    }

    // Step executes a single PPU cycle
    step() {
        this.tick()

        let renderingEnabled = this.flagShowBackground != 0 || this.flagShowSprites != 0
        let preLine = this.scanLine == 261
        let visibleLine = this.scanLine < 240

        let renderLine = preLine || visibleLine
        let preFetchCycle = this.cycle >= 321 && this.cycle <= 336
        let visibleCycle = this.cycle >= 1 && this.cycle <= 256
        let fetchCycle = preFetchCycle || visibleCycle

        // background logic
        if (renderingEnabled) {
            if (visibleLine && visibleCycle) {
                this.renderPixel()
            }
            if (renderLine && fetchCycle) {
                this.tileData <<= 4
                switch (this.cycle % 8) {
                    case 1:
                        this.fetchNameTableByte()
                    case 3:
                        this.fetchAttributeTableByte()
                    case 5:
                        this.fetchLowTileByte()
                    case 7:
                        this.fetchHighTileByte()
                    case 0:
                        this.storeTileData()
                }
            }
            if (preLine && this.cycle >= 280 && this.cycle <= 304) {
                this.copyY()
            }
            if (renderLine) {
                if (fetchCycle && this.cycle % 8 == 0) {
                    this.incrementX()
                }
                if (this.cycle == 256) {
                    this.incrementY()
                }
                if (this.cycle == 257) {
                    this.copyX()
                }
            }
        }

        // sprite logic
        if (renderingEnabled) {
            if (this.cycle == 257) {
                if (visibleLine) {
                    this.evaluateSprites()
                } else {
                    this.spriteCount = 0
                }
            }
        }

        // vblank logic
        if (this.scanLine == 241 && this.cycle == 1) {
            this.setVerticalBlank()
        }
        if (preLine && this.Cycle == 1) {
            this.clearVerticalBlank()
            this.flagSpriteZeroHit = 0
            this.flagSpriteOverflow = 0
        }
    }
}