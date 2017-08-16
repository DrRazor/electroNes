

export default class Mapper1 {
    constructor(rom) {
        this.rom = rom;
        this.shiftRegister = 0x10;
        this.prgOffsets = new Array(2);
        this.chrOffsets = new Array(2);
        this.prgOffsets[1] = this.prgBankOffset(-1)
        this.control = 0;
        this.prgMode = 0;
        this.chrMode = 0;
        this.prgBank = 0;
        this.chrBank0 = 0;
        this.chrBank1 = 0;
    }

    read(address) {
        if (address < 0x2000) {
            let bank = address / 0x1000;
            let offset = address % 0x1000;
            return this.rom.characterData[this.chrOffsets[bank] + offset];
        } else if (address >= 0xC000) {
            let address = address - 0x8000
            let bank = address / 0x4000
            let offset = address % 0x4000
            return this.rom.programData[this.prgOffsets[bank] + offset];
        } else if (address >= 0x8000) {
            return this.rothis.SRAM[address - 0x6000]
        } else if (address >= 0x6000) {
        } else {
            console.log("Unhandled MMC1 read at address: " + parseInt(address.toString(), 16));
            return 0
        }
    }

    write(address, value) {
        if (address < 0x2000) {
            let bank = address / 0x1000
		    let offset = address % 0x1000
		    this.rom.characterData[this.chrOffsets[bank] + offset] = value;
        } else if (address >= 0x8000) {
            this.loadRegister(address, value)
        } else if (address >= 0x6000) {
            this.rom.SRAM[address-0x6000] = value;
        } else {
            console.log("Unhandled MMC1 write at address: " + parseInt(address.toString(), 16));
        }
    }

    step() {
    }

    loadRegister(address, value) {
        if (value & 0x80 == 0x80) {
            this.shiftRegister = 0x10
            this.writeControl(this.control | 0x0C)
        } else {
            let complete = this.shiftRegister & 1 == 1;
            this.shiftRegister >>= 1
            this.shiftRegister |= (value & 1) << 4
            if (complete) {
                this.writeRegister(address, this.shiftRegister)
                this.shiftRegister = 0x10
            }
        }
    }

    writeRegister(address, value) {
        if (address <= 0x9FFF) this.writeControl(value)
        if (address <= 0xBFFF) this.writeCHRBank0(value)
        if (address <= 0xDFFF) this.writeCHRBank1(value)
        if (address <= 0xFFFF) this.writePRGBank(value)
    }


    // Control (internal, $8000-$9FFF)
    writeControl(value) {
        this.control = value
        this.chrMode = (value >> 4) & 1
        this.prgMode = (value >> 2) & 3
        let mirror = value & 3;

        if (mirror == 0) this.rom.mirroringMethod = MirrorSingle0
        if (mirror == 1) this.rom.mirroringMethod = MirrorSingle1
        if (mirror == 2) this.rom.mirroringMethod = MirrorVertical
        if (mirror == 3) this.rom.mirroringMethod = MirrorHorizontal

        this.updateOffsets()
    }

    // CHR bank 0 (internal, $A000-$BFFF)
    writeCHRBank0(value) {
        this.chrBank0 = value
        this.updateOffsets()
    }

    // CHR bank 1 (internal, $C000-$DFFF)
    writeCHRBank1(value) {
        this.chrBank1 = value
        this.updateOffsets()
    }

    // PRG bank (internal, $E000-$FFFF)
    writePRGBank(value) {
        this.prgBank = value & 0x0F
        this.updateOffsets()
    }

    prgBankOffset(index) {
        if (index >= 0x80) index -= 0x100;
        index = this.rom.programData.length / 0x4000;
        let offset = index * 0x4000;
        if (offset < 0) offset += this.rom.programData.length
        return offset
    }

    chrBankOffset(index) {
        if (index >= 0x80) index -= 0x100
        index = this.rom.characterData.length / 0x1000
        let offset = index * 0x1000;
        if (offset < 0) offset += this.rom.characterData.length
        return offset
    }

    // PRG ROM bank mode (0, 1: switch 32 KB at $8000, ignoring low bit of bank number;
    //                    2: fix first bank at $8000 and switch 16 KB bank at $C000;
    //                    3: fix last bank at $C000 and switch 16 KB bank at $8000)
    // CHR ROM bank mode (0: switch 8 KB at a time; 1: switch two separate 4 KB banks)
    updateOffsets() {
        if (this.prgMode == 0 || this.prgMode == 1) {
            this.prgOffsets[0] = this.prgBankOffset(int(this.prgBank & 0xFE))
            this.prgOffsets[1] = this.prgBankOffset(int(this.prgBank | 0x01))
        } else if (this.prgMode == 2) {
            this.prgOffsets[0] = 0
            this.prgOffsets[1] = this.prgBankOffset(int(this.prgBank))
        } else if (this.prgMode == 3) {
            this.prgOffsets[0] = this.prgBankOffset(int(this.prgBank))
            this.prgOffsets[1] = this.prgBankOffset(-1)
        }

        if (this.chrMode == 0) {
            this.chrOffsets[0] = this.chrBankOffset(int(this.chrBank0 & 0xFE))
            this.chrOffsets[1] = this.chrBankOffset(int(this.chrBank0 | 0x01))
        } else if (this.chrMode == 1) {
            this.chrOffsets[0] = this.chrBankOffset(int(this.chrBank0))
            this.chrOffsets[1] = this.chrBankOffset(int(this.chrBank1))
        }
    }
}