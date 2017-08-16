const 
	MirrorHorizontal = 0,
	MirrorVertical   = 1,
	MirrorSingle0    = 2,
	MirrorSingle1    = 3,
	MirrorFour       = 4;

const mirrorLookup = [[0,0,1,1],[0,1,0,1],[0,0,0,0],[1,1,1,1],[0,1,2,3]];

export default class Memory {
    constructor(nes) {
        this.nes = nes;
        // 2KB RAM
        this.RAM = new Array(2048);
        // Power UP values loaded into RAM
        for (var i = 0; i < this.RAM.length; ++i) {
            this.RAM[i] = 0xFF;
        }
        this.RAM[0x0008] = 0xF7;
        this.RAM[0x0009] = 0xEF;
        this.RAM[0x000a] = 0xDF;
        this.RAM[0x000f] = 0xBF;
    }



    read(address) {

        let verbose = false;
        if (address < 0x2000) {

            if(verbose) console.log("  RAM - Direct Reading at $" + address.toString(16) )
            return this.RAM[address % 0x0800]
        } else if (address < 0x4000) {
            if(verbose) console.log("  RAM - PPU Reading register at $" + address.toString(16))
            return this.nes.PPU.readRegister(0x2000 + address % 8)
        }
        // The CPU has a DMA (Direct memory access) to the PPU VRAM.
        else if (address == 0x4014) {
            if(verbose) console.log("  RAM - DMAing PPU VRAM at $" + address.toString(16))
            return this.nes.PPU.readRegister(address)
        } else if (address == 0x4015) {
            if(verbose) console.log("  RAM - APU Reading register at $" + address.toString(16))
            return this.nes.APU.readRegister(address)
        }
        /**
         * The 6502 used memory mapped I/O (input/output). 
         * This means that the same instructions and bus are used to communicate with I/O devices as with memory, 
         * that writing to a specific memory location writes to the appropriate device. 
         * In the NES, the I/O ports for input devices were $4016 and $4017
         */
        else if (address == 0x4016) {
            if(verbose) console.log("  RAM - Reading Controller 1 at $" + address.toString(16))
            return this.nes.controller1.read();
        }
        else if (address == 0x4017) {
            if(verbose) console.log("  RAM - Reading Controller 2 at $" + address.toString(16))
            return this.nes.controller2.read();
        }
        else if (address >= 0x6000) {
            if(verbose) console.log("  RAM - Reading ROM at $" + address.toString(16))
            return this.nes.mapper.read(address)
        }
        else {
            console.log("Address not valid");
            return 0;
        }
    }

    write(address, value) {
        console.log("  Ram - Writing " + value.toString(16) + " at $" + address.toString(16))
        if (address < 0x2000) this.RAM[address % 0x0800] = value;
        else if (address < 0x4000) this.nes.PPU.writeRegister(0x2000 + address % 8, value)
        else if (address < 0x4014) this.nes.APU.writeRegister(address, value)
        else if (address == 0x4014) this.nes.PPU.writeRegister(address, value)
        else if (address == 0x4015) this.nes.APU.writeRegister(address, value)
        else if (address == 0x4016) {
            this.nes.controller1.write(value);
            this.nes.controller2.write(value);
        } else if (address == 0x4017) this.nes.APU.writeRegister(address, value)
        else if (address >= 0x6000) this.nes.cartridge.mapper.write(address, value)
        else {
            console.log("Address not valid");
        }
    }

    readPPU(address) {
        address = address % 0x4000

        if (address < 0x2000) {
            return this.nes.mapper.read(address)
        } else if (address < 0x3F00) {
            let mode = this.nes.mapper.getRom().mirroringMethod;
            return this.nes.PPU.nameTableData[this.mirrorAddress(mode, address) % 2048]
        } else if (address < 0x4000) {
            return this.nes.PPU.readPalette(address % 32);
        } else {
            console.log("Unhandled PPU memory read at address:" + address)
            return 0;
        }
    }

    writePPU(address, value) {
        address = address % 0x4000;
        if (address < 0x2000) {
            this.nes.mapper.write(address, value);
        } else if (address < 0x3F00) {
            let mode = this.nes.mapper.getRom().mirroringMethod;
            this.nes.PPU.nameTableData[this.mirrorAddress(mode, address) % 2048] = value;
        } else if (address < 0x4000) {
            this.nes.PPU.writePalette(address % 32, value);
        } else {
            console.log("Unhandled PPU memory read at address:" + address)
        }
    }

    mirrorAddress(mode, address)  {
	    address = (address - 0x2000) % 0x1000;
	    let table = address / 0x0400;
	    let offset = address % 0x0400;
	    return 0x2000 + mirrorLookup[mode][table]*0x0400 + offset;
    }
    
}