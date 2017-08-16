import fs from 'fs';
import MMC from './MMC';

export default class Cartridge {

    constructor(nes) {
        this.nes = nes;
    }
    /*
    getMMC() {
        return this.mmc;
    }*/

    loadRom(path) {
        /**
         * 0-3
         * N => 0x4E = 0d78
         * E => 0x45 = 0d69
         * S => 0x53 = 0d83
         * . => 0x1A = 0d26 (MS-DOS eof => SUB today)
         */
        const CORRECT_HEADER = [78, 69, 83, 26];
        return new Promise((resolve, reject) => {
            fs.readFile(path,(error, data) => {
                // if any error occured while reading, reject the promise with that error
                if (error) reject(error);

                let pointer = 0;

                for (let i = 0; i < CORRECT_HEADER.length; ++i) {
                    // If the headers are not correct, reject the ROM
                    if (CORRECT_HEADER[i] !== data[pointer++]) {
                        reject('Invalid NES header for file!');
                    }
                }

                // Size of PRG ROM in 16 KB units
                let programPageCount = data[pointer++];
                // Size of CHR ROM in 8 KB units (Value 0 means the board uses CHR RAM)
			    let characterPageCount = data[pointer++];
                // ROM Control Byte 1:
                let romControlByte1 = data[pointer++];
                // • Bit 0 - Indicates the type of mirroring used by the game where 0 indicates horizontal mirroring, 1 indicates vertical mirroring.
                let horizontalMirroring = (romControlByte1 & 0x01) === 0
                // • Bit 1 - Indicates the presence of battery-backed RAM at memory locations $6000-$7FFF.
                let battery = (romControlByte1 & 0x02) > 0
                // • Bit 2 - Indicates the presence of a 512-byte trainer at memory locations $7000-$71FF.
                let hasTrainer = (romControlByte1 & 0x04) > 0
                // • Bit 3 - If this bit is set it overrides bit 0 to indicate four- screen mirroring should be used.
                let fourScreenMirroring = (romControlByte1 & 0x08) > 0
                // • Bits 4-7 - Four lower bits of the mapper number.
                let lowerBitsMapperNumber = romControlByte1 & 0xF0

                // ROM Control Byte 2:
			    let romControlByte2 = data[pointer++];
                // • Bits 0-3 - Reserved for future usage and should all be 0.
                // • Bits 4-7 - Four upper bits of the mapper number
                let upperBitsMapperNumber = romControlByte2 & 0xF0

                let mirroringMethod = fourScreenMirroring ? 2  : horizontalMirroring ? 0 : 1;
                let mapperNumber = (lowerBitsMapperNumber >> 4) | upperBitsMapperNumber;

                console.log("ROM Mapper Type: " +mapperNumber)
                // Number of 8 KB RAM banks. For compatibility with previous versions of the iNES format, assume 1 page of RAM when this is 0.
			    let ramPageCount = data[pointer++];

                // Skipping 7 bytes because Reserved for future usage and should all be 0.
                pointer +=7;

                // Following the header is the 512-byte trainer, if one is present
                if(hasTrainer) pointer += 512;

                // read in 8k chunks, prgPageCount is 16k chunk : 2 * 8192 = 16KB
                let programSize = programPageCount * 2 * 8192;
                let programData = data.subarray(pointer, pointer + programSize)
                pointer += programSize;

                var characterSize = characterPageCount * 8192;
                let characterData = data.subarray(pointer, pointer + characterSize)

                let rom = {
                    characterData,
                    programData,
                    mirroringMethod,
                    mapperNumber,
                    SRAM : new Array(0x2000)
                }

                let mapper = new MMC(rom, this.nes.RAM);
                this.nes.setMapper(mapper)
                resolve("NES ROM Correctly loaded");
            })
        })
    }
}