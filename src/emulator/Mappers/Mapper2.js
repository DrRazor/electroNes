/**
    The NES’ limited memory was sufficient for early games, however as they became more complex, games became larger and the memory was insufficient. To allow cartridges to contain more ROM, the NES had to be able to swap the data in and out of memory when it was needed. Since the NES could not address beyond $FFFF, switching hardware in the cartridges themselves was used. This hardware was known as a memory mapper or MMC (Memory Management Chip).
    The basic idea of memory mapping is that when the system requires access to data on a ROM bank that is not currently loaded in memory, the software indicates the need to switch banks and the selected bank is loaded into a page in memory, replacing the existing contents. The use of memory mappers was one of the factors in the NES’ longevity, allowing it to survive technological deficiencies.
 */

export default class Mapper2 {
    constructor(rom) {
        this.rom = rom;
        this.programBanks = rom.programData.length / 0x4000
        this.programBank1 = 0
        this.programBank2 = this.programBanks - 1
    }

    read(address) {
        if (address < 0x2000) return this.rom.characterData[address]
        else if (address >= 0xC000) {
            let index = (this.programBank2 * 0x4000) + address - 0xC000
            return this.rom.programData[index]
        } else if (address >= 0x8000) {
            let index = ( this.programBank1 ) * 0x4000 + address - 0x8000
            //return this.rom.programData[index]
            return this.rom.programData[index];
        } else if (address >= 0x6000) {
            let index = address - 0x6000;
            return this.rom.SRAM[index]
        } else {
            console.log("Unhandled mapper2 read at address: " + parseInt(address.toString(), 16));
            return 0
        }
    }

    write(address, value) {
        if (address < 0x2000) this.rom.characterData[address] = value
        else if (address >= 0x8000) this.programBank1 = value % this.programBanks
        else if (address >= 0x6000) {
            let index = address - 0x6000
            this.rom.SRAM[index] = value
        } else {
            console.log("Unhandled mapper2 write at address: " + parseInt(address.toString(), 16));
        }
    }

    step() {
    }
}